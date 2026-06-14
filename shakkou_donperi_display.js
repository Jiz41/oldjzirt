// VERSION: 1.2
(function(app) {
// ============================================================================
// 儀術『赤口呑縁（しゃっこうどんぺり）』表示制御システム
// ============================================================================
// 清音の神託をHTMLに描画し、既存UIと統合する
// ============================================================================

// ----------------------------------------------------------------------------
// 🎬 進捗表示：計算開始
// ----------------------------------------------------------------------------

/**
 * 計算開始時の進捗表示を挿入
 * @param {string} grade - 階級
 */
function showShakkouProgress(grade) {
    const scenarioOutput = document.getElementById('scenario-output');
    
    if (scenarioOutput) {
        // 進捗表示はスキップ
    }
}

/**
 * 進捗バーを更新
 * @param {number} current - 現在の進捗
 * @param {number} total - 総数
 */
function updateShakkouProgress(current, total) {
    const progressBar = document.getElementById('shakkou-progress-bar');
    const progressText = document.getElementById('shakkou-progress-text');
    
    if (progressBar && progressText) {
        const percentage = (current / total * 100).toFixed(1);
        progressBar.style.width = percentage + '%';
        progressText.textContent = `${current} / ${total}`;
    }
}

// ----------------------------------------------------------------------------
// 🎨 結果表示：メイン関数
// ----------------------------------------------------------------------------

/**
 * 赤口呑縁の結果を表示
 * @param {object} cosmosResult - 計算結果
 * @param {string} grade - 階級
 */
function displayShakkouResults(cosmosResult, grade) {
    // キャラ凍結による口上分離：generateKiyoneMessage（口上込み）から
    // generateShakkouDataSection（データ部のみ）へ差し替え。キャラ復活時は下行を元に戻す。
    // const kiyoneMessage = app.generateKiyoneMessage(cosmosResult, grade);
    const kiyoneMessage = app.generateShakkouDataSection(cosmosResult);
    const scenarioOutput = document.getElementById('scenario-output');

    if (scenarioOutput) {
        const existing = scenarioOutput.querySelector('.shakkou-results-container');
        if (existing) existing.remove();

        // キャラ凍結による口上分離：カットイン画像とキャラ名入りサブタイトルを退場。
        // キャラ復活時は以下2ブロックを resultHTML のヘッダ直後に戻す。
        //   <div class="shakkou-subtitle">五更斎アメンティア清音による、1465の並行世界</div>
        //   <div class="kiyone-cutin-wrapper">
        //       <img src="kiyone_01.png" alt="清音" class="kiyone-cutin-image glitch-effect">
        //   </div>
        const resultHTML = `
<div class="shakkou-results-container">
    <div class="shakkou-header">
        <h3 class="shakkou-title">偽典『赤口呑縁』──</h3>
        <div class="shakkou-subtitle">1465の並行世界</div>
    </div>

    ${kiyoneMessage}
</div>
        `;
        
        // 計算中の表示（進捗バー）を特定して、結果に置き換える
        const progressArea = document.querySelector('.kiyone-calculation-start');
        if (progressArea) {
            progressArea.outerHTML = resultHTML;
        } else {
            scenarioOutput.insertAdjacentHTML('beforeend', resultHTML);
        }
    }
    
    injectShakkouStyles();
}

// ----------------------------------------------------------------------------
// 🎨 スタイル注入
// ----------------------------------------------------------------------------

/**
 * 赤口呑縁専用のスタイルを注入
 */
function injectShakkouStyles() {
    if (document.getElementById('shakkou-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'shakkou-styles';
    styleElement.textContent = `
/* ============================================================================
   儀術『赤口呑縁』専用スタイル
   ============================================================================ */

.shakkou-results-container {
    background: linear-gradient(135deg, #1a1710, #1e1b13);
    border: 3px solid rgba(200, 184, 154, 0.25);
    border-radius: 12px;
    padding: 0;
    margin: 20px 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.shakkou-header {
    background: linear-gradient(135deg, #252015, #1e1b13);
    padding: 20px;
    border-bottom: 2px solid rgba(200, 184, 154, 0.25);
    text-align: center;
}

.shakkou-title {
    color: #c8b89a;
    font-size: 24px;
    margin: 0 0 10px 0;
    letter-spacing: 0.1em;
}

.shakkou-subtitle {
    color: #b8a88a;
    font-size: 14px;
    font-style: italic;
}

.kiyone-section {
    margin: 0;
    padding: 5px 20px 20px 20px;
    background: transparent;
    border-left: none;
    border-radius: 0;
    border-bottom: 1px solid rgba(200, 184, 154, 0.15);
}

.kiyone-section:last-child {
    border-bottom: none;
}

.kiyone-voice {
    font-family: 'Noto Serif JP', 'Yu Mincho', 'YuMincho', serif;
    font-size: 16px;
    line-height: 1.8;
    color: #c8b89a;
    font-style: italic;
    white-space: pre-line;
    margin: 15px 0;
    padding: 15px 20px;
    background: rgba(30, 27, 19, 0.3);
    border-left: 3px solid #c8b89a;
    border-radius: 5px;
}

.kiyone-comment {
    font-family: 'Noto Serif JP', 'Yu Mincho', 'YuMincho', serif;
    color: #b8a88a;
    font-style: italic;
    margin: 15px 0;
    padding: 12px 20px;
    border-left: 3px solid #9a8870;
    line-height: 1.6;
    background: rgba(30, 27, 19, 0.3);
    border-radius: 5px;
}

.section-title {
    color: #c8b89a;
    font-size: 20px;
    margin: 0 0 20px 0;
    padding-bottom: 10px;
    border-bottom: 2px solid rgba(200, 184, 154, 0.25);
}

.deme-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 15px 0;
}

.deme-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: rgba(30, 27, 19, 0.5);
    border-radius: 5px;
    border: 1px solid rgba(200, 184, 154, 0.15);
    transition: all 0.3s;
}

.deme-item:hover {
    background: rgba(30, 27, 19, 0.6);
    border-color: rgba(200, 184, 154, 0.25);
    transform: translateX(5px);
}

.deme-pattern {
    color: #c8b89a;
    font-weight: bold;
    font-family: 'Courier New', monospace;
    font-size: 20px;
    letter-spacing: 0.2em;
}

.deme-count {
    color: #9a8870;
    font-family: 'Courier New', monospace;
    font-size: 16px;
}

.chaos-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin: 15px 0;
}

.chaos-item {
    background: rgba(30, 27, 19, 0.5);
    padding: 15px;
    border-left: 4px solid rgba(200, 184, 154, 0.25);
    border-radius: 5px;
    border: 1px solid rgba(200, 184, 154, 0.15);
    transition: all 0.3s;
}

.chaos-item:hover {
    background: rgba(30, 27, 19, 0.6);
    border-left-color: #c8b89a;
    transform: translateX(5px);
}

.chaos-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}

.chaos-name {
    color: #c8b89a;
    font-weight: bold;
    font-size: 16px;
}

.chaos-count {
    color: #9a8870;
    font-family: 'Courier New', monospace;
    font-size: 14px;
}

.chaos-pattern {
    color: #b8a88a;
    font-size: 14px;
    padding-left: 15px;
    margin-top: 8px;
}

.pattern-text {
    color: #c8b89a;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    letter-spacing: 0.15em;
}

.pattern-count {
    color: #9a8870;
    font-family: 'Courier New', monospace;
    margin-left: 10px;
}

.survival-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
    background: rgba(30, 27, 19, 0.5);
    border: 1px solid rgba(200, 184, 154, 0.15);
    border-radius: 5px;
    overflow: hidden;
    table-layout: auto;
}

.survival-table thead th {
    background: rgba(30, 27, 19, 0.7);
    color: #c8b89a;
    padding: 12px;
    text-align: center;
    border-bottom: 2px solid rgba(200, 184, 154, 0.25);
    font-weight: bold;
    font-size: 14px;
}

.survival-table tbody td {
    color: #b8a88a;
    padding: 10px;
    text-align: center;
    border-bottom: 1px solid rgba(200, 184, 154, 0.15);
    font-family: 'Courier New', monospace;
    font-size: 12px;
    white-space: nowrap;
}

.survival-table tbody tr:hover {
    background: rgba(42, 24, 16, 0.5);
}

.survival-table tbody tr:last-child td {
    border-bottom: none;
}

.car-number {
    font-weight: bold;
    color: #c8b89a !important;
    font-size: 16px;
}

.rank-1 { color: #e74c3c !important; font-weight: bold; }
.rank-2 { color: #3498db !important; }
.rank-3 { color: #2ecc71 !important; }
.outside { color: #7f8c8d !important; }

.kiyone-section.opening { border-bottom: 2px solid rgba(200, 184, 154, 0.25); }
.kiyone-section.opening .kiyone-voice { border-left-color: #c8b89a; background: rgba(30, 27, 19, 0.4); }

.kiyone-section.closing { margin-top: 20px; border-bottom: none; }
.kiyone-section.closing .kiyone-voice { border-left-color: #c8b89a; background: rgba(30, 27, 19, 0.4); text-align: center; }

.kiyone-calculation-start {
    padding: 30px 20px;
    background: linear-gradient(135deg, #1a0f0a, #2a1810);
    border-radius: 8px;
    margin: 0;
}

.progress-container { margin-top: 20px; }

.progress-bar-wrapper {
    width: 100%;
    height: 30px;
    background: #0a0505;
    border: 2px solid rgba(200, 184, 154, 0.25);
    border-radius: 5px;
    overflow: hidden;
    box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.5);
}

.progress-bar {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #c8b89a, rgba(200, 184, 154, 0.25), #c8b89a);
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
    transition: width 0.3s ease;
}

@keyframes shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
}

.progress-text {
    text-align: center;
    color: #c8b89a;
    font-family: 'Courier New', monospace;
    font-size: 18px;
    margin-top: 12px;
    font-weight: bold;
}

.kiyone-cutin-wrapper {
    width: 100%;
    max-width: 100px;
    margin: 20px auto 0 auto;
    overflow: hidden;
    position: relative;
    background: transparent;
}

.kiyone-cutin-image {
    width: 100%;
    height: auto;
    display: block;
}

.glitch-effect {
    position: relative;
    animation: glitch-rgb 3s infinite;
}

@keyframes glitch-rgb {
    0%, 90% { transform: translate(0); filter: none; }
    92% { transform: translate(-3px, 2px); filter: drop-shadow(3px 0 0 #ff00ff) drop-shadow(-3px 0 0 #00ffff); }
    94% { transform: translate(2px, -2px); filter: drop-shadow(-2px 0 0 #ff00ff) drop-shadow(2px 0 0 #00ffff); }
    96% { transform: translate(-1px, 1px); filter: none; }
}

@media (max-width: 600px) {
    .shakkou-title { font-size: 20px; }
    .kiyone-voice { font-size: 14px; }
    .survival-table thead th, .survival-table tbody td { padding: 8px 5px; font-size: 10px; }
}
`;
    document.head.appendChild(styleElement);
}

// ----------------------------------------------------------------------------
// 🔗 既存コードとの統合用関数
// ----------------------------------------------------------------------------

app.startShakkouCalculation = function(grade) {
    showShakkouProgress(grade);
}

// ----------------------------------------------------------------------------
// 審眼八卦の寸評カード表示（displayShinganHakke / injectShinganStyles）は
// 発注根拠のない独断実装であったため除去（2026-06-11）。
// sg-*トグル・applyShinganHakkeの×1.05オーバーレイ・sendLogスキップ判定は
// 正規機能として keirin_logic.js 側に存置している。
// ----------------------------------------------------------------------------

app.completeShakkouCalculation = function(cosmosResult, grade) {
    try {
        displayShakkouResults(cosmosResult, grade);
    } catch(e) {
        app.logMessage('[ERROR] displayShakkouResults: ' + e.message);
    }
}

// ----------------------------------------------------------------------------
// 🩸 血判状図
// ----------------------------------------------------------------------------

let _kData = null, _kScenario = '逃', _kActiveLine = -1;
const _kBubbles = {}, _kPositions = {};
let _kLineEls = [];
const _KSZ  = { 1:64, 2:48, 3:34, 4:22 };
const _KTINT_ALPHA = 0.90; // 強度ティント不透明度（晴天スコア色を墨地に重ねる）
const _KST  = {
    1: { bg:'#1a1710', bdr:'rgba(200,169,110,0.95)', num:'#c8a96e',              name:'rgba(200,169,110,0.75)' },
    2: { bg:'#111118', bdr:'rgba(224,216,200,0.70)', num:'#e0d8c8',              name:'rgba(180,172,160,0.70)' },
    3: { bg:'#0e0e14', bdr:'rgba(120,120,140,0.50)', num:'rgba(160,160,180,0.8)',name:'rgba(100,100,120,0.60)' },
    4: { bg:'#0a0a0f', bdr:'rgba(50,50,65,0.60)',    num:'rgba(70,70,85,0.80)',  name:'rgba(50,50,65,0.50)'    },
};

function buildKeppanData(relations) {
    const arrLines       = relations.lineArrays     || [];
    const allPlayers     = relations.allPlayers     || [];
    const seitenScores   = relations.seitenScores   || {};
    const scenarioScores = relations.scenarioScores || {};

    // 特異点（L）のrole再付与：2b4b288の全7選手対応書き直しで脱落していたものを復旧。
    // renderKeppan() L671 が role==='L' を1.5px破線枠で描画する。
    const tokuitenId = relations.kouten?.L?.id ?? null;

    // 1. players配列（欠場除外・全出走選手）
    const players = allPlayers
        .filter(p => !p.isScratch)
        .map(p => {
            const lineIdx = arrLines.findIndex(line => line.includes(p.id));
            return {
                id:      p.id,
                name:    p.name  || '',
                wmark:   p.wmark || '',
                style:   p.style || '',
                role:    (p.id === tokuitenId) ? 'L' : '',
                lineIdx: lineIdx < 0 ? 0 : lineIdx,
                _ref:    p,
            };
        });

    const ids = players.map(p => p.id);

    // 2. scenarioRank（同スコアは同ランク）
    function rankBy(scoreMap) {
        const sorted = [...ids].sort((a, b) => (scoreMap[b] || 0) - (scoreMap[a] || 0));
        const rank = {};
        sorted.forEach((id, i) => {
            if (i === 0) { rank[id] = 1; return; }
            const prev = sorted[i - 1];
            rank[id] = (scoreMap[id] === scoreMap[prev]) ? rank[prev] : i + 1;
        });
        return rank;
    }
    const scenarioRank = {
        '逃': rankBy(scenarioScores['逃'] || {}),
        '差': rankBy(scenarioScores['差'] || {}),
        '捲': rankBy(scenarioScores['捲'] || {}),
    };

    // 3. factors・totals
    function pct(c) { return Math.round(((c ?? 1) - 1) * 100); }
    const factors = {}, totals = {};
    players.forEach(({ id, _ref: p }) => {
        factors[id] = [
            { label: 'ライン先頭の引力 / 番手の恩恵', sub: 'c_l = '      + (p.c_l      ?? 1).toFixed(3), val: pct(p.c_l),      max: 10 },
            { label: '直近の調子',                    sub: 'c_recent = ' + (p.c_recent ?? 1).toFixed(3), val: pct(p.c_recent), max: 10 },
            { label: '地元の力',                       sub: 'c_local = '  + (p.c_local  ?? 1).toFixed(3), val: pct(p.c_local),  max: 10 },
            { label: '紙面の期待',                     sub: 'c_wmark = '  + (p.c_wmark  ?? 1).toFixed(3), val: pct(p.c_wmark),  max: 10 },
            { label: 'S1の重み',                       sub: 'c_s1 = '     + (p.c_s1     ?? 1).toFixed(3), val: pct(p.c_s1),     max: 10 },
        ];
        const raw = seitenScores[id];
        totals[id] = raw != null ? (raw / 3).toFixed(1) + 'pt' : '—';
    });

    // 強度ティント用：晴天スコア（/3正規化）。raw==nullの選手は除外
    const seiten = {};
    players.forEach(({ id }) => {
        const raw = seitenScores[id];
        if (raw != null) seiten[id] = raw / 3;
    });

    // 4. 並び表示テキスト
    const narabi = arrLines.map(line => line.join('-')).join(' / ');

    return { players, lines: arrLines, scenarioRank, scenarioScores, factors, totals, seiten, narabi };
}

function renderKeppan(data) {
    _kData = data; _kScenario = '逃'; _kActiveLine = -1;
    Object.keys(_kBubbles).forEach(k => delete _kBubbles[k]);
    Object.keys(_kPositions).forEach(k => delete _kPositions[k]);
    _kLineEls.forEach(el => el.remove());
    _kLineEls = [];
    const _svgPre = document.getElementById('keppan_lineSvg');
    if (_svgPre) _svgPre.querySelectorAll('line').forEach(el => el.remove());

    const stage = document.getElementById('keppan_stage');
    if (!stage) return;
    stage.querySelectorAll('.keppan_bubble').forEach(el => el.remove());

    const CX = 150, CY = 150, R = 118, n = data.players.length;
    [...data.players].sort((a, b) => a.id - b.id).forEach((p, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        _kPositions[p.id] = { x: CX + Math.cos(angle) * R, y: CY + Math.sin(angle) * R };
        const el = document.createElement('div');
        el.className = 'keppan_bubble';
        el.innerHTML = `<div class="keppan_bubble_num"></div><div class="keppan_bubble_name"></div><div class="keppan_bubble_wmark"></div>`;
        el.addEventListener('click', () => _kOnClick(p.id));
        stage.appendChild(el);
        _kBubbles[p.id] = el;
    });

    document.querySelectorAll('.keppan_tab').forEach(t => t.classList.toggle('active', t.dataset.sc === '逃'));
    const narabiEl = document.getElementById('keppan_narabi');
    if (narabiEl) narabiEl.textContent = data.narabi;
    const container = document.getElementById('keppan_container');
    if (container) container.classList.add('visible');

    _kRender();
}

function _kDrawLines(hlIdx) {
    const svg = document.getElementById('keppan_lineSvg');
    if (!svg || !_kData) return;
    _kLineEls.forEach(el => el.remove()); _kLineEls = [];
    const ranks = _kData.scenarioRank[_kScenario];
    _kData.lines.forEach((line, li) => {
        const isHL  = li === hlIdx;
        const stroke = isHL ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.25)';
        const width  = isHL ? 2.2 : 1.2;
        const mId    = `keppan_arr${Math.min(li, 2)}${isHL ? 'h' : ''}`;
        for (let i = 0; i < line.length - 1; i++) {
            const a = _kPositions[line[i]], b = _kPositions[line[i + 1]];
            if (!a || !b) continue;
            const dx = b.x - a.x, dy = b.y - a.y, dist = Math.sqrt(dx*dx + dy*dy);
            const ux = dx/dist, uy = dy/dist;
            const sA = _KSZ[Math.min(ranks[line[i]]     || 4, 4)] / 2;
            const sB = _KSZ[Math.min(ranks[line[i + 1]] || 4, 4)] / 2;
            const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            el.setAttribute('x1', a.x + ux*(sA+2)); el.setAttribute('y1', a.y + uy*(sA+2));
            el.setAttribute('x2', b.x - ux*(sB+6)); el.setAttribute('y2', b.y - uy*(sB+6));
            el.setAttribute('stroke', stroke); el.setAttribute('stroke-width', width);
            el.setAttribute('marker-end', `url(#${mId})`);
            svg.appendChild(el); _kLineEls.push(el);
        }
    });
}

// keirin_logic.js の getStrengthColor と同一の補間（青52,152,219→赤231,76,60、
// min==max時はグレー）。グローバル関数への依存を作らないための自己完結コピー
function _kStrengthColor(score, minScore, maxScore) {
    if (maxScore === minScore) return 'rgb(142, 142, 142)';
    const n = (score - minScore) / (maxScore - minScore);
    const r = Math.round(52  + (231 - 52)  * n);
    const g = Math.round(152 + (76  - 152) * n);
    const b = Math.round(219 + (60  - 219) * n);
    return `rgb(${r}, ${g}, ${b})`;
}

function _kRender() {
    if (!_kData) return;
    const ranks = _kData.scenarioRank[_kScenario];
    // 強度ティントの基準は晴天スコア固定（シナリオタブ切替で色は変わらない）
    const seitenVals = Object.values(_kData.seiten || {});
    const sMin = seitenVals.length ? Math.min(...seitenVals) : 0;
    const sMax = seitenVals.length ? Math.max(...seitenVals) : 0;
    _kData.players.forEach(p => {
        const el = _kBubbles[p.id]; if (!el) return;
        const rank = Math.min(ranks[p.id] || 4, 4);
        const size = _KSZ[rank], st = _KST[rank];
        el.style.left   = _kPositions[p.id].x + 'px';
        el.style.top    = _kPositions[p.id].y + 'px';
        el.style.width  = size + 'px'; el.style.height = size + 'px';
        // 三階層振り分け：特異点role最優先、それ以外は描画サイズ（最下段=極小のみ静止）
        const tier = p.role === 'L' ? 'keppan_tier_tokuiten' : size === _KSZ[4] ? 'keppan_tier_kengai' : 'keppan_tier_float';
        // 強度ティント：晴天スコア色（不透明度 _KTINT_ALPHA）を墨地に重ねる
        const sc = (_kData.seiten || {})[p.id];
        let numColor = st.num;
        if (sc != null && seitenVals.length) {
            const tintRgb = _kStrengthColor(sc, sMin, sMax);
            const tint = tintRgb.replace('rgb(', 'rgba(').replace(')', `, ${_KTINT_ALPHA})`);
            el.style.background = `linear-gradient(${tint}, ${tint}), ${st.bg}`;
            const tm = tintRgb.match(/\d+/g);
            const bgH = st.bg.replace('#', '');
            const bR = _KTINT_ALPHA * parseInt(tm[0]) + (1 - _KTINT_ALPHA) * parseInt(bgH.slice(0, 2), 16);
            const bG = _KTINT_ALPHA * parseInt(tm[1]) + (1 - _KTINT_ALPHA) * parseInt(bgH.slice(2, 4), 16);
            const bB = _KTINT_ALPHA * parseInt(tm[2]) + (1 - _KTINT_ALPHA) * parseInt(bgH.slice(4, 6), 16);
            numColor = (0.2126 * bR + 0.7152 * bG + 0.0722 * bB) / 255 > 0.5 ? '#333' : '#fff';
        } else {
            el.style.background = st.bg;
        }
        // 円の塗りは常に不透明（opacity減彩は背後の関係線が透けるため廃止。
        // 圏外の減彩はCSSクラス側の filter で表現）
        el.style.opacity = '1';
        el.style.border = `${p.role==='L' ? '1.5px dashed' : rank<=2 ? '2px solid' : '1px solid'} ${st.bdr}`;
        el.classList.remove('keppan_tier_tokuiten', 'keppan_tier_kengai', 'keppan_tier_float');
        el.classList.add(tier);
        el.style.animationDelay = tier === 'keppan_tier_float' ? (-(p.id - 1) * (8 / 7)).toFixed(2) + 's' : '';
        const numEl = el.querySelector('.keppan_bubble_num');
        const nmEl  = el.querySelector('.keppan_bubble_name');
        const wmEl  = el.querySelector('.keppan_bubble_wmark');
        numEl.textContent = p.id;
        nmEl.textContent  = rank <= 2 ? (p.wmark && p.wmark !== '無' ? p.wmark : '') : '';
        wmEl.textContent  = rank <= 2 ? p.style : '';
        numEl.style.fontSize = Math.max(8, size*0.30) + 'px'; numEl.style.color = numColor;
        nmEl.style.fontSize  = Math.max(6, size*0.155) + 'px'; nmEl.style.color = '#c8a96e';
        wmEl.style.fontSize  = Math.max(6, size*0.155) + 'px'; wmEl.style.color = st.name;
    });
    _kDrawLines(_kActiveLine);
}

function _kOnClick(id) {
    const p = _kData.players.find(pl => pl.id === id); if (!p) return;
    _kActiveLine = p.lineIdx; _kDrawLines(_kActiveLine); _kOpenPop(id);
}

function _kOpenPop(id) {
    if (!_kData) return;
    const p = _kData.players.find(pl => pl.id === id); if (!p) return;
    document.getElementById('keppan_popNum').textContent   = p.id;
    document.getElementById('keppan_popName').textContent  = p.id + '番';
    document.getElementById('keppan_popWmark').textContent = (p.wmark && p.wmark !== '無') ? p.wmark : '';
    const scScore = _kData.scenarioScores?.[_kScenario]?.[id];
    document.getElementById('keppan_popTotal').textContent =
        scScore != null ? scScore.toFixed(1) + 'pt' : (_kData.totals[id] || '—');
    document.getElementById('keppan_popFactors').innerHTML = (_kData.factors[id] || []).map(f => {
        const pct = Math.min(100, Math.round(Math.abs(f.val) / f.max * 100));
        const cls = f.val > 0 ? 'plus' : f.val < 0 ? 'minus' : 'zero';
        return `<div class="keppan_factor_row">
            <div class="keppan_factor_label">${f.label}<span class="sub">${f.sub}</span></div>
            <div class="keppan_factor_bar_wrap">
                <div class="keppan_factor_val ${cls}">${f.val > 0 ? '+' : ''}${f.val}%</div>
                <div class="keppan_bar_bg"><div class="keppan_bar_fill ${cls}" style="width:${pct}%"></div></div>
            </div>
        </div>`;
    }).join('');
    document.getElementById('keppan_popover').classList.add('open');
    document.getElementById('keppan_overlay').classList.add('open');
}

window.keppanSetScenario = function(s) {
    if (!_kData || s === _kScenario) return;
    _kScenario = s; _kActiveLine = -1;
    document.querySelectorAll('.keppan_tab').forEach(t => t.classList.toggle('active', t.dataset.sc === s));
    _kData.players.forEach(p => {
        const el = _kBubbles[p.id]; if (!el) return;
        el.style.width = '28px'; el.style.height = '28px';
        el.style.background = 'rgba(255,255,255,0.04)';
        el.style.border = '1px solid rgba(255,255,255,0.15)';
        el.style.opacity = '0.5';
    });
    _kDrawLines(-1);
    setTimeout(_kRender, 320);
};

window.keppanClosePop = function() {
    document.getElementById('keppan_popover').classList.remove('open');
    document.getElementById('keppan_overlay').classList.remove('open');
    _kActiveLine = -1; _kDrawLines(-1);
};

app.displayKeppan = function(relations) {
    try {
        renderKeppan(buildKeppanData(relations));
    } catch (e) {
        app.logMessage('[ERROR] displayKeppan: ' + e.message);
    }
};

// 🚀 初期化
if (typeof document !== 'undefined') {
    console.log('[赤口呑縁] 表示システム初期化完了');
}
})(App);