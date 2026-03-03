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
        db.run(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roomCode TEXT NOT NULL,
        socketId TEXT NOT NULL,
        subscription TEXT NOT NULL,
        UNIQUE(socketId)
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

// ── Push Subscriptions ──

function saveSubscription(roomCode, socketId, subscription) {
    return new Promise((resolve, reject) => {
        // Upsert: if socketId already exists, update it
        db.run(
            `INSERT INTO push_subscriptions (roomCode, socketId, subscription)
       VALUES (?, ?, ?)
       ON CONFLICT(socketId) DO UPDATE SET roomCode = excluded.roomCode, subscription = excluded.subscription`,
            [roomCode, socketId, JSON.stringify(subscription)],
            function (err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });
}

function getSubscriptionsForRoom(roomCode) {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT socketId, subscription FROM push_subscriptions WHERE roomCode = ?",
            [roomCode],
            (err, rows) => {
                if (err) return reject(err);
                resolve(
                    rows.map((r) => ({
                        socketId: r.socketId,
                        subscription: JSON.parse(r.subscription),
                    }))
                );
            }
        );
    });
}

function removeSubscription(socketId) {
    return new Promise((resolve, reject) => {
        db.run(
            "DELETE FROM push_subscriptions WHERE socketId = ?",
            [socketId],
            function (err) {
                if (err) return reject(err);
                resolve(this.changes);
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
    saveSubscription,
    getSubscriptionsForRoom,
    removeSubscription,
};
