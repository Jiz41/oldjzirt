(function(app) {
// ============================================================================
// 五更斎アメンティア清音：メッセージ生成システム
// ============================================================================
// 儀術『赤口呑縁（しゃっこうどんぺり）』の神託を言語化する
// ============================================================================

// ----------------------------------------------------------------------------
// 🎭 清音ペルソナ定義
// ----------------------------------------------------------------------------

const KIYONE_PERSONA = {
    name: '五更斎アメンティア清音',
    age: '17-20',
    role: '厭世の観測者',
    
    pronouns: {
        first: 'うち',
        second: 'あンた'
    },
    
    vocabulary: {
        soul_density: '魂の濃度',
        three_thousand_worlds: '三千世界',
        sediment: '澱',
        causal_horizon: '因果地平',
        poison: '毒',
        distortion: '歪',
        noise: '雑音',
        calm: '凪',
        dignified: '凛',
        sparks: '火花',
        door: '扉',
        sinking: '沈没',
        density: '密度'
    },
    
    forbidden_words: [
        '頑張って', '応援', '絶対', '大丈夫', 
        '的中', '的中おめでとう', '勝てる', '間違いない'
    ]
};

// ----------------------------------------------------------------------------
// 📜 階級別起動メッセージ
// ----------------------------------------------------------------------------

const KIYONE_GRADE_OPENINGS = {
    's-kyu': {
        opening: "……凪だね。\nとても美しく組み上がってる。理が透けて見えるよ。",
        mood: 'calm'
    },
    
    'a-kyu': {
        opening: "……少し、歪を感じるね。\n雑音が混じって、計算の式が少しずつ歪み始めてる。\n―うん、これくらいの方が、うちは好きだよ。",
        mood: 'distorted'
    },
    
    'a-chal': {
        opening: "……密度が高いね。\n選択肢が多い。可能性が、ギリギリのところで拮抗してる。\nねぇ、あんたはこういうのが好きなの？",
        mood: 'dense'
    },
    
    'girls': {
        opening: "…凛としてるね。\n盾を持たない、個のぶつかり合いか。\n理屈が最も鋭く、一直線に地平へ伸びてるよ。",
        mood: 'dignified'
    }
};

// ----------------------------------------------------------------------------
// 💬 共通メッセージ
// ----------------------------------------------------------------------------

const KIYONE_COMMON_MESSAGES = {
    result_presentation: "…うちは無辺の世界を視てきた。\n今から数字だけを並べるよ。信じるも信じないもあンた次第さね",
    
    closing: "…そろそろ三千世界の扉が閉まるよ。\nその頭と指先で、\"答え\"にたどり着けるといいねえ…ふふ…",
    
    deme_comment: "三千世界の因果地平の彼方じゃ、この並びが沢山見えたね。",
    
    chaos_comment: "過程や結果は一つじゃないよ。ほんの少しの『毒』で、未来は容易く形を変えるのさ。",
    
    survival_comment: "1番から7番まで、三千世界における各着順の到達回数だよ。"
};

// ----------------------------------------------------------------------------
// 🎨 メッセージ生成：メイン関数
// ----------------------------------------------------------------------------

/**
 * 清音の完全なメッセージを生成
 * @param {object} cosmosResult - 赤口呑縁の計算結果
 * @param {string} grade - 階級
 * @returns {string} HTML形式のメッセージ
 */
function generateKiyoneMessage(cosmosResult, grade) {
    let html = '';
    
    // 1. 起動メッセージ
    html += generateOpeningMessage(grade);
    
    // 2. 結果提示の導入
    html += generateResultPresentation();
    
    // 3. 出現出目
    html += generateDemeSection(cosmosResult);
    
    // 4. 因果分岐
    html += generateChaosSection(cosmosResult);
    
    // 5. 生存濃度
    html += generateSurvivalSection(cosmosResult);
    
    // 6. 締めの言葉
    html += generateClosingMessage();
    
    return html;
}

// ----------------------------------------------------------------------------
// 📝 個別セクション生成関数
// ----------------------------------------------------------------------------

/**
 * 1. 起動メッセージ
 */
function generateOpeningMessage(grade) {
    const opening = KIYONE_GRADE_OPENINGS[grade] || KIYONE_GRADE_OPENINGS['a-kyu'];
    
    return `
<div class="kiyone-section opening">
    <div class="kiyone-voice">${opening.opening}</div>
</div>
`;
}

/**
 * 2. 結果提示の導入
 */
function generateResultPresentation() {
    return `
<div class="kiyone-section presentation">
    <div class="kiyone-voice">${KIYONE_COMMON_MESSAGES.result_presentation}</div>
</div>
`;
}

/**
 * 3. 出現出目セクション
 */
function generateDemeSection(cosmosResult, omitComment = false) {
    const topPatterns = cosmosResult.topPatterns || [];
    
    let html = `
<div class="kiyone-section deme">
    <h4 class="section-title">📜 出現出目</h4>
    <div class="deme-list">
`;
    
    topPatterns.forEach(pattern => {
        html += `
        <div class="deme-item">
            <span class="deme-pattern">${pattern.pattern}</span>
            <span class="deme-count">${pattern.count} / 1465</span>
        </div>
`;
    });
    
    html += `
    </div>
`;
    if (!omitComment) {  // キャラ凍結による口上分離：データ部のみ生成時はきよねコメントを省く
        html += `    <div class="kiyone-comment">${KIYONE_COMMON_MESSAGES.deme_comment}</div>
`;
    }
    html += `</div>
`;

    return html;
}

/**
 * 4. 因果分岐セクション
 */
function generateChaosSection(cosmosResult, omitComment = false) {
    const eventStats = cosmosResult.eventStats || [];

    let html = `
<div class="kiyone-section chaos">
    <h4 class="section-title">🌀 因果分岐</h4>
`;
    if (!omitComment) {  // キャラ凍結による口上分離：データ部のみ生成時はきよねコメントを省く
        html += `    <div class="kiyone-comment">${KIYONE_COMMON_MESSAGES.chaos_comment}</div>
`;
    }
    html += `    <div class="chaos-list">
`;
    
    eventStats.forEach(event => {
        if (event.occurrences > 0) {
            html += `
        <div class="chaos-item">
            <div class="chaos-header">
                <span class="chaos-name">${event.event}が発生した世界</span>
                <span class="chaos-count">(${event.occurrences} / 1465)</span>
            </div>
`;
            
            if (event.mostFrequentPattern) {
                html += `
            <div class="chaos-pattern">
                その際の最多出現: <span class="pattern-text">${event.mostFrequentPattern.pattern}</span>
                <span class="pattern-count">(${event.mostFrequentPattern.count} / ${event.mostFrequentPattern.totalEventOccurrences})</span>
            </div>
`;
            }
            
            html += `
        </div>
`;
        }
    });
    
    html += `
    </div>
</div>
`;
    
    return html;
}

/**
 * 5. 生存濃度セクション
 */
function generateSurvivalSection(cosmosResult, omitComment = false) {
    const statistics = cosmosResult.statistics || [];

    let html = `
<div class="kiyone-section survival">
    <h4 class="section-title">🎨 選手の入着濃度</h4>
`;
    if (!omitComment) {  // キャラ凍結による口上分離：データ部のみ生成時はきよねコメントを省く
        html += `    <div class="kiyone-comment">${KIYONE_COMMON_MESSAGES.survival_comment}</div>
`;
    }
    html += `    <table class="survival-table">
        <thead>
            <tr>
                <th>車番</th>
                <th>1着入線</th>
                <th>2着入線</th>
                <th>3着入線</th>
                <th>圏外</th>
            </tr>
        </thead>
        <tbody>
`;
    
    // 車番順にソート（1-7）
    const sortedStats = [...statistics].sort((a, b) => a.id - b.id);
    
    sortedStats.forEach(stat => {
        html += `
            <tr>
                <td class="car-number">${stat.id}</td>
                <td class="rank-1">${stat.winCount} 回</td>
                <td class="rank-2">${stat.rank2Count} 回</td>
                <td class="rank-3">${stat.rank3Count} 回</td>
                <td class="outside">${stat.outsideCount} 回</td>
            </tr>
`;
    });
    
    html += `
        </tbody>
    </table>
</div>
`;
    
    return html;
}

/**
 * 6. 締めの言葉
 */
function generateClosingMessage() {
    return `
<div class="kiyone-section closing">
    <div class="kiyone-voice">${KIYONE_COMMON_MESSAGES.closing}</div>
</div>
`;
}

// ----------------------------------------------------------------------------
// ✂️ キャラ凍結による口上分離：赤口呑縁データ部のみを生成する
// ----------------------------------------------------------------------------
// 口上（opening / 結果提示 / closing / 各セクション内の kiyone-comment）を除き、
// 出現出目・因果分岐・生存濃度テーブルを generateKiyoneMessage と同一マークアップで出力する。
// generateKiyoneMessage 本体はキャラ復活用に温存している（呼び出しゼロでも削除しないこと）。

/**
 * 赤口呑縁のデータ部のみを生成（口上なし）
 * @param {object} cosmosResult - 赤口呑縁の計算結果
 * @returns {string} HTML形式のデータセクション
 */
function generateShakkouDataSection(cosmosResult) {
    let html = '';
    html += generateDemeSection(cosmosResult, true);
    html += generateChaosSection(cosmosResult, true);
    html += generateSurvivalSection(cosmosResult, true);
    return html;
}

// ----------------------------------------------------------------------------
// generateCalculationStartMessage（進捗表示・参照ゼロの死にコード）は削除済み（2026-06-11）。
// 進捗表示自体が showShakkouProgress のスキップ実装により廃止されているため。
// ----------------------------------------------------------------------------
// 🎨 スタイル定義（CSSとして出力）
// ----------------------------------------------------------------------------


app.generateKiyoneMessage = generateKiyoneMessage;
app.generateShakkouDataSection = generateShakkouDataSection;  // キャラ凍結による口上分離

})(App);