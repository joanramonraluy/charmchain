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
  const isCharm = !!charm;

  // WhatsApp Style Colors
  // Sent: Light Green (#E1FFC7)
  // Received: White (#FFFFFF)
  const bubbleColor = isCharm
    ? "bg-purple-100 border border-purple-200" // Special style for charms
    : fromMe
      ? "bg-[#E1FFC7] shadow-sm" // WhatsApp Sent Green
      : "bg-white shadow-sm"; // WhatsApp Received White

  // Bubble Shape (Tails)
  // Sent: Rounded but top-right is sharp (or custom radius)
  // Received: Rounded but top-left is sharp
  const borderRadius = fromMe
    ? "rounded-l-lg rounded-br-lg rounded-tr-none"
    : "rounded-r-lg rounded-bl-lg rounded-tl-none";

  const alignment = fromMe ? "self-end items-end" : "self-start items-start";

  // Agafa el JSON corresponent al charm si existeix
  let animationData = null;
  if (charm?.id) {
    const key = `./animations/${charm.id}.json`;
    const module = charmAnimations[key] as { default: any };
    animationData = module?.default || null;
  }

  return (
    <div className={`flex flex-col max-w-[80%] mb-2 ${alignment}`}>
      <div
        className={`relative px-3 py-2 ${borderRadius} ${bubbleColor} min-w-[80px]`}
        style={{ position: 'relative' }}
      >
        {/* Tail Pseudo-element simulation using absolute SVG or just CSS borders could be complex. 
            For simplicity, we stick to the rounded corner trick which is very common. 
            If we want a real tail, we can add a small SVG. Let's stick to the shape for now.
        */}

        {/* Charm */}
        {isCharm && animationData && (
          <div className="w-32 h-32 mb-1">
            <Lottie animationData={animationData} loop={true} />
          </div>
        )}

        {/* Text */}
        {text && (
          <p className="text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
            {text}
          </p>
        )}

        {/* Quantitat de Minima */}
        {isCharm && amount != null && (
          <div className="mt-1 text-sm font-bold text-purple-700 flex items-center gap-1">
            <span>💎</span> {amount} MINIMA
          </div>
        )}

        {/* Metadata Row (Time + Status) */}
        <div className="flex items-center justify-end gap-1 mt-1 select-none">
          <span className="text-[11px] text-gray-500 min-w-fit">
            {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
          </span>

          {fromMe && (
            <div className="flex items-center ml-0.5">
              {/* Status Icons (Blue ticks for read, Gray for sent/delivered) */}

              {(status === 'sent' || !status) && (
                /* Single Gray Tick */
                <svg viewBox="0 0 16 15" width="16" height="15" className="text-gray-500 w-4 h-4">
                  <path fill="currentColor" d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88 2.186 7.7a.365.365 0 0 0-.51.063l-.478.372a.365.365 0 0 0 .063.51l3.52 3.225a.365.365 0 0 0 .51-.063l6.55-7.98a.365.365 0 0 0-.063-.51z" />
                </svg>
              )}

              {status === 'delivered' && (
                /* Double Gray Tick */
                <div className="flex -space-x-1">
                  <svg viewBox="0 0 16 15" width="16" height="15" className="text-gray-500 w-4 h-4">
                    <path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88 6.286 7.7a.365.365 0 0 0-.51.063l-.478.372a.365.365 0 0 0 .063.51l3.52 3.225a.365.365 0 0 0 .51-.063l6.55-7.98a.365.365 0 0 0-.063-.51z" />
                  </svg>
                  <svg viewBox="0 0 16 15" width="16" height="15" className="text-gray-500 w-4 h-4">
                    <path fill="currentColor" d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88 2.186 7.7a.365.365 0 0 0-.51.063l-.478.372a.365.365 0 0 0 .063.51l3.52 3.225a.365.365 0 0 0 .51-.063l6.55-7.98a.365.365 0 0 0-.063-.51z" />
                  </svg>
                </div>
              )}

              {status === 'read' && (
                /* Double Blue Tick */
                <div className="flex -space-x-1">
                  <svg viewBox="0 0 16 15" width="16" height="15" className="text-blue-500 w-4 h-4">
                    <path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88 6.286 7.7a.365.365 0 0 0-.51.063l-.478.372a.365.365 0 0 0 .063.51l3.52 3.225a.365.365 0 0 0 .51-.063l6.55-7.98a.365.365 0 0 0-.063-.51z" />
                  </svg>
                  <svg viewBox="0 0 16 15" width="16" height="15" className="text-blue-500 w-4 h-4">
                    <path fill="currentColor" d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88 2.186 7.7a.365.365 0 0 0-.51.063l-.478.372a.365.365 0 0 0 .063.51l3.52 3.225a.365.365 0 0 0 .51-.063l6.55-7.98a.365.365 0 0 0-.063-.51z" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
