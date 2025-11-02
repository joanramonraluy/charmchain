import { createFileRoute } from "@tanstack/react-router"
import { useContext } from "react"
import { appContext } from "../AppContext"
import { Zap, Wifi } from "lucide-react" // ✅ icones de lucide-react

export const Route = createFileRoute("/")({
  component: Header,
})

function Header() {
  const { block } = useContext(appContext)

  return (
    <header className="absolute top-10 left-10 right-10 flex justify-between items-center z-10 gap-4">
      {/* Logo */}
      <Zap size={60} className="text-gray-300" />

      {/* Bloc actiu */}
      {block && (
        <div className="flex items-center gap-2 mt-3 text-gray-300 font-mono text-sm">
          <Wifi size={24} className="text-green-500" />
          <p>Block: {block.block}</p>
        </div>
      )}
    </header>
  )
}
