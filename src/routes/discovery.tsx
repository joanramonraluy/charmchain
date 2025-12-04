import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { DiscoveryService, UserProfile } from '../services/discovery.service'
import { maximaDiscoveryService } from '../services/maxima-discovery.service'
import { maximaCommunityProtocolService } from '../services/maxima-community-protocol.service'
import { UserPlus, Search, Globe, X, RefreshCw, Edit } from 'lucide-react'

export const Route = createFileRoute('/discovery')({
    component: DiscoveryPage,
})

function DiscoveryPage() {
    const navigate = useNavigate()
    const [profiles, setProfiles] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [pinging, setPinging] = useState(false)
    const [registering, setRegistering] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [username, setUsername] = useState('')
    const [previousCount, setPreviousCount] = useState(0)
    const [showNotification, setShowNotification] = useState(false)
    const [notificationMessage, setNotificationMessage] = useState('')
    const [totalFound, setTotalFound] = useState(0)
    const [onlineCount, setOnlineCount] = useState(0)
    const [hasPermanentAddress, setHasPermanentAddress] = useState(false)
    const [checkingMLS, setCheckingMLS] = useState(false)

    useEffect(() => {
        loadData()
        checkStaticMLSConfig() // Check MLS configuration on mount

        // Subscribe to Maxima profile broadcasts
        const unsubscribe = maximaDiscoveryService.subscribeToProfiles((newProfile) => {
            setProfiles(prev => {
                // Add new profile and deduplicate
                const updated = [...prev, newProfile];
                return DiscoveryService.deduplicateProfiles(updated);
            });

            // Show notification
            setNotificationMessage(`🎉 New profile discovered: ${newProfile.username}`);
            setShowNotification(true);
            setTimeout(() => setShowNotification(false), 3000);
        });

        return () => unsubscribe();
    }, [])

    const checkStaticMLSConfig = async () => {
        setCheckingMLS(true)
        try {
            const { MDS } = await import('@minima-global/mds')
            const maximaInfo = await MDS.cmd.maxima()
            const info = (maximaInfo.response as any) || {}

            console.log('🔍 [Discovery] Checking Static MLS configuration:', info)

            const hasStatic = info.staticmls || false

            if (hasStatic && info.mls) {
                // User has Static MLS configured
                setHasPermanentAddress(true)
                console.log('✅ [Discovery] Static MLS configured:', info.mls)
            } else {
                setHasPermanentAddress(false)
                console.log('⚠️ [Discovery] Static MLS NOT configured')
            }
        } catch (err) {
            console.error('❌ [Discovery] Error checking Static MLS:', err)
            setHasPermanentAddress(false)
        } finally {
            setCheckingMLS(false)
        }
    }

    const loadData = async () => {
        setLoading(true)
        setPinging(false)
        try {
            // 1. Fetch all profiles from blockchain (only visible ones)
            const fetchedProfiles = await DiscoveryService.getProfiles()
            setTotalFound(fetchedProfiles.length)
            console.log(`📡 [Discovery] Found ${fetchedProfiles.length} profiles on blockchain`)

            // 2. Ping all profiles to check availability
            setPinging(true)
            setLoading(false)

            const pingResults = await Promise.allSettled(
                fetchedProfiles.map(async (profile) => {
                    // If it's my profile, I'm always online!
                    if (profile.isMyProfile) {
                        console.log(`👤 [Discovery] Found my own profile (${profile.username}), marking online automatically`)
                        return { profile, online: true }
                    }

                    if (!profile.maxAddress) {
                        console.log(`⚠️ [Discovery] Profile ${profile.username} has no maxAddress`)
                        return { profile, online: false }
                    }

                    console.log(`Ping to ${profile.username}...`)
                    const isOnline = await maximaCommunityProtocolService.pingProfile(
                        profile.maxAddress,
                        3000 // 3 second timeout
                    )
                    console.log(`Ping result for ${profile.username}: ${isOnline}`)

                    return { profile, online: isOnline }
                })
            )

            // 3. Filter only online profiles
            const onlineProfiles = pingResults
                .filter(result => result.status === 'fulfilled' && result.value.online)
                .map(result => (result as PromiseFulfilledResult<{ profile: UserProfile, online: boolean }>).value.profile)

            console.log(`✅ [Discovery] ${onlineProfiles.length} of ${fetchedProfiles.length} profiles are online`)
            setOnlineCount(onlineProfiles.length)
            setProfiles(onlineProfiles)

            // Check if new profiles appeared
            if (previousCount > 0 && onlineProfiles.length > previousCount) {
                const newCount = onlineProfiles.length - previousCount
                setNotificationMessage(`🎉 ${newCount} new online profile${newCount > 1 ? 's' : ''} found!`)
                setShowNotification(true)
                setTimeout(() => setShowNotification(false), 3000)
            }
            setPreviousCount(onlineProfiles.length)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
            setPinging(false)
        }
    }

    const handleRegister = async () => {
        if (!username.trim()) {
            alert("Please enter a username")
            return
        }

        setRegistering(true)
        try {
            // registerProfile will validate Static MLS internally
            await DiscoveryService.registerProfile(username.trim(), '', true) // Empty description, visibility true
            alert(isRegistered
                ? "Profile updated successfully! 📝\n\nChanges will appear after the transaction is mined."
                : "Profile registered successfully! ⛏️\n\nYour profile will appear in the list once the transaction is mined (usually 1-3 minutes). Click the refresh button to check.")
            setShowModal(false)
            setUsername('')
            // Optional: reload data immediately to show pending? No, wait for mine.
        } catch (e) {
            console.error("Registration error:", e)
            alert("Error registering: " + e)
        } finally {
            setRegistering(false)
        }
    }

    const isRegistered = profiles.some(p => p.isMyProfile)

    const handleEdit = () => {
        // Find the most recent profile that is ours
        const myProfile = profiles.find(p => p.isMyProfile)
        if (myProfile) {
            setUsername(myProfile.username)
            setShowModal(true)
        }
    }

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

                    {!isRegistered ? (
                        <button
                            onClick={async () => {
                                // Re-check Static MLS configuration before opening modal
                                await checkStaticMLSConfig()

                                // Check after async completes (using callback)
                                const { MDS } = await import('@minima-global/mds')
                                const maximaInfo = await MDS.cmd.maxima()
                                const info = (maximaInfo.response as any) || {}

                                if (!info.staticmls) {
                                    alert('⚠️ Static MLS Not Configured\n\nYou need to configure a Static MLS server before joining the Community.\n\nPlease go to Settings > Community & Discovery to configure it first.')
                                    return
                                }

                                setShowModal(true)
                            }}
                            disabled={checkingMLS}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                        >
                            {checkingMLS ? (
                                <RefreshCw size={18} className="animate-spin" />
                            ) : (
                                <UserPlus size={18} />
                            )}
                            <span className="hidden sm:inline">{checkingMLS ? 'Checking...' : 'Join Community'}</span>
                            <span className="sm:hidden">{checkingMLS ? '...' : 'Join'}</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleEdit}
                            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <Edit size={18} />
                            <span className="hidden sm:inline">Edit Profile</span>
                            <span className="sm:hidden">Edit</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading profiles from blockchain...</p>
                        </div>
                    </div>
                ) : pinging ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-600 font-medium">Checking availability...</p>
                            <p className="text-gray-500 text-sm mt-2">Pinging {totalFound} profiles</p>
                        </div>
                    </div>
                ) : profiles.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="text-blue-400" size={32} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No online profiles found</h3>
                        <p className="text-gray-500 mt-2">
                            {totalFound > 0
                                ? `Found ${totalFound} profile${totalFound > 1 ? 's' : ''} but none are currently online`
                                : 'Be the first to join the community!'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                            <p className="text-sm text-gray-600">
                                Showing <span className="font-bold text-blue-600">{onlineCount}</span> of <span className="font-bold">{totalFound}</span> online now
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                            {profiles.map((profile) => (
                                <div
                                    key={profile.pubkey}
                                    onClick={() => {
                                        // Navigate to contact info page using pubkey (more reliable than maxAddress)
                                        navigate({ to: `/contact-info/${profile.pubkey}` })
                                    }}
                                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer"
                                >
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
                                    </div>

                                    {profile.description && (
                                        <p className="mt-4 text-gray-600 text-sm line-clamp-2">
                                            {profile.description}
                                        </p>
                                    )}

                                    <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                                        <span>Joined: {new Date(Number(profile.lastSeen) * 1000).toLocaleDateString()}</span>
                                        {profile.isMyProfile && (
                                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">You</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Registration Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white">
                                {isRegistered ? 'Edit Profile' : 'Join the Community'}
                            </h2>
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

                            {hasPermanentAddress ? (
                                <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-sm">
                                    <p className="text-green-200 font-medium mb-1">✅ Ready to Join!</p>
                                    <p className="text-green-300 text-xs">
                                        Your Static MLS is configured and you have a permanent MAX# address.
                                        Enter your username to register your profile on the blockchain.
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 text-sm">
                                    <p className="text-yellow-200 font-medium mb-1">⚠️ Requirements:</p>
                                    <p className="text-yellow-300 text-xs">
                                        You must have a <strong>Static MLS configured</strong> to join the Community.
                                        This ensures you have a permanent MAX# address for others to contact you.
                                        <br /><br />
                                        Please go to <strong>Settings → Community & Discovery</strong> to configure it first.
                                    </p>
                                </div>
                            )}

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
                                    {registering ? (isRegistered ? 'Updating...' : 'Registering...') : (isRegistered ? 'Update Profile' : 'Register')}
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
