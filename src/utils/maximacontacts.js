// src/utils/maxima.js
export async function initMaxima() {
    return new Promise((resolve, reject) => {
        if (!window.Maxima) {
            reject("❌ Maxima not available");
            return;
        }

        window.Maxima.init((msg) => {
            if (msg.status) {
                console.log("✅ Maxima initialized as:", msg.response.name);
                resolve(msg.response);
            } else {
                reject("Failed to initialize Maxima");
            }
        });
    });
}

export async function getContacts() {
    return new Promise((resolve, reject) => {
        window.Maxima.cmd("maxcontacts", (res) => {
            if (res.status && res.response.contacts) {
                console.log("📇 Found contacts:", res.response.contacts);
                resolve(res.response.contacts);
            } else {
                console.warn("⚠️ No contacts found.");
                resolve([]);
            }
        });
    });
}
