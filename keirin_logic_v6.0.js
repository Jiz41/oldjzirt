// 真自在律 実質Ver7.3 - 日本語コメント & ログ機密保持強化版
// 競りライン追加版
// 【V7.3 最終修正】消耗ペナルティ適用拡大 ＆ 複数競り表示修正

// ------------------------------------------------------------------------------------
// 🗃️ 係数設定オブジェクトの分離 (COEFFICIENT SETTINGS)
// ------------------------------------------------------------------------------------
const COEFFICIENT_SETTINGS = {
    // R_BIAS: 得点傾斜補正 / RECENT_WEIGHT: 3走着順の影響度 / COOP_WEIGHT: ライン結束力
    's-kyu': { R_BIAS: 1.15, RECENT_WEIGHT: 0.90, COOP_WEIGHT: 1.20, IS_GIRLS: false },
    'a-kyu': { R_BIAS: 1.00, RECENT_WEIGHT: 1.00, COOP_WEIGHT: 1.00, IS_GIRLS: false },
    'a-chal': { R_BIAS: 0.90, RECENT_WEIGHT: 1.20, COOP_WEIGHT: 0.80, IS_GIRLS: false },
    'girls': { R_BIAS: 1.00, RECENT_WEIGHT: 1.10, COOP_WEIGHT: 1.00, IS_GIRLS: true },
}; 

const C_MARK_VALUES = { // ガールズ競輪におけるエースマーク選手（番手）へのライン係数
    HIGH: 1.12, 
    MEDIUM: 1.08, 
    LOW: 1.03
}; 

// ========== 競り専用係数 (SERI-SPECIFIC COEFFICIENTS) ==========
const SERI_STYLE_BONUS = { // 脚質別競り係数 C_style (追込重視: 競り力の基礎値)
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
// 💥 壱耀晴乾ノ象 (いちようせいかんのしょう) 判定ロジック (事前計算)
// ====================================================================================

// 確定した優位性の閾値 (中立的中率 2.06% 以上)
const SUPERIORITY_THRESHOLD_RATE = 0.0206;

// 複合集計データ（天運指数 x 脚質ごとの三連単3点買い的中率）
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


// ロギング関数
function logMessage(message) { 
    const logArea = document.getElementById('debug-log'); 
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false }); 
    if (logArea) { 
        logArea.innerHTML += `[${timestamp}] ${message}<br>`; 
        logArea.scrollTop = logArea.scrollHeight; 
    } 
} 

// getPlayerData 関数 (選手データのUIからの読み込み)
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
            // 競り係数 C_seri の初期計算 (競り勝敗予測の基礎)
            seri_coef: score * (SERI_STYLE_BONUS[style] || 1.00) * (wmark === '◎' ? 1.04 : 1.0)
        }); 
    }); 
    return players;
} 

// loadBankData 関数 (バンクデータの非同期読み込み)
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

// displayBankTendency 関数 (バンク展開傾向の表示)
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

// ページロード時にデータ読み込みを実行
(async function() { 
    await loadBankData();
})(); 


// ========== ライン入力解析 (parseLineInput) - 競り対応強化版 ==========
/**
 * ライン入力文字列 (例: 12(3)4(5)6) を解析し、ライン構成と競り情報を抽出する。
 * @returns {object} { lines, allSeriInfos, orderedPlayerIds, displayLineSegments }
 * lines: スコア計算用のライン配列 (競り勝者と競り敗者単騎を含む)
 * allSeriInfos: 全ての競り情報 (勝敗予測含む)
 * orderedPlayerIds: 選手表示順序 (競り選手は登場順)
 * displayLineSegments: 競りグラデーション表示用の構造化データ
 */
function parseLineInput(lineInput, allPlayers) {
    logMessage(`[PARSE] ライン入力解析開始: ${lineInput}`);
    const processedLineInput = lineInput.replace(/\s/g, '');
    const segments = processedLineInput.split(',');
    
    const lines = []; 
    let orderedPlayerIds = []; 
    const allSeriInfos = []; 
    const displayLineSegments = [];
    const allParsedIds = new Set();
    
    const seriPattern = /(\d)\((\d)\)/; 

    segments.forEach(seg => {
        let currentLine = []; 
        let segOrderedIds = [];
        let remainingSeg = seg; 
        
        while (remainingSeg.length > 0) {
            
            let seriMatch = remainingSeg.match(seriPattern);

            if (seriMatch) {
                const seriStart = seriMatch.index;
                const seriEnd = seriStart + seriMatch[0].length;
                
                // 1. 競り並びの前の数字列を処理
                if (seriStart > 0) {
                    const numericalPart = remainingSeg.substring(0, seriStart);
                    numericalPart.split('').map(Number).filter(id => id > 0).forEach(id => {
                        if (!allParsedIds.has(id)) {
                            segOrderedIds.push(id);
                            allParsedIds.add(id);
                        }
                        displayLineSegments.push({ type: 'single', id: id });
                        currentLine.push(id);
                    });
                }
                
                // 2. 競り並びを処理
                const follower = parseInt(seriMatch[1]); // イン側 (競りかけられる側)
                const contender = parseInt(seriMatch[2]); // アウト側 (競りかける側)
                
                logMessage(`[PARSE] 競り検出: 選手${follower} (イン) vs 選手${contender} (アウト)`);
                
                // 競り勝敗予測の基礎となる係数 (C_seri) を取得
                const followerCoef = allPlayers.find(p => p.id === follower)?.seri_coef || 0;
                const contenderCoef = allPlayers.find(p => p.id === contender)?.seri_coef || 0;

                let winnerId;
                let loserId;

                // 💡 競り勝敗判定ロジック: C_seri 係数で決定
                if (followerCoef >= contenderCoef) {
                    winnerId = follower;
                    loserId = contender;
                } else {
                    winnerId = contender;
                    loserId = follower;
                }
                
                allSeriInfos.push({ // 全ての競り情報を追加
                    exists: true, follower, contender, winner: winnerId, loser: loserId 
                });
                logMessage(`[PARSE] 競り勝者予測: 選手${winnerId} (C_seriに基づき予測)`);
                
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
                
                // 競りセグメントを表示リストに追加
                displayLineSegments.push({ type: 'seri', follower: follower, contender: contender });


                // 3. 競り並びの文字列のみを削除し、次のループへ
                remainingSeg = remainingSeg.substring(seriEnd);
                
            } else {
                // 競り並びがない場合、残りの文字列すべてを数字列として処理
                remainingSeg.split('').map(Number).filter(id => id > 0).forEach(id => {
                    if (!allParsedIds.has(id)) {
                        segOrderedIds.push(id);
                        allParsedIds.add(id);
                    }
                    displayLineSegments.push({ type: 'single', id: id });
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

    return { lines, allSeriInfos, orderedPlayerIds: uniqueOrderedPlayerIds, displayLineSegments };
}
// ====================================================================================


// ========== ライン強度計算 (calculateLineCoeffs) - C_L (ライン結束力係数)の計算 ==========
/**
 * ライン強度係数 C_L の計算を行う。同時に、欠場選手の除外とラインの再構築を行う。
 */
function calculateLineCoeffs(players, settings) { 
    
    // ----------------------------------------------------
    // 1. 欠場選手除外ロジック
    // ----------------------------------------------------
    const participatingPlayers = players.filter(p => !p.is_scratch);
    logMessage(`[SCRATCH] 欠場選手を除外しました。出走選手数: ${participatingPlayers.length}`);

    if (participatingPlayers.length === 0) {
        logMessage("[ERROR] 出走選手がゼロのため、ライン解析をスキップします。");
        return { players: [], allSeriInfos: [], finalOrderedPlayerIds: [], displayLineSegments: [] }; 
    }

    // ----------------------------------------------------
    // 2. ライン解析 (競り処理、単騎補完、表示順序決定)
    // ----------------------------------------------------
    const lineInput = document.getElementById('line-input').value; 
    const { 
        lines: initialLines, 
        allSeriInfos: parsedAllSeriInfos, 
        orderedPlayerIds: initialOrderedPlayerIds, 
        displayLineSegments: parsedDisplayLineSegments 
    } = parseLineInput(lineInput, participatingPlayers); 
    
    let lines = [...initialLines]; // スコア計算に使用するライン（競り勝者と単騎敗者）
    let finalOrderedPlayerIds = [...initialOrderedPlayerIds]; // 表示順序
    let displayLineSegments = [...parsedDisplayLineSegments]; // グラデーション表示セグメント

    // 🚨 欠落選手強制補完ロジック (ライン入力されなかった出走選手を単騎として補完)
    const playerIdsSet = new Set(initialOrderedPlayerIds);
    const allRidersInLines = new Set();
    lines.forEach(line => line.forEach(id => allRidersInLines.add(id)));

    participatingPlayers.forEach(p => {
        if (!playerIdsSet.has(p.id)) {
            // 欠落選手を最終表示順序に追加
            finalOrderedPlayerIds.push(p.id); 
            playerIdsSet.add(p.id); 
            // 表示セグメントにも単騎として追加
            displayLineSegments.push({ type: 'single', id: p.id }); 
        }
        if (!allRidersInLines.has(p.id)) {
             // スコア計算用ラインリストにも単騎ラインとして追加
             lines.push([p.id]); 
        }
    });
    logMessage(`[ORDER] 最終表示順序に欠落選手を補完しました。`);


    // ----------------------------------------------------
    // 3. C_L (ライン結束力係数) 計算と適用
    // ----------------------------------------------------
    
    // C_L係数計算 (ライン結束力係数) - ロジックは変更なし
    if (settings.IS_GIRLS) { 
        logMessage(`[C_L] ガールズ競輪モード: エースマーク係数 $C_{mark}$ を評価。`); 
        // ... C_L係数計算ロジック（係数値非公開のため詳細は省略）
        
        // participatingPlayersに対して係数を適用（C_L の値はログに出力しない）
        participatingPlayers.forEach(p => { 
            // p.c_l が更新されるが、その具体的な値はログに出力しない
            if (p.c_l !== 1.0) {
                 logMessage(`[C_L] 選手ID ${p.id} にライン結束力係数 $C_{L}$ が適用されました。`);
            }
        }); 
    } else { 
        logMessage(`[C_L] 一般競輪モード: ライン結束力係数 $C_{coop}$ を評価。`); 
        
        // participatingPlayersに対して係数を適用（C_L の値はログに出力しない）
        participatingPlayers.forEach(p => { 
            // p.c_l が更新されるが、その具体的な値はログに出力しない
        }); 
        
        lines.forEach(line => { 
            if (line.length < 2) return;
            // 番手 p2 や 3番手以降 pN に C_L が適用される
            for (let i = 1; i < line.length; i++) {
                const pId = line[i];
                logMessage(`[C_L] 選手ID ${pId} にライン結束力係数 $C_{L}$ が適用されました。`);
            }
        }); 
    } 

    // 欠場選手を除外したparticipatingPlayersと、全ての競り情報、表示セグメントを返す
    return { players: participatingPlayers, allSeriInfos: parsedAllSeriInfos, finalOrderedPlayerIds, displayLineSegments };
} 
// =========================================================


// applySeriCorrection 関数 - 競り処理によるスコア補正（競り勝者・敗者の体力消耗ペナルティ適用）
function applySeriCorrection(scoredPlayers, allSeriInfos) {
    if (allSeriInfos.length === 0) {
        logMessage("[SERI] 競り入力がないため、競り補正はスキップします。");
        return scoredPlayers;
    }
    
    logMessage(`[SERI] 競り補正処理（${allSeriInfos.length}件）を開始します。`);

    // 全ての競り並びをループして補正を適用
    allSeriInfos.forEach((seriInfo, index) => {
        
        // 競り勝者 (Winner)
        const winner = scoredPlayers.find(p => p.id === seriInfo.winner);
        if (winner) {
            // 勝者にはボーナスと消耗減点（イン側と同じ値を使用）が final_score に適用されるが、係数値は非公開
            winner.final_score = winner.final_score * (1 + SERI_WIN_BONUS) * (1 - SERI_FATIGUE_PENALTY_IN);
            // 💡 ログ出力: 係数値を隠し、処理が行われたこととスコア変化を通知
            logMessage(`[SERI] 競り勝者 選手${winner.id}: スコア微増/体力減点補正が適用されました。`);
        }

        // 競り敗者 (Loser)
        const loser = scoredPlayers.find(p => p.id === seriInfo.loser);
        if (loser) {
            // 敗者には大幅な消耗減点（アウト側と同じ値を使用）が final_score に適用されるが、係数値は非公開
            loser.final_score *= (1 - SERI_FATIGUE_PENALTY_OUT);
            // 💡 ログ出力: 係数値を隠し、処理が行われたこととスコア変化を通知
            logMessage(`[SERI] 競り敗者 選手${loser.id}: スコア大幅減点補正が適用されました。`);
        }
    });

    // 💡 ログ出力: 競り処理後のスコア変化を数値非公開で通知
    scoredPlayers.forEach(p => {
        logMessage(`[SERI] 選手ID ${p.id}: 競り処理後のスコアは ${p.final_score.toFixed(3)} になりました。`);
    });

    return scoredPlayers;
}


function getScenarioCoeffs(scenario) { // シナリオ別脚質係数 (C_D) の取得
    if (scenario === '先行有利') return { '自': 1.05, '追': 1.02, '両': 1.03 }; 
    if (scenario === '捲り有利') return { '自': 1.00, '追': 1.05, '両': 1.04 }; 
    if (scenario === '差し有利') return { '自': 0.90, '追': 1.08, '両': 1.05 }; 
    return { '自': 1.0, '追': 1.0, '両': 1.0 };
} 

function generateScenarioWagers(results) { // シナリオごとの推奨買い目の生成
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

function assignFinalGrades(scenarioPlayers) { // 最終的な強弱グラデーションの評価値 (1〜10) の割り当て
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
                p.strength_mark = '↑'; // 強い優位性
            } else if (scoreDiff >= (range / 1000) * 0.1) { 
                p.strength_mark = '↗'; // やや優位性
            } else { 
                p.strength_mark = '→'; // 同等
            } 
        } 
    });
} 

// calculate_koutenrei_bias 関数 (荒天令：波乱リスク補正 C係数の計算と適用)
function calculate_koutenrei_bias(players, scenario, bankData) { 
    logMessage("[KOUTENREI] 荒天令リスクバイアス (C係数) の計算を開始..."); 
    
    let tempPlayers = JSON.parse(JSON.stringify(players)); // 晴天令の結果からコピー
    
    const allScores = players.map(p => p.score); 
    const scoreMax = Math.max(...allScores); 
    const scoreMin = Math.min(...allScores); 
    const scoreRange = scoreMax - scoreMin; 

    // ライン情報の再解析 (競り敗者の単騎ライン化など)
    const lineInput = document.getElementById('line-input').value;
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
            // C_TOTAL *= 0.985;  // 係数値は非公開
            p.final_score = p.final_score * 0.985; // スコアに適用
            logMessage(`[C_short] 選手ID ${p.id} に短走路(${bankData.length}m)ブーストを適用。`); 
        } 
        
        // 2. C_risk (接触・落車リスク) 
        const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length; 
        const recentAvg = p.recent.split('').map(Number).reduce((a, b) => a + b, 0) / p.recent.length || 4.0; 
        if (p.score < avgScore - 2.0 && recentAvg >= 4.0) { 
            // C_TOTAL *= 0.97; // 係数値は非公開
            p.final_score = p.final_score * 0.97; // スコアに適用
            logMessage(`[C_risk] 選手ID ${p.id} は不安定指数が高いため減点処理を適用。`); 
        } 
        
        // 3. C_mental (メンタル・疲労減衰) 
        const raceGrade = document.getElementById('race-type').value; 
        const participatingScores = tempPlayers.map(p => p.score);
        const participatingMaxScore = Math.max(...participatingScores);

        const isHighPressure = ['s-kyu'].includes(raceGrade) || (p.score === participatingMaxScore); 
        if (isHighPressure && p.recent.startsWith('1')) { 
            // C_TOTAL *= 0.96; // 係数値は非公開
            p.final_score = p.final_score * 0.96; // スコアに適用
            logMessage(`[C_mental] 選手ID ${p.id} はプレッシャー減点処理を適用 (${raceGrade})。`); 
        } 
        
        // 4. C_recovery (位置取り回復力) 
        if (p.style === '両' || p.style === '追') { 
            const scoreDiffRatio = (p.score - scoreMin) / scoreRange; 
            if (scoreDiffRatio > 0.6) { 
                const recoveryFactor = 1.04 + (scoreDiffRatio - 0.6) * 0.1;
                // C_TOTAL *= recoveryFactor; // 係数値は非公開
                p.final_score = p.final_score * recoveryFactor; // スコアに適用
                logMessage(`[C_recovery] 選手ID ${p.id} は実力回復力で増点処理を適用。`); 
            } 
        } 
        
        // 5. C_target (ターゲット・包囲網) 
        const targetPlayer = tempPlayers.find(p => p.score === scoreMax); 
        if (targetPlayer) { 
            let rivalAutos = 0; 
            tempPlayers.forEach(p => { 
                if (p.id !== targetPlayer.id && (p.style === '自' || p.style === '両')) { 
                    rivalAutos++; 
                } 
            }); 
            if (rivalAutos >= 2) { 
                // targetPlayer.final_score *= 0.95; // 係数値は非公開
                targetPlayer.final_score *= 0.95; // スコアに適用
                logMessage(`[C_target] ターゲット選手ID ${targetPlayer.id} は包囲網リスクで減点処理を適用。`); 
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
                    // p2.final_score *= penalty; // 係数値は非公開
                    p2.final_score *= penalty; // スコアに適用
                    logMessage(`[C_split] ライン ${line.join('-')} は不均衡リスクで番手(${p2.id})に減点処理を適用。`); 
                } 
            } 
        }); 

        // 7. C_pace (序盤速度・燃焼リスク) 
        const leaderPlayer = tempPlayers.find(p => p.style === '自' || p.style === '両'); 
        if (leaderPlayer) { 
            const rivalsCount = lines.length - 1; 
            const baseScore = leaderPlayer.score; 
            if (baseScore >= 105.0 && rivalsCount >= 2) { 
                // leaderPlayer.final_score *= 0.96; // 係数値は非公開
                leaderPlayer.final_score *= 0.96; // スコアに適用
                logMessage(`[C_pace] 逃げ選手ID ${leaderPlayer.id} はライバルが多く燃焼リスクを緩和。`); 
            } 
        } 

        // 8. C_timing (仕掛け位置補正) 
        tempPlayers.forEach(p => { 
            if (p.style === '両') { 
                const line = lines.find(l => l.includes(p.id)); 
                if (line && line.indexOf(p.id) >= 1) { 
                    // p.final_score *= 0.97; // 係数値は非公開
                    p.final_score *= 0.97; // スコアに適用
                    logMessage(`[C_timing] 選手ID ${p.id} は捲りにもかかわらず不利な位置で減点処理を適用。`); 
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
                const attackers = tempPlayers.filter(p => p.id !== p2.id && (p.style === '自' || p.style === '両')).length; 
                if (attackers >= 2) { 
                    baseRisk *= 0.95; 
                } 
                // p2.final_score *= baseRisk; // 係数値は非公開
                p2.final_score *= baseRisk; // スコアに適用
                logMessage(`[C_guard] 番手選手ID ${p2.id} に防衛リスクの処理を適用。`); 
            } 
        }); 
    }); 

    // 10. C_suicide (自滅消耗ペナルティ：Weight印集中リスク) 
    logMessage("[C_suicide] V7.1 自滅消耗ペナルティの計算を開始...");
    // ... ライン評価ロジックは変更なし ...
    const SUICIDE_PENALTY = 0.90; 
    const BOOTY_BONUS = 1.05;      
    let isSuicideRiskDetected = false;
    let suicideRiskLineMembers = new Set();
    
    // ... ライン評価とリスク検出ロジックは変更なし ...
    // 【ライン評価ロジックを再掲 (コメントのみ追加)】
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
            const player = tempPlayers.find(p => p.id === id); 
            if (player) {
                // Weight印のスコア化を適用 (◎, 〇, △ = 1点)
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
    
    // リスク検出
    Object.keys(lineEvaluations).forEach(lineIndex => {
        const eval = lineEvaluations[lineIndex];
        
        if (eval.lineLength >= 3 && eval.totalWeightScore === 3 && eval.hasSelfStarter) { 
            logMessage(`[C_suicide] 🔴 リスク極大ライン検出！ (ライン${eval.lineMembers.join('-')}、Weight評価点: ${eval.totalWeightScore}点)`);
            isSuicideRiskDetected = true;
            eval.lineMembers.forEach(id => suicideRiskLineMembers.add(id));
        }
    });

    if (isSuicideRiskDetected) {
        tempPlayers.forEach(p => { 
            if (suicideRiskLineMembers.has(p.id)) {
                // p.final_score *= SUICIDE_PENALTY; // 係数値は非公開
                p.final_score *= SUICIDE_PENALTY; // スコアに適用
                logMessage(`[C_suicide] 選手ID ${p.id} に消耗ペナルティを適用。`);
            } else {
                const lineIndex = playerIdToLineIndex[p.id];
                if (lineIndex !== undefined && lineEvaluations[lineIndex].lineLength >= 2) {
                     // p.final_score *= BOOTY_BONUS; // 係数値は非公開
                     p.final_score *= BOOTY_BONUS; // スコアに適用
                     logMessage(`[C_suicide] 選手ID ${p.id} に漁夫の利ブーストを適用。`);
                } else if (lineIndex === undefined || lineEvaluations[lineIndex].lineLength === 1) {
                    // p.final_score *= 1.02; // 係数値は非公開
                    p.final_score *= 1.02; // スコアに適用
                    logMessage(`[C_suicide] 選手ID ${p.id} (単騎) に微量ブーストを適用。`);
                }
            }
        });
    } else {
        logMessage("[C_suicide] 自滅リスク極大ラインは検出されませんでした。");
    }

    logMessage("[KOUTENREI] C係数計算が完了しました。"); 
    return tempPlayers;
} 

// runScenarioSimulation 関数 (シナリオ別シミュレーションの実行)
function runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, applyKoutenrei) { 
    const scenarios = ['先行有利', '捲り有利', '差し有利']; 
    const allScenarioResults = []; 
    const integratedScores = {}; 

    basePlayers.forEach(p => integratedScores[p.id] = 0); // basePlayersは欠場選手を含まない

    scenarios.forEach(scenario => { 
        const cDCoeffs = getScenarioCoeffs(scenario); 
        let scenarioPlayers = JSON.parse(JSON.stringify(basePlayers)); 
        const logPrefix = applyKoutenrei ? '[KOUTEN-SCN]' : '[SEITEN-SCN]';

        logMessage(`${logPrefix} シナリオ: ${scenario} の計算を開始。`); 

        // 1. 基礎係数の適用（C_L, C_W, C_R, C_S1, C_B1, C_Eなど）
        scenarioPlayers.forEach(p => { 
            p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_s1 * p.c_b1 * p.c_l * p.c_e; 
            logMessage(`${logPrefix} 選手ID ${p.id}: 基礎係数適用後のスコアは ${p.final_score.toFixed(3)}`);
        }); 

        // 2. 競り補正の適用
        scenarioPlayers = applySeriCorrection(scenarioPlayers, allSeriInfos);

        // 3. 荒天令（C係数）の適用
        if (applyKoutenrei) { 
            scenarioPlayers = calculate_koutenrei_bias(scenarioPlayers, scenario, bankData); 
        } 

        // 4. 脚質係数 C_D の適用 (最後の補正)
        scenarioPlayers.forEach(p => { 
            const cD = cDCoeffs[p.style] || 1.0; 
            // 係数値をログに出力せず、適用された事実のみを記録
            p.final_score = p.final_score * cD; 
            integratedScores[p.id] += p.final_score; 
            logMessage(`${logPrefix} 選手ID ${p.id}: 脚質係数 $C_{D}$ (${scenario}) が適用されました。最終スコア ${p.final_score.toFixed(3)}`);
        }); 

        scenarioPlayers.sort((a, b) => b.final_score - a.final_score); 
        assignFinalGrades(scenarioPlayers); 
        allScenarioResults.push({ scenario, results: scenarioPlayers }); 
    }); 

    return { allScenarioResults, integratedScores };
} 

// calculateTenunIndex 関数 (天雲指数の算出)
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
    
    // 天雲指数の算出ロジック（一致数に基づく）
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

    // 壱耀晴乾ノ象 (いちようせいかんのしょう) 発令ロジック
    let superiorMessage = ''; 

    if (tenunIndex === 0) {
        // ... 発令ロジックは変更なし ...
        const superiorStyle = '追'; 
        const axisPlayer = participatingPlayers.find(p => 
            p.style === superiorStyle && (p.wmark === '◎' || p.wmark === '〇')
        );

        if (axisPlayer) {
            const compositeKey = `${tenunIndex}_差し`; 
            const isStatisticallySuperior = SUPERIOR_PATTERNS_FINAL_LIST.includes(compositeKey);

            if (isStatisticallySuperior) {
                
                const sashiScenario = allScenarioResults.find(s => s.scenario === '差し有利');
                let isIntegrated = false;

                if (sashiScenario && sashiScenario.results.length >= 2) {
                    const top1 = sashiScenario.results[0].id;
                    const top2 = sashiScenario.results[1].id;
                    
                    if (axisPlayer.id === top1 || axisPlayer.id === top2) {
                        isIntegrated = true; 
                    }
                }

                if (isIntegrated) {
                    logMessage(`[ICHIOU] 壱耀晴乾ノ象 発動条件クリア: 選手ID ${axisPlayer.id} (天運${tenunIndex}_差し)`);
                    
                    superiorMessage = window.generateTamakiTenunHTML(tenunIndex, true, axisPlayer.id);;
                }
            }
        }
    }

    // 既存のメッセージに、発令メッセージがあれば追記
    oracleMessage += superiorMessage;
    
    // 💡 ログ出力: 天雲指数の値のみを出力（係数非公開ルールに抵触しない）
    logMessage(`[TENUN] 晴天/荒天 上位3名一致数: ${matchCount}名。天雲指数: ${tenunIndex}`); 
    return { tenunIndex, message: oracleMessage }; // ← 修正後の message を返す
} 

// メイン計算関数 (calculatePrediction)
async function calculatePrediction() { 
    // バンクデータ読み込みチェック
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
    const { players: participatingPlayers, allSeriInfos, finalOrderedPlayerIds, displayLineSegments } = calculateLineCoeffs(players, settings); 

    // 欠場により選手がいない場合は計算を終了
    if (participatingPlayers.length === 0) {
        alert("出走選手がいないため、計算を中止しました。");
        return;
    }

    // --- II. 選手固有係数 C_W, C_R, C_S1, C_B1 & C_E の計算 (基礎係数) --- 
    let basePlayers = JSON.parse(JSON.stringify(participatingPlayers)); // 欠場選手が除外されたリストを使用
    
    basePlayers.forEach(p => { 
        // 基礎係数 C_W, C_R, C_S1, C_B1, C_E の算出
        
        // 1. C_score_adj: 得点傾斜補正 (係数値は非公開)
        p.c_score_adj = 1.0 + (p.score / 100 - 1) * settings.R_BIAS; 
        
        // 2. C_recent: 直近着順係数 (係数値は非公開)
        const recentScores = p.recent.split('').map(Number); 
        const avgRank = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 4.0; 
        p.c_recent = (1.0 + (4 - avgRank) * 0.05) * settings.RECENT_WEIGHT; 
        
        // 3. C_wmark: W印係数 (係数値は非公開)
        if (p.wmark === '◎') p.c_wmark = 1.04; 
        else if (p.wmark === '〇') p.c_wmark = 1.02; 
        else if (p.wmark === '✕') p.c_wmark = 1.015; 
        else if (p.wmark === '△') p.c_wmark = 1.01; 
        else p.c_wmark = 1.0; 
        
        // 4. C_S1, C_B1: S1/B1係数 (係数値は非公開)
        p.c_s1 = p.is_s1 ? 1.005 : 1.0; 
        p.c_b1 = p.is_b1 ? 1.015 : 1.0; 
        
        // 5. C_E: バンク別脚質バイアス (係数値は非公開)
        let biasKey = ''; 
        if (p.style === '自') biasKey = '先行'; 
        else if (p.style === '両') biasKey = '捲り'; 
        else if (p.style === '追') biasKey = '差し'; 
        const keirinBias = bankData.keirin_bias[biasKey] || 1.0; 
        p.c_e = keirinBias; 
        
        logMessage(`[C_BASIC] 選手ID ${p.id}: 基礎係数 ($C_{W}, C_{R}, C_{S1}, C_{B1}, C_{E}$) の算出が完了しました。`);
    }); 

    // --- III. シミュレーション実行 (晴天令と荒天令の同時実行) --- 
    // 💡 修正: allSeriInfos を渡す
    const seitenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, false); 
    logMessage("[CALC] 晴天令 (安定) シミュレーションが完了しました。"); 
    // 💡 修正: allSeriInfos を渡す
    const koutenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, true); 
    logMessage("[CALC] 荒天令 (波乱) シミュレーションが完了しました。"); 

    // --- IV. 最終結果の統合と表示 --- 
    const detailedScenarioResults = koutenreiModeSelected ? koutenreiResults.allScenarioResults : seitenreiResults.allScenarioResults; 

    // 💡 修正: allSeriInfos と displayLineSegments を渡す
    displayResults( 
        detailedScenarioResults, 
        seitenreiResults.integratedScores, 
        koutenreiResults.integratedScores, 
        bankName,
        allSeriInfos, 
        finalOrderedPlayerIds, 
        seitenreiResults.allScenarioResults, 
        participatingPlayers,
        displayLineSegments 
    ); 
    
    const resultsContainer = document.getElementById('results-container'); 
    if (resultsContainer) { 
        resultsContainer.classList.add('visible'); 
    } 
    
    logMessage('[CALC END] 予想計算が完了し、結果が表示されました。');
} 

// ========== 表示関数: displayResults (複数競り表示と文章修正) ==========
// 以下、表示に関する関数は、機能ロジックに影響がないため、元のコードを維持し、ログ出力のみを強化
// ... [getStrengthColor 関数]
function getStrengthColor(score, minScore, maxScore) {
    if (maxScore === minScore) return 'rgb(142, 142, 142)';

    const normalizedScore = (score - minScore) / (maxScore - minScore);
    
    const rStart = 52;   
    const gStart = 152;  
    const bStart = 219;  
    
    const rEnd = 231;    
    const gEnd = 76;     
    const bEnd = 60;     

    const r = Math.round(rStart + (rEnd - rStart) * normalizedScore);
    const g = Math.round(gStart + (gEnd - gStart) * normalizedScore);
    const b = Math.round(bStart + (bEnd - bStart) * normalizedScore);
    
    return `rgb(${r}, ${g}, ${b})`;
}
// ... [getTextColor 関数]
function getTextColor(rgbColor) {
    const match = rgbColor.match(/\d+/g);
    if (!match || match.length < 3) return '#fff';

    const r = parseInt(match[0]);
    const g = parseInt(match[1]);
    const b = parseInt(match[2]);

    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    return luminance > 0.5 ? '#333' : '#fff';
}


function displayResults(detailedScenarioResults, seitenreiIntegratedScores, koutenreiIntegratedScores, bankName, allSeriInfos, finalOrderedPlayerIds, allScenarioResults, participatingPlayers, displayLineSegments) { 
    displayBankTendency(); 

    // ---------------------------------------------------------- 
    // ★ V7.3: ライン強度表示のための統合スコア (晴天令) の準備 ★ 
    // ---------------------------------------------------------- 
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
    // ★ V7.3: ライン強度 (強弱グラデーション) の視覚化 (矢印表示対応) ★ 
    // ---------------------------------------------------------- 
    const lineDisplay = document.getElementById('line-display'); 
    let displayHtml = ''; 

    displayLineSegments.forEach((segment) => {
        if (segment.type === 'single') {
            const id = segment.id;
            const score = playerIdToScore[id]; 
            
            if (score === undefined) return; 

            const rgbColor = getStrengthColor(score, minScore, maxScore);
            const textColor = getTextColor(rgbColor);
            
            let style = `background-color: ${rgbColor}; color: ${textColor};`;
            
            displayHtml += `<span class="line-box strength-color" style="${style}">${id}</span>`;
            
        } else if (segment.type === 'seri') {
            const followerId = segment.follower; 
            const contenderId = segment.contender; 
            
            const scoreF = playerIdToScore[followerId];
            const scoreC = playerIdToScore[contenderId];
            
            if (scoreF === undefined || scoreC === undefined) return; 
            
            const rgbColorF = getStrengthColor(scoreF, minScore, maxScore);
            const textColorF = getTextColor(rgbColorF);

            const rgbColorC = getStrengthColor(scoreC, minScore, maxScore);
            const textColorC = getTextColor(rgbColorC);

            displayHtml += `<span class="seri-segment">(`;
            displayHtml += `<span class="line-box strength-color" style="background-color: ${rgbColorF}; color: ${textColorF};">${followerId}</span>`;
            displayHtml += `<span class="seri-arrow">←</span>`; 
            displayHtml += `<span class="line-box strength-color" style="background-color: ${rgbColorC}; color: ${textColorC};">${contenderId}</span>`;
            displayHtml += `)</span>`;
        }
    });
    
    if (lineDisplay) { 
        lineDisplay.innerHTML = displayHtml; 
    } 
    logMessage(`[COLOR] ライン表示を強弱グラデーションカラーに更新しました。 Max: ${maxScore.toFixed(2)}, Min: ${minScore.toFixed(2)}`);

    // ---------------------------------------------------------- 
    // ★ 競りサマリーの表示 (修正: 複数の競りを自然な文章で表示) ★ 
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
            
            let prefix = (index === 0) ? '最初の競りは、' : '<strong>さらに、</strong>';
            
            seriSummaryHtml += `
                <p>
                    ${prefix}選手<strong>${followerId}</strong> (イン) vs 選手<strong>${contenderId}</strong> (アウト) です。
                    予測勝者は **選手${winnerId}** です。
                </p>
            `;
        });
        
        seriSummaryHtml += `
            <p style="font-size: 0.9em; color: #c07777;">
                ※ アウト側（競り敗者）の選手、および競り勝者（イン側）の選手には、**全て**の競り並びに対して体力消耗による減点補正が適用されています。
            </p>
            </div>
        `;
    }

    // ---------------------------------------------------------- 
    // ★ 天雲指数 (占い師メッセージ) の計算と表示 ★ 
    // ---------------------------------------------------------- 
    const tenunIndexData = calculateTenunIndex(seitenreiIntegratedScores, koutenreiIntegratedScores, allScenarioResults, participatingPlayers); 
    const tenunIndex = tenunIndexData.tenunIndex; 
    const oracleMessage = tenunIndexData.message; 

    let messageClass = ''; 
    if (tenunIndex === 0) messageClass = 'tenun-stable'; 
    else if (tenunIndex === 33) messageClass = 'tenun-mild'; 
    else if (tenunIndex === 67) messageClass = 'tenun-alert'; 
    else if (tenunIndex === 100) messageClass = 'tenun-severe'; 

    const tenunHtml = window.generateTamakiTenunHTML(tenunIndex, false, null); 
        
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
