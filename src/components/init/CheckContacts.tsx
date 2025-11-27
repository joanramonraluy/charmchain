// src/components/init/CheckContacts.tsx

import { useContext, useEffect, useState } from "react";
import { appContext } from "../../AppContext";
import { MDS } from "@minima-global/mds";
import { useNavigate } from "@tanstack/react-router";

interface Contact {
  currentaddress: string;
  publickey?: string;
  extradata?: {
    minimaaddress?: string;
    name?: string;
    icon?: string;
  };
  samechain?: boolean;
  lastseen?: number;
}

export default function CheckContacts() {
  const { loaded } = useContext(appContext);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loaded) return;

    let isMounted = true;

    const fetchContacts = async () => {
      try {
        const res: any = await MDS.cmd.maxcontacts();
        let list: Contact[] = [];

        if (res?.response?.contacts && Array.isArray(res.response.contacts)) {
          list = res.response.contacts;
        } else if (res?.response && Array.isArray(res.response)) {
          list = res.response;
        } else if (res?.response?.response && Array.isArray(res.response.response)) {
          list = res.response.response;
        } else if (Array.isArray(res)) {
          list = res;
        }

        if (isMounted) setContacts(list);
      } catch (err: any) {
        console.error("🚨 Error fetching contacts:", err);
        if (isMounted) setError(err.message || "Unknown error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchContacts();

    return () => {
      isMounted = false;
    };
  }, [loaded]);

  if (!loaded || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-red-500">⚠️ {error}</p>
      </div>
    );
  }

  const defaultAvatar =
    "data:image/svg+xml;base64," +
    btoa(
      `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
        <rect width='48' height='48' fill='#e0e0e0'/>
        <text x='50%' y='55%' text-anchor='middle' font-size='24' fill='#ffffff' dy='.3em' font-family='sans-serif'>?</text>
      </svg>`
    );

  const getAvatar = (contact: Contact) => {
    if (contact.extradata?.icon) {
      try {
        const decoded = decodeURIComponent(contact.extradata.icon);
        if (decoded.startsWith("data:image")) return decoded;
      } catch (err) {
        console.warn("⚠️ Error decoding avatar:", err);
      }
    }
    return defaultAvatar;
  };

  const timeAgo = (timestamp?: number | string) => {
    if (!timestamp) return "Unknown";
    const timeNum = Number(timestamp);
    if (isNaN(timeNum)) return "Unknown";

    const diff = Date.now() - timeNum;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "online";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">


      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto p-3">
        {contacts.length > 0 ? (
          <div className="space-y-2">
            {contacts.map((c, i) => (
              <div
                key={i}
                onClick={() =>
                  navigate({
                    to: "/chat/$address",
                    params: {
                      address: c.publickey || c.currentaddress || c.extradata?.minimaaddress || "",
                    },
                  })
                }
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md cursor-pointer transition-shadow active:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={getAvatar(c)}
                      alt={c.extradata?.name || "Unknown"}
                      className="w-12 h-12 rounded-full object-cover bg-gray-200"
                      onError={(e: any) => {
                        e.target.src = defaultAvatar;
                      }}
                    />
                    {c.samechain && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {c.extradata?.name || "Unknown"}
                      </h3>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {timeAgo(c.lastseen)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {c.publickey?.slice(0, 16)}...
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No contacts found</h3>
            <p className="text-sm">Add contacts in Maxima to see them here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
