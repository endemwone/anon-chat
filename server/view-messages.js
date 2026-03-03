require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { createClient } = require("@libsql/client");

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

(async () => {
    console.log("--- LATEST 20 MESSAGES ---");
    try {
        const result = await db.execute(
            "SELECT * FROM messages ORDER BY id DESC LIMIT 20"
        );
        if (result.rows.length === 0) {
            console.log("No messages found yet.");
        } else {
            console.table(
                result.rows.map((row) => ({
                    ID: row.id,
                    Room: row.roomCode,
                    Text: row.text,
                    Time: new Date(row.timestamp).toLocaleString(),
                }))
            );
        }
    } catch (err) {
        console.error("Error reading database:", err);
    }
})();
