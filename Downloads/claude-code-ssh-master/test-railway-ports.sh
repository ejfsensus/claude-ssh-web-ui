#!/bin/bash
# Railway Dual-Port Configuration Test Script

echo "🔧 Railway Dual-Port Configuration Helper"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "📋 Current Status:"
echo "----------------"
echo ""

echo "🌐 Web UI (port 8080):"
echo -n "   Status: "
if curl -s https://claude-ssh-web-ui-production.up.railway.app/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Working${NC}"
    echo "   URL: https://claude-ssh-web-ui-production.up.railway.app"
else
    echo -e "${RED}❌ Not accessible${NC}"
fi

echo ""
echo "🔑 SSH (port 22):"
echo -n "   Status: "
if timeout 5 ssh -o ConnectTimeout=3 -o BatchMode=yes claude-ssh-railway "echo test" 2>&1; then
    echo -e "${GREEN}✅ Working${NC}"
    echo "   Command: ssh claude-ssh-railway"
else
    echo -e "${RED}❌ Not accessible${NC}"
    echo "   Command: ssh claude-ssh-railway"
    echo ""
    echo "   💡 Railway TCP Proxy needs to be configured"
fi

echo ""
echo "📝 Configuration Instructions:"
echo "------------------------------"
echo ""
echo "To enable SSH access on Railway:"
echo ""
echo "1. Open Railway Dashboard:"
echo "   https://railway.com/project/f414170c-bda0-4d10-bc8d-952bc9f77750"
echo ""
echo "2. Go to: Settings → Networking"
echo ""
echo "3. Look for 'TCP Proxy' or 'Expose Ports'"
echo ""
echo "4. Add configuration:"
echo "   - Port: 22"
echo "   - Type: TCP"
echo "   - Name: ssh"
echo ""
echo "5. Save and wait for redeploy"
echo ""
echo "Or, use the Railway CLI:"
echo "   railway domain --tcp 22"
echo ""

echo "🔍 Current Railway Configuration:"
echo "--------------------------------"
echo ""

# Check if Railway CLI is configured
if command -v railway &> /dev/null; then
    echo "✅ Railway CLI installed"
    echo ""
    echo "Current domains:"
    railway domain 2>&1 | grep -E "claude|http" || echo "  No public domains configured"
else
    echo "⚠️  Railway CLI not found"
    echo "   Install: npm install -g @railway/cli"
fi

echo ""
echo "✨ Testing complete!"
