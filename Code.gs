const QUEUE_SHEET_NAME = 'queue';
const QUEUE_HEADERS = ['id', 'date', 'number', 'status', 'createdAt', 'calledAt'];

function doGet(e) {
  const page = e.parameter.page;
  let templateName = 'customer';
  if (page === 'staff') templateName = 'staff';
  else if (page === 'board') templateName = 'board';

  return HtmlService.createTemplateFromFile(templateName)
    .evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('Queue Restaurant');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getQueueSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(QUEUE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(QUEUE_SHEET_NAME);
    sheet.appendRow(QUEUE_HEADERS);
  }
  return sheet;
}

function getTodayString_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function issueQueue() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('คิวหนาแน่น ลองอีกครั้ง');
  }

  try {
    const sheet = getQueueSheet_();
    const today = getTodayString_();

    const rows = sheet.getDataRange().getValues().slice(1);
    const todayCount = rows.filter(function (row) { return row[1] === today; }).length;
    const number = todayCount + 1;
    const id = Utilities.getUuid();
    const createdAt = new Date().toISOString();

    sheet.appendRow([id, today, number, 'waiting', createdAt, '']);

    return { id: id, number: number, date: today };
  } finally {
    lock.releaseLock();
  }
}
