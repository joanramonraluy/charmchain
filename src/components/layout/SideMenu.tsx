import { Link, useRouterState } from "@tanstack/react-router"
import { Home, Settings, Info, X } from "lucide-react"

export default function SideMenu({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean
  setIsOpen: (v: boolean) => void
}) {
  const router = useRouterState()
  const currentPath = router.location.pathname

  const menuItems = [
    { to: "/", icon: <Home />, label: "Inici" },
    { to: "/settings", icon: <Settings />, label: "Configuració" },
    { to: "/info", icon: <Info />, label: "Info" },
  ]

  return (
    <>
      {/* Escriptori */}
      <div className="hidden md:flex fixed top-16 left-0 h-full w-20 bg-blue-700 flex-col items-center py-6 space-y-8 shadow-lg">
        {menuItems.map((item) => (
          <MenuItem key={item.to} {...item} active={currentPath === item.to} />
        ))}
      </div>

      {/* Mòbil */}
      <div
        className={`fixed top-0 left-0 h-full w-56 bg-blue-700 transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out z-50 md:hidden shadow-lg`}
      >
        <button
          className="absolute top-4 right-4 text-white"
          onClick={() => setIsOpen(false)}
        >
          <X size={24} />
        </button>

        <div className="flex flex-col p-6 mt-12 space-y-6">
          {menuItems.map((item) => (
            <MenuItem
              key={item.to}
              {...item}
              active={currentPath === item.to}
              onClick={() => setIsOpen(false)}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function MenuItem({
  to,
  icon,
  label,
  active,
  onClick,
}: {
  to: string
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 hover:text-yellow-300 transition ${
        active ? "text-yellow-300" : "text-white"
      }`}
    >
      <div className="flex items-center justify-center w-10 h-10">{icon}</div>
      <span className="hidden md:inline text-sm">{label}</span>
    </Link>
  )
}
