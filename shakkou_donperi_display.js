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
    const kiyoneMessage = app.generateKiyoneMessage(cosmosResult, grade);
    const scenarioOutput = document.getElementById('scenario-output');
    
    if (scenarioOutput) {
        const existing = scenarioOutput.querySelector('.shakkou-results-container');
        if (existing) existing.remove();
        
        const resultHTML = `
<div class="shakkou-results-container">
    <div class="shakkou-header">
        <h3 class="shakkou-title">偽典『赤口呑縁』──</h3>
        <div class="shakkou-subtitle">五更斎アメンティア清音による、1465の並行世界</div>
    </div>
    
    <div class="kiyone-cutin-wrapper">
        <img src="kiyone_01.png" alt="清音" class="kiyone-cutin-image glitch-effect">
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
    background: linear-gradient(135deg, #0a0505, #1a0f0a);
    border: 3px solid #8b4513;
    border-radius: 12px;
    padding: 0;
    margin: 20px 0;
    box-shadow: 0 8px 20px rgba(139, 69, 19, 0.3);
}

.shakkou-header {
    background: linear-gradient(135deg, #2a1810, #1a0f0a);
    padding: 20px;
    border-bottom: 2px solid #8b4513;
    text-align: center;
}

.shakkou-title {
    color: #d4af37;
    font-size: 24px;
    margin: 0 0 10px 0;
    text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
    letter-spacing: 0.1em;
}

.shakkou-subtitle {
    color: #c9a55b;
    font-size: 14px;
    font-style: italic;
}

.kiyone-section {
    margin: 0;
    padding: 5px 20px 20px 20px;
    background: transparent;
    border-left: none;
    border-radius: 0;
    border-bottom: 1px solid #3a2810;
}

.kiyone-section:last-child {
    border-bottom: none;
}

.kiyone-voice {
    font-family: 'Noto Serif JP', 'Yu Mincho', 'YuMincho', serif;
    font-size: 16px;
    line-height: 1.8;
    color: #d4af37;
    font-style: italic;
    white-space: pre-line;
    margin: 15px 0;
    padding: 15px 20px;
    background: rgba(42, 24, 16, 0.3);
    border-left: 3px solid #d4af37;
    border-radius: 5px;
}

.kiyone-comment {
    font-family: 'Noto Serif JP', 'Yu Mincho', 'YuMincho', serif;
    color: #c9a55b;
    font-style: italic;
    margin: 15px 0;
    padding: 12px 20px;
    border-left: 3px solid #8b6914;
    line-height: 1.6;
    background: rgba(42, 24, 16, 0.2);
    border-radius: 5px;
}

.section-title {
    color: #d4af37;
    font-size: 20px;
    margin: 0 0 20px 0;
    padding-bottom: 10px;
    border-bottom: 2px solid #8b4513;
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
    background: rgba(26, 15, 10, 0.5);
    border-radius: 5px;
    border: 1px solid #3a2810;
    transition: all 0.3s;
}

.deme-item:hover {
    background: rgba(42, 24, 16, 0.7);
    border-color: #8b4513;
    transform: translateX(5px);
}

.deme-pattern {
    color: #d4af37;
    font-weight: bold;
    font-family: 'Courier New', monospace;
    font-size: 20px;
    letter-spacing: 0.2em;
}

.deme-count {
    color: #8b6914;
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
    background: rgba(26, 15, 10, 0.5);
    padding: 15px;
    border-left: 4px solid #8b4513;
    border-radius: 5px;
    border: 1px solid #3a2810;
    transition: all 0.3s;
}

.chaos-item:hover {
    background: rgba(42, 24, 16, 0.7);
    border-left-color: #d4af37;
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
    color: #d4af37;
    font-weight: bold;
    font-size: 16px;
}

.chaos-count {
    color: #8b6914;
    font-family: 'Courier New', monospace;
    font-size: 14px;
}

.chaos-pattern {
    color: #c9a55b;
    font-size: 14px;
    padding-left: 15px;
    margin-top: 8px;
}

.pattern-text {
    color: #d4af37;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    letter-spacing: 0.15em;
}

.pattern-count {
    color: #8b6914;
    font-family: 'Courier New', monospace;
    margin-left: 10px;
}

.survival-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
    background: rgba(26, 15, 10, 0.5);
    border: 1px solid #3a2810;
    border-radius: 5px;
    overflow: hidden;
    table-layout: auto;
}

.survival-table thead th {
    background: rgba(42, 24, 16, 0.8);
    color: #d4af37;
    padding: 12px;
    text-align: center;
    border-bottom: 2px solid #8b4513;
    font-weight: bold;
    font-size: 14px;
}

.survival-table tbody td {
    color: #c9a55b;
    padding: 10px;
    text-align: center;
    border-bottom: 1px solid #3a2810;
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
    color: #d4af37 !important;
    font-size: 16px;
}

.rank-1 { color: #e74c3c !important; font-weight: bold; }
.rank-2 { color: #3498db !important; }
.rank-3 { color: #2ecc71 !important; }
.outside { color: #7f8c8d !important; }

.kiyone-section.opening { border-bottom: 2px solid #8b4513; }
.kiyone-section.opening .kiyone-voice { border-left-color: #d4af37; background: rgba(42, 24, 16, 0.4); }

.kiyone-section.closing { margin-top: 20px; border-bottom: none; }
.kiyone-section.closing .kiyone-voice { border-left-color: #d4af37; background: rgba(42, 24, 16, 0.4); text-align: center; }

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
    border: 2px solid #8b4513;
    border-radius: 5px;
    overflow: hidden;
    box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.5);
}

.progress-bar {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #d4af37, #8b4513, #d4af37);
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
    color: #d4af37;
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
// ⚖️ 審眼八卦 表示
// ----------------------------------------------------------------------------
app.displayShinganHakke = function(data) {
    const { seitenRanked, koutenRanked, scoreMin, scoreThird, sw, hasLocal } = data;
    const out = document.getElementById('shingan-hakke-output');
    if (!out) return;

    injectShinganStyles();

    function sanrentan(ranked) {
        if (ranked.length < 3) return '—';
        return ranked[0].id + '-' + ranked[1].id + '-' + ranked[2].id;
    }

    function clLabel(c_l) {
        if (c_l >= 1.05) return 'ライン連携厚く、';
        if (c_l >= 1.01) return 'ライン連携あり、';
        return '単騎同然、';
    }
    function localLabel(p, rank) {
        if (p.isLocal) return '地の利も重なる。';
        if (rank === 1) return '地の利はないが、';
        return '';
    }
    function kiryokuLabel(score) {
        if (score >= scoreMin + scoreThird * 2) return '機力上位、';
        if (score >= scoreMin + scoreThird)     return '機力は中程度、';
        return '機力に不安を残す、';
    }
    function recentLabel(p) {
        return p.trendLabel === '上昇' ? '調子右肩上がり、'
             : p.trendLabel === '下降' ? '近況に陰りあり、'
             : '近況安定、';
    }
    function wmarkLabel(wmark) {
        if (wmark === '◎') return '紙面の評価も高い。';
        if (wmark === '〇') return '紙面の支持あり。';
        return '';
    }
    function shimeLabel(rank) {
        if (rank === 1) return '軸に推す。';
        if (rank === 2) return 'ヒモに加えたい。';
        return '抑えに加えたい。';
    }

    const top3 = seitenRanked.slice(0, 3);
    const rankMap = {};
    top3.forEach((p, i) => { rankMap[p.id] = i + 1; });
    const top3Sorted = [...top3].sort((a, b) => a.id - b.id);

    let commentsHtml = '';
    top3Sorted.forEach(p => {
        const rank = rankMap[p.id];
        const wm = wmarkLabel(p.wmark);
        const line1 = clLabel(p.c_l) + localLabel(p, rank);
        const line2 = kiryokuLabel(p.score) + recentLabel(p) + (wm || '') + shimeLabel(rank);
        commentsHtml += '<div class="sg-comment">'
            + '<div class="sg-comment-hd"><strong>' + p.id + '番</strong></div>'
            + '<div class="sg-comment-ln">' + line1 + '</div>'
            + '<div class="sg-comment-ln sg-indent">' + line2 + '</div>'
            + '</div>';
    });

    out.innerHTML = '<div class="sg-container">'
        + '<div class="sg-title">&#x2696;&#xFE0F; 審眼八卦</div>'
        + '<div class="sg-bets">'
        + '<div>&#x2600;&#xFE0F; 晴天令 三連単：' + sanrentan(seitenRanked) + '</div>'
        + '<div>&#x26C8;&#xFE0F; 荒天令 三連単：' + sanrentan(koutenRanked) + '</div>'
        + '</div>'
        + '<div class="sg-comments">' + commentsHtml + '</div>'
        + '</div>';
};

function injectShinganStyles() {
    if (document.getElementById('shingan-hakke-styles')) return;
    const s = document.createElement('style');
    s.id = 'shingan-hakke-styles';
    s.textContent = `
.sg-container{margin:14px 0;padding:14px 16px;border:1px solid rgba(218,165,32,0.3);border-radius:8px;background:rgba(218,165,32,0.05)}
.sg-title{font-size:13px;font-weight:bold;color:#c8a030;letter-spacing:.08em;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(218,165,32,0.2)}
.sg-bets{font-size:12px;color:#ddd;margin-bottom:12px;display:flex;flex-direction:column;gap:4px;padding:8px 10px;background:rgba(0,0,0,0.15);border-radius:6px}
.sg-comment{margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.05)}
.sg-comment:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none}
.sg-comment-hd{font-size:12px;color:#c8a030;margin-bottom:2px}
.sg-comment-ln{font-size:11px;color:#ccc;line-height:1.6}
.sg-indent{padding-left:1em}
    `;
    document.head.appendChild(s);
}

app.completeShakkouCalculation = function(cosmosResult, grade) {
    try {
        displayShakkouResults(cosmosResult, grade);
    } catch(e) {
        app.logMessage('[ERROR] displayShakkouResults: ' + e.message);
    }
}

// 🚀 初期化
if (typeof document !== 'undefined') {
    console.log('[赤口呑縁] 表示システム初期化完了');
}
})(App);