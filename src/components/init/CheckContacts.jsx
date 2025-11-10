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
        console.log("✅ MDS loaded, consultant contactes Maxima...")
        const res = await MDS.cmd.maxcontacts()

        console.log("📡 Resposta MDS:", res)

        if (res.status && res.response.contacts) {
          setContacts(res.response.contacts)
        } else {
          console.warn("⚠️ Cap contacte retornat o resposta buida:", res)
          setContacts([])
        }
      } catch (err) {
        console.error("🚨 Error en obtenir contactes:", err)
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
              {c.name || "(Sense nom)"} — {c.maximaaddress}
            </li>
          ))}
        </ul>
      ) : (
        <p>📭 No hi ha contactes disponibles a Maxima.</p>
      )}
    </div>
  )
}