# Deploy and Host claude-code-ssh on Railway

Claude Code SSH gives you instant SSH access to Anthropic's Claude Code CLI from any device — phone, tablet, or laptop. Deploy on Railway in minutes and start AI-powered coding from anywhere, with persistent sessions that survive disconnects.

## About Hosting claude-code-ssh

Claude Code is powerful, but it requires a terminal. That's fine at your desk — not so much from your phone on the couch, or your tablet at a coffee shop. Claude Code SSH solves this by packaging Claude Code into a secure, always-on Railway service you can SSH into from any device. Your coding sessions persist through WiFi switches, app closures, and even Railway redeployments. Just reconnect and pick up where you left off. Set one Railway variable (your SSH key), enable the TCP proxy, attach a volume, and you're coding with Claude in under 5 minutes.

## Common Use Cases

- **Code from your phone** — Use Claude Code from Termius, Blink Shell, or JuiceSSH with a mobile-optimized terminal experience. Switch WiFi, lock your phone, come back later — your session is still there.
- **AI pair programming from anywhere** — Access Claude Code without installing anything locally. Works with your Claude Pro/Max subscription or API key.
- **Secure remote development** — Clone private repos, build full-stack projects, create PRs — all from an isolated Railway service with hardened SSH and brute-force protection.

## Dependencies for claude-code-ssh Hosting

- **Claude Code authentication** — A Claude Pro/Max subscription (via `claude login`) or an Anthropic API key
- **SSH key pair** — Ed25519 key for secure access (generate in Termius on mobile or via `ssh-keygen` on desktop)

### Deployment Dependencies

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) — Anthropic's official AI coding assistant
- [Railway TCP Proxy](https://docs.railway.com/reference/tcp-proxy) — Required for SSH access to the Railway service
- [Railway Volumes](https://docs.railway.com/reference/volumes) — Persistent storage for projects, auth, and sessions

### Implementation Details

Connect to your Railway service and start coding:

```bash
ssh claude@<railway-host> -p <port> -i ~/.ssh/id_ed25519
tmux new -s dev
claude
```

**What's included out of the box:**

- **Hardened SSH** — Key-only auth, modern ciphers (ChaCha20-Poly1305, AES-256-GCM), sshaudit.com compliant
- **Brute-force protection** — fail2ban bans attackers after 3 failures, repeat offenders blocked for a week
- **Persistent tmux** — Mobile-optimized config with touch scrolling, 256-color support, and 50k line scrollback
- **Node.js 24 + pnpm** — Full-stack ready, with optional version overrides via Railway variables
- **GitHub CLI** — Clone private repos using fine-grained PATs configured through Railway variables
- **Multi-device access** — Add SSH keys from every device you own, connect from anywhere
- **Auto-updating** — Claude Code updates automatically on every Railway redeploy

## Why Deploy claude-code-ssh on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying claude-code-ssh on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.

---

<sub>This is a community project and is not affiliated with, endorsed by, or officially supported by Anthropic. Claude Code is a product of Anthropic. All trademarks belong to their respective owners.</sub>
