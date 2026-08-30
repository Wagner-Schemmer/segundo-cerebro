#!/bin/bash
set -e
cd "$HOME/Documentos/segundo-cerebro"
# só commita se houver mudança
if [ -z "$(git status --porcelain)" ]; then
  echo "sem mudanças"
  exit 0
fi
git add -A
msg="sync $(date '+%Y-%m-%d %H:%M') — vault + Notion + SIGAA"
git commit -m "$msg" || true
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push origin "$BRANCH" 2>&1 | head -20
echo "push ok $msg"
