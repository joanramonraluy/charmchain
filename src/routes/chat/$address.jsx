// src/routes/chat/$address.jsx

import React, { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MDS } from "@minima-global/mds";
import CharmSelector from "../../components/chat/CharmSelector";
import MessageBubble from "../../components/chat/MessageBubble";

// Lucide icons
import { Plus } from "lucide-react";

export const Route = createFileRoute("/chat/$address")({
  component: ChatPage,
});

// 📌 Llista de charms (igual que a CharmSelector)
const charms = [
  { id: "star", label: "⭐", name: "Estrella" },
  { id: "heart", label: "❤️", name: "Cor" },
  { id: "fire", label: "🔥", name: "Foc" },
  { id: "clover", label: "🍀", name: "Trèvol" },
  { id: "party", label: "🎉", name: "Festa" }
];

function ChatPage() {
  const { address } = Route.useParams();

  const [contact, setContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showCharmSelector, setShowCharmSelector] = useState(false);
  const messagesEndRef = useRef(null);

  const defaultAvatar =
    "data:image/svg+xml;base64," +
    btoa(
      `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
        <circle cx='24' cy='24' r='24' fill='#ccc'/>
        <text x='50%' y='55%' text-anchor='middle' font-size='20' fill='white' dy='.3em'>?</text>
      </svg>`
    );

  const getAvatar = (c) => {
    if (c?.extradata?.icon) {
      try {
        const decoded = decodeURIComponent(c.extradata.icon);
        if (decoded.startsWith("data:image")) return decoded;
      } catch {}
    }
    return defaultAvatar;
  };

  const truncate = (str) =>
    str?.length > 12 ? str.slice(0, 12) + "…" : str;

  // Carregar dades del contacte
  useEffect(() => {
    const fetchContact = async () => {
      try {
        const res = await MDS.cmd.maxcontacts();
        const list = res?.response?.contacts || res.contacts || res || [];
        const c = list.find(
          (x) =>
            x.currentaddress === address ||
            x.extradata?.minimaaddress === address
        );
        setContact(c || null);
      } catch (err) {
        console.error("Error loading contact:", err);
      }
    };
    fetchContact();
  }, [address]);

  // Scroll automàtic
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  // Enviar text
  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { text: input, fromMe: true }]);
    setInput("");
  };

  // Enviar charm
  const handleSendCharm = ({ charmId, amount }) => {
    if (!charmId || !amount) return;

    // Recuperem el label del charm
    const charmInfo = charms.find((c) => c.id === charmId);

    setMessages((prev) => [
      ...prev,
      {
        charmId,
        charmLabel: charmInfo?.label,
        amount,
        fromMe: true
      }
    ]);
  };

  return (
    <div className="flex-1 flex flex-col h-full p-3 bg-blue-50">
      <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-md">

        {/* Capçalera */}
        <div className="bg-blue-600 text-white p-4 flex items-center gap-3">
          <img
            src={getAvatar(contact)}
            alt="Avatar"
            className="w-10 h-10 rounded-full border-2 border-blue-300 object-cover"
          />
          <div className="flex flex-col leading-tight">
            <strong className="text-lg">
              {contact?.extradata?.name || "Unknown"}
            </strong>
            <span className="text-sm opacity-80">{truncate(address)}</span>
          </div>
        </div>

        {/* Cos del xat */}
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
              charm={msg.charmId ? { id: msg.charmId, label: msg.charmLabel } : null}
              amount={msg.amount}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-blue-100 flex gap-2 items-center">
          {/* Botó Charm a l'esquerra */}
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
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escriu un missatge..."
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={sendMessage}
          >
            Envia
          </button>
        </div>
      </div>

      {showCharmSelector && (
        <CharmSelector
          onSend={(charmData) => handleSendCharm(charmData)}
          onClose={() => setShowCharmSelector(false)}
        />
      )}
    </div>
  );
}
