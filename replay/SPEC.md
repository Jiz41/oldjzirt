# リプレイ台（replay harness）仕様書

## 目的
過去レースのログ入力（fixtures.json, 718レース）に対して keirin_logic.js（任意バージョン）を
Node上でそのまま実行し、買い目を再生成→実払戻金で精算し、的中率・回収率を算出する。

## 構成（replay/ 配下）
- `fixtures.json` … 抽出済み入力データ（納品済み・変更禁止）
- `dom_stub.mjs` … documentスタブ
- `harness.mjs` … エンジンローダ＋1レース実行器
- `run.mjs` … CLI。全レース実行→集計JSON/表を出力
- `settle.mjs` … 精算（的中判定・回収計算）

## dom_stub.mjs
- `document.getElementById(id)` は id ごとに `{value, innerHTML, innerText, style:{}, classList:{add(){},remove(){},toggle(){}}, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[], appendChild(){}, blur(){}}` 形の要素を返す（毎回同一インスタンス、Mapでキャッシュ）
- レースごとに値を注入する API: `setInputs({ 'wind-speed': '1.5', 'wind-direction': '西', 'bank-name': '🐓取手', 'race-type': 'a-kyu', 'line-input': '123,45,67', 'mode-selector': 'seitenrei', ... })`
- `document.querySelectorAll` は `[]`、`document.querySelector` は `null`、`document.body/documentElement` はダミー要素
- `window`, `navigator`, `localStorage`(メモリ実装), `alert(){}` も用意

## harness.mjs
- `node:vm` で keirin_logic.js のソースを実行（`new vm.Script` + context）。
  contextに `document/window/app={}/fetch/console/setTimeout/localStorage/alert/navigator` を注入
- `fetch` スタブ：
  - `bankdata.json` へのリクエスト → リポジトリ直下の bankdata.json（または引数で指定されたパス）を返す
  - GAS/その他URL → `{ok:true, json:async()=>({}), text:async()=>''}` を返し、**ペイロードを捕獲してrecorderに保存**
- `Math.random` は mulberry32 で race_id シードに差し替え（再現性確保）
- `setTimeout(fn, ms)` は即時実行（awaitの100ms待ちを潰す）
- 1レース実行API: `await runRace(engineSource, fixture, options)` → 返り値
  `{ seitenBets, koutenBets, snapshot, logs }`
  - 買い目は sendLog 捕獲ペイロード（`{seiten: html, kouten: html}`）から抽出。
    抽出正規表現は fixtures 抽出と同じ：三連単/三連複/二車単 `<li>` リスト
  - sendLog が発火しない構成（審眼八卦スキップ等）に備え、`app.getCurrentCoefficients()` から
    snapshot も取得
- guardedDataの組み立て：
  `{ raceType, bankName, modeSelector:'seitenrei', players, radio:{s1Id,b1Id}, lineInput }`
  players は fixture.players をそのまま（scoreはgoldcap適用済みの実測値なので isGoldCap:false）
- 実行順：setInputs → `app.calculatePrediction(guardedData)` を await

## settle.mjs
- 晴天令: 3連単リスト（100円/点）＋3連複リスト（100円/点）
- 荒天令: 3連複リスト＋二車単リスト（100円/点）
- 的中判定: 3連単=完全一致、3連複=集合一致、二車単=1着2着完全一致
- 払戻: fixtures.payouts（100円あたり円）。的中した券種ごとに加算
- レース単位の出力: `{cost, ret, hitAny, hitSeiten, hitKouten}`

## run.mjs（CLI）
```
node replay/run.mjs --engine keirin_logic.js [--bankdata bankdata.json] [--filter grade=a-kyu] [--out result.json]
```
- 全fixtures実行、月別・級別に n/的中率/投入/回収/回収率 を表出力＋JSON保存
- **検算モード** `--verify`：再生成した晴天令買い目と fixtures.logged_bets の一致率を表示。
  現行HEADのkeirin_logic.jsで6/2以降のレース一致率が70%以上であることを合格基準とする
  （ログ由来の乱数・審眼八卦入力までは再現できないため100%は不可能）

## 制約・注意
- keirin_logic.js 本体は一切変更しない（読むだけ）。触る前に docs/keirin_logic_dependency_map.md を参照
- 競輪ドメイン前提（.claude/rules/keirin-domain.md）：7車立て、車番1-7、フォールバック不問
- エラーで落ちるレースは捕捉してスキップ数を報告（無言で握り潰さない）
- 出力省略禁止。コード全文を書くこと
