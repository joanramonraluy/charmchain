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
        console.log("✅ MDS carregat, consultant contactes...");

        const res = await MDS.cmd.maxcontacts();
        console.log("📡 Resposta completa MDS:", res);

        // La resposta pot tenir diversos formats segons la versió del node
        let list = [];

        if (res?.response?.contacts && Array.isArray(res.response.contacts)) {
          list = res.response.contacts;
        } else if (res?.contacts && Array.isArray(res.contacts)) {
          list = res.contacts;
        } else if (Array.isArray(res)) {
          list = res;
        }

        console.log("📇 Contactes trobats:", list);

        if (isMounted) setContacts(list);
      } catch (err) {
        console.error("🚨 Error obtenint contactes:", err);
        if (isMounted) setError(err.message || "Error desconegut");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchContacts();

    return () => {
      isMounted = false;
    };
  }, [loaded]);

  if (!loaded) return <p>⏳ Esperant Minima...</p>;
  if (loading) return <p>🔄 Carregant contactes...</p>;
  if (error) return <p>⚠️ Error: {error}</p>;

  return (
    <div>
      <h3>💌 Contactes Maxima</h3>
      {contacts.length > 0 ? (
        <ul>
          {contacts.map((c, i) => (
            <li key={i} style={{ marginBottom: "0.5rem" }}>
              <strong>{c.extradata?.name || "(Sense nom)"}</strong>
              <br />
              🪪{" "}
              {c.currentaddress ||
                c.extradata?.minimaaddress ||
                "(Sense adreça)"}
              {c.extradata?.publickey && (
                <>
                  <br />
                  🔑 {c.extradata.publickey.slice(0, 16)}...
                </>
              )}
              {c.extradata?.avatar && (
                <div>
                  <img
                    src={c.extradata.avatar}
                    alt="avatar"
                    style={{ width: 40, height: 40, borderRadius: "50%" }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>📭 No hi ha contactes disponibles a Maxima.</p>
      )}
    </div>
  );
}
