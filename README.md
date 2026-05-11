# Buildspace — Real-Time Collaborative Cloud IDE

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-20.x-339933)
![Docker](https://img.shields.io/badge/Docker-enabled-2496ED)

Buildspace is a self-hosted collaborative cloud IDE where multiple developers can write, edit, and run code together in real time directly from the browser.

Think:
- VS Code Live Share
- Replit multiplayer
- CodeSandbox

…but fully self-hosted and open source.

---

## 📸 Preview


### Collaborative Editing

![Editor Preview](./docs/editor.png)

### Interactive Terminal

![Terminal Preview](./docs/terminal.png)

### Project Dashboard

![Dashboard Preview](./docs/dashboard.png)

---

## ✨ Features

### 🤝 Real-Time Collaboration

- Multiplayer collaborative editing using **Yjs CRDTs**
- Live cursors and presence indicators
- Conflict-free document synchronization
- Shared project workspaces

### 💻 Developer Experience

- Monaco Editor integration
- Interactive terminal with full stdin/stdout support
- Autosave with debounced persistence
- File explorer with create / rename / delete support
- Drag-to-reorder files

### ⚙️ Runtime Execution

- Secure Docker-based code execution
- Real-time terminal output streaming
- Multi-language execution support

### 🔐 Authentication & Permissions

- Email/password authentication
- JWT access tokens
- httpOnly refresh cookies
- Role-based project permissions (editor / viewer)

### 🌍 Supported Languages

- JavaScript
- TypeScript
- Python
- Go
- C++
- Java

---

## 🏗 Architecture

```text
┌─────────────────────────────┐
│        React Client         │
│  Monaco + Yjs + xterm.js    │
└──────────────┬──────────────┘
               │
      REST API │ WebSockets
               │
┌──────────────▼──────────────┐
│       Express Server        │
│ Auth • Projects • Files     │
└───────┬───────────┬─────────┘
        │           │
        │           │
   PostgreSQL    Redis + Yjs
        │           │
        └────┬──────┘
             │
      Docker Execution
             │
     Sandboxed Containers
```

### ⚡ Real-Time Collaboration Internals

Buildspace uses Yjs CRDTs for conflict-free collaborative editing.

Each connected editor synchronizes document updates over WebSockets using y-websocket.

Presence awareness is used for:
- Live cursors
- Online users
- Shared selections

Document state is periodically persisted using PostgreSQL and Redis for reliability and fast recovery.

## 🛠 Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, Monaco Editor, TailwindCSS |
| Collaboration | Yjs, y-websocket |
| Backend | Node.js, TypeScript, Express, ws |
| Database | PostgreSQL 16 |
| Cache / Presence | Redis 7 |
| Terminal | xterm.js |
| Execution Runtime | Docker, dockerode |
| State Management | Zustand |
| Authentication | JWT, httpOnly Cookies |

---

## 🚀 Quick Start

### Prerequisites

Make sure you have installed:
- Node.js 18+
- Docker Desktop
- PostgreSQL 16
- Redis 7

### 1. Clone the Repository
```bash
git clone https://github.com/vishalpatil-45/Buildspace.git
cd Buildspace
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables

Create `.env` files in your `client` and `server` directories.

**Example `server/.env`:**
```env
PORT=4000
DATABASE_URL=postgresql://postgres:password@localhost:5432/buildspace
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_super_secret_key
CLIENT_URL=http://localhost:5174
```

**Example `client/.env`:**
```env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
```

### 4. Start Infrastructure
```bash
docker compose up -d postgres redis
```

### 5. Run Development Servers
```bash
npm run dev
```

Open **http://localhost:5174** — Register an account and create your first collaborative project.

#### 🔐 Generate Secure Secrets

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 📂 Project Structure

```text
Buildspace/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/      # Editor, FileTree, Terminal, Presence
│       ├── hooks/           # useYjs, useRunWs, useAutosave
│       ├── pages/           # Login, Dashboard, IDE
│       ├── services/        # API + websocket clients
│       └── store/           # Zustand stores
│
├── server/                  # Express + WebSocket backend
│   └── src/
│       ├── routes/          # auth, projects, files
│       ├── ws/              # Yjs sync + code execution
│       ├── db/              # PostgreSQL + Redis
│       ├── docker/          # Container execution logic
│       └── utils/           # JWT, logger, helpers
│
├── shared/                  # Shared TypeScript types
│
├── docker-compose.yml
└── README.md
```

---

## 🐳 Code Execution

Each execution request runs inside an isolated Docker container.

Features:
- Sandboxed execution
- Resource isolation
- Streamed logs and terminal output
- Interactive stdin/stdout support

---

## 🚢 Deployment

Buildspace can be deployed using:
- Docker Compose
- VPS hosting
- Railway
- Render
- Fly.io
- Kubernetes

### Recommended Production Setup
- NGINX or Caddy reverse proxy
- PostgreSQL
- Redis
- Dedicated Docker runtime server

---

## 🛣 Roadmap
- [ ] GitHub integration
- [ ] Voice/video collaboration
- [ ] AI code assistant
- [ ] Multi-container projects
- [ ] Kubernetes sandbox isolation
- [ ] Persistent terminal sessions
- [ ] Collaborative debugging
- [ ] One-click deployment

---

## 🤝 Contributing

Contributions are welcome.

**Development Workflow:**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m "Add amazing feature"`
4. Push to your branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License.

See the LICENSE file for details.

---

## ⭐ Acknowledgements

Built with:
- Yjs
- Monaco Editor
- xterm.js
- Docker
- React
- TypeScript

---

## 👨‍💻 Author

**Vishal Patil**

GitHub: [https://github.com/vishalpatil-45](https://github.com/vishalpatil-45)
