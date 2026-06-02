# keirin_logic.js 依存マップ（Ver9.3）

> 改修時の副作用事前把握用監視リスト。  
> 「影響を与える」は「この関数を変えると壊れる可能性がある下流先」を指す。

---

## グローバル定数・変数

| 識別子 | 種別 | 説明 | 参照元 |
|---|---|---|---|
| `COEFFICIENT_SETTINGS` | const | 級班ごとの係数設定（s-kyu/a-kyu等） | `calculateLineCoeffs`, `calculate_koutenrei_bias`, `app.calculatePrediction` |
| `C_MARK_VALUES` | const | W印係数（HIGH/MEDIUM/LOW） | `calculateLineCoeffs`（ガールズモード） |
| `SERI_STYLE_BONUS` | const | 競り判定用脚質ボーナス | `getPlayerData`, `app.calculatePrediction` |
| `SERI_FATIGUE_PENALTY_IN/OUT` | const | 競り消耗率 | `applySeriCorrection` |
| `SERI_WIN_BONUS` | const | 競り勝者ボーナス | `applySeriCorrection` |
| `CalculationSnapshot` | let | 係数スナップショット（外れ解剖用） | `getKururuAdjustment`, `applyPhysicalPenalty`, `applyTacticalAdjustments`, `parseLineInput`, `calculateLineCoeffs`, `app.calculatePrediction` |
| `BANK_DATA` | let | バンクデータ全体（グローバル） | `loadBANK_DATA`, `app.calculatePrediction`, `displayBankTendency` |
| `SUPERIOR_PATTERNS_FINAL_LIST` | const | 壱耀優位パターンリスト（起動時1回評価） | 現在 `generateScenarioWagers` では未使用（参照なし） |

---

## 関数一覧

---

### `resetSnapshot()`
**何をするか**: `CalculationSnapshot` を初期状態に戻す。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `CalculationSnapshot`（グローバル） |
| 影響を与える関数・変数 | `app.getCurrentCoefficients`（返却値がリセットされる） |
| **副作用ポイント** | 計算途中に呼ぶと全スナップショットが消える。`app.calculatePrediction` 冒頭で暗黙的に呼ばれていない点に注意（呼ばれていないため複数レース連続計算でスナップショットが蓄積する） |
| 境界条件 | なし |

---

### `getKururuAdjustment(p, direction, speed, isGirls, lineInput, BANK_DATA)`
**何をするか**: 風速・風向・ライン位置からプレイヤーの最終風圧補正係数 `adj` と実効風速 `v` を返す。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `BANK_DATA`（beta, alpha, straight, wind_direction_map）, `app.logMessage` |
| 影響を与える関数・変数 | `runScenarioSimulation`（`p.final_score *= res.adj`）, `CalculationSnapshot.wind_physics` |
| **副作用ポイント** | `speed <= 1.0` または direction が `none`/`無風` の場合は `adj=1.0` を即返し。`BANK_DATA.beta` が未定義の場合 `beta=1.0` フォールバック。`BANK_DATA.straight` が未定義の場合 `50` フォールバック。`ADJACENT_MAP` にない方角は `vector=0` で無風扱いになる点に注意 |
| 境界条件 | `speed=0`: adj=1.0 / `v<=3.0`: 線形kp / `3<v<=7`: べき乗 / `v>7`: 急増。positionShieldは先行1.0・番手0.65・3番手以降0.50 |

---

### `getPlayerPositions(lines)`
**何をするか**: ライン配列から選手ごとの全体順位・ライン内位置マップを返す。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | なし（純粋関数） |
| 影響を与える関数・変数 | `applyPhysicalPenalty`, `applyTacticalAdjustments` |
| **副作用ポイント** | `lines` の並び順がそのまま全体順位（globalPosition）になる。`parseLineInput` の出力順を変えると順位が変わる |
| 境界条件 | 空ライン `[]` は正常処理されるが globalPosition がインクリメントされる。単騎選手はラインに含まれないためデフォルトで「後方」扱いなし（`positionMap` に存在しない） |

---

### `applyPhysicalPenalty(players, bankData, lines)`
**何をするか**: バンクの直線長に基づき後方選手に `physicalPenalty` を付与する（V9.0物理層）。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `getPlayerPositions(lines)`, `CalculationSnapshot.physical`, `app.logMessage` |
| 影響を与える関数・変数 | `runScenarioSimulation`（`p.final_score *= p.physicalPenalty`）, `shakkou_donperi_core.js`（`app.applyPhysicalPenalty` 経由） |
| **副作用ポイント** | `players` 配列を直接変異（`p.physicalPenalty` を上書き）。`bankData.straight_deviation` 優先、なければ `bankData.straight` フォールバック。`straight < 35m` で極大ペナルティ、`35 <= straight < 50m` で中ペナルティ、`>= 50m` はペナルティなし（1.0） |
| 境界条件 | 4番手以降にのみ適用。`depth=(pos-4)` で7番手=depth3。最低値キャップ: 0.70（極短直線）・0.87（短直線） |

---

### `applyTacticalAdjustments(players, bankData, lines, seriInfos)`
**何をするか**: カントペナルティ（捲り）・イン突きワープブーストを計算し `cantoMakuriPenalty` と `warpBoost` を付与する。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `getPlayerPositions(lines)`, `CalculationSnapshot.tactical`, `app.logMessage` |
| 影響を与える関数・変数 | `runScenarioSimulation`（`p.final_score /= p.cantoMakuriPenalty`, `p.final_score *= p.warpBoost`）, `shakkou_donperi_core.js` |
| **副作用ポイント** | `players` 配列を直接変異。捲りペナルティは `canto > 32度 && style === '両'` にのみ適用。ワープブーストは競り情報の勝者が全体2番手のときのみ発動 |
| 境界条件 | カント閾値: 32度。ワープブースト対象: 全体3〜4番手の選手のみ（×1.35）。`seriInfos` が空または null の場合はワープ非発動 |

---

### `calculateSuperiorityList()`
**何をするか**: 壱耀晴乾ノ象の統計的優位パターンを起動時1回評価してリストを返す。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `SUPERIORITY_THRESHOLD_RATE`, `RAW_COMPOSITE_STATS` |
| 影響を与える関数・変数 | `SUPERIOR_PATTERNS_FINAL_LIST`（現在このリストを直接参照する処理なし） |
| **副作用ポイント** | 定数値のみに依存する純粋関数。閾値変更時はリストが変わる |
| 境界条件 | `hit_rate >= 0.0206` のパターンのみ採用。現在 `"33_差し"` のみ採用 |

---

### `app.logMessage(message)`
**何をするか**: `#debug-log` DOMにタイムスタンプ付きメッセージを追記する（クライアント専用）。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `document.getElementById('debug-log')`（DOM依存） |
| 影響を与える関数・変数 | サーバー側（orchestrator.js）では `console.log` に差し替えられる |
| **副作用ポイント** | DOM非存在時は即 `return`（サーバー側では何もしない）。スクロールはタイマーで遅延（50ms） |
| 境界条件 | なし |

---

### `getPlayerData(playerDataArray)`
**何をするか**: 外部から渡されたプレイヤー生データを内部構造体（係数フィールド込み）に変換する。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `SERI_STYLE_BONUS` |
| 影響を与える関数・変数 | `orchestrator.js` で `basePlayers` を生成するために使用 |
| **副作用ポイント** | `seri_coef` は `score * SERI_STYLE_BONUS * (◎なら1.04)` で計算済み。競り判定の勝者予測に直結するため脚質・W印変更時の影響大 |
| 境界条件 | `playerDataArray` が null/undefined の場合は空配列を返す |

---

### `loadBANK_DATA()`
**何をするか**: `bankdata.json` を `fs.readFileSync` で読み込みグローバル `BANK_DATA` に代入する（サーバー専用）。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `BANK_DATA`（グローバル変数への副作用）, `require('fs')`, `require('path')` |
| 影響を与える関数・変数 | `displayBankTendency`, `getKururuAdjustment`, `applyPhysicalPenalty`, `applyTacticalAdjustments`, `runScenarioSimulation` |
| **副作用ポイント** | 読み込み失敗時はダミーバンクにフォールバック（`straight=400, alpha/beta=未定義`）。クライアント側では `require` が存在しないため実行不可 |
| 境界条件 | `bankdata.json` 不在または破損時はダミーバンクのみで動作 |

---

### `displayBankTendency(bankName)`
**何をするか**: バンク名からバイアス傾向メッセージ・直線/カント警告テキストを生成して返す。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `BANK_DATA`（グローバル） |
| 影響を与える関数・変数 | `displayResults`（UI表示用メッセージ） |
| **副作用ポイント** | バンクが存在しない場合は `{ message: '' }` を返す。バイアス閾値（1.03/0.97）をハードコード |
| 境界条件 | `keirin_bias` に `先行`/`捲り`/`差し` が欠落している場合 1.0 フォールバック |

---

### `parseLineInput(lineInput, allPlayers)`
**何をするか**: 並び文字列をパースし `lines`（ライン配列）・`allSeriInfos`（競り情報）・表示順IDを返す。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `CalculationSnapshot.seri.seri_info`, `app.logMessage`, `allPlayers`（`seri_coef` 参照） |
| 影響を与える関数・変数 | `calculateLineCoeffs`, `calculate_koutenrei_bias`, `runScenarioSimulation`（lines・allSeriInfos受け渡し先） |
| **副作用ポイント** | 競り判定 `followerCoef >= contenderCoef` は `seri_coef` の大小比較。`seri_coef` は `getPlayerData` で計算済み。スコアや脚質変更で競り勝者が反転する。`allParsedIds` Set で重複除去するため同一選手が複数ラインに記載されても1回のみカウント |
| 境界条件 | 競りパターン: `数字(数字)` 形式のみ認識。欠落選手は `calculateLineCoeffs` 側で補完（`parseLineInput` は補完しない）。`allPlayers` が空の場合は競り勝者が不定（coef=0同士で follower 優先） |

---

### `calculateLineCoeffs(players, settings)`
**何をするか**: 欠場除外・ライン解析・C_L（ライン結束力係数）計算を行い参加選手リストを返す。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `parseLineInput`, `COEFFICIENT_SETTINGS`, `C_MARK_VALUES`, `CalculationSnapshot.line_coop`, `app.logMessage`, `document.getElementById('line-input')`（クライアント）|
| 影響を与える関数・変数 | `app.calculatePrediction`（lines, participatingPlayers, allSeriInfos の供給元）, `runScenarioSimulation` |
| **副作用ポイント** | `players` の `p.c_l` を直接変異。ガールズモード（`IS_GIRLS`）でロジック分岐。メインライン特定は「競走得点合計最大ライン」。競り敗者（loser）はC_L計算対象外 |
| 境界条件 | 全選手欠場時は空配列返却。ライン未入力時は全選手単騎扱い（`parseLineInput` に依存）。2番手の `diffFactor` は diff>=10→0.3 / >=5→0.6 / >=0→1.0 / <0→1.3 |

---

### `applySeriCorrection(scoredPlayers, allSeriInfos)`
**何をするか**: 競り勝者に微増/消耗、敗者に大幅減点を `final_score` に乗算する。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `SERI_FATIGUE_PENALTY_IN`, `SERI_FATIGUE_PENALTY_OUT`, `SERI_WIN_BONUS`, `app.logMessage` |
| 影響を与える関数・変数 | `runScenarioSimulation`（シナリオごとに適用） |
| **副作用ポイント** | `scoredPlayers` を直接変異（`final_score` 上書き）。競り情報がない場合はスキップ。全シナリオ（先行/捲り/差し）で毎回適用されるため影響が3倍に増幅される点に注意 |
| 境界条件 | 勝者消耗率: `×(1+0.05)×(1-0.15)` = 実質 `-10.25%`。敗者: `×(1-0.25)` = `-25%` |

---

### `getScenarioCoeffs(scenario)`
**何をするか**: シナリオ名から脚質ごとのC_D係数を返す（純粋関数）。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | なし |
| 影響を与える関数・変数 | `runScenarioSimulation`（`p.final_score *= cD`） |
| **副作用ポイント** | シナリオ名のタイポで全係数1.0になるサイレント失敗。3シナリオ以外の文字列はデフォルト全1.0 |
| 境界条件 | 有効値: `'先行有利'`/`'捲り有利'`/`'差し有利'` のみ |

---

### `generateScenarioWagers(results, v)` ⚠️ クライアント専用
**何をするか**: シナリオ結果上位3名から三連単・三連複・壱耀メッセージを生成する（クライアント版WEB UIのみ使用）。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `document.getElementById('tenun-index-output')`（DOM依存）|
| 影響を与える関数・変数 | クライアントUIの予想表示のみ（サーバー側では未使用） |
| **副作用ポイント** | ⚠️ `r[3]`（4番手選手ID）を三連複の2点目に使用中: `[r[0], r[1], r[3]]`。これは仕様（4番手を三連複に含める）だが、`generateSeitenreiBets` とは設計が異なる点に注意。天雲指数テキストをDOMから読み取るため、`tenun-index-output` が未更新だと壱耀判定がずれる |
| 境界条件 | `results.length < 3` で `---` 返却。`r.length < 4` の場合 tri2 が空文字（三連複1点のみ） |

---

### `assignFinalGrades(scenarioPlayers)`
**何をするか**: `final_score` の分布から1〜10段階の強度グレードと強度矢印を付与する。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | なし（`scenarioPlayers` 配列を直接変異） |
| 影響を与える関数・変数 | `runScenarioSimulation`（各シナリオ結果の表示データ） |
| **副作用ポイント** | `scenarioPlayers` はスコア降順ソート済みを前提。`range === 0`（全員同点）時は全員グレード1。矢印計算は `range/1000` 基準のため高スコアレースほど矢印が動きにくい |
| 境界条件 | grade = `Math.ceil(1 + 9 * normalized)` → 最低1・最高10 |

---

### `calculate_koutenrei_bias(players, scenario, BANK_DATA, v, lineInput, settings)`
**何をするか**: 荒天令専用の10種補正係数（C_risk〜C_cap）を `final_score` に乗算する。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `parseLineInput`（内部で再呼び出し）, `COEFFICIENT_SETTINGS`, `app.logMessage` |
| 影響を与える関数・変数 | `runScenarioSimulation`（`applyKoutenrei=true` のとき） |
| **副作用ポイント** | `JSON.parse(JSON.stringify(players))` でディープコピーして操作するため元の `basePlayers` は変更されない。`parseLineInput` を **再度呼び出す**（`calculateLineCoeffs` とは独立）。C_capは `final_score / originalBase < 0.85` を下限保証（originalBase = `p.score`） |
| 境界条件 | `scoreRange === 0` 時に除算ゼロ危険（C_split・C_recovery）。C_suicide発動条件: ライン長>=3 && wmark付き選手3名 && 先行/自在/両選手あり |

---

### `runScenarioSimulation(basePlayers, allSeriInfos, settings, BANK_DATA, applyKoutenrei, lineInput, windSpeed, windDirection, lines)`
**何をするか**: 3シナリオ（先行/捲り/差し）を並列実行し統合スコアと全シナリオ結果を返す。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `getScenarioCoeffs`, `applyPhysicalPenalty`, `applyTacticalAdjustments`, `getKururuAdjustment`, `applySeriCorrection`, `calculate_koutenrei_bias`（koutenreiモード時）, `assignFinalGrades`, `app.logMessage` |
| 影響を与える関数・変数 | `calculateTenunIndex`（スコア入力元）, `orchestrator.js`（`seitenResult`/`koutenResult`）, `app.calculatePrediction` |
| **副作用ポイント** | `JSON.parse(JSON.stringify(basePlayers))` でコピーするが `applyPhysicalPenalty`/`applyTacticalAdjustments` はコピー後の配列を変異させる。`integratedScores` は3シナリオのスコア単純合算（割り算なし）。`basePlayers` 自体は変更されないが `CalculationSnapshot` は各シナリオで上書きされる |
| 境界条件 | `applyKoutenrei=false` → 晴天令。`true` → 荒天令。`windSpeed=0` または `direction='無風'` で kururu は adj=1.0。`v = scenarioPlayers[0].v_for_wager` は最初のシナリオ選手[0]から取得 |

---

### `calculateTenunIndex(seitenreiScores, koutenreiScores, allScenarioResults, participatingPlayers, windSpeedOverride)`
**何をするか**: 晴天令・荒天令Top3の一致数から天雲指数（0/33/67/100）を算出し壱耀判定も行う。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `app.generateTamakiTenunHTML`（外部定義・tamaki_speech.js）, `app.logMessage`, `__shared.currentWindSpeed`（サーバー）または `document.getElementById('wind-speed')`（クライアント） |
| 影響を与える関数・変数 | `orchestrator.js`（`tenunData` として使用）, `displayResults`, `generateSeitenreiBets`, `generateKoutenreiBets` |
| **副作用ポイント** | `rankingWithData` = 晴天令ランキング, `koutenRankingWithData` = 荒天令ランキング。両者はこの関数内で独立して構築される。`windSpeedOverride` 未指定時のDOM参照が存在するためサーバー側では必ず引数渡しが必要。`participatingPlayers.find` で ID不一致の場合 `pData=undefined` → `{ ...undefined }` = `{}` となり `id` フィールドが欠落する危険あり |
| 境界条件 | ranking長 < 3 で早期リターン（指数50）。壱耀発動条件: `tIndex===33 && windSpeed<=2.0 && style==='追'or'両' && wmark==='◎'` |

---

### `app.calculatePrediction()` ⚠️ クライアント専用
**何をするか**: ブラウザUI上の全入力値を読み取り晴天令・荒天令シミュレーションを実行して結果を描画する。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `calculateLineCoeffs`, `runScenarioSimulation`（×2）, `calculateTenunIndex`, `displayResults`, `COEFFICIENT_SETTINGS`, `BANK_DATA`, `CalculationSnapshot`, `app.invokeShakkouDonperi`（shakkou_donperi_core.js）, DOM全般 |
| 影響を与える関数・変数 | UI描画全体（`#results-container`）, `CalculationSnapshot.scores` |
| **副作用ポイント** | GoldCap補正（スコア<95.0を95.0に強制）はこの関数内のみで実施。`BANK_DATA` が空の場合は再ロードを試みる（`await loadBANK_DATA()`）。サーバー側（orchestrator.js）ではこの関数は使用されない（orchestrator.jsが直接 `runScenarioSimulation` 等を呼ぶ） |
| 境界条件 | 参加選手0名でアラート+早期リターン |

---

### `getStrengthColor(score, minScore, maxScore)`
**何をするか**: スコアから強度を表すRGB色文字列を返す（純粋関数）。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | なし |
| 影響を与える関数・変数 | `displayResults`（lineStrength用） |
| 境界条件 | `maxScore === minScore` で灰色 `rgb(142,142,142)` 固定返却 |

---

### `getTextColor(rgbColor)`
**何をするか**: RGB文字列から輝度を計算し `#333`（明）または `#fff`（暗）を返す（純粋関数）。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | なし |
| 影響を与える関数・変数 | クライアントUI（テキスト色） |
| 境界条件 | 正規表現不一致時 `#fff` フォールバック |

---

### `displayResults(...)`
**何をするか**: 晴天令・荒天令スコア・天雲指数・買い目を統合して表示データオブジェクトを返す。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `displayBankTendency`, `getStrengthColor`, `generateSeitenreiBets`, `generateKoutenreiBets` |
| 影響を与える関数・変数 | クライアントUI（`app.calculatePrediction` から呼ばれる） |
| **副作用ポイント** | `generateKoutenreiBets` に渡す ranking は `tenunIndexData.rankingWithData`（晴天令ランキング、これは仕様）。`seitenTop3Ids` は同ランキングの上位3名。`seitenreiIntegratedScores` の値を `/3` で正規化してlineStrength色計算に使用 |
| 境界条件 | `tenunIndexData.rankingWithData` が空だと `seitenTop3Ids` が空Setになり `generateKoutenreiBets` のL候補フィルタが晴天令除外を行わない |

---

### `formatOrderedBet(bet)` / `formatSanrenpuku(bet)`
**何をするか**: 買い目配列を `-` 区切り（順序あり）または `=` 区切り昇順（三連複）にフォーマットする。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | なし（純粋関数） |
| 影響を与える関数・変数 | 現状クライアントUIのみで参照。orchestrator/formatter.jsは独自フォーマットを使用 |
| 境界条件 | `bet` が空配列の場合 `''` を返す |

---

### `generateSeitenreiBets(ranking)`
**何をするか**: 晴天令ランキングTop3から三連単4点・三連複1点を生成する。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `ranking`（`calculateTenunIndex` の `rankingWithData`） |
| 影響を与える関数・変数 | `displayResults`, `orchestrator.js`（`seitenBets`として返却）, `formatter.js`（Discord出力） |
| **副作用ポイント** | `ranking.slice(0, 3)` でTop3に封鎖済み（`r[3]`以降混入不可）。`r` は3要素のみ |
| 境界条件 | `ranking.length < 3` で `null` 返却。三連単は `r[0]`/`r[1]`/`r[2]` の4通りの順列（点1・2はr0軸、点3・4はr1軸） |

---

### `generateKoutenreiBets(ranking, seitenTop3Ids = new Set())`
**何をするか**: 晴天令ランキング（荒天令用途）からA/B/C（Top3）と特異点Lを選出し三連複2点・二車単3点を生成する。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `ranking`（晴天令ランキング：仕様）, `seitenTop3Ids`（A/B/C除外用Set） |
| 影響を与える関数・変数 | `displayResults`, `orchestrator.js`（`koutenBets`として返却）, `formatter.js`（Discord出力） |
| **副作用ポイント** | `excludeIds = {A.id, B.id, C.id, ...seitenTop3Ids}` でL候補を除外。ID除外方式のためTop3が重複出現しても確実に除外される。`lScore = final_score/10 + B1ボーナス(+10) + S1ボーナス(+5) + 追/両ボーナス(+3)` |
| 境界条件 | `ranking.length < 4` で `null` 返却。全候補が除外された場合（全選手がTop3）は `targetL=undefined` → `null` 返却 |

---

## InputGuard モジュール（IIFE）

### `collectAndValidate()`
**何をするか**: 全入力値を一括バリデーションして構造化オブジェクトを返す統合エントリーポイント。

| 項目 | 内容 |
|---|---|
| 依存する関数・変数 | `getRaceType`, `getWindInfo`, `getAllPlayersData`, `validateRadioButtons`, `getLineInput`, `getLocalSwitch`, `getBankName` |
| 影響を与える関数・変数 | クライアントUI（`calculatePrediction` ラッパーから呼ばれる） |
| **副作用ポイント** | `getWindInfo` は DOM の `speedEl.disabled` を変更する副作用あり。`getRecent` は `el.value`（DOM）を書き換える |
| 境界条件 | `valid: false` 時は `errors` 配列に理由が入る |

### `getScore / getRecent / getStyle / getWmark`
**何をするか**: 選手カードの各入力値を取得・正規化する。

| 関数 | 補正内容 |
|---|---|
| `getScore` | 全角→半角, NaN→0, 範囲外→0or130にサイレント補正 |
| `getRecent` | 全角→半角, 非数字→9, 3桁に整形 + DOM書き換え |
| `getStyle` | 未選択時 `'逃'` デフォルト |
| `getWmark` | 空値時 `'無'` フォールバック |

### `lockAllInputs / unlockAllInputs`
**副作用ポイント**: `el.dataset.prevDisabled` に元の disabled 状態を保存。再度 `lock` を呼ぶと上書きされる点に注意。

---

## 依存フロー全体図

```
[DOM入力 / orchestrator.js]
        │
        ▼
  getPlayerData() ──→ basePlayers
        │
        ▼
  calculateLineCoeffs()
  ├─ parseLineInput()        → lines, allSeriInfos
  └─ C_L係数付与             → participatingPlayers.c_l
        │
        ▼
  runScenarioSimulation() ×2（晴天令・荒天令）
  ├─ applyPhysicalPenalty()
  ├─ applyTacticalAdjustments()
  ├─ getKururuAdjustment()   → adj, v
  ├─ applySeriCorrection()
  ├─ calculate_koutenrei_bias()（荒天令のみ）
  ├─ getScenarioCoeffs()
  └─ assignFinalGrades()
        │
        ▼
  calculateTenunIndex()
  ├─ rankingWithData          → 晴天令ランキング
  └─ koutenRankingWithData    → 荒天令ランキング
        │
        ▼
  generateSeitenreiBets(rankingWithData)     → seitenBets
  generateKoutenreiBets(rankingWithData, …)  → koutenBets
        │
        ▼
  [formatter.js → Discord]
  [displayResults → クライアントUI]
```

---

## 改修時に特に注意すべきクロスカット項目

| # | 項目 | 影響範囲 |
|---|---|---|
| 1 | `SERI_STYLE_BONUS` 変更 | `getPlayerData`の`seri_coef` → 競り勝者判定反転の可能性 |
| 2 | `parseLineInput` 競りパターン変更 | `allSeriInfos` 全体 → `applySeriCorrection` + `applyTacticalAdjustments` |
| 3 | `applyPhysicalPenalty` 閾値変更 | `runScenarioSimulation` 両令（晴天・荒天）に波及 |
| 4 | `calculateTenunIndex` の `rankingWithData` 構築ロジック変更 | `generateSeitenreiBets` / `generateKoutenreiBets` の入力が変わり買い目全変更 |
| 5 | `generateKoutenreiBets` の `lScore` 計算変更 | 特異点L選出結果 → 荒天令三連複・二車単全点変更 |
| 6 | `COEFFICIENT_SETTINGS` 係数変更 | `calculateLineCoeffs` C_L / `runScenarioSimulation` シナリオ係数 両方に波及 |
| 7 | `calculate_koutenrei_bias` デバフ上限（0.85キャップ）変更 | 荒天令スコア全体 → 荒天令ランキング順序変化 |
