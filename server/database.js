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
    await db.execute(`
    CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roomCode TEXT NOT NULL,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS poll_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pollId INTEGER NOT NULL,
      optionIndex INTEGER NOT NULL,
      voterKey TEXT NOT NULL,
      UNIQUE(pollId, voterKey),
      FOREIGN KEY (pollId) REFERENCES polls(id)
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

// ── Polls ──

async function createPoll(roomCode, question, options, createdAt) {
    const result = await db.execute({
        sql: "INSERT INTO polls (roomCode, question, options, createdAt) VALUES (?, ?, ?, ?)",
        args: [roomCode, question, JSON.stringify(options), createdAt],
    });
    return Number(result.lastInsertRowid);
}

async function votePoll(pollId, optionIndex, voterKey) {
    await db.execute({
        sql: `INSERT INTO poll_votes (pollId, optionIndex, voterKey)
          VALUES (?, ?, ?)
          ON CONFLICT(pollId, voterKey) DO UPDATE SET optionIndex = excluded.optionIndex`,
        args: [pollId, optionIndex, voterKey],
    });
}

async function getPollResults(pollId) {
    const pollResult = await db.execute({
        sql: "SELECT id, question, options, createdAt FROM polls WHERE id = ?",
        args: [pollId],
    });
    if (pollResult.rows.length === 0) return null;
    const poll = pollResult.rows[0];

    const votesResult = await db.execute({
        sql: "SELECT optionIndex, COUNT(*) as count FROM poll_votes WHERE pollId = ? GROUP BY optionIndex",
        args: [pollId],
    });

    const options = JSON.parse(poll.options);
    const votes = new Array(options.length).fill(0);
    for (const row of votesResult.rows) {
        votes[Number(row.optionIndex)] = Number(row.count);
    }

    return {
        id: Number(poll.id),
        question: poll.question,
        options,
        votes,
        totalVotes: votes.reduce((a, b) => a + b, 0),
        createdAt: poll.createdAt,
    };
}

async function getRoomPolls(roomCode) {
    const result = await db.execute({
        sql: "SELECT id FROM polls WHERE roomCode = ? ORDER BY id ASC",
        args: [roomCode],
    });
    const polls = [];
    for (const row of result.rows) {
        const poll = await getPollResults(Number(row.id));
        if (poll) polls.push(poll);
    }
    return polls;
}

async function getVoterChoice(pollId, voterKey) {
    const result = await db.execute({
        sql: "SELECT optionIndex FROM poll_votes WHERE pollId = ? AND voterKey = ?",
        args: [pollId, voterKey],
    });
    return result.rows.length > 0 ? Number(result.rows[0].optionIndex) : null;
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
    createPoll,
    votePoll,
    getPollResults,
    getRoomPolls,
    getVoterChoice,
};
