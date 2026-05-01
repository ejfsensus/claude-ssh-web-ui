# Claude SSH Web Interface

Modern web interface for Claude Code CLI running on Railway.

## Architecture

**Backend:** FastAPI with WebSocket streaming
- Wraps existing Claude Code CLI
- SQLite database for session persistence
- Real-time chat via WebSockets
- File upload/download
- Background process monitoring

**Frontend:** Next.js 15 (TODO)
- shadcn/ui components
- Tailwind CSS
- React 19
- Server + Client Components

## Deployment

The web UI runs alongside SSH on Railway:
- Port 22: SSH (existing)
- Port 8080: HTTP/WebSocket (new)

Both services are managed by s6-overlay.

## Backend Structure

```
web-ui/backend/
├── main.py              # FastAPI application entry point
├── requirements.txt     # Python dependencies
├── core/
│   ├── config.py        # Configuration & environment variables
│   ├── security.py      # Authentication & JWT
│   ├── database.py      # Prisma database operations
│   └── claude_wrapper.py # Claude Code CLI wrapper
└── api/
    ├── chat.py          # WebSocket chat endpoint
    ├── sessions.py      # Session management
    ├── files.py         # File operations
    └── processes.py     # Background processes
```

## API Endpoints

### WebSocket
- `WS /api/ws/chat` - Real-time chat streaming

### REST
- `GET /api/health` - Health check
- `GET /api/sessions` - List sessions
- `POST /api/sessions` - Create session
- `GET /api/sessions/{id}/messages` - Get messages
- `POST /api/files/upload` - Upload files
- `GET /api/files/list` - List workspace files
- `POST /api/processes/start` - Start background process

## Environment Variables

```bash
# Optional: Password protection for web UI
WEB_UI_PASSWORD=your-password

# Optional: Custom Railway domain (auto-detected)
RAILWAY_PUBLIC_DOMAIN=your-domain.up.railway.app

# Optional: Claude workspace (default: /workspace)
CLAUDE_WORKSPACE=/workspace
```

## Development

### Backend

```bash
cd web-ui/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn main:app --reload --port 8080
```

### Frontend (TODO)

```bash
cd web-ui/frontend
npm install
npm run dev
```

## Design System

Two UI mockups are available in `web-ui/mockup/`:
1. **Chat-Interface-Mockup.html** - Full-featured dark theme
2. **Chat-Interface-Minimal-Mockup.html** - Minimalist light theme

See `web-ui/mockup/Design-System.md` for complete design specifications.

## Status

✅ Phase 1 Foundation (In Progress):
- ✅ Dockerfile updated with Python + FastAPI
- ✅ Backend structure created
- ✅ WebSocket chat endpoint
- ✅ s6-overlay service configured
- ⏳ Next.js frontend (TODO)
- ⏳ Testing & deployment (TODO)
