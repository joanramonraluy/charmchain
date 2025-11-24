// src/components/chat/MessageBubble.tsx

import Lottie from "lottie-react";

// Import dinàmic de tots els JSON de charms
const charmAnimations = import.meta.glob("./animations/*.json", { eager: true });

interface MessageBubbleProps {
  fromMe: boolean;
  text: string | null;
  charm: { id: string } | null;
  amount: number | null;
  timestamp?: number;
  status?: 'sent' | 'read';
}

export default function MessageBubble({ fromMe, text, charm, amount, timestamp, status }: MessageBubbleProps) {
  const alignment = fromMe ? "self-start" : "self-end"; // Sent on Left, Received on Right
  const isCharm = !!charm;
  const bubbleColor = isCharm
    ? "bg-purple-300 text-purple-900" // fons lila per charms
    : fromMe
      ? "bg-pink-500 text-white" // Sent (Left)
      : "bg-blue-200 text-blue-900"; // Received (Right)

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

      {/* Timestamp & Status */}
      <div className={`flex items-center gap-1 mt-1 self-end ${fromMe ? "text-pink-100" : "text-gray-500"}`}>
        <span className="text-[10px]">
          {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
        </span>

        {fromMe && (
          <div className="flex">
            {/* First check */}
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={status === 'read' ? "text-blue-300" : "text-pink-200"}>
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>

            {/* Second check (only if read) */}
            {status === 'read' && (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-300 -ml-2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
