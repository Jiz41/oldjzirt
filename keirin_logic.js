const App = {};
(function(app) {

// 真自在律 実質Ver9.2 - 捌風旋炉 枢（はっぷうせんろ くるる）物理層実装
// 【V7.3】消耗ペナルティ適用拡大 ＆ 複数競り表示修正
// 【V7.4】壱耀メッセージ追加 ＆ 買い目変更
// 【V8.0】動的風圧遮蔽(kururu)実装 ＆ 自滅消耗(C_suicide)・漁夫の利ブースト統合
//  - 360度全風向ベクトル分解によるライン番手別スタミナ損耗率の算出
//  - 激突ライン共倒れ予測による「展開的必然」の穴抽出ロジック完遂
// 【V8.1】枢・天命連動（壱耀改修）。実効風速 v を判定ロジックへ完全バトンパス。
//       -「壱耀晴乾ノ象」を純粋なる「差し（追）」限定へ聖域化。
//       - 物理層（風速）と占術層（天運指数）の因果関係を統合。
//       - 構文不整合の排除、およびデータフローの単一化。
// 【V9.0】物理層最優先実装 - バンクデータに基づく「非情な物理演算」
//  - straight（みなし直線）による生存判定：35m未満で4番手以降を大幅減点
//  - canto（カント）による捲りエネルギー消費：32度超で捲りコスト×1.5
//  - イン突き（ワープ）実装：番手ブロック時の内線選手ブースト×1.35
//  - 計算順序: 物理層 → 展開層 → 事象層（kururu風圧・壱耀占術）
// 【V9.1】赤口呑縁（シャッコウ・ドンペリ）導入 - 1465世界線並列シミュレーション実装
// 【V9.2】C_L（ライン結束力係数）完全実装 ＆ 赤口呑縁独立起動統合
//          runScenarioSimulation を本来のロジックに完全復元
//          赤口呑縁関係の諸々不具合修正（invokeShakkouDonperi直接呼び出し・展開別表示削除）
// ------------------------------------------------------------------------------------

const COEFFICIENT_SETTINGS = {
    \'s-kyu\':  { R_BIAS: 1.15, RECENT_WEIGHT: 0.90, COOP_WEIGHT: 1.20, IS_GIRLS: false, SUICIDE_LIMIT: 0.97 },
    \'a-kyu\':  { R_BIAS: 1.00, RECENT_WEIGHT: 1.00, COOP_WEIGHT: 1.00, IS_GIRLS: false, SUICIDE_LIMIT: 0.93 },
    \'a-chal\': { R_BIAS: 0.90, RECENT_WEIGHT: 1.20, COOP_WEIGHT: 0.80, IS_GIRLS: false, SUICIDE_LIMIT: 0.90 },
    \'girls\':  { R_BIAS: 1.00, RECENT_WEIGHT: 1.10, COOP_WEIGHT: 1.00, IS_GIRLS: true,  SUICIDE_LIMIT: 1.00 },
};

const C_MARK_VALUES = {
    HIGH:   1.12,
    MEDIUM: 1.08,
    LOW:    1.03
};

const SERI_STYLE_BONUS = {
    \'逃\': 1.08,
    \'追\': 1.05,
    \'両\': 1.00,
    \'自\': 0.95
};

const SERI_FATIGUE_PENALTY_IN  = 0.15;
const SERI_FATIGUE_PENALTY_OUT = 0.25;
const SERI_WIN_BONUS           = 0.05;

let BANK_DATA = {};

// ====================================================================================
// kururu（風圧補正）
// ====================================================================================
function getKururuAdjustment(p, direction, speed, isGirls, lineInput, BANK_DATA) {
    const playerId = p.id;

    if (!direction || speed === undefined || speed <= 1.0 || direction === \'none\' || direction === \'無風\') {
        return { adj: 1.0, v: 0 };
    }

    const beta = (BANK_DATA && BANK_DATA.beta) ? BANK_DATA.beta : 1.0;
    const v = speed * beta;
    const selectedDir = direction;

    logMessage(`[kururu] 選手${playerId}: 方角[${selectedDir}] 風速[${speed}m] → 実効[${v.toFixed(2)}m](β:${beta})`);

    const straightBonus = (BANK_DATA.straight || 50) / 50;
    let kp;

    if (v <= 3.0) {
        kp = v * 0.05;
    } else if (v <= 7.0) {
        kp = 0.15 + Math.pow((v - 3.0), 1.8) * 0.085;
    } else {
        kp = 0.51 + Math.pow((v - 7.0), 3.0) * 0.3;
    }
    kp *= straightBonus;

    let positionShield = 1.0;
    let posLabel = "単騎";

    if (lineInput) {
        const segments = lineInput.split(/[,、]/);
        for (let i = 0; i < segments.length; i++) {
            const cleanSegment = segments[i].replace(/[^\d]/g, "");
            const playerIds = cleanSegment.split("").map(Number);
            if (playerIds.length > 0) {
                const pos = playerIds.indexOf(Number(playerId));
                if (pos !== -1) {
                    if (pos === 0)      { positionShield = 0.60; posLabel = "先行"; }
                    else if (pos === 1) { positionShield = 0.50; posLabel = "番手"; }
                    else               { positionShield = 0.40; posLabel = "3番手以降"; }
                    break;
                }
            }
        }
    }

    logMessage(`[kururu] 選手${playerId}: 方角[${selectedDir}] 位置[${posLabel}] -> 風補正実行`);

    const map = BANK_DATA.wind_direction_map || {};
    const dirType = map[selectedDir] || "横風成分";

    let vector = 0.0;
    if (dirType.includes("追い"))        { vector =  1.0; }
    else if (dirType.includes("向かい")) { vector = -1.0; }
    else if (dirType === "H→B横風")     { vector =  0.2; }
    else if (dirType === "B→H横風")     { vector = -0.2; }

    const finalAdj = 1.0 + (vector * kp * (BANK_DATA.alpha || 1.0) * positionShield);

    logMessage(`[kururu] 選手${playerId}: 方角[${selectedDir}] 属性[${dirType}] 位置[${posLabel}] -> 風補正実行`);

    return { adj: finalAdj, v: v };
}

// ====================================================================================
// 物理層：straight による生存判定（V9.0）
// ====================================================================================
function applyPhysicalConstraints(players, bankData, lineInput) {
    const straight = bankData.straight || 50;

    const positionMap = getPlayerPositions(lineInput);

    players.forEach(p => {
        const pos = positionMap[p.id] || { position: 99, label: \'不明\' };
        let physicalPenalty = 1.0;

        if (straight < 35) {
            if (pos.position >= 4)      { physicalPenalty = 0.25; logMessage(`[物理層] 選手${p.id}: 直線${straight}m/位置${pos.position}番手 → 物理的到達困難 (×0.25)`); }
            else if (pos.position === 3){ physicalPenalty = 0.60; logMessage(`[物理層] 選手${p.id}: 直線${straight}m/位置3番手 → 到達困難 (×0.60)`); }
        } else if (straight < 50) {
            if (pos.position >= 4)      { physicalPenalty = 0.50; logMessage(`[物理層] 選手${p.id}: 直線${straight}m/位置${pos.position}番手 → 到達やや困難 (×0.50)`); }
            else if (pos.position === 3){ physicalPenalty = 0.80; }
        }

        p.physicalPenalty = physicalPenalty;
    });

    return players;
}

function getPlayerPositions(lineInput) {
    const positionMap = {};
    if (!lineInput) return positionMap;

    const segments = lineInput.split(/[,、]/);
    let globalPosition = 1;

    segments.forEach(segment => {
        const cleanSegment = segment.replace(/[^\d]/g, "");
        const playerIds = cleanSegment.split("").map(Number);

        playerIds.forEach((id, localPos) => {
            let label = "後方";
            if (localPos === 0)      label = "先行";
            else if (localPos === 1) label = "番手";
            else if (localPos === 2) label = "3番手";

            positionMap[id] = { position: globalPosition, label: label, linePosition: localPos };
            globalPosition++;
        });
    });

    return positionMap;
}

// ====================================================================================
// 展開層：カント・イン突き（V9.0）
// ====================================================================================
function applyTacticalAdjustments(players, bankData, lineInput, seriInfos) {
    const positionMap = getPlayerPositions(lineInput);

    const warpBoostTargets = [];

    if (seriInfos && seriInfos.length > 0) {
        seriInfos.forEach(seri => {
            const winnerPos = positionMap[seri.winner];
            if (winnerPos && winnerPos.position === 2) {
                logMessage(`[展開層] 番手選手${seri.winner}が競り勝利 → イン突き（ワープ）発動`);
                Object.keys(positionMap).forEach(id => {
                    const pos = positionMap[id];
                    if (pos.position >= 3 && pos.position <= 4) {
                        warpBoostTargets.push(Number(id));
                    }
                });
            }
        });
    }

    players.forEach(p => {
        const pos = positionMap[p.id];

        if (warpBoostTargets.includes(p.id)) {
            p.warpBoost = 1.35;
            logMessage(`[展開層] 選手${p.id}: イン突き（ワープ）ブースト ×1.35`);
        } else {
            p.warpBoost = 1.0;
        }
    });

    return players;
}

// ====================================================================================
// 壱耀晴乾ノ象
// ====================================================================================
const SUPERIORITY_THRESHOLD_RATE = 0.0206;
const RAW_COMPOSITE_STATS = [
    { pattern_key: "33_差し", hit_rate: 0.0309 },
    { pattern_key: "33_逃げ", hit_rate: 0.0206 },
];

function calculateSuperiorityList() {
    const superiorPatterns = [];
    const targetPatterns = ["33_差し"];
    for (const data of RAW_COMPOSITE_STATS) {
        if (targetPatterns.includes(data.pattern_key) && data.hit_rate >= SUPERIORITY_THRESHOLD_RATE) {
            superiorPatterns.push(data.pattern_key);
        }
    }
    return superiorPatterns;
}
const SUPERIOR_PATTERNS_FINAL_LIST = calculateSuperiorityList();

// ====================================================================================
// ロギング
// ====================================================================================
let _logScrollTimer = null;
function logMessage(message) {
    const logArea = document.getElementById(\'debug-log\');
    if (!logArea) return;
    const timestamp = new Date().toLocaleTimeString(\'ja-JP\', { hour12: false });
    logArea.insertAdjacentHTML(\'beforeend\', `[${timestamp}] ${message}<br>`);
    if (_logScrollTimer) clearTimeout(_logScrollTimer);
    _logScrollTimer = setTimeout(() => { logArea.scrollTop = logArea.scrollHeight; }, 50);
}

// ====================================================================================
// getPlayerData
// ====================================================================================
function getPlayerData() {
    const players = [];
    const playerRows = document.querySelectorAll(\'.player-row\');
    const s1Leader = document.querySelector(\'input[name="s-leader"]:checked\');
    const b1Leader = document.querySelector(\'input[name="b-leader"]:checked\');
    const s1Id = s1Leader ? parseInt(s1Leader.getAttribute(\'data-id\')) : null;
    const b1Id = b1Leader ? parseInt(b1Leader.getAttribute(\'data-id\')) : null;

    playerRows.forEach(row => {
        const id = parseInt(row.getAttribute(\'data-id\'));
        if (isNaN(id)) return;

        const score  = parseFloat(row.querySelector(\'.score\').value) || 0;
        const style  = row.querySelector(\'.style\').value;
        const wmark  = row.querySelector(\'.wmark\').value.trim();
        const isScratchCheckbox = row.querySelector(\'.is-scratch\');
        const is_scratch = isScratchCheckbox ? isScratchCheckbox.checked : false;

        players.push({
            id, score, style, wmark,
            recent: row.querySelector(\'.recent\').value.trim(),
            is_s1: id === s1Id,
            is_b1: id === b1Id,
            is_scratch,
            c_score_adj: 1.0, c_recent: 1.0, c_wmark: 1.0,
            c_s1: 1.0, c_b1: 1.0, c_l: 1.0, c_e: 1.0,
            final_score: 0,
            seri_coef: score * (SERI_STYLE_BONUS[style] || 1.00) * (wmark === \'◎\' ? 1.04 : 1.0)
        });
    });
    return players;
}

// ====================================================================================
// loadBANK_DATA
// ====================================================================================
async function loadBANK_DATA() {
    try {
        logMessage("[INIT] bankdata.jsonの読み込みを開始します...");
        const response = await fetch('https://huggingface.co/spaces/Jiz41/Jiz41r1t5utest/resolve/main/bankdata.json');
        if (!response.ok) throw new Error(`HTTP status ${response.status}`);

        BANK_DATA = await response.json();
        logMessage(`[SUCCESS] bankdata.jsonを正常に読み込みました。 ${Object.keys(BANK_DATA).length}件のバンクデータをロード。`);

        const bankSelect = document.getElementById(\'bank-name\');
        if (bankSelect) {
            bankSelect.innerHTML = \'\';
            Object.keys(BANK_DATA).forEach(bankName => {
                const option = document.createElement(\'option\');
                option.value = bankName;
                option.textContent = bankName;
                bankSelect.appendChild(option);
            });
            logMessage("[UI] バンク名の選択肢を動的に構築しました。");
            displayBankTendency();
        }
    } catch (error) {
        logMessage(`[FATAL ERROR] データ読み込み処理中に重大なエラーが発生: ${error.message}`);
        BANK_DATA = { \'ダミーバンク\': { length: 400, keirin_bias: { \'先行\': 1.0, \'捲り\': 1.0, \'差し\': 1.0 }, wind_or_position: {} } };
        const bankSelect = document.getElementById(\'bank-name\');
        if (bankSelect) bankSelect.innerHTML = \'<option value="ダミーバンク">データ読み込み失敗</option>\';
    }
}

// ====================================================================================
// displayBankTendency
// ====================================================================================
function displayBankTendency() {
    const bankName  = document.getElementById(\'bank-name\').value;
    const displayArea = document.getElementById(\'bank-tendency-display\');

    if (!bankName || !BANK_DATA[bankName] || !displayArea) {
        if (displayArea) displayArea.innerHTML = \'\';
        return;
    }

    const bankInfo = BANK_DATA[bankName];
    const bias = bankInfo.keirin_bias;
    const biasMap = {
        \'先行\': bias[\'先行\'] || 1.0,
        \'捲り\': bias[\'捲り\'] || 1.0,
        \'差し\': bias[\'差し\'] || 1.0
    };

    let maxBias = -Infinity;
    let strongestTendency = \'\';
    const styleMap = { \'先行\': \'逃先\', \'捲り\': \'捲り\', \'差し\': \'差マ\' };

    Object.keys(biasMap).forEach(key => {
        if (biasMap[key] > maxBias) { maxBias = biasMap[key]; strongestTendency = key; }
    });

    let message = \'\';
    if (maxBias > 1.03) {
        message = `⚠️ **${bankName}**は**${styleMap[strongestTendency]}**が**出やすい**傾向があります。 (バイアス ${maxBias.toFixed(2)})`;
    } else if (maxBias < 0.97) {
        message = `✅ **${bankName}**は**${styleMap[strongestTendency]}**が最も低い傾向です。`;
    } else {
        message = `ℹ️ **${bankName}**は脚質による大きな傾向差は**ありません**。`;
    }

    const straight = bankInfo.straight || 50;
    const canto    = bankInfo.canto    || 30;

    if (straight < 35) {
        message += `<br><span style="color: #d32f2f; font-weight: bold;">⚠️ 極端短直線(${straight}m)：4番手以降の到達困難</span>`;
    } else if (straight < 50) {
        message += `<br><span style="color: #f57c00;">⚠️ 短直線(${straight}m)：4番手以降に不利</span>`;
    }
    if (canto > 32) {
        message += `<br><span style="color: #1976d2;">🔄 高カント(${canto}度)：捲りコスト増大</span>`;
    }

    displayArea.innerHTML = message;
    logMessage(`[BANK] ${bankName} の展開傾向: ${message.replace(/<[^>]*>?/gm, \'\')}`);
}

(async function() { await loadBANK_DATA(); })();

// ====================================================================================
// parseLineInput
// ====================================================================================
function parseLineInput(lineInput, allPlayers) {
    const processedLineInput = lineInput.replace(/\\s/g, \'\');
    const segments = processedLineInput.split(\',\');

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
                const seriEnd   = seriStart + seriMatch[0].length;

                if (seriStart > 0) {
                    const numericalPart = remainingSeg.substring(0, seriStart);
                    numericalPart.split(\'\').map(Number).filter(id => id > 0).forEach(id => {
                        if (!allParsedIds.has(id)) { segOrderedIds.push(id); allParsedIds.add(id); }
                        displayLineSegments.push({ type: \'single\', id });
                        currentLine.push(id);
                    });
                }

                const follower  = parseInt(seriMatch[1]);
                const contender = parseInt(seriMatch[2]);

                logMessage(`[PARSE] 競り検出: 選手${follower} (イン) vs 選手${contender} (アウト)`);

                const followerCoef  = allPlayers.find(p => p.id === follower)?.seri_coef  || 0;
                const contenderCoef = allPlayers.find(p => p.id === contender)?.seri_coef || 0;

                let winnerId, loserId;
                if (followerCoef >= contenderCoef) { winnerId = follower;  loserId = contender; }
                else                               { winnerId = contender; loserId = follower;  }

                allSeriInfos.push({ exists: true, follower, contender, winner: winnerId, loser: loserId });
                logMessage(`[PARSE] 競り勝者予測: 選手${winnerId} (C_seriに基づき予測)`);

                currentLine.push(winnerId);
                lines.push([loserId]);

                if (!allParsedIds.has(follower))  { segOrderedIds.push(follower);  allParsedIds.add(follower);  }
                if (!allParsedIds.has(contender)) { segOrderedIds.push(contender); allParsedIds.add(contender); }

                displayLineSegments.push({ type: \'seri\', follower, contender });
                remainingSeg = remainingSeg.substring(seriEnd);

            } else {
                remainingSeg.split(\'\').map(Number).filter(id => id > 0).forEach(id => {
                    if (!allParsedIds.has(id)) { segOrderedIds.push(id); allParsedIds.add(id); }
                    displayLineSegments.push({ type: \'single\', id });
                    currentLine.push(id);
                });
                remainingSeg = "";
            }
        }

        if (currentLine.length > 0) lines.push(currentLine);
        orderedPlayerIds.push(...segOrderedIds);
    });

    const uniqueOrderedPlayerIds = [];
    const seenIds = new Set();
    for (const id of orderedPlayerIds) {
        if (!seenIds.has(id)) { uniqueOrderedPlayerIds.push(id); seenIds.add(id); }
    }

    return { lines, allSeriInfos, orderedPlayerIds: uniqueOrderedPlayerIds, displayLineSegments };
}

// ====================================================================================
// calculateLineCoeffs  ★ C_L完全実装版
// ====================================================================================
function calculateLineCoeffs(players, settings) {

    // 1. 欠場除外
    const participatingPlayers = players.filter(p => !p.is_scratch);
    logMessage(`[SCRATCH] 欠場選手を除外しました。出走選手数: ${participatingPlayers.length}`);

    if (participatingPlayers.length === 0) {
        logMessage("[ERROR] 出走選手がゼロのため、ライン解析をスキップします。");
        return { players: [], allSeriInfos: [], finalOrderedPlayerIds: [], displayLineSegments: [] };
    }

    // 2. ライン解析
    const lineInput = document.getElementById(\'line-input\').value;
    logMessage(`[PARSE] ライン入力解析: ${lineInput}`);
    const {
        lines: initialLines,
        allSeriInfos: parsedAllSeriInfos,
        orderedPlayerIds: initialOrderedPlayerIds,
        displayLineSegments: parsedDisplayLineSegments
    } = parseLineInput(lineInput, participatingPlayers);

    let lines = [...initialLines];
    let finalOrderedPlayerIds = [...initialOrderedPlayerIds];
    let displayLineSegments   = [...parsedDisplayLineSegments];

    // 欠落選手の補完
    const playerIdsSet    = new Set(initialOrderedPlayerIds);
    const allRidersInLines = new Set();
    lines.forEach(line => line.forEach(id => allRidersInLines.add(id)));

    participatingPlayers.forEach(p => {
        if (!playerIdsSet.has(p.id)) {
            finalOrderedPlayerIds.push(p.id);
            playerIdsSet.add(p.id);
            displayLineSegments.push({ type: \'single\', id: p.id });
        }
        if (!allRidersInLines.has(p.id)) lines.push([p.id]);
    });
    logMessage(`[ORDER] 最終表示順序に欠落選手を補完しました。`);

    // 3. C_L（ライン結束力係数）計算 ★実装
    const coop = settings.COOP_WEIGHT || 1.0;

    // 競り敗者はラインから外れたので C_L = 1.0 のまま
    const seriLoserIds = new Set(parsedAllSeriInfos.map(s => s.loser));

    if (settings.IS_GIRLS) {
        logMessage(`[C_L] ガールズ競輪モード: エースマーク係数適用 (C_MARK_VALUES)`);
        lines.forEach(line => {
            if (line.length < 2) return;
            const leader = participatingPlayers.find(p => p.id === line[0]);
            for (let i = 1; i < line.length; i++) {
                const p = participatingPlayers.find(pp => pp.id === line[i]);
                if (!p || seriLoserIds.has(p.id)) continue;

                let markVal = C_MARK_VALUES.LOW;
                if (leader && leader.wmark === \'◎\')      markVal = C_MARK_VALUES.HIGH;
                else if (leader && leader.wmark === \'〇\') markVal = C_MARK_VALUES.MEDIUM;

                // 番手は満額、3番手以降は半額ボーナス
                p.c_l = (i === 1) ? markVal : 1.0 + (markVal - 1.0) * 0.5;
                logMessage(`[C_L] 選手ID ${p.id}: ガールズC_L=${p.c_l.toFixed(3)}`);
            }
        });
    } else {
        logMessage(`[C_L] 一般競輪モード: COOP_WEIGHT=${coop}`);
        lines.forEach(line => {
            if (line.length < 2) return;
            for (let i = 1; i < line.length; i++) {
                const p = participatingPlayers.find(pp => pp.id === line[i]);
                if (!p || seriLoserIds.has(p.id)) continue;

                if (i === 1) {
                    p.c_l = 1.0 + coop * 0.05;       // 番手
                } else {
                    p.c_l = 1.0 + coop * 0.03;       // 3番手以降
                }
                logMessage(`[C_L] 選手ID ${p.id}: 位置${i + 1}番手 C_L=${p.c_l.toFixed(3)}`);
            }
        });
    }

    return { players: participatingPlayers, allSeriInfos: parsedAllSeriInfos, finalOrderedPlayerIds, displayLineSegments };
}

// ====================================================================================
// applySeriCorrection
// ====================================================================================
function applySeriCorrection(scoredPlayers, allSeriInfos) {
    if (allSeriInfos.length === 0) {
        logMessage("[SERI] 競り入力がないため、競り補正はスキップします。");
        return scoredPlayers;
    }
    logMessage(`[SERI] 競り補正処理（${allSeriInfos.length}件）を開始します。`);

    allSeriInfos.forEach(seriInfo => {
        const winner = scoredPlayers.find(p => p.id === seriInfo.winner);
        if (winner) {
            winner.final_score = winner.final_score * (1 + SERI_WIN_BONUS) * (1 - SERI_FATIGUE_PENALTY_IN);
            logMessage(`[SERI] 競り勝者 選手${winner.id}: スコア微増/体力減点補正が適用されました。`);
        }
        const loser = scoredPlayers.find(p => p.id === seriInfo.loser);
        if (loser) {
            loser.final_score *= (1 - SERI_FATIGUE_PENALTY_OUT);
            logMessage(`[SERI] 競り敗者 選手${loser.id}: スコア大幅減点補正が適用されました。`);
        }
    });

    scoredPlayers.forEach(p => {
        logMessage(`[SERI] 選手ID ${p.id}: 競り処理後のスコアは ${p.final_score.toFixed(3)} になりました。`);
    });

    return scoredPlayers;
}

// ====================================================================================
// getScenarioCoeffs
// ====================================================================================
function getScenarioCoeffs(scenario) {
    if (scenario === \'先行有利\') return { \'自\': 1.05, \'追\': 1.02, \'両\': 1.03 };
    if (scenario === \'捲り有利\') return { \'自\': 1.00, \'追\': 1.05, \'両\': 1.04 };
    if (scenario === \'差し有利\') return { \'自\': 0.90, \'追\': 1.08, \'両\': 1.05 };
    return { \'自\': 1.0, \'追\': 1.0, \'両\': 1.0 };
}

// ====================================================================================
// generateScenarioWagers
// ====================================================================================
function generateScenarioWagers(results, v) {
    if (!results || results.length < 3) return { tritan: \'---\', trifuku: \'---\', ichiyo: "" };

    const r = results.map(p => p.id);
    let superiorPatternMessage = "";

    const tenunText  = document.getElementById(\'tenun-index-output\')?.innerText || "";
    const isTenunZero = tenunText.includes("指数: 0") || tenunText.includes("大安吉日");

 if (isTenunZero && v <= 3.0) {
    const top4 = results.slice(0, 4);
    const trueIchiyo = top4.find(p => p.style === \'追\');
    if (trueIchiyo) {
        superiorPatternMessage = `【壱耀晴乾ノ象】天命、${trueIchiyo.id}番車に収束。`;
    }
}

    const tritan = [
        `${r[0]}-${r[1]}-${r[2]}`,
        `${r[0]}-${r[2]}-${r[1]}`,
        `${r[1]}-${r[0]}-${r[2]}`
    ].join(\', \');

    const tri1 = [r[0], r[1], r[2]].sort((a, b) => a - b).join(\'=\');
    let tri2 = (r.length >= 4) ? [r[0], r[1], r[3]].sort((a, b) => a - b).join(\'=\') : \'\';
    const trifuku = [tri1, tri2].filter(t => t.length > 0).join(\', \');

    return { tritan, trifuku, ichiyo: superiorPatternMessage };
}

// ====================================================================================
// assignFinalGrades
// ====================================================================================
function assignFinalGrades(scenarioPlayers) {
    if (scenarioPlayers.length === 0) return;

    const scores   = scenarioPlayers.map(p => p.final_score);
    const maxScore = scores[0];
    const minScore = scores[scores.length - 1];
    const range    = maxScore - minScore;

    scenarioPlayers.forEach(p => {
        let grade = 1;
        if (range > 0) grade = Math.ceil(1 + 9 * (p.final_score - minScore) / range);
        p.grade = Math.min(10, Math.max(1, grade));
    });

    scenarioPlayers.forEach((p, index) => {
        p.strength_mark = \'→\';
        if (index === scenarioPlayers.length - 1) return;
        const nextPlayer = scenarioPlayers[index + 1];
        if (p.grade === nextPlayer.grade) {
            const scoreDiff = p.final_score - nextPlayer.final_score;
            if (scoreDiff >= (range / 1000) * 1)   p.strength_mark = \'↑\';
            else if (scoreDiff >= (range / 1000) * 0.1) p.strength_mark = \'↗\';
            else                                        p.strength_mark = \'→\';
        }
    });
}

// ====================================================================================
// calculate_koutenrei_bias（荒天令）
// ====================================================================================
function calculate_koutenrei_bias(players, scenario, BANK_DATA, v) {
    let tempPlayers = JSON.parse(JSON.stringify(players));
    const appliedCoeffs = [];

    const allScores  = players.map(p => p.score);
    const scoreMax   = Math.max(...allScores);
    const scoreMin   = Math.min(...allScores);
    const scoreRange = scoreMax - scoreMin;

    const lineInput = document.getElementById(\'line-input\').value;
    const { lines: initialLines } = parseLineInput(lineInput, tempPlayers);

    const lines = [];
    const allRidersInLines = new Set();
    initialLines.forEach(line => { lines.push(line); line.forEach(id => allRidersInLines.add(id)); });
    tempPlayers.forEach(p => { if (!allRidersInLines.has(p.id)) lines.push([p.id]); });

    tempPlayers.forEach(p => {

        // 2. C_risk
        const avgScore  = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        const recentAvg = p.recent.split(\'\').map(Number).reduce((a, b) => a + b, 0) / p.recent.length || 4.0;
        if (p.score < avgScore - 2.0 && recentAvg >= 4.0) {
            p.final_score *= 0.97;
            appliedCoeffs.push(\'C_risk\');
        }

        // 3. C_mental
        const raceGrade = document.getElementById(\'race-type\').value;
        const participatingMaxScore = Math.max(...tempPlayers.map(pp => pp.score));
        const isHighPressure = [\'s-kyu\'].includes(raceGrade) || (p.score === participatingMaxScore);
        if (isHighPressure && p.recent.startsWith(\'1\')) {
            const mentalAdj = 1.0 - (v * 0.005);
            p.final_score *= mentalAdj;
            appliedCoeffs.push(\'C_mental\');
        }

// 4. C_recovery
        if (p.style === \'両\' || p.style === \'追\') {
            const scoreDiffRatio = (p.score - scoreMin) / scoreRange;
            if (scoreDiffRatio > 0.6) {
                const recoveryFactor = 1.04 + (scoreDiffRatio - 0.6) * 0.1;
                p.final_score *= recoveryFactor;
                appliedCoeffs.push(\'C_recovery\');
            }
        }
    });

    // 5. C_target
    const targetPlayer = tempPlayers.find(pp => pp.score === scoreMax);
    if (targetPlayer) {
        let rivalAutos = 0;
        tempPlayers.forEach(pp => { if (pp.id !== targetPlayer.id && (pp.style === \'逃\' || pp.style === \'自\' || pp.style === \'両\')) rivalAutos++; });
        if (rivalAutos >= 2) {
            const targetAdj = 1.0 - (v * 0.007);
            targetPlayer.final_score *= targetAdj;
            appliedCoeffs.push(\'C_target\');
        }
    }

    // 6. C_split
    lines.forEach(line => {
        const p1 = tempPlayers.find(pp => pp.id === line[0]);
        const p2 = tempPlayers.find(pp => pp.id === line[1]);
        if (p1 && p2) {
            const relativeDiff = (p1.score - p2.score) / scoreRange;
            if (relativeDiff >= 0.30) {
                const penalty = 1.0 - (relativeDiff - 0.30) * 0.15;
                p2.final_score *= penalty;
                appliedCoeffs.push(\'C_split\');
            }
        }
    });

    // 7. C_pace
    const leaderPlayer = tempPlayers.find(pp => pp.style === \'逃\' || pp.style === \'自\' || pp.style === \'両\');
    if (leaderPlayer && leaderPlayer.score >= 105.0 && lines.length - 1 >= 2) {
        leaderPlayer.final_score *= 0.96;
        appliedCoeffs.push(\'C_pace\');
    }

    // 8. C_timing
    tempPlayers.forEach(pp => {
        if (pp.style === \'両\') {
            const line = lines.find(l => l.includes(pp.id));
            if (line && line.indexOf(pp.id) >= 1) {
                pp.final_score *= 0.97;
                appliedCoeffs.push(\'C_timing\');
            }
        }
    });

    // 9. C_guard
    lines.forEach(line => {
        const p2 = tempPlayers.find(pp => pp.id === line[1]);
        if (p2) {
            const lowScoreThreshold = scoreMin + scoreRange * 0.4;
            let baseRisk = 1.0;
            if (p2.score < lowScoreThreshold) baseRisk = 0.95;
            const attackers = tempPlayers.filter(pp => pp.id !== p2.id && (pp.style === \'逃\' || pp.style === \'自\' || pp.style === \'両\')).length;
            if (attackers >= 2) baseRisk *= 0.95;
            p2.final_score *= baseRisk;
            appliedCoeffs.push(\'C_guard\');
        }
    });

    // 10. C_suicide
    const raceGradeForSuicide = document.getElementById(\'race-type\').value;
    const suicideSettings = COEFFICIENT_SETTINGS[raceGradeForSuicide] || {};
    const SUICIDE_PENALTY = suicideSettings.SUICIDE_LIMIT || 0.90;
    const BOOTY_BONUS = 1.05;

    let isSuicideRiskDetected = false;
    let suicideRiskLineMembers = new Set();

    const lineEvaluations = {};
    const playerIdToLineIndex = {};
    lines.forEach((line, index) => { line.forEach(id => { playerIdToLineIndex[id] = index; }); });

    lines.forEach((line, index) => {
        let lineLength = line.length;
        let totalWeightScore = 0;
        let hasSelfStarter = false;

        line.forEach(id => {
            const player = tempPlayers.find(p => p.id === id);
            if (player) {
                if ([\'◎\', \'〇\', \'△\'].includes(player.wmark)) totalWeightScore += 1;
                if (player.style === \'逃\' || player.style === \'自\' || player.style === \'両\') hasSelfStarter = true;
            }
        });

        lineEvaluations[index] = { lineLength, totalWeightScore, hasSelfStarter, lineMembers: line };
    });

    Object.keys(lineEvaluations).forEach(lineIndex => {
        const ev = lineEvaluations[lineIndex];
        if (ev.lineLength >= 3 && ev.totalWeightScore === 3 && ev.hasSelfStarter) {
            logMessage(`[C_suicide] 🔴 リスク極大ライン検出！ (ライン${ev.lineMembers.join(\'-\')})`);
            isSuicideRiskDetected = true;
            ev.lineMembers.forEach(id => suicideRiskLineMembers.add(id));
        }
    });

    if (isSuicideRiskDetected) {
        tempPlayers.forEach(p => {
            if (suicideRiskLineMembers.has(p.id)) {
                const suicideRate = Math.min(v, 7.0) / 7.0;
                const dynamicSuicidePenalty = 1.0 - ((1.0 - SUICIDE_PENALTY) * suicideRate);
                p.final_score *= dynamicSuicidePenalty;
            } else {
                const lineIndex = playerIdToLineIndex[p.id];
                if (lineIndex !== undefined && lineEvaluations[lineIndex].lineLength >= 2) {
                    p.final_score *= BOOTY_BONUS;
                } else if (lineIndex === undefined || lineEvaluations[lineIndex].lineLength === 1) {
                    p.final_score *= 1.02;
                }
            }
        });
        appliedCoeffs.push(\'C_suicide(発動)\');
    }

    // シナリオ単位でまとめてログ出力
    const uniqueCoeffs = [...new Set(appliedCoeffs)];
    logMessage(`[KOUTENREI] ${scenario}: ${uniqueCoeffs.length > 0 ? uniqueCoeffs.join(\' / \') : \'なし\'}`);

    return tempPlayers;
}

// ====================================================================================
// runScenarioSimulation  ★本来のロジック完全復元版（V10.0）
// ====================================================================================
function runScenarioSimulation(basePlayers, allSeriInfos, settings, BANK_DATA, applyKoutenrei, lineInput, windSpeed, windDirection) {
    const scenarios = [\'先行有利\', \'捲り有利\', \'差し有利\'];
    const allScenarioResults = [];
    const integratedScores   = {};
    const completedScenarios = [];
    const scenarioPrefix = applyKoutenrei ? \'[KOUTEN]\' : \'[SEITEN]\';

    logMessage(`${scenarioPrefix} バンク直線: ${BANK_DATA.straight || 50}m / カント: ${BANK_DATA.canto || 30}度`);

    basePlayers.forEach(p => integratedScores[p.id] = 0);

    scenarios.forEach(scenario => {
        const cDCoeffs      = getScenarioCoeffs(scenario);
        let scenarioPlayers = JSON.parse(JSON.stringify(basePlayers));
        const logPrefix     = applyKoutenrei ? \'[KOUTEN-SCN]\' : \'[SEITEN-SCN]\';

        const direction = windDirection || (BANK_DATA ? BANK_DATA.direction : \'無風\');
        const speed     = (windSpeed !== undefined) ? windSpeed : (BANK_DATA ? BANK_DATA.speed : 0);
        const isGirls   = settings ? settings.IS_GIRLS : false;

        // 🔥 物理層（V9.0）
        applyPhysicalConstraints(scenarioPlayers, BANK_DATA, lineInput);

        // 🔥 展開層（V9.0）
        applyTacticalAdjustments(scenarioPlayers, BANK_DATA, lineInput, allSeriInfos);

        scenarioPlayers.forEach(p => {
            p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_s1 * p.c_b1 * p.c_l * p.c_e;
            p.final_score *= (p.physicalPenalty     || 1.0);
            p.final_score *= (p.cantoMakuriPenalty  || 1.0);
            p.final_score *= (p.warpBoost           || 1.0);
            const res = getKururuAdjustment(p, direction, speed, isGirls, lineInput, BANK_DATA);
            p.final_score *= res.adj;
            p.v_for_wager  = res.v;
        });

        const v = scenarioPlayers[0].v_for_wager || 0;

        scenarioPlayers = applySeriCorrection(scenarioPlayers, allSeriInfos);

        if (applyKoutenrei) {
            scenarioPlayers = calculate_koutenrei_bias(scenarioPlayers, scenario, BANK_DATA, v);
        }

        scenarioPlayers.forEach(p => {
            const cD = cDCoeffs[p.style] || 1.0;
            p.final_score *= cD;
            integratedScores[p.id] += p.final_score;
        });

        scenarioPlayers.sort((a, b) => b.final_score - a.final_score);
        assignFinalGrades(scenarioPlayers);
        allScenarioResults.push({ scenario, results: scenarioPlayers });
        completedScenarios.push(scenario);
    });

    logMessage(`${scenarioPrefix} ${completedScenarios.join(\' / \')} 完了`);

    return { allScenarioResults, integratedScores };
}

// ====================================================================================
// calculateTenunIndex
// ====================================================================================
function calculateTenunIndex(seitenreiScores, koutenreiScores, allScenarioResults, participatingPlayers) {
    const seitenreiRanking = Object.keys(seitenreiScores).map(id => {
        const pData = participatingPlayers.find(pp => pp.id === Number(id));
        return { ...pData, final_score: seitenreiScores[id] };
    }).sort((a, b) => b.final_score - a.final_score);

    const koutenreiRanking = Object.keys(koutenreiScores).map(id => {
        const pData = participatingPlayers.find(pp => pp.id === Number(id));
        return { ...pData, final_score: koutenreiScores[id] };
    }).sort((a, b) => b.final_score - a.final_score);

    if (seitenreiRanking.length < 3 || koutenreiRanking.length < 3) {
        return { tenunIndex: 50, message: \'データ不足のため指数算出不可\', rankingWithData: [], koutenRankingWithData: [] };
    }

    const seitenTop3 = new Set(seitenreiRanking.slice(0, 3).map(p => p.id));
    const koutenTop3 = koutenreiRanking.slice(0, 3).map(p => p.id);
    let matchCount = 0;
    koutenTop3.forEach(id => { if (seitenTop3.has(id)) matchCount++; });

    const tenunIndexMap = { 3: 0, 2: 33, 1: 67, 0: 100 };
    const tIndex = tenunIndexMap[matchCount] ?? 50;

    const windSpeed = parseFloat(document.getElementById(\'wind-speed\').value) || 0;
    let targetPlayerId = null;

    if (tIndex === 33 && windSpeed <= 2.0) {
        const firstPlayer = seitenreiRanking[0];
        if (firstPlayer) {
            const isSashiMa  = (firstPlayer.style === \'追\' || firstPlayer.style === \'両\');
            const isWeightTop = (firstPlayer.wmark === \'◎\');
            if (isSashiMa && isWeightTop) {
                targetPlayerId = firstPlayer.id;
                logMessage(`壱耀晴乾ノ象：○${targetPlayerId}`);
            }
        }
    }

    let finalHtml = window.generateTamakiTenunHTML(tIndex, false, null);
    if (targetPlayerId !== null) {
        finalHtml += window.generateTamakiTenunHTML(tIndex, true, targetPlayerId);
    }

    return {
        tenunIndex: tIndex,
        message: finalHtml,
        rankingWithData: seitenreiRanking,
        koutenRankingWithData: koutenreiRanking
    };
}

// ====================================================================================
// calculatePrediction  ★赤口呑縁独立起動統合版
// ====================================================================================
async function calculatePrediction() {
    const tenunOutputArea = document.getElementById(\'tenun-index-output\');
    if (tenunOutputArea && typeof window.generateTamakiObservingHTML === \'function\') {
        tenunOutputArea.innerHTML = window.generateTamakiObservingHTML();
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    const players    = [];
    const playerRows = document.querySelectorAll(\'.player-row\');
    const s1Id = document.querySelector(\'input[name="s-leader"]:checked\')?.getAttribute(\'data-id\');
    const b1Id = document.querySelector(\'input[name="b-leader"]:checked\')?.getAttribute(\'data-id\');

    playerRows.forEach(row => {
        const id     = parseInt(row.getAttribute(\'data-id\'));
        if (isNaN(id)) return;

        let score    = parseFloat(row.querySelector(\'.score\').value) || 0;
        const style  = row.querySelector(\'.style\').value;
        const wmark  = row.querySelector(\'.wmark\').value.trim();
        const isScratch = row.querySelector(\'.is-scratch\')?.checked || false;

        const isGoldCap = document.getElementById(`goldcap-${id}`)?.checked || false;
        if (isGoldCap && score < 95.0) {
            score = 95.0;
            logMessage(`[ROYAL] 選手${id}: 👑 戴冠（地力再定義)`);
        }

        players.push({
            id, score, style, wmark,
            recent: row.querySelector(\'.recent\').value.trim(),
            is_s1: id == s1Id, is_b1: id == b1Id, is_scratch: isScratch,
            c_score_adj: 1.0, c_recent: 1.0, c_wmark: 1.0,
            c_s1: 1.0, c_b1: 1.0, c_l: 1.0, c_e: 1.0, final_score: 0,
            seri_coef: score * (SERI_STYLE_BONUS[style] || 1.00) * (wmark === \'◎\' ? 1.04 : 1.0)
        });
    });

    if (Object.keys(BANK_DATA).length === 0) await loadBANK_DATA();

    const raceType  = document.getElementById(\'race-type\').value;
    const settings  = COEFFICIENT_SETTINGS[raceType];
    const bankName  = document.getElementById(\'bank-name\').value;
    const selectedBank = BANK_DATA[bankName];
    const modeSelector = document.getElementById(\'mode-selector\');
    const koutenreiModeSelected = modeSelector ? modeSelector.value === \'koutenrei\' : false;

    logMessage(`[CALC START] ${raceType} / バンク: ${bankName} / モード: ${koutenreiModeSelected ? \'荒天令\' : \'晴天令\'}`);

    const { players: participatingPlayers, allSeriInfos, finalOrderedPlayerIds, displayLineSegments } = calculateLineCoeffs(players, settings);

    if (participatingPlayers.length === 0) {
        alert("出走選手がいないため、計算を中止しました。");
        return;
    }

    let basePlayers = JSON.parse(JSON.stringify(participatingPlayers));

    basePlayers.forEach(p => {
        p.c_score_adj = 1.0 + (p.score / 100 - 1) * settings.R_BIAS;

        const recentScores = p.recent.split(\'\').map(Number);
        const avgRank = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 4.0;
        p.c_recent = (1.0 + (4 - avgRank) * 0.05) * settings.RECENT_WEIGHT;

        if      (p.wmark === \'◎\') p.c_wmark = 1.04;
        else if (p.wmark === \'〇\') p.c_wmark = 1.02;
        else if (p.wmark === \'✕\') p.c_wmark = 1.015;
        else if (p.wmark === \'△\') p.c_wmark = 1.01;
        else                       p.c_wmark = 1.0;

        p.c_s1 = p.is_s1 ? 1.005 : 1.0;
        p.c_b1 = p.is_b1 ? 1.015 : 1.0;

        let biasKey = \'\';
        if      (p.style === \'自\') biasKey = \'先行\';
        else if (p.style === \'逃\') biasKey = \'先行\';
        else if (p.style === \'両\') biasKey = \'捲り\';
        else if (p.style === \'追\') biasKey = \'差し\';
        p.c_e = selectedBank.keirin_bias[biasKey] || 1.0;
    });

    try {
        const currentLineInputForCalc = document.getElementById(\'line-input\').value;
        logMessage(`[DEBUG] シミュレーション開始: ラインデータ "${currentLineInputForCalc}"`);

        const windSpeed     = parseFloat(document.getElementById(\'wind-speed\').value) || 0;
        const windDirection = document.getElementById(\'wind-direction\').value;

        const seitenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, selectedBank, false, currentLineInputForCalc, windSpeed, windDirection);
        logMessage(`[CALC] 晴天令完了（風速:${windSpeed}m/s 方向:${windDirection}）`);

        const koutenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, selectedBank, true, currentLineInputForCalc, windSpeed, windDirection);
        logMessage(`[CALC] 荒天令完了（風速:${windSpeed}m/s 方向:${windDirection}）`);

        const detailedScenarioResults = koutenreiModeSelected
            ? koutenreiResults.allScenarioResults
            : seitenreiResults.allScenarioResults;

        const finalTenunData = calculateTenunIndex(
            seitenreiResults.integratedScores,
            koutenreiResults.integratedScores,
            seitenreiResults.allScenarioResults,
            participatingPlayers
        );

        // gradeKey の確定
        const gradeKey = Object.keys(COEFFICIENT_SETTINGS).find(key =>
            COEFFICIENT_SETTINGS[key] === settings) || \'a-kyu\';

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

        const resultsContainer = document.getElementById(\'results-container\');
        if (resultsContainer) resultsContainer.classList.add(\'visible\');

        // 🌌 赤口呑縁：晴天令・荒天令完了後に直接起動
        if (typeof invokeShakkouDonperi === \'function\') {
            const context = {
                grade: gradeKey,
                seriInfos: allSeriInfos,
                lineInput: currentLineInputForCalc,
                windSpeed: windSpeed,
                windDirection: windDirection,
                isGirls: settings.IS_GIRLS || false,
                BANK_DATA: selectedBank
            };
            return invokeShakkouDonperi(basePlayers, context).then(cosmosResult => {
                if (typeof completeShakkouCalculation === \'function\') {
                    completeShakkouCalculation(cosmosResult, gradeKey);
                }
                logMessage(\'[CALC END] 予想計算が完了し、結果が表示されました。\');
            });
        } else {
            logMessage(\'[CALC END] 予想計算が完了し、結果が表示されました。\');
        }

    } catch (error) {
        console.error("計算実行中にエラー:", error);
        logMessage(`[ERROR] 計算中断: ${error.message}`);
    }
}

// ====================================================================================
// displayResults
// ====================================================================================
function getStrengthColor(score, minScore, maxScore) {
    if (maxScore === minScore) return \'rgb(142, 142, 142)\';
    const n = (score - minScore) / (maxScore - minScore);
    const r = Math.round(52  + (231 - 52)  * n);
    const g = Math.round(152 + (76  - 152) * n);
    const b = Math.round(219 + (60  - 219) * n);
    return `rgb(${r}, ${g}, ${b})`;
}

function getTextColor(rgbColor) {
    const match = rgbColor.match(/\\d+/g);
    if (!match || match.length < 3) return \'#fff\';
    const luminance = (0.2126 * parseInt(match[0]) + 0.7152 * parseInt(match[1]) + 0.0722 * parseInt(match[2])) / 255;
    return luminance > 0.5 ? \'#333\' : \'#fff\';
}

function displayResults(detailedScenarioResults, seitenreiIntegratedScores, koutenreiIntegratedScores, bankName, allSeriInfos, finalOrderedPlayerIds, allScenarioResults, participatingPlayers, displayLineSegments, tenunIndexData) {
    displayBankTendency();

    const finalScores = Object.keys(seitenreiIntegratedScores).map(id => ({
        id: Number(id),
        score: seitenreiIntegratedScores[id] / 3
    }));

    const allScores = finalScores.map(p => p.score);
    const maxScore  = allScores.length > 0 ? Math.max(...allScores) : 0;
    const minScore  = allScores.length > 0 ? Math.min(...allScores) : 0;

    const playerIdToScore = {};
    finalScores.forEach(p => { playerIdToScore[p.id] = p.score; });

    // ライン強度グラデーション
    const lineDisplay = document.getElementById(\'line-display\');
    let displayHtml = \'\';

    displayLineSegments.forEach(segment => {
        if (segment.type === \'single\') {
            const score = playerIdToScore[segment.id];
            if (score === undefined) return;
            const rgb  = getStrengthColor(score, minScore, maxScore);
            const text = getTextColor(rgb);
            displayHtml += `<span class="line-box strength-color" style="background-color: ${rgb}; color: ${text};">${segment.id}</span>`;
        } else if (segment.type === \'seri\') {
            const scoreF = playerIdToScore[segment.follower];
            const scoreC = playerIdToScore[segment.contender];
            if (scoreF === undefined || scoreC === undefined) return;
            const rgbF = getStrengthColor(scoreF, minScore, maxScore); const textF = getTextColor(rgbF);
            const rgbC = getStrengthColor(scoreC, minScore, maxScore); const textC = getTextColor(rgbC);
            displayHtml += `<span class="seri-segment">(<span class="line-box strength-color" style="background-color: ${rgbF}; color: ${textF};">${segment.follower}</span><span class="seri-arrow">←</span><span class="line-box strength-color" style="background-color: ${rgbC}; color: ${textC};">${segment.contender}</span>)</span>`;
        }
    });

    if (lineDisplay) lineDisplay.innerHTML = displayHtml;

　　// 競りサマリー
    let seriSummaryHtml = \'\';
    if (allSeriInfos.length > 0) {
            seriSummaryHtml += `<div style="padding: 15px; margin-bottom: 15px; border: 4px dashed #f8b500; background: repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255, 255, 255, 0.05) 2px, rgba(255, 255, 255, 0.05) 3px), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.05) 2px, rgba(255, 255, 255, 0.05) 3px), #3a3a3a; border-radius: 6px; color: #ffffff; background-clip: padding-box;"><h4 style="color: #ffffff; margin-top: 0;">⚠️ 競り発生！</h4>`;        allSeriInfos.forEach((info, index) => {
            const prefix = (index === 0) ? \'最初の競りは、\' : \'<strong>さらに、</strong>\';
            seriSummaryHtml += `<p>${prefix}選手<strong>${info.follower}</strong> vs 選手<strong>${info.contender}</strong>。予測勝者は **選手${info.winner}** です。</p>`;
        });
        seriSummaryHtml += `<p style="font-size: 0.9em; color: #ffa726;">※体力消耗による減点補正が適用されています。</p></div>`;
    }

    // 天雲指数
    const tenunOutput = document.getElementById(\'tenun-index-output\');
    if (tenunOutput && tenunIndexData) tenunOutput.innerHTML = tenunIndexData.message;

    // 晴天令買い目
    const seitenreiBox  = document.getElementById(\'seitenrei-output\');
    const seitenreiBets = generateSeitenreiBets(tenunIndexData.rankingWithData);
    if (seitenreiBox && seitenreiBets) {
        let html = \'<h4>☀️ 晴天令</h4><strong>三連単</strong><ul>\';
        seitenreiBets.sanrentan.forEach(b => html += `<li>${formatOrderedBet(b)}</li>`);
        html += \'</ul><strong>三連複</strong><ul>\';
        seitenreiBets.sanrenpuku.forEach(b => html += `<li>${formatSanrenpuku(b)}</li>`);
        html += \'</ul>\';
        seitenreiBox.innerHTML = html;
    }

    // 荒天令買い目
    const koutenreiBox  = document.getElementById(\'koutenrei-output\');
    const koutenreiBets = generateKoutenreiBets(tenunIndexData.rankingWithData);
    if (koutenreiBox && koutenreiBets) {
        const L = koutenreiBets.targetL;
        let html = `<h4>⛈️ 荒天令</h4>`;
        if (L) html += `<p>特異点：${L.id}</p>`;
        html += `<strong>三連複</strong><ul>`;
        koutenreiBets.sanrenpuku.forEach(b => html += `<li>${formatSanrenpuku(b)}</li>`);
        html += `</ul><strong>二車単</strong><ul>`;
        koutenreiBets.nirentan.forEach(b => html += `<li>${formatOrderedBet(b)}</li>`);
        html += `</ul>`;
        koutenreiBox.innerHTML = html;
    }

    const scenarioOutput = document.getElementById(\'scenario-output\');
    if (scenarioOutput) {
        scenarioOutput.innerHTML = \'\'; // 毎回クリア
        if (seriSummaryHtml) {
            scenarioOutput.insertAdjacentHTML(\'afterbegin\', seriSummaryHtml);
        }
    }
　}

// ====================================================================================
// 買い目生成ユーティリティ
// ====================================================================================
function formatOrderedBet(bet)  { return bet.join(\'-\'); }
function formatSanrenpuku(bet)  { return bet.slice().sort((a, b) => a - b).join(\'=\'); }

function generateSeitenreiBets(ranking) {
    if (!ranking || ranking.length < 3) return null;
    const r = ranking.map(p => p.id);
    return {
        sanrentan: [
            [r[0], r[1], r[2]],
            [r[0], r[2], r[1]],
            [r[1], r[0], r[2]],
            [r[1], r[2], r[0]]
        ],
        sanrenpuku: [[r[0], r[1], r[2]]]
    };
}

function generateKoutenreiBets(ranking) {
    if (!ranking || ranking.length < 4) return null;
    const A = ranking[0], B = ranking[1], C = ranking[2];
    const lCandidates = ranking.slice(3).map(p => {
        let s = p.final_score / 10;
        if (p.is_b1) s += 10;
        if (p.is_s1) s += 5;
        if (p.style === \'追\' || p.style === \'両\') s += 3;
        return { ...p, lScore: s };
    });
    lCandidates.sort((a, b) => b.lScore - a.lScore);
    const targetL = lCandidates[0];
    return {
        targetL,
        sanrenpuku: [[A.id, B.id, targetL.id], [A.id, C.id, targetL.id]],
        nirentan:   [[A.id, targetL.id], [targetL.id, A.id], [C.id, A.id]]
    };
}

// UIイベント設定
document.querySelectorAll(\'select\').forEach(select => {
    select.addEventListener(\'change\', () => {
        select.blur();
        window.scrollBy(0, 1);
        window.scrollBy(0, -1);
    });
});
})(App);