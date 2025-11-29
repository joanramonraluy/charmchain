import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { DiscoveryService, UserProfile } from '../services/discovery.service'
import { UserPlus, Search, Globe, X, RefreshCw } from 'lucide-react'
import { MDS } from '@minima-global/mds'

export const Route = createFileRoute('/discovery')({
    component: DiscoveryPage,
})

function DiscoveryPage() {
    const [profiles, setProfiles] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [myPubkey, setMyPubkey] = useState<string | null>(null)
    const [registering, setRegistering] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [username, setUsername] = useState('')
    const [description, setDescription] = useState('')
    const [previousCount, setPreviousCount] = useState(0)
    const [showNotification, setShowNotification] = useState(false)
    const [notificationMessage, setNotificationMessage] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [fetchedProfiles, keysRes] = await Promise.all([
                DiscoveryService.getProfiles(),
                new Promise<any>((resolve) => MDS.executeRaw('getaddress', resolve))
            ])

            setProfiles(fetchedProfiles)

            // Check if new profiles appeared
            if (previousCount > 0 && fetchedProfiles.length > previousCount) {
                const newCount = fetchedProfiles.length - previousCount
                setNotificationMessage(`🎉 ${newCount} new profile${newCount > 1 ? 's' : ''} found!`)
                setShowNotification(true)
                setTimeout(() => setShowNotification(false), 3000)
            }
            setPreviousCount(fetchedProfiles.length)

            if (keysRes.status && keysRes.response?.publickey) {
                setMyPubkey(keysRes.response.publickey)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async () => {
        if (!username.trim()) {
            alert("Please enter a username")
            return
        }

        setRegistering(true)
        try {
            await DiscoveryService.registerProfile(username.trim(), description.trim())
            alert("Profile registered successfully! ⛏️\n\nYour profile will appear in the list once the transaction is mined (usually 1-3 minutes). Click the refresh button to check.")
            setShowModal(false)
            setUsername('')
            setDescription('')
        } catch (e) {
            console.error("Registration error:", e)
            alert("Error registering: " + e)
        } finally {
            setRegistering(false)
        }
    }

    const isRegistered = profiles.some(p => p.pubkey === myPubkey)

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Globe className="text-blue-600" />
                            Community Discovery
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Find and connect with other CharmChain users</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                        title="Refresh profiles"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>

                    {!isRegistered && (
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <UserPlus size={18} />
                            <span className="hidden sm:inline">Join Community</span>
                            <span className="sm:hidden">Join</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : profiles.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="text-blue-400" size={32} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No profiles found</h3>
                        <p className="text-gray-500 mt-2">Be the first to join the community!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                        {profiles.map((profile) => (
                            <div key={profile.pubkey} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                                            {profile.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{profile.username}</h3>
                                            <p className="text-xs text-gray-400 font-mono truncate w-32" title={profile.pubkey}>
                                                {profile.pubkey.substring(0, 10)}...
                                            </p>
                                        </div>
                                    </div>
                                    {profile.pubkey !== myPubkey && (
                                        <button className="text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors" title="Add Contact">
                                            <UserPlus size={20} />
                                        </button>
                                    )}
                                </div>

                                {profile.description && (
                                    <p className="mt-4 text-gray-600 text-sm line-clamp-2">
                                        {profile.description}
                                    </p>
                                )}

                                <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                                    <span>Joined: {new Date(Number(profile.lastSeen) * 1000).toLocaleDateString()}</span>
                                    {profile.pubkey === myPubkey && (
                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">You</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Registration Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white">Join the Community</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Username *
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    Description (optional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Tell others about yourself"
                                    rows={3}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder-gray-400"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRegister}
                                    disabled={registering || !username.trim()}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {registering ? 'Registering...' : 'Register'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {showNotification && (
                <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-up z-50">
                    <span>{notificationMessage}</span>
                </div>
            )}
        </div>
    )
}
