import React, { useEffect, useState } from 'react';
import { minimaService } from '../../services/minima.service';

interface Token {
    tokenid: string;
    token: string | { name: string; url?: string };
    sendable: string;
    confirmed: string;
}

interface TokenSelectorProps {
    onSend: (tokenId: string, amount: string, tokenName: string) => void;
    onCancel: () => void;
}

const TokenSelector: React.FC<TokenSelectorProps> = ({ onSend, onCancel }) => {
    const [tokens, setTokens] = useState<Token[]>([]);
    const [selectedTokenId, setSelectedTokenId] = useState<string>('0x00');
    const [amount, setAmount] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBalance = async () => {
            const balance = await minimaService.getBalance();
            setTokens(balance);
            setLoading(false);
        };
        fetchBalance();
    }, []);

    const handleSend = () => {
        if (!amount || parseFloat(amount) <= 0) {
            alert("Please enter a valid amount");
            return;
        }
        const token = tokens.find(t => t.tokenid === selectedTokenId);
        const tokenName = typeof token?.token === 'string' ? token.token : token?.token.name || 'Minima';

        onSend(selectedTokenId, amount, tokenName);
    };

    const getTokenName = (t: Token) => {
        if (t.tokenid === '0x00') return 'Minima';
        if (typeof t.token === 'string') return JSON.parse(t.token).name;
        return t.token.name;
    };

    if (loading) return <div className="p-4 text-center">Loading tokens...</div>;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-96 max-w-full mx-4">
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Send Tokens</h3>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Token</label>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                        {tokens.map((t) => (
                            <div
                                key={t.tokenid}
                                onClick={() => setSelectedTokenId(t.tokenid)}
                                className={`p-3 cursor-pointer flex justify-between items-center hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedTokenId === t.tokenid ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500' : ''}`}
                            >
                                <span className="font-medium text-gray-900 dark:text-white">{getTokenName(t)}</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">{t.sendable}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="0.00"
                    />
                </div>

                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TokenSelector;
