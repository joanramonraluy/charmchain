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
            + "  date BIGINT NOT NULL "
            + " )";

        MDS.sql(initsql, (res: any) => {
            if (!res.status) {
                console.error("❌ [DB] Failed to create table:", res.error);
            } else {
                console.log("✅ [DB] CHAT_MESSAGES table initialized");
            }
        });
    }

    insertMessage(msg: ChatMessage) {
        const { roomname, publickey, username, type, message, filedata = "", state = "" } = msg;
        const encodedMsg = encodeURIComponent(message).replace(/'/g, "%27");
        const sql = `
      INSERT INTO CHAT_MESSAGES (roomname,publickey,username,type,message,filedata,state,date)
      VALUES ('${roomname}','${publickey}','${username}','${type}','${encodedMsg}','${filedata}','${state}',${Date.now()})
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
                    // Mark my sent messages as read by them
                    const sql = `UPDATE CHAT_MESSAGES SET state='read' WHERE publickey='${from}' AND username='Me'`;
                    console.log("💾 [SQL] Executing UPDATE (read):", sql);
                    MDS.sql(sql, (res: any) => {
                        console.log("💾 [SQL] UPDATE result:", res);
                        console.log("✅ [DB] Updated messages to 'read' status:", res);

                        // Notify listeners to refresh UI AFTER DB update completes
                        this.newMessageCallbacks.forEach((cb) => cb({ ...json, type: 'read_receipt' }));
                    });
                    return;
                }

                if (json.type === "delivery_receipt") {
                    console.log("📬 [MAXIMA] Delivery receipt received from", from);
                    // Mark my sent messages as delivered (if not already read)
                    const sql = `UPDATE CHAT_MESSAGES SET state='delivered' WHERE publickey='${from}' AND username='Me' AND state!='read'`;
                    MDS.sql(sql, (res: any) => {
                        console.log("✅ [DB] Updated messages to 'delivered' status:", res);

                        // Notify listeners to refresh UI AFTER DB update completes
                        this.newMessageCallbacks.forEach((cb) => cb({ ...json, type: 'delivery_receipt' }));
                    });
                    return;
                }

                // Insert received message into DB (no state - only sent messages have state)
                this.insertMessage({
                    roomname: json.username,
                    publickey: from,
                    username: json.username,
                    type: json.type,
                    message: json.message,
                    filedata: json.filedata || "",
                    // state is empty for received messages - only sent messages track delivery status
                });

                console.log("✅ [CharmChain] Missatge rebut i guardat:", json.message);

                // Send delivery receipt automatically
                this.sendDeliveryReceipt(from);

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
        filedata: string = ""
    ) {
        try {
            // Create payload with message data only (application is specified in Maxima params)
            const payload = {
                message,
                type,
                username,
                filedata
            };

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
