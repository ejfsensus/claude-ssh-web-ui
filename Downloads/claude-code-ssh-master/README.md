# Claude Code SSH

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/claude-code-mobile?referralCode=fhlcDU&utm_medium=integration&utm_source=template&utm_campaign=generic)

[![Docker Build](https://github.com/Ntelikatos/claude-code-ssh/actions/workflows/docker-build.yml/badge.svg)](https://github.com/Ntelikatos/claude-code-ssh/actions/workflows/docker-build.yml)
[![Lint Dockerfile](https://github.com/Ntelikatos/claude-code-ssh/actions/workflows/lint-dockerfile.yml/badge.svg)](https://github.com/Ntelikatos/claude-code-ssh/actions/workflows/lint-dockerfile.yml)
[![ShellCheck](https://github.com/Ntelikatos/claude-code-ssh/actions/workflows/shellcheck.yml/badge.svg)](https://github.com/Ntelikatos/claude-code-ssh/actions/workflows/shellcheck.yml)
[![Trivy Security Scan](https://github.com/Ntelikatos/claude-code-ssh/actions/workflows/trivy.yml/badge.svg)](https://github.com/Ntelikatos/claude-code-ssh/actions/workflows/trivy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Run Claude Code from anywhere via SSH. Deploy on Railway and code from your phone in under 5 minutes.

## What You Get

- **Claude Code CLI** ready to use over SSH from any device
- **Persistent sessions** — tmux is pre-configured for mobile. Switch WiFi, close the app, come back later. Your session is still there.
- **Hardened SSH** — key-only auth, modern ciphers, sshaudit.com compliant. No passwords, no weak algorithms.
- **Brute-force protection** — fail2ban bans attackers automatically (1 hour ban after 3 failures, 1 week for repeat offenders)
- **Mobile-optimized tmux** — pre-tuned for Termius, Blink, and JuiceSSH. No broken characters, no escape sequence leaks.
- **Node.js 24 + pnpm** — ready for full-stack development. Override versions with `NODE_VERSION` and `PNPM_VERSION` env vars.
- **GitHub integration** — clone private repos with a fine-grained PAT scoped to specific repos only
- **Persistent storage** — your projects, auth, and config survive redeployments via Railway volumes
- **Multi-device access** — add SSH keys from your laptop, phone, and tablet. Connect from anywhere.

---

## Deploy to Railway

### Step 1: Deploy the Template

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/claude-code-mobile?referralCode=fhlcDU&utm_medium=integration&utm_source=template&utm_campaign=generic)

Click the button above, or manually create a project on [railway.com](https://railway.com) and deploy from this GitHub repo.

### Step 2: Set Your SSH Public Key

In Railway dashboard, go to your service **Variables** and add:

| Variable         | Value                                         |
| ---------------- | --------------------------------------------- |
| `SSH_PUBLIC_KEY` | Your public key (see below for how to get it) |

**From desktop** — copy your existing key:

```bash
cat ~/.ssh/id_ed25519.pub
```

**From mobile (Termius)** — generate a new key:

1. Open Termius > **Keychain** > **Keys** > **+** > **Generate**
2. Select **Ed25519**, give it a name, save
3. Tap the key > **Export public key** > copy the text

**Using multiple devices?** Paste all public keys into `SSH_PUBLIC_KEY`, one per line:

```
ssh-ed25519 AAAA...laptop-key... you@laptop
ssh-ed25519 AAAA...phone-key... mobile
```

### Step 3: Enable TCP Proxy

1. Go to your service **Settings** > **Networking**
2. Under **TCP Proxy**, click **Enable** on port `22`
3. Railway assigns you a domain and port, e.g. `shuttle.proxy.rlwy.net:15140`

Save these — you need them to connect.

### Step 4: Create and Attach a Volume

1. In Railway dashboard, right-click on your project canvas > **"Add Volume"**
2. Attach it to your service
3. Set the **mount path** to `/data`
4. Redeploy if prompted

This persists your projects, SSH host keys, tmux sessions, and Claude Code auth across redeployments. Without it, all data is lost on restart.

### Step 5: Connect

```bash
ssh claude@shuttle.proxy.rlwy.net -p 15140 -i ~/.ssh/id_ed25519
```

Replace the domain and port with your values from Step 3.

### Step 6: Authenticate Claude Code

Choose one method:

**Option A: Claude Account (Pro/Max subscription)** — recommended

```bash
claude login
```

This prints a URL. Open it in any browser, sign in with your Claude account, done. No API key needed.

**Option B: API Key**

Add `ANTHROPIC_API_KEY` in Railway Variables (triggers redeploy), or set it manually:

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
echo 'export ANTHROPIC_API_KEY=sk-ant-your-key-here' >> ~/.bashrc
```

Auth persists across restarts via the `/data` volume.

### Step 7: Start Coding

```bash
tmux new -s dev
claude
```

Detach anytime with `Ctrl+B` then `D`. Reattach later with `tmux attach -t dev`.

### Step 8: Clone Your Repos (optional)

Use a fine-grained Personal Access Token to grant access to **specific repos only**.

1. Go to [GitHub > Settings > Developer settings > Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click **Generate new token**
3. Set **Resource owner** to your account or org
4. Set **Repository access** to **Only select repositories** and pick the repos you need
5. Under **Permissions > Repository permissions**, grant:
   - **Contents**: Read and write (clone, push, branches)
   - **Pull requests**: Read and write (create/merge PRs)
   - **Issues**: Read and write (create/comment on issues)
6. Generate and copy the token
7. In Railway dashboard, add it as a variable:

| Variable       | Value                |
| -------------- | -------------------- |
| `GITHUB_TOKEN` | `github_pat_xxxx...` |

After redeploy, just clone:

```bash
cd /workspace
git clone https://github.com/you/your-private-repo
claude
```

Auth persists across restarts via the `/data` volume.

**Need repos from multiple orgs?** Create a separate Railway service per org, each with its own scoped `GITHUB_TOKEN`. This keeps access isolated — one container never touches another org's repos.

> **Alternative:** `gh auth login` is also available but grants access to **all** repos across all your orgs. Use it only if you're comfortable with that scope.

---

## Mobile Setup

### Termius (iOS / Android)

1. **Generate a key** (if you don't have one): **Keychain** > **Keys** > **+** > **Generate** > **Ed25519**
2. **Copy the public key**: tap the key > **Export public key** > copy text
3. **Add it to Railway**: paste into `SSH_PUBLIC_KEY` variable (alongside your desktop key if needed)
4. **Create a host**: **Hosts** > **+**
   - **Hostname**: your Railway TCP domain (e.g. `shuttle.proxy.rlwy.net`)
   - **Port**: your assigned port (e.g. `15140`)
   - **Username**: `claude`
   - **Key**: select your generated key
5. **Enable keep-alive**: host settings > advanced > **Keep connection alive**
6. Connect and run `tmux new -s dev && claude`

### Blink Shell (iOS)

1. Import your Ed25519 private key in Blink's key management
2. Configure the host:
   ```
   ssh claude@shuttle.proxy.rlwy.net -p 15140
   ```

### JuiceSSH (Android)

1. **Identities** > add new > import your Ed25519 private key
2. **Connections** > add new > set host, port, username `claude`
3. Select your identity, enable keep-alive

---

## Persistent Sessions

Your SSH connection will drop — WiFi switches, cellular handoffs, locking your phone. That's fine. tmux keeps your session alive on the server.

```bash
# Create a session
tmux new -s dev

# Detach (session keeps running): Ctrl+B, then D

# Reattach after reconnecting
tmux attach -t dev

# List all sessions
tmux ls
```

**One-liner** — auto-attach on connect (save this in your SSH client):

```bash
ssh claude@<host> -p <port> -i ~/.ssh/id_ed25519 -t "tmux attach -t dev || tmux new -s dev"
```

The included tmux config is tuned for mobile: 256-color support, mouse/touch scrolling, low escape-time for mobile latency, and 50k line scrollback.

---

## Environment Variables

| Variable            | Required | Default  | Description                                                                |
| ------------------- | -------- | -------- | -------------------------------------------------------------------------- |
| `SSH_PUBLIC_KEY`    | Yes      | —        | Ed25519 public key(s) for SSH auth. Multiple keys supported, one per line. |
| `ANTHROPIC_API_KEY` | No       | —        | Claude API key. Alternative to `claude login`.                             |
| `GITHUB_TOKEN`      | No       | —        | Fine-grained PAT for cloning private repos. Scoped to specific repos only. |
| `NODE_VERSION`      | No       | `24`     | Node.js version (e.g. `22`, `20.18.0`). Uses `n` to switch at boot.        |
| `PNPM_VERSION`      | No       | `latest` | pnpm version (e.g. `9.15.0`, `10`). Uses corepack to switch at boot.       |
| `TZ`                | No       | `UTC`    | Timezone (e.g. `America/New_York`, `Europe/London`)                        |

---

## Security

- **Key-only authentication** — passwords completely disabled
- **Modern ciphers** — ChaCha20-Poly1305, AES-256-GCM (AEAD only)
- **Modern key exchange** — Curve25519, DH Group 16/18
- **ETM-only MACs** — HMAC-SHA2-512-ETM, HMAC-SHA2-256-ETM
- **fail2ban** — 3 failed attempts = 1 hour ban, repeat offenders = 1 week ban
- **Non-root user** — all operations run as unprivileged `claude` user
- **DH moduli filtered** — only >= 3071-bit entries
- **sshaudit.com compliant** — passes audit with modern-only algorithms

---

## Troubleshooting

**Host key warning after redeploy**: Remove the old key:

```bash
ssh-keygen -R "[your-host]:port"
```

**Connection refused**: Ensure TCP Proxy is enabled in Railway on port 22.

**Permission denied (publickey)**: Verify `SSH_PUBLIC_KEY` contains your public key. On mobile, re-export from Termius and update the Railway variable.

**Claude Code not authenticated**: Run `claude login` inside the container, or set `ANTHROPIC_API_KEY`.

**tmux session lost**: Sessions persist while the container runs. If the container restarted, start a new session. Your files on `/data` are safe.

---

## Cost

| Platform          | Cost      | Notes                             |
| ----------------- | --------- | --------------------------------- |
| Railway Hobby     | ~$5-10/mo | Pay-as-you-go, TCP proxy included |
| Hetzner CX22      | ~$4/mo    | 2 vCPU, 4GB RAM, full iptables    |
| Oracle Cloud Free | $0        | ARM A1, always-free tier          |

See [docs/vps-deployment.md](docs/vps-deployment.md) for VPS and local Docker deployment instructions.

---

## License

MIT
