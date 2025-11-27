// src/routes/chat/$address.tsx
import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MDS } from "@minima-global/mds";
import CharmSelector from "../../components/chat/CharmSelector";
import MessageBubble from "../../components/chat/MessageBubble";
import TokenSelector from "../../components/chat/TokenSelector";
import { minimaService } from "../../services/minima.service";

export const Route = createFileRoute("/chat/$address")({
  component: ChatPage,
});

// charms array removed as it is unused

interface Contact {
  currentaddress: string;
  publickey: string;  // Added: needed to send messages
  extradata?: {
    minimaaddress?: string;
    name?: string;
    icon?: string;
  };
  myaddress?: string;
}

interface ParsedMessage {
  text: string | null;
  fromMe: boolean;
  charm: { id: string } | null;
  amount: number | null;
  timestamp?: number;
  status?: 'sent' | 'delivered' | 'read';
}

function ChatPage() {
  // Helper to remove duplicate messages (by timestamp + text)
  const deduplicateMessages = (msgs: ParsedMessage[]) => {
    const seen = new Set<string>();
    return msgs.filter((m) => {
      const key = `${m.timestamp}-${m.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const { address } = Route.useParams();
  const [contact, setContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [input, setInput] = useState("");
  const [showCharmSelector, setShowCharmSelector] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const defaultAvatar =
    "data:image/svg+xml;base64," +
    btoa(
      `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
        <rect width='48' height='48' fill='#e0e0e0'/>
        <text x='50%' y='55%' text-anchor='middle' font-size='24' fill='#ffffff' dy='.3em' font-family='sans-serif'>?</text>
      </svg>`
    );

  const getAvatar = (c: Contact | null) => {
    if (!c) return defaultAvatar;

    if (c.extradata?.icon) {
      try {
        const decoded = decodeURIComponent(c.extradata.icon);
        if (decoded.startsWith("data:image")) return decoded;
      } catch (err) {
        console.warn("[Avatar] Error decoding icon:", err);
      }
    }
    return defaultAvatar;
  };



  /* ----------------------------------------------------------------------------
      GET CONTACT INFO
  ---------------------------------------------------------------------------- */
  useEffect(() => {
    const fetchContact = async () => {
      try {
        const res = await MDS.cmd.maxcontacts();
        const list: Contact[] = (res as any)?.response?.contacts || [];
        const c = list.find(
          (x) =>
            x.publickey === address ||
            x.currentaddress === address ||
            x.extradata?.minimaaddress === address
        );
        setContact(c || null);
      } catch (err) {
        console.error("[Contact] Error loading contact:", err);
      }
    };

    fetchContact();
  }, [address]);

  /* ----------------------------------------------------------------------------
      LOAD MESSAGES FROM DB
  ---------------------------------------------------------------------------- */
  useEffect(() => {
    const fetchMessages = async () => {
      if (!contact) return;

      try {
        const rawMessages = await minimaService.getMessages(address);

        if (!Array.isArray(rawMessages)) return;

        const parsedMessages = rawMessages.map((row: any) => {
          // SQL returns column names in UPPERCASE
          const isCharm = row.TYPE === "charm";
          const charmObj = isCharm ? { id: row.MESSAGE } : null;

          return {
            text: isCharm ? null : decodeURIComponent(row.MESSAGE || ""),
            fromMe: row.USERNAME === "Me",
            charm: charmObj,
            amount: isCharm ? Number(row.AMOUNT || 0) : null,
            timestamp: Number(row.DATE || 0),
            status: (row.STATE as 'sent' | 'delivered' | 'read') || 'sent',
          };
        });

        const deduplicatedMessages = deduplicateMessages(parsedMessages);
        setMessages(deduplicatedMessages);
      } catch (err) {
        console.error("[DB] Error loading messages:", err);
      }
    };

    fetchMessages();
  }, [address, contact]);

  /* ----------------------------------------------------------------------------
      LISTEN FOR INCOMING MESSAGES
  ---------------------------------------------------------------------------- */
  useEffect(() => {
    if (!contact) return;

    const handleNewMessage = (payload: any) => {
      // Reload messages from DB to get latest state
      minimaService.getMessages(address).then((rawMessages) => {
        if (!Array.isArray(rawMessages)) return;

        const parsedMessages = rawMessages.map((row: any) => {
          const isCharm = row.TYPE === "charm";
          const charmObj = isCharm ? { id: row.MESSAGE } : null;

          return {
            text: isCharm ? null : decodeURIComponent(row.MESSAGE || ""),
            fromMe: row.USERNAME === "Me",
            charm: charmObj,
            amount: isCharm ? Number(row.AMOUNT || 0) : null,
            timestamp: Number(row.DATE || 0),
            status: (row.STATE as 'sent' | 'delivered' | 'read') || 'sent',
          };
        });

        const deduplicatedMessages = deduplicateMessages(parsedMessages);
        setMessages(deduplicatedMessages);

        // If this is a NEW MESSAGE (not a receipt), send read receipt
        if (payload.type !== 'read_receipt' && payload.type !== 'delivery_receipt') {
          if (contact.publickey) {
            minimaService.sendReadReceipt(contact.publickey);
          }
        }
      });
    };

    // Send read receipt immediately when entering the chat
    if (contact.publickey) {
      minimaService.sendReadReceipt(contact.publickey);
    }

    // Subscribe to new messages
    minimaService.onNewMessage(handleNewMessage);

    // Cleanup: remove listener when component unmounts or dependencies change
    return () => {
      minimaService.removeNewMessageCallback(handleNewMessage);
    };
  }, [address, contact]);

  /* ----------------------------------------------------------------------------
      AUTOSCROLL
  ---------------------------------------------------------------------------- */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  /* ----------------------------------------------------------------------------
      SEND TEXT MESSAGE
  ---------------------------------------------------------------------------- */
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    if (!contact?.publickey) {
      console.error("[Send] Cannot send: no publickey for contact");
      return;
    }

    const username = contact?.extradata?.name || "Unknown";

    const newMsg: ParsedMessage = { text: input, fromMe: true, charm: null, amount: null, timestamp: Date.now(), status: 'sent' };
    setMessages((prev) => [...prev, newMsg]);

    try {
      await minimaService.sendMessage(contact.publickey, username, input);
    } catch (err) {
      console.error("[Send] Error sending message:", err);
    }

    setInput("");
  };

  /* ----------------------------------------------------------------------------
      SEND CHARM
  ---------------------------------------------------------------------------- */
  const handleSendCharm = async ({ charmId, amount }: { charmId: string; charmLabel?: string; charmAnimation?: any; amount: number }) => {
    if (!charmId || !amount) return;
    if (!contact?.publickey) return;
    if (!contact?.extradata?.minimaaddress) {
      alert("This contact does not have a Minima address in their profile. Cannot send tokens with charm.");
      return;
    }

    const username = contact?.extradata?.name || "Unknown";

    try {
      setShowCharmSelector(false);

      // Optimistic UI update
      setMessages((prev) => [
        ...prev,
        { text: null, fromMe: true, charm: { id: charmId }, amount, timestamp: Date.now(), status: 'sent' }
      ]);

      await minimaService.sendCharmWithTokens(
        contact.publickey,
        contact.extradata.minimaaddress,
        username,
        charmId,
        amount
      );
    } catch (err) {
      alert("Failed to send charm with tokens. Check console for details.");
    }
  };

  /* ----------------------------------------------------------------------------
      SEND TOKEN
  ---------------------------------------------------------------------------- */
  const handleSendToken = async (tokenId: string, amount: string, tokenName: string) => {
    if (!contact?.extradata?.minimaaddress) {
      alert("This contact does not have a Minima address in their profile. Cannot send tokens.");
      return;
    }

    try {
      setShowTokenSelector(false);

      // 1. Send the token via Minima
      await minimaService.sendToken(tokenId, amount, contact.extradata.minimaaddress, tokenName);

      // 2. Send a chat message confirming the transaction
      const message = `I sent you ${amount} ${tokenName}`;
      const username = contact?.extradata?.name || "Unknown";

      // Optimistic update
      setMessages((prev) => [
        ...prev,
        { text: message, fromMe: true, charm: null, amount: null, timestamp: Date.now(), status: 'sent' }
      ]);

      await minimaService.sendMessage(contact.publickey, username, message);

    } catch (err) {
      alert("Failed to send token. Check console for details.");
    }
  };

  /* ----------------------------------------------------------------------------
      RENDER
  ---------------------------------------------------------------------------- */
  return (
    <div className="h-screen flex flex-col bg-[#E5DDD5]">
      {/* HEADER - Fixed at top */}
      <div className="bg-[#0088cc] text-white p-4 px-4 flex items-center gap-3 flex-shrink-0 shadow-sm z-10">
        {/* Back button */}
        <button
          onClick={() => navigate({ to: '/' })}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          title="Back"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <img
          src={getAvatar(contact)}
          alt="Avatar"
          className="w-10 h-10 rounded-full object-cover bg-gray-300 cursor-pointer"
        />
        <div className="flex flex-col leading-tight flex-1 min-w-0 cursor-pointer">
          <strong className="text-[16px] truncate font-semibold">
            {contact?.extradata?.name || "Unknown"}
          </strong>
          <span className="text-xs opacity-80 truncate block">
            online
          </span>
        </div>

        {/* Header Actions (Placeholder) */}
        <div className="flex gap-4">
          <button className="opacity-80 hover:opacity-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button className="opacity-80 hover:opacity-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* CHAT BODY - Scrollable */}
      <div className="flex-1 overflow-y-auto flex flex-col p-2 sm:p-4 bg-gray-50 relative">
        {/* Custom Background Pattern (Subtle Dot Grid) */}
        <div
          className="absolute inset-0 opacity-[0.4] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#cbd5e1 1.5px, transparent 1.5px)`,
            backgroundSize: '24px 24px'
          }}
        ></div>

        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center z-0">
            <div className="bg-[#FFF5C4] text-gray-800 text-[12.5px] p-3 rounded-lg shadow-sm text-center max-w-xs leading-relaxed select-none">
              <span className="text-yellow-600 mr-1">🔒</span>
              Messages are end-to-end encrypted. No one outside of this chat, not even CharmChain, can read or listen to them.
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const currentDate = new Date(msg.timestamp || 0).toDateString();
          const prevDate = i > 0 ? new Date(messages[i - 1].timestamp || 0).toDateString() : null;
          const showDate = currentDate !== prevDate;

          return (
            <div key={i} className="flex flex-col w-full z-0 relative">
              {showDate && msg.timestamp && (
                <div className="flex justify-center my-3 sticky top-2 z-10">
                  <span className="text-xs text-gray-600 font-medium bg-[#E1F3FB] border border-white/50 px-3 py-1.5 rounded-lg shadow-sm uppercase tracking-wide backdrop-blur-sm">
                    {new Date(msg.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </span>
                </div>
              )}
              <MessageBubble
                fromMe={msg.fromMe}
                text={msg.text}
                charm={msg.charm}
                amount={msg.amount}
                timestamp={msg.timestamp}
                status={msg.status}
              />
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT BAR - Fixed at bottom */}
      <div className="p-2 bg-[#F0F2F5] flex gap-2 items-end flex-shrink-0 z-10 relative">
        {/* Attachment Menu Popover */}
        {showAttachments && (
          <div className="absolute bottom-16 left-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2 flex flex-col gap-1 min-w-[160px] animate-in slide-in-from-bottom-2 fade-in duration-200">
            <button
              className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
              onClick={() => {
                setShowAttachments(false);
                setShowCharmSelector(true);
              }}
            >
              <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">✨</span>
              <span className="font-medium text-gray-700">Send Charm</span>
            </button>
            <button
              className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
              onClick={() => {
                setShowAttachments(false);
                setShowTokenSelector(true);
              }}
            >
              <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">💸</span>
              <span className="font-medium text-gray-700">Send Tokens</span>
            </button>
          </div>
        )}

        <button
          className={`p-3 rounded-full transition-colors ${showAttachments ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setShowAttachments(!showAttachments)}
          title="Attachments"
        >
          <svg className="w-6 h-6 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 0 102.828 2.828l6.414-6.586a4 0 00-5.656-5.656l-6.415 6.585a6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <div className="flex-1 bg-white rounded-2xl flex items-center border border-gray-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent shadow-sm px-4 py-2 mb-1 transition-all">
          <input
            className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500 text-[15px] max-h-32 py-1"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Type a message"
          />
        </div>

        <button
          className={`p-3 rounded-full transition-all duration-200 mb-1 shadow-sm
            ${input.trim()
              ? 'bg-[#0088cc] text-white hover:bg-[#0077b5] transform hover:scale-105'
              : 'bg-gray-200 text-gray-400 cursor-default'}`}
          onClick={handleSendMessage}
          disabled={!input.trim()}
        >
          <svg className="w-5 h-5 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
          </svg>
        </button>
      </div>

      {showCharmSelector && (
        <CharmSelector
          onSend={handleSendCharm}
          onClose={() => setShowCharmSelector(false)}
        />
      )}

      {showTokenSelector && (
        <TokenSelector
          onSend={handleSendToken}
          onCancel={() => setShowTokenSelector(false)}
        />
      )}
    </div>
  );
}