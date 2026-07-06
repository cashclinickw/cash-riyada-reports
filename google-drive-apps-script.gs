/**
 * Cash Riyada — Save consultation PDF to Google Drive
 * Deploy this as a Web App (see README). It receives a base64 PDF from the
 * report's "حفظ PDF في Google Drive" button and stores it in a Drive folder.
 */
var FOLDER_NAME = 'Cash Riyada Reports'; // change if you want another folder

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var bytes = Utilities.base64Decode(data.pdfBase64);
    var blob  = Utilities.newBlob(bytes, 'application/pdf', data.filename || 'Cash Riyada Report.pdf');

    var it = DriveApp.getFoldersByName(FOLDER_NAME);
    var folder = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
    var file = folder.createFile(blob);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, url: file.getUrl(), id: file.getId() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Lets you open the /exec URL in a browser to confirm it's deployed.
function doGet() {
  return ContentService.createTextOutput('Cash Riyada Drive endpoint is running.');
}
