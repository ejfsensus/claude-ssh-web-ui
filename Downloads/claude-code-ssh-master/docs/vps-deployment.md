# VPS & Local Docker Deployment

## Local Testing

```bash
# Build the image
docker build -t claude-code-ssh .

# Run the container
docker run -d \
  -e SSH_PUBLIC_KEY="$(cat ~/.ssh/id_ed25519.pub)" \
  -p 2222:22 \
  -v claude-data:/data \
  --name claude-ssh \
  claude-code-ssh

# Connect
ssh claude@localhost -p 2222 -i ~/.ssh/id_ed25519
```

## VPS Deployment (Hetzner, DigitalOcean, Oracle Cloud)

On a VPS you get full `iptables` support for fail2ban. Add `--cap-add=NET_ADMIN`:

```bash
docker run -d \
  -e SSH_PUBLIC_KEY="$(cat ~/.ssh/id_ed25519.pub)" \
  -p 22:22 \
  -v claude-data:/data \
  --cap-add=NET_ADMIN \
  --name claude-ssh \
  claude-code-ssh
```

To switch fail2ban from `hostsdeny` to `iptables`, edit `/etc/fail2ban/jail.local` inside the container:

```ini
[DEFAULT]
banaction = iptables-multiport
```

## Debugging

```bash
# Check container logs
docker logs -f claude-ssh

# Shell into the container
docker exec -it claude-ssh bash

# Check service status
docker exec claude-ssh bash -c 's6-rc -l list'

# Check fail2ban status
docker exec claude-ssh bash -c 'fail2ban-client status sshd'
```
