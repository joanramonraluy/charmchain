// SideMenu.tsx
import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Settings, Info, Users, X, MessageSquare } from "lucide-react";

interface SideMenuProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

export default function SideMenu({ isOpen, setIsOpen }: SideMenuProps) {
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside (mobile only)
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
    { to: "/", icon: <MessageSquare />, label: "Chats" },
    { to: "/contacts", icon: <Users />, label: "Contacts" },
    { to: "/settings", icon: <Settings />, label: "Settings" },
    { to: "/info", icon: <Info />, label: "Info" },
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        ref={menuRef}
        className={`fixed top-0 left-0 h-full bg-[#1c242f] text-white flex flex-col shadow-2xl z-50 transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} 
          md:relative md:translate-x-0 md:w-64 md:shadow-none md:border-r md:border-gray-800 w-72`}
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-bold">
              CC
            </div>
            <h1 className="text-xl font-bold tracking-tight">CharmChain</h1>
          </div>
          <button
            className="md:hidden text-gray-400 hover:text-white transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <MenuItem
              key={item.to}
              {...item}
              active={currentPath === item.to}
              onClick={() => setIsOpen(false)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 text-xs text-gray-500 text-center">
          v1.0.0 • Minima Network
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
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${active
        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
        : "text-gray-400 hover:bg-gray-800 hover:text-white"
        }`}
    >
      <div className={`transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-110"}`}>
        {icon}
      </div>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
