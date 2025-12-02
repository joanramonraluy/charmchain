import { useEffect, useState } from "react";
import { minimaService } from "../../services/minima.service";

interface PendingTransaction {
    ID: string;
    TXPOWID: string | null;
    PENDINGUID: string;
    TYPE: 'charm' | 'token';
    PUBLICKEY: string;
    MESSAGE_TIMESTAMP: string;
    METADATA: string;
    STATUS: string;
    CREATED_AT: string;
}

interface PendingTransactionsModalProps {
    onClose: () => void;
}

export default function PendingTransactionsModal({ onClose }: PendingTransactionsModalProps) {
    const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPendingTransactions();

        // Poll every 5 seconds to keep it updated
        const interval = setInterval(loadPendingTransactions, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadPendingTransactions = async () => {
        try {
            // Get real MDS pending actions (transactions waiting for approval)
            const pendingUids = await minimaService.getMDSPendingActions();

            // Convert Set to array and fetch details from our DB if available
            const txs: PendingTransaction[] = [];

            for (const uid of pendingUids) {
                // Try to find this pending action in our TRANSACTIONS table
                const dbTx = await minimaService.getTransactionByPendingUid(uid);

                if (dbTx) {
                    txs.push(dbTx);
                } else {
                    // If not in our DB, create a minimal entry
                    txs.push({
                        ID: uid,
                        TXPOWID: null,
                        PENDINGUID: uid,
                        TYPE: 'token', // Default, we don't know
                        PUBLICKEY: '',
                        MESSAGE_TIMESTAMP: Date.now().toString(),
                        METADATA: '{}',
                        STATUS: 'pending',
                        CREATED_AT: Date.now().toString()
                    });
                }
            }

            setTransactions(txs);
        } catch (err) {
            console.error("Failed to load pending transactions:", err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: string) => {
        return new Date(Number(timestamp)).toLocaleString();
    };

    const parseMetadata = (metadataStr: string) => {
        try {
            return JSON.parse(metadataStr);
        } catch (e) {
            return {};
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-xl">⏳</span> Pending Transactions
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-4 flex-1">
                    {loading ? (
                        <div className="flex justify-center py-8 text-gray-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-3">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-3xl grayscale opacity-50">
                                ✅
                            </div>
                            <p className="font-medium">No pending transactions</p>
                            <p className="text-sm text-gray-400">All caught up!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {transactions.map((tx) => {
                                const metadata = parseMetadata(tx.METADATA);
                                const isCharm = tx.TYPE === 'charm';
                                const amount = isCharm ? metadata.amount : metadata.amount;
                                const tokenName = isCharm ? 'MINIMA' : (metadata.tokenName || 'Tokens');
                                const label = isCharm ? `Charm: ${metadata.charmId}` : 'Token Transfer';

                                return (
                                    <div key={tx.ID} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                            PENDING
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${isCharm ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                                                {isCharm ? '✨' : '💸'}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-gray-800 truncate">{label}</h3>
                                                <div className="flex items-center gap-1 text-sm font-medium text-gray-700 mt-0.5">
                                                    <span>{amount}</span>
                                                    <span className="text-gray-500">{tokenName}</span>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                                    <span>📅</span> {formatDate(tx.MESSAGE_TIMESTAMP)}
                                                </p>

                                                <div className="mt-3 bg-gray-50 rounded-lg p-2 text-xs text-gray-500 border border-gray-100">
                                                    <p className="font-mono truncate">UID: {tx.PENDINGUID}</p>
                                                    <p className="mt-1 text-yellow-600 font-medium">Waiting for approval in Minima...</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 text-center text-xs text-gray-500">
                    Approve transactions in the Minima Pending MiniDapp
                </div>
            </div>
        </div>
    );
}
