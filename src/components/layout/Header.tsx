import { useContext } from "react";
import { Wifi, Menu } from "lucide-react";
import { appContext } from "../../AppContext";
import { useRouterState, useNavigate } from "@tanstack/react-router";

const defaultAvatar =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
      <circle cx='24' cy='24' r='24' fill='#ccc'/>
      <text x='50%' y='55%' text-anchor='middle' font-size='20' fill='white' dy='.3em'>?</text>
     </svg>`
  );

interface HeaderProps {
  onToggleMenu: () => void;
}

const menuLabels = [
  { to: "/", label: "Chats" },
  { to: "/contacts", label: "Contacts" },
  { to: "/settings", label: "Settings" },
  { to: "/info", label: "Info" },
];

export default function Header({ onToggleMenu }: HeaderProps) {
  const { synced, userAvatar } = useContext(appContext);
  const navigate = useNavigate();

  const router = useRouterState();
  const currentPath = router.location.pathname;

  const currentItem = menuLabels.find((item) => item.to === currentPath);
  // If path is root "/", show "CharmChain" instead of "Chats"
  const pageTitle = currentPath === "/" ? "CharmChain" : (currentItem?.label || "CharmChain");

  return (
    <header className="w-full bg-[#0088cc] text-white shadow-md z-30 flex-shrink-0">
      <div className="flex justify-between items-center px-4 py-4">
        <div className="flex items-center gap-3">

          {/* Hamburger menu button for desktop */}
          <button
            onClick={onToggleMenu}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 transition md:hidden"
            aria-label="Menu"
          >
            <Menu size={24} />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
              CC
            </div>
            <h1 className="text-xl font-bold tracking-wide">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Wifi
            size={20}
            className={`${synced ? "text-green-300" : "text-red-300 animate-pulse"} transition-colors`}
          />
          <div
            onClick={() => navigate({ to: "/settings" })}
            className="cursor-pointer transition-transform hover:scale-105 active:scale-95 md:hidden"
          >
            <img
              src={userAvatar}
              alt="User avatar"
              className="w-10 h-10 rounded-full border-4 border-white object-cover bg-white/20"
              onError={(e) => {
                (e.target as HTMLImageElement).src = defaultAvatar;
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
