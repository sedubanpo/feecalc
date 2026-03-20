var FEECALC_CONFIG = {
  SPREADSHEET_ID: '',
  SPREADSHEET_URL: '',
  SHEET_NAME: 'FeeCalcRecords',
  DRIVE_FOLDER_ID: ''
};

var FEECALC_HEADERS = [
  'recordId',
  'savedAt',
  'studentName',
  'targetYear',
  'targetMonth',
  'currentTab',
  'totalText',
  'fileId',
  'payloadSize'
];

function doGet(e) {
  try {
    var request = getRequestData_(e);
    return routeRequest_(request);
  } catch (error) {
    return jsonResponse_({
      ok: false,
      message: getErrorMessage_(error)
    });
  }
}

function doPost(e) {
  try {
    var request = parsePostPayload_(e);
    return routeRequest_(request);
  } catch (error) {
    return jsonResponse_({
      ok: false,
      message: getErrorMessage_(error)
    });
  }
}

function routeRequest_(request) {
  var action = normalizeText_(request.action);
  if (!action) {
    return jsonResponse_({
      ok: true,
      message: 'FeeCalc API Ready'
    });
  }

  ensureStorageSheet_();

  if (action === 'ping') {
    return jsonResponse_({
      ok: true,
      message: 'pong'
    });
  }
  if (action === 'listRecords') {
    return jsonResponse_(listRecordsAction_(request));
  }
  if (action === 'getRecord') {
    return jsonResponse_(getRecordAction_(request));
  }
  if (action === 'saveRecord') {
    return jsonResponse_(saveRecordAction_(request));
  }

  return jsonResponse_({
    ok: false,
    message: '지원하지 않는 action입니다.'
  });
}

function listRecordsAction_(request) {
  var sheet = getStorageSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return {
      ok: true,
      records: []
    };
  }

  var headers = values[0];
  var limit = Math.max(1, Math.min(100, parseInt(request.limit, 10) || 50));
  var records = [];

  for (var rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    var row = values[rowIndex];
    if (!normalizeText_(row[0])) {
      continue;
    }
    var item = rowToObject_(headers, row);
    records.push({
      recordId: item.recordId,
      savedAt: item.savedAt,
      studentName: item.studentName,
      targetYear: item.targetYear,
      targetMonth: item.targetMonth,
      currentTab: item.currentTab,
      totalText: item.totalText
    });
    if (records.length >= limit) {
      break;
    }
  }

  return {
    ok: true,
    records: records
  };
}

function getRecordAction_(request) {
  var recordId = normalizeText_(request.recordId);
  if (!recordId) {
    throw new Error('recordId가 필요합니다.');
  }

  var match = findRecordRow_(recordId);
  if (!match) {
    throw new Error('저장된 기록을 찾지 못했습니다.');
  }

  var fileId = normalizeText_(match.item.fileId);
  if (!fileId) {
    throw new Error('저장 파일 ID가 비어 있습니다.');
  }

  var payloadText = DriveApp.getFileById(fileId).getBlob().getDataAsString('utf-8');
  var payload = safeJsonParse_(payloadText);
  if (!payload) {
    throw new Error('저장된 데이터 본문을 읽지 못했습니다.');
  }

  return {
    ok: true,
    record: {
      recordId: match.item.recordId,
      savedAt: match.item.savedAt,
      studentName: match.item.studentName,
      targetYear: match.item.targetYear,
      targetMonth: match.item.targetMonth,
      currentTab: match.item.currentTab,
      totalText: match.item.totalText,
      payload: payload
    }
  };
}

function saveRecordAction_(request) {
  var payload = request.payload;
  var meta = request.meta || {};

  if (!payload || typeof payload !== 'object') {
    throw new Error('저장할 payload가 필요합니다.');
  }

  return withWriteLock_(function() {
    var recordId = Utilities.getUuid();
    var savedAt = new Date();
    var studentName = normalizeText_(meta.studentName) || normalizeText_(payload.studentName) || '학생명';
    var targetYear = normalizeText_(meta.targetYear) || normalizeText_(payload.targetYear);
    var targetMonth = normalizeText_(meta.targetMonth) || normalizeText_(payload.targetMonth);
    var currentTab = normalizeText_(meta.currentTab) || normalizeText_(payload.currentTab) || 'auto';
    var totalText = normalizeText_(meta.totalText) || '0원';
    var payloadJson = JSON.stringify(payload);
    var payloadSize = payloadJson.length;
    var fileName = [
      'feecalc',
      studentName.replace(/[^\w가-힣-]+/g, '_'),
      targetYear || 'year',
      targetMonth || 'month',
      recordId
    ].join('_') + '.json';
    var file = getStorageFolder_().createFile(fileName, payloadJson, MimeType.PLAIN_TEXT);

    getStorageSheet_().appendRow([
      recordId,
      savedAt.toISOString(),
      studentName,
      targetYear,
      targetMonth,
      currentTab,
      totalText,
      file.getId(),
      payloadSize
    ]);

    return {
      ok: true,
      recordId: recordId,
      savedAt: savedAt.toISOString()
    };
  });
}

function findRecordRow_(recordId) {
  var sheet = getStorageSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return null;
  }

  var headers = values[0];
  for (var rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    var row = values[rowIndex];
    if (String(row[0]) === recordId) {
      return {
        rowIndex: rowIndex + 1,
        item: rowToObject_(headers, row)
      };
    }
  }
  return null;
}

function rowToObject_(headers, row) {
  var item = {};
  headers.forEach(function(header, index) {
    item[String(header)] = row[index];
  });
  return item;
}

function parsePostPayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('POST payload가 비어 있습니다.');
  }

  var payload = safeJsonParse_(e.postData.contents);
  if (!payload || typeof payload !== 'object') {
    throw new Error('POST payload를 JSON으로 읽지 못했습니다.');
  }
  return payload;
}

function getRequestData_(e) {
  var request = {};
  if (!e || !e.parameter) {
    return request;
  }
  Object.keys(e.parameter).forEach(function(key) {
    request[key] = e.parameter[key];
  });
  return request;
}

function getSpreadsheet_() {
  if (normalizeText_(FEECALC_CONFIG.SPREADSHEET_ID)) {
    return SpreadsheetApp.openById(FEECALC_CONFIG.SPREADSHEET_ID);
  }
  if (normalizeText_(FEECALC_CONFIG.SPREADSHEET_URL)) {
    return SpreadsheetApp.openByUrl(FEECALC_CONFIG.SPREADSHEET_URL);
  }
  throw new Error('SPREADSHEET_ID 또는 SPREADSHEET_URL을 설정해주세요.');
}

function getStorageSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(FEECALC_CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(FEECALC_CONFIG.SHEET_NAME);
  }
  return sheet;
}

function ensureStorageSheet_() {
  var sheet = getStorageSheet_();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(FEECALC_HEADERS);
    sheet.setFrozenRows(1);
    return;
  }

  var headerValues = sheet.getRange(1, 1, 1, FEECALC_HEADERS.length).getValues()[0];
  var isSame = FEECALC_HEADERS.every(function(header, index) {
    return String(headerValues[index] || '') === header;
  });

  if (!isSame) {
    sheet.clearContents();
    sheet.appendRow(FEECALC_HEADERS);
    sheet.setFrozenRows(1);
  }
}

function getStorageFolder_() {
  if (normalizeText_(FEECALC_CONFIG.DRIVE_FOLDER_ID)) {
    return DriveApp.getFolderById(FEECALC_CONFIG.DRIVE_FOLDER_ID);
  }
  return DriveApp.getRootFolder();
}

function withWriteLock_(callback) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function safeJsonParse_(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function normalizeText_(value) {
  return String(value == null ? '' : value).trim();
}

function getErrorMessage_(error) {
  if (!error) {
    return '알 수 없는 오류가 발생했습니다.';
  }
  if (typeof error === 'string') {
    return error;
  }
  return error.message || '알 수 없는 오류가 발생했습니다.';
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
