import { useContext, useEffect, useState } from "react";
import { Wifi, Menu } from "lucide-react";
import { appContext } from "../../AppContext";
import { MDS } from "@minima-global/mds";
import { useRouterState } from "@tanstack/react-router";

const defaultAvatar =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
      <circle cx='24' cy='24' r='24' fill='#ccc'/>
      <text x='50%' y='55%' text-anchor='middle' font-size='20' fill='white' dy='.3em'>?</text>
     </svg>`
  );

interface MyContact {
  id: number;
  myaddress: string;
  currentaddress: string;
  extradata?: {
    name?: string;
    icon?: string;
    minimaaddress?: string;
  };
}

interface HeaderProps {
  onToggleMenu: () => void;
}

// Array mínim de rutes i labels del menú
const menuLabels = [
  { to: "/", label: "Home" },
  { to: "/contacts", label: "Contacts" },
  { to: "/settings", label: "Settings" },
  { to: "/info", label: "Info" },
];

export default function Header({ onToggleMenu }: HeaderProps) {
  const { loaded } = useContext(appContext);
  const [userAvatar, setUserAvatar] = useState<string>(defaultAvatar);

  const router = useRouterState();
  const currentPath = router.location.pathname;

  const currentItem = menuLabels.find(item => item.to === currentPath);
  const pageTitle = currentItem?.label || "Welcome";

  useEffect(() => {
    if (!loaded) return;
    let isMounted = true;

    const fetchUser = async () => {
      try {
        const res = await MDS.cmd.maxcontacts();
        const contactsArray: MyContact[] =
          (res.response as any)?.contacts ?? [];
        const me = contactsArray.find((c) => !!c.myaddress);
        if (me && isMounted) {
          const icon = me.extradata?.icon;
          setUserAvatar(icon ? decodeURIComponent(icon) : defaultAvatar);
        }
      } catch (err) {
        console.error("Error fetching user info:", err);
      }
    };
    fetchUser();
    return () => { isMounted = false; };
  }, [loaded]);

  return (
    <header className="w-full shadow-lg z-40">
      {/* Header principal */}
      <div className="flex justify-between items-center bg-blue-600 text-white px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMenu}
            className="p-2 rounded hover:bg-blue-500 transition md:hidden"
          >
            <Menu size={24} />
          </button>

          <div className="text-3xl select-none">💖</div>
          <h1 className="text-lg font-semibold tracking-wide">CharmChain</h1>
        </div>

        <div className="flex items-center gap-4">
          <Wifi size={20} className="text-green-400" />
          <img
            src={userAvatar}
            alt="User avatar"
            className="w-8 h-8 rounded-full border border-gray-300 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = defaultAvatar; }}
          />
        </div>
      </div>

      {/* Subheader */}
      <div className="bg-blue-100 text-blue-900 px-6 py-1 shadow-inner w-full">
        <h2 className="text-lg font-medium text-right">{pageTitle}</h2>
      </div>
    </header>
  );
}
