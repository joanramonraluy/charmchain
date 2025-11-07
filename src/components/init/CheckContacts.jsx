// src/components/init/CheckContacts.jsx
import React, { useEffect, useState } from "react";
import { initMaxima, getContacts } from "../../utils/maximacontacts";

export default function CheckContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContacts() {
      try {
        await initMaxima();
        const list = await getContacts();
        setContacts(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadContacts();
  }, []);

  if (loading) return <p>🔄 Loading contacts...</p>;

  if (contacts.length === 0)
    return <p>🙈 No contacts found. Try connecting with others on Minima!</p>;

  return (
    <div>
      <h2>💌 Your Contacts</h2>
      <ul>
        {contacts.map((c) => (
          <li key={c.maximaaddress}>{c.name}</li>
        ))}
      </ul>
    </div>
  );
}
