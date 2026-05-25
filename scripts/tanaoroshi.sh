#!/bin/bash
# 自動棚卸し スケジューラー
# 毎週金曜深夜に起動 → 最終金曜判定 → スキップ判定 → core実行

export TMPDIR=/data/data/com.termux/files/usr/tmp

# cron環境ではbashrcが読まれないため、WEBHOOK URLを.bashrcから取得
if [ -z "$DISCORD_WEBHOOK_URL" ]; then
    export DISCORD_WEBHOOK_URL=$(grep -o 'DISCORD_WEBHOOK_URL="[^"]*"' "$HOME/.bashrc" | tail -1 | cut -d'"' -f2)
fi

STAMP_FILE="$HOME/.tanaoroshi_stamp"
COUNTER_FILE="$HOME/.tanaoroshi_count"
LOG_FILE="$HOME/tanaoroshi.log"
CORE_SCRIPT="$HOME/scripts/tanaoroshi_core.js"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

# ① 最終金曜日判定（翌週金曜が翌月なら今週が最終）
this_month=$(date +%Y%m)
next_fri_month=$(date -d 'next friday' +%Y%m 2>/dev/null)
if [ -z "$next_fri_month" ]; then
    # busybox date フォールバック（date -d 非対応時）
    next_fri_month=$(python3 -c "
from datetime import datetime, timedelta
now = datetime.now()
days_ahead = (4 - now.weekday()) % 7 + 7  # 次の金曜
nf = now + timedelta(days=days_ahead)
print(nf.strftime('%Y%m'))
")
fi

if [ "$next_fri_month" = "$this_month" ]; then
    log "最終金曜でないためスキップ（次の金曜も今月）"
    exit 0
fi

log "最終金曜確認 → 処理開始"

# ② 直近7日以内に手動棚卸し実施済みならスキップ
if [ -f "$STAMP_FILE" ]; then
    last=$(cat "$STAMP_FILE")
    now_ts=$(date +%s)
    diff_days=$(( (now_ts - last) / 86400 ))
    if [ "$diff_days" -lt 7 ]; then
        log "スキップ：直近${diff_days}日前に棚卸し実施済み（7日以内）"
        exit 0
    fi
fi

# ③ 実行カウンター（2ヶ月に1回 = 偶数回に照合モード）
count=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
count=$((count + 1))
echo "$count" > "$COUNTER_FILE"

if [ $((count % 2)) -eq 0 ]; then
    WITH_VERIFY="--with-verify"
    log "実行 #${count}：照合モード（実績CSVと照合あり）"
else
    WITH_VERIFY=""
    log "実行 #${count}：通常モード"
fi

# ④ 本体実行
node "$CORE_SCRIPT" $WITH_VERIFY
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    date +%s > "$STAMP_FILE"
    log "棚卸し完了 → タイムスタンプ更新"
else
    log "棚卸し失敗（exit code: $EXIT_CODE）"
fi
