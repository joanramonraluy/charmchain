import { useContext, useEffect, useState } from "react";
import { Wifi, Menu } from "lucide-react";
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

export default function Header({ onToggleMenu }: { onToggleMenu: () => void }) {
  const { loaded } = useContext(appContext);

  const [userAvatar, setUserAvatar] = useState<string>(defaultAvatar);

  useEffect(() => {
    if (!loaded) return;

    let isMounted = true;

    const fetchUser = async () => {
      try {
        const res = await MDS.cmd.maxcontacts();
        console.log("Full MDS response:", res);

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

    return () => {
      isMounted = false;
    };
  }, [loaded]);

  return (
    <header className="fixed top-0 left-0 right-0 bg-blue-600 text-white flex justify-between items-center px-6 py-3 shadow-lg z-40">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMenu}
          className="p-2 rounded hover:bg-blue-500 transition md:hidden"
        >
          <Menu size={24} />
        </button>

        {/* CharmChain Image */}
        <div className="text-3xl select-none">💖</div>

        <h1 className="text-lg font-semibold tracking-wide">CharmChain</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Wifi size={20} className="text-green-400" />
        </div>

        <img
          src={userAvatar}
          alt="User avatar"
          className="w-8 h-8 rounded-full border border-gray-300 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = defaultAvatar;
          }}
        />
      </div>
    </header>
  );
}
