const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const {
    initDb,
    saveMessage,
    getRoomHistory,
    addMember,
    getRoomMembers,
} = require("./database");

const app = express();
app.use(cors());

// ── Render keep-alive trick (`/ping`) ─────────────
// You can point uptimerobot.com to this endpoint
app.get("/ping", (req, res) => {
    res.status(200).send("pong");
});

// ── Serve compiled Expo Web app ───────────────────
// We'll tell Render to build the frontend into `anon-chat/dist`
const clientDistPath = path.join(__dirname, "../dist");
app.use(express.static(clientDistPath));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});

// ── In-memory data (session tracking only) ──────────────────
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
        } catch (err) {
            console.error("Error during join:", err);
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
        } catch (err) {
            console.error("Error saving message:", err);
        }
    });

    socket.on("typing", () => {
        const roomCode = socketToRoom.get(socket.id);
        if (!roomCode) return;
        socket.to(roomCode).emit("user-typing");
    });

    socket.on("disconnect", () => {
        const roomCode = socketToRoom.get(socket.id);
        socketToRoom.delete(socket.id);
        console.log(
            `❌  Disconnected: ${socket.id}${roomCode ? ` from [${roomCode}]` : ""}`
        );
    });
});

// ── Catch-all route for React Navigation (Web) ────
// If they go straight to `/` or navigate around, return `index.html`.
app.get("*", (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
});

// ── Start ───────────────────────────────────────────────────
initDb();

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀  Anon Chat server running on http://0.0.0.0:${PORT}\n`);
});
