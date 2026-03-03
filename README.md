# 🔒 Anon Chat

A real-time **anonymous group chat** app. Create a room, share the code, and chat without revealing your identity. Built with React Native (Expo) and deployed as a web app on Render.

**[Live Demo →](https://anon-chat-xxxx.onrender.com)** *(replace with your Render URL)*

---

## ✨ Features

### 💬 Anonymous Messaging
- No accounts, no sign-ups. Pick a display name and join with a room code.
- Messages are fully anonymous — no one sees who sent what.
- **Long-press** any message to **reply** to it. Replies show a quoted preview inside the bubble.

### 📊 Polls
- Tap the **📊** button to create inline polls with up to 4 options.
- Vote by tapping any option — results update live across all devices.
- Vote bars and percentages animate in real time.

### 🔔 Web Push Notifications
- Get native push notifications on your phone or desktop — even when the tab is closed.
- Uses **VAPID keys + Service Workers** for secure, compliant push delivery.
- On **iPhone:** add the app to your home screen from Safari to enable notifications.

### 📜 Message Pagination
- Recent 50 messages load on join.
- Scroll up and tap **"↑ Load older messages"** to fetch 25 more at a time.

### ⌨️ Typing Indicator
- See *"someone is typing..."* in real time when another user types.

### 👥 Persistent Members
- Room member list is stored permanently — see everyone who has ever joined.
- Tap the **👥** badge in the header to view all members.

### 🚀 Always Online
- Hosted on **Render** with free tier. Use **UptimeRobot** to ping `/ping` every 5 minutes to keep the server alive 24/7.

---

## 🏗️ Architecture

```
┌─────────────────┐      WebSocket       ┌─────────────────┐
│   Expo Web App  │ ◄──────────────────► │   Node.js +     │
│   (React Native │      Socket.IO       │   Express +     │
│    for Web)     │                      │   Socket.IO     │
└─────────────────┘                      └────────┬────────┘
                                                  │
                                         ┌────────▼────────┐
                                         │  Turso (Cloud   │
                                         │  SQLite)        │
                                         └─────────────────┘
```

| Layer       | Tech                                      |
|-------------|-------------------------------------------|
| Frontend    | React Native + Expo (Web export)           |
| Backend     | Node.js, Express 5, Socket.IO              |
| Database    | Turso (libSQL — cloud SQLite)               |
| Push        | `web-push` + VAPID + Service Worker        |
| Hosting     | Render (free tier)                         |
| Keep-Alive  | UptimeRobot → `/ping` endpoint             |

---

## 📁 Project Structure

```
anon-chat/
├── App.js                  # Root component + notification setup
├── config.js               # Smart socket URL (web vs mobile)
├── index.js                # Expo entry point
├── app.json                # Expo config (no-zoom viewport)
├── package.json
├── render.yaml             # Render deployment blueprint
│
├── screens/
│   ├── HomeScreen.js       # Join/create room UI
│   └── ChatRoomScreen.js   # Chat, polls, replies, pagination
│
├── public/
│   └── service-worker.js   # Web Push notification handler
│
└── server/
    ├── index.js            # Express + Socket.IO server
    ├── database.js         # Turso DB (messages, polls, members, push)
    └── view-messages.js    # CLI tool to inspect stored messages
```

---

## 🗄️ Database Schema

### `messages`
| Column    | Type    | Description                        |
|-----------|---------|------------------------------------|
| id        | INTEGER | Auto-incrementing primary key      |
| roomCode  | TEXT    | Room identifier                    |
| text      | TEXT    | Message content                    |
| timestamp | TEXT    | ISO 8601 timestamp                 |
| replyTo   | TEXT    | JSON of quoted message (nullable)  |

### `polls`
| Column    | Type    | Description                        |
|-----------|---------|------------------------------------|
| id        | INTEGER | Auto-incrementing primary key      |
| roomCode  | TEXT    | Room identifier                    |
| question  | TEXT    | Poll question                      |
| options   | TEXT    | JSON array of option strings       |
| createdAt | TEXT    | ISO 8601 timestamp                 |

### `poll_votes`
| Column      | Type    | Description                      |
|-------------|---------|----------------------------------|
| id          | INTEGER | Auto-incrementing primary key    |
| pollId      | INTEGER | Foreign key → polls.id           |
| optionIndex | INTEGER | Which option was voted for       |
| voterKey    | TEXT    | Socket ID (anonymous identifier) |

### `room_members`
| Column      | Type    | Description                      |
|-------------|---------|----------------------------------|
| id          | INTEGER | Auto-incrementing primary key    |
| roomCode    | TEXT    | Room identifier                  |
| displayName | TEXT    | User's chosen name               |
| joinedAt    | TEXT    | ISO 8601 timestamp               |

### `push_subscriptions`
| Column       | Type    | Description                     |
|--------------|---------|---------------------------------|
| id           | INTEGER | Auto-incrementing primary key   |
| roomCode     | TEXT    | Room identifier                 |
| endpoint     | TEXT    | Browser push endpoint (unique)  |
| socketId     | TEXT    | Current socket ID               |
| subscription | TEXT    | Full push subscription JSON     |

---

## 🔌 Socket Events

| Event               | Direction       | Payload                                     |
|---------------------|-----------------|---------------------------------------------|
| `join-room`         | Client → Server | `{ displayName, roomCode }`                 |
| `chat-history`      | Server → Client | `[{ id, text, timestamp, replyTo }]`        |
| `send-message`      | Client → Server | `{ text, replyTo? }`                        |
| `new-message`       | Server → Client | `{ id, text, timestamp, replyTo }`          |
| `load-more-messages`| Client → Server | `{ beforeId }`                              |
| `older-messages`    | Server → Client | `[{ id, text, timestamp, replyTo }]`        |
| `typing`            | Client → Server | *(no payload)*                              |
| `user-typing`       | Server → Client | *(no payload)*                              |
| `room-members`      | Server → Client | `["name1", "name2", ...]`                   |
| `create-poll`       | Client → Server | `{ question, options }`                     |
| `new-poll`          | Server → Client | `{ id, question, options, votes, ... }`     |
| `vote-poll`         | Client → Server | `{ pollId, optionIndex }`                   |
| `poll-update`       | Server → Client | `{ id, question, options, votes, ... }`     |
| `poll-history`      | Server → Client | `[poll, poll, ...]`                         |
| `register-push`     | Client → Server | Push subscription JSON                      |

---

## 🚀 Setup & Run

### Prerequisites
- Node.js 18+
- An Expo development environment

### Local Development

```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Create .env (see .env.example)
cp .env.example .env
# Fill in TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, VAPID keys

# Start the server
cd server && node index.js

# In another terminal — start Expo
npx expo start
```

### Deploy to Render

1. Push to GitHub.
2. Go to [Render](https://render.com) → **New** → **Blueprint** → connect your repo.
3. Set environment variables in the Render dashboard:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
4. Deploy! The `render.yaml` handles the rest.
5. Set up [UptimeRobot](https://uptimerobot.com) to ping `https://your-app.onrender.com/ping` every 5 minutes.

---

## 📄 License

MIT
