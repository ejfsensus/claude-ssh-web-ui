# Claude SSH Web Interface - Phase 1 Complete ✓

Modern web interface for Claude Code CLI running on Railway. This adds a premium web UI to the existing SSH-accessible Claude container.

## What's New

This repository now includes a **modern web interface** alongside the existing SSH access:

- **WebSocket streaming chat** - Real-time communication with Claude Code CLI
- **Persistent sessions** - Chat history stored in SQLite database
- **Modern UI** - Dark theme, responsive design, built with Next.js 15
- **Full Claude Code features** - Access all CLI capabilities from browser
- **Background processes** - Monitor and manage long-running tasks
- **File operations** - Upload/download/workspace integration (Phase 2)

Both SSH (port 22) and Web UI (port 8080) run simultaneously in the same container.

## Quick Start

### Deploy on Railway

1. **Deploy from GitHub**
   - Click "Deploy on Railway" or create new project from this repo
   - Railway will detect the Dockerfile and deploy automatically

2. **Set Environment Variables**
   ```bash
   SSH_PUBLIC_KEY=your-ssh-public-key     # Required for SSH access
   ANTHROPIC_API_KEY=your-api-key          # Required for Claude
   WEB_UI_PASSWORD=optional-password      # Optional: password protect web UI
   ```

3. **Access Your Instance**
   - **SSH**: `ssh claude@<your-domain>.up.railway.app -p 22 -i your-key`
   - **Web UI**: `https://<your-domain>.up.railway.app`

### Local Development

See `web-ui/README.md` for detailed local development instructions.

```bash
# Backend
cd web-ui/backend
pip install -r requirements.txt
python3 -m uvicorn main:app --reload

# Frontend
cd web-ui/frontend
npm install
npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│           Railway Container                      │
│                                                   │
│  ┌─────────────┐       ┌──────────────────┐     │
│  │   SSH       │       │   Web UI (8080)  │     │
│  │   (22)      │       │                  │     │
│  │             │       │  ┌────────────┐  │     │
│  │  tmux +     │       │  │  FastAPI   │  │     │
│  │  Claude CLI │       │  │  Backend   │  │     │
│  │             │       │  └────────────┘  │     │
│  └─────────────┘       │       ⬇         │     │
│                        │  Next.js 15      │     │
│                        │  Frontend        │     │
│                        └──────────────────┘     │
│                                                   │
│              /data (persistent volume)            │
│     ├── home/           ├── sessions.db          │
│     ├── workspace/      └── uploads/             │
└─────────────────────────────────────────────────┘
```

**Technology Stack:**

- **Backend**: FastAPI 0.115 + WebSockets + SQLite
- **Frontend**: Next.js 15 + React 19 + Tailwind CSS
- **State**: Zustand + LocalStorage persistence
- **Process**: s6-overlay supervises both SSH and web-ui services

## Features

### Currently Implemented (Phase 1)

✅ **Real-time Chat**
- WebSocket streaming of Claude responses
- Message history with session persistence
- Markdown rendering with syntax highlighting
- Auto-reconnect on network issues

✅ **Session Management**
- Create multiple chat sessions
- Session persistence across browser restarts
- Switch between sessions
- Session list in sidebar

✅ **Modern UI**
- Dark theme optimized for developer workflows
- Responsive design (desktop, tablet, mobile)
- Collapsible sidebar
- Smooth animations

✅ **Infrastructure**
- Multi-port Docker container (SSH + HTTP)
- s6-overlay process supervision
- Railway deployment ready
- Health checks and monitoring

### Planned Features (Phase 2+)

⏳ **File Operations**
- Drag-and-drop file upload
- Workspace file browser
- File attachment to messages
- Download generated files

⏳ **Background Processes**
- Start/stop processes from UI
- Real-time output streaming
- Process list with status indicators

⏳ **MCP Integration**
- MCP server management UI
- Connection status monitoring
- Tool execution visualization

⏳ **Advanced Features**
- Voice input/output (TTS/STT)
- Session search and filtering
- Export/import sessions
- Multi-language support

## Project Structure

```
web-ui/
├── backend/                   # FastAPI Python backend
│   ├── main.py               # Application entry point
│   ├── requirements.txt      # Python dependencies
│   ├── core/                 # Config, security, database
│   │   ├── config.py         # Environment variables
│   │   ├── security.py       # JWT authentication
│   │   ├── database.py       # SQLite + Prisma
│   │   └── claude_wrapper.py # Claude Code CLI wrapper
│   └── api/                  # API endpoints
│       ├── chat.py           # WebSocket streaming
│       ├── sessions.py       # Session CRUD
│       ├── files.py          # File operations (stub)
│       └── processes.py      # Background processes (stub)
│
├── frontend/                 # Next.js 15 frontend
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   │   ├── page.tsx     # Main chat interface
│   │   │   ├── layout.tsx   # Root layout
│   │   │   └── globals.css  # Design system
│   │   ├── components/
│   │   │   ├── chat/        # Chat components
│   │   │   └── ui/          # Reusable UI components
│   │   └── lib/
│   │       ├── hooks/       # Custom React hooks
│   │       ├── store/       # Zustand state
│   │       └── api/         # API client
│   ├── package.json
│   └── next.config.js
│
└── mockup/                   # HTML design mockups
    ├── Chat-Interface-Mockup.html
    ├── Chat-Interface-Minimal-Mockup.html
    └── Design-System.md
```

## Design System

The web interface follows modern design principles optimized for developer tools:

**Color Palette (Dark Theme)**
- Backgrounds: `#0a0a0b` / `#141415` / `#1c1c1e`
- Text: `#f5f5f5` / `#a1a1aa` / `#71717a`
- Accents: Blue `#3b82f6`, Green `#22c55e`, Red `#ef4444`

**Typography**
- Font: System UI (-apple-system, Inter, Segoe UI)
- Base size: 15px messages, 14px UI
- Line height: 1.6 for readability
- Mono: SF Mono, Monaco, Consolas

**Anti-Patterns Avoided**
- No purple gradients (overused in AI products)
- No emoji as icons (unprofessional)
- No generic card designs
- High contrast for accessibility

See `web-ui/mockup/Design-System.md` for complete design documentation.

## API Documentation

### WebSocket Endpoint

**`WS /api/ws/chat`**

Real-time bidirectional streaming chat.

**Client sends:**
```json
{
  "type": "message",
  "content": "Hello Claude",
  "sessionId": "uuid",
  "attachments": ["file.py"]
}
```

**Server streams:**
```json
{"type": "connected", "connectionId": "uuid"}
{"type": "token", "content": "Hello", "sessionId": "uuid"}
{"type": "done", "sessionId": "uuid"}
{"type": "error", "message": "Error text"}
```

### REST Endpoints

- `GET /api/health` - Health check
- `GET /api/sessions` - List all sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/{id}/messages` - Get session messages
- `POST /api/files/upload` - Upload file (stub)
- `GET /api/files/list` - List workspace files (stub)
- `POST /api/processes/start` - Start process (stub)
- `GET /api/processes` - List processes (stub)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SSH_PUBLIC_KEY` | ✅ | - | SSH public key for terminal access |
| `ANTHROPIC_API_KEY` | ✅ | - | Anthropic API key for Claude |
| `WEB_UI_PASSWORD` | ❌ | - | Optional password for web UI |
| `NODE_VERSION` | ❌ | 24 | Node.js version |
| `PNPM_VERSION` | ❌ | 10.4.1 | pnpm version |

## Security

- **Authentication**: Optional password protection via JWT
- **CORS**: Configured for Railway domain
- **Input validation**: Pydantic schemas on all endpoints
- **Rate limiting**: Ready for implementation
- **HTTPS**: Railway provides automatic TLS

## Development Status

✅ **Phase 1: Foundation** (Complete)
- FastAPI backend with WebSocket
- Next.js 15 frontend with chat UI
- Session management and persistence
- Docker multi-port support
- Railway deployment ready

⏳ **Phase 2: Core Features** (Next)
- File upload/download
- Enhanced session management
- Background process monitoring
- File browser

⏳ **Phase 3: Advanced Features**
- MCP integration UI
- Advanced search/filtering
- Session export/import
- Performance optimization

⏳ **Phase 4: Testing & Polish**
- Unit tests (Pytest, Jest)
- E2E tests (Playwright)
- Security audit
- Performance optimization

⏳ **Phase 5: Voice Features** (Optional)
- TTS/STT integration
- Voice commands
- Hands-free mode

## Troubleshooting

**WebSocket not connecting?**
- Check backend is running on port 8080
- Verify `NEXT_PUBLIC_WS_URL` environment variable
- Check browser console for errors

**Messages not saving?**
- Check SQLite database permissions
- Verify `/data/web-ui/` directory exists
- Check database connection in logs

**SSH still works when web UI fails?**
- Yes! SSH and web UI are independent
- s6-overlay runs both as separate services
- Web UI issues don't affect SSH access

## Contributing

Contributions welcome! Please:

1. Test both SSH and web UI functionality
2. Follow existing design patterns
3. Add tests for new features
4. Update documentation

## License

MIT License - See parent project LICENSE file.

## Credits

- **Claude Code SSH**: Original SSH-accessible container
- **Web Interface**: FastAPI + Next.js implementation
- **Design**: Based on modern developer tool best practices

---

**Note**: This web interface addition maintains full compatibility with the original SSH-only workflow. All existing features continue to work as before.
