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
                console.error("❌ [DB] Failed to create table:", res.error);
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
    }

    insertMessage(msg: ChatMessage) {
        const { roomname, publickey, username, type, message, filedata = "", state = "", amount = 0 } = msg;
        const encodedMsg = encodeURIComponent(message).replace(/'/g, "%27");
        const sql = `
      INSERT INTO CHAT_MESSAGES (roomname,publickey,username,type,message,filedata,state,amount,date)
      VALUES ('${roomname}','${publickey}','${username}','${type}','${encodedMsg}','${filedata}','${state}',${amount},${Date.now()})
    `;
        console.log("💾 [SQL] Executing INSERT:", sql);
        MDS.sql(sql, (res: any) => {
            console.log("💾 [SQL] INSERT result:", res);
        });
    }

    getMessages(publickey: string): Promise<ChatMessage[]> {
        return new Promise((resolve) => {
            const sql = `
        SELECT * FROM CHAT_MESSAGES
        WHERE publickey='${publickey}'
        ORDER BY id ASC
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
            // First, get all messages ordered by date
            const sql = `SELECT * FROM CHAT_MESSAGES ORDER BY date DESC`;

            console.log("💾 [SQL] Executing getRecentChats:", sql);
            MDS.sql(sql, (res: any) => {
                console.log("💾 [SQL] getRecentChats result:", res);
                if (!res.status || !res.rows) {
                    resolve([]);
                    return;
                }

                // Group by publickey manually and keep only the most recent message
                const chatMap = new Map<string, any>();

                res.rows.forEach((row: any) => {
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
                            username: row.USERNAME
                        });
                    }
                });

                // Convert map to array and sort by date
                const chats = Array.from(chatMap.values()).sort((a, b) => b.lastMessageDate - a.lastMessageDate);

                console.log("💾 [SQL] Processed chats:", chats);
                resolve(chats);
            });
        });
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
        amount: number = 0
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

            if (response && (response as any).status === false) {
                console.error("❌ [MDS] Maxima send failed:", (response as any).error || response);
                throw new Error((response as any).error || "Maxima send failed");
            }

            console.log("✅ [CharmChain] Message sent successfully");

            this.insertMessage({
                roomname: username,
                publickey: toPublicKey,
                username: "Me", // Set to "Me" so we know it's sent by us
                type,
                message,
                filedata,
                state: "sent", // Initial state
                amount, // Include amount for charm messages
            });
        } catch (err) {
            console.error("❌ [CharmChain] Error enviant missatge:", err);
            throw err;
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
            const sql = `UPDATE CHAT_MESSAGES SET state='read' WHERE publickey='${toPublicKey}' AND username!='Me' AND state!='read'`;
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
        amount: number
    ): Promise<void> {
        console.log(`🎯 [CHARM] ========== STARTING CHARM SEND WITH TOKENS ==========`);
        console.log(`🎯 [CHARM] Charm ID: ${charmId}`);
        console.log(`🎯 [CHARM] Amount: ${amount} Minima`);
        console.log(`🎯 [CHARM] To PublicKey: ${toPublicKey}`);
        console.log(`🎯 [CHARM] To Minima Address: ${minimaAddress}`);
        console.log(`🎯 [CHARM] Username: ${username}`);

        try {
            // Step 1: Send the Minima tokens (tokenId 0x00 is always Minima)
            console.log(`🎯 [CHARM] Step 1/2: Sending ${amount} Minima tokens...`);
            await this.sendToken("0x00", amount.toString(), minimaAddress, "Minima");
            console.log(`✅ [CHARM] Tokens sent successfully`);

            // Step 2: Send the charm message
            console.log(`🎯 [CHARM] Step 2/2: Sending charm message...`);
            await this.sendMessage(toPublicKey, username, charmId, "charm", "", amount);
            console.log(`✅ [CHARM] Charm message sent successfully`);

            console.log(`✅ [CHARM] ========== CHARM SEND COMPLETE ==========`);
        } catch (err) {
            console.error(`❌ [CHARM] ========== CHARM SEND FAILED ==========`);
            console.error(`❌ [CHARM] Error details:`, err);
            throw err;
        }
    }

    async sendToken(tokenId: string, amount: string, address: string, tokenName: string): Promise<any> {
        console.log(`💸 [TOKEN SEND] ========== STARTING TOKEN SEND ==========`);
        console.log(`💸 [TOKEN SEND] Token Name: ${tokenName}`);
        console.log(`💸 [TOKEN SEND] Token ID: ${tokenId}`);
        console.log(`💸 [TOKEN SEND] Amount: ${amount}`);
        console.log(`💸 [TOKEN SEND] Destination Address: ${address}`);

        try {
            // Construct the send command parameters
            const sendParams = {
                amount: amount,
                address: address,
                tokenid: tokenId
            };

            console.log(`💸 [TOKEN SEND] Command parameters:`, JSON.stringify(sendParams, null, 2));
            console.log(`💸 [TOKEN SEND] Executing MDS.cmd.send...`);

            const response = await (MDS.cmd as any).send(sendParams);

            console.log(`💸 [TOKEN SEND] Raw response:`, JSON.stringify(response, null, 2));

            if (response && response.status === false) {
                console.error(`❌ [TOKEN SEND] Send command failed!`);
                console.error(`❌ [TOKEN SEND] Error:`, response.error || response.message || 'Unknown error');
                throw new Error(response.error || response.message || 'Token send failed');
            }

            console.log(`✅ [TOKEN SEND] ========== TOKEN SENT SUCCESSFULLY ==========`);
            return response;
        } catch (err) {
            console.error(`❌ [TOKEN SEND] ========== TOKEN SEND FAILED ==========`);
            console.error(`❌ [TOKEN SEND] Error details:`, err);
            console.error(`❌ [TOKEN SEND] Error type:`, typeof err);
            if (err instanceof Error) {
                console.error(`❌ [TOKEN SEND] Error message:`, err.message);
                console.error(`❌ [TOKEN SEND] Error stack:`, err.stack);
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
