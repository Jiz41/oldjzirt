// リプレイ台 CLI
// 使い方:
//   node replay/run.mjs --engine keirin_logic.js [--bankdata bankdata.json]
//                       [--filter grade=a-kyu] [--out replay/result.json] [--verify]
//                       [--fixtures replay/fixtures_XXXX.json]
// fixtures.json は測定基準ゆえ変更禁止。別期間の計測は --fixtures で新ファイルを指定する。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine, parseBets } from './harness.mjs';
import { settleRace } from './settle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');

const args = process.argv.slice(2);
function argOf(name, dflt) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const enginePath = path.resolve(repo, argOf('--engine', 'keirin_logic.js'));
const bankdataPath = path.resolve(repo, argOf('--bankdata', 'bankdata.json'));
const outPath = argOf('--out', null);
const doVerify = args.includes('--verify');
const filter = argOf('--filter', null); // 例: grade=a-kyu

const fixturesPath = path.resolve(repo, argOf('--fixtures', 'replay/fixtures.json'));
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
const engine = createEngine(enginePath, bankdataPath);

const setKey = (nums) => [...nums].sort((a, b) => Number(a) - Number(b)).join('=');

const rows = [];
let skipped = 0;
const skipReasons = {};
let verifyN = 0, verifyMatch = 0;

for (const fx of fixtures) {
  if (filter) {
    const [k, v] = filter.split('=');
    if (k === 'grade' && fx.raceType !== v) continue;
    if (k === 'month' && !fx.date.startsWith(v)) continue;
  }
  try {
    const { seitenHtml, koutenHtml } = await engine.runRace(fx);
    if (!seitenHtml || !parseBets(seitenHtml, '三連単').length) {
      skipped++;
      skipReasons['empty-bets'] = (skipReasons['empty-bets'] || 0) + 1;
      continue;
    }
    const s = settleRace(seitenHtml, koutenHtml, fx);
    rows.push({ date: fx.date, month: fx.date.slice(0, 7), grade: fx.raceType, bank: fx.bankName, tenun: fx.tenun ?? null, ...s });

    if (doVerify && fx.logged_bets?.seiten) {
      const rePuk = parseBets(seitenHtml, '三連複').map(b => setKey(b.split('=')));
      const logPuk = parseBets(fx.logged_bets.seiten, '三連複').map(b => setKey(b.split('=')));
      if (logPuk.length) {
        verifyN++;
        if (rePuk.join('|') === logPuk.join('|')) verifyMatch++;
      }
    }
  } catch (e) {
    skipped++;
    const key = String(e && e.message ? e.message : e).slice(0, 60);
    skipReasons[key] = (skipReasons[key] || 0) + 1;
  }
}

function agg(list) {
  const n = list.length;
  const hit = list.filter(r => r.hitAny).length;
  const cost = list.reduce((s, r) => s + r.cost, 0);
  const ret = list.reduce((s, r) => s + r.ret, 0);
  return { n, hitPct: n ? (hit / n * 100) : 0, cost, ret, roiPct: cost ? (ret / cost * 100) : 0 };
}

console.log(`engine: ${path.basename(enginePath)}  races: ${rows.length}  skipped: ${skipped}`);
if (Object.keys(skipReasons).length) console.log('  skip理由:', skipReasons);
if (doVerify) console.log(`verify: 晴天令3連複 一致 ${verifyMatch}/${verifyN} (${verifyN ? (verifyMatch / verifyN * 100).toFixed(1) : 0}%)`);

console.log('\n月       n     的中率    投入      回収     回収率');
const months = [...new Set(rows.map(r => r.month))].sort();
for (const m of months) {
  const a = agg(rows.filter(r => r.month === m));
  console.log(`${m}  ${String(a.n).padStart(4)}  ${a.hitPct.toFixed(1).padStart(6)}%  ${String(a.cost).padStart(8)}  ${String(a.ret).padStart(8)}  ${a.roiPct.toFixed(1).padStart(6)}%`);
}
const total = agg(rows);
console.log(`TOTAL    ${String(total.n).padStart(4)}  ${total.hitPct.toFixed(1).padStart(6)}%  ${String(total.cost).padStart(8)}  ${String(total.ret).padStart(8)}  ${total.roiPct.toFixed(1).padStart(6)}%`);

console.log('\n級別:');
for (const g of [...new Set(rows.map(r => r.grade))].sort()) {
  const a = agg(rows.filter(r => r.grade === g));
  console.log(`  ${g.padEnd(12)} n=${String(a.n).padStart(4)} 的中率${a.hitPct.toFixed(1)}% 回収率${a.roiPct.toFixed(1)}%`);
}

// トリム回収率: 払戻上位5本を除いた回収率。回収率は少数の万車券で±10pt以上動くため、
// 「勝ち」がベース精度の向上か大穴の偶然かを切り分ける（2026-07-15 実測: 月次回収の見かけの差は
// ほぼ上位5本で説明され、トリム後は各月41〜55%に収斂した）
{
  const rets = rows.map(r => r.ret).sort((a, b) => b - a);
  const top5 = rets.slice(0, 5).reduce((s, x) => s + x, 0);
  const costAll = rows.reduce((s, r) => s + r.cost, 0);
  const retAll = rows.reduce((s, r) => s + r.ret, 0);
  console.log(`\nトリム回収率（上位5的中除外）: ${costAll ? ((retAll - top5) / costAll * 100).toFixed(1) : 0}%（上位5本=${top5}円）`);
}

// 期間2分割（採用条件「全体で勝ち、かつ両半期で負けていない」の判定材料。2026-07 コラム§4）
const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
const half = Math.floor(sorted.length / 2);
console.log('\n期間2分割:');
for (const [label, list] of [['前半', sorted.slice(0, half)], ['後半', sorted.slice(half)]]) {
  const a = agg(list);
  const range = list.length ? `${list[0].date}〜${list[list.length - 1].date}` : '-';
  console.log(`  ${label} ${range} n=${String(a.n).padStart(4)} 的中率${a.hitPct.toFixed(1)}% 回収率${a.roiPct.toFixed(1)}%`);
}

// 天雲指数別（fixtures に tenun がある場合のみ。§9）
if (rows.some(r => r.tenun !== null && r.tenun !== undefined)) {
  console.log('\n天雲指数別:');
  const idxs = [...new Set(rows.map(r => r.tenun))].sort((a, b) => a - b);
  for (const t of idxs) {
    const a = agg(rows.filter(r => r.tenun === t));
    console.log(`  指数${String(t).padEnd(4)} n=${String(a.n).padStart(4)} 的中率${a.hitPct.toFixed(1)}% 回収率${a.roiPct.toFixed(1)}%`);
  }
}

if (outPath) {
  fs.writeFileSync(path.resolve(repo, outPath), JSON.stringify({ engine: path.basename(enginePath), rows }, null, 1));
  console.log(`\nsaved: ${outPath}`);
}
