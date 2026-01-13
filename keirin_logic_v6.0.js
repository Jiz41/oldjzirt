// 真自在律 実質Ver7.4 - 日本語コメント & ログ機密保持強化版,競りライン追加版
// 【V7.3】消耗ペナルティ適用拡大 ＆ 複数競り表示修正
// 【V7.4】壱耀メッセージ追加 ＆ 買い目変更
//
// ------------------------------------------------------------------------------------
// 🗃️ 係数設定// 
// ------------------------------------------------------------------------------------
const COEFFICIENT_SETTINGS = {
    // R_BIAS: 得点傾斜補正 / RECENT_WEIGHT: 3走着順の影響度 / COOP_WEIGHT: ライン結束力
    's-kyu': { R_BIAS: 1.15, RECENT_WEIGHT: 0.90, COOP_WEIGHT: 1.20, IS_GIRLS: false, SUICIDE_LIMIT: 0.97 }, // 0.97に緩和
    'a-kyu': { R_BIAS: 1.00, RECENT_WEIGHT: 1.00, COOP_WEIGHT: 1.00, IS_GIRLS: false, SUICIDE_LIMIT: 0.93 }, // 0.93に緩和
    'a-chal': { R_BIAS: 0.90, RECENT_WEIGHT: 1.20, COOP_WEIGHT: 0.80, IS_GIRLS: false, SUICIDE_LIMIT: 0.90 }, // 現状維持
    'girls': { R_BIAS: 1.00, RECENT_WEIGHT: 1.10, COOP_WEIGHT: 1.00, IS_GIRLS: true, SUICIDE_LIMIT: 1.00 },  // 減点なし
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

//Kukuru
function getKururuAdjustment(playerId, bankData, lineInput) {
    const vElem = document.getElementById('wind-speed');
    const dElem = document.getElementById('wind-direction');
    if (!vElem || !dElem || !bankData) return 1.0;

    const v = parseFloat(vElem.value) || 0;
    const selectedDir = dElem.value; // "南西" などが正しく入る
    
    if (v <= 1.0 || selectedDir === 'none' || bankData.indoor) {
        return 1.0;
    }

    // --- 物理パラメータ算出 ---
    const straightBonus = (bankData.straight || 50) / 50; 
    let kp = v <= 4.0 ? (v - 1.0) * 0.025 : Math.min(0.075 + (v - 4.0) * 0.045, 0.28);
    kp *= straightBonus;

    // --- 位置特定 ---
    let positionShield = 1.0; 
    let posLabel = "単騎";
    if (lineInput) {
        const segments = lineInput.split(/[,、]/);
        for (let i = 0; i < segments.length; i++) {
            const playerIds = segments[i].replace(/[\(\)]/g, "").match(/\d+/g);
            if (playerIds) {
                const pos = playerIds.indexOf(playerId.toString());
                if (pos !== -1) {
                    if (pos === 0) { positionShield = 0.60; posLabel = "先行"; }
                    else if (pos === 1) { positionShield = 0.50; posLabel = "番手"; }
                    else { positionShield = 0.40; posLabel = "3番手以降"; }
                    break;
                }
            }
        }
    }

    // --- 【重要】ベクトル演算：jsonの「H向かい風」等の表記に対応 ---
    const map = bankData.wind_direction_map || {};
    const dirType = map[selectedDir] || "横風成分"; // マップにない方角は横風扱い
    
    let vector = -0.2; 
    // "H追い風" や "追い" が含まれていれば追い風
    if (dirType.includes("追い")) {
        vector = 1.0;
    } 
    // "H向かい風" や "向かい" が含まれていれば向かい風
    else if (dirType.includes("向かい")) {
        vector = -1.0;
    }

    const finalAdj = 1.0 + (vector * kp * (bankData.alpha || 1.0) * positionShield);

    // --- プロセス全出力 ---
    if (typeof logMessage === 'function') {
        logMessage(`[kururu] 選手${playerId}: 方角[${selectedDir}] 属性[${dirType}] 位置[${posLabel}] -> 風補正実行`);
    }

    return finalAdj;
}

// ====================================================================================
// 💥 壱耀晴乾ノ象 (いちようせいかんのしょう) 判定ロジック (事前計算)
// ====================================================================================

// 確定した優位性の閾値 (中立的中率 2.06% 以上)
const SUPERIORITY_THRESHOLD_RATE = 0.0206;

// 1. キーを「33_差し」に書き換える
const RAW_COMPOSITE_STATS = [
    { pattern_key: "33_差し", hit_rate: 0.0309 },
    { pattern_key: "33_逃げ", hit_rate: 0.0206 },
];

function calculateSuperiorityList() {
    const superiorPatterns = [];
    // 2. ターゲットを「33_差し」に書き換える
    const targetPatterns = ["33_差し"];

    for (const data of RAW_COMPOSITE_STATS) {
        const key = data.pattern_key;
        const rate = data.hit_rate;

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
    if (!logArea) return;

    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false }); 
    
    // 1. innerHTMLではなく、より軽量なinsertAdjacentHTMLを使用
    logArea.insertAdjacentHTML('beforeend', `[${timestamp}] ${message}<br>`);
    
    // 2. スクロール処理を「ブラウザが暇な時」に後回しにする (これが重要！)
    requestAnimationFrame(() => {
        logArea.scrollTop = logArea.scrollHeight;
    });
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
        // 階級別の設定値を参照するように変更
    const SUICIDE_PENALTY = COEFFICIENT_SETTINGS.SUICIDE_LIMIT; 
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
function runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, applyKoutenrei, lineInput) { 
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
            // 1. 基礎能力の計算
            p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_s1 * p.c_b1 * p.c_l * p.c_e; 
            
            // 2. 【追加】Kururu 風遮蔽補正を適用
            const kururuAdj = getKururuAdjustment(p.id, bankData, lineInput);
            p.final_score *= kururuAdj;

            // 3. ログ出力（補正後の値を表示）
            logMessage(`${logPrefix} 選手ID ${p.id}: 基礎＋風遮蔽(kururu:${kururuAdj.toFixed(3)})適用後のスコアは ${p.final_score.toFixed(3)}`);
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

    // --- 壱耀晴乾ノ象 (いちようせいかんのしょう) 発令ロジック ---
    let superiorMessage = ''; 

    if (tenunIndex === 33) {
        const superiorStyle = '追'; 
        const axisPlayer = participatingPlayers.find(p => 
            p.style === superiorStyle && (p.wmark === '◎' || p.wmark === '〇')
        );

        if (axisPlayer) {
            const compositeKey = "33_差し"; 
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
                    logMessage(`[ICHIOU] 壱耀晴乾ノ象 発動条件クリア: 選手ID ${axisPlayer.id}`);
                    superiorMessage = window.generateTamakiTenunHTML(tenunIndex, true, axisPlayer.id);
                }
            }
        }
    }

// 💡 修正：基本メッセージを常に生成
const basicHtml = window.generateTamakiTenunHTML(tenunIndex, false, null);

// 💡 修正：基本 + 壱耀（ある場合）を連結
const finalHtml = basicHtml + superiorMessage;

logMessage(`[TENUN] 天雲指数: ${tenunIndex} / 壱耀発動: ${superiorMessage !== ''}`); 
return { tenunIndex, message: finalHtml };
} 

// メイン計算関数 (calculatePrediction) 
// ここから下は元のコードのまま


// メイン計算関数 (calculatePrediction)
async function calculatePrediction() { 
    // 【演出追加】計算の前に「異相因果境界収束中」を表示
    const tenunOutputArea = document.getElementById('tenun-index-output');
    if (tenunOutputArea && typeof window.generateTamakiObservingHTML === 'function') {
        tenunOutputArea.innerHTML = window.generateTamakiObservingHTML();
    }
    // 描画を反映させるための待機（0.1秒）
    await new Promise(resolve => setTimeout(resolve, 100));

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
        // 🌪️ 風補正介入
try {
    // --- 修正：呼び出し直前に再取得とログ確認を行う ---
    const currentLineInput = document.getElementById('line-input').value; 
    console.log("DEBUG: passing lineInput to simulation:", currentLineInput);
    logMessage(`[DEBUG] シミュレーションに渡すラインデータ: ${currentLineInput}`);

    const seitenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, false, currentLineInput);
    const koutenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, true, currentLineInput);
    // ----------------------------------------------


        logMessage(`[C_BASIC] 選手ID ${p.id}: 基礎係数 ($C_{W}, C_{R}, C_{S1}, C_{B1}, C_{E}$) の算出が完了しました。`);
    }); 

    // --- III. シミュレーション実行 (晴天令と荒天令の同時実行) --- 
    // 💡 確実に「現在の」入力値を取得して渡す
    const currentLineInputForCalc = document.getElementById('line-input').value; 
    logMessage(`[DEBUG] シミュレーション実行: ラインデータ "${currentLineInputForCalc}" を投入。`);

    // 引数を currentLineInputForCalc に統一
    const seitenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, false, currentLineInputForCalc); 
    logMessage("[CALC] 晴天令 (安定) シミュレーションが完了しました。"); 

    const koutenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, bankData, true, currentLineInputForCalc); 
    logMessage("[CALC] 荒天令 (波乱) シミュレーションが完了しました。"); 


    // --- IV. 最終結果の統合と表示 --- 
    const detailedScenarioResults = koutenreiModeSelected ? koutenreiResults.allScenarioResults : seitenreiResults.allScenarioResults; 

    // ✅ 1. ここで計算を実行し、変数 finalTenunData に入れる
    const finalTenunData = calculateTenunIndex(
        seitenreiResults.integratedScores, 
        koutenreiResults.integratedScores, 
        seitenreiResults.allScenarioResults, 
        participatingPlayers
    );

    // ✅ 2. displayResults の最後に finalTenunData を追加して渡す
    displayResults( 
        detailedScenarioResults, 
        seitenreiResults.integratedScores, 
        koutenreiResults.integratedScores, 
        bankName,
        allSeriInfos, 
        finalOrderedPlayerIds, 
        seitenreiResults.allScenarioResults, 
        participatingPlayers,
        displayLineSegments,
        finalTenunData 
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


// ✅ 修正版：引数の最後に tenunIndexData を受け取るように変更
function displayResults(detailedScenarioResults, seitenreiIntegratedScores, koutenreiIntegratedScores, bankName, allSeriInfos, finalOrderedPlayerIds, allScenarioResults, participatingPlayers, displayLineSegments, tenunIndexData) { 
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
    // ★ V7.3: ライン強度 (強弱グラデーション) の視覚化 ★ 
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
            displayHtml += `<span class="line-box strength-color" style="background-color: ${rgbColor}; color: ${textColor};">${id}</span>`;
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
            displayHtml += `<span class="seri-segment">(<span class="line-box strength-color" style="background-color: ${rgbColorF}; color: ${textColorF};">${followerId}</span><span class="seri-arrow">←</span><span class="line-box strength-color" style="background-color: ${rgbColorC}; color: ${textColorC};">${contenderId}</span>)</span>`;
        }
    });
    
    if (lineDisplay) { 
        lineDisplay.innerHTML = displayHtml; 
    } 

    // ---------------------------------------------------------- 
    // ★ 競りサマリーの表示 ★ 
    // ----------------------------------------------------------
    let seriSummaryHtml = '';
    if (allSeriInfos.length > 0) {
        seriSummaryHtml += `<div style="padding: 10px; margin-bottom: 15px; border: 2px solid #c07777; background-color: #fcf0f0; border-radius: 6px;"><h4>⚠️ 競り発生！</h4>`;
        allSeriInfos.forEach((info, index) => {
            let prefix = (index === 0) ? '最初の競りは、' : '<strong>さらに、</strong>';
            seriSummaryHtml += `<p>${prefix}選手<strong>${info.follower}</strong> vs 選手<strong>${info.contender}</strong>。予測勝者は **選手${info.winner}** です。</p>`;
        });
        seriSummaryHtml += `<p style="font-size: 0.9em; color: #c07777;">※体力消耗による減点補正が適用されています。</p></div>`;
    }

    // ---------------------------------------------------------- 
    // ★ 天雲指数 (Tamakiメッセージ) の表示 ★ 
    // ---------------------------------------------------------- 
    // ✅ 計算済みの tenunIndexData をそのまま表示。余計な追記（appendIchiyoComment）は行わない。
    const tenunOutput = document.getElementById('tenun-index-output'); 
    if (tenunOutput && tenunIndexData) { 
        tenunOutput.innerHTML = tenunIndexData.message; 
    } 

// ============================
// ☀️ 晴天令 買い目表示
// ============================
const seitenreiRanking = Object.keys(seitenreiIntegratedScores)
  .map(id => ({ id: Number(id), score: seitenreiIntegratedScores[id] }))
  .sort((a, b) => b.score - a.score);

const seitenreiBets = generateSeitenreiBets(seitenreiRanking);
const seitenreiBox = document.getElementById('seitenrei-output');

if (seitenreiBox && seitenreiBets) {
  let html = '<h4>☀️ 晴天令</h4><strong>三連単</strong><ul>';
  seitenreiBets.sanrentan.forEach(b => html += `<li>${formatOrderedBet(b)}</li>`);
  html += '</ul><strong>三連複</strong><ul>';
  seitenreiBets.sanrenpuku.forEach(b => html += `<li>${formatSanrenpuku(b)}</li>`);
  html += '</ul>';
  seitenreiBox.innerHTML = html;
}

// ============================
// ⛈️ 荒天令 買い目表示
// ============================
const koutenreiRanking = Object.keys(koutenreiIntegratedScores)
  .map(id => ({ id: Number(id), score: koutenreiIntegratedScores[id] }))
  .sort((a, b) => b.score - a.score);

// 修正：第2引数には車番ではなく、選手データ配列(participatingPlayers)を渡す
const koutenreiBets = generateKoutenreiBets(koutenreiRanking, participatingPlayers);
const koutenreiBox = document.getElementById('koutenrei-output');

if (koutenreiBox && koutenreiBets) {
  const L_id = koutenreiBets.nirentan[0][1]; // 特異点Lの車番
  let html = `<h4>⛈️ 荒天令</h4><p><strong>⚫ 特異点：</strong>${L_id}</p><strong>三連複</strong><ul>`;
  koutenreiBets.sanrenpuku.forEach(b => html += `<li>${formatSanrenpuku(b)}</li>`);
  html += '</ul><strong>二車単</strong><ul>';
  koutenreiBets.nirentan.forEach(b => html += `<li>${formatOrderedBet(b)}</li>`);
  html += '</ul>';
  koutenreiBox.innerHTML = html;
}
  
// シナリオ詳細表示
const scenarioOutput = document.getElementById('scenario-output'); 
if (scenarioOutput) { 
    scenarioOutput.innerHTML = seriSummaryHtml + detailedScenarioResults.map(s => { 
        const wagers = generateScenarioWagers(s.results); 
        return `<div class="scenario-detail"><h4>${s.scenario}シミュレーション</h4><p><strong>三連単:</strong> ${wagers.tritan}</p><p><strong>三連複:</strong> ${wagers.trifuku}</p><table><tr><th>選手ID</th><th>評価</th></tr>${s.results.map((p) => `<tr><td>${p.id}</td><td><strong>${p.grade}${p.strength_mark}</strong></td></tr>`).join('')}</table></div>`; 
    }).join(''); 
  } 
 }

// --- 以下、重複を排除した関数定義 ---


function formatOrderedBet(bet) { return bet.join('-'); }
function formatSanrenpuku(bet) { return bet.slice().sort((a, b) => a - b).join('='); }

function generateSeitenreiBets(ranking) {
    if (!ranking || ranking.length < 3) return null;
    const r1 = ranking[0].id, r2 = ranking[1].id, r3 = ranking[2].id;
    return {
        sanrentan: [[r1, r2, r3], [r2, r1, r3], [r1, r3, r2], [r2, r3, r1]],
        sanrenpuku: [[r1, r2, r3]],
    };
}

function generateKoutenreiBets(ranking, candidates) {
    if (!ranking || ranking.length < 3 || !candidates) return null;
    const A = ranking[0], B = ranking[1], C = ranking[2];
    
    const lCandidates = ranking.slice(3).map(p => {
        let s = 0;
        if (p.is_b1) s += 10; 
        if (p.is_s1) s += 5;
        if (p.id >= 6 && (p.style === '両' || p.style === '追')) s += 3;
        
        const playerData = candidates.find(c => c.id === p.id);
        if (playerData) {
            const pos = candidates.filter(c => 
                (c.line_id || 0) === (playerData.line_id || 0) && 
                c.score > playerData.score
            ).length + 1;
            if (pos >= 3) s += 2;
        }
        return { ...p, lScore: s };
    });
    
    lCandidates.sort((a, b) => b.lScore - a.lScore);
    const targetL = (lCandidates.length > 0 && lCandidates[0].lScore > 0) 
        ? lCandidates[0] 
        : ranking[3];
    
    return {
        sanrenpuku: [[A.id, B.id, targetL.id], [A.id, C.id, targetL.id]],
        nirentan: [[A.id, targetL.id], [targetL.id, A.id], [C.id, A.id]]
    };
}
  
// UIイベント設定（displayResultsの外に出す）
document.querySelectorAll('select').forEach(select => {
    select.addEventListener('change', () => {
        select.blur();
        window.scrollBy(0, 1);
        window.scrollBy(0, -1);
    });
});
