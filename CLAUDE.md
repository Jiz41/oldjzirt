# 真・自在律 — 自在律専用設定

## プロダクト定義
自在律（華耀天輪 真・自在律）は競輪予想支援ツール。
感情バイアスを排除した計算機として設計。オッズを無視してレース結果のみに集中する哲学を持つ。
本番：https://huggingface.co/spaces/Jiz41/Jiz41r1t5u

---

## ファイル構成・読込順

### スクリプト読込順（index.html defer）

```
var App = {};                    ← グローバルオブジェクト宣言（インライン）
tamaki_speech.js                 ← 玉木UIコンポーネント
kiyone_voice.js                  ← キヨネ音声UI
shakkou_donperi_display.js       ← 赤口呑縁 表示層
shakkou_donperi_core.js          ← 赤口呑縁 コア計算（app.invokeShakkouDonperi）
keirin_logic.js                  ← 予想ロジック本体（app.calculatePrediction）
LogModule.js                     ← GASへのログ送信（app.sendLog）
meigen.js                        ← 名言システム
paste-input.js                   ← テキスト貼付解析
```

> **地雷**: `var App = {}` はインラインで先行宣言必須。defer JSがAppを参照するため、このタグが欠けると全スクリプトが即死する。

### CSS
```
style.css                  ← メインスタイル
kiyone_cyberpunk_addon.css ← キヨネパネル追加スタイル
```

### データファイル
```
bankdata.json   ← 全競輪場バンクデータ（keirin_logic.js が fetch で動的ロード）
manifest.json   ← PWA設定
sw.js           ← Service Worker（CACHE_NAME='jiz41-v1'、cache-first）
```

> **地雷**: sw.js の CACHE_NAME は自動インクリメントなし。手動更新しないとPWAキャッシュが古いまま残る。

---

## ファイルバージョン管理ルール

**いずれかのファイルを変更した際は、そのファイルのバージョン番号を必ず更新すること。**

| ファイル | バージョン管理方法 | 更新タイミング |
|---|---|---|
| keirin_logic.js | 冒頭 `// LOGIC VERSION: X.X` ＋ `// 【VX.X】変更概要` | 変更のたびに必ず |
| shakkou_donperi_core.js | 冒頭 `// VERSION: X.X` | 変更のたびに必ず |
| shakkou_donperi_display.js | 冒頭 `// VERSION: X.X` | 変更のたびに必ず |
| paste-input.js | 冒頭 `// VERSION: X.X` | 変更のたびに必ず |
| style.css | 冒頭コメント内 `vX.X` | 変更のたびに必ず |
| index.html | `<meta name="app-version">` のパッチ番号 (+0.0.1) | 変更のたびに必ず |
| sw.js | push.sh が自動更新（手動不要） | — |

- keirin_logic.js のバージョン履歴コメントフォーマット：`// 【VX.X】変更概要（1〜2行）`
- それ以外のファイルは `// VERSION: X.X` の数字をインクリメントするのみでよい。
- 同リポジトリの keirin-proxy-ii/keirin_logic.js も同期変更した場合は両方に追記すること。

---

## UI表現ルール（ケンさんとの会話）

ケンさんへの報告・会話では必ずUI表現を使うこと。コード内の変数名・value値はそのまま維持してよい。

| UI表現（使う） | 内部値（コード内のみ） |
|---|---|
| 逃先 | `'逃'` |
| 差マ | `'追'` |
| 捲り | `'自'` |

---

## 係数定義

### COEFFICIENT_SETTINGS（レース種別ごとのパラメータ）

```js
's-kyu':  { R_BIAS:1.15, RECENT_WEIGHT:0.90, COOP_WEIGHT:1.20, IS_GIRLS:false, SUICIDE_LIMIT:0.97 }
'a-kyu':  { R_BIAS:1.00, RECENT_WEIGHT:1.00, COOP_WEIGHT:1.00, IS_GIRLS:false, SUICIDE_LIMIT:0.93 }
'a-chal': { R_BIAS:0.90, RECENT_WEIGHT:1.20, COOP_WEIGHT:0.80, IS_GIRLS:false, SUICIDE_LIMIT:0.90 }
'girls':  { R_BIAS:1.00, RECENT_WEIGHT:1.10, COOP_WEIGHT:1.00, IS_GIRLS:true,  SUICIDE_LIMIT:1.00 }
```

### C_l（ライン協調係数）
```
先頭:      c_l = 1.00
2番手:     c_l = 1.0 + COOP_WEIGHT * 0.05（A級=1.05, S級=1.06, チャレ=1.04）
3番手:     c_l = 1.0 + COOP_WEIGHT * 0.03 ← メインラインのみ、非メインは1.00
4番手以降: c_l = 1.00
ガールズ:  2番手のみ固定ボーナス（エースマークあり=1.04、なし=1.02）
```

### SERI_STYLE_BONUS（競り係数）
```js
'逃': 1.08  // それ以外はすべてフォールバック 1.00
```
- 競り勝者: `final_score × (1+0.05) × (1-0.15)`
- 競り敗者: `final_score × (1-0.25)`

### 荒天令（calculate_koutenrei_bias）発動条件
```
C_risk    : score < avgScore-2 かつ recentAvg >= 4.0 → ×0.97
C_mental  : S級 or scoreMax保持者 かつ recent[0]='1' → ×(1-v*0.005)
C_recovery: style=追/両 かつ scoreDiffRatio > 0.6 → ×(1.04 + α)
C_target  : scoreMax保持者 かつ rivalAutos >= 2 → ×(1-v*0.007)
C_split   : ライン間スコア差が大きい場合 → 上位ライン有利
C_suicide : 自滅ライン検出時 → ×SUICIDE_LIMIT（下限キャップ付き）
```
> 後転（kouten）側にのみ適用。前転（seiten）には適用されない。

---

## 計算フロー

### calculatePrediction() の処理順序
```
1.  resetSnapshot()
2.  collectAndValidate() でUI入力を収集・検証
3.  GCボタン判定 → score < 95.0 なら score=95.0 に強制上書き
4.  basePlayers 構築（seri_coef算出含む）
5.  parseLineInput() → lines, allSeriInfos, seriLoserIds を返す
6.  C_l, c_recent, c_score_adj, c_wmark, c_s1, c_b1, c_e を付与
7.  runScenarioSimulation(seiten) → 3シナリオ × integratedScores
8.  runScenarioSimulation(kouten) → 同上
9.  calculateTenunIndex() → tenunIndex, message, targetPlayerId
10. generateSeitenreiBets() / generateKoutenreiBets() → 買い目生成
11. app.invokeShakkouDonperi() → 1465世界線モンテカルロ（非同期）
12. app.sendLog() → GASエンドポイントへスナップショット送信
```

### runScenarioSimulation の内部順序（1シナリオ分）
```
1. applyPhysicalPenalty()
2. applyTacticalAdjustments()
3. final_score = score * c_score_adj * c_wmark * c_recent * c_s1 * c_b1 * c_l * c_e
4. physicalPenalty/cantoMakuriPenalty/warpBoost 乗算
5. getKururuAdjustment() → 風補正
6. applySeriCorrection() → 競り勝敗補正
7. calculate_koutenrei_bias() → 荒天令補正 ※koutenのみ
8. c_D シナリオ係数 × final_score
9. integratedScores に累積
```

---

## 依存関係・注意事項

### 依存関係グラフ
```
keirin_logic.js
  ├─ bankdata.json               （fetch動的ロード、失敗時はダミーバンクでフォールバック）
  ├─ app.invokeShakkouDonperi    （shakkou_donperi_core.js が注入）
  ├─ app.generateTamakiTenunHTML （tamaki_speech.js が注入）
  ├─ app.startShakkouCalculation / completeShakkouCalculation（表示層が注入）
  └─ app.sendLog                 （LogModule.js が注入）
```
> keirin_logic.js 単体では動かない。全て注入パターン。

### GCボタンの設計意図と限界
- **設計**: 金帽（部分データしかない期初新人）の過小評価を補正
- **実態**: score=0のルーキーに使うと c_score_adj=0.95 → scoreMax奪取でC_target誤発動・mainLine誤選出のリスクあり

### 0.85下限キャップの条件
```js
if (p.score > 0) {
  if (p.final_score / originalBase < 0.85) p.final_score = originalBase * 0.85;
}
```

### index.html 変更ルール
**index.html への変更は事前にDiscordで変更内容を報告し、ケンさんの許可を得てから実施すること。無断変更は絶対禁止。**

---

## 棚卸しルール（2026/05/26 確定）

### 静的スキャン
- **頻度**: 毎月最終金曜日深夜（cron自動実行）
- **スキップ条件**: 直近7日以内に手動棚卸し実施済みの場合は省略
- **対象ファイル**: `keirin_logic.js` / `shakkou_donperi_core.js`
- **チェック項目**:
  1. 未使用変数・未接続係数
  2. 死にコード（完全未使用）
  3. 冗長コード（あっても影響ゼロ）
  4. 読んで意図が即わからない箇所

### 動的照合（実績データとの突き合わせ）
- **頻度**: 2ヶ月に1回（静的スキャンの偶数回実行時）
- **対象**: 動いているが正しくない系
- **データ**: `/storage/emulated/0/Download/QuickShare/ハズレ解析*月分*.csv`

### 重篤度分類
| ランク | 温度感 |
|---|---|
| S | 直ちに修正必要・アプリ存続の危機レベル |
| A | 早急に対処すべき・予測精度に直結 |
| B | 近いうちに直したい・じわじわ影響あり |
| C | 直接ダメージなし・邪魔だからそのうち治そう |

### レポート出力ルール
- 出力先：Discord
- コード用語は使わず平易に説明
- 何の係数か・何に影響するか・どうすればいいかの3点を簡潔に
- ファイル名と行番号を明記
- 読み取り専用。ファイルの修正・削除は一切行わない
- 初回実行はケンさんからの指示を待つこと

---

## 将来構想

### 動的優位パターン計算（壱耀晴乾ノ象 次世代実装）
- **構想**: バンク × 脚質 × 決まり手の組み合わせごとに的中率を動的計算し、展開補正・買い目選出に反映
- **実装検討タイミング**: データが10,000件規模に達した段階
- **現状**: 天雲指数33 × 差マ の優位性は `calculateTenunIndex()`・`generateScenarioWagers()` にハードコード実装済み
- **原型**: V10.10で削除した `RAW_COMPOSITE_STATS` / `calculateSuperiorityList()` 等がその設計原型

---

## keirin-proxy-ii 保留事項
- **競り（ジカ宣言）スクレイプ対応**: winticket の競り要素の aria-label 実値が未確認のため保留。
  競りが表示されているレースのHTMLを実取得できるタイミングで対応。
  対応箇所: scraper.js の scrapeWinticket() → orchestrator.js に seris 受け渡し → lineInput に n(m) 形式で埋め込み。
