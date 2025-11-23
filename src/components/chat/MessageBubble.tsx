// src/components/chat/MessageBubble.tsx
import React from "react";
import Lottie from "lottie-react";

// Import dinàmic de tots els JSON de charms
const charmAnimations = import.meta.glob("./animations/*.json", { eager: true });

interface MessageBubbleProps {
  fromMe: boolean;
  text: string | null;
  charm: { id: string } | null;
  amount: number | null;
}

export default function MessageBubble({ fromMe, text, charm, amount }: MessageBubbleProps) {
  const alignment = fromMe ? "self-end" : "self-start";
  const isCharm = !!charm;
  const bubbleColor = isCharm
    ? "bg-purple-300 text-purple-900" // fons lila per charms
    : fromMe
      ? "bg-blue-500 text-white"
      : "bg-blue-200 text-blue-900";

  // Agafa el JSON corresponent al charm si existeix
  let animationData = null;
  if (charm?.id) {
    const key = `./animations/${charm.id}.json`;
    const module = charmAnimations[key] as { default: any };
    animationData = module?.default || null;
  }

  return (
    <div
      className={`max-w-[75%] my-2 p-3 rounded-2xl shadow ${alignment} ${bubbleColor} flex flex-col items-center`}
    >
      {/* Charm */}
      {isCharm && animationData && (
        <div className="w-24 h-24 mb-2">
          <Lottie animationData={animationData} loop={true} />
        </div>
      )}

      {/* Text */}
      {text && <p className="leading-snug whitespace-pre-wrap">{text}</p>}

      {/* Debug: show if no text and no charm */}
      {!text && !isCharm && <p className="text-xs opacity-50">[Empty message]</p>}

      {/* Quantitat de Minima */}
      {isCharm && amount != null && (
        <span className="mt-1 text-sm font-semibold">{amount} MINIMA</span>
      )}
    </div>
  );
}
