#!/bin/bash
# Sistema Integral Conceptos y Diseños — Setup Script
# Run from project root: bash setup.sh
# Or via Claude Code terminal: ! bash setup.sh

set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  Sistema Integral Conceptos y Diseños${RESET}"
echo -e "${BOLD}  Project Setup${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── Check prerequisites ───────────────────────────────────────
if ! command -v pnpm &> /dev/null; then
  echo "ERROR: pnpm not found."
  echo "Install with: npm install -g pnpm"
  exit 1
fi

echo -e "${BOLD}▸ Node version:${RESET} $(node --version)"
echo -e "${BOLD}▸ pnpm version:${RESET} $(pnpm --version)"
echo ""

# ── Install dependencies ──────────────────────────────────────
echo -e "${BOLD}▸ Installing dependencies...${RESET}"
pnpm install
echo ""

# ── Initialize shadcn/ui components ──────────────────────────
echo -e "${BOLD}▸ Installing shadcn/ui components...${RESET}"
pnpm dlx shadcn@latest add \
  button \
  card \
  table \
  form \
  dialog \
  badge \
  input \
  select \
  tabs \
  sheet \
  toast \
  skeleton \
  separator \
  label \
  textarea \
  dropdown-menu \
  avatar \
  progress \
  tooltip \
  scroll-area \
  --yes 2>/dev/null || echo -e "${YELLOW}  shadcn components installed (some may already exist)${RESET}"
echo ""

# ── Set up environment ────────────────────────────────────────
echo -e "${BOLD}▸ Setting up environment file...${RESET}"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo -e "  Created ${GREEN}.env.local${RESET} from .env.example"
  echo -e "  ${YELLOW}ACTION REQUIRED: Fill in your values in .env.local${RESET}"
else
  echo "  .env.local already exists — skipping"
fi
echo ""

# ── Git init ──────────────────────────────────────────────────
if [ ! -d .git ]; then
  echo -e "${BOLD}▸ Initializing git repository...${RESET}"
  git init
  git remote add origin git@github.com:conceptosydisenos/conceptos-disenos.git
  git add .
  git commit -m "feat: initial scaffolding — Sistema Integral Conceptos y Diseños"
  echo ""
fi

# ── Done ─────────────────────────────────────────────────────
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}  Setup complete!${RESET}"
echo ""
echo -e "${BOLD}  Next steps:${RESET}"
echo "  1. Fill in .env.local with your credentials"
echo ""
echo "  2. Configure Clerk Dashboard:"
echo "     a. User & Authentication → Social Connections → Google → Enable"
echo "     b. Webhooks → Add endpoint:"
echo "        URL: https://your-domain.com/api/webhooks/clerk"
echo "        Events: user.created, user.updated, user.deleted"
echo "     c. Copy the webhook Signing Secret → CLERK_WEBHOOK_SECRET in .env.local"
echo ""
echo "  3. Create Neon database branch for development:"
echo "     Neon Console → Branches → Create branch 'dev'"
echo "     Use the dev branch pooler URL in .env.local"
echo ""
echo "  4. Run migrations:"
echo "     pnpm db:migrate"
echo ""
echo "  5. Start the dev server:"
echo "     pnpm dev"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
