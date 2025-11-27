import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Player } from "@lottiefiles/react-lottie-player";

// Llista temporal de charms amb Lottie JSON
import starAnim from "./animations/star.json";
import heartAnim from "./animations/heart.json";
import fireAnim from "./animations/fire.json";

interface Charm {
  id: string;
  label: string;
  name: string;
  animation: any;
}

const charms: Charm[] = [
  { id: "star", label: "⭐", name: "Star", animation: starAnim },
  { id: "heart", label: "❤️", name: "Heart", animation: heartAnim },
  { id: "fire", label: "🔥", name: "Fire", animation: fireAnim }
];

const presetAmounts = [1, 5, 10, 20];

interface CharmSelectorProps {
  onSend: (data: { charmId: string; charmLabel: string; charmAnimation: any; amount: number }) => void;
  onClose: () => void;
}

export default function CharmSelector({ onSend, onClose }: CharmSelectorProps) {
  const [selectedCharm, setSelectedCharm] = useState<Charm | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | "custom" | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  const handleSend = () => {
    const amount =
      selectedAmount === "custom" ? Number(customAmount) : selectedAmount;
    if (!selectedCharm || !amount || amount <= 0) return;

    onSend({
      charmId: selectedCharm.id,
      charmLabel: selectedCharm.label,
      charmAnimation: selectedCharm.animation,
      amount
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-96 max-w-full mx-4"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Send a Charm</h3>

          {/* Charm selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Charm</label>
            <div className="grid grid-cols-3 gap-3">
              {charms.map((c) => (
                <button
                  key={c.id}
                  className={`p - 3 rounded - lg border transition - all ${selectedCharm === c
                      ? "bg-purple-50 dark:bg-purple-900/30 border-purple-500 border-2"
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                    } `}
                  onClick={() => setSelectedCharm(c)}
                  title={c.name}
                >
                  <Player
                    autoplay
                    loop
                    src={c.animation}
                    style={{ height: 60, width: 60 }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Amount selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Minima Amount</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {presetAmounts.map((amt) => (
                <button
                  key={amt}
                  className={`px - 4 py - 2 rounded - md border transition - all font - medium ${selectedAmount === amt
                      ? "bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300"
                      : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    } `}
                  onClick={() => setSelectedAmount(amt)}
                >
                  {amt}
                </button>
              ))}
              <button
                className={`px - 4 py - 2 rounded - md border transition - all font - medium ${selectedAmount === "custom"
                    ? "bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  } `}
                onClick={() => setSelectedAmount("custom")}
              >
                Other
              </button>
            </div>
            {selectedAmount === "custom" && (
              <input
                type="number"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                value={customAmount}
                min={1}
                placeholder="Enter amount"
                onChange={(e) => setCustomAmount(e.target.value)}
              />
            )}
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!selectedCharm || !selectedAmount}
              className={`px - 4 py - 2 rounded - md transition - colors font - medium ${selectedCharm && selectedAmount
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                } `}
            >
              Send
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
