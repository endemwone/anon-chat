const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const webpush = require("web-push");
const {
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
} = require("./database");

// ── VAPID keys from environment variables ───────────
// These must be set in Render's env var dashboard so they persist across deploys.
const vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    console.error("⚠️  VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars are required for Web Push!");
    console.error("   Generate with: npx web-push generate-vapid-keys");
}

webpush.setVapidDetails(
    "mailto:anonchat@example.com",
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// ── Express Setup ───────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Keep-alive for UptimeRobot
app.get("/ping", (req, res) => {
    res.status(200).send("pong");
});

// Return the public VAPID key so the frontend can subscribe
app.get("/vapid-public-key", (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

// Serve compiled Expo Web app
const clientDistPath = path.join(__dirname, "../dist");
app.use(express.static(clientDistPath));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});

// ── In-memory data (session tracking only) ──────────
const socketToRoom = new Map();

io.on("connection", (socket) => {
    console.log(`⚡  Connected: ${socket.id}`);

    socket.on("join-room", async ({ displayName, roomCode }) => {
        if (!displayName || !roomCode) return;

        socketToRoom.set(socket.id, roomCode);
        socket.join(roomCode);

        console.log(`👤  ${displayName} joined room [${roomCode}]`);

        try {
            await addMember(roomCode, displayName);
            const members = await getRoomMembers(roomCode);
            io.to(roomCode).emit("room-members", members);

            const history = await getRoomHistory(roomCode);
            socket.emit("chat-history", history);

            const polls = await getRoomPolls(roomCode);
            socket.emit("poll-history", polls);
        } catch (err) {
            console.error("Error during join:", err);
        }
    });

    // ── Register push subscription ──
    socket.on("register-push", async (subscription) => {
        const roomCode = socketToRoom.get(socket.id);
        if (!roomCode || !subscription) return;

        try {
            await saveSubscription(roomCode, socket.id, subscription);
            console.log(`🔔  Push subscription registered for ${socket.id} in [${roomCode}]`);
        } catch (err) {
            console.error("Error saving push subscription:", err);
        }
    });

    socket.on("send-message", async ({ text }) => {
        const roomCode = socketToRoom.get(socket.id);
        if (!roomCode || !text) return;

        const message = {
            text: text.trim(),
            timestamp: new Date().toISOString(),
        };

        console.log(`💬  Anonymous message in [${roomCode}]: ${message.text}`);

        try {
            await saveMessage(roomCode, message.text, message.timestamp);
            io.to(roomCode).emit("new-message", message);

            // Send Web Push to all subscribers in the room except the sender
            const subs = await getSubscriptionsForRoom(roomCode);
            for (const sub of subs) {
                if (sub.socketId === socket.id) continue; // skip sender

                const payload = JSON.stringify({
                    title: `🔒 ${roomCode}`,
                    body: message.text,
                    roomCode,
                });

                webpush.sendNotification(sub.subscription, payload).catch((err) => {
                    // If subscription is expired or invalid, remove it
                    if (err.statusCode === 404 || err.statusCode === 410) {
                        removeSubscription(sub.socketId);
                        console.log(`🗑️  Removed expired push sub for ${sub.socketId}`);
                    }
                });
            }
        } catch (err) {
            console.error("Error saving message:", err);
        }
    });

    socket.on("typing", () => {
        const roomCode = socketToRoom.get(socket.id);
        if (!roomCode) return;
        socket.to(roomCode).emit("user-typing");
    });

    // ── Polls ──
    socket.on("create-poll", async ({ question, options }) => {
        const roomCode = socketToRoom.get(socket.id);
        if (!roomCode || !question || !options || options.length < 2) return;

        try {
            const createdAt = new Date().toISOString();
            const pollId = await createPoll(roomCode, question.trim(), options.map(o => o.trim()), createdAt);
            const poll = await getPollResults(pollId);
            io.to(roomCode).emit("new-poll", poll);
            console.log(`📊  Poll created in [${roomCode}]: ${question}`);
        } catch (err) {
            console.error("Error creating poll:", err);
        }
    });

    socket.on("vote-poll", async ({ pollId, optionIndex }) => {
        const roomCode = socketToRoom.get(socket.id);
        if (!roomCode || pollId == null || optionIndex == null) return;

        try {
            // Use socket.id as voter key for anonymity
            await votePoll(pollId, optionIndex, socket.id);
            const poll = await getPollResults(pollId);
            io.to(roomCode).emit("poll-update", poll);
        } catch (err) {
            console.error("Error voting on poll:", err);
        }
    });

    socket.on("disconnect", async () => {
        const roomCode = socketToRoom.get(socket.id);
        socketToRoom.delete(socket.id);
        // Don't remove push subscription on disconnect — we WANT to push
        // notifications even when the user's tab is closed!
        console.log(
            `❌  Disconnected: ${socket.id}${roomCode ? ` from [${roomCode}]` : ""}`
        );
    });
});

// Catch-all: serve index.html for any unmatched route
app.use((req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
});

// ── Start ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;

(async () => {
    await initDb();
    server.listen(PORT, "0.0.0.0", () => {
        console.log(`\n🚀  Anon Chat server running on http://0.0.0.0:${PORT}\n`);
    });
})();
