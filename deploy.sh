#!/usr/bin/env bash
#
# One-command deploy for the per-store branch model.
#   ./deploy.sh "commit message"
#
# Commits EVERYTHING pending, pushes main, then merges + pushes every store
# branch, so a change can never reach one store but not the others (and
# nothing gets left uncommitted). Clears any stale git lock first.
#
set -euo pipefail
cd "$(dirname "$0")"

# Store branches that each map to their own Dokploy deployment.
BRANCHES=(alrahmah alhiah alzahra)

MSG="${1:-}"
if [ -z "$MSG" ]; then
  echo "usage: ./deploy.sh \"commit message\""
  exit 1
fi

# A crashed tool (or an editor/agent that lost its file handle) leaves these
# behind and blocks every commit, checkout and branch switch — clear them all.
rm -f .git/index.lock .git/HEAD.lock .git/config.lock 2>/dev/null || true
rm -f .git/refs/heads/*.lock 2>/dev/null || true

git checkout main

git add -A
if git diff --cached --quiet; then
  echo "• main: nothing new to commit — pushing current tip + syncing branches."
else
  git commit -m "$MSG"
fi
git push origin main

for b in "${BRANCHES[@]}"; do
  echo "• syncing $b …"
  git checkout "$b"
  git merge main --no-edit
  git push origin "$b"
done
git checkout main

echo
echo "✅ Deployed  main $(git rev-parse --short main)  →  ${BRANCHES[*]}"
echo "⚠️  On the device: fully close & reopen the installed app TWICE (or clear"
echo "    site data) so the service worker drops the old build. Otherwise you'll"
echo "    keep seeing the previous version even though the deploy succeeded."
