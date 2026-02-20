/**
 * paste-input.js
 * 自在律（華耀天輪 真・自在律）用
 * keirin.jp 出走表テキスト → フォーム一括自動入力
 * Ver 1.0
 */

(function () {
  'use strict';

  // ============================================================
  // 1. 定数・変換マップ
  // ============================================================

  /** keirin.jp 開催場名（漢字）→ BANKDATA キー */
  const BANK_NAME_MAP = {
    '函館':   '🦑函館',
    '青森':   '🍎青森',
    'いわき平': '🏝️いわき平',
    '弥彦':   '⛩️弥彦',
    '前橋':   '🏔️前橋',
    '取手':   '🐓取手',
    '宇都宮': '🥟宇都宮',
    '大宮':   '🌸大宮',
    '西武園': '🎡西武園',
    '京王閣': '🏦京王閣',
    '立川':   '🏙️立川',
    '松戸':   '🏰松戸',
    '川崎':   '🏭川崎',
    '平塚':   '🎋平塚',
    '小田原': '🏯小田原',
    '伊東':   '♨️伊東',
    '静岡':   '🗻静岡',
    '富山':   '🐟富山',
    '名古屋': '🏯名古屋',
    '岐阜':   '🎣岐阜',
    '大垣':   '💧大垣',
    '豊橋':   '🧨豊橋',
    '松阪':   '🥩松阪',
    '四日市': '🌃四日市',
    '福井':   '🦖福井',
    '奈良':   '🦌奈良',
    '向日町': '🎋向日町',
    '和歌山': '🍊和歌山',
    '岸和田': '🏮岸和田',
    '玉野':   '🛳️玉野',
    '広島':   '🍁広島',
    '防府':   '⛩️防府',
    '高松':   '🍜高松',
    '小松島': '🦝小松島',
    '松山':   '🍊松山',
    '小倉':   '🚂小倉',
    '久留米': '🍜久留米',
    '武雄':   '♨️武雄',
    '佐世保': '🍔佐世保',
    '別府':   '♨️別府',
    '熊本':   '🏯熊本',
  };

  /** keirin.jp レース種別テキスト → race-type value */
  const RACE_TYPE_MAP = [
    { pattern: /ガールズ|Ｌ級ガ|L級ガ/ ,          value: 'girls'  },
    { pattern: /Ｓ級|S級/,          value: 's-kyu'  },
    { pattern: /Ａ級チ|A級チ/,      value: 'a-chal' },
    { pattern: /Ａ級|A級/,          value: 'a-kyu'  },
  ];

  /**
   * 開催府県 → 選手府県の照合用マップ
   * keirin.jp の選手府県表記（スペース入り短縮形）を正規化する
   */
  const VENUE_PREF_MAP = {
    '函館':   '北海道',
    '青森':   '青森',
    'いわき平': '福島',
    '弥彦':   '新潟',
    '前橋':   '群馬',
    '取手':   '茨城',
    '宇都宮': '栃木',
    '大宮':   '埼玉',
    '西武園': '埼玉',
    '京王閣': '東京',
    '立川':   '東京',
    '松戸':   '千葉',
    '川崎':   '神奈川',
    '平塚':   '神奈川',
    '小田原': '神奈川',
    '伊東':   '静岡',
    '静岡':   '静岡',
    '富山':   '富山',
    '名古屋': '愛知',
    '岐阜':   '岐阜',
    '大垣':   '岐阜',
    '豊橋':   '愛知',
    '松阪':   '三重',
    '四日市': '三重',
    '福井':   '福井',
    '奈良':   '奈良',
    '向日町': '京都',
    '和歌山': '和歌山',
    '岸和田': '大阪',
    '玉野':   '岡山',
    '広島':   '広島',
    '防府':   '山口',
    '高松':   '香川',
    '小松島': '徳島',
    '松山':   '愛媛',
    '小倉':   '福岡',
    '久留米': '福岡',
    '武雄':   '佐賀',
    '佐世保': '長崎',
    '別府':   '大分',
    '熊本':   '熊本',
  };

  // ============================================================
  // 2. UI注入
  // ============================================================

  function injectUI() {
    // 既に注入済みならスキップ
    if (document.getElementById('paste-input-section')) return;

    // ============================================================
    // スタイル注入
    // ============================================================
    const style = document.createElement('style');
    style.textContent = `
      #paste-input-section {
        margin: 12px 0;
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid rgba(179, 151, 109, 0.55);
        box-shadow:
          0 0 0 1px rgba(179, 151, 109, 0.15),
          0 0 18px rgba(179, 151, 109, 0.18),
          0 0 40px rgba(179, 151, 109, 0.08),
          0 4px 24px rgba(0, 0, 0, 0.5);
        background:
          radial-gradient(circle, rgba(180, 200, 80, 0.07) 1px, transparent 1px),
          repeating-linear-gradient(90deg, transparent, transparent 14px, rgba(180, 200, 80, 0.06) 14px, rgba(180, 200, 80, 0.06) 15px),
          repeating-linear-gradient(0deg, transparent, transparent 14px, rgba(180, 200, 80, 0.06) 14px, rgba(180, 200, 80, 0.06) 15px),
          #0f1a0f;
        background-size: 15px 15px, 15px 15px, 15px 15px, auto;
      }

      #paste-input-header {
        padding: 14px 16px;
        font-weight: bold;
        color: #c8a045;
        font-size: 1em;
        letter-spacing: 0.2em;
        position: relative;
        text-shadow: 0 0 10px rgba(200, 160, 69, 0.5);
        overflow: hidden;
        border-bottom: 1px solid rgba(179, 151, 109, 0.2);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        user-select: none;
      }

      #paste-input-header::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background: linear-gradient(90deg,
          transparent 0%,
          transparent 25%,
          rgba(180, 30, 30, 0.06) 32%,
          rgba(200, 35, 35, 0.55) 42%,
          rgba(230, 45, 45, 1.0)  50%,
          rgba(200, 35, 35, 0.55) 58%,
          rgba(180, 30, 30, 0.06) 68%,
          transparent 75%,
          transparent 100%
        );
        animation:
          paste-scanner 2.8s ease-in-out infinite,
          paste-flicker 3.3s ease-in-out infinite;
      }

      @keyframes paste-scanner {
        0%   { transform: translateX(-12%); }
        50%  { transform: translateX(12%); }
        100% { transform: translateX(-12%); }
      }

      @keyframes paste-flicker {
        0%   { opacity: 1;    }
        12%  { opacity: 0.6;  }
        18%  { opacity: 1;    }
        45%  { opacity: 0.75; }
        52%  { opacity: 1;    }
        73%  { opacity: 0.5;  }
        80%  { opacity: 0.9;  }
        88%  { opacity: 0.65; }
        100% { opacity: 1;    }
      }

      #paste-input-body {
        padding: 14px 14px 16px;
      }

      #paste-input-instructions {
        font-size: 11px;
        color: rgba(220, 200, 150, 0.75);
        line-height: 2.0;
        margin-bottom: 12px;
        letter-spacing: 0.05em;
        border-left: 2px solid rgba(179, 151, 109, 0.3);
        padding-left: 10px;
      }

      #paste-input-instructions .paste-caution {
        color: rgba(192, 119, 119, 0.85);
        line-height: 1.8;
      }

      #paste-input-row {
        display: flex;
        gap: 8px;
        align-items: stretch;
      }

      #paste-input-area {
        flex: 1;
        padding: 8px 10px;
        font-size: 12px;
        border-radius: 6px;
        border: 1px solid rgba(179, 151, 109, 0.3);
        background: rgba(250, 250, 240, 0.92);
        color: #2a2a1a;
        resize: none;
        line-height: 1.5;
        outline: none;
        box-sizing: border-box;
        width: 100%;
      }

      #paste-input-area::placeholder {
        color: #aaa;
        font-size: 11px;
      }

      #paste-input-run {
        padding: 0 14px;
        border-radius: 6px;
        background: #2d4a2d;
        color: #c8c88a;
        border: 1px solid rgba(179, 151, 109, 0.4);
        cursor: pointer;
        font-weight: bold;
        font-size: 0.85em;
        letter-spacing: 0.1em;
        white-space: nowrap;
        width: auto !important;
        margin-top: 0 !important;
        box-shadow: 0 0 8px rgba(105, 139, 105, 0.3);
        flex-shrink: 0;
      }

      #paste-input-run:active {
        transform: translateY(1px);
      }

      #paste-input-clear {
        padding: 6px 12px;
        border-radius: 6px;
        background: #555;
        color: rgba(220, 200, 150, 0.8);
        border: 1px solid rgba(179, 151, 109, 0.2);
        cursor: pointer;
        font-size: 0.8em;
        width: auto !important;
        margin-top: 8px !important;
        align-self: flex-start;
      }

      #paste-input-log {
        font-size: 11px;
        color: rgba(220, 200, 150, 0.9);
        letter-spacing: 0.05em;
        margin-top: 10px;
        font-family: monospace;
        white-space: pre-wrap;
        max-height: 160px;
        overflow-y: auto;
      }
    `;
    document.head.appendChild(style);

    // ============================================================
    // HTML注入
    // ============================================================
    const section = document.createElement('div');
    section.id = 'paste-input-section';
    section.innerHTML = `
      <div id="paste-input-header">
        <span>📋 出走表テキスト貼り付け自動入力</span>
        <span id="paste-input-arrow">▶</span>
      </div>
      <div id="paste-input-body" style="display:none;">
        <div id="paste-input-instructions">
          ① keirin.jp のスマホ版ページを開きます<br>
          ② 調べたいレースの出走表ページを表示します<br>
          ③ ページ内のテキストをページ最上部から最下部まですべて選択してコピーします<br>
          　（余分な文字が入っても問題ありません）<br>
          ④ このエリアに貼り付けます<br>
          ⑤「実行」を押すと該当項目が自動で埋まります<br>
          <br>
          <span class="paste-caution">
            ※ 解析精度の都合上、誤入力が発生することがあります。<br>
            　 実際の出走表などの情報と照合のうえご使用ください。
          </span>
        </div>
        <div id="paste-input-row">
          <textarea id="paste-input-area" rows="5" placeholder="keirin.jpの出走表をコピーしてここに貼り付けてください"></textarea>
          <button id="paste-input-run">▶ 実行</button>
        </div>
        <button id="paste-input-clear">クリア</button>
        <div id="paste-input-log"></div>
      </div>
    `;

    // レースタイプ/級班の上に挿入
    const raceTypeEl = document.getElementById('race-type');
    if (raceTypeEl) {
      const insertTarget = raceTypeEl.closest('div') || raceTypeEl.parentElement;
      insertTarget.parentElement.insertBefore(section, insertTarget);
    } else {
      document.body.prepend(section);
    }

    // アコーディオン開閉
    document.getElementById('paste-input-header').addEventListener('click', () => {
      const body  = document.getElementById('paste-input-body');
      const arrow = document.getElementById('paste-input-arrow');
      const isOpen = body.style.display !== 'none';
      body.style.display  = isOpen ? 'none' : 'block';
      arrow.textContent   = isOpen ? '▶' : '▼';
    });

    document.getElementById('paste-input-run').addEventListener('click', runAutoInput);
    document.getElementById('paste-input-clear').addEventListener('click', () => {
      document.getElementById('paste-input-area').value = '';
      document.getElementById('paste-input-log').textContent = '';
    });
  }

  // ============================================================
  // 3. パーサー
  // ============================================================

  /**
   * テキスト全体を解析してデータオブジェクトを返す
   * @param {string} text
   * @returns {{ venue: string|null, raceType: string|null, players: Object[] }}
   */
  function parseText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    const result = {
      venue: null,
      raceType: null,
      players: [],  // { carNo, name, pref, style_raw, score, kimatete }
    };

    // --- 開催場 ---
    for (const bankName of Object.keys(BANK_NAME_MAP)) {
      if (lines.some(l => l === bankName || l.includes(bankName))) {
        result.venue = bankName;
        break;
      }
    }

    // --- レースタイプ ---
    for (const line of lines) {
      for (const { pattern, value } of RACE_TYPE_MAP) {
        if (pattern.test(line)) {
          result.raceType = value;
          break;
        }
      }
      if (result.raceType) break;
    }

    // --- 選手データ ---
    // 戦略: 「府県/級班/脚質」行を基準点として前後から値を拾う
    // 「調子」が「調」「子」に分裂するなど行数が可変でも影響を受けない
    //
    // タブ区切りで1行になる場合もあるため、タブを改行に展開して処理する

    const normalizedLines = lines.flatMap(l => l.split('\t').map(s => s.trim())).filter(s => s.length > 0);

    // 府県/級班/脚質パターン: 例「栃　木/A3A3/追」
    const prefStylePattern = /^(.{2,6})\/((?:[ASGLa-z][0-9]?){2,})\/(逃|捲|差|マ|両|追)$/;
    // 競走得点パターン: 数値（小数あり）
    const scorePattern = /^(\d+\.\d+)$/;
    // 車番パターン: 1〜7の単一数字
    const carNoPattern = /^([1-7])$/;
    // 決まり手数値パターン（整数）
    const intPattern = /^\d+$/;

    for (let i = 0; i < normalizedLines.length; i++) {
      const prefMatch = prefStylePattern.exec(normalizedLines[i]);
      if (!prefMatch) continue;

      // 府県行(i)を基準に前を遡って車番・選手名を取得
      let carNo = null;
      let nameLine = '';

      if (i >= 2 && carNoPattern.test(normalizedLines[i - 2])) {
        carNo    = parseInt(normalizedLines[i - 2], 10);
        nameLine = normalizedLines[i - 1] || '';
      } else if (i >= 1 && carNoPattern.test(normalizedLines[i - 1])) {
        carNo    = parseInt(normalizedLines[i - 1], 10);
        nameLine = '';
      }

      if (carNo === null) continue;

      const pref     = prefMatch[1].replace(/[\s　]/g, '');
      const styleRaw = prefMatch[3];

      // 府県行(i)の次から競走得点を探す（最大3行先まで）
      let score = null;
      let scoreIdx = -1;
      for (let j = i + 1; j <= i + 3 && j < normalizedLines.length; j++) {
        if (scorePattern.test(normalizedLines[j])) {
          score    = parseFloat(normalizedLines[j]);
          scoreIdx = j;
          break;
        }
      }

      // 決まり手: 競走得点の次から逃/捲/差/マの4列（Bは無視）
      let kimatete = { 逃: 0, 捲: 0, 差: 0, マ: 0 };
      if (scoreIdx !== -1) {
        const cols = ['逃', '捲', '差', 'マ'];
        cols.forEach((key, idx) => {
          const val = normalizedLines[scoreIdx + 1 + idx];
          if (val !== undefined && intPattern.test(val)) {
            kimatete[key] = parseInt(val, 10);
          }
        });
      }

      result.players.push({ carNo, name: nameLine, pref, styleRaw, score, kimatete });
    }

    return result;
  }

  // ============================================================
  // 4. 脚質判定
  // ============================================================

  /**
   * 決まり手集計から自在律の脚質値を返す
   * @param {{ 逃:number, 捲:number, 差:number, マ:number }} kimatete
   * @returns { value: '自'|'両'|'追'|null, warn: boolean }
   */
  function resolveStyle(kimatete) {
    const nige  = kimatete['逃'] || 0;
    const maku  = kimatete['捲'] || 0;
    const sashi = kimatete['差'] || 0;
    const ma    = kimatete['マ'] || 0;

    const groups = [
      { value: '自', score: nige },
      { value: '両', score: maku },
      { value: '追', score: sashi + ma },
    ];

    groups.sort((a, b) => b.score - a.score);

    if (groups[0].score === 0) {
      // 全て0 → 判定不能
      return { value: null, warn: true };
    }
    if (groups[0].score === groups[1].score) {
      // 同数 → 手動設定を促す
      return { value: null, warn: true };
    }
    return { value: groups[0].value, warn: false };
  }

  // ============================================================
  // 5. フォームへの反映
  // ============================================================

  function runAutoInput() {
    const text = document.getElementById('paste-input-area').value;
    const log  = document.getElementById('paste-input-log');
    const msgs = [];

    if (!text.trim()) {
      log.textContent = '⚠️ テキストが空です。';
      return;
    }

    const data = parseText(text);

    // --- バンク名 ---
    if (data.venue) {
      const bankKey = BANK_NAME_MAP[data.venue];
      const bankEl  = document.getElementById('bank-name');
      if (bankEl) {
        const opt = Array.from(bankEl.options).find(o => o.value === bankKey);
        if (opt) {
          bankEl.value = bankKey;
          bankEl.dispatchEvent(new Event('change'));
          msgs.push(`✅ バンク: ${bankKey}`);
        } else {
          msgs.push(`⚠️ バンク「${bankKey}」がプルダウンに見つかりません`);
        }
      }
    } else {
      msgs.push('⚠️ 開催場を検出できませんでした');
    }

    // --- レースタイプ ---
    if (data.raceType) {
      const rtEl = document.getElementById('race-type');
      if (rtEl) {
        rtEl.value = data.raceType;
        rtEl.dispatchEvent(new Event('change'));
        msgs.push(`✅ レースタイプ: ${data.raceType}`);
      }
    } else {
      msgs.push('⚠️ レースタイプを検出できませんでした');
    }

    // --- 開催府県（is-local判定用） ---
    const venuePref = data.venue ? VENUE_PREF_MAP[data.venue] : null;

    // --- 出走車番セット（欠番検出） ---
    const detectedCarNos = new Set(data.players.map(p => p.carNo));
    const allCarNos = [1, 2, 3, 4, 5, 6, 7];
    const scratchNos = allCarNos.filter(n => !detectedCarNos.has(n));
    if (scratchNos.length > 0) {
      msgs.push(`⚠️ 欠番検出: 車番 ${scratchNos.join(', ')} → is-scratch ON`);
    }

    // --- 全行をリセット ---
    allCarNos.forEach(carNo => {
      const row = document.querySelector(`.player-row[data-id="${carNo}"]`);
      if (!row) return;
      const scratchEl = row.querySelector('.is-scratch');
      if (scratchEl) scratchEl.checked = scratchNos.includes(carNo);
    });

    // --- 選手データを反映 ---
    const warnCarNos = [];

    data.players.forEach(player => {
      const row = document.querySelector(`.player-row[data-id="${player.carNo}"]`);
      if (!row) {
        msgs.push(`⚠️ 車番${player.carNo}の行が見つかりません`);
        return;
      }

      // 競走得点
      if (player.score !== null) {
        const scoreEl = row.querySelector('.score');
        if (scoreEl) scoreEl.value = player.score;
      }

      // 脚質
      const { value: styleValue, warn: styleWarn } = resolveStyle(player.kimatete);
      const styleEl = row.querySelector('.style');
      if (styleEl) {
        if (styleValue !== null) {
          styleEl.value = styleValue;
        } else {
          // 同数 or 判定不能 → 空欄にはできないので最初のoption以外を選択しない
          // プルダウンの選択を変えずに警告のみ
          warnCarNos.push(player.carNo);
        }
      }

      // 地元判定
      const localEl = row.querySelector('.is-local');
      if (localEl && venuePref) {
        const playerPref = player.pref.replace(/[\s　]/g, '');
        localEl.checked = playerPref.includes(venuePref) || venuePref.includes(playerPref);
      }
    });

    if (warnCarNos.length > 0) {
      msgs.push(`⚠️ 車番 ${warnCarNos.join(', ')}: 脚質が同数のため手動設定してください`);
    }

    // デバッグ: 各選手の決まり手を表示
data.players.forEach(p => {
  msgs.push(`[DEBUG] 車番${p.carNo}: 逃${p.kimatete['逃']} 捲${p.kimatete['捲']} 差${p.kimatete['差']} マ${p.kimatete['マ']}`);
});
    
    // --- 手入力案内 ---
    msgs.push('');
    msgs.push('📝 手動入力が必要な項目:');
    msgs.push('  ・直近3走着順（.recent）');
    msgs.push('  ・S/B 1位ラジオボタン');
    msgs.push('  ・W印（◎○△）');
    msgs.push('  ・並び予想（#line-input）');

    log.textContent = msgs.join('\n');
  }

  // ============================================================
  // 6. 風速自動取得（Open-Meteo API）
  // ============================================================

  /** 競輪場緯度経度マップ（屋内バンクはnull） */
  const VENUE_LATLNG = {
    '🦑函館':     [41.7686, 140.7288],
    '🍎青森':     [40.7822, 140.7380],
    '🏝️いわき平': [37.0574, 140.8877],
    '⛩️弥彦':     [37.6517, 138.8272],
    '🏔️前橋':     null, // 屋内
    '🐓取手':     [35.9103, 140.0780],
    '🥟宇都宮':   [36.5658, 139.8836],
    '🌸大宮':     [35.9065, 139.6244],
    '🎡西武園':   [35.7897, 139.4731],
    '🏦京王閣':   [35.6297, 139.4503],
    '🏙️立川':     [35.7042, 139.4139],
    '🏰松戸':     [35.7878, 139.9026],
    '🏭川崎':     [35.5308, 139.7032],
    '🎋平塚':     [35.3303, 139.3497],
    '🏯小田原':   [35.2481, 139.1542],
    '♨️伊東':     [34.9657, 139.0991],
    '🗻静岡':     [34.9756, 138.3831],
    '🐟富山':     [36.6953, 137.2113],
    '🏯名古屋':   [35.1815, 136.9066],
    '🎣岐阜':     [35.4231, 136.7608],
    '💧大垣':     [35.3597, 136.6194],
    '🧨豊橋':     [34.7694, 137.3917],
    '🥩松阪':     [34.5781, 136.5272],
    '🌃四日市':   [34.9731, 136.6242],
    '🦖福井':     [36.0641, 136.2197],
    '🦌奈良':     [34.6853, 135.8326],
    '🎋向日町':   [34.9408, 135.7103],
    '🍊和歌山':   [34.2261, 135.1669],
    '🏮岸和田':   [34.4608, 135.3628],
    '🛳️玉野':     [34.4878, 133.9458],
    '🍁広島':     [34.3853, 132.4733],
    '⛩️防府':     [34.0531, 131.5617],
    '🍜高松':     [34.3403, 134.0461],
    '🦝小松島':   [33.9778, 134.5897],
    '🐳高知':     [33.5597, 133.5317],
    '🍊松山':     [33.8331, 132.7658],
    '🚂小倉':     null, // 屋内
    '🍜久留米':   [33.3197, 130.5081],
    '♨️武雄':     [33.1928, 130.0194],
    '🍔佐世保':   [33.1597, 129.7186],
    '♨️別府':     [33.2797, 131.4975],
    '🏯熊本':     [32.7903, 130.7419],
  };

  /**
   * 度数→8方位変換
   * @param {number} deg 0〜360
   * @returns {string} 北/北東/東/南東/南/南西/西/北西
   */
  function degToDirection(deg) {
    const dirs = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
    return dirs[Math.round(deg / 45) % 8];
  }

  /**
   * km/h → m/s 変換（0.5刻みに丸め）
   * @param {number} kmh
   * @returns {number}
   */
  function kmhToMs(kmh) {
    return Math.round((kmh / 3.6) * 2) / 2;
  }

  /**
   * Open-Meteo APIから風速・風向を取得してフォームに反映
   * @param {string} bankKey - BANKDATAのキー（絵文字付き）
   */
  async function fetchAndSetWind(bankKey) {
    const latlng = VENUE_LATLNG[bankKey];

    // 屋内バンク
    if (latlng === null) {
      const dirEl = document.getElementById('wind-direction');
      if (dirEl) { dirEl.value = 'none'; dirEl.dispatchEvent(new Event('change')); }
      const speedEl = document.getElementById('wind-speed');
      if (speedEl) speedEl.value = 0;
      console.log(`[wind] ${bankKey}: 屋内バンク → 無風/屋内をセット`);
      return;
    }

    if (!latlng) {
      console.warn(`[wind] ${bankKey}: 緯度経度未登録`);
      return;
    }

    const [lat, lon] = latlng;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&timezone=Asia/Tokyo`;

    try {
      const res     = await fetch(url);
      const json    = await res.json();
      const current = json.current;

      const speedMs   = kmhToMs(current.wind_speed_10m);
      const direction = degToDirection(current.wind_direction_10m);

      // wind-speed にセット
      const speedEl = document.getElementById('wind-speed');
      if (speedEl) speedEl.value = speedMs;

      // wind-direction にセット（1m/s以下は無風扱い）
      const dirEl = document.getElementById('wind-direction');
      if (dirEl) {
        dirEl.value = speedMs < 1.0 ? 'none' : direction;
        dirEl.dispatchEvent(new Event('change'));
      }

      console.log(`[wind] ${bankKey}: ${speedMs}m/s ${direction} (raw: ${current.wind_speed_10m}km/h ${current.wind_direction_10m}°)`);

    } catch (e) {
      console.warn(`[wind] API取得失敗: ${e.message}`);
    }
  }

  /**
   * #bank-name の change イベントを監視して風速を自動取得
   */
  function initWindFetch() {
    const bankEl = document.getElementById('bank-name');
    if (!bankEl) return;
    bankEl.addEventListener('change', () => {
      const bankKey = bankEl.value;
      if (bankKey) fetchAndSetWind(bankKey);
    });
  }

  // ============================================================
  // 7. 初期化
  // ============================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { injectUI(); initWindFetch(); });
  } else {
    injectUI();
    initWindFetch();
  }

})();
