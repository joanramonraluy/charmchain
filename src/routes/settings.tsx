import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/settings")({
  component: Settings,
})

function Settings() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Configuració</h1>
      <p className="text-gray-200">
        Aquí podràs ajustar els paràmetres de connexió, preferències i altres opcions de CharmChain.
      </p>
    </div>
  )
}
