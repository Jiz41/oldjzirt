#!/bin/bash
export TMPDIR=/data/data/com.termux/files/usr/tmp

REPO="/root/Jiz41r1t5u"
cd "$REPO" || { echo "ERR: 移動失敗"; exit 1; }

TODAY=$(date +%Y%m%d)
CURRENT=$(sed -n "s/.*CACHE_NAME = .\([^.]*\)..*/\1/p" sw.js)
BASE="jiz41-${TODAY}"

if   [ "$CURRENT" = "$BASE" ]; then
    NEW="${BASE}-2"
elif echo "$CURRENT" | grep -qE "^${BASE}-[0-9]+$"; then
    N=$(echo "$CURRENT" | grep -oE "[0-9]+$")
    NEW="${BASE}-$((N+1))"
else
    NEW="$BASE"
fi

sed -i "s/const CACHE_NAME = .*/const CACHE_NAME = '${NEW}';/" sw.js
echo "[PUSH] CACHE_NAME: ${CURRENT} → ${NEW}"

git add sw.js
MSG="${1:-chore: bump cache ${NEW}}"
git commit -m "$MSG"
git push origin main && echo "[PUSH] ✅ 完了" || echo "[PUSH] ❌ 失敗"
