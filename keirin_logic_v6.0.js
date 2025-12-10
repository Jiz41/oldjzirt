// 真自在律 実質Ver7.3
// 競りライン追加版
// 【V7.3 最終修正】消耗ペナルティ適用拡大 ＆ 複数競り表示修正

// 1. 🗃️ 係数設定オブジェクトの分離
const COEFFICIENT_SETTINGS = {
    's-kyu': { R_BIAS: 1.15, RECENT_WEIGHT: 0.90, COOP_WEIGHT: 1.20, IS_GIRLS: false },
    'a-kyu': { R_BIAS: 1.00, RECENT_WEIGHT: 1.00, COOP_WEIGHT: 1.00, IS_GIRLS: false },
    'a-chal': { R_BIAS: 0.90, RECENT_WEIGHT: 1.20, COOP_WEIGHT: 0.80, IS_GIRLS: false },
    'girls': { R_BIAS: 1.00, RECENT_WEIGHT: 1.10, COOP_WEIGHT: 1.00, IS_GIRLS: true },
}; 

const C_MARK_VALUES = { 
    HIGH: 1.12, 
    MEDIUM: 1.08, 
    LOW: 1.03
}; 

// ========== 競り専用係数 ==========
const SERI_STYLE_BONUS = { // 脚質別競り係数 C_style (追込重視)
    '追': 1.05, 
    '両': 1.00, 
    '自': 0.95  
};
const SERI_FATIGUE_PENALTY_IN = 0.15;  // 競り勝った側（イン）の体力消耗減点 $\Delta_{in}$
const SERI_FATIGUE_PENALTY_OUT = 0.25; // 競り負けた側（アウト）の体力消耗減点 $\Delta_{out}$
const SERI_WIN_BONUS = 0.05;           // 競り勝ち選手への微増補正
// =======================================

// バンクデータを格納するグローバル変数
let BANK_DATA = {}; 


// ====================================================================================
// 💥 【新規追加】壱耀晴乾ノ象 (いちようせいかんのしょう) 判定ロジック (事前計算) 💥
// ====================================================================================

// 確定した優位性の閾値 (中立的中率 2.06% 以上)
const SUPERIORITY_THRESHOLD_RATE = 0.0206;

// 複合集計データ（天運指数 x 脚質ごとの三連単3点買い的中率。ichiyouseiken.jsonからロードされる想定）
// ※ 現状はコード内に直接定義
const RAW_COMPOSITE_STATS = [
    { pattern_key: "0_差し", hit_rate: 0.0309 },
    { pattern_key: "33_逃げ", hit_rate: 0.0206 },
    // ... 他のデータが続くが、このロジックでは targetPatterns以外は無視される
];

/**
 * 過去データから優位性の高い複合パターンを抽出し、リストを生成する関数。
 * @returns {string[]} 優位性が確認された複合パターンのキー配列 (ここでは ["0_差し"] のみ)
 */
function calculateSuperiorityList() {
    const superiorPatterns = [];
    // 【最終決定】優位なパターンとして決定されたキー
    const targetPatterns = ["0_差し"];

    for (const data of RAW_COMPOSITE_STATS) {
        const key = data.pattern_key;
        const rate = data.hit_rate;

        // ターゲットパターンに一致し、かつ閾値を超えているかチェック
        if (targetPatterns.includes(key) && rate >= SUPERIORITY_THRESHOLD_RATE) {
            superiorPatterns.push(key);
        }
    }
    
    return superiorPatterns;
}

// 判定ロジックが使用する最終的な優位性リスト (初期ロード時に一度だけ実行される想定)
const SUPERIOR_PATTERNS_FINAL_LIST = calculateSuperiorityList();
// ====================================================================================


// ロギング関数 (変更なし)
function logMessage(message) { 
    const logArea = document.getElementById('debug-log'); 
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false }); 
    if (logArea) { 
        logArea.innerHTML += `[${timestamp}] ${message}<br>`; 
        logArea.scrollTop = logArea.scrollHeight; 
    } 
} 

// getPlayerData 関数 (変更なし - 欠場フラグの読み込み済み)
function getPlayerData() { 
    const players = []; 
    const playerRows = document.querySelectorAll('.player-row'); 
    const s1Leader = document.querySelector('input[name="s-leader"]:checked'); 
    const b1Leader = document.querySelector('input[name="b-leader"]:checked'); 
    const s1Id = s1Leader ? parseInt(s1Leader.getAttribute('data-id')) : null; 
    const b1Id = b1Leader ? parseInt(b1Leader.getAttribute('data-id')) : null; 

    playerRows.forEach(row => { 
        const id = parseInt(row.getAttribute('data-id')); 
        if (isNaN(id)) return; 

        const score = parseFloat(row.querySelector('.score').value) || 0;
        const style = row.querySelector('.style').value;
        const wmark = row.querySelector('.wmark').value.trim();
        // 💡 欠場チェックボックスの状態を読み込む
        const isScratchCheckbox = row.querySelector('.is-scratch');
        const is_scratch = isScratchCheckbox ? isScratchCheckbox.checked : false;
        
        players.push({ 
            id: id, 
            score: score, 
            style: style, 
            wmark: wmark, 
            recent: row.querySelector('.recent').value.trim(), 
            is_s1: id === s1Id, 
            is_b1: id === b1Id,
            is_scratch: is_scratch, // 💡 欠場フラグ
            c_score_adj: 1.0, 
            c_recent: 1.0, 
            c_wmark: 1.0, 
            c_s1: 1.0, 
            c_b1: 1.0, 
            c_l: 1.0, 
            c_e: 1.0, 
            final_score: 0,
            // 競り係数 C_seri の初期計算
            seri_coef: score * (SERI_STYLE_BONUS[style] || 1.00) * (wmark === '◎' ? 1.04 : 1.0)
        }); 
    }); 
    return players;
} 

// loadBankData 関数 (変更なし)
async function loadBankData() { 
    try { 
        logMessage("[INIT] bankdata.jsonの読み込みを開始します..."); 
        const response = await fetch('bankdata.json'); 
        if (!response.ok) { 
            logMessage(`[ERROR] bankdata.jsonの読み込みに失敗しました: HTTP status ${response.status}`); 
            throw new Error('Bank data failed to load.'); 
        } 

        BANK_DATA = await response.json(); 
        logMessage(`[SUCCESS] bankdata.jsonを正常に読み込みました。 ${Object.keys(BANK_DATA).length}件のバンクデータをロード。`); 

        // UIの動的構築 (バンク名選択肢の生成) 
        const bankSelect = document.getElementById('bank-name'); 
        if (bankSelect) { 
            bankSelect.innerHTML = ''; 
            Object.keys(BANK_DATA).forEach(bankName => { 
                const option = document.createElement('option'); 
                option.value = bankName; 
                option.textContent = bankName; 
                bankSelect.appendChild(option); 
            }); 
            logMessage("[UI] バンク名の選択肢を動的に構築しました。"); 
            // データを読み込んだら、一度展開傾向を表示する 
            displayBankTendency(); 
        } 
    } catch (error) { 
        logMessage(`[FATAL ERROR] データ読み込み処理中に重大なエラーが発生: ${error.message}`); 
        BANK_DATA = { 
            'ダミーバンク': { length: 400, keirin_bias: { '先行': 1.0, '捲り': 1.0, '差し': 1.0 }, wind_or_position: {} } 
        }; 
        const bankSelect = document.getElementById('bank-name'); 
        if (bankSelect) { 
            bankSelect.innerHTML = '<option value="ダミーバンク">データ読み込み失敗</option>'; 
        }
    }
} 

// displayBankTendency 関数 (変更なし)
function displayBankTendency() { 
    const bankName = document.getElementById('bank-name').value; 
    const displayArea = document.getElementById('bank-tendency-display'); 
    
    if (!bankName || !BANK_DATA[bankName] || !displayArea) { 
        if (displayArea) displayArea.innerHTML = ''; 
        return; 
    } 

    const bias = BANK_DATA[bankName].keirin_bias; 
    const biasMap = { 
        '先行': bias['先行'] || 1.0, 
        '捲り': bias['捲り'] || 1.0, 
        '差し': bias['差し'] || 1.0 
    }; 
    
    let maxBias = -Infinity; 
    let strongestTendency = ''; 
    const styleMap = { '先行': '逃先', '捲り': '捲り', '差し': '差マ' }; 
    
    Object.keys(biasMap).forEach(key => { 
        if (biasMap[key] > maxBias) { 
            maxBias = biasMap[key]; 
            strongestTendency = key; 
        } 
    }); 

    let message = ''; 
    if (maxBias > 1.03) { 
        const displayedStyle = styleMap[strongestTendency]; 
        message = `⚠️ **${bankName}**は**${displayedStyle}**が**出やすい**傾向があります。 (バイアス ${maxBias.toFixed(2)})`; 
    } else if (maxBias < 0.97) { 
        const displayedStyle = styleMap[strongestTendency]; 
        message = `✅ **${bankName}**は**${displayedStyle}**が最も低い傾向です。`; 
    } else { 
        message = `ℹ️ **${bankName}**は脚質による大きな傾向差は**ありません**。`; 
    } 

    displayArea.innerHTML = message; 
    logMessage(`[BANK] ${bankName} の展開傾向: ${message.replace(/<[^>]*>?/gm, '')}`);
} 

// ページロード時にデータ読み込みを実行 (変更なし)
(async function() { 
    await loadBankData();
})(); 


// ========== 競り対応強化版 parseLineInput 関数 (💡 修正: allSeriInfosを返すように変更) ==========
/**
 * ライン入力文字列 (例: 12(3)4(5)6) を解析し、ライン構成と競り情報を抽出する。
 * 💡 複数競り、ライン内競り、競り敗者の単騎扱いを正確に処理。
 */
function parseLineInput(lineInput, allPlayers) {
    logMessage(`[PARSE] ライン入力解析開始: ${lineInput}`);
    const processedLineInput = lineInput.replace(/\s/g, '');
    const segments = processedLineInput.split(',');
    
    const lines = []; // スコア計算に使用するライン（競り勝者のみが残る）
    let orderedPlayerIds = []; // 最終的な表示順
    const allSeriInfos = []; // 💡 修正: 全ての競り情報を格納
    const allParsedIds = new Set();
    
    // 競り並びを識別するパターン: 2(3) の形式を抽出する
    const seriPattern = /(\d)\((\d)\)/; 

    segments.forEach(seg => {
        let currentLine = []; // 競り敗者を除いた、ライン構成選手のリスト
        let segOrderedIds = [];
        let remainingSeg = seg; 
        
        while (remainingSeg.length > 0) {
            
            // 競り並びを探す: 例: 2(3)
            let seriMatch = remainingSeg.match(seriPattern);

            if (seriMatch) {
                // 競り並びがある場合
                const seriStart = seriMatch.index;
                const seriEnd = seriStart + seriMatch[0].length;
                
                // 1. 競り並びの前の数字列を処理 (例: 12(3)4(5)6 の中の "1" または "4")
                if (seriStart > 0) {
                    const numericalPart = remainingSeg.substring(0, seriStart);
                    // 前の数字列を、ラインの構成要素として追加
                    numericalPart.split('').map(Number).filter(id => id > 0).forEach(id => {
                        if (!allParsedIds.has(id)) {
                            segOrderedIds.push(id);
                            allParsedIds.add(id);
                        }
                        currentLine.push(id);
                    });
                }
                
                // 2. 競り並びを処理 (例: 2(3) または 5(6))
                const follower = parseInt(seriMatch[1]); // イン側
                const contender = parseInt(seriMatch[2]); // アウト側
                
                logMessage(`[PARSE] 競り検出: 選手${follower} (イン) vs 選手${contender} (アウト)`);
                
                // 勝敗予測
                const followerCoef = allPlayers.find(p => p.id === follower)?.seri_coef || 0;
                const contenderCoef = allPlayers.find(p => p.id === contender)?.seri_coef || 0;

                let winnerId;
                let loserId;

                // 💡 勝敗判定ロジック
                if (followerCoef >= contenderCoef) {
                    winnerId = follower;
                    loserId = contender;
                } else {
                    winnerId = contender;
                    loserId = follower;
                }
                
                allSeriInfos.push({ // 💡 全ての競り情報を追加
                    exists: true, follower, contender, winner: winnerId, loser: loserId 
                });
                logMessage(`[PARSE] 競り勝者予測: 選手${winnerId}`);
                
                // 競り勝者のみをライン構成に追加 (ラインに連なる)
                currentLine.push(winnerId); 
                
                // 競り敗者を単独ラインとして追加 (スコア計算用)
                lines.push([loserId]); 
                
                // 順序の構築 (表示順): 3選手全てを登場順で追加
                if (!allParsedIds.has(follower)) {
                    segOrderedIds.push(follower);
                    allParsedIds.add(follower);
                }
                if (!allParsedIds.has(contender)) {
                    segOrderedIds.push(contender);
                    allParsedIds.add(contender);
                }

                // 3. 競り並びの文字列のみを削除し、次のループへ
                remainingSeg = remainingSeg.substring(seriEnd);
                
            } else {
                // 競り並びがない場合、残りの文字列すべてを数字列として処理
                remainingSeg.split('').map(Number).filter(id => id > 0).forEach(id => {
                    if (!allParsedIds.has(id)) {
                        segOrderedIds.push(id);
                        allParsedIds.add(id);
                    }
                    currentLine.push(id);
                });
                remainingSeg = ""; // 終了
            }
        } // while (remainingSeg.length > 0)
        
        // currentLineが空でなければ、ラインとして追加（競りを経たライン）
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }

        // セグメント内の順序を、全体順序に追加
        orderedPlayerIds.push(...segOrderedIds);
    });
    
    // 重複IDを削除し、隊列順を維持
    const uniqueOrderedPlayerIds = [];
    const seenIds = new Set();
    for (const id of orderedPlayerIds) {
        if (!seenIds.has(id)) {
            uniqueOrderedPlayerIds.push(id);
            seenIds.add(id);
        }
    }

    // 💡 修正: 全ての競り情報 (allSeriInfos) を返す
    return { lines, allSeriInfos, orderedPlayerIds: uniqueOrderedPlayerIds };
}
// ====================================================================================


// ========== ライン強度計算 (calculateLineCoeffs) - 💡 修正箇所：allSeriInfosを返すように変更 ==========
/**
 * ライン強度係数 C_L の計算を行う
 */
function calculateLineCoeffs(players, settings) { 
    
    // ----------------------------------------------------
    // 💡 V7.3 欠場選手除外ロジック (最重要)
    // ----------------------------------------------------
    const participatingPlayers = players.filter(p => !p.is_scratch);
    logMessage(`[SCRATCH] 欠場選手を除外しました。出走選手数: ${participatingPlayers.length}`);

    // もし出走選手が0の場合、計算を中止
    if (participatingPlayers.length === 0) {
        logMessage("[ERROR] 出走選手がゼロのため、ライン解析をスキップします。");
        // 💡 修正: allSeriInfosは空の配列を返す
        return { players: [], allSeriInfos: [], finalOrderedPlayerIds: [] }; 
    }

    // 以降のライン解析は、participatingPlayersに対して行う
    const lineInput = document.getElementById('line-input').value; 
    // 💡 修正: allSeriInfosを受け取るように変更
    const { lines: initialLines, allSeriInfos: parsedAllSeriInfos, orderedPlayerIds: initialOrderedPlayerIds } = parseLineInput(lineInput, participatingPlayers); 
    
    let lines = [...initialLines]; // スコア計算に使うライン
    let finalOrderedPlayerIds = [...initialOrderedPlayerIds]; // 表示に使う並び

    // 🚨 欠落選手強制補完ロジック (V7.2) 🚨
    const playerIdsSet = new Set(initialOrderedPlayerIds);
    
    // 1. 欠落選手を finalOrderedPlayerIds に補完 (ラインに入力されなかった出走選手)
    const participatingIds = new Set(participatingPlayers.map(p => p.id));
    
    // 出走選手の中で、ライン入力に含まれていない選手を探す
    participatingPlayers.forEach(p => {
        if (!playerIdsSet.has(p.id)) {
            // 💡 修正: finalOrderedPlayerIds に含める (ライン強度に単騎として表示させるため)
            finalOrderedPlayerIds.push(p.id); 
            playerIdsSet.add(p.id); 
        }
    });
    logMessage(`[ORDER] 最終表示順序: ${finalOrderedPlayerIds.join(', ')}`);


    // 2. スコア計算用ラインリストを再構築し、すべての出走選手が含まれるようにする
    const allRidersInLines = new Set();
    lines.forEach(line => line.forEach(id => allRidersInLines.add(id)));

    // ラインに含まれていない出走選手は単騎ラインとして追加
    participatingPlayers.forEach(p => {
        if (!allRidersInLines.has(p.id)) {
            lines.push([p.id]); // ライン計算用
        }
    });

    // 3. Player ID -> Line ID のマッピングを、**lines配列の最終的な構成**に基づいて再構築 (ロジックとして維持)
    const playerToLineMap = {}; 
    lines.forEach((members, index) => {
        members.forEach(id => {
            playerToLineMap[id] = index + 1;
        });
    });

    // C_L係数計算 (ライン結束力係数) - ロジックは変更なし
    if (settings.IS_GIRLS) { 
        logMessage(`[C_L] ガールズ競輪モード。エースマーク係数 $C_{mark}$ を評価。`); 
        const ace = participatingPlayers.reduce((max, p) => (p.score > max.score ? p : max), { score: -Infinity }); 
        let aceMarkPlayers = new Set(); 

        lines.forEach(line => { 
            const aceIndex = line.indexOf(ace.id); 
            if (aceIndex !== -1 && aceIndex < line.length - 1) { 
                const markerId = line[aceIndex + 1]; 
                aceMarkPlayers.add(markerId); 
            } 
        }); 

        let cMarkValue = 1.0; 
        if (ace.score >= 105.0) cMarkValue = C_MARK_VALUES.HIGH; 
        else if (ace.score >= 102.0) cMarkValue = C_MARK_VALUES.MEDIUM; 
        else cMarkValue = C_MARK_VALUES.LOW; 

        // participatingPlayersに対して係数を適用
        participatingPlayers.forEach(p => { 
            p.c_l = 1.0; // 初期化
            if (aceMarkPlayers.has(p.id)) { 
                p.c_l = cMarkValue; 
            } else if (lines.some(l => l.includes(p.id)) && !aceMarkPlayers.has(p.id)) { 
                p.c_l = 1.005; 
            }
        }); 
    } else { 
        logMessage(`[C_L] 一般競輪 (${settings.R_BIAS.toFixed(2)}) モード。ライン結束力係数 $C_{coop}$ を評価。`); 
        const coopWeight = settings.COOP_WEIGHT; 
        
        // participatingPlayersに対して係数を適用
        participatingPlayers.forEach(p => p.c_l = 1.0); // 全員初期化
        lines.forEach(line => { 
            if (line.length < 2) return;
            
            const p2Id = line[1]; 
            const p2 = participatingPlayers.find(p => p.id === p2Id); // 参加選手のみから検索
            if (p2) { 
                p2.c_l = 1.0 + (0.06 * coopWeight); 
            } 
            for (let i = 2; i < line.length; i++) { 
                const pNId = line[i]; 
                const pN = participatingPlayers.find(p => p.id === pNId); // 参加選手のみから検索
                if (pN) { 
                    pN.c_l = 1.0 + (0.02 * coopWeight); 
                } 
            } 
        }); 
    } 

    // 欠場選手を除外したparticipatingPlayersと、欠場選手を除いた並び順、そして全ての競り情報を返す
    // 💡 修正: allSeriInfosを返す
    return { players: participatingPlayers, allSeriInfos: parsedAllSeriInfos, finalOrderedPlayerIds };
} 
// =========================================================


// applySeriCorrection 関数 (💡 修正: 全ての競り情報に基づいて補正を適用)
function applySeriCorrection(scoredPlayers, allSeriInfos) {
    if (allSeriInfos.length === 0) {
        return scoredPlayers;
    }
    
    // 💡 修正: 全ての競り並びをループして補正を適用
    allSeriInfos.forEach((seriInfo, index) => {
        logMessage(`[SERI] 競り補正開始 (競り${index + 1}): 選手${seriInfo.winner} vs 選手${seriInfo.loser}`);

        // 競り勝者 (Winner): 小さいボーナスと小さい減点 (イン側勝利と仮定)
        const winner = scoredPlayers.find(p => p.id === seriInfo.winner);
        if (winner) {
            // 勝者にはボーナスと消耗減点（イン側と同じ値を使用）
            winner.final_score = winner.final_score * (1 + SERI_WIN_BONUS) * (1 - SERI_FATIGUE_PENALTY_IN);
            logMessage(`[SERI] 競り勝者 選手${winner.id}: スコア微増/体力減点 ${Math.round(SERI_FATIGUE_PENALTY_IN * 100)}%`);
        }

        // 競り敗者 (Loser): アウト側が競り負けた場合の大きな減点
        const loser = scoredPlayers.find(p => p.id === seriInfo.loser);
        if (loser) {
            // 敗者には大幅な消耗減点（アウト側と同じ値を使用）
            loser.final_score *= (1 - SERI_FATIGUE_PENALTY_OUT);
            logMessage(`[SERI] 競り敗者 選手${loser.id}: スコア大幅減点 ${Math.round(SERI_FATIGUE_PENALTY_OUT * 100)}%`);
        }
    });

    return scoredPlayers;
}


function getScenarioCoeffs(scenario) { // (変更なし)
    if (scenario === '先行有利') return { '自': 1.05, '追': 1.02, '両': 1.03 }; 
    if (scenario === '捲り有利') return { '自': 1.00, '追': 1.05, '両': 1.04 }; 
    if (scenario === '差し有利') return { '自': 0.90, '追': 1.08, '両': 1.05 }; 
    return { '自': 1.0, '追': 1.0, '両': 1.0 };
} 

function generateScenarioWagers(results) { // (変更なし)
    const top3 = results.slice(0, 3).map(p => p.id); 
    const tritan = [ 
        `${top3[0]}-${top3[1]}-${top3[2]}`, 
        `${top3[0]}-${top3[2]}-${top3[1]}`, 
        `${top3[1]}-${top3[0]}-${top3[2]}` 
    ].join(', '); 
    
    const top4 = results.slice(0, 4).map(p => p.id); 
    const tri1 = [...top4.slice(0, 3)].sort((a, b) => a - b).join('='); 
    
    let tri2 = ''; 
    if (top4.length >= 4) { 
        tri2 = [top4[0], top4[1], top4[3]].sort((a, b) => a - b).join('='); 
    } 
    
    const trifuku = [tri1, tri2].filter(t => t.length > 0).join(', '); 
    return { tritan, trifuku };
} 

function assignFinalGrades(scenarioPlayers) { // (変更なし)
    if (scenarioPlayers.length === 0) return; 
    
    const scores = scenarioPlayers.map(p => p.final_score); 
    const maxScore = scores[0]; 
    const minScore = scores[scores.length - 1]; 
    const range = maxScore - minScore; 
    
    scenarioPlayers.forEach(p => { 
        let grade = 1; 
        if (range > 0) { 
            grade = Math.ceil(1 + 9 * (p.final_score - minScore) / range); 
        } 
        p.grade = Math.min(10, Math.max(1, grade)); 
    }); 
    
    scenarioPlayers.forEach((p, index) => { 
        p.strength_mark = '→'; 
        if (index === scenarioPlayers.length - 1) return; 
        
        const nextPlayer = scenarioPlayers[index + 1]; 
        
        if (p.grade === nextPlayer.grade) { 
            const scoreDiff = p.final_score - nextPlayer.final_score; 
            
            if (scoreDiff >= (range / 1000) * 1) { 
                p.strength_mark = '↑'; 
            } else if (scoreDiff >= (range / 1000) * 0.1) { 
                p.strength_mark = '↗'; 
            } else { 
                p.strength_mark = '→'; 
            } 
        } 
    });
} 

// calculate_koutenrei_bias 関数 (変更なし)
function calculate_koutenrei_bias(players, scenario, bankData) { 
    logMessage("[KOUTENREI] 荒天令リスクバイアス (C係数) の計算を開始..."); 
    
    let tempPlayers = JSON.parse(JSON.stringify(players)); 
    
    const allScores = players.map(p => p.score); 
    const scoreMax = Math.max(...allScores); 
    const scoreMin = Math.min(...allScores); 
    const scoreRange = scoreMax - scoreMin; 

    const lineInput = document.getElementById('line-input').value;
    // 欠場選手を除外したリストをparseLineInputに渡す
    const { lines: initialLines } = parseLineInput(lineInput, tempPlayers); 

    const lines = [];
    const allRidersInLines = new Set();
    initialLines.forEach(line => {
        lines.push(line);
        line.forEach(id => allRidersInLines.add(id));
    });

    // 欠場選手を除いた出走選手の中で、ライン入力に入っていない選手を単騎ラインとして追加
    tempPlayers.forEach(p => {
        if (!allRidersInLines.has(p.id)) {
            lines.push([p.id]); 
        }
    });


    // --- C係数の計算と適用 --- 
    tempPlayers.forEach(p => { 
        let C_TOTAL = 1.0; 
        
        // 1. C_short (走路距離補正) 
        if (bankData.length === 333) { 
            C_TOTAL *= 0.985; 
            logMessage(`[C_short] 短走路(${bankData.length}m)ブースト適用。`); 
        } 
        
        // 2. C_risk (接触・落車リスク) 
        const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length; 
        const recentAvg = p.recent.split('').map(Number).reduce((a, b) => a + b, 0) / p.recent.length || 4.0; 
        if (p.score < avgScore - 2.0 && recentAvg >= 4.0) { 
            C_TOTAL *= 0.97; 
            logMessage(`[C_risk] 選手ID ${p.id} は不安定指数が高いため減点。`); 
        } 
        
        // 3. C_mental (メンタル・疲労減衰) 
        const raceGrade = document.getElementById('race-type').value; 
        // 参加選手のみを対象にスコア最大値を求める
        const participatingScores = tempPlayers.map(p => p.score);
        const participatingMaxScore = Math.max(...participatingScores);

        const isHighPressure = ['s-kyu'].includes(raceGrade) || (p.score === participatingMaxScore); 
        if (isHighPressure && p.recent.startsWith('1')) { 
            C_TOTAL *= 0.96; 
            logMessage(`[C_mental] 選手ID ${p.id} はプレッシャー減点適用 (${raceGrade})。`); 
        } 
        
        // 4. C_recovery (位置取り回復力) 
        if (p.style === '両' || p.style === '追') { 
            const scoreDiffRatio = (p.score - scoreMin) / scoreRange; 
            if (scoreDiffRatio > 0.6) { 
                C_TOTAL *= 1.04 + (scoreDiffRatio - 0.6) * 0.1; 
                logMessage(`[C_recovery] 選手ID ${p.id} は実力回復力で増点 (${scoreDiffRatio.toFixed(2)})。`); 
            } 
        } 
        
        // 最終的なC係数をスコアに乗算 
        p.final_score = p.final_score * C_TOTAL; 
    }); 

    // 5. C_target (ターゲット・包囲網) 
    const targetPlayer = tempPlayers.find(p => p.score === scoreMax); 
    if (targetPlayer) { 
        let rivalAutos = 0; 
        tempPlayers.forEach(p => { // tempPlayersは欠場選手を除外済み
            if (p.id !== targetPlayer.id && (p.style === '自' || p.style === '両')) { 
                rivalAutos++; 
            } 
        }); 
        if (rivalAutos >= 2) { 
            targetPlayer.final_score *= 0.95; 
            logMessage(`[C_target] ターゲット選手ID ${targetPlayer.id} は包囲網リスクで減点。`); 
        } 
    } 

    // 6. C_split (ライン不均衡リスク) 
    lines.forEach(line => { 
        const p1 = tempPlayers.find(p => p.id === line[0]); 
        const p2 = tempPlayers.find(p => p.id === line[1]); 
        if (p1 && p2) { 
            const scoreDiff = p1.score - p2.score; 
            const relativeDiff = scoreDiff / scoreRange; 
            if (relativeDiff >= 0.30) { 
                const penalty = 1.0 - (relativeDiff - 0.30) * 0.15; 
                p2.final_score *= penalty; 
                logMessage(`[C_split] ライン ${line.join('-')} は不均衡リスク(${relativeDiff.toFixed(2)})で番手(${p2.id})に減点。`); 
            } 
        } 
    }); 

    // 7. C_pace (序盤速度・燃焼リスク) 
    const leaderPlayer = tempPlayers.find(p => p.style === '自' || p.style === '両'); 
    if (leaderPlayer) { 
        const rivalsCount = lines.length - 1; // ライン数 - 1がライバルの数
        const baseScore = leaderPlayer.score; 
        if (baseScore >= 105.0 && rivalsCount >= 2) { 
            leaderPlayer.final_score *= 0.96; 
            logMessage(`[C_pace] 逃げ選手ID ${leaderPlayer.id} はライバルが多く燃焼リスクを緩和。`); 
        } 
    } 

    // 8. C_timing (仕掛け位置補正) 
    tempPlayers.forEach(p => { 
        if (p.style === '両') { 
            const line = lines.find(l => l.includes(p.id)); 
            // p.idがラインの先頭ではない場合
            if (line && line.indexOf(p.id) >= 1) { 
                p.final_score *= 0.97; 
                logMessage(`[C_timing] 選手ID ${p.id} は捲りにもかかわらず不利な位置で減点。`); 
            } 
        } 
    }); 

    // 9. C_guard (番手防衛能力係数) 
    lines.forEach(line => { 
        const p2 = tempPlayers.find(p => p.id === line[1]); 
        if (p2) { 
            const lowScoreThreshold = scoreMin + scoreRange * 0.4; 
            let baseRisk = 1.0; 
            if (p2.score < lowScoreThreshold) { 
                baseRisk = 0.95; 
            } 
            // 欠場選手を除いたリストでアタッカー数をカウント
            const attackers = tempPlayers.filter(p => p.id !== p2.id && (p.style === '自' || p.style === '両')).length; 
            if (attackers >= 2) { 
                baseRisk *= 0.95; 
            } 
            p2.final_score *= baseRisk; 
            logMessage(`[C_guard] 番手選手ID ${p2.id} に防衛リスク (${(1.0-baseRisk).toFixed(2)}) を適用。`); 
        } 
    }); 

    // 10. C_suicide (自滅消耗ペナルティ：Weight印集中リスク) 
    logMessage("[C_suicide] V7.1 自滅消耗ペナルティの計算を開始...");

    const lineEvaluations = {};
    
    const playerIdToLineIndex = {};
    lines.forEach((line, index) => {
        line.forEach(id => {
            playerIdToLineIndex[id] = index;
        });
    });

    lines.forEach((line, index) => {
        let lineLength = line.length;
        let totalWeightScore = 0;
        let hasSelfStarter = false;

        line.forEach(id => {
            const player = tempPlayers.find(p => p.id === id); // tempPlayersは欠場除外済み
            if (player) {
                // Weight印のスコア化をケンさんの提案ロジックに変更 (◎, 〇, △ = 1点)
                if (player.wmark === '◎') totalWeightScore += 1;
                else if (player.wmark === '〇') totalWeightScore += 1;
                else if (player.wmark === '△') totalWeightScore += 1;

                if (player.style === '自' || player.style === '両') {
                    hasSelfStarter = true;
                }
            }
        });

        lineEvaluations[index] = {
            lineLength: lineLength,
            totalWeightScore: totalWeightScore,
            hasSelfStarter: hasSelfStarter,
            lineMembers: line 
        };
    });

    const SUICIDE_PENALTY = 0.90; 
    const BOOTY_BONUS = 1.05;      
    let isSuicideRiskDetected = false;
    let suicideRiskLineMembers = new Set();
    
    Object.keys(lineEvaluations).forEach(lineIndex => {
        const eval = lineEvaluations[lineIndex];
        
        if (eval.lineLength >= 3 && eval.totalWeightScore === 3 && eval.hasSelfStarter) { 
            logMessage(`[C_suicide] 🔴 リスク極大ライン検出！ (ライン${eval.lineMembers.join('-')}、評価点: ${eval.totalWeightScore}点 - ◎〇△混在)`);
            isSuicideRiskDetected = true;
            eval.lineMembers.forEach(id => suicideRiskLineMembers.add(id));
        }
    });

    if (isSuicideRiskDetected) {
        tempPlayers.forEach(p => { // tempPlayersは欠場除外済み
            if (suicideRiskLineMembers.has(p.id)) {
                p.final_score *= SUICIDE_PENALTY;
                logMessage(`[C_suicide] 選手ID ${p.id} に消耗ペナルティ (${SUICIDE_PENALTY.toFixed(2)}) 適用。`);
            } else {
                const lineIndex = playerIdToLineIndex[p.id];
                if (lineIndex !== undefined && lineEvaluations[lineIndex].lineLength >= 2) {
                     p.final_score *= BOOTY_BONUS;
                     logMessage(`[C_suicide] 選手ID ${p.id} に漁夫の利ブースト (${BOOTY_BONUS.toFixed(2)}) 適用。`);
                } else if (lineIndex === undefined || lineEvaluations[lineIndex].lineLength === 1) {
                    p.final_score *= 1.02;
                    logMessage(`[C_suicide] 選手ID ${p.id} (単騎) に微量ブースト (1.02) 適用。`);
                }
            }
        });
    } else {
        logMessage("[C_suicide] 自滅リスク極大ラインは検出されませんでした。");
    }

    logMessage("[KOUTENREI] C係数計算が完了しました。"); 
    return tempPlayers;
} 

// runScenarioSimulation 関数 (💡 修正: seriInfo -> allSeriInfos に変更)
function runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, applyKoutenrei) { 
    const scenarios = ['先行有利', '捲り有利', '差し有利']; 
    const allScenarioResults = []; 
    const integratedScores = {}; 

    basePlayers.forEach(p => integratedScores[p.id] = 0); // basePlayersは欠場選手を含まない

    scenarios.forEach(scenario => { 
        const cDCoeffs = getScenarioCoeffs(scenario); 
        let scenarioPlayers = JSON.parse(JSON.stringify(basePlayers)); 

        scenarioPlayers.forEach(p => { 
            p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_s1 * p.c_b1 * p.c_l * p.c_e; 
        }); 

        // 💡 修正: allSeriInfos を渡す
        scenarioPlayers = applySeriCorrection(scenarioPlayers, allSeriInfos);

        if (applyKoutenrei) { 
            scenarioPlayers = calculate_koutenrei_bias(scenarioPlayers, scenario, bankData); 
        } 

        scenarioPlayers.forEach(p => { 
            const cD = cDCoeffs[p.style] || 1.0; 
            p.final_score = p.final_score * cD; 
            integratedScores[p.id] += p.final_score; 
        }); 

        scenarioPlayers.sort((a, b) => b.final_score - a.final_score); 
        assignFinalGrades(scenarioPlayers); 
        allScenarioResults.push({ scenario, results: scenarioPlayers }); 
    }); 

    return { allScenarioResults, integratedScores };
} 

// calculateTenunIndex 関数 (変更なし)
function calculateTenunIndex(seitenreiScores, koutenreiScores, allScenarioResults, participatingPlayers) { 
    // 欠場選手を除いたスコアオブジェクトを処理
    const seitenreiRanking = Object.keys(seitenreiScores).map(id => ({ id: Number(id), score: seitenreiScores[id] })).sort((a, b) => b.score - a.score); 
    const koutenreiRanking = Object.keys(koutenreiScores).map(id => ({ id: Number(id), score: koutenreiScores[id] })).sort((a, b) => b.score - a.score); 
    
    if (seitenreiRanking.length < 3 || koutenreiRanking.length < 3) { 
        return { tenunIndex: 50, message: 'データ不足のため指数算出不可' }; 
    } 
    
    const seitenTop3 = new Set(seitenreiRanking.slice(0, 3).map(p => p.id)); 
    const koutenTop3 = koutenreiRanking.slice(0, 3).map(p => p.id); 

    let matchCount = 0; 
    koutenTop3.forEach(id => { 
        if (seitenTop3.has(id)) { 
            matchCount++; 
        } 
    }); 

    let tenunIndex; 
    let oracleMessage = ''; 
    
    switch (matchCount) { 
        case 3: 
            tenunIndex = 0; 
            oracleMessage = '☀️ **これは稀に見る大安吉日！晴天令の信頼度、揺るぎなしと見ますぞ！**'; 
            break; 
        case 2: 
            tenunIndex = 33; 
            oracleMessage = '🔮 **なるほど、比較的穏やかな気配ですじゃ。軸は堅いが紐は広めに。**'; 
            break; 
        case 1: 
            tenunIndex = 67; 
            oracleMessage = '⛈️ **天の気配に乱れあり！荒天令の特異点を強く警戒すべきでしょう。**'; 
            break; 
        case 0: 
            tenunIndex = 100; 
            oracleMessage = '💥 **うむむ…これは強い荒天の気が出ておる…何かが起こりますぞ！**'; 
            break; 
        default: 
            tenunIndex = 50; 
            oracleMessage = '算出ロジックエラー'; 
    } 

    // ====================================================================================
    // 💥 【修正箇所】壱耀晴乾ノ象 (いちようせいかんのしょう) 発令ロジックの追加 💥
    // 発令条件: 1. 天運指数が優位リストにある AND 2. 軸選手が◎/〇評価 AND 3. 展開予想で軸選手が上位
    // ====================================================================================

    let superiorMessage = ''; // 発令時に追記するセリフ

    // 1. 軸となる選手と脚質を特定 (優位パターンは「0_差し」のみ)
    if (tenunIndex === 0) {
        // 天運指数 0 の場合、優位性の可能性あり

        // 軸となる「差し」選手を探す (◎または〇評価であること)
        const superiorStyle = '追'; // 差し脚質は V7.3 内部で '追' (追込) に対応
        const axisPlayer = participatingPlayers.find(p => 
            p.style === superiorStyle && (p.wmark === '◎' || p.wmark === '〇')
        );

        if (axisPlayer) {
            // ステップ I: 統計的優位性の確認
            const compositeKey = `${tenunIndex}_差し`; // 優位性リストは "0_差し" を参照
            const isStatisticallySuperior = SUPERIOR_PATTERNS_FINAL_LIST.includes(compositeKey);

            if (isStatisticallySuperior) {
                
                // ステップ II: 展開の整合性の確認 (差し有利シナリオでの上位着順)
                const sashiScenario = allScenarioResults.find(s => s.scenario === '差し有利');
                let isIntegrated = false;

                if (sashiScenario && sashiScenario.results.length >= 2) {
                    const top1 = sashiScenario.results[0].id;
                    const top2 = sashiScenario.results[1].id;
                    
                    if (axisPlayer.id === top1 || axisPlayer.id === top2) {
                        isIntegrated = true; // 軸選手が1着または2着に予想されている
                    }
                }

                if (isIntegrated) {
                    // 発令確定！
                    logMessage(`[ICHIOU] 壱耀晴乾ノ象 発動条件クリア: 選手ID ${axisPlayer.id} (天運${tenunIndex}_差し)`);
                    
                    // 【最終奥義のセリフ】を生成 (選手IDを挿入)
                    superiorMessage = `
                        <p class="fortune-teller-message">
                            <strong>🐢</strong>＜…むむ、これは..."壱耀晴乾ノ象"が出ておる！ 
                            <strong>${axisPlayer.id}</strong> を絡めた三連単がひときわ光って見えるぞい！
                            ただし！回収の極意はオッズにあり。荒れ過ぎる波に乗るでないぞ。ホッホッホ…＞
                        </p>`;
                }
            }
        }
    }

    // 既存のメッセージに、発令メッセージがあれば追記
    oracleMessage += superiorMessage;
    
    // ====================================================================================

    logMessage(`[TENUN] 晴天/荒天 上位3名一致数: ${matchCount}名。天雲指数: ${tenunIndex}`); 
    return { tenunIndex, message: oracleMessage }; // ← 修正後の message を返す
} 

// メイン計算関数 (calculatePrediction) 💡 修正箇所：calculateLineCoeffsの戻り値変更に対応
async function calculatePrediction() { 
    if (Object.keys(BANK_DATA).length === 0) { 
        logMessage("[WAIT] バンクデータの読み込みを待機します..."); 
        await loadBankData(); 
        if (Object.keys(BANK_DATA).length === 0) { 
            logMessage("[FATAL] バンクデータが利用できません。計算を中止します。"); 
            return; 
        } 
    } 

    const raceType = document.getElementById('race-type').value; 
    const settings = COEFFICIENT_SETTINGS[raceType]; 
    const bankName = document.getElementById('bank-name').value; 
    const bankData = BANK_DATA[bankName]; 
    
    if (!bankData) { 
        logMessage(`[ERROR] バンク名 "${bankName}" のデータが見つかりません。計算を中止します。`); 
        return; 
    } 

    const modeSelector = document.getElementById('mode-selector'); 
    const koutenreiModeSelected = modeSelector ? modeSelector.value === 'koutenrei' : false; 
    
    let players = getPlayerData(); // 7名分のデータ（is_scratchフラグ付き）を取得
    logMessage(`[CALC START] ${raceType} / バンク: ${bankName} で計算開始。モード: ${koutenreiModeSelected ? '荒天令' : '晴天令'}`); 

    // --- I. ライン解析と C_L (ライン・連係係数) の計算 (欠場選手除外と係数計算を同時に行う) --- 
    // 💡 修正: allSeriInfosを受け取るように変更
    const { players: participatingPlayers, allSeriInfos, finalOrderedPlayerIds } = calculateLineCoeffs(players, settings); 

    // 欠場により選手がいない場合は計算を終了
    if (participatingPlayers.length === 0) {
        alert("出走選手がいないため、計算を中止しました。");
        return;
    }

    // --- II. 選手固有係数 C_W, C_R, C_S1, C_B1 & C_E の計算 (基礎係数) --- 
    let basePlayers = JSON.parse(JSON.stringify(participatingPlayers)); // 欠場選手が除外されたリストを使用
    
    basePlayers.forEach(p => { 
        p.c_score_adj = 1.0 + (p.score / 100 - 1) * settings.R_BIAS; 
        
        const recentScores = p.recent.split('').map(Number); 
        const avgRank = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 4.0; 
        p.c_recent = (1.0 + (4 - avgRank) * 0.05) * settings.RECENT_WEIGHT; 
        
        if (p.wmark === '◎') p.c_wmark = 1.04; 
        else if (p.wmark === '〇') p.c_wmark = 1.02; 
        else if (p.wmark === '✕') p.c_wmark = 1.015; 
        else if (p.wmark === '△') p.c_wmark = 1.01; 
        else p.c_wmark = 1.0; 
        
        p.c_s1 = p.is_s1 ? 1.005 : 1.0; 
        p.c_b1 = p.is_b1 ? 1.015 : 1.0; 
        
        let c_e = 1.0; 
        let biasKey = ''; 
        if (p.style === '自') biasKey = '先行'; 
        else if (p.style === '両') biasKey = '捲り'; 
        else if (p.style === '追') biasKey = '差し'; 
        
        const keirinBias = bankData.keirin_bias[biasKey] || 1.0; 
        c_e *= keirinBias; 
        p.c_e = c_e; 
    }); 

    // --- III. シミュレーション実行 (晴天令と荒天令の同時実行) --- 
    // basePlayersはすでに欠場選手を除外済み
    // 💡 修正: allSeriInfos を渡す
    const seitenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, false); 
    logMessage("[CALC] 晴天令 (安定) シミュレーションが完了しました。"); 
    // 💡 修正: allSeriInfos を渡す
    const koutenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, true); 
    logMessage("[CALC] 荒天令 (波乱) シミュレーションが完了しました。"); 

    // --- IV. 最終結果の統合と表示 --- 
    const detailedScenarioResults = koutenreiModeSelected ? koutenreiResults.allScenarioResults : seitenreiResults.allScenarioResults; 

    // 💡 修正: allSeriInfos を渡す
    displayResults( 
        detailedScenarioResults, 
        seitenreiResults.integratedScores, 
        koutenreiResults.integratedScores, 
        bankName,
        allSeriInfos, // 💡 修正: allSeriInfos を渡す
        finalOrderedPlayerIds, 
        seitenreiResults.allScenarioResults, 
        participatingPlayers 
    ); 
    
    const resultsContainer = document.getElementById('results-container'); 
    if (resultsContainer) { 
        resultsContainer.classList.add('visible'); 
    } 
    
    logMessage('[CALC END] 予想計算が完了し、結果が表示されました。');
} 

// ========== 【V7.3 修正】表示関数: displayResults (複数競り表示と文章修正) ==========

/**
 * 強弱グラデーションカラーのCSSコードを生成する (RGB: 青(52, 152, 219) -> 赤(231, 76, 60))
 * @param {number} score - 選手の統合スコア
 * @param {number} minScore - 統合スコアの最小値
 * @param {number} maxScore - 統合スコアの最大値
 * @returns {string} - RGBカラー文字列 (例: 'rgb(231, 76, 60)')
 */
function getStrengthColor(score, minScore, maxScore) {
    if (maxScore === minScore) return 'rgb(142, 142, 142)'; // スコアが同じ場合はグレー

    // 0 から 100 のパーセンテージを計算 (強ければ100、弱ければ0)
    const normalizedScore = (score - minScore) / (maxScore - minScore);
    
    const rStart = 52;   // 青のR (最弱)
    const gStart = 152;  // 青のG
    const bStart = 219;  // 青のB
    
    const rEnd = 231;    // 赤のR (最強)
    const gEnd = 76;     // 赤のG
    const bEnd = 60;     // 赤のB

    const r = Math.round(rStart + (rEnd - rStart) * normalizedScore);
    const g = Math.round(gStart + (gEnd - gStart) * normalizedScore);
    const b = Math.round(bStart + (bEnd - bStart) * normalizedScore);
    
    // スコアが強いほど赤に近くなる (0 -> 青, 1 -> 赤)
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 選手番号の文字色を決定する（背景の明るさに基づいて自動調整）
 * @param {string} rgbColor - 背景色 (例: 'rgb(231, 76, 60)')
 * @returns {string} - 文字色 ('#fff' または '#333')
 */
function getTextColor(rgbColor) {
    const match = rgbColor.match(/\d+/g);
    if (!match || match.length < 3) return '#fff'; // デフォルトは白

    const r = parseInt(match[0]);
    const g = parseInt(match[1]);
    const b = parseInt(match[2]);

    // 輝度 (Luminance) の計算: ITU-R BT.709
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // 閾値: 0.5 が一般的
    return luminance > 0.5 ? '#333' : '#fff';
}


// 💡 修正: seriInfo -> allSeriInfos に変更
function displayResults(detailedScenarioResults, seitenreiIntegratedScores, koutenreiIntegratedScores, bankName, allSeriInfos, finalOrderedPlayerIds, allScenarioResults, participatingPlayers) { 
    displayBankTendency(); 

    // ---------------------------------------------------------- 
    // ★ V7.3: ライン強度表示のための統合スコア (晴天令) の準備 ★ 
    // ---------------------------------------------------------- 
    // スコアオブジェクトは欠場選手を含まないため、そのまま使用可能
    const finalScores = Object.keys(seitenreiIntegratedScores).map(id => ({ 
        id: Number(id), 
        score: seitenreiIntegratedScores[id] / detailedScenarioResults.length 
    }));
    
    const allScores = finalScores.map(p => p.score);
    const maxScore = allScores.length > 0 ? Math.max(...allScores) : 0; 
    const minScore = allScores.length > 0 ? Math.min(...allScores) : 0; 
    
    const playerIdToScore = {};
    finalScores.forEach(p => {
        playerIdToScore[p.id] = p.score;
    });

    // ---------------------------------------------------------- 
    // ★ V7.3: ライン強度 (強弱グラデーション) の視覚化 ★ 
    // ---------------------------------------------------------- 
    const lineDisplay = document.getElementById('line-display'); 
    let displayHtml = ''; 

    // 競り発生中の選手IDのセットを事前に作成
    const seriPlayers = new Set();
    allSeriInfos.forEach(info => {
        seriPlayers.add(info.follower);
        seriPlayers.add(info.contender);
    });

    // 💡 修正箇所: finalOrderedPlayerIds (欠場選手を除いた並び順) に従って表示を生成
    finalOrderedPlayerIds.forEach((id) => { 
        const score = playerIdToScore[id]; 
        
        if (score === undefined) {
             logMessage(`[ERROR] 表示順序ID ${id} のスコアが見つかりません。スキップします。`);
             return; 
        }

        const rgbColor = getStrengthColor(score, minScore, maxScore);
        const textColor = getTextColor(rgbColor);
        
        let style = `background-color: ${rgbColor}; color: ${textColor};`;
        
        let playerHtml = `<span class="line-box strength-color" style="${style}">${id}</span>`;
        
        // 競る選手(イン側、アウト側)は()で囲む
        if (seriPlayers.has(id)) { // 💡 修正: 全ての競り参加者に()を適用
            playerHtml = `(${playerHtml})`;
        }
        
        displayHtml += playerHtml;
    }); 
    
    if (lineDisplay) { 
        lineDisplay.innerHTML = displayHtml; 
    } 
    logMessage(`[COLOR] ライン表示を強弱グラデーションカラーに更新しました。 Max: ${maxScore.toFixed(2)}, Min: ${minScore.toFixed(2)}`);

    // ---------------------------------------------------------- 
    // ★ 競りサマリーの表示 (💡 修正: 複数の競りを自然な文章で表示) ★ 
    // ----------------------------------------------------------
    let seriSummaryHtml = '';
    if (allSeriInfos.length > 0) {
        seriSummaryHtml += `
            <div style="padding: 10px; margin-bottom: 15px; border: 2px solid #c07777; background-color: #fcf0f0; border-radius: 6px;">
            <h4>⚠️ 競り発生！ (並び: ${document.getElementById('line-input').value})</h4>
        `;
        
        allSeriInfos.forEach((info, index) => {
            const followerId = info.follower;
            const contenderId = info.contender;
            const winnerId = info.winner;
            
            let prefix = '';
            if (index === 0) {
                prefix = '最初の競りは、';
            } else {
                prefix = '<strong>さらに、</strong>'; // 💡 接続詞「さらに」を適用
            }
            
            // 競り情報と予測結果を文章で表示
            seriSummaryHtml += `
                <p>
                    ${prefix}選手<strong>${followerId}</strong> (イン) vs 選手<strong>${contenderId}</strong> (アウト) です。
                    予測勝者は **選手${winnerId}** です。
                </p>
            `;
        });
        
        // 注意書き
        seriSummaryHtml += `
            <p style="font-size: 0.9em; color: #c07777;">
                ※ アウト側（競り敗者）の選手、および競り勝者（イン側）の選手には、**全て**の競り並びに対して体力消耗による減点補正が適用されています。
            </p>
            </div>
        `;
    }

    // ---------------------------------------------------------- 
    // ★ 天雲指数 (占い師メッセージ) の計算と表示 (変更なし) ★ 
    // ---------------------------------------------------------- 
    const tenunIndexData = calculateTenunIndex(seitenreiIntegratedScores, koutenreiIntegratedScores, allScenarioResults, participatingPlayers); 
    const tenunIndex = tenunIndexData.tenunIndex; 
    const oracleMessage = tenunIndexData.message; 

    let messageClass = ''; 
    if (tenunIndex === 0) messageClass = 'tenun-stable'; 
    else if (tenunIndex === 33) messageClass = 'tenun-mild'; 
    else if (tenunIndex === 67) messageClass = 'tenun-alert'; 
    else if (tenunIndex === 100) messageClass = 'tenun-severe'; 

    const tenunHtml = ` 
        <div class="tenun-index-container ${messageClass}"> 
            <h4>⚫ 天雲指数（てんうんしすう）</h4> 
            <p class="fortune-teller-message"> 
                <strong>🔮🐢</strong>＜${oracleMessage}＞ 
            </p> 
        </div> `; 
        
    const tenunOutput = document.getElementById('tenun-index-output'); 
    if (tenunOutput) { 
        tenunOutput.innerHTML = tenunHtml; 
    } 

    // ---------------------------------------------------------- 
    // シナリオ詳細 (変更なし)
    const scenarioOutput = document.getElementById('scenario-output'); 
    if (scenarioOutput) { 
        scenarioOutput.innerHTML = seriSummaryHtml;
        
        scenarioOutput.innerHTML += detailedScenarioResults.map(s => { 
            const wagers = generateScenarioWagers(s.results); 
            return ` 
                <div class="scenario-detail"> 
                    <h4>${s.scenario}シミュレーション</h4> 
                    <p><strong>三連単 (3点):</strong> ${wagers.tritan}</p> 
                    <p><strong>三連複 (2点):</strong> ${wagers.trifuku}</p> 
                    <table> 
                        <tr><th>選手ID</th><th>評価</th><th class="hide-score-rank">スコア</th><th class="hide-score-rank">順位</th></tr> 
                        ${s.results.map((p) => ` 
                            <tr> 
                                <td>${p.id}</td> 
                                <td><strong>${p.grade}${p.strength_mark}</strong></td> 
                                <td class="hide-score-rank">${p.final_score.toFixed(3)}</td> 
                                <td class="hide-score-rank">${p.id === s.results[0].id ? '1位' : ''}</td> 
                            </tr> 
                        `).join('')} 
                    </table> 
                </div> `; 
        }).join(''); 
    } 

    // --- ☀️ 晴天令 (安定推奨) の表示 (変更なし) --- 
    const seitenreiRanking = Object.keys(seitenreiIntegratedScores).map(id => ({ id: Number(id), score: seitenreiIntegratedScores[id] / detailedScenarioResults.length })).sort((a, b) => b.score - a.score); 
    const seitenTop3 = seitenreiRanking.slice(0, 3).map(p => p.id); 
    const seitenTop4 = seitenreiRanking.slice(0, 4).map(p => p.id); 
    
    const seitenTritan = [ 
        `${seitenTop3[0]}-${seitenTop3[1]}-${seitenTop3[2]}`, 
        `${seitenTop3[0]}-${seitenTop3[2]}-${seitenTop3[1]}`, 
        `${seitenTop3[1]}-${seitenTop3[0]}-${seitenTop3[2]}` 
    ].join(', '); 
    
    const triSeiten1 = [...seitenTop4.slice(0, 3)].sort((a, b) => a - b).join('='); 
    
    let triSeiten2; 
    if (seitenTop4.length >= 4) { 
        triSeiten2 = [seitenTop4[0], seitenTop4[1], seitenTop4[3]].sort((a, b) => a - b).join('='); 
    } else { 
        triSeiten2 = 'データ不足'; 
    } 
    
    const seitenTrifuku = [triSeiten1, triSeiten2].join(', '); 
    
    const seitenreiOutput = document.getElementById('seitenrei-output'); 
    if (seitenreiOutput) { 
        seitenreiOutput.innerHTML = ` 
            三連単 (3点): <strong>${seitenTritan}</strong><br> 
            三連複 (2点): <strong>${seitenTrifuku}</strong> `; 
    } 

    // --- ⛈️ 荒天令 (高配当狙い) の表示 (変更なし) --- 
    const koutenreiRanking = Object.keys(koutenreiIntegratedScores).map(id => ({ id: Number(id), score: koutenreiIntegratedScores[id] / detailedScenarioResults.length, rank: 0 
    })).sort((a, b) => b.score - a.score); 
    
    koutenreiRanking.forEach((p, index) => p.rank = index + 1); 

    const koutenTop3 = koutenreiRanking.slice(0, 3).map(p => p.id); 
    const koutenTop4 = koutenreiRanking.slice(0, 4).map(p => p.id); 
    
    const koutenLeader = koutenTop4.length >= 4 ? koutenTop4[3] : null; 
    let koutenTrifuku = []; 

    if (koutenLeader) { 
        koutenTrifuku.push([koutenLeader, koutenTop3[0], koutenTop3[1]].sort((a, b) => a - b).join('=')); 
        koutenTrifuku.push([koutenLeader, koutenTop3[0], koutenTop3[2]].sort((a, b) => a - b).join('=')); 
        koutenTrifuku.push([koutenLeader, koutenTop3[1], koutenTop3[2]].sort((a, b) => a - b).join('=')); 
    } 

    const middleWaveRiders = koutenreiRanking.filter(p => p.rank === 5 || p.rank === 6).map(p => p.id); 
    
    if (middleWaveRiders.length > 0) { 
        const mainWaveRider = middleWaveRiders[0]; 

        const axis1 = koutenTop3[0]; 
        const axis2 = koutenTop3.length >= 2 ? koutenTop3[1] : null; 
        const firmHimo = koutenLeader; 

            if (axis1 && firmHimo && mainWaveRider) { 
            if (koutenTrifuku.length < 6) { 
                koutenTrifuku.push([mainWaveRider, axis1, firmHimo].sort((a, b) => a - b).join('=')); 
            } 
            if (axis2 && koutenTrifuku.length < 6) { 
                koutenTrifuku.push([mainWaveRider, axis2, firmHimo].sort((a, b) => a - b).join('=')); 
            } 
        } 
    } 

    const finalKoutenTrifuku = koutenTrifuku.slice(0, 6).join(', '); 
    
    const koutenreiOutput = document.getElementById('koutenrei-output'); 
    if (koutenreiOutput) { 
        koutenreiOutput.innerHTML = ` 
            ⚫ 特異点 : **${koutenLeader ? koutenLeader : 'N/A'}**<br> 
            三連複 (${koutenTrifuku.slice(0, 6).length}点): <strong>${finalKoutenTrifuku}</strong> `; 
    }
}
