const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const {
    initDb,
    saveMessage,
    getRoomHistory,
    addMember,
    getRoomMembers,
} = require("./database");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});

// ── In-memory data (session tracking only) ──────────────────
const socketToRoom = new Map(); // socketId → roomCode

// ── Socket.io events ────────────────────────────────────────
io.on("connection", (socket) => {
    console.log(`⚡  Connected: ${socket.id}`);

    // ── Join a room ──
    socket.on("join-room", async ({ displayName, roomCode }) => {
        if (!displayName || !roomCode) return;

        socketToRoom.set(socket.id, roomCode);
        socket.join(roomCode);

        console.log(`👤  ${displayName} joined room [${roomCode}]`);

        try {
            // Persist member in DB
            await addMember(roomCode, displayName);

            // Send full (persistent) member list to everyone in the room
            const members = await getRoomMembers(roomCode);
            io.to(roomCode).emit("room-members", members);

            // Send chat history to the joining user
            const history = await getRoomHistory(roomCode);
            socket.emit("chat-history", history);
        } catch (err) {
            console.error("Error during join:", err);
        }
    });

    // ── Receive a message — strip identity, broadcast anonymously ──
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

    // ── Typing indicator ──
    socket.on("typing", () => {
        const roomCode = socketToRoom.get(socket.id);
        if (!roomCode) return;
        // Broadcast to everyone EXCEPT the sender
        socket.to(roomCode).emit("user-typing");
    });

    // ── Disconnect — clean up session ──
    socket.on("disconnect", () => {
        const roomCode = socketToRoom.get(socket.id);
        socketToRoom.delete(socket.id);
        console.log(`❌  Disconnected: ${socket.id}${roomCode ? ` from [${roomCode}]` : ""}`);
    });
});

// ── Start ───────────────────────────────────────────────────
initDb();

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀  Anon Chat server running on http://0.0.0.0:${PORT}\n`);
});
