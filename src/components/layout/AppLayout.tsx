import { ReactNode, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Menu } from "lucide-react"

interface AppLayoutProps {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-100 text-gray-900">
      {/* SIDEBAR */}
      {/* Visible sempre a escriptori (md) i ocultable al mòbil */}
      <aside className="hidden md:flex md:w-64 bg-gray-800 text-white flex-col p-4 space-y-4">
        <h2 className="text-xl font-bold mb-6">CharmChain</h2>
        <nav className="flex flex-col gap-4">
          <a href="#" className="hover:text-gray-300">Inici</a>
          <a href="#" className="hover:text-gray-300">Configuració</a>
          <a href="#" className="hover:text-gray-300">Informació</a>
        </nav>
      </aside>

      {/* Sidebar mòbil amb animació */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -250, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -250, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-y-0 left-0 z-30 w-64 bg-gray-800 text-white flex flex-col p-4 md:hidden"
          >
            <h2 className="text-xl font-bold mb-6">Menú</h2>
            <nav className="flex flex-col gap-4">
              <a href="#" className="hover:text-gray-300" onClick={() => setSidebarOpen(false)}>Inici</a>
              <a href="#" className="hover:text-gray-300" onClick={() => setSidebarOpen(false)}>Configuració</a>
              <a href="#" className="hover:text-gray-300" onClick={() => setSidebarOpen(false)}>Informació</a>
            </nav>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* CONTINGUT PRINCIPAL */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Capçalera */}
        <header className="bg-blue-600 text-white flex items-center p-4 shadow-md">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mr-4 focus:outline-none md:hidden"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-semibold">CharmChain 💖</h1>
        </header>

        {/* Contingut principal */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
