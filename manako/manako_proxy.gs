// まなこ Gemini 中継エンドポイント
// ─────────────────────────────────────────────────
// 【デプロイ手順】
//   1. スクリプトプロパティに GEMINI_API_KEY を追加
//      （プロジェクト設定 → スクリプトプロパティ）
//   2. デプロイ → 新しいデプロイ
//      種類: ウェブアプリ
//      実行ユーザー: 自分
//      アクセスできるユーザー: 全員
//   3. デプロイURLを manako.html の __GAS_ENDPOINT__ に差し替え
// ─────────────────────────────────────────────────

const MODEL = 'gemini-2.5-flash-lite';

function doPost(e) {
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      return respond({ error: 'GEMINI_API_KEY がスクリプトプロパティに設定されていません' }, 500);
    }

    const body = JSON.parse(e.postData.contents);
    const { contents, systemInstruction, generationConfig } = body;

    const payload = { contents };
    if (systemInstruction) payload.system_instruction = systemInstruction;
    if (generationConfig)  payload.generationConfig   = generationConfig;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const res = UrlFetchApp.fetch(url, {
      method:      'post',
      contentType: 'application/json',
      payload:     JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    return ContentService
      .createTextOutput(res.getContentText())
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return respond({ error: err.message }, 500);
  }
}

// CORSプリフライト・疎通確認用
function doGet() {
  return respond({ status: 'ok', model: MODEL });
}

function respond(obj, _code) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
