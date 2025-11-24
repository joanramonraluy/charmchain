import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
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
  { id: "star", label: "⭐", name: "Estrella", animation: starAnim },
  { id: "heart", label: "❤️", name: "Cor", animation: heartAnim },
  { id: "fire", label: "🔥", name: "Foc", animation: fireAnim }
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
        className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-2xl shadow-xl p-6 w-80 space-y-4"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold">Envia un charm</h2>
            <button onClick={onClose} className="p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Charm selector amb Lottie preview */}
          <div className="grid grid-cols-3 gap-3 text-2xl">
            {charms.map((c) => (
              <button
                key={c.id}
                className={`p-2 rounded-xl border text-center transition-all ${selectedCharm === c
                  ? "bg-purple-200 border-purple-500 scale-105 shadow"
                  : "border-gray-300 hover:bg-gray-100"
                  }`}
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

          {/* Quantitat de Minima */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quantitat de Minima</label>
            <div className="flex flex-wrap gap-2">
              {presetAmounts.map((amt) => (
                <button
                  key={amt}
                  className={`px-3 py-1 rounded-xl border transition-all ${selectedAmount === amt
                    ? "bg-purple-200 border-purple-500"
                    : "border-gray-300 hover:bg-gray-100"
                    }`}
                  onClick={() => setSelectedAmount(amt)}
                >
                  {amt}
                </button>
              ))}
              <button
                className={`px-3 py-1 rounded-xl border transition-all ${selectedAmount === "custom"
                  ? "bg-purple-200 border-purple-500"
                  : "border-gray-300 hover:bg-gray-100"
                  }`}
                onClick={() => setSelectedAmount("custom")}
              >
                Other
              </button>
            </div>
            {selectedAmount === "custom" && (
              <input
                type="number"
                className="w-full border rounded-xl p-2 mt-1"
                value={customAmount}
                min={1}
                placeholder="Introdueix la quantitat"
                onChange={(e) => setCustomAmount(e.target.value)}
              />
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={!selectedCharm || !selectedAmount}
            className={`w-full py-2 rounded-xl text-lg font-medium transition-all ${selectedCharm && selectedAmount
              ? "bg-purple-600 text-white hover:bg-purple-700"
              : "bg-gray-300 text-gray-600 cursor-not-allowed"
              }`}
          >
            Send
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
