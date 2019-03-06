/*
* Copyright 2018 ARDUINO SA (http://www.arduino.cc/)
* This file is part of arduino-iot-google-sheet-script.
* Copyright (c) 2019
* Authors: Marco Passarello
*
* This software is released under:
* The GNU General Public License, which covers the main part of 
* arduino-iot-google-sheet-script
* The terms of this license can be found at:
* https://www.gnu.org/licenses/gpl-3.0.en.html
*
* You can be released from the requirements of the above licenses by purchasing
* a commercial license. Buying such a license is mandatory if you want to modify or
* otherwise use the software for commercial activities involving the Arduino
* software without disclosing the source code of your own applications. To purchase
* a commercial license, send an email to license@arduino.cc.
*
*/


// get active spreasheet
var ss = SpreadsheetApp.getActiveSheet();

// get sheet named RawData
var sheet = ss.getSheetByName('RawData');


var MAX_ROWS = 1440;     // max number of data rows to display
// 3600s / cloud_int(30s) * num_ore(12h)
var HEADER_ROW = 1;     // row index of header
var TIMESTAMP_COL = 1;  // column index of the timestamp column

function doPost(e) {  
  var cloudData = JSON.parse(e.postData.contents); // this is a json object containing all info coming from IoT Cloud
  //var webhook_id = cloudData.webhook_id; // really not using these three
  //var device_id = cloudData.device_id;
  //var thing_id = cloudData.thing_id;
  var values = cloudData.values; // this is an array of json objects
  
  // store names and values from the values array
  // just for simplicity
  var incLength = values.length;
  var incNames = [];
  var incValues = [];
  for (var i = 0; i < incLength; i++) {
    incNames[i] = values[i].name;
    incValues[i] = values[i].value;
  }
  
  // read timestamp of incoming message
  var timestamp = values[0].updated_at;          // format: yyyy-MM-ddTHH:mm:ss.mmmZ
  var date = new Date(Date.parse(timestamp)); 
  
  /*
  This if statement is due to the fact that duplicate messages arrive from the cloud!
  If that occurs, the timestamp is not read correctly and date variable gets compromised.
  Hence, execute the rest of the script if the year of the date is well defined and it is greater
  then 2018 (or any other year before)
  */
  if (date.getYear() > 2018) {
  
    // discard all messages that arrive 'late'
    if (sheet.getRange(HEADER_ROW+1, 1).getValue() != '') { // for the first time app is run
      var now = new Date(); // now
      var COMM_TIME = 5; // rough overestimate of communication time between cloud and app
      if (now.getTime() - date.getTime() > COMM_TIME * 1000) {
        return;
      }
    }
    
    // this section write property names 
    sheet.getRange(HEADER_ROW, 1).setValue('timestamp');
    for (var i = 0; i < incLength; i++) {
      var lastCol = sheet.getLastColumn(); // at the very beginning this should return 1 // second cycle -> it is 2
      if (lastCol == 1) {
        sheet.getRange(HEADER_ROW, lastCol + 1).setValue(incNames[i]);
      } else {
        // check if the name is already in header
        var found = 0;
        for (var col = 2; col <= lastCol; col++) {
          if (sheet.getRange(HEADER_ROW, col).getValue() == incNames[i]) {
            found = 1;
            break;
          }
        }
        if (found == 0) {
          sheet.getRange(HEADER_ROW, lastCol+1).setValue(incNames[i]);
        }
      }
    }
    
    // redefine last coloumn and last row since new names could have been added
    var lastCol = sheet.getLastColumn();
    var lastRow = sheet.getLastRow();
    
    // delete last row to maintain constant the total number of rows
    if (lastRow > MAX_ROWS + HEADER_ROW - 1) { 
      sheet.deleteRow(lastRow);
    }
    
    // insert new row after deleting the last one
    sheet.insertRowAfter(HEADER_ROW);
    
    // reset style of the new row, otherwise it will inherit the style of the header row
    var range = sheet.getRange('A2:Z2');
    //range.setBackground('#ffffff');
    range.setFontColor('#000000');
    range.setFontSize(10);
    range.setFontWeight('normal');
    
    // write the timestamp
    sheet.getRange(HEADER_ROW+1, TIMESTAMP_COL).setValue(date).setNumberFormat("yyyy-MM-dd HH:mm:ss");
    
    // write values in the respective columns
    for (var col = 1+TIMESTAMP_COL; col <= lastCol; col++) {
      // first copy previous values
      // this is to avoid empty cells if not all properties are updated at the same time
      sheet.getRange(HEADER_ROW+1, col).setValue(sheet.getRange(HEADER_ROW+2, col).getValue());
      for (var i = 0; i < incLength; i++) {
        var currentName = sheet.getRange(HEADER_ROW, col).getValue();
        if (currentName == incNames[i]) {
          // turn boolean values into 0/1, otherwise google sheets interprets them as labels in the graph
          if (incValues[i] == true) {
            incValues[i] = 1;
          } else if (incValues[i] == false) {
            incValues[i] = 0;
          }
          sheet.getRange(HEADER_ROW+1, col).setValue(incValues[i]);
        } 
      }
    }  
  
  } // end if (date.getYear() > 2018)
}
