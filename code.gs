/**
 * =================================================================
 * 기계시스템과 기능사 종목 조사 - Google Apps Script (GAS) 백엔드 코드
 * (초정밀 슬라이딩 감지 & 열 순서 자동 대응 100% 명단 검증)
 * =================================================================
 */

function extractDigits(val) {
  if (val === null || val === undefined) return "";
  return val.toString().replace(/[^0-9]/g, "").trim();
}

function cleanStr(val) {
  if (val === null || val === undefined) return "";
  return val.toString().replace(/\s+/g, "").trim();
}

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var responseSheet = ss.getSheetByName("설문응답");
  if (!responseSheet) {
    responseSheet = ss.getSheets()[0];
    responseSheet.setName("설문응답");
  }
  if (responseSheet.getLastRow() === 0) {
    responseSheet.appendRow(["제출일시", "학년", "반", "번호", "이름", "신청종목"]);
    var headerRange = responseSheet.getRange(1, 1, 1, 6);
    headerRange.setBackground("#F5F0EB");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
  }

  var rosterSheet = ss.getSheetByName("학생명단") || ss.getSheetByName("학생 명단");
  if (!rosterSheet) {
    rosterSheet = ss.insertSheet("학생명단");
    rosterSheet.appendRow(["학년", "반", "번호", "이름"]);
    var rHeaderRange = rosterSheet.getRange(1, 1, 1, 4);
    rHeaderRange.setBackground("#F5F0EB");
    rHeaderRange.setFontWeight("bold");
    rHeaderRange.setHorizontalAlignment("center");
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupSheets();
    
    var responseSheet = ss.getSheetByName("설문응답");

    // 수신 데이터 파싱
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var inputGrade = (data.grade || "").toString();
    var inputClass = (data.classNum || "").toString();
    var inputNum = (data.studentNum || "").toString();
    var inputName = (data.studentName || "").toString();
    var subject = (data.subject || "").toString().trim();

    var inGradeDigits = extractDigits(inputGrade);
    var inClassDigits = extractDigits(inputClass);
    var inNumDigits = extractDigits(inputNum);
    var inNameClean = cleanStr(inputName);

    // 🛡️ [학생명단] / [학생 명단] 탭 찾기
    var rosterSheet = ss.getSheetByName("학생명단") || ss.getSheetByName("학생 명단") || ss.getSheetByName("명단");
    
    if (rosterSheet && rosterSheet.getLastRow() > 1) {
      var allRosterValues = rosterSheet.getDataRange().getValues();
      var isMatchFound = false;

      // 2번째 줄(인덱스 1)부터 검색
      for (var r = 1; r < allRosterValues.length; r++) {
        var row = allRosterValues[r];
        if (!row || row.length < 4) continue;

        // 열 순서나 앞 열(순번/학과 등)이 달라도 자동 감지하는 4열 슬라이딩 검색
        for (var c = 0; c <= row.length - 4; c++) {
          var cGradeDigits = extractDigits(row[c]);
          var cClassDigits = extractDigits(row[c + 1]);
          var cNumDigits = extractDigits(row[c + 2]);
          var cNameClean = cleanStr(row[c + 3]);

          if (cGradeDigits === inGradeDigits &&
              cClassDigits === inClassDigits &&
              cNumDigits === inNumDigits &&
              cNameClean === inNameClean) {
            isMatchFound = true;
            break;
          }
        }
        if (isMatchFound) break;
      }

      // 명단과 불일치할 경우 차단
      if (!isMatchFound) {
        return ContentService.createTextOutput(JSON.stringify({
          result: "invalid_student",
          message: "등록된 학생 명단에 일치하는 인적사항이 없습니다. 학년, 반, 번호, 이름을 다시 확인해 주세요."
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 🔄 [설문응답] 시트에 안전 덮어쓰기 / 신규 추가
    var timestamp = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    var lastRow = responseSheet.getLastRow();
    var existingRowIndex = -1;

    if (lastRow > 1) {
      var rows = responseSheet.getRange(2, 1, lastRow - 1, 6).getValues();
      for (var i = 0; i < rows.length; i++) {
        var rowGradeDigits = extractDigits(rows[i][1]);
        var rowClassDigits = extractDigits(rows[i][2]);
        var rowNumDigits = extractDigits(rows[i][3]);
        var rowNameClean = cleanStr(rows[i][4]);

        if (rowGradeDigits === inGradeDigits && 
            rowClassDigits === inClassDigits && 
            rowNumDigits === inNumDigits && 
            rowNameClean === inNameClean) {
          existingRowIndex = i + 2;
          break;
        }
      }
    }

    var newRowData = [timestamp, inputGrade, inputClass, inputNum, inputName, subject];

    if (existingRowIndex > 0) {
      responseSheet.getRange(existingRowIndex, 1, 1, 6).setValues([newRowData]);
    } else {
      responseSheet.appendRow(newRowData);
    }

    return ContentService.createTextOutput(JSON.stringify({
      result: "success",
      message: "저장 완료"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  setupSheets();
  return ContentService.createTextOutput("기계시스템과 기능사 종목 조사 API가 정상 작동 중입니다.");
}
