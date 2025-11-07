import { useContext } from "react"
import { Zap, Wifi, Menu } from "lucide-react"
import { appContext } from "../../AppContext"

export default function Header({ onToggleMenu }: { onToggleMenu: () => void }) {
  const { block } = useContext(appContext)

  return (
    <header className="fixed top-0 left-0 right-0 bg-blue-600 text-white flex justify-between items-center px-6 py-3 shadow-lg z-40">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMenu}
          className="p-2 rounded hover:bg-blue-500 transition md:hidden"
        >
          <Menu size={24} />
        </button>
        <Zap size={36} className="text-white" />
        <h1 className="text-lg font-semibold tracking-wide">CharmChain</h1>
      </div>

      {block && (
        <div className="flex items-center gap-2 text-sm">
          <Wifi size={20} className="text-green-400" />
          <p>Block: {block.block}</p>
        </div>
      )}
    </header>
  )
}
