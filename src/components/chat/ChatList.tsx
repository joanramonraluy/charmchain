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
                console.log("✅ MDS loaded, fetching chats and contacts...");

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

                console.log("📇 Chats found:", chatsList);
                console.log("📇 Contacts map:", contactsMap);

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

    if (!loaded) return <p>⏳ Esperant Minima...</p>;
    if (loading) return <p>🔄 Carregant xats...</p>;
    if (error) return <p>⚠️ Error: {error}</p>;

    const defaultAvatar =
        "data:image/svg+xml;base64," +
        btoa(
            `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'>
        <circle cx='24' cy='24' r='24' fill='#ccc'/>
        <text x='50%' y='55%' text-anchor='middle' font-size='20' fill='white' dy='.3em'>?</text>
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
        return contact?.extradata?.name || chat.roomname || "(Sense nom)";
    };

    const truncateAddress = (addr?: string) => {
        if (!addr) return "(No address)";
        if (addr.length <= 12) return addr;
        return `${addr.slice(0, 7)}...${addr.slice(-5)}`;
    };

    const getLastMessagePreview = (chat: ChatItem) => {
        if (chat.lastMessageType === "charm") {
            return `✨ Charm (${chat.lastMessageAmount} Minima)`;
        }
        try {
            const decoded = decodeURIComponent(chat.lastMessage);
            return decoded.length > 40 ? decoded.slice(0, 40) + "..." : decoded;
        } catch {
            return chat.lastMessage.length > 40 ? chat.lastMessage.slice(0, 40) + "..." : chat.lastMessage;
        }
    };

    const timeAgo = (timestamp: number) => {
        if (!timestamp) return "Desconegut";
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "ara mateix";
        if (mins < 60) return `fa ${mins} min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `fa ${hours} h`;
        const days = Math.floor(hours / 24);
        return `fa ${days} dies`;
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Els meus Xats</h1>
            {chats.length > 0 ? (
                <ul style={{ listStyle: "none", padding: 0 }}>
                    {chats.map((chat, i) => (
                        <li
                            key={i}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: "0.8rem",
                                backgroundColor: "#f8f8f8",
                                padding: "0.6rem 1rem",
                                borderRadius: "12px",
                                border: "1px solid #ddd",
                                cursor: "pointer",
                            }}
                            onClick={() =>
                                navigate({
                                    to: "/chat/$address",
                                    params: {
                                        address: chat.publickey,
                                    },
                                })
                            }
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", flex: 1 }}>
                                <img
                                    src={getAvatar(chat.publickey)}
                                    alt={getName(chat)}
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        border: "1px solid #ddd",
                                    }}
                                    onError={(e: any) => {
                                        e.target.src = defaultAvatar;
                                    }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <strong>{getName(chat)}</strong>
                                    <br />
                                    <small style={{ color: "#555" }}>
                                        {truncateAddress(chat.publickey)}
                                    </small>
                                    <br />
                                    <small style={{ color: "#777", fontStyle: "italic" }}>
                                        {getLastMessagePreview(chat)}
                                    </small>
                                </div>
                            </div>

                            <div style={{ textAlign: "right", marginLeft: "1rem" }}>
                                <small style={{ color: "#999", fontSize: "0.75rem" }}>
                                    {timeAgo(chat.lastMessageDate)}
                                </small>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>📭 No hi ha xats disponibles. Comença una conversa des de Contactes!</p>
            )}
        </div>
    );
}
