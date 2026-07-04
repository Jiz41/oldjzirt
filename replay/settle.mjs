// リプレイ台: 買い目精算器
// 晴天令(3連単+3連複) / 荒天令(3連複+二車単) を 100円/点 で精算する。

import { parseBets } from './harness.mjs';

const setKey = (nums) => [...nums].sort((a, b) => Number(a) - Number(b)).join('=');

/**
 * @param {string} seitenHtml 晴天令予想HTML
 * @param {string} koutenHtml 荒天令予想HTML
 * @param {object} fixture result / payouts を持つfixture
 */
export function settleRace(seitenHtml, koutenHtml, fixture) {
  const res = fixture.result.split('-').map(s => s.trim());
  const res3tan = res.join('-');
  const res3puku = setKey(res);
  const res2tan = res.slice(0, 2).join('-');
  const pay = fixture.payouts || {};

  const sTans = parseBets(seitenHtml, '三連単');
  const sPuks = parseBets(seitenHtml, '三連複').map(b => setKey(b.split('=')));
  const kPuks = parseBets(koutenHtml, '三連複').map(b => setKey(b.split('=')));
  const kTans2 = parseBets(koutenHtml, '二車単');

  const cost = (sTans.length + sPuks.length + kPuks.length + kTans2.length) * 100;
  let ret = 0;
  let hitSeiten = false;
  let hitKouten = false;

  if (sTans.includes(res3tan)) { ret += pay.sanrentan || 0; hitSeiten = true; }
  if (sPuks.includes(res3puku)) { ret += pay.sanrenpuku || 0; hitSeiten = true; }
  if (kPuks.includes(res3puku)) { ret += pay.sanrenpuku || 0; hitKouten = true; }
  if (kTans2.includes(res2tan)) { ret += pay.nisyatan || 0; hitKouten = true; }

  return {
    cost, ret,
    hitSeiten, hitKouten,
    hitAny: hitSeiten || hitKouten,
    nBets: { sTans: sTans.length, sPuks: sPuks.length, kPuks: kPuks.length, kTans2: kTans2.length },
    bets: { sTans, sPuks, kPuks, kTans2 },
  };
}
