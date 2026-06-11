(function(app) {

// 真自在律 Ver10.22
// LOGIC VERSION: 10.22
// 【V10.22】displayResults()にwindSpeed/windDirection引数を追加し、relationsデータをreturnに追加。
// 【V10.21】荒天令A/B/C順序バグ修正: seitenSelectedIds を sanrenpuku[0](車番ソート)→sanrentan[0](スコア順)に変更。
// 【V10.20】generateSeitenreiBets() を selectR2() 分離構造に刷新。展開パターンはr2選出基準のみに影響。
//           買い目形式は r0-r1-r2/r0-r2-r1/r1-r0-r2/r1-r2-r0 の4点固定。excludeL でL被り防止。
// 【V10.19】generateSeitenreiBets() r配列を ranking.slice(0, 3).map(p => p.id) でtop3に封鎖。
// 【V10.18】generateKoutenreiBets() L候補除外を new Set([A.id, B.id, C.id, ...seitenTop3Ids]) で一元管理。
// 【V10.17】C-1: TENKAI_MODE_ENABLED typeof除去 / C-2: console.log→app.logMessage / C-4: ADJACENT_MAP モジュールスコープ化。
// 【V10.16】classifyTenkai()追加・generateSeitenreiBets()を展開パターン分岐買い目生成に刷新。
// 【V10.15】sendLogのsnapshot.scores.baseに c_e / c_local / physicalPenalty / warpBoost / cantoMakuriPenalty を追加。
// 【V10.14】捲り選手(style='自')のkeirin_biasキー参照を'先行'→'捲り'に修正（実装漏れ解消）。
//           42場中28場で捲りbiasが1.0以外に設定されており未適用だった。
// 【V10.13】InputGuard 方針A実装：collectAndValidate()の浄化済みデータをcalculatePrediction()に接続。
//           getModeSelector()追加、ラッパーにresult.data受け渡し、calculatePrediction引数化。
//           getStyle() JSDocの残存"両"を"逃"に修正。
// 【V10.12】LOCAL_BONUSをforEachループ内からグローバル定数セクションに移動。
// 【V10.11】getPlayerData()（死にコード）を削除。calculatePrediction()と重複かつ劣化版。
// 【V10.10】壱耀晴乾ノ象の死にコードブロックを削除。
//           SUPERIORITY_THRESHOLD_RATE / RAW_COMPOSITE_STATS /
//           calculateSuperiorityList() / SUPERIOR_PATTERNS_FINAL_LIST の4変数。
//           実動ロジックはcalculateTenunIndex()等にハードコード済みのため影響なし。
// 【V10.9】'両'を全18箇所から削除・置換。cantoMakuriPenalty/C_timing/tenkaiStyleMap捲りを
//           '自'（捲り）に修正し、UIと内部値を完全一致させた。
// 【V10.8】地元補正（c_local）を本計算に接続。LOCAL_BONUS=1.03固定・脚質差なし。
//           getLocalSwitch()・localSwitch変数を削除（地元スイッチ廃止）。
// 【V10.7】展開モード判定を4分岐→3分岐に整理
//           捲り上限撤廃（>= 5のみ）、中モード廃止・差しデフォルト統合。
// 【V10.6】展開補正：逃げタイプ0人時にlines[0][0]を実質逃げ役として使用
//           脚質入力に依存せず並び予想の物理的先頭を展開判定に適用。
// 【V10.5】generateSeitenreiBets r2選出窓を3〜5位に限定（スコア権威を尊重）
//           rest.slice(0,3) で style/wmark フィルターの到達範囲を制限。
//           seriLoserIds 引数は不要（ranking が既に補正済みスコア順のため）。
// 【V10.4】特異点L選出を荒天令スコア基準に刷新（案Z実装）
//           koutenRankingWithDataを第4引数として受け取り、
//           ①荒天令上位×ラインTOP → ②荒天令上位先頭 → ③フォールバック の優先順で選出。
// 【V10.3】generateKoutenreiBets のA/B/Cを晴天令選出r[0]/r[1]/r[2]に統一
//           seitenreiBets.sanrenpuku[0] からIDを取り出しランキングを組み替えて渡す。
//           荒天令買い目への晴天令外選手混入バグを修正。
// 【V10.2】審眼八卦ON時 sendLog スキップ
//           SNGN スイッチが1つでもONなら App.sendLog をスキップしてログ出力。
// 【V10.1】generateSeitenreiBets r[2]選出ロジック変更
//           追×(△か◎) → 追 → スコア3位 の優先順で選出。r[0]/r[1]除外処理付き。
// 【V10.0】展開モード補正 + 特異点選出ロジック修正
//           - 展開モード自動判定（逃/差/捲/中）：得点差から脚質有利を動的決定。
//           - tenkaiBonus を final_score に後乗せ（×1.15/×1.10）。
//           - 特異点（L）選出をラインTOP優先ロジックに刷新、フォールバック付き。
//           - displayResults / generateKoutenreiBets に lines を引き渡す経路を整備。
// 【V9.8】keirin_logic.js コメント整備
//          - 全係数・計算式に説明コメント追加。脚質バイアスキー対応表、c_recent式の意味を明記。
// 【V9.7】審眼八卦（SNGN）実装 ＆ c_l係数調整
//          - 審眼八卦：ユーザー選択係数への後乗せ補正レイヤー（×1.05）を追加。
//          - c_l係数：先頭 0.03→0.05、2番手 0.05→0.04（番手過大評価を解消）。
// 【V9.6】kururu通常ログ1回化 ＆ 赤口silentフラグ対応
//          - getKururuAdjustment に silent フラグ追加、赤口1465ループを無音化。
//          - kururuLogged フラグで通常予想のログを1回に抑制。
// 【V9.5】CalculationSnapshot.lines 追加
//          - sendLog ペイロードにライン構成データを含めるよう拡張。
// 【V9.4】デバッグログコピーボタン ＆ 予想コピー拡張
//          - デバッグログに📋コピーボタンを追加。
//          - 予想コピーに天雲指数・レース番号（小倉3R形式）を追加。
// 【V9.3】C_l非メインライン3番手ボーナス廃止
//          各ラインの競走得点合計を算出しメインラインを特定。
//          メインライン3番手のみC_l=1.03を維持、それ以外は1.00に変更。
//          非メインライン3番手の過大評価を解消しランキング精度向上を図る。
// 【V9.2】赤口呑縁独立起動統合
//          runScenarioSimulation を本来のロジックに完全復元。
//          赤口呑縁関係の諸々不具合修正（invokeShakkouDonperi直接呼び出し・展開別表示削除）。
// 【V9.1】赤口呑縁（シャッコウ・ドンペリ）導入 - 1465世界線並列シミュレーション実装。
// 【V9.0】物理層最優先実装 - バンクデータに基づく「非情な物理演算」
//          - straight（みなし直線）による生存判定：35m未満で4番手以降を大幅減点。
//          - canto（カント）による捲りエネルギー消費：32度超で捲りコスト×1.5。
//          - イン突き（ワープ）実装：番手ブロック時の内線選手ブースト×1.35。
//          - 計算順序: 物理層 → 展開層 → 事象層（kururu風圧・壱耀占術）。
// 【V8.1】枢・天命連動（壱耀改修）
//          実効風速 v を判定ロジックへ完全バトンパス。
//          「壱耀晴乾ノ象」を純粋なる「差し（追）」限定へ聖域化。
//          物理層（風速）と占術層（天運指数）の因果関係を統合。
//          構文不整合の排除、およびデータフローの単一化。
// 【V8.0】動的風圧遮蔽(kururu)実装 ＆ 自滅消耗(C_suicide)・漁夫の利ブースト統合
//          - 360度全風向ベクトル分解によるライン番手別スタミナ損耗率の算出。
//          - 激突ライン共倒れ予測による「展開的必然」の穴抽出ロジック完遂。
// 【V7.4】壱耀メッセージ追加 ＆ 買い目変更。
// 【V7.3】消耗ペナルティ適用拡大 ＆ 複数競り表示修正。
// ------------------------------------------------------------------------------------

app.LOGIC_VERSION = '10.16';

// R_BIAS       : 競走得点の影響度スケール（S級は得点差が直結、チャレンジは薄める）
// RECENT_WEIGHT: 近況着順の重み（チャレンジは調子ムラが大きいので上げる）
// COOP_WEIGHT  : ライン結束力係数のスケール（S級は連携が機能しやすい）
// SUICIDE_LIMIT: C_suicide発動時の最大減点下限（ガールズは共倒れリスクを考慮しない）
const COEFFICIENT_SETTINGS = {
    's-kyu':  { R_BIAS: 1.15, RECENT_WEIGHT: 0.90, COOP_WEIGHT: 1.20, IS_GIRLS: false, SUICIDE_LIMIT: 0.97 },
    'a-kyu':  { R_BIAS: 1.00, RECENT_WEIGHT: 1.00, COOP_WEIGHT: 1.00, IS_GIRLS: false, SUICIDE_LIMIT: 0.93 },
    'a-chal': { R_BIAS: 0.90, RECENT_WEIGHT: 1.20, COOP_WEIGHT: 0.80, IS_GIRLS: false, SUICIDE_LIMIT: 0.90 },
    'girls':  { R_BIAS: 1.00, RECENT_WEIGHT: 1.10, COOP_WEIGHT: 1.00, IS_GIRLS: true,  SUICIDE_LIMIT: 1.00 },
};

// ガールズ競輪専用：先頭選手のエースマーク（◎〇）が番手へ与える恩恵係数
const C_MARK_VALUES = {
    HIGH:   1.12,  // ◎ エース → 番手に最大恩恵
    MEDIUM: 1.08,  // 〇
    LOW:    1.03   // マークなし
};

// 競り予測の脚質別有利係数。逃・追は競り上等、自在は消耗を嫌う傾向から設定
const SERI_STYLE_BONUS = {
    '逃': 1.08,
    '追': 1.05,
    '自': 0.95
};

// 競り消耗率：実戦経験則に基づく設計
// 勝者(IN)：消耗はあるが前に出られる → 15%減 + 5%ボーナスで実質10%減
// 敗者(OUT)：競り負けてほぼ脚が終わる → 25%減（「ほぼ死ぬ」状態）
const SERI_FATIGUE_PENALTY_IN  = 0.15;
const SERI_FATIGUE_PENALTY_OUT = 0.25;
const SERI_WIN_BONUS           = 0.05;
const LOCAL_BONUS              = 1.03;

// --- 外れ解剖：係数スナップショット領域 ---
let CalculationSnapshot = {};

function resetSnapshot() {
  CalculationSnapshot = {
    race_id: "",
    bank: { straight: 0, canto: 0, alpha: 0, beta: 0, keirin_bias: {} },
    line_coop: {},
    tactical: { warpBoost: {}, cantoPenalty: 1.0, cantoMakuriPenalty: {} },
    wind_physics: { finalAdj: {}, v: 0 },
    physical: { physicalPenalty: {} },
    seri: { seri_coef: {}, seri_bonuses: [], seri_info: [] },
    event_flags: { suicide_detected: false, suicide_targets: [] },
    scores: { base: {}, final: {} }
  };
}
resetSnapshot();

app.getCurrentCoefficients = () => JSON.parse(JSON.stringify(CalculationSnapshot));
app.resetSnapshot = resetSnapshot;
app.setRaceId = function(id) { app.logMessage(`[DEBUG setRaceId] 受信id: ${id} / 変更前: ${CalculationSnapshot.race_id}`); CalculationSnapshot.race_id = id; app.logMessage(`[DEBUG setRaceId] 変更後 CalculationSnapshot.race_id: ${CalculationSnapshot.race_id}`); };
app.applyPhysicalPenalty    = applyPhysicalPenalty;
app.applyTacticalAdjustments = applyTacticalAdjustments;
app.getKururuAdjustment     = getKururuAdjustment;
app.applySeriCorrection     = applySeriCorrection;
// ------------------------------------------

let BANK_DATA = {};

// ====================================================================================
// kururu（風圧補正）
// ====================================================================================
let kururuLogged = false;
const ADJACENT_MAP = {
    "北東": ["北", "東"], "南東": ["南", "東"],
    "南西": ["南", "西"], "北西": ["北", "西"],
    "北":   ["北西", "北東"], "東": ["北東", "南東"],
    "南":   ["南東", "南西"], "西": ["南西", "北西"]
};
function getKururuAdjustment(p, direction, speed, isGirls, lineInput, BANK_DATA, silent = false) {
    const playerId = p.id;

    if (!direction || speed === undefined || speed <= 1.0 || direction === 'none' || direction === '無風') {
        return { adj: 1.0, v: 0 };
    }

    const beta = (BANK_DATA && BANK_DATA.beta) ? BANK_DATA.beta : 1.0;
    const v = speed * beta;
    const selectedDir = direction;

    if (!silent && !kururuLogged) {
        app.logMessage(`[kururu] 選手${playerId}: 方角[${selectedDir}] 風速[${speed}m] → 実効[${v.toFixed(2)}m](β:${beta})`);
        kururuLogged = true;
    }

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
                    if (pos === 0)      { positionShield = 1.00; posLabel = "先行"; }
                    else if (pos === 1) { positionShield = 0.65; posLabel = "番手"; }
                    else               { positionShield = 0.50; posLabel = "3番手以降"; }
                    break;
                }
            }
        }
    }

    if (!silent && !kururuLogged) app.logMessage(`[kururu] 選手${playerId}: 方角[${selectedDir}] 位置[${posLabel}] -> 風補正実行`);

    const map = BANK_DATA.wind_direction_map || {};

    function dirToVector(dirType) {
        let vec = 0.0;
        if (dirType.includes("追い"))   vec += 1.0;
        if (dirType.includes("向かい")) vec -= 1.0;
        if (dirType === "H→B横風")     vec += 0.2;
        if (dirType === "B→H横風")     vec -= 0.2;
        return vec;
    }

    let vector = 0.0;

    if (map[selectedDir]) {
        vector = dirToVector(map[selectedDir]);
    } else if (ADJACENT_MAP[selectedDir]) {
        const [adj1, adj2] = ADJACENT_MAP[selectedDir];
        const v1 = map[adj1] ? dirToVector(map[adj1]) : 0.0;
        const v2 = map[adj2] ? dirToVector(map[adj2]) : 0.0;
        vector = (v1 + v2) * 0.707;
    }

    const finalAdj = 1.0 + (vector * kp * (BANK_DATA.alpha || 1.0) * positionShield);

    if (!silent && !kururuLogged) app.logMessage(`[kururu] 選手${playerId}: 方角[${selectedDir}] 属性[斜め補正済み] 位置[${posLabel}] -> 風補正実行`);

    CalculationSnapshot.wind_physics = { finalAdj: finalAdj, v: v };
    return { adj: finalAdj, v: v };
}
// ====================================================================================

function getPlayerPositions(lines) {
    const positionMap = {};
    let globalPosition = 1;

    lines.forEach(line => {
        line.forEach((id, localPos) => {
            let label = '後方';
            if (localPos === 0)      label = '先行';
            else if (localPos === 1) label = '番手';
            else if (localPos === 2) label = '3番手';

            positionMap[id] = {
                position: globalPosition,
                label: label,
                linePosition: localPos  // ライン内相対位置
            };
            globalPosition++;
        });
    });

    return positionMap;
}

// ====================================================================================
// 物理層：直線長ペナルティ（V9.0）
// ====================================================================================
function applyPhysicalPenalty(players, bankData, lines) {
    const straight = (bankData && bankData.straight_deviation != null)
        ? bankData.straight_deviation
        : (bankData && bankData.straight) || 50;

    const positionMap = getPlayerPositions(lines);

    players.forEach(p => {
        const pos = positionMap[p.id] ? positionMap[p.id].position : 1;

        if (pos < 4) {
            p.physicalPenalty = 1.0;
            return;
        }

        const depth = pos - 4;

        if (straight < 35) {
            p.physicalPenalty = Math.max(0.70, 0.80 - depth * 0.033);
        } else if (straight < 50) {
            p.physicalPenalty = Math.max(0.87, 0.93 - depth * 0.02);
        } else {
            p.physicalPenalty = 1.0;
        }
        CalculationSnapshot.physical.physicalPenalty[p.id] = p.physicalPenalty;
    });
}

// ====================================================================================
// 展開層：カント・イン突き（V9.0）
// ====================================================================================
function applyTacticalAdjustments(players, bankData, lines, seriInfos) {
    const canto = bankData.canto || 30;
    const positionMap = getPlayerPositions(lines);

    const cantoThreshold = 32;
    const makuriPenalty = (canto > cantoThreshold) ? 1.25 : 1.0;

    if (canto > cantoThreshold) {
        app.logMessage(`[展開層] カント${canto}度 > ${cantoThreshold}度 → 捲り補正×1.25`);
    }

    const warpBoostTargets = [];

    if (seriInfos && seriInfos.length > 0) {
        seriInfos.forEach(seri => {
            const winnerPos = positionMap[seri.winner];
            if (winnerPos && winnerPos.position === 2) {
                app.logMessage(`[展開層] 番手選手${seri.winner}が競り勝利 → イン突き（ワープ）発動`);
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
        p.cantoMakuriPenalty = (p.style === '自') ? makuriPenalty : 1.0;
        CalculationSnapshot.tactical.cantoMakuriPenalty[p.id] = p.cantoMakuriPenalty;

        if (warpBoostTargets.includes(p.id)) {
            // イン突き（ワープ）ブースト ×1.35
            // 番手が競りを制しインを突いた際、外の選手を一気に抜き去る経験則的優位
            // 約35%のアドバンテージは実戦上の「イン突きはそういうもの」に準拠
            p.warpBoost = 1.35;
            app.logMessage(`[展開層] 選手${p.id}: イン突き（ワープ）ブースト ×1.35`);
        } else {
            p.warpBoost = 1.0;
        }
        CalculationSnapshot.tactical.warpBoost[p.id] = p.warpBoost;
    });

    return players;
}


// ====================================================================================
// ロギング
// ====================================================================================
let _logScrollTimer = null;
app.logMessage = function(message) {
    const logArea = document.getElementById('debug-log');
    if (!logArea) return;
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    logArea.insertAdjacentHTML('beforeend', `[${timestamp}] ${message}<br>`);
    if (_logScrollTimer) clearTimeout(_logScrollTimer);
    _logScrollTimer = setTimeout(() => { logArea.scrollTop = logArea.scrollHeight; }, 50);
}

// ====================================================================================

// ====================================================================================
// loadBANK_DATA
// ====================================================================================
async function loadBANK_DATA() {
    try {
        app.logMessage("[INIT] bankdata.jsonの読み込みを開始します...");
        const response = await fetch('./bankdata.json');
        if (!response.ok) throw new Error(`HTTP status ${response.status}`);

        BANK_DATA = await response.json();
        app.logMessage(`[SUCCESS] bankdata.jsonを正常に読み込みました。 ${Object.keys(BANK_DATA).length}件のバンクデータをロード。`);

        const bankSelect = document.getElementById('bank-name');
        if (bankSelect) {
            bankSelect.innerHTML = '';
            Object.keys(BANK_DATA).forEach(bankName => {
                const option = document.createElement('option');
                option.value = bankName;
                option.textContent = bankName;
                bankSelect.appendChild(option);
            });
            app.logMessage("[UI] バンク名の選択肢を動的に構築しました。");
            displayBankTendency();
        }
    } catch (error) {
        app.logMessage(`[FATAL ERROR] データ読み込み処理中に重大なエラーが発生: ${error.message}`);
        BANK_DATA = { 'ダミーバンク': { length: 400, keirin_bias: { '先行': 1.0, '捲り': 1.0, '差し': 1.0 }, wind_or_position: {} } };
        const bankSelect = document.getElementById('bank-name');
        if (bankSelect) bankSelect.innerHTML = '<option value="ダミーバンク">データ読み込み失敗</option>';
    }
}

// ====================================================================================
// displayBankTendency
// ====================================================================================
function displayBankTendency() {
    const bankName  = document.getElementById('bank-name').value;
    const displayArea = document.getElementById('bank-tendency-display');

    if (!bankName || !BANK_DATA[bankName] || !displayArea) {
        if (displayArea) displayArea.innerHTML = '';
        return;
    }

    const bankInfo = BANK_DATA[bankName];
    const bias = bankInfo.keirin_bias;
    const biasMap = {
        '先行': bias['先行'] || 1.0,
        '捲り': bias['捲り'] || 1.0,
        '差し': bias['差し'] || 1.0
    };

    let maxBias = -Infinity;
    let strongestTendency = '';
    const styleMap = { '先行': '逃先', '捲り': '捲り', '差し': '差マ' };

    Object.keys(biasMap).forEach(key => {
        if (biasMap[key] > maxBias) { maxBias = biasMap[key]; strongestTendency = key; }
    });

    let message = '';
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
    app.logMessage(`[BANK] ${bankName} の展開傾向: ${message.replace(/<[^>]*>?/gm, '')}`);
}

(async function() { await loadBANK_DATA(); })();

// ====================================================================================
// parseLineInput
// ====================================================================================
function parseLineInput(lineInput, allPlayers) {
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
                const seriEnd   = seriStart + seriMatch[0].length;

                if (seriStart > 0) {
                    const numericalPart = remainingSeg.substring(0, seriStart);
                    numericalPart.split('').map(Number).filter(id => id > 0).forEach(id => {
                        if (!allParsedIds.has(id)) { segOrderedIds.push(id); allParsedIds.add(id); }
                        displayLineSegments.push({ type: 'single', id });
                        currentLine.push(id);
                    });
                }

                const follower  = parseInt(seriMatch[1]);
                const contender = parseInt(seriMatch[2]);

                app.logMessage(`[PARSE] 競り検出: 選手${follower} (イン) vs 選手${contender} (アウト)`);

                const followerCoef  = allPlayers.find(p => p.id === follower)?.seri_coef  || 0;
                const contenderCoef = allPlayers.find(p => p.id === contender)?.seri_coef || 0;

                let winnerId, loserId;
                if (followerCoef >= contenderCoef) { winnerId = follower;  loserId = contender; }
                else                               { winnerId = contender; loserId = follower;  }

                allSeriInfos.push({ exists: true, follower, contender, winner: winnerId, loser: loserId });
                CalculationSnapshot.seri.seri_info = allSeriInfos;
                app.logMessage(`[PARSE] 競り勝者予測: 選手${winnerId} (C_seriに基づき予測)`);

                currentLine.push(winnerId);
                lines.push([loserId]);

                if (!allParsedIds.has(follower))  { segOrderedIds.push(follower);  allParsedIds.add(follower);  }
                if (!allParsedIds.has(contender)) { segOrderedIds.push(contender); allParsedIds.add(contender); }

                displayLineSegments.push({ type: 'seri', follower, contender });
                remainingSeg = remainingSeg.substring(seriEnd);

            } else {
                remainingSeg.split('').map(Number).filter(id => id > 0).forEach(id => {
                    if (!allParsedIds.has(id)) { segOrderedIds.push(id); allParsedIds.add(id); }
                    displayLineSegments.push({ type: 'single', id });
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
// calculateLineCoeffs  ★ C_L改修版
// ====================================================================================
function calculateLineCoeffs(players, settings) {

    // 1. 欠場除外
    const participatingPlayers = players.filter(p => !p.is_scratch);
    app.logMessage(`[SCRATCH] 欠場選手を除外しました。出走選手数: ${participatingPlayers.length}`);

    if (participatingPlayers.length === 0) {
        app.logMessage("[ERROR] 出走選手がゼロのため、ライン解析をスキップします。");
        return { players: [], allSeriInfos: [], finalOrderedPlayerIds: [], displayLineSegments: [], lines: [] };
    }

    // 2. ライン解析
    const lineInput = document.getElementById('line-input').value;
    app.logMessage(`[PARSE] ライン入力解析: ${lineInput}`);
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
            displayLineSegments.push({ type: 'single', id: p.id });
        }
        if (!allRidersInLines.has(p.id)) lines.push([p.id]);
    });
    app.logMessage(`[ORDER] 最終表示順序に欠落選手を補完しました。`);

    // 3. C_L（ライン結束力係数）計算 ★改修ロジック
    const coop = settings.COOP_WEIGHT || 1.0;
    const seriLoserIds = new Set(parsedAllSeriInfos.map(s => s.loser));

    if (settings.IS_GIRLS) {
        app.logMessage(`[C_L] ガールズ競輪モード: エースマーク係数適用`);
        lines.forEach(line => {
            if (line.length < 2) return;
            const leader = participatingPlayers.find(p => p.id === line[0]);
            for (let i = 1; i < line.length; i++) {
                const p = participatingPlayers.find(pp => pp.id === line[i]);
                if (!p || seriLoserIds.has(p.id)) continue;
                let markVal = C_MARK_VALUES.LOW;
                if (leader && leader.wmark === '◎')      markVal = C_MARK_VALUES.HIGH;
                else if (leader && leader.wmark === '〇') markVal = C_MARK_VALUES.MEDIUM;
                p.c_l = (i === 1) ? markVal : 1.0 + (markVal - 1.0) * 0.5;
                CalculationSnapshot.line_coop[p.id] = p.c_l;
                app.logMessage(`[C_L] 選手ID ${p.id}: ガールズC_L=${p.c_l.toFixed(3)}`);
            }
        });
    } else {
        app.logMessage(`[C_L] 一般競輪モード: COOP_WEIGHT=${coop}`);

        // ① 各ラインの競走得点合計を算出
        const lineScores = lines.map(line => {
            const score = line.reduce((total, playerId) => {
                const player = participatingPlayers.find(p => p.id === playerId);
                return total + (player ? player.score : 0);
            }, 0);
            return { line, score };
        });

        // ② メインラインを特定
        let mainLine = [];
        if (lineScores.length > 0) {
            const mainLineData = lineScores.reduce((max, current) => (current.score > max.score) ? current : max);
            mainLine = mainLineData.line;
            app.logMessage(`[C_L] メインライン特定: ${mainLine.join('-')} (得点合計: ${mainLineData.score.toFixed(2)})`);
        }

        // ③ C_l の適用
        lines.forEach(line => {
            if (line.length < 2) return;
            for (let i = 0; i < line.length; i++) {
                const p = participatingPlayers.find(pp => pp.id === line[i]);
                if (!p || seriLoserIds.has(p.id)) continue;

                if (i === 0) { // 1番手
                    p.c_l = 1.0 + coop * 0.05;
                    app.logMessage(`[C_L] 選手ID ${p.id}: 先頭 C_L=${p.c_l.toFixed(3)}`);
                } else if (i === 1) { // 2番手
                    const leaderP = participatingPlayers.find(pp => pp.id === line[0]);
                    const diff = leaderP ? leaderP.score - p.score : 0;
                    const diffFactor = diff >= 10 ? 0.3 : diff >= 5 ? 0.6 : diff >= 0 ? 1.0 : 1.3;
                    p.c_l = 1.0 + coop * 0.04 * diffFactor;
                    app.logMessage(`[C_L] 選手ID ${p.id}: 2番手 diff=${diff.toFixed(2)} diffFactor=${diffFactor} C_L=${p.c_l.toFixed(3)}`);
                } else if (i === 2) { // 3番手（メインライン問わず無補正）
                    p.c_l = 1.00;
                    app.logMessage(`[C_L] 選手ID ${p.id}: 3番手 C_L=1.00`);
                } else { // 4番手以降
                    p.c_l = 1.00;
                }
                CalculationSnapshot.line_coop[p.id] = p.c_l;
            }
        });
    }

    return { players: participatingPlayers, allSeriInfos: parsedAllSeriInfos, finalOrderedPlayerIds, displayLineSegments, lines };
}


// ====================================================================================
// applySeriCorrection
// ====================================================================================
function applySeriCorrection(scoredPlayers, allSeriInfos, silent) {
    if (allSeriInfos.length === 0) {
        if (!silent) app.logMessage("[SERI] 競り入力がないため、競り補正はスキップします。");
        return scoredPlayers;
    }
    if (!silent) app.logMessage(`[SERI] 競り補正処理（${allSeriInfos.length}件）を開始します。`);

    allSeriInfos.forEach(seriInfo => {
        const winner = scoredPlayers.find(p => p.id === seriInfo.winner);
        if (winner) {
            winner.final_score = winner.final_score * (1 + SERI_WIN_BONUS) * (1 - SERI_FATIGUE_PENALTY_IN);
            if (!silent) app.logMessage(`[SERI] 競り勝者 選手${winner.id}: スコア微増/体力減点補正が適用されました。`);
        }
        const loser = scoredPlayers.find(p => p.id === seriInfo.loser);
        if (loser) {
            loser.final_score *= (1 - SERI_FATIGUE_PENALTY_OUT);
            if (!silent) app.logMessage(`[SERI] 競り敗者 選手${loser.id}: スコア大幅減点補正が適用されました。`);
        }
    });

    if (!silent) {
        scoredPlayers.forEach(p => {
            app.logMessage(`[SERI] 選手ID ${p.id}: 競り処理後のスコアは ${p.final_score.toFixed(3)} になりました。`);
        });
    }

    return scoredPlayers;
}

// ====================================================================================
// getScenarioCoeffs
// ====================================================================================
function getScenarioCoeffs(scenario) {
    if (scenario === '先行有利') return { '自': 1.05, '追': 1.02 };
    if (scenario === '捲り有利') return { '自': 1.00, '追': 1.05 };
    if (scenario === '差し有利') return { '自': 0.90, '追': 1.08 };
    return { '自': 1.0, '追': 1.0 };
}

// ====================================================================================
// generateScenarioWagers
// ====================================================================================
function generateScenarioWagers(results, v) {
    if (!results || results.length < 3) return { tritan: '---', trifuku: '---', ichiyo: "" };

    const r = results.map(p => p.id);
    let superiorPatternMessage = "";

    const tenunText  = document.getElementById('tenun-index-output')?.innerText || "";
    const isTenunZero = tenunText.includes("指数: 0") || tenunText.includes("大安吉日");

 if (isTenunZero && v <= 3.0) {
    const top4 = results.slice(0, 4);
    const trueIchiyo = top4.find(p => p.style === '追');
    if (trueIchiyo) {
        superiorPatternMessage = `【壱耀晴乾ノ象】天命、${trueIchiyo.id}番車に収束。`;
    }
}

    const tritan = [
        `${r[0]}-${r[1]}-${r[2]}`,
        `${r[0]}-${r[2]}-${r[1]}`,
        `${r[1]}-${r[0]}-${r[2]}`
    ].join(', ');

    const tri1 = [r[0], r[1], r[2]].sort((a, b) => a - b).join('=');
    let tri2 = (r.length >= 4) ? [r[0], r[1], r[3]].sort((a, b) => a - b).join('=') : '';
    const trifuku = [tri1, tri2].filter(t => t.length > 0).join(', ');

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
        p.strength_mark = '→';
        if (index === scenarioPlayers.length - 1) return;
        const nextPlayer = scenarioPlayers[index + 1];
        if (p.grade === nextPlayer.grade) {
            const scoreDiff = p.final_score - nextPlayer.final_score;
            if (scoreDiff >= (range / 1000) * 1)   p.strength_mark = '↑';
            else if (scoreDiff >= (range / 1000) * 0.1) p.strength_mark = '↗';
            else                                        p.strength_mark = '→';
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

    const lineInput = document.getElementById('line-input').value;
    const { lines: initialLines } = parseLineInput(lineInput, tempPlayers);

    const lines = [];
    const allRidersInLines = new Set();
    initialLines.forEach(line => { lines.push(line); line.forEach(id => allRidersInLines.add(id)); });
    tempPlayers.forEach(p => { if (!allRidersInLines.has(p.id)) lines.push([p.id]); });

    tempPlayers.forEach(p => {

        // 2. C_risk：得点が平均を大きく下回りかつ近況も低調な選手を減点
        const avgScore  = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        const recentAvg = p.recent.split('').map(Number).reduce((a, b) => a + b, 0) / p.recent.length || 4.0;
        if (p.score < avgScore - 2.0 && recentAvg >= 4.0) {
            p.final_score *= 0.97;
            appliedCoeffs.push('C_risk');
        }

        // 3. C_mental：S級または得点最高選手が直近1着続きの場合、プレッシャーで風に弱くなる
        const raceGrade = document.getElementById('race-type').value;
        const participatingMaxScore = Math.max(...tempPlayers.map(pp => pp.score));
        const isHighPressure = ['s-kyu'].includes(raceGrade) || (p.score === participatingMaxScore);
        if (isHighPressure && p.recent.startsWith('1')) {
            const mentalAdj = 1.0 - (v * 0.005);
            p.final_score *= mentalAdj;
            appliedCoeffs.push('C_mental');
        }

        // 4. C_recovery：差し・捲り系の上位スコア選手は乱戦で伸びしろがある
        if (p.style === '追') {
            const scoreDiffRatio = (p.score - scoreMin) / scoreRange;
            if (scoreDiffRatio > 0.6) {
                const recoveryFactor = 1.04 + (scoreDiffRatio - 0.6) * 0.1;
                p.final_score *= recoveryFactor;
                appliedCoeffs.push('C_recovery');
            }
        }
    });

    // 5. C_target：最高得点選手は他ラインにマークされやすく、強風時ほど崩れやすい
    const targetPlayer = tempPlayers.find(pp => pp.score === scoreMax);
    if (targetPlayer) {
        let rivalAutos = 0;
        tempPlayers.forEach(pp => { if (pp.id !== targetPlayer.id && (pp.style === '逃' || pp.style === '自')) rivalAutos++; });
        if (rivalAutos >= 2) {
            const targetAdj = 1.0 - (v * 0.007);
            targetPlayer.final_score *= targetAdj;
            appliedCoeffs.push('C_target');
        }
    }

    // 6. C_split：ライン内で先頭と2番手の得点差が大きいほど番手が連れ込めない
    lines.forEach(line => {
        const p1 = tempPlayers.find(pp => pp.id === line[0]);
        const p2 = tempPlayers.find(pp => pp.id === line[1]);
        if (p1 && p2) {
            const relativeDiff = (p1.score - p2.score) / scoreRange;
            if (relativeDiff >= 0.30) {
                const penalty = 1.0 - (relativeDiff - 0.30) * 0.15;
                p2.final_score *= penalty;
                appliedCoeffs.push('C_split');
            }
        }
    });

    // 7. C_pace：超高得点の逃げ選手は競合他ラインに追いつかれやすい
    const leaderPlayer = tempPlayers.find(pp => pp.style === '逃' || pp.style === '自');
    if (leaderPlayer && leaderPlayer.score >= 105.0 && lines.length - 1 >= 2) {
        leaderPlayer.final_score *= 0.96;
        appliedCoeffs.push('C_pace');
    }

    // 8. C_timing：捲り系が番手に入ると仕掛けどころを失いやすい
    tempPlayers.forEach(pp => {
        if (pp.style === '自') {
            const line = lines.find(l => l.includes(pp.id));
            if (line && line.indexOf(pp.id) >= 1) {
                pp.final_score *= 0.97;
                appliedCoeffs.push('C_timing');
            }
        }
    });

    // 9. C_guard：番手選手が低得点＋周囲に先行型が多いと連れ込みが怪しくなる
    lines.forEach(line => {
        const p2 = tempPlayers.find(pp => pp.id === line[1]);
        if (p2) {
            const lowScoreThreshold = scoreMin + scoreRange * 0.4;
            let baseRisk = 1.0;
            if (p2.score < lowScoreThreshold) baseRisk = 0.95;
            const attackers = tempPlayers.filter(pp => pp.id !== p2.id && (pp.style === '逃' || pp.style === '自')).length;
            if (attackers >= 2) baseRisk *= 0.95;
            p2.final_score *= baseRisk;
            appliedCoeffs.push('C_guard');
        }
    });

    // 10. C_suicide
    const raceGradeForSuicide = document.getElementById('race-type').value;
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
                if (['◎', '〇', '△'].includes(player.wmark)) totalWeightScore += 1;
                if (player.style === '逃' || player.style === '自') hasSelfStarter = true;
            }
        });

        lineEvaluations[index] = { lineLength, totalWeightScore, hasSelfStarter, lineMembers: line };
    });

    Object.keys(lineEvaluations).forEach(lineIndex => {
        const ev = lineEvaluations[lineIndex];
        if (ev.lineLength >= 3 && ev.totalWeightScore === 3 && ev.hasSelfStarter) {
            app.logMessage(`[C_suicide] 🔴 リスク極大ライン検出！ (ライン${ev.lineMembers.join('-')})`);
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
        appliedCoeffs.push('C_suicide(発動)');
    }

    // デバフの乗算下限キャップ（0.85）
    tempPlayers.forEach(p => {
        if (p.score > 0) {
            const originalBase = p.score;
            if (p.final_score / originalBase < 0.85) {
                p.final_score = originalBase * 0.85;
                appliedCoeffs.push('C_cap');
            }
        }
    });

    // シナリオ単位でまとめてログ出力
    const uniqueCoeffs = [...new Set(appliedCoeffs)];
    app.logMessage(`[KOUTENREI] ${scenario}: ${uniqueCoeffs.length > 0 ? uniqueCoeffs.join(' / ') : 'なし'}`);

    return tempPlayers;
}

// ====================================================================================
// runScenarioSimulation
// ====================================================================================
function runScenarioSimulation(basePlayers, allSeriInfos, settings, BANK_DATA, applyKoutenrei, lineInput, windSpeed, windDirection, lines) {
    // ── 展開モード判定 ──────────────────────────────
    const TENKAI_MODE_ENABLED = true; // falseで現行に戻せる

    const _escapePlsRaw = basePlayers.filter(p => p.style === '逃' && !p.is_scratch);
    const _chasePls     = basePlayers.filter(p => p.style === '追' && !p.is_scratch);

    // 逃げタイプ0人の場合、lines[0][0]（並び予想の物理的先頭）を逃げ扱いとする
    const _escapePls = _escapePlsRaw.length > 0
        ? _escapePlsRaw
        : (lines && lines.length > 0 && lines[0].length > 0)
            ? [basePlayers.find(p => p.id === lines[0][0])].filter(Boolean)
            : [];

    // まくり候補：逃げ扱いになった選手は除外する
    const _escapeIds = new Set(_escapePls.map(p => p.id));
    const _makuriPls = basePlayers.filter(p => p.style === '自' && !p.is_scratch && !_escapeIds.has(p.id));

    const _escapeMax = _escapePls.length > 0 ? Math.max(..._escapePls.map(p => p.score)) : 0;
    const _chaseMax  = _chasePls.length  > 0 ? Math.max(..._chasePls.map(p => p.score))  : 0;
    const _makuriMax = _makuriPls.length > 0 ? Math.max(..._makuriPls.map(p => p.score)) : 0;
    const _scoreGap     = _chaseMax  - _escapeMax;
    const _makuriVsNige = _makuriMax - _escapeMax;

    let _tenkaiMode;
    if (_makuriVsNige >= 5)                                   _tenkaiMode = '捲';
    else if (_scoreGap <= 0 && _makuriVsNige <= 0)            _tenkaiMode = '逃';
    else                                                       _tenkaiMode = '差';

    const _tenkaiTable = {
        '差': {},
        '捲': { '自': 1.15 },
        '逃': { '逃': 1.15, '自': 1.10 },
    };
    const tenkaiBonus = _tenkaiTable[_tenkaiMode];
    app.logMessage(`[TENKAI] mode=${_tenkaiMode} scoreGap=${_scoreGap.toFixed(1)} makuriVsNige=${_makuriVsNige.toFixed(1)}`);

    const scenarios = ['先行有利', '捲り有利', '差し有利'];
    const allScenarioResults = [];
    const integratedScores   = {};
    const completedScenarios = [];
    const scenarioPrefix = applyKoutenrei ? '[KOUTEN]' : '[SEITEN]';

    app.logMessage(`${scenarioPrefix} バンク直線: ${BANK_DATA.straight || 50}m / カント: ${BANK_DATA.canto || 30}度`);

    basePlayers.forEach(p => integratedScores[p.id] = 0);

    scenarios.forEach(scenario => {
        const cDCoeffs      = getScenarioCoeffs(scenario);
        let scenarioPlayers = JSON.parse(JSON.stringify(basePlayers));

        const direction = windDirection || (BANK_DATA ? BANK_DATA.direction : '無風');
        const speed     = (windSpeed !== undefined) ? windSpeed : (BANK_DATA ? BANK_DATA.speed : 0);
        const isGirls   = settings ? settings.IS_GIRLS : false;

        // 🔥 展開層（V9.0）
        applyTacticalAdjustments(scenarioPlayers, BANK_DATA, lines, allSeriInfos);

        scenarioPlayers.forEach(p => {
            // 基本スコア × 得点補正 × 印 × 近況 × S1/B1位置 × ライン結束 × バンク脚質適性 × 地元補正
            p.final_score = p.score * p.c_score_adj * p.c_wmark * p.c_recent * p.c_s1 * p.c_b1 * p.c_l * p.c_e * p.c_local;
            p.final_score *= (p.physicalPenalty     || 1.0);  // 物理層：直線短ペナルティ
            p.final_score /= (p.cantoMakuriPenalty  || 1.0);  // 展開層：高カント捲りコスト
            p.final_score *= (p.warpBoost           || 1.0);  // 展開層：イン突きブースト
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
            // ── 展開モード補正（V10.0）──────────────────────
            if (TENKAI_MODE_ENABLED) {
                p.final_score *= (tenkaiBonus[p.style] || 1.0);
            }
        });

        // ── 別ライン3番手ペナルティ（subLineTailPenalty）──
        // 思想：別ライン3番手の前には平均4車が存在する。
        //       直線距離に占める障害車体(n=2.0m × k=4車)の割合を物理的根拠とする。
        //       k=4は最大5・最低3の中間値。車間≈0・縦並びを前提とする。
        //       メインライン＝2人以上のラインで得点合計最高（単騎除外、同値はlines先頭優先）
        //       フォールバック50m＝競輪施設基準の最短直線距離
        //       TODO: 4人以上ラインの4番手以降は現行スコープ外（将来拡張余地）
        const SUB_LINE_TAIL_ENABLED = true;
        const N_BIKE = 2.0;
        const K_CARS = 4;

        if (SUB_LINE_TAIL_ENABLED && lines && lines.length >= 2) {
            const longLines = lines.filter(line => line.length >= 3);
            if (longLines.length >= 2) {
                const baseMap = Object.fromEntries(basePlayers.map(p => [p.id, p]));
                const validLines = lines.filter(line => line.length >= 2);
                const mainLine = validLines.reduce((best, line) => {
                    const sum = line.reduce((s, id) => s + (baseMap[id]?.score || 0), 0);
                    const bestSum = best.reduce((s, id) => s + (baseMap[id]?.score || 0), 0);
                    return sum > bestSum ? line : best;
                }, validLines[0]);
                const mainLineSet = new Set(mainLine);
                const subLineTailIds = new Set(
                    lines
                        .filter(line => line.length >= 3 && !mainLineSet.has(line[0]))
                        .map(line => line[2])
                );
                const penalty = Math.max(0, 1 - (N_BIKE * K_CARS) / (BANK_DATA?.straight || 50));
                scenarioPlayers.forEach(p => {
                    if (subLineTailIds.has(p.id)) {
                        p.final_score *= penalty;
                        app.logMessage(`[SUB_TAIL] 選手${p.id} ×${penalty.toFixed(3)}`);
                    }
                });
            }
        }

        scenarioPlayers.forEach(p => {
            integratedScores[p.id] += p.final_score;
        });

        scenarioPlayers.sort((a, b) => b.final_score - a.final_score);
        assignFinalGrades(scenarioPlayers);
        allScenarioResults.push({ scenario, results: scenarioPlayers });
        completedScenarios.push(scenario);
    });

    app.logMessage(`${scenarioPrefix} ${completedScenarios.join(' / ')} 完了`);

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
        return { tenunIndex: 50, matchCount: null, message: 'データ不足のため指数算出不可', rankingWithData: [], koutenRankingWithData: [] };
    }

    const seitenTop3 = new Set(seitenreiRanking.slice(0, 3).map(p => p.id));
    const koutenTop3 = koutenreiRanking.slice(0, 3).map(p => p.id);
    let matchCount = 0;
    koutenTop3.forEach(id => { if (seitenTop3.has(id)) matchCount++; });

    // 天雲指数マッピング：晴天令・荒天令Top3の一致数 → 4段階指数
    // 100段階は分岐過多のため33刻みに圧縮。実用上4段階で十分な解像度
    // 3一致→0（完全安定）/ 2一致→33 / 1一致→67 / 0一致→100（完全混沌）
    const tenunIndexMap = { 3: 0, 2: 33, 1: 67, 0: 100 };
    const tIndex = tenunIndexMap[matchCount] ?? 50;

    const windSpeed = parseFloat(document.getElementById('wind-speed').value) || 0;
    let targetPlayerId = null;

    if (tIndex === 33 && windSpeed <= 2.0) {
        const firstPlayer = seitenreiRanking[0];
        if (firstPlayer) {
            const isSashiMa  = (firstPlayer.style === '追');
            const isWeightTop = (firstPlayer.wmark === '◎');
            if (isSashiMa && isWeightTop) {
                targetPlayerId = firstPlayer.id;
                app.logMessage(`壱耀晴乾ノ象：○${targetPlayerId}`);
            }
        }
    }

    let finalHtml = app.generateTamakiTenunHTML(tIndex, false, null);
    if (targetPlayerId !== null) {
        finalHtml += app.generateTamakiTenunHTML(tIndex, true, targetPlayerId);
    }

    return {
        tenunIndex: tIndex,
        matchCount: matchCount,  // Top3一致数（総評根拠行用。計算には不使用）
        message: finalHtml,
        rankingWithData: seitenreiRanking,
        koutenRankingWithData: koutenreiRanking
    };
}

// ====================================================================================
// calculatePrediction
// ====================================================================================
app.calculatePrediction = async function(guardedData) {
    kururuLogged = false;
    app.logMessage(`[DEBUG calcPrediction] 開始時 CalculationSnapshot.race_id: ${CalculationSnapshot.race_id}`);
    const savedRaceId = CalculationSnapshot.race_id;
    resetSnapshot();
    CalculationSnapshot.race_id = savedRaceId;
    app.logMessage(`[DEBUG calcPrediction] resetSnapshot後 race_id復元: ${CalculationSnapshot.race_id}`);
    const tenunOutputArea = document.getElementById('tenun-index-output');
    if (tenunOutputArea) {
        tenunOutputArea.innerHTML = ''
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    // InputGuard が浄化・検証済みの値を使用する
    const { s1Id, b1Id } = guardedData.radio;
    const players = guardedData.players.map(p => {
        let score = p.score;
        // goldcap：データ不足新人の地力再定義装置
        // A級平均スコア≒95.0 を下限として設定
        // 実績データが少ないことによる過小評価を補正する措置
        if (p.isGoldCap && score < 95.0) {
            score = 95.0;
            app.logMessage(`[ROYAL] 選手${p.id}: 👑 戴冠（地力再定義)`);
        }
        return {
            id: p.id, name: p.name, score, style: p.style, wmark: p.wmark,
            recent: p.recent,
            is_s1: p.id === s1Id, is_b1: p.id === b1Id, is_scratch: p.isScratch,
            isLocal: p.isLocal,
            c_score_adj: 1.0, c_recent: 1.0, c_wmark: 1.0,
            c_s1: 1.0, c_b1: 1.0, c_l: 1.0, c_e: 1.0, c_local: 1.0, final_score: 0,
            seri_coef: score * (SERI_STYLE_BONUS[p.style] || 1.00) * (p.wmark === '◎' ? 1.04 : 1.0)
        };
    });

    if (Object.keys(BANK_DATA).length === 0) await loadBANK_DATA();

    const raceType  = guardedData.raceType;
    const settings  = COEFFICIENT_SETTINGS[raceType];
    const bankName  = guardedData.bankName;
    CalculationSnapshot.bank = BANK_DATA[bankName] ? {
      straight: BANK_DATA[bankName].straight,
      canto: BANK_DATA[bankName].canto,
      alpha: BANK_DATA[bankName].alpha,
      beta: BANK_DATA[bankName].beta,
      keirin_bias: BANK_DATA[bankName].keirin_bias
    } : {};
    const selectedBank = BANK_DATA[bankName];
    const koutenreiModeSelected = guardedData.modeSelector === 'koutenrei';

    app.logMessage(`[CALC START] ${raceType} / バンク: ${bankName} / モード: ${koutenreiModeSelected ? '荒天令' : '晴天令'}`);

    const { players: participatingPlayers, allSeriInfos, finalOrderedPlayerIds, displayLineSegments, lines } = calculateLineCoeffs(players, settings);
    CalculationSnapshot.lines = lines;

    if (participatingPlayers.length === 0) {
        alert("出走選手がいないため、計算を中止しました。");
        return;
    }

    let basePlayers = JSON.parse(JSON.stringify(participatingPlayers));
    CalculationSnapshot.scores.base = JSON.parse(JSON.stringify(basePlayers));

    basePlayers.forEach(p => {
        p.c_score_adj = 1.0 + (p.score / 100 - 1) * settings.R_BIAS;

    const recentScores = p.recent.split('').map(Number);
    const avgRank = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 4.0;
    let trendBonus = 0;
    if (recentScores.length >= 3) {
    const d1 = recentScores[1] - recentScores[0];
    const d2 = recentScores[2] - recentScores[1];
    if (d1 > 0 && d2 > 0) trendBonus = +0.03;
    if (d1 < 0 && d2 < 0) trendBonus = -0.03;
    }
    p.trendLabel = trendBonus > 0 ? '上昇' : trendBonus < 0 ? '下降' : '安定';
    // 4 - avgRank: 平均着順が良いほど正値（1着=+0.15）。trendBonus: 直近3走の方向性で±0.03
    p.c_recent = (1.0 + (4 - avgRank) * 0.05 + trendBonus) * settings.RECENT_WEIGHT;

        if      (p.wmark === '◎') p.c_wmark = 1.04;
        else if (p.wmark === '〇') p.c_wmark = 1.02;
        else if (p.wmark === '△') p.c_wmark = 1.005;
        else if (p.wmark === '✕') p.c_wmark = 1.003;
        else                       p.c_wmark = 1.0;

        // S1位(+0.5%)：ライン先頭の象徴的優位
        // B1位(+1.5%)：先行を守りながら自身も着を狙う二重負荷への実戦的評価
        // B1位の方がしんどい → 加点大
        p.c_s1 = p.is_s1 ? 1.005 : 1.0;
        p.c_b1 = p.is_b1 ? 1.015 : 1.0;

        // 脚質→バンクバイアスキーの対応。逃げは先行系、捲りは捲り系、追い込みは差し系
        let biasKey = '';
        if      (p.style === '自') biasKey = '捲り';
        else if (p.style === '逃') biasKey = '先行';
        else if (p.style === '追') biasKey = '差し';
        p.c_e = selectedBank.keirin_bias[biasKey] || 1.0;
        p.c_local = p.isLocal ? LOCAL_BONUS : 1.0;
    });

    // c_e / c_local をスナップショットに反映（forEach後に値が確定するため）
    basePlayers.forEach(p => {
        const snap = CalculationSnapshot.scores.base.find(b => b.id === p.id);
        if (snap) { snap.c_e = p.c_e; snap.c_local = p.c_local; }
    });

    try {
        const currentLineInputForCalc = document.getElementById('line-input').value;
        app.logMessage(`[DEBUG] シミュレーション開始: ラインデータ "${currentLineInputForCalc}"`);

        const windSpeed     = parseFloat(document.getElementById('wind-speed').value) || 0;
        const windDirection = document.getElementById('wind-direction').value;

        const seitenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, selectedBank, false, currentLineInputForCalc, windSpeed, windDirection, lines);
        app.logMessage(`[CALC] 晴天令完了（風速:${windSpeed}m/s 方向:${windDirection}）`);

        const koutenreiResults = runScenarioSimulation(basePlayers, allSeriInfos, settings, selectedBank, true, currentLineInputForCalc, windSpeed, windDirection, lines);
        app.logMessage(`[CALC] 荒天令完了（風速:${windSpeed}m/s 方向:${windDirection}）`);

        CalculationSnapshot.scores.final = {
            seiten: seitenreiResults.integratedScores,
            kouten: koutenreiResults.integratedScores
        };

        // physicalPenalty / warpBoost / cantoMakuriPenalty をscores.baseに反映
        CalculationSnapshot.scores.base.forEach(p => {
            p.physicalPenalty    = CalculationSnapshot.physical.physicalPenalty[p.id]          || 1.0;
            p.warpBoost          = CalculationSnapshot.tactical.warpBoost[p.id]                || 1.0;
            p.cantoMakuriPenalty = CalculationSnapshot.tactical.cantoMakuriPenalty[p.id]       || 1.0;
        });

        const detailedScenarioResults = koutenreiModeSelected
            ? koutenreiResults.allScenarioResults
            : seitenreiResults.allScenarioResults;

        const seitenScoresWithBonus = applyLineCountBonus(seitenreiResults.integratedScores, lines);

        const finalTenunData = calculateTenunIndex(
            seitenScoresWithBonus,
            koutenreiResults.integratedScores,
            seitenreiResults.allScenarioResults,
            participatingPlayers
        );

        // gradeKey の確定
        const gradeKey = Object.keys(COEFFICIENT_SETTINGS).find(key =>
            COEFFICIENT_SETTINGS[key] === settings) || 'a-kyu';

        // 展開パターン判別
        const styleScores = { '逃': [], '追': [], '自': [] };
        for (const p of basePlayers) {
            if (p.is_scratch) continue;
            const s = p.style === '両' ? '自' : p.style;
            if (styleScores[s]) styleScores[s].push(p.score);
        }
        const maxNige   = Math.max(...(styleScores['逃'].length ? styleScores['逃'] : [0]));
        const maxMakuri = Math.max(...(styleScores['自'].length ? styleScores['自'] : [0]));
        const maxSashi  = Math.max(...(styleScores['追'].length ? styleScores['追'] : [0]));
        const nNige   = styleScores['逃'].length;
        const nMakuri = styleScores['自'].length;
        const mv = maxMakuri - maxNige;
        const sg = maxSashi  - maxNige;
        const tenkaiPattern = classifyTenkai(mv, sg, nNige, nMakuri);
        app.logMessage(`[TENKAI_PATTERN] mv=${mv.toFixed(1)} sg=${sg.toFixed(1)} nNige=${nNige} nMakuri=${nMakuri} → ${tenkaiPattern}`);

        const _calcResult = displayResults(
            detailedScenarioResults,
            seitenreiResults.integratedScores,
            koutenreiResults.integratedScores,
            bankName,
            allSeriInfos,
            finalOrderedPlayerIds,
            seitenreiResults.allScenarioResults,
            participatingPlayers,
            displayLineSegments,
            finalTenunData,
            lines,
            tenkaiPattern,
            basePlayers,
            windSpeed,
            windDirection
        );

        try {
            if (typeof app.displayKeppan === 'function' && _calcResult?.relations) {
                app.displayKeppan(_calcResult.relations);
            }
        } catch (e) { app.logMessage('[ERROR] displayKeppan呼び出し: ' + e.message); }
        try {
            if (typeof app.generateRitsuText === 'function' && _calcResult?.relations) {
                app.generateRitsuText(_calcResult.relations);
            }
        } catch (e) { app.logMessage('[ERROR] generateRitsuText呼び出し: ' + e.message); }

        applyShinganHakke(basePlayers, seitenreiResults.integratedScores, koutenreiResults.integratedScores);

        const resultsContainer = document.getElementById('results-container');
        if (resultsContainer) resultsContainer.classList.add('visible');

        // 🌌 赤口呑縁：晴天令・荒天令完了後に直接起動
        app.logMessage('[DEBUG] invokeShakkouDonperi type: ' + typeof app.invokeShakkouDonperi);
        if (typeof app.invokeShakkouDonperi === 'function') {
            if (typeof app.startShakkouCalculation === 'function') {
                app.startShakkouCalculation(gradeKey);
            }
            const context = {
                grade: gradeKey,
                seriInfos: allSeriInfos,
                lineInput: currentLineInputForCalc,
                windSpeed: windSpeed,
                windDirection: windDirection,
                isGirls: settings.IS_GIRLS || false,
                BANK_DATA: selectedBank
            };
            return app.invokeShakkouDonperi(basePlayers, context).then(cosmosResult => {
                if (typeof app.completeShakkouCalculation === 'function') {
                    app.completeShakkouCalculation(cosmosResult, gradeKey);
                }
                app.logMessage('[CALC END] 予想計算が完了し、結果が表示されました。');
            });
        } else {
            app.logMessage('[CALC END] 予想計算が完了し、結果が表示されました。');
        }

    } catch (error) {
        console.error("計算実行中にエラー:", error);
        app.logMessage(`[ERROR] 計算中断: ${error.message}`);
    }
}

// ====================================================================================
// ====================================================================================
// applyShinganHakke — 審眼八卦後処理
// ====================================================================================
function applyShinganHakke(basePlayers, seitenScores, koutenScores) {
    const sw = {
        line:   document.getElementById('sg-line')?.checked   || false,
        score:  document.getElementById('sg-score')?.checked  || false,
        recent: document.getElementById('sg-recent')?.checked || false,
        wmark:  document.getElementById('sg-wmark')?.checked  || false,
        tenkai: document.getElementById('sg-tenkai')?.checked || false,
    };
    const tenkaiType = document.querySelector('input[name="sg-tenkai-type"]:checked')?.value || 'senkou';
    const hasLocal = basePlayers.some(p => p.isLocal);
    const anyOn = sw.line || sw.score || sw.recent || sw.wmark || sw.tenkai || hasLocal;

    const out = document.getElementById('shingan-hakke-output');
    if (!anyOn) { if (out) out.innerHTML = ''; return; }

    const tenkaiStyleMap = { senkou: ['逃', '自'], makuri: ['自'], sashi: ['追'] };
    const tenkaiStyles = tenkaiStyleMap[tenkaiType] || [];
    const tenkaiLabel  = { senkou: '先行有利', makuri: '捲り有利', sashi: '差し有利' }[tenkaiType] || '';

    // 発動ログ（ONのスイッチのみ・実車番で出力）
    app.logMessage('[SNGN] 発動');
    if (sw.line) {
        const ids = basePlayers.filter(p => (CalculationSnapshot.line_coop[p.id] || 1.0) > 1.0).map(p => p.id);
        app.logMessage(`[SNGN] ライン強度: 選手${ids.join('・')} に×1.05`);
    }
    if (sw.score) {
        const ids = basePlayers.filter(p => p.c_score_adj > 1.0).map(p => p.id);
        app.logMessage(`[SNGN] 競走得点: 選手${ids.join('・')} に×1.05`);
    }
    if (sw.recent) {
        const ids = basePlayers.filter(p => p.c_recent > 1.0).map(p => p.id);
        app.logMessage(`[SNGN] 近況: 選手${ids.join('・')} に×1.05`);
    }
    if (sw.wmark) {
        const ids = basePlayers.filter(p => p.wmark === '◎' || p.wmark === '〇').map(p => p.id);
        app.logMessage(`[SNGN] 印: 選手${ids.join('・')} に×1.05`);
    }
    if (sw.tenkai) {
        const ids = basePlayers.filter(p => tenkaiStyles.includes(p.style)).map(p => p.id);
        app.logMessage(`[SNGN] 展開(${tenkaiLabel}): 選手${ids.join('・')} に×1.05`);
    }
    if (hasLocal) {
        const ids = basePlayers.filter(p => p.isLocal).map(p => p.id);
        app.logMessage(`[SNGN] 地元(自動): 選手${ids.join('・')} に×1.05`);
    }

    function calcCorrected(baseScores) {
        const result = {};
        basePlayers.forEach(p => {
            const c_l = CalculationSnapshot.line_coop[p.id] || p.c_l || 1.0;
            let mult = 1.0;
            if (sw.line   && c_l > 1.0)                                    mult *= 1.05;
            if (sw.score  && p.c_score_adj > 1.0)                          mult *= 1.05;
            if (sw.recent && p.c_recent > 1.0)                             mult *= 1.05;
            if (sw.wmark  && (p.wmark === '◎' || p.wmark === '〇'))        mult *= 1.05;
            if (sw.tenkai && tenkaiStyles.includes(p.style))               mult *= 1.05;
            if (hasLocal  && p.isLocal)                                    mult *= 1.05;
            result[p.id] = (baseScores[p.id] || 0) * mult;
        });
        return result;
    }

    const correctedSeiten = calcCorrected(seitenScores);
    const correctedKouten = calcCorrected(koutenScores);

    const allRawScores = basePlayers.map(p => p.score);
    const scoreMin   = Math.min(...allRawScores);
    const scoreMax   = Math.max(...allRawScores);
    const scoreThird = (scoreMax - scoreMin) / 3;

    function rankPlayers(corrMap) {
        return basePlayers
            .map(p => ({ ...p, c_l: CalculationSnapshot.line_coop[p.id] || p.c_l || 1.0, correctedScore: corrMap[p.id] || 0 }))
            .sort((a, b) => b.correctedScore - a.correctedScore);
    }

    if (typeof app.displayShinganHakke === 'function') {
        app.displayShinganHakke({
            seitenRanked: rankPlayers(correctedSeiten),
            koutenRanked: rankPlayers(correctedKouten),
            scoreMin,
            scoreThird,
            sw,
            hasLocal,
            tenkaiType,
        });
    }
}

// displayResults
// ====================================================================================
function getStrengthColor(score, minScore, maxScore) {
    if (maxScore === minScore) return 'rgb(142, 142, 142)';
    const n = (score - minScore) / (maxScore - minScore);
    const r = Math.round(52  + (231 - 52)  * n);
    const g = Math.round(152 + (76  - 152) * n);
    const b = Math.round(219 + (60  - 219) * n);
    return `rgb(${r}, ${g}, ${b})`;
}

function getTextColor(rgbColor) {
    const match = rgbColor.match(/\d+/g);
    if (!match || match.length < 3) return '#fff';
    const luminance = (0.2126 * parseInt(match[0]) + 0.7152 * parseInt(match[1]) + 0.0722 * parseInt(match[2])) / 255;
    return luminance > 0.5 ? '#333' : '#fff';
}

function displayResults(detailedScenarioResults, seitenreiIntegratedScores, koutenreiIntegratedScores, bankName, allSeriInfos, finalOrderedPlayerIds, allScenarioResults, participatingPlayers, displayLineSegments, tenunIndexData, lines = [], tenkaiPattern = '現状', basePlayers = [], windSpeed = 0, windDirection = '無風') {
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
    const lineDisplay = document.getElementById('line-display');
    let displayHtml = '';

    displayLineSegments.forEach(segment => {
        if (segment.type === 'single') {
            const score = playerIdToScore[segment.id];
            if (score === undefined) return;
            const rgb  = getStrengthColor(score, minScore, maxScore);
            const text = getTextColor(rgb);
            displayHtml += `<span class="line-box strength-color" style="background-color: ${rgb}; color: ${text};">${segment.id}</span>`;
        } else if (segment.type === 'seri') {
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
    let seriSummaryHtml = '';
    if (allSeriInfos.length > 0) {
            seriSummaryHtml += `<div id="seri-summary" style="padding: 15px; margin-bottom: 15px; border: 4px dashed #f8b500; background: repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255, 255, 255, 0.05) 2px, rgba(255, 255, 255, 0.05) 3px), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.05) 2px, rgba(255, 255, 255, 0.05) 3px), #3a3a3a; border-radius: 6px; color: #ffffff; background-clip: padding-box;"><h4 style="color: #ffffff; margin-top: 0;">⚠️ 競り発生！</h4>`;
        allSeriInfos.forEach((info, index) => {
            const prefix = (index === 0) ? '最初の競りは、' : '<strong>さらに、</strong>';
            seriSummaryHtml += `<p>${prefix}選手<strong>${info.follower}</strong> vs 選手<strong>${info.contender}</strong>。予測勝者は **選手${info.winner}** です。</p>`;
        });
        seriSummaryHtml += `<p style="font-size: 0.9em; color: #ffa726;">※体力消耗による減点補正が適用されています。</p></div>`;
    }

    // 天雲指数
    const tenunOutput = document.getElementById('tenun-index-output');
    if (tenunOutput && tenunIndexData) {
        tenunOutput.innerHTML = tenunIndexData.message;
        tenunOutput.dataset.tenunValue = tenunIndexData.tenunIndex;
    }

    // 晴天令買い目 — r2がLと被らないよう事前にL仮算出して excludeL として渡す
    const prelimSeitenIds = new Set(tenunIndexData.rankingWithData.slice(0, 3).map(p => p.id));
    const prelimKoutenRanking = [
        ...tenunIndexData.rankingWithData.slice(0, 3),
        ...tenunIndexData.rankingWithData.filter(p => !prelimSeitenIds.has(p.id))
    ];
    const prelimKouten = generateKoutenreiBets(
        prelimKoutenRanking, prelimSeitenIds, lines,
        tenunIndexData.koutenRankingWithData || []
    );
    const excludeL = prelimKouten?.targetL?.id ?? null;

    const seitenreiBox  = document.getElementById('seitenrei-output');
    const seitenreiBets = generateSeitenreiBets(tenunIndexData.rankingWithData, basePlayers, tenkaiPattern, excludeL);
    if (seitenreiBox && seitenreiBets) {
        let html = '<h4>☀️ 晴天令</h4><strong>三連単</strong><ul>';
        seitenreiBets.sanrentan.forEach(b => html += `<li>${formatOrderedBet(b)}</li>`);
        html += '</ul><strong>三連複</strong><ul>';
        seitenreiBets.sanrenpuku.forEach(b => html += `<li>${formatSanrenpuku(b)}</li>`);
        html += '</ul>';
        seitenreiBox.innerHTML = html;
    }

    // 荒天令買い目
    const koutenreiBox  = document.getElementById('koutenrei-output');
    // 荒天令のA/B/Cを晴天令で選出したr[0]/r[1]/r[2]に揃えるためランキングを組み替える
    const seitenSelectedIds = seitenreiBets ? seitenreiBets.sanrentan[0] : null;  // スコア順(r0/r1/r2)でA/B/Cを確定
    const seitenSelectedSet = new Set(seitenSelectedIds || []);
    const koutenreiRanking = seitenSelectedIds
        ? [
            ...seitenSelectedIds.map(id => tenunIndexData.rankingWithData.find(p => p.id === id)),
            ...tenunIndexData.rankingWithData.filter(p => !seitenSelectedSet.has(p.id))
          ].filter(Boolean)
        : tenunIndexData.rankingWithData;
    const originalSeitenTop3Ids = new Set(seitenSelectedIds || []);
    const koutenreiBets = generateKoutenreiBets(
        koutenreiRanking,
        originalSeitenTop3Ids,
        lines,
        tenunIndexData.koutenRankingWithData || []
    );
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

    const scenarioOutput = document.getElementById('scenario-output');
    if (scenarioOutput) {
        const oldSummary = document.getElementById('seri-summary');
        if (oldSummary) {
            oldSummary.remove();
        }
        if (seriSummaryHtml) {
            scenarioOutput.insertAdjacentHTML('afterbegin', seriSummaryHtml);
        }
    }

    app.logMessage(`[DEBUG sendLog直前] CalculationSnapshot.race_id: ${CalculationSnapshot.race_id}`);
    // 審眼八卦がONの場合はハズレ解析シートへの送信をスキップ
    const _sgAnySwitchOn = ['sg-line','sg-score','sg-recent','sg-wmark','sg-tenkai']
        .some(id => document.getElementById(id)?.checked);
    if (_sgAnySwitchOn) {
        app.logMessage('[SNGN] 審眼八卦オンのためsendLogをスキップします。');
    } else {
    // [TEST ENV] ハズレ解析GAS送信無効化
    // App.sendLog(
    //   {
    //     race_id: CalculationSnapshot.race_id,
    //     bank: document.getElementById('bank-name').value,
    //     grade: document.getElementById('race-type').value,
    //     wind: {
    //       speed: parseFloat(document.getElementById('wind-speed').value) || 0,
    //       direction: document.getElementById('wind-direction').value
    //     },
    //     tenun: tenunIndexData.tenunIndex
    //   },
    //   {
    //     seiten: document.getElementById('seitenrei-output').innerHTML,
    //     kouten: document.getElementById('koutenrei-output').innerHTML
    //   }
    // );
    } // _sgAnySwitchOn

    // ── relations データ出口（相関図用） ──────────────────────────────
    const _bankInfo   = BANK_DATA[bankName] || {};
    const _seitenRank = tenunIndexData.rankingWithData || [];
    const _seitenTop3 = seitenreiBets
        ? seitenreiBets.sanrentan[0].map(id => _seitenRank.find(p => p.id === id)).filter(Boolean)
        : _seitenRank.slice(0, 3);
    return {
        relations: {
            seiten: {
                r0: _seitenTop3[0] ?? null,
                r1: _seitenTop3[1] ?? null,
                r2: _seitenTop3[2] ?? null,
            },
            kouten: {
                A: _seitenTop3[0] ?? null,
                B: _seitenTop3[1] ?? null,
                C: _seitenTop3[2] ?? null,
                L: koutenreiBets ? (koutenreiBets.targetL ?? null) : null,
            },
            lines:      displayLineSegments,
            lineArrays: lines,
            seri:       allSeriInfos.map((info, i) => ({ index: i, follower: info.follower, contender: info.contender, winner: info.winner })),
            wind:   { speed: windSpeed, direction: windDirection, effective: (BANK_DATA[bankName]?.wind_direction_map?.[windDirection]) || '' },
            bank:   { straight: _bankInfo.straight ?? 50, canto: _bankInfo.canto ?? 30, name: bankName, length: _bankInfo.length ?? null, wind_direction_map: _bankInfo.wind_direction_map ?? null },
            allPlayers:     basePlayers,
            seitenScores:   seitenreiIntegratedScores,
            scenarioScores: (function() {
                const MAP = { '先行有利': '逃', '差し有利': '差', '捲り有利': '捲' };
                const out = {};
                (allScenarioResults || []).forEach(({ scenario, results }) => {
                    const key = MAP[scenario] || scenario;
                    out[key] = {};
                    (results || []).forEach(p => { out[key][p.id] = p.final_score; });
                });
                return out;
            })(),
            tenkaiPattern: tenkaiPattern,
            raceId:        CalculationSnapshot.race_id || '',
            tenunIndex:    tenunIndexData?.tenunIndex ?? 50,
            tenunMatchCount: tenunIndexData?.matchCount ?? null,
        }
    };
}

// ====================================================================================
// 買い目生成ユーティリティ
// ====================================================================================
function formatOrderedBet(bet)  { return bet.join('-'); }
function formatSanrenpuku(bet)  { return bet.slice().sort((a, b) => a - b).join('='); }

function applyLineCountBonus(integratedScores, lines) {
  const LINE_BONUS = { 4: 1.08, 3: 1.04 };
  const bonusMap = {};
  (lines || []).forEach(line => {
    const bonus = LINE_BONUS[line.length] || 1.00;
    line.forEach(id => { bonusMap[id] = bonus; });
  });
  const result = {};
  Object.keys(integratedScores).forEach(id => {
    result[id] = integratedScores[id] * (bonusMap[Number(id)] || 1.00);
  });
  return result;
}

function classifyTenkai(mv, sg, nNige, nMakuri) {
  const oc = (lo, v, hi) => lo < v && v <= hi;  // (lo, hi]
  const co = (lo, v, hi) => lo <= v && v < hi;  // [lo, hi)

  const rules = [
    [() => sg <= -5,                                                          '逃げ圧勝'],
    [() => oc(-5,sg,0) && nNige >= 2,                                         'ちょい差し'],
    [() => sg >= 10,                                                          '別線差し'],
    [() => mv >= 5,                                                           '捲り'],
    [() => mv<0  && oc(5,sg,10)  && nNige===1 && nMakuri===0,                '別線差し'],
    [() => mv<0  && oc(0,sg,5)   && nNige===1 && nMakuri===0,                '別線差し'],
    [() => mv<0  && oc(-5,sg,0)  && nNige===1 && nMakuri===1,                '逃げ圧勝'],
    [() => co(0,mv,5) && oc(0,sg,5)  && nNige>=2  && nMakuri===1,            '捲り'],
    [() => co(0,mv,5) && oc(5,sg,10) && nNige===1 && nMakuri===1,            '別線差し'],
    [() => mv<0  && oc(-5,sg,0)  && nNige===1 && nMakuri===2,                '逃げ圧勝'],
    [() => mv<0  && oc(0,sg,5)   && nNige===2 && nMakuri===0,                '別線差し'],
    [() => mv<0  && oc(-5,sg,0)  && nNige===1 && nMakuri===0,                '逃げ圧勝'],
    [() => mv<0  && oc(0,sg,5)   && nNige>=3  && nMakuri===0,                '逃げ圧勝'],
    [() => co(0,mv,5) && oc(0,sg,5)  && nNige===1 && nMakuri===2,            '別線差し'],
    [() => mv<0  && oc(0,sg,5)   && nNige===1 && nMakuri===1,                '別線差し'],
    [() => mv<0  && oc(0,sg,5)   && nNige===2 && nMakuri===1,                '別線差し'],
    [() => co(0,mv,5) && oc(0,sg,5)  && nNige===1 && nMakuri===1,            '捲り'],
    [() => co(0,mv,5) && oc(5,sg,10) && nNige===1 && nMakuri===2,            '捲り'],
  ];

  return rules.find(([cond]) => cond())?.[1] ?? '現状';
}

function selectR2(ranking, basePlayers, tenkaiPattern, excludeIds) {
    const baseMap = Object.fromEntries((basePlayers || []).map(p => [p.id, p]));
    const styleOf = id => { const s = baseMap[id]?.style || ''; return s === '両' ? '自' : s; };
    const clOf    = p  => p.c_l || baseMap[p.id]?.c_l || 1.0;
    const candidates = ranking.filter(p => !excludeIds.has(p.id));

    let r2 = null;
    if (tenkaiPattern === '逃げ圧勝') {
        r2 = candidates.find(p => styleOf(p.id) === '追' && clOf(p) > 1.0) || null;
    } else if (tenkaiPattern === 'ちょい差し') {
        const sashi = candidates.filter(p => styleOf(p.id) === '追')
            .sort((a, b) => clOf(b) - clOf(a));
        r2 = sashi[0] || null;
    } else if (tenkaiPattern === '別線差し') {
        r2 = candidates.find(p => ['追', '自'].includes(styleOf(p.id))) || null;
    } else if (tenkaiPattern === '捲り') {
        r2 = candidates.find(p => styleOf(p.id) === '自') || null;
    }
    return r2 || candidates[0] || null;
}

function generateSeitenreiBets(ranking, basePlayers, tenkaiPattern, excludeL = null) {
    if (!ranking || ranking.length < 3) return null;
    const r0 = ranking[0], r1 = ranking[1];
    const excludeIds = new Set([r0.id, r1.id, ...(excludeL != null ? [excludeL] : [])]);
    const r2obj = selectR2(ranking, basePlayers, tenkaiPattern, excludeIds);
    if (!r2obj) return null;
    const [a, b, c] = [r0.id, r1.id, r2obj.id];
    const sanrentan = [
        [a, b, c], [a, c, b],
        [b, a, c], [b, c, a]
    ];
    const sanrenpuku = [[a, b, c].sort((x, y) => x - y)];
    return { sanrentan, sanrenpuku };
}

function generateKoutenreiBets(ranking, seitenTop3Ids = new Set(), lines = [], koutenRanking = []) {
    if (!ranking || ranking.length < 4) return null;
    const A = ranking[0], B = ranking[1], C = ranking[2];
    const excludeIds = new Set([A.id, B.id, C.id, ...seitenTop3Ids]);

    // ラインTOP（逃/自/両）のID集合
    const lineTops = new Set(
        lines
            .filter(line => line.length > 0)
            .map(line => line[0])
            .filter(id => {
                const p = ranking.find(p => p.id === id);
                return p && ['逃','自'].includes(p.style);
            })
    );

    // 荒天令スコア順から晴天令TOP3・top3を除いた候補リスト
    const koutenCandidates = koutenRanking.filter(p => !excludeIds.has(p.id));

    // ① 荒天令上位 かつ ラインTOP（逃/自/両）
    let targetL = koutenCandidates.find(p => lineTops.has(p.id)) || null;

    // ② 荒天令上位の先頭（脚質不問）
    if (!targetL) targetL = koutenCandidates[0] || null;

    // ③ フォールバック：現行ラインTOP優先 → 逃/自+3ボーナス
    if (!targetL) {
        let lCandidates = [];
        if (lineTops.size > 0) {
            lCandidates = [...lineTops]
                .filter(id => !excludeIds.has(id))
                .map(id => {
                    const p = ranking.find(p => p.id === id) || {};
                    let s = (p.final_score || 0) / 10;
                    if (p.is_b1) s += 10;
                    if (p.is_s1) s += 5;
                    return { ...p, lScore: s };
                });
        }
        if (lCandidates.length === 0) {
            lCandidates = ranking
                .filter(p => !excludeIds.has(p.id))
                .map(p => {
                    let s = p.final_score / 10;
                    if (p.is_b1) s += 10;
                    if (p.is_s1) s += 5;
                    if (['逃','自'].includes(p.style)) s += 3;
                    return { ...p, lScore: s };
                });
        }
        lCandidates.sort((a, b) => b.lScore - a.lScore);
        targetL = lCandidates[0] || null;
    }
    if (!targetL) return null;
    return {
        targetL,
        sanrenpuku: [[A.id, B.id, targetL.id], [A.id, C.id, targetL.id]],
        nirentan:   [[A.id, targetL.id], [targetL.id, A.id], [C.id, A.id]]
    };
}

// UIイベント設定
document.querySelectorAll('select').forEach(select => {
    select.addEventListener('change', () => {
        select.blur();
        window.scrollBy(0, 1);
        window.scrollBy(0, -1);
    });
});

// ============================================================
// 🔐 InputGuard : 入力値の正規化・バリデーション・型変換を担う
//                 全ての入力値はこのモジュールを経由してロジックへ渡す
// ============================================================
const InputGuard = (() => {

    // ──────────────────────────────────────────────────────
    // § 1. 内部ユーティリティ
    // ──────────────────────────────────────────────────────

    /** 全角数字 → 半角数字へ変換 */
    function toHalfWidth(str) {
        return String(str).replace(/[０-９]/g, ch =>
            String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
        );
    }

    /** デバッグログへの書き込み（debug-log 要素があれば追記） */
    function log(msg) {
        const el = document.getElementById('debug-log');
        if (el) el.innerHTML += `[InputGuard] ${msg}<br>`;
        app.logMessage(`[InputGuard] ${msg}`);
    }

    // ──────────────────────────────────────────────────────
    // § 2. レース・環境設定系 バリデーション
    //       対象: id="race-info" 配下の各要素
    // ──────────────────────────────────────────────────────

    /**
     * race-type: 未選択ガード
     * @returns {string|null} 選択値、または null（ロック対象）
     */
    function getRaceType() {
        const el = document.getElementById('race-type');
        if (!el || !el.value) {
            log('ERROR: 級班(race-type)が未選択です。計算をロックします。');
            return null;
        }
        return el.value;
    }

    /**
     * bank-name: bankdata.json 取得失敗時のフォールバック（400m）
     * @returns {string} バンク名
     */
    function getBankName() {
        const el = document.getElementById('bank-name');
        const val = el ? el.value : '';
        if (!val || val.trim() === '') {
            log('WARN: バンク名が空値です。デフォルト値(400)を使用します。');
            return '400';
        }
        return val;
    }

    /**
     * wind-direction / wind-speed: 論理矛盾の解消
     * 「none」選択時は wind-speed を強制的に 0 にして disabled 化する。
     * @returns {{ direction: string, speed: number }}
     */
    function getWindInfo() {
        const dirEl   = document.getElementById('wind-direction');
        const speedEl = document.getElementById('wind-speed');
        const dir     = dirEl   ? dirEl.value   : 'none';
        let   speed   = speedEl ? Number(speedEl.value) : 0;

        if (dir === 'none' || dir === '無風') {
            if (speedEl) {
                speedEl.value    = 0;
                speedEl.disabled = true;
            }
            speed = 0;
            log(`INFO: 風向=無風 → 風速を強制的に 0 にセット。`);
        } else {
            if (speedEl) speedEl.disabled = false;
            // サイレント・コレクト: 0.0〜20.0 の範囲外を補正
            if (isNaN(speed) || speed < 0)  { log(`WARN: 風速(${speed})が範囲外 → 0 に補正`); speed = 0; }
            if (speed > 20)                  { log(`WARN: 風速(${speed})が範囲外 → 20 に補正`); speed = 20; }
            speed = Math.round(speed * 10) / 10; // 小数1桁に丸め
        }
        return { direction: dir, speed };
    }

    // ──────────────────────────────────────────────────────
    // § 3. 選手データ入力系 バリデーション
    //       対象: class="player-card" / "player-row" 全7スロット
    // ──────────────────────────────────────────────────────

    /**
     * .score (得点): 全角→半角変換、NaN/空は0、範囲 0〜130 にサイレント補正
     * @param {Element} card - 選手カード要素
     * @param {number}  idx  - 選手番号（ログ用）
     * @returns {number}
     */
    function getScore(card, idx) {
        const el  = card.querySelector('.score');
        if (!el) return 0;
        let raw   = toHalfWidth(el.value);
        let val   = parseFloat(raw);
        if (isNaN(val) || el.value.trim() === '') {
            log(`WARN: 選手${idx}の得点が非数値 → 0 に補正`);
            val = 0;
        }
        if (val < 0)   { log(`WARN: 選手${idx}の得点(${val})が範囲外 → 0 に補正`);   val = 0; }
        if (val > 130) { log(`WARN: 選手${idx}の得点(${val})が範囲外 → 130 に補正`); val = 130; }
        return val;
    }

    /**
     * .recent (3走): 数字以外を即座に 9 へ置換し、必ず3桁の文字列に整形
     * @param {Element} card
     * @param {number}  idx
     * @returns {string} 例: "192"
     */
    function getRecent(card, idx) {
        const el  = card.querySelector('.recent');
        if (!el) return '999';
        // 全角数字を半角変換してから非数字を 9 に置換
        let raw   = toHalfWidth(el.value);
        let clean = raw.replace(/[^0-9]/g, '9');  // 欠・休・英字なども全て 9
        // 3桁に整形（不足は 9 で補填、超過は先頭3桁のみ）
        while (clean.length < 3) clean += '9';
        clean = clean.slice(0, 3);
        if (clean !== raw.slice(0, 3)) {
            log(`INFO: 選手${idx}の3走成績を正規化: "${el.value}" → "${clean}"`);
        }
        el.value = clean; // UIにも反映
        return clean;
    }

    /**
     * .style (脚質): 未選択時のガード
     * @param {Element} card
     * @param {number}  idx
     * @returns {string} "逃" | "自" | "追"
     */
    function getStyle(card, idx) {
        const el  = card.querySelector('.style');
        const val = el ? el.value : '';
        if (!val || !['逃', '自', '追'].includes(val)) {
        log(`WARN: 選手${idx}の脚質が未選択 → "逃" をデフォルト適用`);
        return '逃';
        }
        return val;
    }

    /**
     * .wmark (W印): 未選択時は "無" を返して未定義エラーを回避
     * @param {Element} card
     * @param {number}  idx
     * @returns {string}
     */
    function getWmark(card, idx) {
        const el  = card.querySelector('.wmark');
        const val = el ? el.value : '無';
        return (val && val.trim() !== '') ? val : '無';
    }

    /**
     * ラジオボタン排他制御の整合性確認
     * S1位・B1位がそれぞれ正しく1名選出されているかを検証する。
     * @returns {{ s1Id: number, b1Id: number, valid: boolean }}
     */
    function validateRadioButtons() {
        const s1Checked = document.querySelectorAll('input[name="s-leader"]:checked');
        const b1Checked = document.querySelectorAll('input[name="b-leader"]:checked');

        const s1Id = s1Checked.length === 1 ? Number(s1Checked[0].dataset.id) : -1;
        const b1Id = b1Checked.length === 1 ? Number(b1Checked[0].dataset.id) : -1;

        let valid = true;
        if (s1Checked.length !== 1) {
            log(`WARN: S1位ラジオボタンが ${s1Checked.length} 名選択されています（正: 1名）。`);
            valid = false;
        }
        if (b1Checked.length !== 1) {
            log(`WARN: B1位ラジオボタンが ${b1Checked.length} 名選択されています（正: 1名）。`);
            valid = false;
        }
        return { s1Id, b1Id, valid };
    }

    /**
     * 全7選手のデータを一括バリデーションして配列で返す
     * @returns {Array<Object>}
     */
    function getAllPlayersData() {
        const cards  = document.querySelectorAll('.player-row');
        const result = [];
        cards.forEach((card, i) => {
            const idx      = i + 1;
            const isScratch = card.querySelector('.is-scratch')?.checked ?? false;
            result.push({
                id       : idx,
                name     : card.dataset.name || '',
                isScratch,
                score    : getScore(card, idx),
                recent   : getRecent(card, idx),
                style    : getStyle(card, idx),
                wmark    : getWmark(card, idx),
                isLocal  : card.querySelector('.is-local')?.checked   ?? false,
                isGoldCap: card.querySelector('.is-gold-cap')?.checked ?? false,
            });
        });
        return result;
    }

    // ──────────────────────────────────────────────────────
    // § 4. 展開・スイッチ系 バリデーション
    //       対象: id="line-input-container" 配下
    // ──────────────────────────────────────────────────────

    /**
     * line-input: 許可文字以外を一括削除して純粋な並び文字列に浄化
     * 許可: 1234567 , ( ) [ ] -
     * @returns {string}
     */
    function getLineInput() {
        const el  = document.getElementById('line-input');
        if (!el) return '';
        // 全角数字を半角変換してから不正文字を除去
        let raw   = toHalfWidth(el.value);
        let clean = raw.replace(/[^1-9,\\(\\)\\[\\]\\-]/g, '');
        if (clean !== raw) {
            log(`INFO: 並び入力を浄化: "${el.value}" → "${clean}"`);
            el.value = clean; // UIにも反映
        }
        return clean;
    }

    // ──────────────────────────────────────────────────────
    // § 5. システム基盤: ReadOnly ロック / アンロック
    // ──────────────────────────────────────────────────────

    /** 全入力要素を一時的に無効化（計算中のデータ改ざん防止） */
    function lockAllInputs() {
        document.querySelectorAll(
            'input, select, textarea, button'
        ).forEach(el => {
            el.dataset.prevDisabled = el.disabled; // 元の状態を保存
            el.disabled = true;
        });
        log('INFO: 計算開始 — 全入力をロックしました。');
    }

    /** ロックを解除して元の状態へ復元 */
    function unlockAllInputs() {
        document.querySelectorAll(
            'input, select, textarea, button'
        ).forEach(el => {
            // 元から disabled だった要素はそのまま維持
            el.disabled = el.dataset.prevDisabled === 'true';
        });
        log('INFO: 計算完了 — 全入力のロックを解除しました。');
    }

    // ──────────────────────────────────────────────────────
    // § 6. メイン収集関数
    //       calculatePrediction() から呼び出す統合エントリーポイント
    //       全値を Number() でサイレント・キャストして返す
    // ──────────────────────────────────────────────────────

    /**
     * 全入力値を検証・正規化して構造化オブジェクトとして返す。
     * バリデーションエラーがあれば { valid: false, errors: [...] } を返す。
     * @returns {{ valid: boolean, data?: Object, errors?: string[] }}
     */
    function collectAndValidate() {
        const errors = [];

        // 1) 級班チェック
        const raceType = getRaceType();
        if (raceType === null) errors.push('級班(race-type)が未選択です。');

        // 2) 風向・風速
        const wind = getWindInfo();

        // 3) 選手データ
        const players = getAllPlayersData();

        // 4) ラジオボタン整合性
        const radio = validateRadioButtons();
        if (!radio.valid) errors.push('S1位またはB1位のラジオボタンが正しく設定されていません。');

        // 5) 展開入力
        const lineInput = getLineInput();

        if (errors.length > 0) {
            return { valid: false, errors };
        }

        return {
            valid: true,
            data: {
                raceType,
                bankName: getBankName(),
                modeSelector: getModeSelector(),
                wind,
                players,
                radio,
                lineInput,
            }
        };
    }

    // ──────────────────────────────────────────────────────
    // § 6b. モードセレクタ取得
    // ──────────────────────────────────────────────────────

    /**
     * mode-selector: 荒天令 / 晴天令 モード値を取得
     * @returns {string} "koutenrei" | "seitenrei"
     */
    function getModeSelector() {
        const el = document.getElementById('mode-selector');
        return el ? el.value : 'seitenrei';
    }

    // ──────────────────────────────────────────────────────
    // § 7. 風向セレクト変更時のリアルタイム連動
    //       ページロード後に wind-direction に監視を設定する
    // ──────────────────────────────────────────────────────
    function initWindDirectionWatcher() {
        const dirEl = document.getElementById('wind-direction');
        if (!dirEl) return;
        dirEl.addEventListener('change', () => {
            getWindInfo(); // バリデーション & disabled 制御を即時実行
        });
        // 初期状態の反映
        getWindInfo();
    }

    // Public API
    return {
        collectAndValidate,
        lockAllInputs,
        unlockAllInputs,
        getWindInfo,
        getLineInput,
        getAllPlayersData,
        initWindDirectionWatcher,
        log,
    };
})();

// DOMContentLoaded 後に風向ウォッチャーを初期化
document.addEventListener('DOMContentLoaded', () => {
    InputGuard.initWindDirectionWatcher();
    InputGuard.log('初期化完了 — 入力層堅牢化モジュール(InputGuard)が起動しました。');
});

// ============================================================
// 🔗 calculatePrediction() のラッパー
//    calculatePredictionをグローバルに公開し、ボタンから呼び出せるようにする。
//    内部では、App.calculatePrediction（本体ロジック）をバリデーション付きで呼び出す。
// ============================================================
function initInputGuardWrapper() {
    if (window.App && typeof window.App.calculatePrediction === 'function') {
        const _original = window.App.calculatePrediction;
        InputGuard.log('INFO: App.calculatePredictionを検出しました。ラッパーを設置します。');

        window.calculatePrediction = function() {
            const result = InputGuard.collectAndValidate();
            if (!result.valid) {
                const msg = '⚠️ 入力エラー:\n' + result.errors.join('\n');
                alert(msg);
                InputGuard.log('ERROR: バリデーション失敗 — 計算を中断しました。' + result.errors.join(' / '));
                return;
            }
            InputGuard.lockAllInputs();
            return _original.call(window.App, result.data).finally(() => InputGuard.unlockAllInputs());
        };

        InputGuard.log('ラッパー設置完了 — グローバルな calculatePrediction から App.calculatePrediction を呼び出します。');

    } else {
        setTimeout(initInputGuardWrapper, 50);
    }
}

initInputGuardWrapper();

})(App);
