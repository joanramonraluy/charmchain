import { MDS } from '@minima-global/mds';

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
    lastSeen: number;
}

// Cache the registry address to avoid calling newscript multiple times
let cachedRegistryAddress: string | null = null;

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
            // Build the command string manually with proper quoting
            const cmd = `newscript script:"${REGISTRY_SCRIPT}" trackall:true`;
            console.log("Discovery Registry Command:", cmd);

            MDS.executeRaw(cmd, (res: any) => {
                if (res.status && res.response?.miniaddress) {
                    cachedRegistryAddress = res.response.miniaddress;
                    resolve(res.response.miniaddress);
                } else {
                    console.error("Failed to get registry address:", res);
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
        const markerHex = DiscoveryService.utf8ToHex("CHARM_PROFILE");
        const usernameHex = DiscoveryService.utf8ToHex(username);
        const descriptionHex = DiscoveryService.utf8ToHex(description);

        // Pubkey is already HEX (0x...)

        // Send transaction
        // STATE(0) = "CHARM_PROFILE" (Marker)
        // STATE(1) = Username
        // STATE(2) = Public Key (Ownership)
        // STATE(3) = Description/Extra Data
        const cmd = `send amount:0.01 address:${address} state:{"0":"${markerHex}","1":"${usernameHex}","2":"${pubkey}","3":"${descriptionHex}"}`;

        console.log("Discovery Registration Command:", cmd);

        return new Promise((resolve, reject) => {
            MDS.executeRaw(cmd, (res: any) => {
                console.log("Discovery Registration Response:", res);
                console.log("Response status:", res.status);
                console.log("Response error:", res.error);
                console.log("Response response:", res.response);

                if (res.status) {
                    resolve(res.response);
                } else {
                    console.error("Discovery Registration Failed:", res);
                    reject(res.error || "Registration failed");
                }
            });
        });
    },

    getProfiles: async (): Promise<UserProfile[]> => {
        const address = await DiscoveryService.getRegistryAddress();
        if (!address) {
            console.error("No registry address found");
            return [];
        }

        console.log("Fetching profiles from address:", address);
        const markerHex = DiscoveryService.utf8ToHex("CHARM_PROFILE");
        console.log("Looking for marker:", markerHex);

        return new Promise((resolve, reject) => {
            // We search for coins at the registry address
            // Since we used 'trackall:true' in newscript, we should see them.
            const coinsCmd = `coins address:${address}`;
            console.log("Executing coins command:", coinsCmd);

            MDS.executeRaw(coinsCmd, (res: any) => {
                console.log("Coins command response:", res);
                console.log("Coins status:", res.status);
                console.log("Coins error:", res.error);

                if (res.status) {
                    const coins = res.response;
                    console.log("Coins found:", coins);
                    console.log("Number of coins:", coins?.length || 0);

                    if (coins && coins.length > 0) {
                        console.log("First coin state:", coins[0].state);
                    }

                    const profiles: UserProfile[] = coins
                        .filter((c: any) => {
                            const state0 = c.state.find((s: any) => s.port === 0);
                            const state0Data = state0?.data?.toUpperCase() || '';
                            const markerUpper = markerHex.toUpperCase();
                            console.log("Checking coin state0:", state0Data, "vs marker:", markerUpper);
                            return state0 && state0Data === markerUpper;
                        })
                        .map((c: any) => {
                            const state1 = c.state.find((s: any) => s.port === 1);
                            const state2 = c.state.find((s: any) => s.port === 2);
                            const state3 = c.state.find((s: any) => s.port === 3);

                            return {
                                username: state1 ? DiscoveryService.hexToUtf8(state1.data) : 'Unknown',
                                pubkey: state2 ? state2.data : '',
                                description: state3 ? DiscoveryService.hexToUtf8(state3.data) : '',
                                lastSeen: c.created // Block time/creation time
                            };
                        });

                    console.log("Filtered profiles:", profiles);
                    // Deduplicate by PubKey (show latest?)
                    // For now just return all
                    resolve(profiles);
                } else {
                    console.error("Discovery Coins Failed:", res);
                    reject(res.error);
                }
            });
        });
    }
};
