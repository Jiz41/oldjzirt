// VERSION: 2.0
(function(app) {
// ============================================================================
// 儀術『赤口呑縁（しゃっこうどんぺり）』表示制御システム
// ============================================================================
// 出目上位5点・ヒートマップのみを表示する（清音の演出・審眼八卦は削除済み）
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
 * 出目上位5点のテーブルHTMLを生成
 * @param {object} cosmosResult - 計算結果
 */
function buildTopPatternsHTML(cosmosResult) {
    const total = (cosmosResult.metadata && cosmosResult.metadata.totalSimulations) || 0;
    const topPatterns = (cosmosResult.topPatterns || []).slice(0, 5);

    const rows = topPatterns.map((p, idx) => {
        const rate = total > 0 ? ((p.count / total) * 100).toFixed(1) : '0.0';
        return `
        <tr>
            <td class="shakkou-rank">${idx + 1}</td>
            <td class="shakkou-pattern">${p.pattern}</td>
            <td class="shakkou-rate">${rate}%</td>
            <td class="shakkou-count">${p.count}件</td>
        </tr>`;
    }).join('');

    return `
<div class="shakkou-top-patterns">
    <h4 class="shakkou-section-title">出目 上位5点</h4>
    <table class="shakkou-pattern-table">
        <thead>
            <tr><th>順位</th><th>出目</th><th>出現率</th><th>件数</th></tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>
</div>`;
}

/**
 * ヒートマップ（車番×着順）のテーブルHTMLを生成
 * @param {object} cosmosResult - 計算結果
 */
function buildHeatmapHTML(cosmosResult) {
    const total = (cosmosResult.metadata && cosmosResult.metadata.totalSimulations) || 0;
    const statistics = (cosmosResult.statistics || []).slice().sort((a, b) => a.id - b.id);

    // 列（1〜3着）ごとに上位3車のidを求める（バッジ付与用）
    const topByRank = {};
    [1, 2, 3].forEach(rank => {
        const sorted = statistics
            .map(s => ({ id: s.id, value: (s.distribution && s.distribution[rank]) || 0 }))
            .sort((a, b) => b.value - a.value);
        topByRank[rank] = sorted.slice(0, 3).map(s => s.id);
    });

    const badgeMap = ['①', '②', '③'];
    const medalClass = ['medal-gold', 'medal-silver', 'medal-bronze'];

    function cellHTML(stat, rank) {
        const count = (stat.distribution && stat.distribution[rank]) || 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        const pctLabel = pct.toFixed(1) + '%';
        const rankIdx = topByRank[rank].indexOf(stat.id);
        const isTop = rankIdx !== -1 && pct > 0;
        const badge = isTop ? `<span class="shakkou-badge ${medalClass[rankIdx]}">${badgeMap[rankIdx]}</span>` : '';
        const bg = `rgba(212, 175, 55, ${Math.min(pct / 100, 1) * 0.75 + (pct > 0 ? 0.05 : 0)})`;
        const topClass = isTop ? 'shakkou-cell-top' : '';
        return `<td class="shakkou-heat-cell ${topClass}" style="background:${bg};">${badge}${pctLabel}</td>`;
    }

    const rows = statistics.map(stat => {
        const isAbsent = total > 0 && [1, 2, 3, 4, 5, 6, 7].every(r => ((stat.distribution && stat.distribution[r]) || 0) === 0);
        const rowClass = isAbsent ? 'shakkou-row-absent' : '';
        return `
        <tr class="${rowClass}">
            <td class="shakkou-car-number">${stat.id}番</td>
            ${cellHTML(stat, 1)}
            ${cellHTML(stat, 2)}
            ${cellHTML(stat, 3)}
        </tr>`;
    }).join('');

    return `
<div class="shakkou-heatmap">
    <h4 class="shakkou-section-title">ヒートマップ</h4>
    <table class="shakkou-heat-table">
        <thead>
            <tr><th>車番</th><th>1着</th><th>2着</th><th>3着</th></tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>
</div>`;
}

/**
 * 赤口呑縁の結果を表示
 * @param {object} cosmosResult - 計算結果
 * @param {string} grade - 階級
 */
function displayShakkouResults(cosmosResult, grade) {
    const scenarioOutput = document.getElementById('scenario-output');

    if (scenarioOutput) {
        const existing = scenarioOutput.querySelector('.shakkou-results-container');
        if (existing) existing.remove();

        const resultHTML = `
<div class="shakkou-results-container">
    ${buildTopPatternsHTML(cosmosResult)}
    ${buildHeatmapHTML(cosmosResult)}
</div>
        `;

        // 計算中の表示（進捗バー）を特定して、結果に置き換える
        const progressArea = document.querySelector('.shakkou-calculation-start');
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
   儀術『赤口呑縁』結果表示スタイル（出目上位5点・ヒートマップのみ）
   ============================================================================ */

.shakkou-results-container {
    background: linear-gradient(135deg, #0a0505, #1a0f0a);
    border: 3px solid #8b4513;
    border-radius: 12px;
    padding: 16px;
    margin: 20px 0;
    box-shadow: 0 8px 20px rgba(139, 69, 19, 0.3);
}

.shakkou-section-title {
    color: #d4af37;
    font-size: 16px;
    margin: 0 0 10px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid #8b4513;
}

.shakkou-top-patterns {
    margin-bottom: 20px;
}

.shakkou-pattern-table,
.shakkou-heat-table {
    width: 100%;
    border-collapse: collapse;
    background: rgba(26, 15, 10, 0.5);
    border: 1px solid #3a2810;
    border-radius: 5px;
    overflow: hidden;
    table-layout: auto;
}

.shakkou-pattern-table thead th,
.shakkou-heat-table thead th {
    background: rgba(42, 24, 16, 0.8);
    color: #d4af37;
    padding: 10px;
    text-align: center;
    border-bottom: 2px solid #8b4513;
    font-weight: bold;
    font-size: 13px;
}

.shakkou-pattern-table tbody td,
.shakkou-heat-table tbody td {
    color: #c9a55b;
    padding: 8px;
    text-align: center;
    border-bottom: 1px solid #3a2810;
    font-family: 'Courier New', monospace;
    font-size: 12px;
}

.shakkou-pattern-table tbody tr:last-child td,
.shakkou-heat-table tbody tr:last-child td {
    border-bottom: none;
}

.shakkou-rank {
    font-weight: bold;
    color: #d4af37 !important;
}

.shakkou-pattern {
    color: #d4af37;
    font-weight: bold;
    letter-spacing: 0.15em;
}

.shakkou-car-number {
    font-weight: bold;
    color: #d4af37 !important;
    font-size: 14px;
    white-space: nowrap;
}

.shakkou-heat-cell {
    font-weight: normal;
    transition: all 0.2s;
}

.shakkou-cell-top {
    font-weight: bold;
    border: 2px solid #d4af37 !important;
}

.shakkou-badge {
    display: inline-block;
    margin-right: 4px;
    font-size: 13px;
}

.medal-gold { color: #ffd700 !important; }
.medal-silver { color: #c0c0c0 !important; }
.medal-bronze { color: #cd7f32 !important; }

.shakkou-row-absent {
    opacity: 0.4;
}

@media (max-width: 600px) {
    .shakkou-section-title { font-size: 14px; }
    .shakkou-pattern-table thead th, .shakkou-pattern-table tbody td,
    .shakkou-heat-table thead th, .shakkou-heat-table tbody td { padding: 6px 4px; font-size: 11px; }
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