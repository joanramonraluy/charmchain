import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MDS } from "@minima-global/mds";
import { ArrowLeft, Copy, Check, Shield, Trash2, RefreshCw } from "lucide-react";
import { minimaService } from "../services/minima.service";

export const Route = createFileRoute("/contact-info/$address")({
    component: ContactInfoPage,
});

interface Contact {
    currentaddress: string;
    publickey: string;
    extradata?: {
        minimaaddress?: string;
        name?: string;
        icon?: string;
        description?: string;
    };
    myaddress?: string;
    samechain?: boolean;
    lastseen?: number;
}

function ContactInfoPage() {
    const { address } = Route.useParams();
    const navigate = useNavigate();
    const [contact, setContact] = useState<Contact | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [appStatus, setAppStatus] = useState<'unknown' | 'checking' | 'installed' | 'not_found'>('unknown');

    const defaultAvatar =
        "data:image/svg+xml;base64," +
        btoa(
            `< svg xmlns = 'http://www.w3.org/2000/svg' width = '48' height = '48' >
        <rect width='48' height='48' fill='#e0e0e0'/>
        <text x='50%' y='55%' text-anchor='middle' font-size='24' fill='#ffffff' dy='.3em' font-family='sans-serif'>?</text>
      </svg > `
        );

    const getAvatar = (c: Contact | null) => {
        if (!c) return defaultAvatar;
        if (c.extradata?.icon) {
            try {
                const decoded = decodeURIComponent(c.extradata.icon);
                // Check if it's a valid data URL, and not a URL ending in /0x00 (no photo)
                if (decoded.startsWith("data:image") && !decoded.includes("/0x00")) {
                    return decoded;
                }
            } catch (err) {
                console.warn("[Avatar] Error decoding icon:", err);
            }
        }
        return defaultAvatar;
    };

    useEffect(() => {
        const fetchContact = async () => {
            try {
                const res = await MDS.cmd.maxcontacts();
                const list: Contact[] = (res as any)?.response?.contacts || [];
                const c = list.find(
                    (x) =>
                        x.publickey === address ||
                        x.currentaddress === address ||
                        x.extradata?.minimaaddress === address
                );
                console.log("[ContactInfo] Contact found:", c);
                console.log("[ContactInfo] samechain value:", c?.samechain);
                setContact(c || null);
            } catch (err) {
                console.error("[Contact] Error loading contact:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchContact();
    }, [address]);

    // Check app status when contact is loaded
    useEffect(() => {
        if (!contact?.publickey) return;

        const checkAppStatus = () => {
            console.log("🔄 [ContactInfo] Checking app status...");
            setAppStatus('checking');
            minimaService.sendPing(contact.publickey).catch(console.error);

            // Timeout for check
            setTimeout(() => {
                setAppStatus((prev) => prev === 'checking' ? 'not_found' : prev);
            }, 5000);
        };

        const handleNewMessage = (payload: any) => {
            if (payload.type === 'pong') {
                console.log("✅ [ContactInfo] Pong received - app is installed");
                setAppStatus('installed');
                minimaService.setAppInstalled(contact.publickey);
            }
        };

        // Initial check
        checkAppStatus();

        // Listen for pong responses
        minimaService.onNewMessage(handleNewMessage);

        return () => {
            minimaService.removeNewMessageCallback(handleNewMessage);
        };
    }, [contact]);

    const copyToClipboard = (text: string, fieldId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!contact) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <p className="text-gray-500 mb-4">Contact not found</p>
                <button
                    onClick={() => navigate({ to: "/contacts" })}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg"
                >
                    Go to Contacts
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white px-4 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-10">
                <button
                    onClick={() => navigate({ to: `/chat/${address}` })}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold text-gray-800">Contact Info</h1>
            </div>

            <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">

                {/* Profile Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="h-32 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                    <div className="px-6 pb-6 relative">
                        <div className="absolute -top-16 left-6">
                            <img
                                src={getAvatar(contact)}
                                alt="Avatar"
                                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md bg-white"
                            />
                        </div>
                        <div className="pt-20">
                            <h2 className="text-2xl font-bold text-gray-900">{contact.extradata?.name || "Unknown"}</h2>
                            <p className="text-gray-500 text-sm mt-1">Minima User</p>
                        </div>
                    </div>

                    {/* Network Status - Now shows App Status */}
                    <div className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-500">CharmChain Status</span>
                            {appStatus === 'not_found' && (
                                <button
                                    onClick={() => {
                                        setAppStatus('checking');
                                        if (contact?.publickey) {
                                            minimaService.sendPing(contact.publickey).catch(console.error);
                                            setTimeout(() => {
                                                setAppStatus((prev) => prev === 'checking' ? 'not_found' : prev);
                                            }, 5000);
                                        }
                                    }}
                                    className="text-blue-600 hover:text-blue-700 transition-colors p-1"
                                    title="Retry"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            {appStatus === 'installed' ? (
                                <div className="flex items-center gap-2 text-green-600">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-sm font-medium">CharmChain Verified</span>
                                </div>
                            ) : appStatus === 'checking' ? (
                                <div className="flex items-center gap-2 text-blue-600">
                                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent"></div>
                                    <span className="text-sm font-medium">Checking status...</span>
                                </div>
                            ) : appStatus === 'not_found' ? (
                                <div className="flex items-center gap-2 text-red-600">
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                    <span className="text-sm font-medium">App not detected</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                    <span className="text-sm font-medium">Unknown</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Last Seen */}
                    {contact.lastseen && (
                        <div className="p-4 hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-500">Last Seen</span>
                            </div>
                            <p className="text-sm text-gray-800">{new Date(contact.lastseen).toLocaleString()}</p>
                        </div>
                    )}
                </div>

                {/* About Section - Only show if description exists */}
                {contact.extradata?.description && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">About</h3>
                        </div>
                        <div className="p-4">
                            <p className="text-sm text-gray-700 leading-relaxed">
                                {contact.extradata.description}
                            </p>
                        </div>
                    </div>
                )}

                {/* Info Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Details</h3>
                    </div>

                    <div className="divide-y divide-gray-100">
                        {/* Public Key */}
                        <div className="p-4 hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-500">Public Key</span>
                                <button
                                    onClick={() => copyToClipboard(contact.publickey, 'pubkey')}
                                    className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-50 rounded"
                                    title="Copy"
                                >
                                    {copiedField === 'pubkey' ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                            <p className="text-sm font-mono text-gray-800 break-all">{contact.publickey}</p>
                        </div>

                        {/* Minima Address */}
                        {contact.extradata?.minimaaddress && (
                            <div className="p-4 hover:bg-gray-50 transition-colors group">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-500">Minima Address</span>
                                    <button
                                        onClick={() => copyToClipboard(contact.extradata?.minimaaddress || "", 'minima')}
                                        className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-50 rounded"
                                        title="Copy"
                                    >
                                        {copiedField === 'minima' ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                                <p className="text-sm font-mono text-gray-800 break-all">{contact.extradata.minimaaddress}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions Section (Placeholder) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Actions</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        <button className="w-full p-4 text-left flex items-center gap-3 text-red-600 hover:bg-red-50 transition-colors">
                            <Shield size={20} />
                            <span className="font-medium">Block User</span>
                        </button>
                        <button className="w-full p-4 text-left flex items-center gap-3 text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 size={20} />
                            <span className="font-medium">Delete Chat</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
