import React, { useEffect, useState } from "react";

export default function CheckContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("🟡 Waiting for Maxima...");

  // Inicialitza Minima i comprova que MDS estigui disponible
  async function initMaximaSafe() {
    let retries = 0;
    while (typeof window.MDS === "undefined" && retries < 10) {
      console.warn(`⏳ Waiting for Minima... (${retries + 1}/10)`);
      await new Promise((r) => setTimeout(r, 1000));
      retries++;
    }

    if (typeof window.MDS === "undefined") {
      throw new Error("❌ Maxima not available: window.MDS is undefined.");
    }

    console.log("✅ Maxima available:", window.MDS);
    return window.MDS;
  }

  // Obté la llista de contactes des de Maxima
  async function getContacts() {
    try {
      const res = await window.MDS.cmd("maxima", { action: "list" });
      console.log("📬 Raw Maxima list:", res);
      return res.response?.contacts || [];
    } catch (err) {
      console.error("🚨 Error fetching contacts:", err);
      return [];
    }
  }

  useEffect(() => {
    async function loadContacts() {
      try {
        const MDS = await initMaximaSafe();
        setStatus("✅ Maxima ready. Loading contacts...");
        const list = await getContacts();
        setContacts(list);
        if (list.length === 0) {
          setStatus("🙈 No contacts found.");
        } else {
          setStatus(`💌 ${list.length} contacts loaded.`);
        }
      } catch (err) {
        console.error("🚨 Error during Maxima initialization or contact fetch:", err);
        setStatus(err.message || "❌ Failed to initialize Maxima.");
      } finally {
        setLoading(false);
      }
    }

    loadContacts();
  }, []);

  // Render
  if (loading) return <p>{status}</p>;

  return (
    <div>
      <h2>💌 Your Contacts</h2>
      <p>{status}</p>
      {contacts.length > 0 && (
        <ul>
          {contacts.map((c) => (
            <li key={c.maximaaddress}>
              {c.name} — {c.maximaaddress}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
