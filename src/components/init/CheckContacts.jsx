import React, { useContext, useEffect, useState } from "react";
import { appContext } from "../../AppContext";
import { MDS } from "@minima-global/mds";

export default function CheckContacts() {
  const { loaded } = useContext(appContext);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loaded) return;

    let isMounted = true;

    const fetchContacts = async () => {
      try {
        console.log("✅ MDS loaded, fetching contacts...");
        const res = await MDS.cmd.maxcontacts();
        console.log("📡 Full MDS response:", res);

        let list = [];

        if (res?.response?.contacts && Array.isArray(res.response.contacts)) {
          list = res.response.contacts;
        } else if (res?.contacts && Array.isArray(res.contacts)) {
          list = res.contacts;
        } else if (Array.isArray(res)) {
          list = res;
        }

        console.log("📇 Contacts found:", list);

        if (isMounted) setContacts(list);
      } catch (err) {
        console.error("🚨 Error fetching contacts:", err);
        if (isMounted) setError(err.message || "Unknown error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchContacts();

    return () => {
      isMounted = false;
    };
  }, [loaded]);

  if (!loaded) return <p>⏳ Waiting for Minima...</p>;
  if (loading) return <p>🔄 Loading contacts...</p>;
  if (error) return <p>⚠️ Error: {error}</p>;

  const defaultAvatar =
    "data:image/svg+xml;base64," +
    btoa(
      `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
        <circle cx='24' cy='24' r='24' fill='#ccc'/>
        <text x='50%' y='55%' text-anchor='middle' font-size='20' fill='white' dy='.3em'>?</text>
      </svg>`
    );

  const getAvatar = (contact) => {
    if (contact.extradata?.icon) {
      try {
        const decoded = decodeURIComponent(contact.extradata.icon);
        if (decoded.startsWith("data:image")) return decoded;
      } catch (err) {
        console.warn("⚠️ Error decoding avatar:", err);
      }
    }
    return defaultAvatar;
  };

  // Trunca adreça: 7 primers + ... + 5 darrers
  const truncateAddress = (addr) => {
    if (!addr) return "(No address)";
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 7)}...${addr.slice(-5)}`;
  };

  // Funció que retorna "fa X minuts/hores/dies" a partir del lastseen
  const timeAgo = (timestamp) => {
    if (!timestamp) return "Desconegut";
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ara mateix";
    if (mins < 60) return `fa ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `fa ${hours} h`;
    const days = Math.floor(hours / 24);
    return `fa ${days} dies`;
  };

  return (
    <div>
      {contacts.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {contacts.map((c, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.8rem",
                backgroundColor: "#f8f8f8",
                padding: "0.6rem 1rem",
                borderRadius: "12px",
                border: "1px solid #ddd",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                <img
                  src={getAvatar(c)}
                  alt={c.extradata?.name || "(No name)"}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "1px solid #ddd",
                  }}
                  onError={(e) => {
                    e.target.src = defaultAvatar;
                  }}
                />
                <div>
                  <strong>{c.extradata?.name || "(No name)"}</strong>
                  <br />
                  <small style={{ color: "#555" }}>
                    {truncateAddress(c.currentaddress || c.extradata?.minimaaddress)}
                  </small>
                  <br />
                  <small style={{ color: "#777" }}>
                    Última connexió: {timeAgo(c.lastseen)}
                  </small>
                </div>
              </div>

              {/* Estat connexió */}
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: c.samechain ? "green" : "red",
                  marginLeft: "1rem",
                }}
                title={c.samechain ? "Connectat" : "Desconnectat"}
              ></div>
            </li>
          ))}
        </ul>
      ) : (
        <p>📭 No contacts available in Maxima.</p>
      )}
    </div>
  );
}
