import { MDS } from "@minima-global/mds";
import { minimaService } from "./minima.service";

export interface Group {
    group_id: string;
    name: string;
    creator_publickey: string;
    created_date: number;
    avatar?: string;
    description?: string;
}

export interface GroupMember {
    group_id: string;
    publickey: string;
    username: string;
    joined_date: number;
    role: string;
}

export interface GroupMessage {
    id?: number;
    group_id: string;
    sender_publickey: string;
    sender_username: string;
    type: string;
    message: string;
    filedata?: string;
    date: number;
    read?: number;
}

// MAXIMA message types for group communication
export interface GroupMaximaMessage {
    messageType:
    | "group_message"
    | "group_invite"
    | "group_member_added"
    | "group_member_removed"
    | "group_info_updated";
    groupId: string;
    groupName: string;
    senderPublickey: string;
    senderUsername: string;
    timestamp: number;

    // For group_message:
    message?: string;
    type?: "text" | "image" | "file";
    filedata?: string;

    // For group_invite:
    description?: string;
    members?: Array<{ publickey: string, username: string }>;

    // For group_member_added/removed:
    memberPublickey?: string;
    memberUsername?: string;

    // For group_info_updated:
    newName?: string;
    newDescription?: string;
}

type GroupMessageCallback = (msg: GroupMaximaMessage) => void;
type GroupUpdateCallback = () => void;

class GroupService {
    private groupMessageCallbacks: GroupMessageCallback[] = [];
    private groupUpdateCallbacks: GroupUpdateCallback[] = [];

    constructor() { }

    /* ----------------------------------------------------------------------------
      UTILITY FUNCTIONS
    ---------------------------------------------------------------------------- */
    private generateGroupId(): string {
        return `group_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    private runSQL(sql: string): Promise<any> {
        return new Promise((resolve, reject) => {
            MDS.sql(sql, (res: any) => {
                if (!res.status) {
                    reject(new Error(res.error || "SQL query failed"));
                } else {
                    resolve(res);
                }
            });
        });
    }

    /* ----------------------------------------------------------------------------
      GROUP MANAGEMENT
    ---------------------------------------------------------------------------- */
    async createGroup(
        name: string,
        description: string,
        memberPublicKeys: string[],
        myPublicKey: string,
        myUsername: string
    ): Promise<string> {
        const groupId = this.generateGroupId();
        const now = Date.now();

        try {
            // 1. Create group in database
            const createGroupSql = `
                INSERT INTO GROUPS (group_id, name, creator_publickey, created_date, description)
                VALUES ('${groupId}', '${name.replace(/'/g, "''")}', '${myPublicKey}', ${now}, '${description.replace(/'/g, "''")}')
            `;
            await this.runSQL(createGroupSql);
            console.log("✅ [GROUP] Group created:", groupId);

            // 2. Add creator as member
            const addCreatorSql = `
                INSERT INTO GROUP_MEMBERS (group_id, publickey, username, joined_date, role)
                VALUES ('${groupId}', '${myPublicKey}', '${myUsername.replace(/'/g, "''")}', ${now}, 'creator')
            `;
            await this.runSQL(addCreatorSql);

            // 3. Add other members to database
            for (const memberPubkey of memberPublicKeys) {
                // Get username from contacts
                const username = await this.getUsernameFromContact(memberPubkey);
                const addMemberSql = `
                    INSERT INTO GROUP_MEMBERS (group_id, publickey, username, joined_date, role)
                    VALUES ('${groupId}', '${memberPubkey}', '${username.replace(/'/g, "''")}', ${now}, 'member')
                `;
                await this.runSQL(addMemberSql);
            }

            // 4. Get all members for the invite message
            const members = await this.getGroupMembers(groupId);

            // 5. Send invitations via MAXIMA to all members
            for (const memberPubkey of memberPublicKeys) {
                try {
                    await this.sendGroupInvite(
                        groupId,
                        name,
                        description,
                        memberPubkey,
                        myPublicKey,
                        myUsername,
                        members
                    );
                } catch (err) {
                    console.error(`❌ [GROUP] Failed to send invite to ${memberPubkey}:`, err);
                    // Continue with other members even if one fails
                }
            }

            this.notifyGroupUpdate();
            return groupId;
        } catch (err) {
            console.error("❌ [GROUP] Failed to create group:", err);
            throw err;
        }
    }

    async getMyGroups(myPublicKey: string): Promise<Group[]> {
        try {
            const sql = `
                SELECT DISTINCT g.* 
                FROM GROUPS g
                INNER JOIN GROUP_MEMBERS gm ON g.group_id = gm.group_id
                WHERE gm.publickey = '${myPublicKey}'
                ORDER BY g.created_date DESC
            `;
            const res = await this.runSQL(sql);
            return res.rows || [];
        } catch (err) {
            console.error("❌ [GROUP] Failed to get groups:", err);
            return [];
        }
    }

    async getGroupInfo(groupId: string): Promise<Group | null> {
        try {
            const sql = `SELECT * FROM GROUPS WHERE group_id = '${groupId}'`;
            const res = await this.runSQL(sql);
            return res.rows && res.rows.length > 0 ? res.rows[0] : null;
        } catch (err) {
            console.error("❌ [GROUP] Failed to get group info:", err);
            return null;
        }
    }

    async deleteGroup(groupId: string): Promise<void> {
        try {
            // Verify group exists
            const group = await this.getGroupInfo(groupId);
            if (!group) {
                console.warn("Group not found, but proceeding with cleanup");
            }

            // Delete messages
            await this.runSQL(`DELETE FROM GROUP_MESSAGES WHERE group_id = '${groupId}'`);
            // Delete members
            await this.runSQL(`DELETE FROM GROUP_MEMBERS WHERE group_id = '${groupId}'`);
            // Delete group
            await this.runSQL(`DELETE FROM GROUPS WHERE group_id = '${groupId}'`);

            console.log("✅ [GROUP] Group deleted:", groupId);
            this.notifyGroupUpdate();
        } catch (err) {
            console.error("❌ [GROUP] Failed to delete group:", err);
            throw err;
        }
    }

    /* ----------------------------------------------------------------------------
      MEMBER MANAGEMENT
    ---------------------------------------------------------------------------- */
    async addMember(
        groupId: string,
        publickey: string,
        username: string,
        myPublicKey: string,
        myUsername: string
    ): Promise<void> {
        try {
            const now = Date.now();

            // Add to database
            const sql = `
                INSERT INTO GROUP_MEMBERS (group_id, publickey, username, joined_date, role)
                VALUES ('${groupId}', '${publickey}', '${username.replace(/'/g, "''")}', ${now}, 'member')
            `;
            await this.runSQL(sql);

            // Get group info
            const group = await this.getGroupInfo(groupId);
            if (!group) throw new Error("Group not found");

            // Notify all existing members about the new member
            const members = await this.getGroupMembers(groupId);
            for (const member of members) {
                if ((member as any).PUBLICKEY !== myPublicKey) {
                    try {
                        await this.sendMemberAddedNotification(
                            groupId,
                            (group as any).NAME,
                            publickey,
                            username,
                            (member as any).PUBLICKEY,
                            myPublicKey,
                            myUsername
                        );
                    } catch (err) {
                        console.error(`❌ [GROUP] Failed to notify ${(member as any).PUBLICKEY}:`, err);
                    }
                }
            }

            // Send invite to the new member
            await this.sendGroupInvite(
                groupId,
                (group as any).NAME,
                (group as any).DESCRIPTION || "",
                publickey,
                myPublicKey,
                myUsername,
                members
            );

            this.notifyGroupUpdate();
        } catch (err) {
            console.error("❌ [GROUP] Failed to add member:", err);
            throw err;
        }
    }

    async removeMember(
        groupId: string,
        publickey: string,
        myPublicKey: string,
        myUsername: string
    ): Promise<void> {
        try {
            // Get member info before deleting
            const memberSql = `SELECT * FROM GROUP_MEMBERS WHERE group_id = '${groupId}' AND publickey = '${publickey}'`;
            const memberRes = await this.runSQL(memberSql);
            if (!memberRes.rows || memberRes.rows.length === 0) {
                throw new Error("Member not found");
            }
            const member = memberRes.rows[0] as any;

            // Remove from database
            const sql = `DELETE FROM GROUP_MEMBERS WHERE group_id = '${groupId}' AND publickey = '${publickey}'`;
            await this.runSQL(sql);

            // Get group info
            const group = await this.getGroupInfo(groupId);
            if (!group) throw new Error("Group not found");

            // Notify all remaining members
            const members = await this.getGroupMembers(groupId);
            for (const m of members) {
                try {
                    await this.sendMemberRemovedNotification(
                        groupId,
                        (group as any).NAME,
                        publickey,
                        member.USERNAME,
                        (m as any).PUBLICKEY,
                        myPublicKey,
                        myUsername
                    );
                } catch (err) {
                    console.error(`❌ [GROUP] Failed to notify ${(m as any).PUBLICKEY}:`, err);
                }
            }

            this.notifyGroupUpdate();
        } catch (err) {
            console.error("❌ [GROUP] Failed to remove member:", err);
            throw err;
        }
    }

    async leaveGroup(groupId: string, myPublicKey: string, myUsername: string): Promise<void> {
        await this.removeMember(groupId, myPublicKey, myPublicKey, myUsername);
    }

    async getGroupMembers(groupId: string): Promise<GroupMember[]> {
        try {
            const sql = `SELECT * FROM GROUP_MEMBERS WHERE group_id = '${groupId}' ORDER BY joined_date ASC`;
            const res = await this.runSQL(sql);
            return res.rows || [];
        } catch (err) {
            console.error("❌ [GROUP] Failed to get members:", err);
            return [];
        }
    }

    /* ----------------------------------------------------------------------------
      MESSAGE HANDLING
    ---------------------------------------------------------------------------- */
    async sendGroupMessage(
        groupId: string,
        message: string,
        type: string,
        myPublicKey: string,
        myUsername: string,
        filedata: string = ""
    ): Promise<void> {
        try {
            const now = Date.now();

            // Get group info and members
            const group = await this.getGroupInfo(groupId);
            if (!group) throw new Error("Group not found");

            const members = await this.getGroupMembers(groupId);

            // Save message locally
            const encodedMsg = encodeURIComponent(message).replace(/'/g, "%27");
            const insertSql = `
                INSERT INTO GROUP_MESSAGES (group_id, sender_publickey, sender_username, type, message, filedata, date, read)
                VALUES ('${groupId}', '${myPublicKey}', '${myUsername.replace(/'/g, "''")}', '${type}', '${encodedMsg}', '${filedata}', ${now}, 1)
            `;
            await this.runSQL(insertSql);

            // Send to all members via MAXIMA (except myself)
            const maximaMessage: GroupMaximaMessage = {
                messageType: "group_message",
                groupId,
                groupName: (group as any).NAME,
                senderPublickey: myPublicKey,
                senderUsername: myUsername,
                timestamp: now,
                message,
                type: type as any,
                filedata
            };

            for (const member of members) {
                if ((member as any).PUBLICKEY !== myPublicKey) {
                    try {
                        await this.sendMaximaMessage((member as any).PUBLICKEY, maximaMessage);
                    } catch (err) {
                        console.error(`❌ [GROUP] Failed to send message to ${(member as any).PUBLICKEY}:`, err);
                        // Continue with other members
                    }
                }
            }

            console.log("✅ [GROUP] Message sent to group:", groupId);
        } catch (err) {
            console.error("❌ [GROUP] Failed to send group message:", err);
            throw err;
        }
    }

    async getGroupMessages(groupId: string): Promise<GroupMessage[]> {
        try {
            const sql = `
                SELECT * FROM GROUP_MESSAGES
                WHERE group_id = '${groupId}'
                ORDER BY date ASC
            `;
            const res = await this.runSQL(sql);
            return res.rows || [];
        } catch (err) {
            console.error("❌ [GROUP] Failed to get messages:", err);
            return [];
        }
    }

    async markGroupMessagesAsRead(groupId: string): Promise<void> {
        try {
            const sql = `UPDATE GROUP_MESSAGES SET read = 1 WHERE group_id = '${groupId}'`;
            await this.runSQL(sql);
        } catch (err) {
            console.error("❌ [GROUP] Failed to mark messages as read:", err);
        }
    }

    /* ----------------------------------------------------------------------------
      MAXIMA COMMUNICATION
    ---------------------------------------------------------------------------- */
    private async sendMaximaMessage(toPublicKey: string, message: GroupMaximaMessage): Promise<void> {
        console.log(`📤 [GROUP] Sending MAXIMA message type '${message.messageType}' to ${toPublicKey}...`);
        const jsonStr = JSON.stringify(message);
        const hexData = "0x" + minimaService.utf8ToHex(jsonStr).toUpperCase();

        const response = await MDS.cmd.maxima({
            params: {
                action: "send",
                publickey: toPublicKey,
                application: "charmchain-group",
                data: hexData,
                poll: false,
            } as any,
        });

        console.log(`📤 [GROUP] MAXIMA send response:`, response);

        if (!response || (response as any).status === false) {
            throw new Error((response as any).error || "MAXIMA send failed");
        }
    }

    private async sendGroupInvite(
        groupId: string,
        groupName: string,
        description: string,
        toPublicKey: string,
        myPublicKey: string,
        myUsername: string,
        members: GroupMember[]
    ): Promise<void> {
        const message: GroupMaximaMessage = {
            messageType: "group_invite",
            groupId,
            groupName,
            senderPublickey: myPublicKey,
            senderUsername: myUsername,
            timestamp: Date.now(),
            description,
            members: members.map(m => ({ publickey: (m as any).PUBLICKEY, username: (m as any).USERNAME }))
        };

        console.log(`INVITING MEMBER: ${toPublicKey} to group ${groupId}`);
        await this.sendMaximaMessage(toPublicKey, message);
    }

    private async sendMemberAddedNotification(
        groupId: string,
        groupName: string,
        memberPublickey: string,
        memberUsername: string,
        toPublicKey: string,
        myPublicKey: string,
        myUsername: string
    ): Promise<void> {
        const message: GroupMaximaMessage = {
            messageType: "group_member_added",
            groupId,
            groupName,
            senderPublickey: myPublicKey,
            senderUsername: myUsername,
            timestamp: Date.now(),
            memberPublickey,
            memberUsername
        };

        await this.sendMaximaMessage(toPublicKey, message);
    }

    private async sendMemberRemovedNotification(
        groupId: string,
        groupName: string,
        memberPublickey: string,
        memberUsername: string,
        toPublicKey: string,
        myPublicKey: string,
        myUsername: string
    ): Promise<void> {
        const message: GroupMaximaMessage = {
            messageType: "group_member_removed",
            groupId,
            groupName,
            senderPublickey: myPublicKey,
            senderUsername: myUsername,
            timestamp: Date.now(),
            memberPublickey,
            memberUsername
        };

        await this.sendMaximaMessage(toPublicKey, message);
    }

    /* ----------------------------------------------------------------------------
      INCOMING MESSAGE HANDLING
    ---------------------------------------------------------------------------- */
    async handleIncomingGroupMessage(message: GroupMaximaMessage, fromPublicKey: string): Promise<void> {
        try {
            console.log("📨 [GROUP] Incoming group message:", message);

            switch (message.messageType) {
                case "group_invite":
                    await this.handleGroupInvite(message, fromPublicKey);
                    break;
                case "group_message":
                    await this.handleGroupChatMessage(message, fromPublicKey);
                    break;
                case "group_member_added":
                    await this.handleMemberAdded(message);
                    break;
                case "group_member_removed":
                    await this.handleMemberRemoved(message);
                    break;
                default:
                    console.warn("⚠️ [GROUP] Unknown message type:", message.messageType);
            }

            // Notify UI
            this.notifyGroupMessage(message);
        } catch (err) {
            console.error("❌ [GROUP] Failed to handle incoming message:", err);
        }
    }

    private async handleGroupInvite(message: GroupMaximaMessage, fromPublicKey: string): Promise<void> {
        // Check if group already exists
        const existing = await this.getGroupInfo(message.groupId);
        if (existing) {
            console.log("ℹ️ [GROUP] Group already exists, skipping invite");
            return;
        }

        // Create group locally
        const createGroupSql = `
            INSERT INTO GROUPS (group_id, name, creator_publickey, created_date, description)
            VALUES ('${message.groupId}', '${message.groupName.replace(/'/g, "''")}', '${fromPublicKey}', ${message.timestamp}, '${(message.description || "").replace(/'/g, "''")}')
        `;
        await this.runSQL(createGroupSql);

        // Add all members
        if (message.members) {
            for (const member of message.members) {
                const addMemberSql = `
                    INSERT INTO GROUP_MEMBERS (group_id, publickey, username, joined_date, role)
                    VALUES ('${message.groupId}', '${member.publickey}', '${(member.username || 'Unknown').replace(/'/g, "''")}', ${message.timestamp}, '${member.publickey === fromPublicKey ? 'creator' : 'member'}')
                `;
                await this.runSQL(addMemberSql);

                // Auto-add member as MAXIMA contact if not already
                await this.ensureMaximaContact(member.publickey);
            }
        }

        console.log("✅ [GROUP] Group invite accepted:", message.groupId);
        this.notifyGroupUpdate();
    }

    private async handleGroupChatMessage(message: GroupMaximaMessage, fromPublicKey: string): Promise<void> {
        // Save message locally
        const encodedMsg = encodeURIComponent(message.message || "").replace(/'/g, "%27");
        const insertSql = `
            INSERT INTO GROUP_MESSAGES (group_id, sender_publickey, sender_username, type, message, filedata, date, read)
            VALUES ('${message.groupId}', '${fromPublicKey}', '${message.senderUsername.replace(/'/g, "''")}', '${message.type}', '${encodedMsg}', '${message.filedata || ""}', ${message.timestamp}, 0)
        `;
        await this.runSQL(insertSql);

        console.log("✅ [GROUP] Message saved:", message.groupId);
    }

    private async handleMemberAdded(message: GroupMaximaMessage): Promise<void> {
        if (!message.memberPublickey || !message.memberUsername) return;

        // Check if member already exists
        const checkSql = `SELECT * FROM GROUP_MEMBERS WHERE group_id = '${message.groupId}' AND publickey = '${message.memberPublickey}'`;
        const checkRes = await this.runSQL(checkSql);
        if (checkRes.rows && checkRes.rows.length > 0) {
            console.log("ℹ️ [GROUP] Member already exists, skipping");
            return;
        }

        // Add member
        const addSql = `
            INSERT INTO GROUP_MEMBERS (group_id, publickey, username, joined_date, role)
            VALUES ('${message.groupId}', '${message.memberPublickey}', '${message.memberUsername.replace(/'/g, "''")}', ${message.timestamp}, 'member')
        `;
        await this.runSQL(addSql);

        // Auto-add as MAXIMA contact
        await this.ensureMaximaContact(message.memberPublickey);

        console.log("✅ [GROUP] Member added:", message.memberPublickey);
        this.notifyGroupUpdate();
    }

    private async handleMemberRemoved(message: GroupMaximaMessage): Promise<void> {
        if (!message.memberPublickey) return;

        const removeSql = `DELETE FROM GROUP_MEMBERS WHERE group_id = '${message.groupId}' AND publickey = '${message.memberPublickey}'`;
        await this.runSQL(removeSql);

        console.log("✅ [GROUP] Member removed:", message.memberPublickey);
        this.notifyGroupUpdate();
    }

    /* ----------------------------------------------------------------------------
      HELPER FUNCTIONS
    ---------------------------------------------------------------------------- */
    private async getUsernameFromContact(publickey: string): Promise<string> {
        try {
            const response = await MDS.cmd.maxcontacts();
            if (response && (response as any).response && (response as any).response.contacts) {
                const contacts = (response as any).response.contacts;
                const contact = contacts.find((c: any) => c.publickey === publickey);
                if (contact) {
                    return contact.extradata?.name || contact.currentaddress || "Unknown";
                }
            }
            return "Unknown";
        } catch (err) {
            console.error("❌ [GROUP] Failed to get username:", err);
            return "Unknown";
        }
    }

    private async ensureMaximaContact(publickey: string): Promise<void> {
        try {
            // Check if contact already exists
            const response = await MDS.cmd.maxcontacts();
            if (response && (response as any).response && (response as any).response.contacts) {
                const contacts = (response as any).response.contacts;
                const exists = contacts.some((c: any) => c.publickey === publickey);
                if (exists) {
                    console.log("ℹ️ [GROUP] Contact already exists:", publickey);
                    return;
                }
            }

            // Add contact
            await MDS.cmd.maxcontacts({
                action: "add",
                contact: publickey
            } as any);
            console.log("✅ [GROUP] Auto-added MAXIMA contact:", publickey);
        } catch (err) {
            console.error("❌ [GROUP] Failed to add MAXIMA contact:", err);
        }
    }

    /* ----------------------------------------------------------------------------
      CALLBACKS
    ---------------------------------------------------------------------------- */
    onGroupMessage(cb: GroupMessageCallback) {
        this.groupMessageCallbacks.push(cb);
    }

    removeGroupMessageCallback(cb: GroupMessageCallback) {
        const index = this.groupMessageCallbacks.indexOf(cb);
        if (index > -1) {
            this.groupMessageCallbacks.splice(index, 1);
        }
    }

    onGroupUpdate(cb: GroupUpdateCallback) {
        this.groupUpdateCallbacks.push(cb);
    }

    removeGroupUpdateCallback(cb: GroupUpdateCallback) {
        const index = this.groupUpdateCallbacks.indexOf(cb);
        if (index > -1) {
            this.groupUpdateCallbacks.splice(index, 1);
        }
    }

    private notifyGroupMessage(message: GroupMaximaMessage) {
        this.groupMessageCallbacks.forEach(cb => cb(message));
    }

    private notifyGroupUpdate() {
        this.groupUpdateCallbacks.forEach(cb => cb());
    }
}

export const groupService = new GroupService();
