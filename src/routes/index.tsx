import { createFileRoute } from "@tanstack/react-router"
import AppLayout from "../components/layout/AppLayout"

export const Route = createFileRoute("/")({
  component: function Index() {
    return (
      <AppLayout title="Inici">
        <p>
          CharmChain és una DApp descentralitzada que permet enviar i rebre “charms”
          entre usuaris dins la xarxa Minima.
        </p>
      </AppLayout>
    )
  },
})