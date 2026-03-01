const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "chat.db");
const db = new sqlite3.Database(dbPath);

function initDb() {
    db.serialize(() => {
        db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roomCode TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);
        db.run(`
      CREATE TABLE IF NOT EXISTS room_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roomCode TEXT NOT NULL,
        displayName TEXT NOT NULL,
        joinedAt TEXT NOT NULL,
        UNIQUE(roomCode, displayName)
      )
    `);
    });
    console.log("sqlite: Database initialized.");
}

// ── Messages ──

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

// ── Room Members ──

function addMember(roomCode, displayName) {
    return new Promise((resolve, reject) => {
        db.run(
            "INSERT OR IGNORE INTO room_members (roomCode, displayName, joinedAt) VALUES (?, ?, ?)",
            [roomCode, displayName, new Date().toISOString()],
            function (err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

function getRoomMembers(roomCode) {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT displayName, joinedAt FROM room_members WHERE roomCode = ? ORDER BY joinedAt ASC",
            [roomCode],
            (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map((r) => r.displayName));
            }
        );
    });
}

module.exports = {
    initDb,
    saveMessage,
    getRoomHistory,
    addMember,
    getRoomMembers,
};
