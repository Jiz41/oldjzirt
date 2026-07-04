# 作業引き継ぎ書（リプレイ台プロジェクト）
最終更新: 2026-07-04

## ミッション（発注主の指示・全権委任済み）
1. リプレイ台を建造し oldjzirt に納品（実装は完了次第 commit & push 可、承認不要）
2. リプレイ実験で最良構成を確定し、oldjzirt の keirin_logic.js を最良形に改修して push
3. **HF本番（Jiz41/Jiz41r1t5u）への変更は厳禁。GitHub oldjzirt のみ**

## 現在の状態
- [x] replay/fixtures.json … 718レース（2026-05-17〜07-04、lines必須のため5/17以降のみ）納品済み
- [x] replay/SPEC.md … リプレイ台仕様書 納品済み
- [x] replay/engines/ … 歴代エンジン6種（v10_13_0524 / v10_14_0525 / v10_15_0531 / v10_21_0602 / v10_22_0608 / v10_head）構文OK
- [ ] replay/dom_stub.mjs, harness.mjs, settle.mjs, run.mjs … **code-writerサブエージェントが実装中**（中断時はSPEC.mdから再発注）
- [ ] 検算: `node replay/run.mjs --engine keirin_logic.js --verify` 一致率70%以上で合格
- [ ] 実験: エンジン6種 × 買い目方式で718レース総当たり、月別的中率・回収率（実払戻精算）
- [ ] 改修: 勝った構成を keirin_logic.js に反映 → リプレイ台で再検証 → push

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
