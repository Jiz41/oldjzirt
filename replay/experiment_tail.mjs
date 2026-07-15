// 尻尾捕獲実験: 追加候補買い目の単独回収率を計測（エンジン・fixtures 不変）
// usage: node experiment_tail.mjs <fixtures.json>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine, parseBets } from '/home/user/oldjzirt/replay/harness.mjs';

const repo = '/home/user/oldjzirt';
const fixtures = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const engine = createEngine(path.join(repo, 'keirin_logic.js'), path.join(repo, 'bankdata.json'));
const setKey = a => [...a].map(Number).sort((x, y) => x - y).join('=');

const results = [];
for (const fx of fixtures) {
  try {
    const { seitenHtml, koutenHtml, snapshot } = await engine.runRace(fx);
    const sTans = parseBets(seitenHtml, '三連単');
    if (!sTans.length) continue;
    const sPuks = parseBets(seitenHtml, '三連複').map(b => setKey(b.split('=')));
    const kPuks = parseBets(koutenHtml, '三連複').map(b => setKey(b.split('=')));
    const kTans2 = parseBets(koutenHtml, '二車単');

    // 晴天ランキング（snapshot.scores.final.seiten 降順）
    const fin = snapshot?.scores?.final || {};
    const seitenScores = fin.seiten || {};
    const rank = Object.keys(seitenScores).map(Number).sort((a, b) => seitenScores[b] - seitenScores[a]);
    const [r0, r1] = rank;

    // 特異点L（荒天HTMLから）
    const lm = /特異点[：:]\s*(\d)/.exec(koutenHtml || '');
    const L = lm ? Number(lm[1]) : null;

    // メインライン=得点合計最大（calculateLineCoeffs 定義）、サブライン=それ以外で得点合計最強の2人以上ライン
    const scoreOf = id => (fx.players.find(p => p.id === id)?.score) || 0;
    const lines = (fx.lines || []).filter(l => l.length >= 2);
    const sorted = [...lines].sort((a, b) => b.reduce((s, id) => s + scoreOf(id), 0) - a.reduce((s, id) => s + scoreOf(id), 0));
    const main = sorted[0] || null;
    const sub = sorted[1] || null;

    const res = fx.result.split('-').map(s => s.trim());
    const res3tan = res.join('-');
    const res3puku = setKey(res);
    const pay = fx.payouts;

    const existingPuk = new Set([...sPuks, ...kPuks]);
    const cands = {};
    if (sub && r0 !== undefined) cands.E1_suji_r0 = { type: 'puk', key: setKey([sub[0], sub[1], r0]) };
    if (sub && r1 !== undefined) cands.E5_suji_r1 = { type: 'puk', key: setKey([sub[0], sub[1], r1]) };
    if (L && r0 !== undefined && r1 !== undefined && L !== r0 && L !== r1) {
      cands.E3_L2着_3tan = { type: 'tan', key: `${r0}-${L}-${r1}` };
      cands.E4_L込み_3puku = { type: 'puk', key: setKey([L, r0, r1]) };
    }

    const row = { date: fx.date, tenun: fx.tenun ?? null, grade: fx.raceType, payTan: pay.sanrentan, payPuk: pay.sanrenpuku };
    for (const [name, c] of Object.entries(cands)) {
      const dup = c.type === 'puk' ? existingPuk.has(c.key) : sTans.includes(c.key);
      const hit = c.type === 'puk' ? c.key === res3puku : c.key === res3tan;
      row[name] = { dup, hit, ret: hit ? (c.type === 'puk' ? pay.sanrenpuku : pay.sanrentan) : 0 };
    }
    // 既存ポートフォリオ精算値
    let ret = 0;
    if (sTans.includes(res3tan)) ret += pay.sanrentan;
    if (sPuks.includes(res3puku)) ret += pay.sanrenpuku;
    if (kPuks.includes(res3puku)) ret += pay.sanrenpuku;
    if (kTans2.includes(res.slice(0, 2).join('-'))) ret += pay.nisyatan;
    row.baseCost = (sTans.length + sPuks.length + kPuks.length + kTans2.length) * 100;
    row.baseRet = ret;
    results.push(row);
  } catch (e) { /* skip */ }
}
fs.writeFileSync(process.argv[3] || '/dev/stdout', JSON.stringify(results));
console.error('done:', results.length);
