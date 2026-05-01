# Railway Dual-Port Configuration Guide

## Current Status
✅ **Web UI (port 8080)**: Working at https://claude-ssh-web-ui-production.up.railway.app
❌ **SSH (port 22)**: Needs TCP Proxy configuration

## The Problem
Railway typically exposes **one PORT per service**. When we set `PORT=8080`, Railway exposed port 8080 as the primary HTTP port, which may have disabled or conflicted with the SSH TCP proxy configuration.

## Solution Options

### Option 1: Remove PORT=8080, Use Railway's TCP Proxy for Both

**Theory:** Railway's TCP Proxy can handle multiple ports, but it's not explicitly exposed in the basic CLI.

**Steps:**
1. Remove the PORT environment variable
2. Configure Railway to proxy both port 22 (SSH) and port 8080 (HTTP)
3. Update railway.json to declare both ports

### Option 2: Create Two Separate Railway Services (Recommended)

**Service A: SSH Access**
- Uses Railway's built-in TCP proxy for SSH
- Port 22 exposed
- Same Docker image, different entrypoint

**Service B: Web UI**  
- PORT=8080 exposed as HTTP
- Connects to same database/volume for persistence

### Option 3: Use Railway's Multi-Port Feature

Railway recently added support for exposing multiple ports per service. Here's how:

**Via Railway CLI:**
```bash
# Check current domain configuration
railway domain

# Try to add TCP proxy for port 22
railway domain --port 22 --service claude-ssh-web-ui
```

**Via Railway Dashboard:**
1. Go to: https://railway.com/project/f414170c-bda0-4d10-bc8d-952bc9f77750
2. Select your service
3. Settings → Networking → TCP Proxy
4. Add: Port 22, Type: TCP

### Option 4: Reverse Proxy Approach (Most Reliable)

Instead of exposing both ports directly, run a reverse proxy (Nginx) that:
- Listens on Railway's public PORT (8080)
- Forwards /ssh/* to WebSocket connections
- Exposes SSH through a WebSocket-to-TCP bridge

This is more complex but guarantees both work.

## Recommended Action Plan

**Immediate (Quick Fix):**
1. Keep using the **Web UI** which is working perfectly
2. SSH access requires Railway TCP Proxy configuration in dashboard

**Short-term:**
Create a second Railway service specifically for SSH:
- Same code/Dockerfile
- Just remove the web-ui service from s6-overlay
- Get dedicated SSH TCP proxy

**Long-term:**
Refactor to use the web UI as the primary interface (it's better anyway!)

## Testing Commands

```bash
# Test Web UI
curl https://claude-ssh-web-ui-production.up.railway.app/api/health

# Test SSH (once configured)
ssh claude-ssh-railway "echo 'SSH works!'"
```

## Railway Dashboard Links

- **Project:** https://railway.com/project/f414170c-bda0-4d10-bc8d-952bc9f77750
- **Service:** claude-ssh-web-ui (9a6b6531-9d5c-4622-bf7c-64127574cf9a)
- **Environment:** production (989fca3f-478d-434f-9006-e2fbc11787fc)
