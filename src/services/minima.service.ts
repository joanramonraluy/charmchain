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
        const initsql = `
      CREATE TABLE IF NOT EXISTS "MESSAGES" (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        roomname VARCHAR(160) NOT NULL,
        publickey VARCHAR(512) NOT NULL,
        username VARCHAR(160) NOT NULL,
        type VARCHAR(64) NOT NULL,
        message VARCHAR(512) NOT NULL,
        filedata CLOB NOT NULL,
        customid VARCHAR(128) NOT NULL DEFAULT '0x00',
        state VARCHAR(128) NOT NULL DEFAULT '',
        read INT NOT NULL DEFAULT 0,
        date BIGINT NOT NULL
      )
    `;
        MDS.sql(initsql, (res: any) => {
            if (!res.status) {
                console.error("❌ [DB] Failed to create table:", res.error);
            }
        });
    }

    insertMessage(msg: ChatMessage) {
        const { roomname, publickey, username, type, message, filedata = "" } = msg;
        const encodedMsg = encodeURIComponent(message).replace(/'/g, "%27");
        const sql = `
      INSERT INTO "MESSAGES" (roomname, publickey, username, type, message, filedata, date)
      VALUES ('${roomname}', '${publickey}', '${username}', '${type}', '${encodedMsg}', '${filedata}', ${Date.now()})
    `;
        MDS.sql(sql);
    }

    getMessages(publickey: string): Promise<ChatMessage[]> {
        return new Promise((resolve) => {
            const sql = `
        SELECT * FROM "MESSAGES"
        WHERE publickey='${publickey}'
        ORDER BY id ASC
      `;
            MDS.sql(sql, (res: any) => {
                if (!res.status || !res.rows) {
                    resolve([]);
                    return;
                }
                resolve(res.rows as ChatMessage[]);
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

        if (maximaData.application === "CharmChain") {
            const from = maximaData.from;
            const datastr = maximaData.data;

            try {
                const json = JSON.parse(datastr) as IncomingMessagePayload;

                this.insertMessage({
                    roomname: json.username,
                    publickey: from,
                    username: json.username,
                    type: json.type,
                    message: json.message,
                    filedata: json.filedata || "",
                });

                console.log("✅ [CharmChain] Missatge rebut de", from, ":", json.message);

                this.newMessageCallbacks.forEach((cb) => cb(json));
            } catch (err) {
                console.error("❌ [CharmChain] Error processant missatge:", err);
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

            console.log("📤 [CharmChain] Sending message to:", toPublicKey, payload);

            await MDS.cmd.maxima({
                params: {
                    action: "send",
                    to: toPublicKey,
                    application: "CharmChain",
                    data: JSON.stringify(payload),
                    poll: true,
                } as any,
            });

            console.log("✅ [CharmChain] Message sent successfully");

            this.insertMessage({
                roomname: username,
                publickey: toPublicKey,
                username,
                type,
                message,
                filedata,
            });
        } catch (err) {
            console.error("❌ [CharmChain] Error enviant missatge:", err);
            throw err;
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
        if (event.event === "MAXIMA") {
            this.processIncomingMessage(event);
        }
    }
}

export const minimaService = new MinimaService();
