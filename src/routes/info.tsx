import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/info")({
  component: Info,
})

function Info() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Informació</h1>
      <p className="text-gray-200">
        CharmChain és una DApp descentralitzada que permet enviar i rebre “charms”
        entre usuaris dins la xarxa Minima.
      </p>
    </div>
  )
}
