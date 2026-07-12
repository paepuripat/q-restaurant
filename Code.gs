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

// Sheets silently converts date-looking strings (eg. '2026-07-12') written via
// appendRow/setValue into real Date cells, so a later getValues() can hand back
// a Date object instead of the string we wrote. Normalize before comparing.
function toDateString_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
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
    const todayCount = rows.filter(function (row) { return toDateString_(row[1]) === today; }).length;
    const number = todayCount + 1;
    const id = Utilities.getUuid();
    const createdAt = new Date().toISOString();

    sheet.appendRow([id, today, number, 'waiting', createdAt, '']);

    return { id: id, number: number, date: today };
  } finally {
    lock.releaseLock();
  }
}

function checkPasscode_(passcode) {
  const expected = PropertiesService.getScriptProperties().getProperty('STAFF_PASSCODE');
  if (!expected || passcode !== expected) {
    throw new Error('รหัสผ่านไม่ถูกต้อง');
  }
}

function rowToTicket_(row) {
  return {
    id: row[0],
    number: row[2],
    status: row[3],
    createdAt: row[4],
    calledAt: row[5]
  };
}

function getQueue(passcode) {
  checkPasscode_(passcode);
  const sheet = getQueueSheet_();
  const today = getTodayString_();
  return sheet.getDataRange().getValues().slice(1)
    .filter(function (row) { return toDateString_(row[1]) === today; })
    .map(rowToTicket_)
    .sort(function (a, b) { return a.number - b.number; });
}

function withStaffLock_(passcode, work) {
  checkPasscode_(passcode);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('ระบบไม่ว่าง ลองอีกครั้ง');
  }
  try {
    work();
    return getQueue(passcode);
  } finally {
    lock.releaseLock();
  }
}

function callNext(passcode) {
  return withStaffLock_(passcode, function () {
    const sheet = getQueueSheet_();
    const today = getTodayString_();
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (toDateString_(row[1]) === today && row[3] === 'waiting') {
        sheet.getRange(i + 1, 4, 1, 3).setValues([['called', row[4], new Date().toISOString()]]);
        break;
      }
    }
  });
}

function updateStatus_(passcode, id, status) {
  return withStaffLock_(passcode, function () {
    const sheet = getQueueSheet_();
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        sheet.getRange(i + 1, 4).setValue(status);
        break;
      }
    }
  });
}

function markDone(passcode, id) {
  return updateStatus_(passcode, id, 'done');
}

function markSkipped(passcode, id) {
  return updateStatus_(passcode, id, 'skipped');
}

function resetDay(passcode) {
  return withStaffLock_(passcode, function () {
    const sheet = getQueueSheet_();
    const today = getTodayString_();
    const values = sheet.getDataRange().getValues();
    const a1s = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (toDateString_(row[1]) === today && (row[3] === 'waiting' || row[3] === 'called')) {
        a1s.push(sheet.getRange(i + 1, 4).getA1Notation());
      }
    }
    if (a1s.length > 0) {
      sheet.getRangeList(a1s).setValue('skipped');
    }
  });
}
