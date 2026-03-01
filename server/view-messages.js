const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "chat.db");
const db = new sqlite3.Database(dbPath);

console.log("--- LATEST 20 MESSAGES ---");
db.all("SELECT * FROM messages ORDER BY id DESC LIMIT 20", (err, rows) => {
    if (err) {
        console.error("Error reading database:", err);
    } else {
        if (rows.length === 0) {
            console.log("No messages found yet.");
        } else {
            console.table(
                rows.map((row) => ({
                    ID: row.id,
                    Room: row.roomCode,
                    Text: row.text,
                    Time: new Date(row.timestamp).toLocaleString(),
                }))
            );
        }
    }
    db.close();
});
