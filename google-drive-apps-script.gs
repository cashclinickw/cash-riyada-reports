/**
 * Cash Riyada — Save consultation PDF to Google Drive
 * Saves the report PDF into the folder / Shared Drive whose ID is set below.
 * After editing, you MUST redeploy a NEW VERSION (see README) for changes to take effect.
 */
var FOLDER_ID = '0APoFmO6ne3mMUk9PVA';  // target folder OR Shared Drive ID
var SUBFOLDER = 'Cash Riyada Reports';  // set to '' to save directly inside FOLDER_ID

function doPost(e) {
  try {
    var data  = JSON.parse(e.postData.contents);
    var bytes = Utilities.base64Decode(data.pdfBase64);
    var blob  = Utilities.newBlob(bytes, 'application/pdf', data.filename || 'Cash Riyada Report.pdf');

    var parent = DriveApp.getFolderById(FOLDER_ID);
    var target = parent;
    if (SUBFOLDER) {
      var it = parent.getFoldersByName(SUBFOLDER);
      target = it.hasNext() ? it.next() : parent.createFolder(SUBFOLDER);
    }
    var file = target.createFile(blob);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, url: file.getUrl(), id: file.getId() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Open the /exec URL in a browser to confirm the Web App is live.
function doGet() {
  return ContentService.createTextOutput('Cash Riyada Drive endpoint is running.');
}
