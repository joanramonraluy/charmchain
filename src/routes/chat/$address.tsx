// src/routes/chat/$address.tsx
import { useEffect, useRef, useState, useContext } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MDS } from "@minima-global/mds";
import { appContext } from "../../AppContext";
import CharmSelector from "../../components/chat/CharmSelector";
import { Paperclip } from "lucide-react";
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
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'zombie';
  tokenAmount?: { amount: string; tokenName: string }; // For token transfer messages
}

import PendingTransactionsModal from "../../components/chat/PendingTransactionsModal";

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
  const [showPendingModal, setShowPendingModal] = useState(false);

  const [showReadModeWarning, setShowReadModeWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { writeMode, userName } = useContext(appContext);

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
  // Helper to load messages from DB - reusable for initial load and after sending
  const loadMessagesFromDB = async () => {
    if (!contact?.publickey) return;

    try {
      const rawMessages = await minimaService.getMessages(contact.publickey);

      if (Array.isArray(rawMessages)) {
        const parsedMessages = rawMessages.map((row: any) => {
          const isCharm = row.TYPE === "charm";
          const isToken = row.TYPE === "token";
          const charmObj = isCharm ? { id: row.MESSAGE } : null;

          let tokenAmount: { amount: string; tokenName: string } | undefined;
          let displayText: string | null = null;

          if (isToken) {
            try {
              const tokenData = JSON.parse(decodeURIComponent(row.MESSAGE || "{}"));
              tokenAmount = { amount: tokenData.amount, tokenName: tokenData.tokenName };
              displayText = `I sent you ${tokenData.amount} ${tokenData.tokenName}`;
            } catch (err) {
              console.error("[DB] Error parsing token data:", err);
              displayText = decodeURIComponent(row.MESSAGE || "");
            }
          } else if (!isCharm) {
            displayText = decodeURIComponent(row.MESSAGE || "");
          }

          // console.log(`🔍 [loadMessages] Message timestamp=${row.DATE}, STATE from DB="${row.STATE}", type=${row.TYPE}`);

          return {
            text: displayText,
            fromMe: row.USERNAME === "Me",
            charm: charmObj,
            amount: isCharm ? Number(row.AMOUNT || 0) : null,
            timestamp: Number(row.DATE || 0),
            status: (row.STATE as 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'zombie') || 'sent',
            tokenAmount,
          };
        });

        // console.log(`🔍 [loadMessages] Loaded ${parsedMessages.length} messages. Pending: ${parsedMessages.filter(m => m.status === 'pending').length}, Zombie: ${parsedMessages.filter(m => m.status === 'zombie').length}`);
        const deduplicatedMessages = deduplicateMessages(parsedMessages);
        setMessages(deduplicatedMessages);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  useEffect(() => {
    if (!address || !contact?.publickey) return;

    const initChat = async () => {
      // console.log("🚀 [ChatPage] initChat START for", contact.publickey);

      // Initial load
      await loadMessagesFromDB();

      // Mark chat as opened
      minimaService.markChatAsOpened(contact.publickey);

      // Verify pending transactions when entering chat
      // This ensures we catch any updates that happened while outside the chat
      // console.log("🧹 [ChatPage] Verifying pending transactions...");
      minimaService.cleanupOrphanedPendingTransactions().catch(err => {
        console.error("❌ [ChatPage] Error verifying pending transactions:", err);
      });
    };

    initChat();

    // Poll for new messages every 10 seconds (matches transaction polling)
    const interval = setInterval(() => {
      loadMessagesFromDB();
    }, 10000);

    return () => clearInterval(interval);
  }, [address, contact, userName]);


  const [appStatus, setAppStatus] = useState<'unknown' | 'checking' | 'installed' | 'not_found'>('unknown');

  /* ----------------------------------------------------------------------------
      LISTEN FOR INCOMING MESSAGES
  ---------------------------------------------------------------------------- */
  useEffect(() => {
    if (!contact) return;

    // Always check app status when entering chat
    if (contact.publickey) {
      // console.log("🔄 [Chat] Auto-checking app status...");
      setAppStatus('checking');
      minimaService.sendPing(contact.publickey).catch(console.error);

      // Timeout for auto-check
      setTimeout(() => {
        setAppStatus((prev) => prev === 'checking' ? 'not_found' : prev);
      }, 5000);
    }

    const handleNewMessage = (payload: any) => {
      // Handle Pong response
      if (payload.type === 'pong') {
        setAppStatus('installed');
        // Save that this user has the app installed
        if (contact.publickey) {
          minimaService.setAppInstalled(contact.publickey);
        }
        return;
      }

      // Reload messages from DB to get latest state
      // Use contact.publickey to ensure we get the correct messages
      loadMessagesFromDB().then(() => {
        // If this is a NEW MESSAGE (not a receipt), send read receipt
        if (payload.type !== 'read_receipt' && payload.type !== 'delivery_receipt' && payload.type !== 'ping') {
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
  }, [contact, address]); // Re-run when contact or address changes

  /* ----------------------------------------------------------------------------
      AUTOSCROLL
  ---------------------------------------------------------------------------- */
  const isInitialLoad = useRef(true);

  // Reset initial load state when address changes
  useEffect(() => {
    isInitialLoad.current = true;
  }, [address]);

  const scrollToBottom = () => {
    if (isInitialLoad.current) {
      // Use requestAnimationFrame to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
        });
      });
      isInitialLoad.current = false;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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
  const executeSendCharm = async (charmId: string, amount: number) => {
    if (!contact?.publickey || !contact?.extradata?.minimaaddress) return;
    const username = contact?.extradata?.name || "Unknown";

    // Optimistic UI update REMOVED - we will show a separate pending indicator instead
    const tempTimestamp = Date.now();

    try {
      console.log("⏳ [ChatPage] Sending charm (pending indicator will be shown)...");


      const response = await minimaService.sendCharmWithTokens(
        contact.publickey,
        contact.extradata.minimaaddress,
        username,
        charmId,
        amount,
        tempTimestamp // Pass timestamp as stateId for tracking
      );

      // Reload messages from DB to get the inserted message (it will be pending or sent)
      await loadMessagesFromDB();

      // Only update to 'sent' if NOT pending
      if (!response || !response.pending) {
        console.log("✅ [ChatPage] Charm sent successfully (not pending). Updating status to 'sent'.");
        setMessages((prev) =>
          prev.map((m) =>
            m.timestamp === tempTimestamp ? { ...m, status: 'sent' as const } : m
          )
        );
      } else {
        console.log("⚠️ [ChatPage] Charm command is pending (Read Mode). Keeping status as 'pending'.");

        // Pending message tracking is now handled by transaction polling service
      }
    } catch (err) {
      console.error("Failed to send charm:", err);
      // Reload to ensure consistent state
      loadMessagesFromDB();
    }
  };

  const handleSendCharm = async ({ charmId, amount }: { charmId: string; charmLabel?: string; charmAnimation?: any; amount: number }) => {
    if (!charmId || !amount) return;
    if (!contact?.publickey) return;
    if (!contact?.extradata?.minimaaddress) {
      alert("This contact does not have a Minima address in their profile. Cannot send tokens with charm.");
      return;
    }

    setShowCharmSelector(false);

    // Check for Write Mode
    if (!writeMode) {
      setPendingAction(() => () => executeSendCharm(charmId, amount));
      setShowReadModeWarning(true);
      return;
    }

    await executeSendCharm(charmId, amount);
  };

  /* ----------------------------------------------------------------------------
      SEND TOKEN
  ---------------------------------------------------------------------------- */
  const executeSendToken = async (tokenId: string, amount: string, tokenName: string) => {
    if (!contact?.extradata?.minimaaddress || !contact?.publickey) return;

    const tempTimestamp = Date.now();
    const username = contact?.extradata?.name || "Unknown";
    const tokenData = JSON.stringify({ amount, tokenName });

    // Optimistic UI update REMOVED - we will show a separate pending indicator instead
    console.log("⏳ [ChatPage] Sending token (pending indicator will be shown)...");

    try {
      // 1. Send the token via Minima with stateId (timestamp)
      const tokenResponse = await minimaService.sendToken(tokenId, amount, contact.extradata.minimaaddress, tokenName, tempTimestamp);

      // Check if token send is pending
      const isTokenPending = tokenResponse && (tokenResponse.pending || (tokenResponse.error && tokenResponse.error.toString().toLowerCase().includes("pending")));

      // Extract txpowid and pendinguid
      const txpowid = tokenResponse?.txpowid;
      const pendinguid = tokenResponse?.pendinguid;

      if (isTokenPending) {
        console.log("⚠️ [ChatPage] Token send is pending. Keeping status as 'pending' and NOT sending notification message.");

        // Pending message tracking is now handled by transaction polling service

        // Save message locally with 'pending' state so it persists if we send other messages
        await minimaService.insertMessage({
          roomname: username,
          publickey: contact.publickey,
          username: "Me",
          type: "token",
          message: tokenData,
          filedata: "",
          state: "pending",
          amount: Number(amount),
          date: tempTimestamp
        });

        // Store transaction in TRANSACTIONS table if we have a txpowid OR pendinguid
        if (txpowid || pendinguid) {
          await minimaService.insertTransaction(
            txpowid,
            'token',
            contact.publickey,
            tempTimestamp,
            { tokenId, amount, tokenName, username },
            pendinguid
          );
          console.log(`💾 [ChatPage] Token transaction tracked: ${txpowid || 'No TXPOWID'} (PendingUID: ${pendinguid || 'None'})`);
        } else {
          console.warn(`⚠️ [ChatPage] Could not track token transaction: No txpowid AND no pendinguid`);
        }

        // Reload messages from DB to show the pending message
        await loadMessagesFromDB();

        // Don't send the Maxima message yet, keep it pending
        return;
      }

      // 2. Only send a chat message confirming the transaction if token was sent successfully
      console.log("✅ [ChatPage] Token sent successfully. Now sending notification message via Maxima...");
      const msgResponse = await minimaService.sendMessage(contact.publickey, username, tokenData, 'token');

      // Check if message send is pending (shouldn't happen if token wasn't pending, but just in case)
      const isMsgPending = msgResponse && (msgResponse.pending || (msgResponse.error && msgResponse.error.toString().toLowerCase().includes("pending")));

      // Only update to 'sent' if NOT pending
      if (!isMsgPending) {
        console.log("✅ [ChatPage] Token sent successfully (not pending). Updating status to 'sent'.");
        // Reload messages to show the sent message
        await loadMessagesFromDB();
      } else {
        console.log("⚠️ [ChatPage] Message command is pending (Read Mode). Keeping status as 'pending'.");
        // Reload messages to show the pending message
        await loadMessagesFromDB();
      }

    } catch (err) {
      console.error("Failed to send token:", err);
      // Reload to ensure consistent state
      loadMessagesFromDB();
    }
  };



  const handleSendToken = async (tokenId: string, amount: string, tokenName: string) => {
    if (!contact?.extradata?.minimaaddress) {
      alert("This contact does not have a Minima address in their profile. Cannot send tokens.");
      return;
    }

    setShowTokenSelector(false);

    // Check for Write Mode
    if (!writeMode) {
      setPendingAction(() => () => executeSendToken(tokenId, amount, tokenName));
      setShowReadModeWarning(true);
      return;
    }

    await executeSendToken(tokenId, amount, tokenName);
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

        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => navigate({ to: `/contact-info/${address}` })}
        >
          <img
            src={getAvatar(contact)}
            alt="Avatar"
            className="w-10 h-10 rounded-full object-cover bg-gray-300"
          />
          <div className="flex flex-col leading-tight flex-1 min-w-0">
            <strong className="text-[16px] truncate font-semibold">
              {contact?.extradata?.name || "Unknown"}
            </strong>
            <div className="flex items-center gap-1">
              {appStatus === 'installed' ? (
                <span className="text-xs text-green-200 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  CharmChain Verified
                </span>
              ) : appStatus === 'checking' ? (
                <span className="text-xs opacity-80">Checking status...</span>
              ) : appStatus === 'not_found' ? (
                <span className="text-xs text-red-200">App not detected</span>
              ) : (
                <span className="text-xs opacity-80 truncate block">
                  online
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex gap-4">
          <button
            className="opacity-80 hover:opacity-100 relative"
            onClick={() => setShowPendingModal(true)}
            title="Pending Transactions"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {/* Optional: Add a red dot if there are pending transactions (would need state for count) */}
          </button>

          <button className="opacity-80 hover:opacity-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Pending Transactions Modal */}
      {showPendingModal && (
        <PendingTransactionsModal onClose={() => setShowPendingModal(false)} />
      )}

      {/* CHAT BODY - Scrollable */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto flex flex-col p-2 sm:p-4 bg-gray-50 relative">
        {/* Custom Background Pattern (Subtle Dot Grid) */}
        <div
          className="absolute inset-0 opacity-[0.4] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#cbd5e1 1.5px, transparent 1.5px)`,
            backgroundSize: '24px 24px'
          }}
        ></div>

        {/* Pending Transactions Indicator */}
        {messages.filter(m => m.status === 'pending').length > 0 && (
          <div className="sticky top-0 z-20 mb-4 mx-2 mt-2">
            {messages.filter(m => m.status === 'pending').map((msg) => (
              <div key={msg.timestamp} className="bg-yellow-50/95 backdrop-blur-sm border border-yellow-200 rounded-lg shadow-sm p-3 mb-2 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center shrink-0 border border-yellow-200">
                    <span className="animate-spin text-xl">⏳</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-yellow-800">
                      Sending {msg.tokenAmount ? 'Token' : 'Charm'}
                    </p>
                    <p className="text-xs text-yellow-700 font-medium mt-0.5">
                      {msg.tokenAmount
                        ? `${msg.tokenAmount.amount} ${msg.tokenAmount.tokenName}`
                        : `${msg.amount} MINIMA`}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-yellow-700 font-semibold bg-yellow-100 px-2.5 py-1 rounded-full border border-yellow-200">
                  Waiting Confirmation...
                </div>
              </div>
            ))}
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center z-0">
            <div className="bg-[#FFF5C4] text-gray-800 text-[12.5px] p-3 rounded-lg shadow-sm text-center max-w-xs leading-relaxed select-none">
              <span className="text-yellow-600 mr-1">🔒</span>
              Messages are end-to-end encrypted. No one outside of this chat, not even CharmChain, can read or listen to them.
            </div>
          </div>
        )}

        {messages.filter(m => m.status !== 'pending' && m.status !== 'zombie').map((msg, i, arr) => {
          const currentDate = new Date(msg.timestamp || 0).toDateString();
          const prevDate = i > 0 ? new Date(arr[i - 1].timestamp || 0).toDateString() : null;
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
                tokenAmount={msg.tokenAmount}
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
          <Paperclip className="w-6 h-6" />
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

      {/* Read Mode Warning Dialog */}
      {showReadModeWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Read Mode Active</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                The application is in <strong>Read Mode</strong>. This transaction will appear in <strong>Pending Commands</strong> in Minima.
                <br /><br />
                You will need to approve it there to complete the transfer.
              </p>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => {
                    setShowReadModeWarning(false);
                    setPendingAction(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowReadModeWarning(false);
                    if (pendingAction) pendingAction();
                    setPendingAction(null);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}