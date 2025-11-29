// SideMenu.tsx
import { useEffect, useRef, useContext, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Settings, Info, Users, X, MessageSquare, Globe } from "lucide-react";
import { appContext } from "../../AppContext";
import { MDS } from "@minima-global/mds";

const defaultAvatar =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
      <circle cx='24' cy='24' r='24' fill='#ccc'/>
      <text x='50%' y='55%' text-anchor='middle' font-size='20' fill='white' dy='.3em'>?</text>
     </svg>`
  );

interface SideMenuProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

export default function SideMenu({ isOpen, setIsOpen }: SideMenuProps) {
  const { loaded } = useContext(appContext);
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const menuRef = useRef<HTMLDivElement>(null);
  const [userName, setUserName] = useState<string>("User");
  const [userAvatar, setUserAvatar] = useState<string>(defaultAvatar);

  useEffect(() => {
    if (!loaded) return;
    let isMounted = true;

    const fetchUser = async () => {
      try {
        const res = await MDS.cmd.maxima({ params: { action: "info" } });
        const info = (res.response as any) || {};

        if (isMounted && info) {
          const name = info.name || "User";
          const icon = info.icon ? decodeURIComponent(info.icon) : defaultAvatar;
          setUserName(name);
          setUserAvatar(icon);
        }
      } catch (err) {
        console.error("Error fetching user info:", err);
      }
    };

    fetchUser();
    return () => {
      isMounted = false;
    };
  }, [loaded]);

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
    { to: "/discovery", icon: <Globe />, label: "Community" },
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
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src={userAvatar}
              alt="User"
              className="w-10 h-10 rounded-full object-cover border-4 border-white"
              onError={(e) => {
                (e.target as HTMLImageElement).src = defaultAvatar;
              }}
            />
            <h1 className="text-lg font-bold tracking-tight truncate max-w-[140px]" title={userName}>
              {userName}
            </h1>
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
          <p>v1.0.0 • CharmChain</p>
          <p>Minima Network</p>
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
