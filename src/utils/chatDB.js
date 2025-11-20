// src/utils/chatDB.js
import { MDS } from "@minima-global/mds";

/**
 * Obtenir missatges d'un contacte per la seva adreça
 * @param {string} address
 * @returns {Promise<Array>}
 */
export const getMessages = async (address) => {
  return new Promise((resolve, reject) => {
    if (!MDS.sql) return reject("MDS sql no disponible");

    const query = `
      SELECT * FROM messages
      WHERE publickey='${address}'
      ORDER BY ID ASC
    `;
    MDS.sql(query, (res) => {
      if (res.status) {
        console.log("[DB] getMessages result:", res.rows);
        resolve(res.rows);
      } else {
        reject(res.error || "Error obtenint missatges");
      }
    });
  });
};

/**
 * Inserir missatge a la base de dades
 * @param {string} roomName
 * @param {string} publicKey
 * @param {string} content
 * @param {string} type
 * @param {Function} callback
 */
export const insertMessage = (roomName, publicKey, content, type, callback) => {
  if (!MDS.sql) {
    console.error("[DB] MDS sql no disponible per insertMessage");
    return;
  }

  const query = `
    INSERT INTO messages (ROOMNAME, PUBLICKEY, CONTENT, TYPE)
    VALUES ('${roomName}', '${publicKey}', '${content}', '${type}')
  `;

  MDS.sql(query, (res) => {
    if (res.status) {
      console.log("[DB] insertMessage:", content);
      callback?.();
    } else {
      console.error("[DB] Error insertMessage:", res.error);
    }
  });
};
