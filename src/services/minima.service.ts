import { MDS } from "@minima-global/mds";

export interface ChatMessage {
    id?: number;
    roomname: string;
    publickey: string;
    username: string;
    type: string;
    message: string;
    filedata?: string;
    customid?: string;
    state?: string;
    read?: number;
    amount?: number;
    date?: number;
}

export interface IncomingMessageData {
    application: string;
    from: string;
    data: string; // JSON string
}

export interface IncomingMessagePayload {
    username: string;
    type: string;
    message: string;
    filedata?: string;
}

type MessageCallback = (msg: IncomingMessagePayload) => void;

class MinimaService {
    private newMessageCallbacks: MessageCallback[] = [];
    private initialized = false;

    constructor() {
        // Singleton pattern could be used, or just export an instance
    }

    /* ----------------------------------------------------------------------------
      HEX <-> UTF8
    ---------------------------------------------------------------------------- */
    hexToUtf8(s: string): string {
        return decodeURIComponent(
            s.replace(/\s+/g, "").replace(/[0-9A-F]{2}/g, "%$&")
        );
    }

    utf8ToHex(s: string): string {
        const encoder = new TextEncoder();
        let r = "";
        for (const b of encoder.encode(s)) r += ("0" + b.toString(16)).slice(-2);
        return r;
    }

    /* ----------------------------------------------------------------------------
      DATABASE
    ---------------------------------------------------------------------------- */
    initDB() {
        const initsql = "CREATE TABLE IF NOT EXISTS CHAT_MESSAGES ( "
            + "  id BIGINT AUTO_INCREMENT PRIMARY KEY, "
            + "  roomname VARCHAR(160) NOT NULL, "
            + "  publickey VARCHAR(512) NOT NULL, "
            + "  username VARCHAR(160) NOT NULL, "
            + "  type VARCHAR(64) NOT NULL, "
            + "  message VARCHAR(512) NOT NULL, "
            + "  filedata CLOB NOT NULL, "
            + "  customid VARCHAR(128) NOT NULL DEFAULT '0x00', "
            + "  state VARCHAR(128) NOT NULL DEFAULT '', "
            + "  read INT NOT NULL DEFAULT 0, "
            + "  amount INT NOT NULL DEFAULT 0, "
            + "  date BIGINT NOT NULL "
            + " )";

        MDS.sql(initsql, (res: any) => {
            if (!res.status) {
                console.error("❌ [DB] Failed to create CHAT_MESSAGES table:", res.error);
            } else {
                console.log("✅ [DB] CHAT_MESSAGES table initialized");
                // Add amount column to existing tables if it doesn't exist
                const alterSql = "ALTER TABLE CHAT_MESSAGES ADD COLUMN IF NOT EXISTS amount INT NOT NULL DEFAULT 0";
                MDS.sql(alterSql, (alterRes: any) => {
                    if (!alterRes.status) {
                        console.warn("⚠️ [DB] Could not add amount column (may already exist):", alterRes.error);
                    } else {
                        console.log("✅ [DB] Amount column added/verified");
                    }
                });
            }
        });

        // Create CHAT_STATUS table if not exists
        const createStatusTable = `
            CREATE TABLE IF NOT EXISTS CHAT_STATUS (
                publickey VARCHAR(512) PRIMARY KEY,
                archived BOOLEAN NOT NULL DEFAULT FALSE,
                archived_date BIGINT,
                last_opened BIGINT,
                app_installed BOOLEAN DEFAULT FALSE
            )`;

        MDS.sql(createStatusTable, (res: any) => {
            if (!res.status) {
                console.error("❌ [DB] Failed to create CHAT_STATUS table:", res.error);
            } else {
                console.log("✅ [DB] CHAT_STATUS table initialized");
                // Add app_installed column if it doesn't exist (migration)
                const alterSql = "ALTER TABLE CHAT_STATUS ADD COLUMN IF NOT EXISTS app_installed BOOLEAN DEFAULT FALSE";
                MDS.sql(alterSql, (alterRes: any) => {
                    if (!alterRes.status) {
                        console.warn("⚠️ [DB] Could not add app_installed column (may already exist):", alterRes.error);
                    } else {
                        console.log("✅ [DB] app_installed column added/verified");
                    }
                });
            }
        });

        // Create TRANSACTIONS table for tracking transaction status
        const createTransactionsTable = `
            CREATE TABLE IF NOT EXISTS TRANSACTIONS (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                txpowid VARCHAR(256) UNIQUE,
                type VARCHAR(32) NOT NULL,
                publickey VARCHAR(512) NOT NULL,
                message_timestamp BIGINT NOT NULL,
                status VARCHAR(32) NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                metadata TEXT,
                pendinguid VARCHAR(128)
            )`;

        MDS.sql(createTransactionsTable, (res: any) => {
            if (!res.status) {
                console.error("❌ [DB] Failed to create TRANSACTIONS table:", res.error);
            } else {
                console.log("✅ [DB] TRANSACTIONS table initialized");

                // Migration 1: Add pendinguid column if it doesn't exist
                const alterSql1 = "ALTER TABLE TRANSACTIONS ADD COLUMN IF NOT EXISTS pendinguid VARCHAR(128)";
                MDS.sql(alterSql1, (alterRes: any) => {
                    if (!alterRes.status) {
                        console.warn("⚠️ [DB] Could not add pendinguid column (may already exist):", alterRes.error);
                    } else {
                        console.log("✅ [DB] pendinguid column added/verified");
                    }
                });

                // Migration 2: Allow NULL for txpowid (for pending commands)
                // H2 syntax: ALTER TABLE tableName ALTER COLUMN columnName SET NULL
                const alterSql2 = "ALTER TABLE TRANSACTIONS ALTER COLUMN txpowid SET NULL";
                MDS.sql(alterSql2, (alterRes: any) => {
                    if (!alterRes.status) {
                        console.warn("⚠️ [DB] Could not alter txpowid to allow NULL:", alterRes.error);
                    } else {
                        console.log("✅ [DB] txpowid column altered to allow NULL");
                    }
                });
            }
        });
    }

    /* ----------------------------------------------------------------------------
      CHAT STATUS (Archive, Read, App Installed)
    ---------------------------------------------------------------------------- */
    archiveChat(publickey: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
                MERGE INTO CHAT_STATUS (publickey, archived, archived_date)
                KEY (publickey)
                VALUES ('${publickey}', TRUE, ${Date.now()})
            `;
            console.log("📦 [SQL] Archiving chat:", publickey);
            MDS.sql(sql, (res: any) => {
                if (!res.status) {
                    console.error("❌ [SQL] Failed to archive chat:", res.error);
                    reject(new Error(res.error));
                } else {
                    console.log("✅ [SQL] Chat archived successfully");
                    resolve();
                }
            });
        });
    }

    unarchiveChat(publickey: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE CHAT_STATUS SET archived=FALSE WHERE publickey='${publickey}'`;
            console.log("📂 [SQL] Unarchiving chat:", publickey);
            MDS.sql(sql, (res: any) => {
                if (!res.status) {
                    console.error("❌ [SQL] Failed to unarchive chat:", res.error);
                    reject(new Error(res.error));
                } else {
                    console.log("✅ [SQL] Chat unarchived successfully");
                    resolve();
                }
            });
        });
    }

    markChatAsOpened(publickey: string): Promise<void> {
        return new Promise((resolve) => {
            const sql = `
                MERGE INTO CHAT_STATUS (publickey, last_opened)
                KEY (publickey)
                VALUES ('${publickey}', ${Date.now()})
            `;
            console.log("👁️ [SQL] Marking chat as opened:", publickey);
            MDS.sql(sql, (res: any) => {
                if (!res.status) {
                    console.error("❌ [SQL] Failed to mark chat as opened:", res.error);
                    // Don't reject, just log error to avoid breaking UI flow
                    resolve();
                } else {
                    console.log("✅ [SQL] Chat marked as opened");
                    resolve();
                }
            });
        });
    }

    setAppInstalled(publickey: string): Promise<void> {
        return new Promise((resolve) => {
            // Use MERGE to update or insert
            const sql = `
                MERGE INTO CHAT_STATUS (publickey, app_installed)
                KEY (publickey)
                VALUES ('${publickey}', TRUE)
            `;
            MDS.sql(sql, (res: any) => {
                if (res.status) {
                    console.log("✅ [DB] App installed status saved for", publickey);
                } else {
                    console.error("❌ [DB] Failed to save app installed status:", res.error);
                }
                resolve();
            });
        });
    }

    isAppInstalled(publickey: string): Promise<boolean> {
        return new Promise((resolve) => {
            const sql = `SELECT app_installed FROM CHAT_STATUS WHERE publickey='${publickey}'`;
            MDS.sql(sql, (res: any) => {
                if (res.status && res.rows && res.rows.length > 0) {
                    const val = res.rows[0].APP_INSTALLED;
                    resolve(val === true || val === 'TRUE' || val === 1);
                } else {
                    resolve(false);
                }
            });
        });
    }

    getChatStatus(publickey: string): Promise<{ archived: boolean; lastOpened: number | null }> {
        return new Promise((resolve) => {
            const sql = `SELECT * FROM CHAT_STATUS WHERE publickey='${publickey}'`;
            MDS.sql(sql, (res: any) => {
                if (!res.status || !res.rows || res.rows.length === 0) {
                    resolve({ archived: false, lastOpened: null });
                    return;
                }
                const row = res.rows[0];
                resolve({
                    archived: row.ARCHIVED === true || row.ARCHIVED === 1,
                    lastOpened: row.LAST_OPENED ? Number(row.LAST_OPENED) : null
                });
            });
        });
    }

    async insertMessage(msg: ChatMessage & { date?: number }) {
        const { roomname, publickey, username, type, message, filedata = "", state = "", amount = 0, date } = msg;
        const encodedMsg = encodeURIComponent(message).replace(/'/g, "%27");
        const timestamp = date || Date.now();
        const sql = `
      INSERT INTO CHAT_MESSAGES (roomname,publickey,username,type,message,filedata,state,amount,date)
      VALUES ('${roomname}','${publickey}','${username}','${type}','${encodedMsg}','${filedata}','${state}',${amount},${timestamp})
    `;
        console.log("💾 [SQL] Executing INSERT:", sql);
        try {
            await this.runSQL(sql);
            console.log("💾 [SQL] INSERT successful");
        } catch (err) {
            console.error("❌ [SQL] INSERT failed:", err);
        }
    }

    getMessages(publickey: string): Promise<ChatMessage[]> {
        return new Promise((resolve) => {
            const sql = `
        SELECT * FROM CHAT_MESSAGES
        WHERE publickey='${publickey}'
        ORDER BY date ASC
      `;
            console.log("💾 [SQL] Executing SELECT:", sql);
            MDS.sql(sql, (res: any) => {
                console.log("💾 [SQL] SELECT result:", res);
                if (!res.status || !res.rows) {
                    resolve([]);
                    return;
                }
                resolve(res.rows);
            });
        });
    }

    getRecentChats(): Promise<any[]> {
        return new Promise((resolve) => {
            // Get all messages with their chat status
            const sql = `
                SELECT 
                    m.*,
                    s.archived,
                    s.last_opened
                FROM CHAT_MESSAGES m
                LEFT JOIN CHAT_STATUS s ON m.publickey = s.publickey
                ORDER BY m.date DESC
            `;

            console.log("💾 [SQL] Executing getRecentChats with status");
            MDS.sql(sql, (res: any) => {
                // If the query fails (e.g. CHAT_STATUS table doesn't exist yet), fallback to simple query
                if (!res.status) {
                    console.warn("⚠️ [SQL] Complex query failed, falling back to simple query:", res.error);
                    const simpleSql = `SELECT * FROM CHAT_MESSAGES ORDER BY date DESC`;
                    MDS.sql(simpleSql, (simpleRes: any) => {
                        if (!simpleRes.status || !simpleRes.rows) {
                            resolve([]);
                            return;
                        }
                        this.processChatRows(simpleRes.rows, resolve);
                    });
                    return;
                }

                if (!res.rows) {
                    resolve([]);
                    return;
                }

                this.processChatRows(res.rows, resolve);
            });
        });
    }

    private processChatRows(rows: any[], resolve: (value: any[]) => void) {
        // Group by publickey manually and keep only the most recent message
        const chatMap = new Map<string, any>();

        rows.forEach((row: any) => {
            const publickey = row.PUBLICKEY;

            // If we haven't seen this publickey yet, or this message is newer
            if (!chatMap.has(publickey)) {
                chatMap.set(publickey, {
                    publickey: row.PUBLICKEY,
                    roomname: row.ROOMNAME,
                    lastMessage: row.MESSAGE,
                    lastMessageType: row.TYPE,
                    lastMessageDate: row.DATE,
                    lastMessageAmount: row.AMOUNT,
                    username: row.USERNAME,
                    archived: row.ARCHIVED === true || row.ARCHIVED === 1 || false,
                    lastOpened: row.LAST_OPENED ? Number(row.LAST_OPENED) : null
                });
            }
        });

        // Convert map to array and sort: active chats first, then archived
        const chats = Array.from(chatMap.values()).sort((a, b) => {
            // Archived chats go to the bottom
            if (a.archived !== b.archived) {
                return a.archived ? 1 : -1;
            }
            // Within same category, sort by date
            return b.lastMessageDate - a.lastMessageDate;
        });

        console.log("💾 [SQL] Processed chats with status:", chats);
        resolve(chats);
    }


    /* ----------------------------------------------------------------------------
      INCOMING MESSAGES
    ---------------------------------------------------------------------------- */
    onNewMessage(cb: MessageCallback) {
        this.newMessageCallbacks.push(cb);
    }

    removeNewMessageCallback(cb: MessageCallback) {
        const index = this.newMessageCallbacks.indexOf(cb);
        if (index > -1) {
            this.newMessageCallbacks.splice(index, 1);
        }
    }

    processIncomingMessage(event: any) {
        if (!event.data) {
            console.warn("⚠️ [MAXIMA] Event has no data:", event);
            return;
        }

        const maximaData = event.data;

        // Log ALL Maxima events to see what's arriving
        console.log("📨 [MAXIMA] Event received:", {
            from: maximaData.from,
            application: maximaData.application,
            data: maximaData.data
        });

        if (!maximaData.application) {
            console.warn("⚠️ [MAXIMA] No application specified");
            return;
        }

        // Check if the message is for our application (case-insensitive)
        if (maximaData.application.toLowerCase() === "charmchain") {
            const from = maximaData.from;
            let datastr = maximaData.data;

            // Check if data is in hex format (starts with 0x)
            if (typeof datastr === 'string' && datastr.startsWith('0x')) {
                console.log("🔄 [MAXIMA] Converting hex data to UTF8");
                datastr = this.hexToUtf8(datastr.substring(2)); // Remove 0x prefix
                console.log("📝 [MAXIMA] Converted data:", datastr);
            }

            try {
                const json = JSON.parse(datastr) as IncomingMessagePayload;

                if (json.type === "read") {
                    console.log("📖 [MAXIMA] Read receipt received from", from);
                    // DB update is handled by Service Worker
                    // Notify listeners to refresh UI
                    this.newMessageCallbacks.forEach((cb) => cb({ ...json, type: 'read_receipt' }));
                    return;
                }

                if (json.type === "delivery_receipt") {
                    console.log("📬 [MAXIMA] Delivery receipt received from", from);
                    // DB update is handled by Service Worker
                    // Notify listeners to refresh UI
                    this.newMessageCallbacks.forEach((cb) => cb({ ...json, type: 'delivery_receipt' }));
                    return;
                }

                // Normal message
                console.log("✅ [CharmChain] Missatge rebut (guardat per Service Worker):", json.message);

                // DB insertion and Delivery Receipt are handled by Service Worker
                // We only need to notify the UI

                // Notify UI to refresh
                this.newMessageCallbacks.forEach((cb) => cb(json));
            } catch (err) {
                console.error("❌ [CharmChain] Error processant missatge:", err);
                console.error("❌ [CharmChain] Data rebuda:", datastr);
            }
        } else {
            console.log(`ℹ️ [MAXIMA] Message from application "${maximaData.application}" (not CharmChain)`);
        }
    }

    /* ----------------------------------------------------------------------------
      SENDING MESSAGES
    ---------------------------------------------------------------------------- */
    async sendMessage(
        toPublicKey: string,
        username: string,
        message: string,
        type: string = "text",
        filedata: string = "",
        amount: number = 0,
        existingTimestamp?: number  // If provided, we're updating an existing pending message
    ) {
        try {
            // Create payload with message data only (application is specified in Maxima params)
            const payload: any = {
                message,
                type,
                username,
                filedata
            };

            // Include amount for charm messages
            if (type === "charm" && amount > 0) {
                payload.amount = amount;
            }

            // Convert to HEX manually to match MaxSolo behavior
            const jsonStr = JSON.stringify(payload);
            const hexData = "0x" + this.utf8ToHex(jsonStr).toUpperCase();

            console.log("📤 [CharmChain] Sending message to:", toPublicKey, payload);
            console.log("🔢 [CharmChain] Hex data:", hexData);

            const response = await MDS.cmd.maxima({
                params: {
                    action: "send",
                    publickey: toPublicKey, // Use publickey for 0x... keys
                    application: "charmchain", // Lowercase to match package.json
                    data: hexData,
                    poll: false,  // Send immediately instead of queuing
                } as any,
            });

            console.log("📡 [MDS] Full Maxima send response:", response);

            // Check if it's a pending command (Read Mode)
            const isPending = response && ((response as any).status === false) && (
                (response as any).pending ||
                ((response as any).error && (response as any).error.toString().toLowerCase().includes("pending"))
            );

            if (response && (response as any).status === false && !isPending) {
                console.error("❌ [MDS] Maxima send failed:", (response as any).error || response);
                throw new Error((response as any).error || "Maxima send failed");
            }

            if (isPending) {
                console.warn("⚠️ [MDS] Command is pending approval (Read Mode). Saving with 'pending' state.");
            } else {
                console.log("✅ [CharmChain] Message sent successfully");
            }

            // Only insert a new message if we're not updating an existing one
            if (!existingTimestamp) {
                this.insertMessage({
                    roomname: username,
                    publickey: toPublicKey,
                    username: "Me", // Set to "Me" so we know it's sent by us
                    type,
                    message,
                    filedata,
                    state: isPending ? "pending" : "sent", // Use 'pending' if command is pending
                    amount, // Include amount for charm messages
                });
            } else {
                console.log(`ℹ️ [CharmChain] Skipping message insertion - updating existing message with timestamp ${existingTimestamp}`);
            }

            return response;
        } catch (err) {
            console.error("❌ [CharmChain] Error enviant missatge:", err);
            throw err;
        }
    }

    async updateMessageState(publickey: string, timestamp: number, state: string, newTimestamp?: number) {
        console.log(`🔄 [updateMessageState] CALLED: publickey=${publickey.substring(0, 10)}..., timestamp=${timestamp}, newState="${state}", newTimestamp=${newTimestamp}`);
        console.trace('Stack trace for updateMessageState');

        let setClause = `state='${state}'`;
        if (newTimestamp) {
            setClause += `, date='${newTimestamp}'`;
        }

        const sql = `
            UPDATE CHAT_MESSAGES
            SET ${setClause}
            WHERE publickey='${publickey}' AND date='${timestamp}'
        `;

        console.log(`💾 [SQL] Updating message state to '${state}'${newTimestamp ? ` and date to ${newTimestamp}` : ''} for timestamp ${timestamp}`);

        try {
            const result = await this.runSQL(sql);
            console.log(`✅[SQL] Message state updated: `, result);
            return result;
        } catch (err) {
            console.error("❌ [SQL] Error updating message state:", err);
            throw err;
        }
    }

    /* ----------------------------------------------------------------------------
       SQL HELPER (Promise wrapper)
    ---------------------------------------------------------------------------- */
    runSQL(sql: string): Promise<any> {
        return new Promise((resolve, reject) => {
            MDS.sql(sql, (res: any) => {
                if (res.status) {
                    resolve(res);
                } else {
                    console.error(`❌ [SQL Error] ${sql} ->`, res.error);
                    reject(res.error);
                }
            });
        });
    }

    /* ----------------------------------------------------------------------------
       TRANSACTION TRACKING
    ---------------------------------------------------------------------------- */
    async insertTransaction(
        txpowid: string | null,
        type: 'charm' | 'token',
        publickey: string,
        messageTimestamp: number,
        metadata: any = {},
        pendinguid: string | null = null
    ): Promise<void> {
        const now = Date.now();
        const metadataStr = JSON.stringify(metadata).replace(/'/g, "''"); // Escape single quotes

        // We need at least txpowid OR pendinguid
        if (!txpowid && !pendinguid) {
            console.error("❌ [TX] Cannot insert transaction without txpowid or pendinguid");
            return;
        }

        const txpowidVal = txpowid ? `'${txpowid}'` : 'NULL';
        const pendinguidVal = pendinguid ? `'${pendinguid}'` : 'NULL';

        const sql = `
            INSERT INTO TRANSACTIONS (txpowid, type, publickey, message_timestamp, status, created_at, updated_at, metadata, pendinguid)
            VALUES (${txpowidVal}, '${type}', '${publickey}', ${messageTimestamp}, 'pending', ${now}, ${now}, '${metadataStr}', ${pendinguidVal})
        `;

        console.log(`💾 [TX] Inserting transaction: ${txpowid} (${type})`);

        try {
            await this.runSQL(sql);
            console.log(`✅ [TX] Transaction inserted: ${txpowid}`);
        } catch (err) {
            console.error(`❌ [TX] Failed to insert transaction:`, err);
            throw err;
        }
    }

    async updateTransactionStatus(txpowid: string, status: 'pending' | 'confirmed' | 'rejected'): Promise<void> {
        const now = Date.now();
        const sql = `
            UPDATE TRANSACTIONS
            SET status='${status}', updated_at=${now}
            WHERE txpowid='${txpowid}'
        `;

        console.log(`🔄 [TX] Updating transaction ${txpowid} to ${status}`);

        try {
            await this.runSQL(sql);
            console.log(`✅ [TX] Transaction status updated: ${txpowid} -> ${status}`);
        } catch (err) {
            console.error(`❌ [TX] Failed to update transaction status:`, err);
            throw err;
        }
    }

    async getPendingTransactions(): Promise<any[]> {
        const sql = `SELECT * FROM TRANSACTIONS WHERE status='pending' ORDER BY created_at ASC`;

        try {
            const res = await this.runSQL(sql);
            return res.rows || [];
        } catch (err) {
            console.error(`❌ [TX] Failed to get pending transactions:`, err);
            return [];
        }
    }

    async getTransactionByMessageTimestamp(timestamp: number): Promise<any | null> {
        const sql = `SELECT * FROM TRANSACTIONS WHERE message_timestamp=${timestamp}`;

        try {
            const res = await this.runSQL(sql);
            return res.rows && res.rows.length > 0 ? res.rows[0] : null;
        } catch (err) {
            console.error(`❌ [TX] Failed to get transaction by timestamp:`, err);
            return null;
        }
    }

    async checkTransactionStatus(txpowid: string): Promise<'pending' | 'confirmed' | 'rejected' | 'unknown'> {
        if (!txpowid || txpowid === 'null' || txpowid === 'undefined') return 'unknown';

        try {
            // Try to find the transaction using txpow command
            const response: any = await new Promise((resolve) => {
                MDS.executeRaw(`txpow txpowid:${txpowid}`, (res: any) => {
                    resolve(res);
                });
            });

            if (response && response.status) {
                const txpow = response.response;

                // If we got a response, the transaction exists
                if (txpow) {
                    // Check if it's in a block (confirmed)
                    if (txpow.isblock || txpow.inblock) {
                        return 'confirmed';
                    }
                    // Transaction exists but not yet in a block
                    return 'pending';
                }
            }

            // Transaction not found - could be rejected or too old
            // However, we shouldn't be too hasty to call it 'unknown' or 'rejected' if it's just not found yet
            // But for now, 'unknown' is the safest fallback
            return 'unknown';
        } catch (err) {
            console.error(`❌ [TX] Error checking transaction status for ${txpowid}:`, err);
            return 'unknown';
        }
    }

    async updateTransactionTxpowid(pendinguid: string, txpowid: string): Promise<void> {
        const sql = `UPDATE TRANSACTIONS SET txpowid='${txpowid}' WHERE pendinguid='${pendinguid}'`;
        try {
            await this.runSQL(sql);
            console.log(`✅ [TX] Updated txpowid for pendinguid ${pendinguid} to ${txpowid}`);
        } catch (err) {
            console.error(`❌ [TX] Failed to update txpowid:`, err);
            throw err;
        }
    }

    async updateTransactionStatusByPendingUid(pendinguid: string, status: 'pending' | 'confirmed' | 'rejected'): Promise<void> {
        const now = Date.now();
        const sql = `UPDATE TRANSACTIONS SET status='${status}', updated_at=${now} WHERE pendinguid='${pendinguid}'`;
        try {
            await this.runSQL(sql);
            console.log(`✅ [TX] Updated status for pendinguid ${pendinguid} to ${status}`);
        } catch (err) {
            console.error(`❌ [TX] Failed to update status by pendinguid:`, err);
            throw err;
        }
    }

    async getPendingMessages(publickey: string) {
        const sql = `SELECT * FROM CHAT_MESSAGES WHERE publickey='${publickey}' AND state='pending'`;
        try {
            const res = await this.runSQL(sql);
            return res.rows;
        } catch (err) {
            console.error("❌ [CharmChain] Error fetching pending messages:", err);
            return [];
        }
    }

    async sendReadReceipt(toPublicKey: string) {
        console.log("📤 [CharmChain] Sending read receipt to", toPublicKey);
        try {
            const payload = {
                message: "",
                type: "read",
                username: "Me",
                filedata: ""
            };

            const jsonStr = JSON.stringify(payload);
            const hexData = "0x" + this.utf8ToHex(jsonStr).toUpperCase();

            await MDS.cmd.maxima({
                params: {
                    action: "send",
                    publickey: toPublicKey,
                    application: "charmchain",
                    data: hexData,
                    poll: false,
                } as any,
            });

            console.log("✅ [CharmChain] Read receipt sent successfully");

            // Mark received messages as read locally
            // IMPORTANT: Exclude 'pending' messages - they haven't been sent yet!
            const sql = `UPDATE CHAT_MESSAGES SET state = 'read' WHERE publickey = '${toPublicKey}' AND username != 'Me' AND state != 'read' AND state != 'pending'`;
            MDS.sql(sql, (res: any) => {
                console.log("✅ [DB] Marked received messages as read locally:", res);
            });

        } catch (err) {
            console.error("❌ [CharmChain] Error sending read receipt:", err);
        }
    }

    async sendDeliveryReceipt(toPublicKey: string) {
        console.log("📤 [CharmChain] Sending delivery receipt to", toPublicKey);
        try {
            const payload = {
                message: "",
                type: "delivery_receipt",
                username: "Me",
                filedata: ""
            };

            const jsonStr = JSON.stringify(payload);
            const hexData = "0x" + this.utf8ToHex(jsonStr).toUpperCase();

            // Send without polling/waiting too much
            MDS.cmd.maxima({
                params: {
                    action: "send",
                    publickey: toPublicKey,
                    application: "charmchain",
                    data: hexData,
                    poll: false,
                } as any,
            });

            console.log("✅ [CharmChain] Delivery receipt sent successfully");

        } catch (err) {
            console.error("❌ [CharmChain] Error sending delivery receipt:", err);
        }
    }

    async sendPing(toPublicKey: string) {
        console.log("📡 [CharmChain] Sending Ping to", toPublicKey);
        try {
            const payload = {
                message: "",
                type: "ping",
                username: "Me",
                filedata: ""
            };

            const jsonStr = JSON.stringify(payload);
            const hexData = "0x" + this.utf8ToHex(jsonStr).toUpperCase();

            await MDS.cmd.maxima({
                params: {
                    action: "send",
                    publickey: toPublicKey,
                    application: "charmchain",
                    data: hexData,
                    poll: false,
                } as any,
            });

            console.log("✅ [CharmChain] Ping sent successfully");
        } catch (err) {
            console.error("❌ [CharmChain] Error sending ping:", err);
            throw err;
        }
    }

    /* ----------------------------------------------------------------------------
      TOKEN SENDING
    ---------------------------------------------------------------------------- */
    async getBalance(): Promise<any[]> {
        try {
            const response = await MDS.cmd.balance();
            return response.response;
        } catch (err) {
            console.error("❌ [CharmChain] Error fetching balance:", err);
            return [];
        }
    }


    async sendCharmWithTokens(
        toPublicKey: string,
        minimaAddress: string,
        username: string,
        charmId: string,
        amount: number,
        stateId?: number
    ): Promise<{ pending: boolean; pendinguid?: string; response?: any; txpowid?: string }> {
        console.log(`🎯[CHARM] Sending charm ${charmId} with ${amount} Minima to ${username}`);

        try {
            // Step 1: Send the Minima tokens (tokenId 0x00 is always Minima)
            const tokenResponse = await this.sendToken("0x00", amount.toString(), minimaAddress, "Minima", stateId);

            // Extract txpowid and pendinguid from token response
            const txpowid = tokenResponse?.txpowid;
            const pendinguid = tokenResponse?.pendinguid;

            // Check if token send is pending
            const isTokenPending = tokenResponse && (tokenResponse.pending || (tokenResponse.error && tokenResponse.error.toString().toLowerCase().includes("pending")));

            if (isTokenPending) {
                console.log(`⚠️[CHARM] Token send is pending. Saving message locally but NOT sending via Maxima yet.`);

                const messageTimestamp = stateId || Date.now();

                // Save message locally with 'pending' state, but don't send via Maxima
                await this.insertMessage({
                    roomname: username,
                    publickey: toPublicKey,
                    username: "Me",
                    type: "charm",
                    message: charmId,
                    filedata: "",
                    state: "pending",
                    amount,
                    date: messageTimestamp
                });

                // Store transaction in TRANSACTIONS table if we have a txpowid OR pendinguid
                if (txpowid || pendinguid) {
                    await this.insertTransaction(
                        txpowid,
                        'charm',
                        toPublicKey,
                        messageTimestamp,
                        { charmId, amount, username, minimaAddress },
                        pendinguid
                    );
                    console.log(`💾 [CHARM] Transaction tracked: ${txpowid || 'No TXPOWID'} (PendingUID: ${pendinguid || 'None'})`);
                } else {
                    console.warn(`⚠️ [CHARM] Could not track transaction: No txpowid AND no pendinguid`);
                }

                return { pending: true, pendinguid, response: tokenResponse, txpowid };
            }

            // Step 2: Only send the charm message via Maxima if token was sent successfully
            console.log(`✅[CHARM] Token sent successfully. Now sending charm message via Maxima...`);
            const msgResponse = await this.sendMessage(toPublicKey, username, charmId, "charm", "", amount);

            console.log(`✅[CHARM] ========== CHARM SENT SUCCESSFULLY ==========`);
            return { pending: false, response: msgResponse, txpowid };

        } catch (err) {
            console.error(`❌[CHARM] ========== CHARM SEND FAILED ==========`);
            console.error(`❌[CHARM] Error details:`, err);
            throw err;
        }
    }

    async sendToken(tokenId: string, amount: string, address: string, tokenName: string, stateId?: number): Promise<any> {
        console.log(`💸[TOKEN SEND] Sending ${amount} ${tokenName} to ${address}`);

        try {
            // Construct the send command parameters
            const sendParams: any = {
                amount: amount,
                address: address,
                tokenid: tokenId
            };

            // Add state variables if stateId provided (for tracking)
            if (stateId) {
                sendParams.state = {
                    0: stateId,      // Unique timestamp ID
                    1: 204           // CharmChain identifier (0xCC)
                };
                console.log(`🏷️[TOKEN SEND] Adding state variables: ID = ${stateId}`);
            }

            console.log(`💸[TOKEN SEND] Command parameters:`, JSON.stringify(sendParams, null, 2));
            console.log(`💸[TOKEN SEND] Executing MDS.cmd.send...`);

            const response = await (MDS.cmd as any).send(sendParams);

            console.log(`💸[TOKEN SEND] Raw response:`, JSON.stringify(response, null, 2));

            // Extract txpowid from response (try multiple locations)
            let txpowid = null;
            if (response) {
                // 1. Direct property
                if (response.txpowid) txpowid = response.txpowid;
                // 2. Inside response object
                else if (response.response && response.response.txpowid) txpowid = response.response.txpowid;
                // 3. Inside txpow object
                else if (response.response && response.response.txpow && response.response.txpow.txpowid) txpowid = response.response.txpow.txpowid;
                // 4. Inside body.txn (common for pending transactions)
                else if (response.response && response.response.body && response.response.body.txn && response.response.body.txn.txpowid) txpowid = response.response.body.txn.txpowid;
            }

            // Extract pendinguid if available
            let pendinguid = null;
            if (response) {
                if (response.pendinguid) pendinguid = response.pendinguid;
                else if (response.response && response.response.pendinguid) pendinguid = response.response.pendinguid;
            }

            if (txpowid) {
                console.log(`🆔 [TOKEN SEND] Transaction ID captured: ${txpowid}`);
            } else if (pendinguid) {
                console.log(`⏳ [TOKEN SEND] Pending UID captured: ${pendinguid}`);
            } else {
                console.warn(`⚠️ [TOKEN SEND] No txpowid or pendinguid found in response`);
            }

            if (response && response.status === false) {
                // Check if it's a pending command (Read Mode)
                const isPending = response.pending ||
                    (response.error && response.error.toString().toLowerCase().includes("pending"));

                if (isPending) {
                    console.warn("⚠️ [TOKEN SEND] Command is pending approval (Read Mode).");
                    console.log("🔍 [DEBUG] Full Pending Response Structure:", JSON.stringify(response, null, 2));

                    // Return response with txpowid/pendinguid so caller knows it "succeeded" (queued) and can track it
                    return {
                        ...response,
                        txpowid,
                        pendinguid
                    };
                } else {
                    console.error(`❌[TOKEN SEND] Send command failed!`);
                    console.error(`❌[TOKEN SEND] Error:`, response.error || response.message || 'Unknown error');
                    throw new Error(response.error || response.message || 'Token send failed');
                }
            }

            console.log(`✅[TOKEN SEND] ========== TOKEN SENT SUCCESSFULLY ==========`);

            // Return response with txpowid/pendinguid included
            return {
                ...response,
                txpowid,
                pendinguid
            };
        } catch (err) {
            console.error(`❌[TOKEN SEND] ========== TOKEN SEND FAILED ==========`);
            console.error(`❌[TOKEN SEND] Error details:`, err);
            console.error(`❌[TOKEN SEND] Error type:`, typeof err);
            if (err instanceof Error) {
                console.error(`❌[TOKEN SEND] Error message:`, err.message);
                console.error(`❌[TOKEN SEND] Error stack:`, err.stack);
            }
            throw err;
        }
    }

    async initProfile() {
        // Publish our Minima address to Maxima profile so others can send us tokens
        try {
            const maxResponse = await MDS.cmd.maxima({ action: "getaddress" } as any);
            if (maxResponse.status) {
                // Cast to any to avoid type errors if the type definition is incomplete
                const myAddress = (maxResponse.response as any).address;
                console.log("📍 [CharmChain] My Minima Address:", myAddress);

                // We'll just log it for now as we're not sure about the update command yet
                // and we want to avoid unused variable warnings
                // const updateCmd = ...
            }
        } catch (err) {
            console.error("❌ [CharmChain] Error initializing profile:", err);
        }
    }

    /* ----------------------------------------------------------------------------
      INITIALIZATION
    ---------------------------------------------------------------------------- */
    init() {
        if (this.initialized) return;
        this.initialized = true;

        if (!MDS) {
            console.error("MDS no està disponible!");
            return;
        }

        console.log("[Service] MinimaService inicialitzat - esperant MDS.init...");
        // DB initialization will be called from AppContext after MDS.init completes

        // Initialize profile (publish address)
        // We do this a bit later or when needed
    }

    processEvent(event: any) {
        // Only log MAXIMA events to reduce noise
        if (event.event === "MAXIMA") {
            console.log("✉️ [MDS] MAXIMA event detected:", event);
            this.processIncomingMessage(event);
        }
    }
}

export const minimaService = new MinimaService();
