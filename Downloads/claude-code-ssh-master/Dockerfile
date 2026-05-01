# ==============================================================================
# claude-code-ssh — SSH-accessible Claude Code container
# Base: node:24-slim (Debian Bookworm)
# PID 1: s6-overlay v3
# ==============================================================================

FROM node:24-slim AS base

# ---------- build args --------------------------------------------------------
ARG S6_OVERLAY_VERSION=3.2.0.2

# ---------- locale ------------------------------------------------------------
ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8

# ---------- system packages ---------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        openssh-server \
        fail2ban \
        rsyslog \
        tmux \
        git \
        curl \
        ripgrep \
        jq \
        sudo \
        libwrap0 \
        procps \
        locales \
        xz-utils \
        ca-certificates \
        gnupg \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
    && sed -i 's/^# *en_US.UTF-8/en_US.UTF-8/' /etc/locale.gen \
    && locale-gen \
    && rm -rf /var/lib/apt/lists/*

# ---------- GitHub CLI --------------------------------------------------------
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# ---------- Node version manager (n) + pnpm -----------------------------------
# hadolint ignore=DL3016
RUN npm install -g n@10.1.0 pnpm@10.4.1 \
    && npm cache clean --force

# ---------- Python packages for FastAPI backend --------------------------------
# hadolint ignore=DL3013
RUN pip3 install --no-cache-dir --break-system-packages \
        fastapi==0.115.0 \
        uvicorn[standard]==0.32.0 \
        websockets==13.0 \
        python-multipart==0.0.12 \
        pydantic==2.9.0 \
        aiofiles==24.1.0 \
        python-dotenv==1.0.1 \
        prisma==0.13.1 \
        passlib[bcrypt]==1.7.4 \
        python-jose[cryptography]==3.3.0 \
        slowapi==0.1.9

# ---------- s6-overlay v3 -----------------------------------------------------
ARG TARGETARCH
RUN case "${TARGETARCH:-amd64}" in \
        amd64)  S6_ARCH="x86_64" ;; \
        arm64)  S6_ARCH="aarch64" ;; \
        *)      S6_ARCH="x86_64" ;; \
    esac \
    && curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" -o /tmp/s6-noarch.tar.xz \
    && curl -fsSL "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz" -o /tmp/s6-arch.tar.xz \
    && tar -C / -Jxpf /tmp/s6-noarch.tar.xz \
    && tar -C / -Jxpf /tmp/s6-arch.tar.xz \
    && rm -f /tmp/s6-noarch.tar.xz /tmp/s6-arch.tar.xz

# ---------- non-root user -----------------------------------------------------
RUN useradd -m -s /bin/bash -G sudo claude \
    && passwd -d claude \
    && echo "claude ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/claude \
    && chmod 0440 /etc/sudoers.d/claude

# ---------- Claude Code (installed as claude user) ----------------------------
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
USER claude
RUN curl -fsSL https://claude.ai/install.sh | bash
USER root

# ---------- ensure ~/.local/bin is in PATH and UTF-8 locale for all sessions --
RUN printf '%s\n' \
        'export PATH="$HOME/.local/bin:$PATH"' \
        'export LANG=en_US.UTF-8' \
        'export LANGUAGE=en_US:en' \
        'export LC_ALL=en_US.UTF-8' \
    >> /etc/profile.d/claude-code.sh

# ---------- directories & cleanup ---------------------------------------------
RUN mkdir -p /run/sshd /var/log /data \
    && chown claude:claude /data \
    && sed -i 's/^module(load="imklog")/#module(load="imklog")/' /etc/rsyslog.conf \
    && rm -f /etc/ssh/ssh_host_*

# ---------- config files ------------------------------------------------------
COPY sshd_config              /etc/ssh/sshd_config
COPY banner.txt               /etc/ssh/banner.txt
COPY fail2ban/jail.local      /etc/fail2ban/jail.local
COPY fail2ban/action.d/hostsdeny-claude.conf \
                              /etc/fail2ban/action.d/hostsdeny-claude.conf
COPY tmux.conf                /etc/tmux.conf

# ---------- s6-overlay service definitions ------------------------------------
COPY s6-overlay/s6-rc.d/      /etc/s6-overlay/s6-rc.d/

# ---------- scripts -----------------------------------------------------------
COPY scripts/init-setup.sh    /etc/s6-overlay/scripts/init-setup.sh
COPY scripts/stderr-to-json.sh /usr/local/bin/stderr-to-json
RUN chmod +x /etc/s6-overlay/scripts/init-setup.sh /usr/local/bin/stderr-to-json

# ---------- register s6 services in user bundle -------------------------------
RUN for svc in /etc/s6-overlay/s6-rc.d/*/type; do \
        svc_name="$(basename "$(dirname "$svc")")"; \
        if [ "$svc_name" != "user" ] && [ "$svc_name" != "user2" ]; then \
            touch "/etc/s6-overlay/s6-rc.d/user/contents.d/${svc_name}"; \
        fi; \
    done

# ---------- runtime -----------------------------------------------------------
EXPOSE 22 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD ssh-keyscan -T 5 localhost >/dev/null 2>&1 \
        && curl -f http://localhost:8080/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/bin/bash", "-c", "exec /init 2> >(stderr-to-json)"]
