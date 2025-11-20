/**
 * service.js
 * Servei centralitzat per a CharmChat
 * Gestió de missatges: enviament via Maxima i emmagatzematge a la DB
 * Ubicat a: public/service.js
 */

import { MDS } from "@minima-global/mds";

// Conversió HEX <-> UTF8
export function hexToUtf8(s) {
  return decodeURIComponent(
    s.replace(/\s+/g, "")
     .replace(/[0-9A-F]{2}/g, "%$&")
  );
}

export function utf8ToHex(s) {
  const encoder = new TextEncoder();
  let r = "";
  for (const b of encoder.encode(s)) {
    r += ("0" + b.toString(16)).slice(-2);
  }
  return r;
}

// Inicialitzar taula compatible H2
export function initDB() {
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
  MDS.sql(initsql, (res) => {
    if (res.status) {
      console.log("[DB] Table 'MESSAGES' initialized successfully");
    } else {
      console.error("[DB] Table initialization error:", res);
    }
  });
}

// Garantir que el servei estigui preparat abans de fer operacions
export async function ensureServiceReady() {
  return new Promise((resolve) => {
    if (!MDS || !MDS.sql) {
      console.error("MDS no està inicialitzat!");
      resolve(false);
      return;
    }
    initDB();
    // Espera curta perquè la taula s'inicialitzi
    setTimeout(() => resolve(true), 500);
  });
}

// Inserir missatge a la DB
export function insertMessage({ roomname, publickey, username, type, message, filedata = "" }) {
  const encodedMsg = encodeURIComponent(message).replace(/'/g, "%27");
  const sql = `
    INSERT INTO "MESSAGES" (roomname, publickey, username, type, message, filedata, date)
    VALUES ('${roomname}', '${publickey}', '${username}', '${type}', '${encodedMsg}', '${filedata}', ${Date.now()})
  `;
  MDS.sql(sql, (res) => {
    if (res.status) {
      console.log("[DB] Message inserted:", username, message);
    } else {
      console.error("[DB] Error inserting message:", res);
    }
  });
}

// Llegir missatges d'un contacte (amb logs per debugging)
export function getMessages(publickey, callback) {
  console.log("[DB] 🔍 getMessages() CALLED for publickey:", publickey);

  const sql = `
    SELECT * FROM "MESSAGES"
    WHERE publickey='${publickey}'
    ORDER BY id ASC
  `;

  console.log("[DB] 📡 Executing SQL:", sql);

  MDS.sql(sql, (res) => {
    console.log("[DB] 📥 Raw SQL response:", res);

    if (!res.status) {
      console.error("[DB] ❌ Error loading messages:", res);
      callback([]);
      return;
    }

    if (!res.rows || res.rows.length === 0) {
      console.warn("[DB] ⚠️ No messages found for:", publickey);
      callback([]);
      return;
    }

    console.log("[DB] ✅ Messages retrieved:", res.rows.length);

    // Log detallat missatge per missatge
    res.rows.forEach((row, i) => {
      console.log(
        `[DB][Row ${i}]`,
        {
          id: row.id,
          type: row.type,
          message: row.message,
          decodedMessage: (() => {
            try {
              return decodeURIComponent(row.message);
            } catch {
              return "(decode failed)";
            }
          })(),
          filedata: row.filedata,
          date: row.date,
        }
      );
    });

    callback(res.rows);
  });
}


// Enviar missatge via Maxima + guardar a DB
export async function sendMessage(toPublicKey, username, message, type = "text", filedata = "") {
  try {
    const payload = { application: "maxsolo", message, type, username, filedata };
    const payloadHex = "0x" + utf8ToHex(JSON.stringify(payload));

    // Enviar via Maxima
    await MDS.cmd.maxima({ params: { action: "send", to: toPublicKey, data: payloadHex } });

    // Guardar a DB local
    insertMessage({ roomname: username, publickey: toPublicKey, username, type, message, filedata });

    console.log("[Maxima+DB] Message sent and saved:", message);
  } catch (err) {
    console.error("[Maxima] Error sending message:", err);
  }
}

// Inicialització general del servei
export function initService() {
  if (!MDS || !MDS.sql) {
    console.error("MDS no està inicialitzat!");
    return;
  }
  initDB();
  console.log("[Service] Initialized");
}
