// src/components/chat/ChatList.tsx

import { useContext, useEffect, useState } from "react";
import { appContext } from "../../AppContext";
import { minimaService } from "../../services/minima.service";
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

interface ChatItem {
    publickey: string;
    roomname: string;
    lastMessage: string;
    lastMessageType: string;
    lastMessageDate: number;
    lastMessageAmount: number;
    username: string;
}

export default function ChatList() {
    const { loaded } = useContext(appContext);
    const [chats, setChats] = useState<ChatItem[]>([]);
    const [contacts, setContacts] = useState<Map<string, Contact>>(new Map());
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!loaded) return;

        let isMounted = true;

        const fetchData = async () => {
            try {
                // Fetch contacts first
                const contactsRes: any = await MDS.cmd.maxcontacts();
                const contactsList: Contact[] = contactsRes?.response?.contacts || [];

                // Create a map for quick lookup
                const contactsMap = new Map<string, Contact>();
                contactsList.forEach((contact) => {
                    if (contact.publickey) {
                        contactsMap.set(contact.publickey, contact);
                    }
                });

                // Fetch recent chats
                const chatsList = await minimaService.getRecentChats();

                if (isMounted) {
                    setContacts(contactsMap);
                    setChats(chatsList);
                }
            } catch (err: any) {
                console.error("🚨 Error fetching chats:", err);
                if (isMounted) setError(err.message || "Unknown error");
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        // Listen for new messages to refresh the chat list
        const handleNewMessage = () => {
            minimaService.getRecentChats().then((chatsList) => {
                if (isMounted) setChats(chatsList);
            });
        };

        minimaService.onNewMessage(handleNewMessage);

        return () => {
            isMounted = false;
            minimaService.removeNewMessageCallback(handleNewMessage);
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

    const getAvatar = (publickey: string) => {
        const contact = contacts.get(publickey);
        if (contact?.extradata?.icon) {
            try {
                const decoded = decodeURIComponent(contact.extradata.icon);
                if (decoded.startsWith("data:image")) return decoded;
            } catch (err) {
                console.warn("⚠️ Error decoding avatar:", err);
            }
        }
        return defaultAvatar;
    };

    const getName = (chat: ChatItem) => {
        const contact = contacts.get(chat.publickey);
        return contact?.extradata?.name || chat.roomname || "Unknown";
    };

    const getLastMessagePreview = (chat: ChatItem) => {
        if (chat.lastMessageType === "charm") {
            return `✨ Charm sent`;
        }
        try {
            const decoded = decodeURIComponent(chat.lastMessage);
            return decoded.length > 50 ? decoded.slice(0, 50) + "..." : decoded;
        } catch {
            return chat.lastMessage;
        }
    };

    const formatTime = (timestamp: number | string) => {
        if (!timestamp) return "";

        // Ensure timestamp is a number
        const timeNum = Number(timestamp);
        if (isNaN(timeNum)) return "";

        const date = new Date(timeNum);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        // Check if yesterday
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return "Yesterday";
        }

        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* App Bar / Header */}


            {/* Chat List */}
            <div className="flex-1 overflow-y-auto p-3">
                {chats.length > 0 ? (
                    <div className="space-y-2">
                        {chats.map((chat, i) => (
                            <div
                                key={i}
                                onClick={() =>
                                    navigate({
                                        to: "/chat/$address",
                                        params: {
                                            address: chat.publickey,
                                        },
                                    })
                                }
                                className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md cursor-pointer transition-shadow active:bg-gray-50"
                            >
                                <div className="flex items-center gap-3">
                                    {/* Avatar */}
                                    <img
                                        src={getAvatar(chat.publickey)}
                                        alt={getName(chat)}
                                        className="w-12 h-12 rounded-full object-cover bg-gray-200 flex-shrink-0"
                                        onError={(e: any) => {
                                            e.target.src = defaultAvatar;
                                        }}
                                    />

                                    {/* Chat Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <h3 className="font-semibold text-gray-900 truncate">
                                                {getName(chat)}
                                            </h3>
                                            <span className="text-xs text-gray-500 flex-shrink-0">
                                                {formatTime(chat.lastMessageDate)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 truncate mt-0.5">
                                            {chat.username === "Me" && (
                                                <span className="text-[#0088cc] mr-1">You:</span>
                                            )}
                                            {getLastMessagePreview(chat)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
                        <div className="bg-blue-50 p-4 rounded-full mb-4">
                            <svg className="w-12 h-12 text-[#0088cc]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No chats yet</h3>
                        <p className="text-sm mb-6">Start a new conversation to see it here.</p>
                        <button
                            onClick={() => navigate({ to: "/contacts" })}
                            className="px-6 py-2 bg-[#0088cc] text-white rounded-full font-medium hover:bg-[#0077b5] transition-colors shadow-sm"
                        >
                            Start Messaging
                        </button>
                    </div>
                )}
            </div>

            {/* Floating Action Button (FAB) for New Chat - Telegram style */}
            <div className="fixed bottom-6 right-6">
                <button
                    onClick={() => navigate({ to: "/contacts" })}
                    className="w-14 h-14 bg-[#0088cc] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-[#0077b5] transition-transform hover:scale-105 active:scale-95"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </button>
            </div>
        </div >
    );
}
