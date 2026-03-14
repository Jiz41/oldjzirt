(function() {

  const BASE_URL = 'https://keirin-proxy.onrender.com';

  const SERIES_MAP = {
    'S級': 's-kyu',
    'A級': 'a-kyu',
    'A級チャレンジ': 'a-chal',
    'ガールズ': 'girls',
  };

  const BANK_NAME_MAP = {
    '函館':'🦑函館', '青森':'🍎青森', 'いわき平':'🏝️いわき平',
    '弥彦':'⛩️弥彦', '前橋':'🏔️前橋', '取手':'🐓取手',
    '宇都宮':'🥟宇都宮', '大宮':'🌸大宮', '西武園':'🎡西武園',
    '京王閣':'🏦京王閣', '立川':'🏙️立川', '松戸':'🏰松戸',
    '川崎':'🏭川崎', '平塚':'🎋平塚', '小田原':'🏯小田原',
    '伊東':'♨️伊東', '静岡':'🗻静岡', '富山':'🐟富山',
    '名古屋':'🏯名古屋', '岐阜':'🎣岐阜', '大垣':'💧大垣',
    '豊橋':'🧨豊橋', '松阪':'🥩松阪', '四日市':'🌃四日市',
    '福井':'🦖福井', '奈良':'🦌奈良', '向日町':'🎋向日町',
    '和歌山':'🍊和歌山', '岸和田':'🏮岸和田', '玉野':'🛳️玉野',
    '広島':'🍁広島', '防府':'⛩️防府', '高松':'🍜高松',
    '小松島':'🦝小松島', '高知':'🐳高知', '松山':'🍊松山',
    '小倉':'🚂小倉', '久留米':'🍜久留米', '武雄':'♨️武雄',
    '佐世保':'🍔佐世保', '別府':'♨️別府', '熊本':'🏯熊本',
  };

  const cache = {
    kaisai: {},
    race: {},
  };

  function getCurrentDate() {
    const today = new Date();
    return today.getFullYear().toString()
      + String(today.getMonth() + 1).padStart(2, '0')
      + String(today.getDate()).padStart(2, '0');
  }

  // ============================================================
  // 風速取得
  // ============================================================

  const VENUE_LATLNG = {
    '🦑函館':     [41.7686, 140.7288],
    '🍎青森':     [40.7822, 140.7380],
    '🏝️いわき平': [37.0574, 140.8877],
    '⛩️弥彦':     [37.6517, 138.8272],
    '🏔️前橋':     null,
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
    '🚂小倉':     null,
    '🍜久留米':   [33.3197, 130.5081],
    '♨️武雄':     [33.1928, 130.0194],
    '🍔佐世保':   [33.1597, 129.7186],
    '♨️別府':     [33.2797, 131.4975],
    '🏯熊本':     [32.7903, 130.7419],
  };

  function degToDirection(deg) {
    const dirs = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
    return dirs[Math.round(deg / 45) % 8];
  }

  function kmhToMs(kmh) {
    return Math.round((kmh / 3.6) * 2) / 2;
  }

  async function fetchAndSetWind(bankKey) {
    const latlng = VENUE_LATLNG[bankKey];
    if (latlng === null) {
      const dirEl = document.getElementById('wind-direction');
      if (dirEl) { dirEl.value = 'none'; dirEl.dispatchEvent(new Event('change')); }
      const speedEl = document.getElementById('wind-speed');
      if (speedEl) speedEl.value = 0;
      return;
    }
    if (!latlng) return;

    const [lat, lon] = latlng;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&timezone=Asia/Tokyo`;

    try {
      const res     = await fetch(url);
      const json    = await res.json();
      const current = json.current;
      if (!res.ok || !current || current.wind_speed_10m === undefined) return;

      const speedMs   = kmhToMs(current.wind_speed_10m);
      const direction = degToDirection(current.wind_direction_10m);

      const speedEl = document.getElementById('wind-speed');
      if (speedEl) speedEl.value = speedMs;

      const dirEl = document.getElementById('wind-direction');
      if (dirEl) {
        dirEl.value = speedMs < 1.0 ? 'none' : direction;
        dirEl.dispatchEvent(new Event('change'));
      }
    } catch (e) {
      console.warn(`[wind] API取得失敗: ${e.message}`);
    }
  }

  // ============================================================
  // 開催情報・レース情報取得
  // ============================================================

  async function loadKaisai() {
    const date = getCurrentDate();
    if (cache.kaisai[date]) {
      renderVenues(cache.kaisai[date]);
      return;
    }
    const content = document.getElementById('proxy-input-content');
    content.textContent = '読み込み中...';
    try {
      const res  = await fetch(`${BASE_URL}/kaisai?date=${date}`);
      const data = await res.json();
      cache.kaisai[date] = data;
      renderVenues(data);
    } catch (e) {
      content.textContent = '❌ 開催情報の取得に失敗しました';
    }
  }

  function renderVenues(data) {
    const content = document.getElementById('proxy-input-content');
    if (!data.venues || data.venues.length === 0) {
      content.textContent = '本日の開催はございません';
      return;
    }
    content.innerHTML = '';
    data.venues.forEach(venue => {
      const btn = document.createElement('button');
      btn.textContent = `${BANK_NAME_MAP[venue.name] || venue.name} ${venue.grade}`;
      btn.className = 'proxy-btn';
      btn.addEventListener('click', () => renderDays(venue));
      content.appendChild(btn);
    });
  }

  function renderDays(venue) {
    const content = document.getElementById('proxy-input-content');
    content.innerHTML = '';

    const back = document.createElement('button');
    back.textContent = '← 開催場に戻る';
    back.className = 'proxy-btn-back';
    back.addEventListener('click', () => renderVenues(cache.kaisai[getCurrentDate()]));
    content.appendChild(back);

    venue.days.forEach(day => {
      const btn = document.createElement('button');
      btn.textContent = day.label;
      btn.className = 'proxy-btn';
      btn.addEventListener('click', () => renderRaces(venue, day));
      content.appendChild(btn);
    });
  }

  function renderRaces(venue, day) {
    const content = document.getElementById('proxy-input-content');
    content.innerHTML = '';

    const back = document.createElement('button');
    back.textContent = '← 日次に戻る';
    back.className = 'proxy-btn-back';
    back.addEventListener('click', () => renderDays(venue));
    content.appendChild(back);

    day.races.forEach(race => {
      const btn = document.createElement('button');
      btn.textContent = `${race.raceNo}R`;
      btn.className = 'proxy-btn-race';
      btn.addEventListener('click', () => loadRace(race.raceId));
      content.appendChild(btn);
    });
  }

  function applyRaceData(data) {
    // series → #race-type
    const raceTypeEl = document.getElementById('race-type');
    if (raceTypeEl && SERIES_MAP[data.series]) {
      raceTypeEl.value = SERIES_MAP[data.series];
      raceTypeEl.dispatchEvent(new Event('change'));
    }

    // venue → #bank-name + 風速
    const bankKey = BANK_NAME_MAP[data.venue];
    const bankEl  = document.getElementById('bank-name');
    if (bankEl && bankKey) {
      const opt = Array.from(bankEl.options).find(o => o.value === bankKey);
      if (opt) {
        bankEl.value = bankKey;
        bankEl.dispatchEvent(new Event('change'));
        fetchAndSetWind(bankKey);
      }
    }

    // 9車立てチェック
    const activeRiders = data.riders.filter(r => !r.isScratched);
    if (activeRiders.length > 7) {
      const log = document.getElementById('proxy-input-log');
      log.textContent = '⚠️ 9車立てのレースです。自在律は7車立て専用のため自動入力を中断しました。';
      return;
    }

    // riders → 各フィールド
    const STYLE_MAP = { '逃': '逃', '自': '自', '追': '追' };
    const allCarNos = [1, 2, 3, 4, 5, 6, 7];
    const detectedNos = new Set(data.riders.map(r => r.number));

    // 欠場リセット
    allCarNos.forEach(n => {
      const row = document.querySelector(`.player-row[data-id="${n}"]`);
      if (!row) return;
      const scratchEl = row.querySelector('.is-scratch');
      if (scratchEl) scratchEl.checked = !detectedNos.has(n);
    });

    // 選手データ反映
    const msgs = [];
    data.riders.forEach(rider => {
      const row = document.querySelector(`.player-row[data-id="${rider.number}"]`);
      if (!row) return;

      const scratchEl = row.querySelector('.is-scratch');
      if (scratchEl) scratchEl.checked = rider.isScratched;
      if (rider.isScratched) return;

      const scoreEl = row.querySelector('.score');
      if (scoreEl && rider.score !== null) scoreEl.value = rider.score;

      const styleEl = row.querySelector('.style');
      if (styleEl && STYLE_MAP[rider.style]) {
        styleEl.value = STYLE_MAP[rider.style];
      } else {
        msgs.push(`⚠️ 車番${rider.number}: 脚質を検出できませんでした（決まり手が同数のため手動で入力ください）`);
      }
    });

    const log = document.getElementById('proxy-input-log');
    msgs.push('');
    msgs.push('📝 手動入力が必要な項目:');
    msgs.push('  ・W印（◎○△✕）');
    msgs.push('  ・直近3走着順');
    msgs.push('  ・S/B 1位ラジオボタン');
    msgs.push('  ・並び予想');
    log.textContent = `✅ ${data.venue} 自動入力完了\n` + msgs.join('\n');
  }

  async function loadRace(raceId) {
    const log = document.getElementById('proxy-input-log');
    log.textContent = '読み込み中...';
    if (cache.race[raceId]) {
      applyRaceData(cache.race[raceId]);
      return;
    }
    try {
      const res  = await fetch(`${BASE_URL}/race?raceId=${raceId}`);
      const data = await res.json();
      cache.race[raceId] = data;
      applyRaceData(data);
    } catch (e) {
      log.textContent = `❌ レース情報の取得に失敗しました: ${e.message}`;
    }
  }

  // ============================================================
  // UI注入
  // ============================================================

  function injectUI() {
    if (document.getElementById('proxy-input-section')) return;

    const style = document.createElement('style');
    style.textContent = `
#proxy-input-section {
    margin: 12px 0;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(232, 122, 48, 0.5);
    box-shadow:
        0 0 0 1px rgba(232, 122, 48, 0.12),
        0 0 18px rgba(232, 122, 48, 0.15),
        0 0 40px rgba(232, 122, 48, 0.06),
        0 4px 24px rgba(0, 0, 0, 0.6);
    background:
        radial-gradient(circle, rgba(232, 122, 48, 0.06) 1px, transparent 1px),
        repeating-linear-gradient(90deg, transparent, transparent 14px, rgba(232, 122, 48, 0.04) 14px, rgba(232, 122, 48, 0.04) 15px),
        repeating-linear-gradient(0deg, transparent, transparent 14px, rgba(232, 122, 48, 0.04) 14px, rgba(232, 122, 48, 0.04) 15px),
        #0a0a0a;
    background-size: 15px 15px, 15px 15px, 15px 15px, auto;
}
#proxy-input-header {
    padding: 14px 16px;
    font-weight: bold;
    color: #e87a30;
    font-size: 1em;
    letter-spacing: 0.2em;
    position: relative;
    text-shadow: 0 0 10px rgba(232, 122, 48, 0.6);
    overflow: hidden;
    border-bottom: 1px solid rgba(232, 122, 48, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
}
#proxy-input-body {
    padding: 14px 14px 16px;
}
#proxy-input-log {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: 0.05em;
    margin-top: 10px;
    font-family: monospace;
    white-space: pre-wrap;
    max-height: 160px;
    overflow-y: auto;
}
.proxy-btn {
    display: block;
    width: 100%;
    margin: 4px 0;
    padding: 8px 12px;
    text-align: left;
    cursor: pointer;
    font-size: 0.9em;
    letter-spacing: 0.05em;
    color: #e87a30;
    background: linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%);
    border: 1px solid rgba(232, 122, 48, 0.35);
    border-top-color: rgba(232, 122, 48, 0.6);
    border-radius: 5px;
    box-shadow:
        inset 0 1px 0 rgba(232, 122, 48, 0.12),
        inset 0 -1px 0 rgba(0, 0, 0, 0.5),
        0 1px 3px rgba(0, 0, 0, 0.6);
    transition: filter 0.1s;
}
.proxy-btn:active {
    filter: brightness(0.85);
    box-shadow:
        inset 0 2px 4px rgba(0, 0, 0, 0.6),
        0 1px 2px rgba(0, 0, 0, 0.4);
}
.proxy-btn-back {
    display: inline-block;
    width: auto;
    margin-bottom: 8px;
    padding: 5px 12px;
    font-size: 0.8em;
    color: rgba(232, 122, 48, 0.6);
    background: linear-gradient(180deg, #141414 0%, #0a0a0a 100%);
    border: 1px solid rgba(232, 122, 48, 0.2);
    border-top-color: rgba(232, 122, 48, 0.4);
    border-radius: 5px;
    cursor: pointer;
    box-shadow:
        inset 0 1px 0 rgba(232, 122, 48, 0.08),
        inset 0 -1px 0 rgba(0, 0, 0, 0.5),
        0 1px 3px rgba(0, 0, 0, 0.6);
    transition: filter 0.1s;
}
.proxy-btn-back:active { filter: brightness(0.85); }
.proxy-btn-race {
    display: inline-block;
    width: auto;
    margin: 3px;
    padding: 7px 13px;
    font-size: 0.85em;
    color: #e87a30;
    background: linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%);
    border: 1px solid rgba(232, 122, 48, 0.35);
    border-top-color: rgba(232, 122, 48, 0.6);
    border-radius: 5px;
    cursor: pointer;
    box-shadow:
        inset 0 1px 0 rgba(232, 122, 48, 0.12),
        inset 0 -1px 0 rgba(0, 0, 0, 0.5),
        0 1px 3px rgba(0, 0, 0, 0.6);
    transition: filter 0.1s;
}
.proxy-btn-race:active { filter: brightness(0.85); }
    `;
    document.head.appendChild(style);

    const section = document.createElement('div');
    section.id = 'proxy-input-section';
    section.innerHTML = `
      <div id="proxy-input-header">
        <span>🔗 レース情報自動取得</span>
        <span id="proxy-input-arrow">▶</span>
      </div>
      <div id="proxy-input-body" style="display:none;">
        <div id="proxy-input-content">読み込み中...</div>
        <div id="proxy-input-log"></div>
      </div>
    `;

    const raceTypeEl = document.getElementById('race-type');
    if (raceTypeEl) {
      const insertTarget = raceTypeEl.closest('div') || raceTypeEl.parentElement;
      insertTarget.parentElement.insertBefore(section, insertTarget);
    } else {
      document.body.prepend(section);
    }

    document.getElementById('proxy-input-header').addEventListener('click', () => {
      const body  = document.getElementById('proxy-input-body');
      const arrow = document.getElementById('proxy-input-arrow');
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      arrow.textContent  = isOpen ? '▶' : '▼';
      if (!isOpen) loadKaisai();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    injectUI();
  }

})();
