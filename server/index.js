const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// ── In-memory data ──────────────────────────────────────────
// rooms:        Map<roomCode, Map<socketId, displayName>>
// socketToRoom: Map<socketId, roomCode>
const rooms = new Map();
const socketToRoom = new Map();

// Helper: get the user list for a room
function getUserList(roomCode) {
  const members = rooms.get(roomCode);
  if (!members) return [];
  return Array.from(members.values());
}

// ── Socket.io events ────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`⚡  Connected: ${socket.id}`);

  // ── Join a room ──
  socket.on("join-room", ({ displayName, roomCode }) => {
    if (!displayName || !roomCode) return;

    // Create the room if it doesn't exist
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, new Map());
    }

    rooms.get(roomCode).set(socket.id, displayName);
    socketToRoom.set(socket.id, roomCode);
    socket.join(roomCode);

    console.log(`👤  ${displayName} joined room [${roomCode}]`);

    // Broadcast updated user list to everyone in the room
    io.to(roomCode).emit("room-users", getUserList(roomCode));
  });

  // ── Receive a message — strip identity, broadcast anonymously ──
  socket.on("send-message", ({ text }) => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode || !text) return;

    const message = {
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    console.log(`💬  Anonymous message in [${roomCode}]: ${message.text}`);

    // Send to everyone in the room (including sender)
    io.to(roomCode).emit("new-message", message);
  });

  // ── Disconnect — clean up ──
  socket.on("disconnect", () => {
    const roomCode = socketToRoom.get(socket.id);

    if (roomCode && rooms.has(roomCode)) {
      const displayName = rooms.get(roomCode).get(socket.id);
      rooms.get(roomCode).delete(socket.id);

      // Remove empty rooms
      if (rooms.get(roomCode).size === 0) {
        rooms.delete(roomCode);
        console.log(`🗑️   Room [${roomCode}] deleted (empty)`);
      } else {
        // Broadcast updated user list
        io.to(roomCode).emit("room-users", getUserList(roomCode));
      }

      console.log(`👋  ${displayName || socket.id} left room [${roomCode}]`);
    }

    socketToRoom.delete(socket.id);
    console.log(`❌  Disconnected: ${socket.id}`);
  });
});

// ── Start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀  Anon Chat server running on http://0.0.0.0:${PORT}\n`);
});
