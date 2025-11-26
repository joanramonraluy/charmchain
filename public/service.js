/**
 * CharmChain Service Worker
 * Processes incoming Maxima messages even when app is closed
 */

// Convert HEX to UTF8
function hexToUtf8(s) {
    return decodeURIComponent(
        s.replace(/\s+/g, '') // remove spaces
            .replace(/[0-9A-F]{2}/g, '%$&') // add '%' before each 2 characters
    );
}

// Convert UTF8 to HEX
function utf8ToHex(s) {
    var r = "";
    var utf8 = unescape(encodeURIComponent(s));
    for (var i = 0; i < utf8.length; i++) {
        var b = utf8.charCodeAt(i);
        r += ("0" + b.toString(16)).slice(-2);
    }
    return r;
}

// Main message handler
MDS.init(function (msg) {

    // Do initialisation
    if (msg.event == "inited") {
        MDS.log("[ServiceWorker] STARTING UP - Version 0.3.0");

        // Create the DB if not exists (using same schema as main app)
        var initsql = "CREATE TABLE IF NOT EXISTS CHAT_MESSAGES ( "
            + "  id BIGINT AUTO_INCREMENT PRIMARY KEY, "
            + "  roomname varchar(160) NOT NULL, "
            + "  publickey varchar(512) NOT NULL, "
            + "  username varchar(160) NOT NULL, "
            + "  type varchar(64) NOT NULL, "
            + "  message varchar(512) NOT NULL, "
            + "  filedata clob(256K) NOT NULL, "
            + "  customid varchar(128) NOT NULL DEFAULT '0x00', "
            + "  state varchar(128) NOT NULL DEFAULT '', "
            + "  read int NOT NULL DEFAULT 0, "
            + "  date bigint NOT NULL "
            + " )";

        // Run this
        MDS.sql(initsql, function (res) {
            MDS.log("[ServiceWorker] CharmChain DB initialized: " + JSON.stringify(res));
        });

        // Only interested in Maxima
    } else if (msg.event == "MAXIMA") {

        MDS.log("[ServiceWorker] MAXIMA event received. App: " + msg.data.application);

        // Is it for charmchain?
        if (msg.data.application && msg.data.application.toLowerCase() == "charmchain") {

            // Relevant data
            var pubkey = msg.data.from;

            // Remove the leading 0x
            var datastr = msg.data.data.substring(2);

            // Convert the data
            var jsonstr = hexToUtf8(datastr);

            // And create the actual JSON
            try {
                var maxjson = JSON.parse(jsonstr);

                MDS.log("[ServiceWorker] Parsed message: " + JSON.stringify(maxjson));

                // Handle read receipts
                if (maxjson.type === "read") {
                    MDS.log("[ServiceWorker] Read receipt received from " + pubkey);
                    var sql = "UPDATE CHAT_MESSAGES SET state='read' WHERE publickey='" + pubkey + "' AND username='Me'";
                    MDS.sql(sql);
                    return;
                }

                // Handle delivery receipts
                if (maxjson.type === "delivery_receipt") {
                    MDS.log("[ServiceWorker] Delivery receipt received from " + pubkey);
                    var sql = "UPDATE CHAT_MESSAGES SET state='delivered' WHERE publickey='" + pubkey + "' AND username='Me' AND state!='read'";
                    MDS.sql(sql);
                    return;
                }

                // URL encode the message and deal with apostrophe
                var encoded = encodeURIComponent(maxjson.message).replace(/'/g, "%27");

                // Insert into the DB
                var msgsql = "INSERT INTO CHAT_MESSAGES (roomname,publickey,username,type,message,filedata,date) VALUES "
                    + "('" + maxjson.username + "','" + pubkey + "','" + maxjson.username + "','" + maxjson.type + "','" + encoded + "','" + (maxjson.filedata || "") + "', " + Date.now() + ")";

                // Insert into DB
                MDS.sql(msgsql, function (res) {
                    MDS.log("[ServiceWorker] Message saved to DB");
                });

                // Send delivery receipt automatically
                var payload = {
                    message: "",
                    type: "delivery_receipt",
                    username: "Me",
                    filedata: ""
                };

                var jsonStr = JSON.stringify(payload);
                var hexData = "0x" + utf8ToHex(jsonStr).toUpperCase();

                MDS.cmd("maxima action:send publickey:" + pubkey + " application:charmchain data:" + hexData + " poll:false", function (res) {
                    MDS.log("[ServiceWorker] Delivery receipt sent to " + pubkey);
                });

            } catch (err) {
                MDS.log("[ServiceWorker] Error processing message: " + err);
            }
        }
    }
});
