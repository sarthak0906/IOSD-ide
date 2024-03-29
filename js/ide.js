var BASE_URL = localStorageGetItem("baseUrl") || "https://api.judge0.com";
var SUBMISSION_CHECK_TIMEOUT = 10; // in ms
var WAIT = localStorageGetItem("wait") == "true";

var sourceEditor, inputEditor, outputEditor;
var $insertTemplateBtn, $selectLanguageBtn, $runBtn, $saveBtn;
var $statusLine, $emptyIndicator;
var timeStart, timeEnd;

function encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function decode(bytes) {
  var escaped = escape(atob(bytes));
  try {
    return decodeURIComponent(escaped);
  } catch {
    return unescape(escaped);
  }
}

function getIdFromURI() {
  return location.search.substr(1).trim();
}

function updateEmptyIndicator() {
  if (outputEditor.getValue() == "") {
    $emptyIndicator.html("empty");
  } else {
    $emptyIndicator.html("");
  }
}

function handleError(jqXHR, textStatus, errorThrown) {
  outputEditor.setValue(JSON.stringify(jqXHR, null, 4));
  $statusLine.html(`${jqXHR.statusText} (${jqXHR.status})`);
}

function handleRunError(jqXHR, textStatus, errorThrown) {
  handleError(jqXHR, textStatus, errorThrown);
  $runBtn.button("reset");
  updateEmptyIndicator();
}

function handleResult(data) {
  timeEnd = performance.now();
  console.log("It took " + (timeEnd - timeStart) + " ms to get submission result.");

  var status = data.status;
  var stdout = decode(data.stdout || "");
  var stderr = decode(data.stderr || "");
  var compile_output = decode(data.compile_output || "");
  var message = decode(data.message || "");
  var time = (data.time === null ? "-" : data.time + "s");
  var memory = (data.memory === null ? "-" : data.memory + "KB");

  $statusLine.html(`${status.description}, ${time}, ${memory}`);

  if (status.id == 6) {
    stdout = compile_output;
  } else if (status.id == 13) {
    stdout = message;
  } else if (status.id != 3 && stderr != "") { // If status is not "Accepted", merge stdout and stderr
    stdout += (stdout == "" ? "" : "\n") + stderr;
  }

  outputEditor.setValue(stdout);

  updateEmptyIndicator();
  $runBtn.button("reset");
}

function run() {
  if (sourceEditor.getValue().trim() == "") {
    alert("Source code can't be empty.");
    return;
  } else {
    $runBtn.button("loading");
  }

  var sourceValue = encode(sourceEditor.getValue());
  var inputValue = encode(inputEditor.getValue());

  var languageId = ($selectLanguageBtn.val()-1) ? 34 : 10 ;
  // console.log(languageId);
  var data = {
    source_code: sourceValue,
    language_id: languageId,
    stdin: inputValue
  };

  timeStart = performance.now();
  $.ajax({
    url: BASE_URL + `/submissions?base64_encoded=true&wait=${WAIT}`,
    type: "POST",
    async: true,
    contentType: "application/json",
    data: JSON.stringify(data),
    success: function(data, textStatus, jqXHR) {
      console.log(`Your submission token is: ${data.token}`);
      if (WAIT == true) {
        handleResult(data);
      } else {
        setTimeout(fetchSubmission.bind(null, data.token), SUBMISSION_CHECK_TIMEOUT);
      }
    },
    error: handleRunError
  });
}

function fetchSubmission(submission_token) {
  $.ajax({
    url: BASE_URL + "/submissions/" + submission_token + "?base64_encoded=true",
    type: "GET",
    async: true,
    success: function(data, textStatus, jqXHR) {
      if (data.status.id <= 2) { // In Queue or Processing
        setTimeout(fetchSubmission.bind(null, submission_token), SUBMISSION_CHECK_TIMEOUT);
        return;
      }
      handleResult(data);
    },
    error: handleRunError
  });
}

function save() {
  var content = JSON.stringify({
    source_code: encode(sourceEditor.getValue()),
    stdin: encode(inputEditor.getValue()),
    language_id: $selectLanguageBtn.val()
  });
  var filename = "judge0-ide.json";
  var data = {
    content: content,
    filename: filename
  };

  $saveBtn.button("loading");
  $.ajax({
    url: "https://ptpb.pw",
    type: "POST",
    async: true,
    headers: {
      "Accept": "application/json"
    },
    data: data,
    success: function(data, textStatus, jqXHR) {
      $saveBtn.button("reset");
      if (getIdFromURI() != data["long"]) {
        window.history.replaceState(null, null, location.origin + location.pathname + "?" + data["long"]);
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      handleError(jqXHR, textStatus, errorThrown);
      $saveBtn.button("reset");
    }
  });
}

function loadSavedSource() {
  $.ajax({
    url: "https://ptpb.pw/" + getIdFromURI(),
    type: "GET",
    success: function(data, textStatus, jqXHR) {
      sourceEditor.setValue(decode(data["source_code"] || ""));
      inputEditor.setValue(decode(data["stdin"] || ""));
      $selectLanguageBtn[0].value = data["language_id"];
      setEditorMode();
      focusAndSetCursorAtTheEnd();
    },
    error: function(jqXHR, textStatus, errorThrown) {
      alert("Code not found!");
      window.history.replaceState(null, null, location.origin + location.pathname);
      loadRandomLanguage();
    }
  });
}

function setEditorMode() {
  sourceEditor.setOption("mode", $selectLanguageBtn.find(":selected").attr("mode"));
}

function focusAndSetCursorAtTheEnd() {
  sourceEditor.focus();
  sourceEditor.setCursor(sourceEditor.lineCount(), 0);
}

function insertTemplate() {
  var value = parseInt($selectLanguageBtn.val());
  sourceEditor.setValue(sources[value]);
  focusAndSetCursorAtTheEnd();
  sourceEditor.markClean();
}

function loadRandomLanguage() {
  var randomChildIndex = Math.floor(Math.random()*$selectLanguageBtn[0].length);
  $selectLanguageBtn[0][randomChildIndex].selected = true;
  setEditorMode();
  insertTemplate();
}

function initializeElements() {
  $selectLanguageBtn = $("#selectLanguageBtn");
  $insertTemplateBtn = $("#insertTemplateBtn");
  $runBtn = $("#runBtn");
  $saveBtn = $("#saveBtn");
  $vimCheckBox = $("#vimCheckBox");
  $emptyIndicator = $("#emptyIndicator");
  $statusLine = $("#statusLine");
}

function localStorageSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (ignorable) {
  }
}

function localStorageGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (ignorable) {
    return null;
  }
}

$(document).ready(function() {
  initializeElements();

  $(function () {
    $('[data-toggle="tooltip"]').tooltip()
  });

  sourceEditor = CodeMirror(document.getElementById("sourceEditor"), {
    lineNumbers: true,
    indentUnit: 4,
    indentWithTabs: true,
    showCursorWhenSelecting: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    keyMap: localStorageGetItem("keyMap") || "default",
    extraKeys: {
      "Tab": function(cm) {
        var spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
        cm.replaceSelection(spaces);
      }
    }
  });

  inputEditor = CodeMirror(document.getElementById("inputEditor"), {
    lineNumbers: true,
    mode: "plain"
  });
  outputEditor = CodeMirror(document.getElementById("outputEditor"), {
    readOnly: true,
    mode: "plain"
  });

  $vimCheckBox.prop("checked", localStorageGetItem("keyMap") == "vim").change();

  if (getIdFromURI()) {
    loadSavedSource();
  } else {
    loadRandomLanguage();
  }

  if (BASE_URL != "https://api.judge0.com") {
    $("#apiLink").attr("href", BASE_URL);
    $("#apiLink").html(BASE_URL);
  }

  $selectLanguageBtn.change(function(e) {
    if (sourceEditor.isClean()) {
      insertTemplate();
    }
    setEditorMode();
  });

  $insertTemplateBtn.click(function(e) {
    if (!sourceEditor.isClean() && confirm("Are you sure? Your current changes will be lost.")) {
      setEditorMode();
      insertTemplate();
    }
  });

  $("body").keydown(function(e){
    var keyCode = e.keyCode || e.which;
    if (keyCode == 120) { // F9
      e.preventDefault();
      run();
    } else if (keyCode == 119) { // F8
      e.preventDefault();
      var url = prompt("Enter URL of Judge0 API:", BASE_URL);
      if (url != null) {
        url = url.trim();
      }
      if (url != null && url != "") {
        BASE_URL = url;
        localStorageSetItem("baseUrl", BASE_URL);
        if (BASE_URL != "https://api.judge0.com") {
          $("#apiLink").attr("href", BASE_URL);
          $("#apiLink").html(BASE_URL);
        }
      }
    } else if (keyCode == 118) { // F7
      e.preventDefault();
      WAIT=!WAIT;
      localStorageSetItem("wait", WAIT);
      alert(`Submission wait is ${WAIT ? "ON. Enjoy" : "OFF"}.`);
    } else if (event.ctrlKey && keyCode == 83) { // Ctrl+S
      e.preventDefault();
      save();
    }
  });

  $runBtn.click(function(e) {
    run();
  });

  CodeMirror.commands.save = function(){ save(); };
  $saveBtn.click(function(e) {
    save();
  });

  $("#downloadSourceBtn").click(function(e) {
    var value = parseInt($selectLanguageBtn.val());
    download(sourceEditor.getValue(), fileNames[value], "text/plain");
  });

  $("#downloadInputBtn").click(function(e) {
    download(inputEditor.getValue(), "input.txt", "text/plain");
  });

  $("#downloadOutputBtn").click(function(e) {
    download(outputEditor.getValue(), "output.txt", "text/plain");
  });
});

// Template Sources
var cppSource = "\
#include <iostream>\n\
\n\
using namespace std; \n\
\n\
int main() {\n\
    cout << \"hello, world\" << endl;\n\
    return 0;\n\
}";
var pythonSource = "print(\"hello, world\")\n";

var sources = {
  1: cppSource,
  2: pythonSource
};

var fileNames = {
  1: "main.cpp",
  2: "main.py"
};
