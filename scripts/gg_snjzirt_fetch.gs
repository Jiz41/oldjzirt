// gg_snjzirt_fetch.gs
// 係数サマリーシートへのレース結果・払戻金自動取得スクリプト
// VERSION: 2.0
// 変更: parseRefundTable追加（3連単/3連複/2車単 払戻金パース）
//       fetchOddsForAnalyzed追加（遡及取得・PropertiesService再開対応）

const VENUE_NAME_MAP = {
  '函館': 'hakodate', '青森': 'aomori', 'いわき平': 'iwakitaira',
  '弥彦': 'yahiko', '前橋': 'maebashi', '取手': 'toride',
  '宇都宮': 'utsunomiya', '大宮': 'omiya', '西武園': 'seibuen',
  '京王閣': 'keiokaku', '立川': 'tachikawa', '松戸': 'matsudo',
  '千葉': 'chiba', '川崎': 'kawasaki', '平塚': 'hiratsuka',
  '小田原': 'odawara', '伊東': 'ito', '静岡': 'shizuoka',
  '名古屋': 'nagoya', '岐阜': 'gifu', '大垣': 'ogaki',
  '豊橋': 'toyohashi', '富山': 'toyama', '松阪': 'matsusaka',
  '四日市': 'yokkaichi', '福井': 'fukui', '奈良': 'nara',
  '向日町': 'mukomachi', '和歌山': 'wakayama', '岸和田': 'kishiwada',
  '玉野': 'tamano', '広島': 'hiroshima', '防府': 'hofu',
  '高松': 'takamatsu', '高知': 'kochi', '小松島': 'komatsushima',
  '松山': 'matsuyama', '小倉': 'kokura', '久留米': 'kurume',
  '武雄': 'takeo', '佐世保': 'sasebo', '別府': 'beppu', '熊本': 'kumamoto'
};

function fetchResults(row) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('係数サマリー');

  const raceInfoRaw = sheet.getRange(row, 4).getValue();
  const raceInfo = JSON.parse(raceInfoRaw);
  const venueName = raceInfo.bank.replace(/[^\u3000-\u9fff\u30a0-\u30ff]/g, '').trim();
  const venueEn = VENUE_NAME_MAP[venueName] || venueName;

  const eData = JSON.parse(sheet.getRange(row, 5).getValue());
  const raceId = eData.race_id;

  let html;
  try {
    Utilities.sleep(10000);
    const response = UrlFetchApp.fetch(
      `https://keirin.kdreams.jp/${venueEn}/racedetail/${raceId}/?pageType=result`,
      { muteHttpExceptions: true, deadline: 30 }
    );
    html = response.getContentText('UTF-8');
  } catch(e) {
    Logger.log(row + '行目: アクセス不可 ' + e.message);
    return;
  }

  const result = parseResult(html);

  if (result.chakujun === 'PARSE_ERROR') {
    Logger.log(row + '行目: 結果未確定のためスキップ');
    return;
  }

  sheet.getRange(row, 8).setValue(result.chakujun);                                    // H: 着順
  sheet.getRange(row, 9).setValue(result.kimarite);                                    // I: 決まり手
  sheet.getRange(row, 10).setValue('ANALYZED');                                         // J: ステータス
  if (result.sanrentan  !== null) sheet.getRange(row, 13).setValue(result.sanrentan);  // M: 3連単払戻
  if (result.sanrenpuku !== null) sheet.getRange(row, 14).setValue(result.sanrenpuku); // N: 3連複払戻
  if (result.nirenten   !== null) sheet.getRange(row, 15).setValue(result.nirenten);   // O: 2車単払戻
  sheet.getRange(row, 12).setValue(false);                                              // L: チェックボックス
}

// ============================================================
// parseResult — 着順テーブル + 払戻テーブルを同時パース
// ============================================================
function parseResult(html) {
  const PARSE_FAILED = {
    chakujun: 'PARSE_ERROR', kimarite: '不明',
    sanrentan: null, sanrenpuku: null, nirenten: null
  };

  const tenhouIdx = html.indexOf('天候');
  if (tenhouIdx === -1) return PARSE_FAILED;

  const tableMatch = html.substring(tenhouIdx).match(/<table[\s\S]*?<\/table>/);
  if (!tableMatch) return PARSE_FAILED;

  const rows = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/g) || [];
  const chakujunMap = {};
  let kimarite = '不明';

  for (const row of rows) {
    const cells = row.match(/<td[\s\S]*?<\/td>/g) || [];
    if (cells.length < 7) continue;

    const order  = cells[1].replace(/<[^>]+>/g, '').trim();
    const carNum = cells[2].replace(/<[^>]+>/g, '').trim();
    const kima   = cells[6].replace(/<[^>]+>/g, '').trim();

    const orderNum = parseInt(order, 10);
    if (orderNum >= 1 && orderNum <= 3 && carNum.match(/^\d+$/)) {
      chakujunMap[orderNum] = carNum;
      if (orderNum === 1 && kima) kimarite = kima;
    }
  }

  if (!chakujunMap[1] || !chakujunMap[2] || !chakujunMap[3]) return PARSE_FAILED;

  const payouts = parseRefundTable(html);

  return {
    chakujun: `${chakujunMap[1]}-${chakujunMap[2]}-${chakujunMap[3]}`,
    kimarite,
    sanrentan:  payouts.sanrentan,
    sanrenpuku: payouts.sanrenpuku,
    nirenten:   payouts.nirenten
  };
}

// ============================================================
// parseRefundTable — refund_tableクラスから払戻金を抽出
//
// HTML構造（実確認済み）:
//   <div class="refund_table_area">
//     <table class="refund_table">
//       <tr>  ← 複の行
//         <th rowspan="2">2枠連</th> <td>複</td> <td>金額</td>
//         <th rowspan="2">2車連</th> <td>複</td> <td>金額</td>
//         <th rowspan="2">3連勝</th> <td>複</td> <td>金額</td>
//         <th rowspan="2">ワイド</th> <td rowspan="2" class="wide">金額</td>
//       </tr>
//       <tr>  ← 単の行（th なし）
//         <td>単</td> <td>金額</td>  ← 2枠連
//         <td>単</td> <td>金額</td>  ← 2車連
//         <td>単</td> <td>金額</td>  ← 3連勝
//       </tr>
//     </table>
//   </div>
// ============================================================
function parseRefundTable(html) {
  const result = { sanrentan: null, sanrenpuku: null, nirenten: null };

  const areaIdx = html.indexOf('refund_table_area');
  if (areaIdx === -1) return result;
  const tableStart = html.indexOf('<table', areaIdx);
  if (tableStart === -1) return result;
  const tableEnd = html.indexOf('</table>', tableStart);
  if (tableEnd === -1) return result;
  const tbl = html.substring(tableStart, tableEnd + 8);

  const trs = tbl.match(/<tr[\s\S]*?<\/tr>/g) || [];
  if (trs.length < 2) return result;

  // TR1: th出現順でbetTypeOrderを構築し、複の払戻を取得
  const tr1Cells = trs[0].match(/<th[\s\S]*?<\/th>|<td[\s\S]*?<\/td>/g) || [];
  const betTypeOrder = [];
  const fukuMap = {};

  let i = 0;
  while (i < tr1Cells.length) {
    if (tr1Cells[i].startsWith('<th')) {
      const betType = tr1Cells[i].replace(/<[^>]+>/g, '').replace(/\s/g, '');
      betTypeOrder.push(betType);
      // th直後: td(複 or wide), その次: td(金額)
      if (i + 2 < tr1Cells.length) {
        const subType = tr1Cells[i + 1].replace(/<[^>]+>/g, '').replace(/\s/g, '');
        if (subType === '複') {
          const dd = tr1Cells[i + 2].match(/<dd>([\s\S]*?)<\/dd>/);
          if (dd) fukuMap[betType] = extractAmount(dd[1]);
        }
      }
      i += 3;
    } else {
      i++;
    }
  }

  // TR2: ワイドを除くbet_type順で、単の払戻を取得
  const tanOrder = betTypeOrder.filter(b => b !== 'ワイド');
  const tr2Cells = trs[1].match(/<td[\s\S]*?<\/td>/g) || [];
  const tanMap = {};
  let tanIdx = 0;
  let j = 0;

  while (j < tr2Cells.length && tanIdx < tanOrder.length) {
    const text = tr2Cells[j].replace(/<[^>]+>/g, '').replace(/\s/g, '');
    if (text === '単') {
      if (j + 1 < tr2Cells.length) {
        const dd = tr2Cells[j + 1].match(/<dd>([\s\S]*?)<\/dd>/);
        if (dd) tanMap[tanOrder[tanIdx]] = extractAmount(dd[1]);
        tanIdx++;
        j += 2;
      } else {
        j++;
      }
    } else {
      j++;
    }
  }

  result.sanrentan  = tanMap['3連勝']  !== undefined ? tanMap['3連勝']  : null;
  result.sanrenpuku = fukuMap['3連勝'] !== undefined ? fukuMap['3連勝'] : null;
  result.nirenten   = tanMap['2車連']  !== undefined ? tanMap['2車連']  : null;

  return result;
}

// 「9,410円<span>(33)</span>」→ 9410
function extractAmount(str) {
  const cleaned = str
    .replace(/<span>[\s\S]*?<\/span>/g, '')
    .replace(/[^\d,]/g, '')
    .replace(/,/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

// ============================================================
// fetchAllPending — PENDING行を最大15件処理
// ============================================================
function fetchAllPending() {
  const MAX_ROWS = 15;
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('係数サマリー');
  const lastRow = sheet.getLastRow();
  let count = 0;

  for (let row = 2; row <= lastRow; row++) {
    if (count >= MAX_ROWS) break;
    const status = sheet.getRange(row, 10).getValue();
    if (status !== 'PENDING') continue;
    Logger.log('処理中: ' + row + '行目');
    fetchResults(row);
    Utilities.sleep(10000);
    count++;
  }

  Logger.log('処理完了: ' + count + '行');
}

// ============================================================
// fetchOddsForAnalyzed — ANALYZED済み・払戻未取得行の遡及取得
//   対象: J列=ANALYZED かつ M列が空 (2〜1180行)
//   1回30件・PropertiesServiceで再開位置を記憶
// ============================================================
function fetchOddsForAnalyzed() {
  const MAX_ROWS = 30;
  const LAST_ROW = 1180;
  const props = PropertiesService.getScriptProperties();
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('係数サマリー');

  const startRow = parseInt(props.getProperty('ODDS_RESUME_ROW') || '2', 10);
  let count = 0;

  for (let row = startRow; row <= LAST_ROW; row++) {
    if (count >= MAX_ROWS) {
      props.setProperty('ODDS_RESUME_ROW', String(row));
      Logger.log('中断: ' + row + '行目から次回再開。処理数: ' + count);
      return;
    }
    const status = sheet.getRange(row, 10).getValue();
    const mVal   = sheet.getRange(row, 13).getValue();
    if (status !== 'ANALYZED' || mVal !== '') continue;

    Logger.log('払戻取得中: ' + row + '行目');
    fetchResults(row);
    Utilities.sleep(10000);
    count++;
  }

  props.deleteProperty('ODDS_RESUME_ROW');
  Logger.log('全件完了。処理数: ' + count);
}

// ============================================================
// onEdit — L列チェックボックスON → fetchAllPending
// ============================================================
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== '係数サマリー') return;
  if (e.range.getColumn() !== 12 || e.range.getRow() < 2) return;
  if (e.value !== 'TRUE') return;
  fetchAllPending();
}

// ============================================================
// デバッグ用関数
// ============================================================
function testFetchResults() {
  fetchResults(3);
}

function debugHtml() {
  const url = 'https://keirin.kdreams.jp/ogaki/racedetail/4420260408010012/?pageType=result';
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const html = response.getContentText('UTF-8');
  const tenhouIdx = html.indexOf('天候');
  Logger.log(html.substring(tenhouIdx, tenhouIdx + 3000));
}

function debugRaceId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('係数サマリー');
  const eData = JSON.parse(sheet.getRange(3, 5).getValue());
  Logger.log('race_id: ' + eData.race_id);

  const raceInfoRaw = sheet.getRange(3, 4).getValue();
  const raceInfo = JSON.parse(raceInfoRaw);
  Logger.log('bank raw: ' + raceInfo.bank);
  Logger.log('venue変換後: ' + (raceInfo.bank.replace(/[^\u3000-\u9fff\u30a0-\u30ff]/g, '').trim()));
}
