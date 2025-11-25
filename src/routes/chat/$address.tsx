// src/routes/chat/$address.tsx
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MDS } from "@minima-global/mds";
import CharmSelector from "../../components/chat/CharmSelector";
import MessageBubble from "../../components/chat/MessageBubble";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const defaultAvatar =
    "data:image/svg+xml;base64," +
    btoa(
      `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
        <circle cx='24' cy='24' r='24' fill='#ccc'/>
        <text x='50%' y='55%' text-anchor='middle' font-size='20' fill='white' dy='.3em'>?</text>
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

    const name = c.extradata?.name || "?";
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const color = `hsl(${hash % 360}, 60%, 60%)`;

    const svgAvatar = `
      <svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
        <circle cx='24' cy='24' r='24' fill='${color}'/>
        <text x='50%' y='55%' text-anchor='middle' font-size='20' fill='white' dy='.3em'>${initials}</text>
      </svg>
    `;
    return "data:image/svg+xml;base64," + btoa(svgAvatar);
  };

  const truncate = (str: string | undefined, len = 12) =>
    str && str.length > len ? str.slice(0, len) + "…" : str || "";

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

        console.log("🐛 [DB] Raw messages:", rawMessages); // DEBUG LOG

        const parsedMessages = rawMessages.map((row: any) => {
          // SQL returns column names in UPPERCASE
          const isCharm = row.TYPE === "charm";
          const charmObj = isCharm ? { id: row.MESSAGE } : null;

          return {
            text: isCharm ? null : decodeURIComponent(row.MESSAGE || ""),
            fromMe: row.USERNAME === "Me",
            charm: charmObj,
            amount: isCharm ? Number(row.READ || 0) : null,
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
      console.log("🔔 [ChatPage] Message callback triggered:", payload);

      // Reload messages from DB to get latest state
      // This handles both new messages AND status updates from receipts
      minimaService.getMessages(address).then((rawMessages) => {
        if (!Array.isArray(rawMessages)) return;

        console.log("📥 [ChatPage] Reloaded messages from DB:", rawMessages);

        const parsedMessages = rawMessages.map((row: any) => {
          const isCharm = row.TYPE === "charm";
          const charmObj = isCharm ? { id: row.MESSAGE } : null;

          return {
            text: isCharm ? null : decodeURIComponent(row.MESSAGE || ""),
            fromMe: row.USERNAME === "Me",
            charm: charmObj,
            amount: isCharm ? Number(row.READ || 0) : null,
            timestamp: Number(row.DATE || 0),
            status: (row.STATE as 'sent' | 'delivered' | 'read') || 'sent',
          };
        });

        const deduplicatedMessages = deduplicateMessages(parsedMessages);
        setMessages(deduplicatedMessages);

        // If this is a NEW MESSAGE (not a receipt), send read receipt
        if (payload.type !== 'read_receipt' && payload.type !== 'delivery_receipt') {
          console.log("📖 [ChatPage] Sending read receipt for new message");
          if (contact.publickey) {
            minimaService.sendReadReceipt(contact.publickey);
          }
        }
      });
    };

    // Send read receipt immediately when entering the chat
    console.log("📖 [ChatPage] Entering chat, sending initial read receipt");
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
      console.log("[ChatPage] Sending message to publickey:", contact.publickey);
      await minimaService.sendMessage(contact.publickey, username, input);
      console.log("[ChatPage] Message successfully sent!");
    } catch (err) {
      console.error("[Send] Error sending message:", err);
    }

    setInput("");
  };

  /* ----------------------------------------------------------------------------
      SEND CHARM
  ---------------------------------------------------------------------------- */
  const handleSendCharm = ({ charmId, amount }: { charmId: string; charmLabel?: string; charmAnimation?: any; amount: number }) => {
    if (!charmId || !amount) return;
    if (!contact?.publickey) {
      console.error("[Send] Cannot send charm: no publickey for contact");
      return;
    }

    const username = contact?.extradata?.name || "Unknown";

    setMessages((prev) => [
      ...prev,
      { text: null, fromMe: true, charm: { id: charmId }, amount, timestamp: Date.now(), status: 'sent' }
    ]);

    console.log("[ChatPage] Sending charm to publickey:", contact.publickey, charmId, amount);

    minimaService.sendMessage(contact.publickey, username, charmId, "charm")
      .catch(err => console.error("Error sending charm:", err));
  };

  /* ----------------------------------------------------------------------------
      RENDER
  ---------------------------------------------------------------------------- */
  return (
    <div className="h-full flex flex-col p-3 bg-blue-50">
      <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-md">

        {/* HEADER - Fixed at top */}
        <div className="bg-blue-600 text-white p-4 flex items-center gap-3 flex-shrink-0">
          <img
            src={getAvatar(contact)}
            alt="Avatar"
            className="w-10 h-10 rounded-full border-2 border-blue-300 object-cover"
          />
          <div className="flex flex-col leading-tight max-w-[180px]">
            <strong className="text-lg truncate">
              {contact?.extradata?.name || "Unknown"}
            </strong>
            <span className="text-sm opacity-80 truncate block">
              {truncate(address, 18)}
            </span>
          </div>
        </div>

        {/* CHAT BODY - Scrollable */}
        <div className="flex-1 p-4 overflow-y-auto flex flex-col">
          {messages.length === 0 && (
            <p className="text-center text-blue-400 italic">
              Envia el teu primer missatge ✨
            </p>
          )}

          {messages.map((msg, i) => {
            const currentDate = new Date(msg.timestamp || 0).toDateString();
            const prevDate = i > 0 ? new Date(messages[i - 1].timestamp || 0).toDateString() : null;
            const showDate = currentDate !== prevDate;

            return (
              <div key={i} className="flex flex-col w-full">
                {showDate && msg.timestamp && (
                  <div className="text-center text-xs text-gray-400 my-4 font-medium">
                    {new Date(msg.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
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
        <div className="p-3 bg-blue-100 flex gap-2 items-center flex-shrink-0">
          <button
            className="p-2 rounded bg-purple-600 text-white hover:bg-purple-700"
            onClick={() => setShowCharmSelector(true)}
          >
            ✨ Charm
          </button>

          <input
            className="flex-1 p-2 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-black bg-white"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Escriu un missatge..."
          />

          <button
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={handleSendMessage}
          >
            Envia
          </button>
        </div>
      </div>

      {showCharmSelector && (
        <CharmSelector
          onSend={handleSendCharm}
          onClose={() => setShowCharmSelector(false)}
        />
      )}
    </div>
  );
}