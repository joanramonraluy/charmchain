// index.tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: function Index() {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Inici</h1>
        <p>
          CharmChain és una DApp descentralitzada que permet enviar i rebre “charms”
          entre usuaris dins la xarxa Minima.
        </p>
      </div>
    )
  },
})
