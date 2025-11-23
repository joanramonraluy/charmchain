// src/routes/chat/$address.tsx
import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MDS } from "@minima-global/mds";
import CharmSelector from "../../components/chat/CharmSelector";
import MessageBubble from "../../components/chat/MessageBubble";
import { minimaService, ChatMessage } from "../../services/minima.service";

export const Route = createFileRoute("/chat/$address")({
  component: ChatPage,
});

// charms array removed as it is unused

interface Contact {
  currentaddress: string;
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
}

function ChatPage() {
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
            x.currentaddress === address ||
            x.extradata?.minimaaddress === address
        );
        setContact(c || null);
        console.log("[Contact] Loaded:", c);
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
        console.log("[ChatPage] Carregant missatges per:", address);

        const rawMessages = await minimaService.getMessages(address);

        console.log("[DB] Raw messages:", rawMessages);

        if (!Array.isArray(rawMessages)) return;

        const parsedMessages = rawMessages.map((row: ChatMessage) => {
          const isCharm = row.type === "charm";
          const charmObj = isCharm ? { id: row.message } : null;

          const parsed: ParsedMessage = {
            text: isCharm ? null : decodeURIComponent(row.message || ""),
            // TODO: Verify fromMe logic - original code used row.publickey === contact?.myaddress
            // which may not work correctly for all cases
            fromMe: row.publickey === contact?.myaddress,
            charm: charmObj,
            amount: isCharm ? Number(row.read || 0) : null,
          };

          return parsed;
        });

        setMessages(parsedMessages);
      } catch (err) {
        console.error("[DB] Error loading messages:", err);
      }
    };

    fetchMessages();
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
    const username = contact?.extradata?.name || "Unknown";

    const newMsg: ParsedMessage = { text: input, fromMe: true, charm: null, amount: null };
    setMessages((prev) => [...prev, newMsg]);

    try {
      console.log("[ChatPage] Sending message via service:", input);
      await minimaService.sendMessage(address, username, input);
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

    const username = contact?.extradata?.name || "Unknown";

    setMessages((prev) => [
      ...prev,
      { text: null, fromMe: true, charm: { id: charmId }, amount }
    ]);

    console.log("[ChatPage] Inserting charm into DB:", charmId, amount);

    // We use sendMessage to send AND insert.
    // But original code called insertMessage directly?
    // Original: handleSendCharm -> setMessages -> insertMessage.
    // It DID NOT send the charm via Maxima?
    // Wait.
    // Line 180: handleSendCharm
    // Line 191: insertMessage(...)
    // It seems it ONLY inserted it locally?
    // That means Charms are NOT sent to the other person?
    // That seems like a bug or a feature (maybe you just "give" it to them locally?).
    // But the README says "Send or receive charms".
    // So it SHOULD be sent.
    // The original code might have been incomplete.
    // I should probably use 'sendMessage' with type='charm'.
    // But 'sendMessage' takes 'message' string.
    // If I use sendMessage(address, username, charmId, "charm"), it will send it.
    // Let's do that to FIX it.

    minimaService.sendMessage(address, username, charmId, "charm")
      .catch(err => console.error("Error sending charm:", err));
  };

  /* ----------------------------------------------------------------------------
      RENDER
  ---------------------------------------------------------------------------- */
  return (
    <div className="flex-1 flex flex-col h-full p-3 bg-blue-50">
      <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-md">

        {/* HEADER */}
        <div className="bg-blue-600 text-white p-4 flex items-center gap-3">
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

        {/* CHAT BODY */}
        <div className="flex-1 p-4 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-center text-blue-400 italic">
              Envia el teu primer missatge ✨
            </p>
          )}

          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              fromMe={msg.fromMe}
              text={msg.text}
              charm={msg.charm}
              amount={msg.amount}
            />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* INPUT BAR */}
        <div className="p-3 bg-blue-100 flex gap-2 items-center">
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