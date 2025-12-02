// src/services/transaction-polling.service.ts
import { MDS } from "@minima-global/mds";
import { minimaService } from './minima.service';

type TransactionStatusCallback = (txpowid: string, status: 'confirmed' | 'rejected', transaction: any) => void;

class TransactionPollingService {
    private pollingInterval: NodeJS.Timeout | null = null;
    private isPolling = false;
    private callbacks: Set<TransactionStatusCallback> = new Set();
    private readonly POLL_INTERVAL_MS = 10000; // 10 seconds
    private cleanupDone = false; // Track if initial cleanup has run

    /**
     * Start polling for pending transactions
     */
    start() {
        if (this.isPolling) {
            console.log('⚠️ [TxPolling] Already polling');
            return;
        }

        console.log('🔄 [TxPolling] Starting transaction polling service...');
        this.isPolling = true;

        // Start polling interval
        this.poll(); // Initial poll
        this.pollingInterval = setInterval(() => this.poll(), this.POLL_INTERVAL_MS);
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

            // First poll: Cleanup orphaned pending transactions
            if (!this.cleanupDone) {
                await this.cleanupOrphanedTransactions(pendingTransactions);
                this.cleanupDone = true;
            }

            for (const tx of pendingTransactions) {
                await this.checkTransaction(tx);
            }
        } catch (err) {
            console.error('❌ [TxPolling] Error during polling:', err);
        }
    }

    /**
     * Clean up transactions that are pending in DB but no longer in node
     */
    private async cleanupOrphanedTransactions(pendingTransactions: any[]) {
        console.log('🧹 [TxPolling] Running cleanup check for orphaned transactions...');

        // Get actual pending commands from node
        const nodePendingCommands = await this.getPendingCommands();
        const nodePendingUids = new Set(nodePendingCommands.map((cmd: any) => cmd.uid));

        // Check each DB transaction
        for (const tx of pendingTransactions) {
            const { PENDINGUID, TXPOWID, MESSAGE_TIMESTAMP, PUBLICKEY } = tx;

            // Skip if it has a TXPOWID (it's being tracked normally)
            if (TXPOWID && TXPOWID !== 'null') continue;

            // Skip if no PENDINGUID
            if (!PENDINGUID || PENDINGUID === 'null') continue;

            // Check if this pendinguid exists in node
            if (!nodePendingUids.has(PENDINGUID)) {
                // Orphaned transaction - was pending but no longer in node
                console.log(`🗑️ [TxPolling] Orphaned transaction found: ${PENDINGUID} - marking as failed`);

                await minimaService.updateTransactionStatusByPendingUid(PENDINGUID, 'rejected');
                await minimaService.updateMessageState(PUBLICKEY, MESSAGE_TIMESTAMP, 'failed');
            }
        }

        console.log('✅ [TxPolling] Cleanup complete');
    }

    /**
     * Check the status of a single transaction
     */
    /**
     * Check the status of a single transaction
     */
    private async checkTransaction(transaction: any) {
        const { TXPOWID, PENDINGUID } = transaction;

        try {
            // If we have a TXPOWID, check it normally
            if (TXPOWID && TXPOWID !== 'null' && TXPOWID !== 'undefined') {
                const status = await minimaService.checkTransactionStatus(TXPOWID);

                console.log(`📊 [TxPolling] Transaction ${TXPOWID}: ${status}`);

                if (status === 'confirmed') {
                    await this.handleConfirmedTransaction(TXPOWID, transaction);
                } else if (status === 'rejected') {
                    await this.handleRejectedTransaction(TXPOWID, transaction);
                }
                // If status is 'pending' or 'unknown', we'll check again next poll
            }
            // If no TXPOWID but we have PENDINGUID
            else if (PENDINGUID && PENDINGUID !== 'null' && PENDINGUID !== 'undefined') {
                await this.checkPendingCommand(PENDINGUID, transaction);
            }

        } catch (err) {
            console.error(`❌ [TxPolling] Error checking transaction ${TXPOWID || PENDINGUID}:`, err);
        }
    }

    private async handleConfirmedTransaction(txpowid: string, transaction: any) {
        console.log(`✅ [TxPolling] Transaction confirmed: ${txpowid}`);
        const { PUBLICKEY, MESSAGE_TIMESTAMP, TYPE, METADATA } = transaction;

        // Update transaction status in database
        await minimaService.updateTransactionStatus(txpowid, 'confirmed');

        // Update message status to 'sent'
        await minimaService.updateMessageState(PUBLICKEY, MESSAGE_TIMESTAMP, 'sent');

        // Parse metadata
        let metadata: any = {};
        try {
            metadata = JSON.parse(METADATA || '{}');
        } catch (e) {
            console.error('Error parsing metadata:', e);
        }

        // Send Maxima notification
        if (TYPE === 'charm') {
            const { charmId, amount, username } = metadata;
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
            const { amount, tokenName, username } = metadata;
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
        this.notifyCallbacks(txpowid, 'confirmed', transaction);
    }

    private async handleRejectedTransaction(txpowid: string, transaction: any) {
        console.log(`❌ [TxPolling] Transaction rejected: ${txpowid}`);
        const { PUBLICKEY, MESSAGE_TIMESTAMP } = transaction;

        // Update transaction status in database
        await minimaService.updateTransactionStatus(txpowid, 'rejected');

        // Update message status to 'failed'
        await minimaService.updateMessageState(PUBLICKEY, MESSAGE_TIMESTAMP, 'failed');

        // Notify subscribers
        this.notifyCallbacks(txpowid, 'rejected', transaction);
    }

    private async checkPendingCommand(pendinguid: string, transaction: any) {
        // 1. Check if it's still in pending list
        const pendingCommands = await this.getPendingCommands();
        const found = pendingCommands.find((cmd: any) => cmd.uid === pendinguid);

        if (found) {
            console.log(`⏳ [TxPolling] Command ${pendinguid} is still pending approval`);
            return; // Still pending
        }

        // 2. If not found, it has been either approved or rejected
        console.log(`✅ [TxPolling] Command ${pendinguid} no longer pending - assuming approved!`);

        const { PUBLICKEY, MESSAGE_TIMESTAMP, TYPE, METADATA } = transaction;

        // Parse metadata
        let metadata: any = {};
        try {
            metadata = JSON.parse(METADATA || '{}');
        } catch (e) {
            console.error('Error parsing metadata:', e);
        }

        // Mark transaction as confirmed (we'll assume it was approved)
        await minimaService.updateTransactionStatusByPendingUid(pendinguid, 'confirmed');

        // Update message status to 'sent'
        await minimaService.updateMessageState(PUBLICKEY, MESSAGE_TIMESTAMP, 'sent');

        // Send Maxima notification
        if (TYPE === 'charm') {
            const { charmId, amount, username } = metadata;
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
            const { amount, tokenName, username } = metadata;
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
        this.notifyCallbacks(pendinguid, 'confirmed', transaction);
    }

    private async getPendingCommands(): Promise<any[]> {
        return new Promise((resolve, reject) => {
            MDS.executeRaw("pending", (res: any) => {
                if (res.status && res.response) {
                    resolve(res.response);
                } else {
                    console.error("❌ [TxPolling] Failed to get pending commands:", res);
                    // If we can't get pending commands, we shouldn't assume there are none.
                    // Rejecting here prevents checkPendingCommand from falsely assuming approval.
                    reject(new Error("Failed to fetch pending commands"));
                }
            });
        });
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
