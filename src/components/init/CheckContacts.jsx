import React, { useContext, useEffect, useState } from "react"
import { appContext } from "../../AppContext"
import { MDS } from "@minima-global/mds"

export default function CheckContacts() {
  const { loaded } = useContext(appContext)
  const [contacts, setContacts] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!loaded) return // Esperem fins que MDS estigui inicialitzat

    const fetchContacts = async () => {
      try {
        console.log("✅ MDS carregat, consultant contactes...")
        const res = await MDS.runCommand("maxcontacts")

        console.log("📡 Resposta MDS:", JSON.stringify(res, null, 2))

        // Els contactes venen a res.contacts
        if (res.contacts && Array.isArray(res.contacts)) {
          setContacts(res.contacts)
        } else {
          console.warn("⚠️ Cap contacte retornat o format desconegut:", res)
          setContacts([])
        }
      } catch (err) {
        console.error("🚨 Error obtenint contactes:", err)
        setError(err.message || "Error desconegut")
      } finally {
        setLoading(false)
      }
    }

    fetchContacts()
  }, [loaded])

  if (!loaded) return <p>⏳ Esperant Minima...</p>
  if (loading) return <p>🔄 Carregant contactes...</p>
  if (error) return <p>⚠️ Error: {error}</p>

  return (
    <div>
      <h3>💌 Contactes Maxima</h3>
      {contacts.length > 0 ? (
        <ul>
          {contacts.map((c, i) => (
            <li key={i}>
              {c.extradata?.name || "(Sense nom)"} —{" "}
              {c.currentaddress || c.extradata?.minimaaddress}
            </li>
          ))}
        </ul>
      ) : (
        <p>📭 No hi ha contactes disponibles a Maxima.</p>
      )}
    </div>
  )
}
