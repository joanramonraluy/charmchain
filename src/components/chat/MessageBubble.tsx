// src/components/chat/MessageBubble.tsx

import Lottie from "lottie-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

// Dynamic import of all .json files
const charmModules = import.meta.glob('../../assets/animations/*.json', { eager: true });

interface MessageBubbleProps {
  fromMe: boolean;
  text: string | null;
  charm: { id: string } | null;
  amount: number | null;
  timestamp?: number;
  status?: 'pending' | 'sent' | 'delivered' | 'read';
  tokenAmount?: { amount: string; tokenName: string };
}

// Flying money emoji component
const FlyingMoney = ({ delay = 0 }: { delay?: number }) => {
  const randomX = Math.random() * 100 - 50;
  const randomRotate = Math.random() * 360;

  return (
    <motion.div
      initial={{ y: 0, x: 0, opacity: 1, scale: 1, rotate: 0 }}
      animate={{
        y: -150,
        x: randomX,
        opacity: 0,
        scale: 0.5,
        rotate: randomRotate
      }}
      transition={{
        duration: 1.5,
        delay,
        ease: "easeOut"
      }}
      className="absolute text-2xl pointer-events-none"
      style={{ left: '50%', top: '50%' }}
    >
      💸
    </motion.div>
  );
};

// Confetti particle component
const ConfettiParticle = ({ delay = 0, color }: { delay?: number; color: string }) => {
  const randomX = (Math.random() - 0.5) * 200;
  const randomY = -100 - Math.random() * 100;
  const randomRotate = Math.random() * 720;

  return (
    <motion.div
      initial={{ y: 0, x: 0, opacity: 1, scale: 1, rotate: 0 }}
      animate={{
        y: randomY,
        x: randomX,
        opacity: 0,
        scale: 0,
        rotate: randomRotate
      }}
      transition={{
        duration: 1.2,
        delay,
        ease: "easeOut"
      }}
      className="absolute w-2 h-2 rounded-full pointer-events-none"
      style={{ left: '50%', top: '50%', backgroundColor: color }}
    />
  );
};

export default function MessageBubble({ fromMe, text, charm, amount, timestamp, status, tokenAmount }: MessageBubbleProps) {
  const isCharm = !!charm;
  const isTokenTransfer = !!tokenAmount;
  const [showCelebration, setShowCelebration] = useState(false);
  const [prevStatus, setPrevStatus] = useState(status);

  // Trigger celebration when status changes from pending to sent
  useEffect(() => {
    if (prevStatus === 'pending' && status === 'sent' && (isTokenTransfer || isCharm)) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1500);
    }
    setPrevStatus(status);
  }, [status, isTokenTransfer, isCharm]);

  // Enhanced colors with gradients for token transfers
  const bubbleColor = isCharm
    ? "bg-gradient-to-br from-purple-100 to-purple-50 border-2 border-purple-300 shadow-lg"
    : isTokenTransfer
      ? "bg-gradient-to-br from-emerald-100 via-green-50 to-teal-50 border-2 border-emerald-300 shadow-lg"
      : fromMe
        ? "bg-[#E1FFC7] shadow-sm"
        : "bg-white shadow-sm";

  const borderRadius = fromMe
    ? "rounded-l-lg rounded-br-lg rounded-tr-none"
    : "rounded-r-lg rounded-bl-lg rounded-tl-none";

  const alignment = fromMe ? "self-end items-end" : "self-start items-start";

  // Map charm ID to Lottie animation data
  let animationData: any = null;
  if (charm?.id) {
    const key = `../../assets/animations/${charm.id}.json`;
    animationData = (charmModules[key] as any)?.default || null;
  }

  // Pulsing animation for pending state
  const isPending = status === 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: isPending ? 0.85 : 1,
        y: 0,
        scale: isPending ? [1, 1.02, 1] : 1
      }}
      transition={isPending ? {
        opacity: { duration: 0.3 },
        y: { duration: 0.3 },
        scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
      } : { duration: 0.3 }}
      className={`flex flex-col max-w-[80%] mb-2 ${alignment} relative`}
    >
      {/* Flying money animation for token transfers */}
      <AnimatePresence>
        {isTokenTransfer && status === 'pending' && (
          <>
            {[...Array(5)].map((_, i) => (
              <FlyingMoney key={i} delay={i * 0.1} />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Celebration confetti when sent */}
      <AnimatePresence>
        {showCelebration && (
          <>
            {[...Array(12)].map((_, i) => (
              <ConfettiParticle
                key={i}
                delay={i * 0.05}
                color={['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b'][i % 5]}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      <div
        className={`relative px-3 py-2 ${borderRadius} ${bubbleColor} min-w-[80px] overflow-visible`}
        style={{ position: 'relative' }}
      >
        {/* Token Transfer Badge with enhanced styling */}
        {isTokenTransfer && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="flex items-center gap-3 mb-2 relative"
          >
            {/* Animated money icon */}
            <motion.span
              className="text-3xl"
              animate={status === 'pending' ? {
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.1, 1]
              } : {}}
              transition={{
                duration: 0.5,
                repeat: status === 'pending' ? Infinity : 0,
                repeatDelay: 0.5
              }}
            >
              💰
            </motion.span>
            <div>
              <div className="text-xl font-bold bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-transparent">
                {tokenAmount.amount} {tokenAmount.tokenName}
              </div>
              <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide flex items-center gap-1">
                <motion.span
                  animate={status === 'pending' ? { opacity: [1, 0.5, 1] } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  {status === 'pending' ? '⏳ Sending...' : '✓ Token Transfer'}
                </motion.span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Charm with enhanced animation */}
        {isCharm && animationData && (
          <motion.div
            className="w-32 h-32 mb-1"
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            <Lottie animationData={animationData} loop={true} />
          </motion.div>
        )}

        {/* Text */}
        {text && (
          <p className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words ${isTokenTransfer ? 'text-gray-700 font-medium' : 'text-gray-800'
            }`}>
            {text}
          </p>
        )}

        {/* Quantitat de Minima with charm */}
        {isCharm && amount != null && (
          <motion.div
            initial={{ scale: 0.8, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
            className="mt-2 text-base font-bold bg-gradient-to-r from-purple-700 to-purple-500 bg-clip-text text-transparent flex items-center gap-1.5"
          >
            <motion.span
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              💎
            </motion.span>
            {amount} MINIMA
          </motion.div>
        )}

        {/* Metadata Row (Time + Status) */}
        <div className="flex items-center justify-end gap-1 mt-1 select-none">
          <span className="text-[11px] text-gray-500 min-w-fit">
            {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
          </span>

          {fromMe && (
            <div className="flex items-center ml-0.5">
              {/* Status Icons */}

              {status === 'pending' && (
                /* Pending - Enhanced Spinner */
                <motion.svg
                  className="w-4 h-4 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </motion.svg>
              )}

              {(status === 'sent' || !status) && (
                /* Single Gray Tick */
                <motion.svg
                  viewBox="0 0 16 15"
                  width="16"
                  height="15"
                  className="text-gray-500 w-4 h-4"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                >
                  <path fill="currentColor" d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88 2.186 7.7a.365.365 0 0 0-.51.063l-.478.372a.365.365 0 0 0 .063.51l3.52 3.225a.365.365 0 0 0 .51-.063l6.55-7.98a.365.365 0 0 0-.063-.51z" />
                </motion.svg>
              )}

              {status === 'delivered' && (
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
    </motion.div>
  );
}
