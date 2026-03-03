const { createClient } = require("@libsql/client");

// ── Turso Cloud SQLite ──────────────────────────────
const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDb() {
    await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roomCode TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS room_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roomCode TEXT NOT NULL,
      displayName TEXT NOT NULL,
      joinedAt TEXT NOT NULL,
      UNIQUE(roomCode, displayName)
    )
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roomCode TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      socketId TEXT NOT NULL,
      subscription TEXT NOT NULL,
      UNIQUE(endpoint)
    )
  `);
    console.log("turso: Database initialized.");
}

// ── Messages ──

async function saveMessage(roomCode, text, timestamp) {
    const result = await db.execute({
        sql: "INSERT INTO messages (roomCode, text, timestamp) VALUES (?, ?, ?)",
        args: [roomCode, text, timestamp],
    });
    return result.lastInsertRowid;
}

async function getRoomHistory(roomCode) {
    const result = await db.execute({
        sql: "SELECT text, timestamp FROM messages WHERE roomCode = ? ORDER BY id DESC LIMIT 50",
        args: [roomCode],
    });
    return result.rows.reverse();
}

// ── Room Members ──

async function addMember(roomCode, displayName) {
    const result = await db.execute({
        sql: "INSERT OR IGNORE INTO room_members (roomCode, displayName, joinedAt) VALUES (?, ?, ?)",
        args: [roomCode, displayName, new Date().toISOString()],
    });
    return result.lastInsertRowid;
}

async function getRoomMembers(roomCode) {
    const result = await db.execute({
        sql: "SELECT displayName FROM room_members WHERE roomCode = ? ORDER BY joinedAt ASC",
        args: [roomCode],
    });
    return result.rows.map((r) => r.displayName);
}

// ── Push Subscriptions ──

async function saveSubscription(roomCode, socketId, subscription) {
    const endpoint = subscription.endpoint || '';
    const result = await db.execute({
        sql: `INSERT INTO push_subscriptions (roomCode, endpoint, socketId, subscription)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET roomCode = excluded.roomCode, socketId = excluded.socketId, subscription = excluded.subscription`,
        args: [roomCode, endpoint, socketId, JSON.stringify(subscription)],
    });
    return result.lastInsertRowid;
}

async function getSubscriptionsForRoom(roomCode) {
    const result = await db.execute({
        sql: "SELECT socketId, subscription FROM push_subscriptions WHERE roomCode = ?",
        args: [roomCode],
    });
    return result.rows.map((r) => ({
        socketId: r.socketId,
        subscription: JSON.parse(r.subscription),
    }));
}

async function removeSubscription(socketId) {
    const result = await db.execute({
        sql: "DELETE FROM push_subscriptions WHERE socketId = ?",
        args: [socketId],
    });
    return result.rowsAffected;
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
