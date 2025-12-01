import { MDS } from '@minima-global/mds';
import { maximaDiscoveryService } from './maxima-discovery.service';

// The Registry Script: Simple ownership check.
// Only the owner (defined by Public Key in STATE(2)) can spend/update the profile.
export const REGISTRY_SCRIPT = 'RETURN SIGNEDBY(STATE(2))';

// We need a fixed address for the registry. 
// In a real deployment, we would calculate this once and hardcode it to ensure everyone uses the same one.
// For this implementation, we will dynamically derive it or use a known constant if possible.
// However, since 'newaddress' might track it in the wallet, we should be careful.
// A "clean" address that is just the hash of the script is what we want.
// For now, we will use a helper to get/ensure the address exists.

export interface UserProfile {
    username: string;
    pubkey: string;
    description: string;
    timestamp: number; // Unix timestamp from STATE[4]
    lastSeen: number; // Block creation time
    isMyProfile: boolean;
    coinid?: string; // UTXO reference
}

// Cache the registry address to avoid calling newscript multiple times
let cachedRegistryAddress: string | null = null;

// Marker for profile coins - versioned for future upgrades
const PROFILE_MARKER = 'CHARM_PROFILE_V1';

export const DiscoveryService = {
    utf8ToHex: (s: string): string => {
        const encoder = new TextEncoder();
        let r = "";
        for (const b of encoder.encode(s)) r += ("0" + b.toString(16)).slice(-2);
        return "0x" + r;
    },

    hexToUtf8: (s: string): string => {
        if (!s) return "";
        // Remove 0x if present
        const hex = s.startsWith("0x") ? s.substring(2) : s;
        try {
            return decodeURIComponent(
                hex.replace(/\s+/g, "").replace(/[0-9A-F]{2}/g, "%$&")
            );
        } catch (e) {
            return s; // Return original if decode fails
        }
    },

    // Get the Registry Address (and ensure it's tracked/imported if needed? 
    // Actually for a public registry we might just need the address string to search coins).
    getRegistryAddress: async (): Promise<string> => {
        // Return cached address if available
        if (cachedRegistryAddress) {
            return cachedRegistryAddress;
        }

        return new Promise((resolve, reject) => {
            const cmd = `newscript script:"${REGISTRY_SCRIPT}" trackall:true`;

            MDS.executeRaw(cmd, (res: any) => {
                if (res.status && res.response?.miniaddress) {
                    cachedRegistryAddress = res.response.miniaddress;
                    resolve(res.response.miniaddress);
                } else {
                    reject(res.error || "No address in response");
                }
            });
        });
    },

    registerProfile: async (username: string, description: string) => {
        const address = await DiscoveryService.getRegistryAddress();

        // Get our public key using getaddress
        const pubkey = await new Promise<string>((resolve, reject) => {
            MDS.executeRaw('getaddress', (res: any) => {
                if (res.status && res.response?.publickey) {
                    resolve(res.response.publickey);
                } else {
                    reject('No public key found');
                }
            });
        });

        if (!pubkey || pubkey === 'undefined') {
            throw new Error("Invalid public key: " + pubkey);
        }

        // Encode data to HEX
        const markerHex = DiscoveryService.utf8ToHex(PROFILE_MARKER);
        const usernameHex = DiscoveryService.utf8ToHex(username);
        const descriptionHex = DiscoveryService.utf8ToHex(description);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const timestampHex = DiscoveryService.utf8ToHex(timestamp);

        // Pubkey is already HEX (0x...)

        // Send transaction
        // STATE(0) = "CHARM_PROFILE_V1" (Marker)
        // STATE(1) = Username
        // STATE(2) = Public Key (Ownership)
        // STATE(3) = Description
        // STATE(4) = Timestamp (unix seconds)
        const cmd = `send amount:0.01 address:${address} state:{"0":"${markerHex}","1":"${usernameHex}","2":"${pubkey}","3":"${descriptionHex}","4":"${timestampHex}"}`;

        // Send blockchain transaction
        await new Promise((resolve, reject) => {
            MDS.executeRaw(cmd, (res: any) => {
                // Accept both status:true OR pending:true as success
                if (res.status || res.pending) {
                    resolve(res.response);
                } else {
                    reject(res.error || "Registration failed");
                }
            });
        });

        // Broadcast via Maxima for instant cross-node discovery
        try {
            await maximaDiscoveryService.broadcastProfile({
                username,
                pubkey,
                description,
                timestamp: parseInt(timestamp)
            });
        } catch (e) {
            // Maxima broadcast failed, but blockchain transaction succeeded
            // This is not critical, so we don't reject
            console.warn('Maxima broadcast failed:', e);
        }
    },

    // Helper function to deduplicate profiles by username (keep newest)
    deduplicateByUsername: (profiles: UserProfile[]): UserProfile[] => {
        // Sort by timestamp desc (newest first)
        profiles.sort((a, b) => b.timestamp - a.timestamp);

        // Keep only first (newest) per username
        const seen = new Map<string, UserProfile>();
        for (const p of profiles) {
            const key = p.username.toLowerCase();
            if (!seen.has(key)) {
                seen.set(key, p);
            }
        }

        return Array.from(seen.values());
    },

    getProfiles: async (): Promise<UserProfile[]> => {
        const address = await DiscoveryService.getRegistryAddress();
        if (!address) {
            return [];
        }

        const markerHex = DiscoveryService.utf8ToHex(PROFILE_MARKER);

        // Get our coin IDs to determine ownership
        const myCoins = await new Promise<any[]>((resolve) => {
            MDS.executeRaw('coins', (res: any) => {
                if (res.status) {
                    const coins = res.response || [];
                    resolve(coins.filter((c: any) =>
                        c.miniaddress === address || c.address === address
                    ));
                } else {
                    resolve([]);
                }
            });
        });

        const myCoinIds = new Set(myCoins.map((c: any) => c.coinid));

        // Fetch current UTXOs at registry
        const currentProfiles = await new Promise<UserProfile[]>((resolve) => {
            const coinsCmd = `coins address:${address}`;

            MDS.executeRaw(coinsCmd, (res: any) => {
                if (!res.status) {
                    resolve([]);
                    return;
                }

                const coins = res.response || [];
                const profiles = coins
                    .filter((c: any) => {
                        const state0 = c.state?.find((s: any) => s.port === 0);
                        return state0?.data?.toUpperCase() === markerHex.toUpperCase();
                    })
                    .map((c: any) => {
                        const state1 = c.state.find((s: any) => s.port === 1);
                        const state2 = c.state.find((s: any) => s.port === 2);
                        const state3 = c.state.find((s: any) => s.port === 3);
                        const state4 = c.state.find((s: any) => s.port === 4);

                        const timestampStr = state4 ? DiscoveryService.hexToUtf8(state4.data) : '0';
                        const timestamp = parseInt(timestampStr) || 0;

                        return {
                            username: state1 ? DiscoveryService.hexToUtf8(state1.data) : 'Unknown',
                            pubkey: state2?.data || '',
                            description: state3 ? DiscoveryService.hexToUtf8(state3.data) : '',
                            timestamp,
                            lastSeen: c.created || 0,
                            isMyProfile: myCoinIds.has(c.coinid),
                            coinid: c.coinid
                        };
                    });

                resolve(profiles);
            });
        });

        // Deduplicate by username (keep newest)
        const uniqueProfiles = DiscoveryService.deduplicateByUsername(currentProfiles);

        return uniqueProfiles;
    }
};
