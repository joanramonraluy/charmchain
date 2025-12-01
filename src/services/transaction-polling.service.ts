// src/services/transaction-polling.service.ts
import { minimaService } from './minima.service';

type TransactionStatusCallback = (txpowid: string, status: 'confirmed' | 'rejected', transaction: any) => void;

class TransactionPollingService {
    private pollingInterval: NodeJS.Timeout | null = null;
    private isPolling = false;
    private callbacks: Set<TransactionStatusCallback> = new Set();
    private readonly POLL_INTERVAL_MS = 10000; // 10 seconds

    /**
     * Start polling for pending transactions
     */
    start() {
        if (this.isPolling) {
            console.log('⚠️ [TxPolling] Already polling');
            return;
        }

        console.log('🔄 [TxPolling] Starting transaction polling service');
        this.isPolling = true;

        // Poll immediately
        this.poll();

        // Then poll every POLL_INTERVAL_MS
        this.pollingInterval = setInterval(() => {
            this.poll();
        }, this.POLL_INTERVAL_MS);
    }

    /**
     * Stop polling
     */
    stop() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;
        console.log('⏹️ [TxPolling] Stopped transaction polling service');
    }

    /**
     * Subscribe to transaction status updates
     */
    subscribe(callback: TransactionStatusCallback) {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback);
    }

    /**
     * Poll for pending transactions and check their status
     */
    private async poll() {
        try {
            const pendingTransactions = await minimaService.getPendingTransactions();

            if (pendingTransactions.length === 0) {
                return; // No pending transactions
            }

            console.log(`🔍 [TxPolling] Checking ${pendingTransactions.length} pending transaction(s)`);

            for (const tx of pendingTransactions) {
                await this.checkTransaction(tx);
            }
        } catch (err) {
            console.error('❌ [TxPolling] Error during polling:', err);
        }
    }

    /**
     * Check the status of a single transaction
     */
    private async checkTransaction(transaction: any) {
        const { TXPOWID, TYPE, PUBLICKEY, MESSAGE_TIMESTAMP, METADATA } = transaction;

        try {
            const status = await minimaService.checkTransactionStatus(TXPOWID);

            console.log(`📊 [TxPolling] Transaction ${TXPOWID}: ${status}`);

            if (status === 'confirmed') {
                console.log(`✅ [TxPolling] Transaction confirmed: ${TXPOWID}`);

                // Update transaction status in database
                await minimaService.updateTransactionStatus(TXPOWID, 'confirmed');

                // Update message status to 'sent'
                await minimaService.updateMessageState(PUBLICKEY, MESSAGE_TIMESTAMP, 'sent');

                // Parse metadata
                let metadata = {};
                try {
                    metadata = JSON.parse(METADATA || '{}');
                } catch (e) {
                    console.error('Error parsing metadata:', e);
                }

                // Send Maxima notification
                if (TYPE === 'charm') {
                    const { charmId, amount, username } = metadata as any;
                    console.log(`📤 [TxPolling] Sending charm message via Maxima...`);
                    await minimaService.sendMessage(
                        PUBLICKEY,
                        username || 'Unknown',
                        charmId,
                        'charm',
                        '',
                        amount || 0,
                        MESSAGE_TIMESTAMP
                    );
                } else if (TYPE === 'token') {
                    const { amount, tokenName, username } = metadata as any;
                    const tokenData = JSON.stringify({ amount, tokenName });
                    console.log(`📤 [TxPolling] Sending token message via Maxima...`);
                    await minimaService.sendMessage(
                        PUBLICKEY,
                        username || 'Unknown',
                        tokenData,
                        'token',
                        '',
                        0,
                        MESSAGE_TIMESTAMP
                    );
                }

                // Notify subscribers
                this.notifyCallbacks(TXPOWID, 'confirmed', transaction);

            } else if (status === 'rejected' || status === 'unknown') {
                console.log(`❌ [TxPolling] Transaction ${status}: ${TXPOWID}`);

                // Update transaction status in database
                await minimaService.updateTransactionStatus(TXPOWID, 'rejected');

                // Update message status to 'failed'
                await minimaService.updateMessageState(PUBLICKEY, MESSAGE_TIMESTAMP, 'failed');

                // Notify subscribers
                this.notifyCallbacks(TXPOWID, 'rejected', transaction);
            }
            // If status is still 'pending', we'll check again next poll

        } catch (err) {
            console.error(`❌ [TxPolling] Error checking transaction ${TXPOWID}:`, err);
        }
    }

    /**
     * Notify all subscribers of a status change
     */
    private notifyCallbacks(txpowid: string, status: 'confirmed' | 'rejected', transaction: any) {
        this.callbacks.forEach(callback => {
            try {
                callback(txpowid, status, transaction);
            } catch (err) {
                console.error('❌ [TxPolling] Error in callback:', err);
            }
        });
    }
}

// Export singleton instance
export const transactionPollingService = new TransactionPollingService();
