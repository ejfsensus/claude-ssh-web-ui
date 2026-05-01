# Architecture

## Process Tree

The container uses **s6-overlay v3** as PID 1 for process supervision:

```
s6-overlay (PID 1)
├── init-setup (oneshot)
│   └── Volume init, SSH keys, DH moduli filtering, user setup
├── syslog (longrun, depends: init-setup)
│   └── rsyslogd — routes auth logs to /var/log/auth.log for fail2ban
├── sshd (longrun, depends: init-setup)
│   └── Hardened OpenSSH daemon (key-only, modern ciphers)
└── fail2ban (longrun, depends: syslog, sshd)
    └── Monitors auth.log, bans IPs via /etc/hosts.deny (hostsdeny action)
```

## Volume Layout

Mount a volume at `/data` for persistence:

```
/data/
├── home/           → claude user's home directory (projects, config, auth)
├── ssh_host_keys/  → persisted Ed25519 + RSA host keys (no TOFU warnings on redeploy)
├── fail2ban/       → ban database (persists across restarts)
└── workspace/      → symlinked to /workspace
```

## Init Script Flow

`scripts/init-setup.sh` runs as an s6-rc oneshot (before any services start):

1. Import container environment variables from s6-overlay
2. Create volume directories (`/data/home`, `/data/ssh_host_keys`, etc.)
3. Generate or restore SSH host keys (Ed25519 + RSA 4096)
4. Filter DH moduli (>= 3071 bits only)
5. Set user home to `/data/home` via `usermod`
6. Write `SSH_PUBLIC_KEY` to `authorized_keys`
7. Set up workspace symlink
8. Restore fail2ban database
9. Configure `ANTHROPIC_API_KEY` and timezone

The script is idempotent — safe to run on every container restart.

## Security Model

- **No passwords** — `PasswordAuthentication no`, `UsePAM no`
- **Key-only** — `AuthenticationMethods publickey`
- **Modern crypto** — ChaCha20-Poly1305, AES-GCM, Curve25519, ETM MACs
- **fail2ban** — hostsdeny banaction (works without NET_ADMIN on Railway)
- **Non-root** — user `claude` with sudo NOPASSWD:ALL (single-user dev container)
- **Audit logging** — VERBOSE sshd logs via rsyslog

## Why s6-overlay Over supervisord?

- Designed for containers (proper PID 1 behavior, signal propagation)
- Declarative service dependencies
- Accurate health detection (exits on failure, letting the orchestrator restart)
- Used by major Docker images (LinuxServer.io, SeleniumHQ)
