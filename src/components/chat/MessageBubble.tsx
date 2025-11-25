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
  status?: 'sent' | 'delivered' | 'read';
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
      <div className={`flex items-center gap-1 mt-1 self-end ${fromMe ? "text-white/80" : "text-gray-500"}`}>
        <span className="text-[10px]">
          {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
        </span>

        {fromMe && (
          <div className="flex items-center gap-0.5">
            {/* 
                STATUS LOGIC:
                - sent: 1 green arrow (→) - message sent via Maxima
                - delivered: 1 green check (✓) - message received by recipient
                - read: 2 green checks (✓✓) - message read by recipient
                - undefined/empty: show arrow as fallback for sent messages
             */}

            {(status === 'sent' || !status) && (
              /* Arrow: Message sent via Maxima (or no status yet) */
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="text-green-400">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            )}

            {status === 'delivered' && (
              /* Single check: Message delivered to recipient */
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="text-green-400">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}

            {status === 'read' && (
              /* Double check: Message read by recipient */
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="text-green-400">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className="text-green-400 -ml-2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
