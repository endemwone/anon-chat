const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "chat.db");
const db = new sqlite3.Database(dbPath);

function initDb() {
    db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roomCode TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);
    console.log("sqlite: Database initialized.");
}

function saveMessage(roomCode, text, timestamp) {
    return new Promise((resolve, reject) => {
        db.run(
            "INSERT INTO messages (roomCode, text, timestamp) VALUES (?, ?, ?)",
            [roomCode, text, timestamp],
            function (err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

function getRoomHistory(roomCode) {
    return new Promise((resolve, reject) => {
        // Get last 50 messages for the room, chronologically
        db.all(
            "SELECT text, timestamp FROM messages WHERE roomCode = ? ORDER BY id DESC LIMIT 50",
            [roomCode],
            (err, rows) => {
                if (err) return reject(err);
                resolve(rows.reverse());
            }
        );
    });
}

module.exports = {
    initDb,
    saveMessage,
    getRoomHistory,
};
