// SideMenu.tsx
import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Settings, Info, Users, X } from "lucide-react";

interface SideMenuProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

export default function SideMenu({ isOpen, setIsOpen }: SideMenuProps) {
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const menuRef = useRef<HTMLDivElement>(null);

  // Tancar el menú al clicar fora (només mòbil)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        isOpen
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setIsOpen]);

  const menuItems = [
    { to: "/", icon: <Home />, label: "Home" },
    { to: "/contacts", icon: <Users />, label: "Contacts" },
    { to: "/settings", icon: <Settings />, label: "Settings" },
    { to: "/info", icon: <Info />, label: "Info" },
  ];

  return (
    <>
      {/* Sidebar escriptori */}
      <div
        className="hidden md:flex fixed top-20 left-0 h-[calc(100%-5rem)] bg-blue-700 flex-col items-start py-8 px-6 space-y-4 shadow-lg min-w-[180px]"
      >
        {menuItems.map((item) => (
          <MenuItem key={item.to} {...item} active={currentPath === item.to} />
        ))}
      </div>

      {/* Sidebar mòbil */}
      <div
        ref={menuRef}
        className={`fixed top-0 left-0 h-full bg-blue-700 transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out z-50 shadow-lg w-64 md:hidden`}
      >
        <div className="flex justify-end p-4">
          <button className="text-white" onClick={() => setIsOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <div className="flex flex-col p-6 mt-4 space-y-6">
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
  );
}

function MenuItem({
  to,
  icon,
  label,
  active,
  onClick,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 p-2 rounded hover:bg-blue-600 transition ${
        active ? "bg-blue-600 text-yellow-300" : "text-white"
      }`}
    >
      <div className="w-6 h-6 flex items-center justify-center">{icon}</div>
      <span className="text-sm">{label}</span>
    </Link>
  );
}
