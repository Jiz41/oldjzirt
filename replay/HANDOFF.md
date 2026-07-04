# 作業引き継ぎ書（リプレイ台プロジェクト）
最終更新: 2026-07-04

## ミッション（発注主の指示・全権委任済み）
1. リプレイ台を建造し oldjzirt に納品（実装は完了次第 commit & push 可、承認不要）
2. リプレイ実験で最良構成を確定し、oldjzirt の keirin_logic.js を最良形に改修して push
3. **HF本番（Jiz41/Jiz41r1t5u）への変更は厳禁。GitHub oldjzirt のみ**

## 現在の状態 【全工程完了 2026-07-04】
- [x] replay/fixtures.json … 718レース（2026-05-17〜07-04）納品済み
- [x] replay/SPEC.md … 仕様書
- [x] replay/engines/ … 歴代6種＋実験候補A/B/C
- [x] replay/dom_stub.mjs, harness.mjs, settle.mjs, run.mjs … 実装完了。718/718走破・skip 0・検算一致率81.6%
- [x] 実験完了。実払戻精算の最終順位:
      現行HEAD(V10.22)      31.8% / 回収56.5%
      旧V10.15エンジン       34.1% / 73.4%
      ★候補A(HEAD+V10.15買い目) 34.3% / 71.7% ← 採用
      候補C(r2=3位固定)      34.0% / 63.8%
- [x] keirin_logic.js を V10.23 として改修（generateSeitenreiBetsをV10.15版に復元）
      リプレイ再検証で候補Aと完全一致を確認（replay/result_v10_23.json）
- [x] push済み

## 残課題（次の一手）
- HF本番(v11)への同修正の移植は**未着手・要ケンさん承認**（本セッションでは本番変更禁止の指示）
- 6/9-16の素点劣化（追捕捉39→28%、微風集中）はv11移行期由来の疑い。v11側の調査はリプレイ台に
  v11エンジンを掛ければ可能（fetchでHFからkeirin_logic.js取得→replay/engines/へ）
- 係数・ロジック変更は今後必ず `node replay/run.mjs --engine <変更版>` で事前計測してから

## ここまでの解析結論（データ源: スプシ「真自在律 精度チェックシート」係数サマリータブ）
- 的中率 = 素点top3精度 × 変換率。4月=15.4%×100%、6月=約8%×68%（A/S級晴天令）
- クロ確定: V10.0〜V10.20の買い目生成（selectR2の順位窓消失、3番手がスコア4〜7位から選出）
- シロ確定（反実仮想検証済み）: c_wmark調整(5/6)・突風境界(5/7)・c_lライン補正(5/13-16)
- 特異点Lの晴天令除外は損（Lがスコア3位のレース14%、外したLの40%が3着内）
- 6/9-16の素点劣化はv11移行期と重なる。V11.0.1シナリオ係数改訂は6/17投入（HF）で起点より後
- ログ逆算の限界: snapshot.final.seiten ≠ 実選出配列（一致86%）→ 正確な比較はリプレイ台必須
- 注意: 単純な「r2=3位固定」だけでは全級・全券種の総合成績は改善しなかった（実測）。
  リプレイ台での正式比較が必要な理由がこれ

## 再開手順（新セッションの場合）
1. このファイルと replay/SPEC.md を読む
2. `cd /root/oldjzirt && git status` で納品状況確認
3. replay/*.mjs が未完成なら SPEC.md を添えて code-writer に再発注
4. 完成済みなら: `node replay/run.mjs --engine keirin_logic.js --verify` → 合格後、
   engines/ 各世代で `--out replay/result_<name>.json` を取り、月別比較
5. 実験勝者を keirin_logic.js に実装（買い目層が本命: selectR2窓/L除外の扱い）
6. `git add replay/ keirin_logic.js && git commit && git push origin main`

## 環境メモ
- Node v22 あり（/usr/bin/node）。push可能なorigin設定済み
- スプシ再取得: gviz CSV export（HANDOFFと同階層のfixturesで基本足りる）
- 解析スクリプト群はセッションscratchpadにあった（消えても本書の結論で足りる）
