// src/routes/chat/$address.jsx
import React, { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute('/chat/$address')({
  component: ChatPage,
});

function ChatPage() {
  const { address } = Route.useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { text: input, fromMe: true }]);
    setInput("");
  };

  const truncate = (str) => str?.length > 10 ? str.slice(0, 10) + "…" : str;

  return (
    <div className="flex-1 flex flex-col h-full p-3 bg-blue-50">
      {/* Contenidor arrodonit del xat */}
      <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-md">
        
        {/* Capçalera */}
        <div className="bg-blue-600 text-white p-4 flex flex-col">
          <strong>{truncate("JR2")}</strong>
          <span className="text-sm">{truncate(address)}</span>
        </div>

        {/* Cos del xat */}
        <div className="flex-1 p-4 overflow-y-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`my-1 p-2 rounded-lg max-w-[70%] ${
                msg.fromMe
                  ? "bg-blue-400 text-white self-end"
                  : "bg-blue-200 text-blue-900 self-start"
              }`}
            >
              {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-blue-100 flex gap-2 items-center">
          <input
            className="flex-1 p-2 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-black"
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
    </div>
  );
}
