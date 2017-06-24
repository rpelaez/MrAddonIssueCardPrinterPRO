(function() {
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position) {
      position = position || 0;
      return this.indexOf(searchString, position) === position;
    };
  }

  var global = {};
  global.version = "2.5";
  global.issueTrackingUrl = "github.com/rpelaez/MrAddonIssueCardPrinterPRO";

  global.isDev = document.currentScript == null;

  var $ = jQuery;

  // enforce jQuery
  if (typeof jQuery == 'undefined') {
    alert("jQuery is required!\n\nPlease create an issue at\n" + global.issueTrackingUrl);
    return;
  }
  

  // run
  try {
    init().then(main).catch(handleError);
  } catch (e) {
    handleError(e);
  }

  function main() {
    var promises = [];

    ga('send', 'pageview');

    //preconditions
    if ($("#card-printer-iframe").length > 0) {
      closePrintPreview();
    }

    console.log("Run...")
    for (issueTracker of getIssueTrackers()) {
      if(issueTracker.isEligible()){
        console.log("Issue Tracker: " + issueTracker.name);
        global.appFunctions = issueTracker;
        break;
      }
    }

    if(!global.appFunctions){
      alert("Unsupported app. Please create an issue at " + global.issueTrackingUrl);
      return;
    }

    // add overlay frame
    var appFrame = createOverlayFrame();
    $("body").append(appFrame);


    // add convinient fields
    appFrame.window = appFrame.contentWindow;
    appFrame.document = appFrame.window.document;
    appFrame.document.open();
    appFrame.document.close();
    global.appFrame = appFrame;

    // add print dialog content
    $("head", global.appFrame.document).prepend(printPreviewElementStyle());
    $("body", global.appFrame.document).append(printPreviewElement());
    updatePrintDialoge();

    // get print content frame
    var printFrame = $("#card-print-dialog-content-iframe", global.appFrame.document)[0];
    // add convinient fields
    printFrame.window = printFrame.contentWindow;
    printFrame.document = printFrame.window.document;
    printFrame.document.open();
    printFrame.document.close();
    global.printFrame = printFrame;

    // add listeners to redraw crads on print event
    printFrame.window.addEventListener("resize", redrawCards);
    printFrame.window.matchMedia("print").addListener(redrawCards);

    // collect selcted issues
    var issueKeyList = global.appFunctions.getSelectedIssueKeyList();
    if (issueKeyList.length <= 0) {
      alert("Please select at least one issue.");
      return;
    } else if (issueKeyList.length > 30) {
      var confirmResult = confirm("Are you sure you want select " + issueKeyList.length + " issues?");
      if (!confirmResult) {
        return;
      }
    }

    // render cards
    promises.push(renderCards(issueKeyList));

    $("#card-print-dialog-title", global.appFrame.document).text("MrAddon® " + global.version + " - Loading...");
    return Promise.all(promises).then(function() {
      $("#card-print-dialog-title", global.appFrame.document).text("Issue Card Printer for JIRA " + global.version);
    });
  }

  function init() {
    var promises = [];

    console.log("Init...")
    initGoogleAnalytics();

    addStringFunctions();
    loadSettings();

    global.hostOrigin = "https://rpelaez.github.io/Jira-Issue-Card-Printer/";
    if (global.isDev) {
      console.log("DEVELOPMENT");
      global.hostOrigin = "https://rawgit.com/qoomon/Jira-Issue-Card-Printer/develop/";
    }
    global.resourceOrigin = global.hostOrigin + "resources/";

    var resources = getResources();

    global.cardHtml = resources.cardHtml;
    global.cardCss = resources.cardCss.replace(/https:\/\/rpelaez.github.io\/Jira-Issue-Card-Printer\/resources/g, global.resourceOrigin);
    global.printPreviewHtml = resources.printPreviewHtml;
    global.printPreviewCss = resources.printPreviewCss.replace(/https:\/\/rpelaez.github.io\/Jira-Issue-Card-Printer\/resources/g, global.resourceOrigin);

    return Promise.all(promises);
  }

  function error2object(value) {
      if (value instanceof Error) {
          var error = {};
          Object.getOwnPropertyNames(value).forEach(function (key) {
              error[key] = value[key];
          });
          return error;
      }
      return value;
  }

  function handleError(error){
    error = error2object(error);
    var error = JSON.stringify(error,2,2);
    console.log("ERROR " + error);
    ga('send', 'exception', { 'exDescription': error, 'exFatal': true });
    alert("Sorry something went wrong\n\nPlease create an issue with following details at\n" + global.issueTrackingUrl + "\n\n" + error);
  }

  function saveSettings(){
    var settings = global.settings;
    writeCookie("card_printer_scale", settings.scale);
    writeCookie("card_printer_row_count", settings.rowCount);
    writeCookie("card_printer_column_count", settings.colCount);

	writeCookie("card_printer_s1", settings.s1);
	writeCookie("card_printer_s2", settings.s2);
	writeCookie("card_printer_s3", settings.s3);
	writeCookie("card_printer_set_header", settings.setHeader);
    writeCookie("card_printer_single_card_page", settings.singleCardPage);
    writeCookie("card_printer_hide_description", settings.hideDescription);
    writeCookie("card_printer_hide_assignee", settings.hideAssignee);
    writeCookie("card_printer_hide_due_date", settings.hideDueDate);
    writeCookie("card_printer_hide_estimate", settings.hideEstimate);
    writeCookie("card_printer_hide_qr_code", settings.hideQrCode);
    writeCookie("card_printer_hide_labels", settings.hideLabels);
    writeCookie("card_printer_hide_reporter", settings.hideReporter);
    writeCookie("card_printer_hide_components", settings.hideComponents);
  }

  function loadSettings(){
    var settings = global.settings = global.settings || {};
    settings.scale = parseFloat(readCookie("card_printer_scale")) || 0.0;
    settings.rowCount = parseInt(readCookie("card_printer_row_count")) || 2;
    settings.colCount = parseInt(readCookie("card_printer_column_count")) || 1;

	settings.s1 = readCookie("card_printer_s1");
	settings.s2 = readCookie("card_printer_s2");
	settings.s3 = readCookie("card_printer_s3");
	settings.setHeader = readCookie("card_printer_set_header");
    settings.singleCardPage = parseBool(readCookie("card_printer_single_card_page"), true );
    settings.hideDescription = parseBool(readCookie("card_printer_hide_description"), false);
    settings.hideAssignee = parseBool(readCookie("card_printer_hide_assignee"), false);
    settings.hideDueDate = parseBool(readCookie("card_printer_hide_due_date"), false);
    settings.hideEstimate = parseBool(readCookie("card_printer_hide_estimate"), false);
    settings.hideQrCode = parseBool(readCookie("card_printer_hide_qr_code"), false);
    settings.hideLabels = parseBool(readCookie("card_printer_hide_labels"), false);
    settings.hideReporter = parseBool(readCookie("card_printer_hide_reporter"), false);
    settings.hideComponents = parseBool(readCookie("card_printer_hide_components"), false);
  }

  function print() {
    ga('send', 'event', 'button', 'click', 'print', $(".card", global.printFrame.contentWindow.document).length);
    global.printFrame.contentWindow.print();
  }

  function createOverlayFrame(){
    var appFrame = document.createElement('iframe');
    appFrame.id = "card-printer-iframe";
    $(appFrame).css({
      'position': 'fixed',
      'height': '100%',
      'width': '100%',
      'top': '0',
      'left': '0',
      'background': 'rgba(0, 0, 0, 0.0)',
      'boxSizing': 'border-box',
      'wordWrap': 'break-word',
      'zIndex': '99999'
    });
    return appFrame;
  }

  function updatePrintDialoge(){
    var appFrameDocument = global.appFrame.document;
    var settings = global.settings;
    $("#scaleRange", appFrameDocument).val(settings.scale);
    $("#scaleRange", appFrameDocument).parent().find("output").val(settings.scale);
    $("#rowCount", appFrameDocument).val(settings.rowCount);
    $("#columnCount", appFrameDocument).val(settings.colCount);

    $("#single-card-page-checkbox", appFrameDocument).attr('checked', settings.singleCardPage );
    $("#description-checkbox", appFrameDocument).attr('checked', !settings.hideDescription );
    $("#assignee-checkbox", appFrameDocument).attr('checked', !settings.hideAssignee );
    $("#due-date-checkbox", appFrameDocument).attr('checked', !settings.hideDueDate );
    $("#estimate-checkbox", appFrameDocument).attr('checked', !settings.hideEstimate );
    $("#qr-code-checkbox", appFrameDocument).attr('checked', !settings.hideQrCode );
    $("#labels-checkbox", appFrameDocument).attr('checked', !settings.hideLabels );
    $("#reporter-checkbox", appFrameDocument).attr('checked', !settings.hideReporter );
    $("#components-checkbox", appFrameDocument).attr('checked', !settings.hideComponents );
  }

  function renderCards(issueKeyList) {
    var promises = [];

    var printFrameDocument = global.printFrame.document;

    printFrameDocument.open();
    printFrameDocument.write("<head/><body></body>");
    printFrameDocument.close();

    $("head", printFrameDocument).append(cardElementStyle());
    $("body", printFrameDocument).append("<div id='preload'/>");
    $("#preload", printFrameDocument).append("<div class='zigzag'/>");

    console.log("load " + issueKeyList.length + " issues...");

    $.each(issueKeyList, function(index, issueKey) {
      var card = cardElement(issueKey);
      card.attr("index", index);
      card.find('.issue-id').text(issueKey);
      $("body", printFrameDocument).append(card);

      promises.push(global.appFunctions.getCardData(issueKey).then(function(cardData) {
        // console.log("cardData: " + JSON.stringify(cardData,2,2));
        ga('send', 'event', 'card', 'generate', cardData.type);
        fillCard(card, cardData);
        redrawCards();
      }));
    });

    console.log("wait for issues loaded...");
    return Promise.all(promises).then(function() {
      console.log("...all issues loaded.");
      redrawCards();
    });
  }

  function redrawCards() {
    styleCards();
    scaleCards();
    cropCards();
    resizeIframe(global.printFrame);
  }

  function fillCard(card, data) {
  
   	//Header
   	if (global.settings.setHeader != "" &&  global.settings.setHeader != null &&  global.settings.setHeader != "null") {
    	card.find('.author').text(global.settings.setHeader);
    }

    //Key
    card.find('.issue-id').text(data.key);

    //Type
    card.find(".issue-icon").attr("type", data.type);

    //Summary
    card.find('.issue-summary').text(data.summary);

    //Description
    if (data.description) {
      card.find('.issue-description').html(data.description);
    } else {
      card.find(".issue-description").addClass("hidden");
    }

    //Assignee
    if (data.assignee) {
      if (data.avatarUrl) {
        card.find(".issue-assignee").css("background-image", "url('" + data.avatarUrl + "')");
      } else {
        card.find(".issue-assignee").text(data.assignee[0].toUpperCase());
      }
    } else {
      card.find(".issue-assignee").remove();
    }

    //Due-Date
    if (data.dueDate) {
      card.find(".issue-due-date").text(data.dueDate);
    } else {
      card.find(".issue-due-box").remove();
    }

    //Attachment
    if (data.hasAttachment) {} else {
      card.find('.issue-attachment').remove();
    }

    //Labels
    if (data.labels) {
      card.find(".issue-labels").text(data.labels);
    } else {
      card.find(".issue-labels").remove();
    }
    
    //Reporter
    if (data.reporter) {
      if (data.avatarUrlreporter) {
        card.find(".issue-reporter").css("background-image", "url('" + data.avatarUrlreporter + "')");
      } else {
        card.find(".issue-reporter").text(data.reporter[0].toUpperCase());
      }
    } else {
      card.find(".issue-reporter").remove();
    }
    
    //Components
    if (data.components) {
      card.find(".issue-components").text(data.components);
    } else {
      card.find(".issue-components").remove();
    }
    
    //Estimate
    if (data.estimate) {
      card.find(".issue-estimate").text(data.estimate);
    } else {
      card.find(".issue-estimate").remove();
    }

    //Epic
    if (data.superIssue) {
      card.find(".issue-epic-id").text(data.superIssue.key);
      card.find(".issue-epic-name").text(data.superIssue.summary);
    } else {
      card.find(".issue-epic-box").remove();
    }
    
    //Special Customfields
    //S1
   	if (global.settings.s1 != "" &&  global.settings.s1 != null &&  global.settings.s1 != "null") {
   		if (data.s1) {
    		card.find('.issue-s1').text(data.s1);
    	} else {
      		card.find(".issue-s1").remove();
    	}
    }
    //S2
   	if (global.settings.s2 != "" &&  global.settings.s2 != null &&  global.settings.s2 != "null") {
    	if (data.s2) {
    		card.find('.issue-s2').text(data.s2);
    	} else {
      		card.find(".issue-s2").remove();
    	}
    }
    //S3
   	if (global.settings.s3 != "" &&  global.settings.s3 != null &&  global.settings.s3 != "null") {
    	if (data.s3) {
    		card.find('.issue-s3').text(data.s3);
    	} else {
      		card.find(".issue-s3").remove();
    	}
    }

    //QR-Code
    var qrCodeUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=L|1&chl=' + encodeURIComponent(data.url);
    card.find(".issue-qr-code").css("background-image", "url('" + qrCodeUrl + "')");
  }

  function styleCards() {
    var settings = global.settings;
    var printFrame = global.printFrame

    // hide/show description
    $(".issue-description", printFrame.document).toggle(!settings.hideDescription);
    // hide/show assignee
    $(".issue-assignee", printFrame.document).toggle(!settings.hideAssignee);
    // hide/show due date
    $(".issue-due-box", printFrame.document).toggle(!settings.hideDueDate);
    // hide/show estimate
    $(".issue-estimate", printFrame.document).toggle(!settings.hideEstimate);
    // hide/show cr code
    $(".issue-qr-code", printFrame.document).toggle(!settings.hideQrCode);
    // hide/show labels
    $(".issue-labels", printFrame.document).toggle(!settings.hideLabels);
    // hide/show reporter
    $(".issue-reporter", printFrame.document).toggle(!settings.hideReporter);
    // hide/show components
    $(".issue-components", printFrame.document).toggle(!settings.hideComponents);


    // enable/disable single card page
    $(".card", printFrame.document).css({ 'page-break-after' : '', 'float' : '', 'margin-bottom': '' });
    if (settings.singleCardPage) {
      $(".card", printFrame.document).css({ 'page-break-after': 'always', 'float': 'none', 'margin-bottom': '20px' });
    } else {
      $(".card", printFrame.document).each(function(index, element){
        if(index % (settings.colCount * settings.rowCount ) >= (settings.colCount * (settings.rowCount - 1))){
          $(element).css({ 'margin-bottom': '20px' });
        }
      });
    }
  }

  function scaleCards() {
    var settings = global.settings;
    var printFrame = global.printFrame;

    var scaleValue = settings.scale * 2.0;
    var scaleRoot;
    if(scaleValue < 0) {
      scaleRoot = 1.0 / (1.0 - scaleValue);
    } else {
      scaleRoot = 1.0 * (1.0 + scaleValue);
    }

    var rowCount = settings.rowCount;
    var columnCount = settings.colCount;

    // scale

    // reset scale
    $("html", printFrame.document).css("font-size", scaleRoot + "cm");
    $("#gridStyle", printFrame.document).remove();

    // calculate scale

    var bodyElement = $("body", printFrame.document);
    var cardMaxWidth = Math.floor(bodyElement.outerWidth() / columnCount);
    var cardMaxHeight = Math.floor(bodyElement.outerHeight() / rowCount);

    var cardElement = $(".card", printFrame.document);
    var cardMinWidth = cardElement.css("min-width") ? cardElement.css("min-width").replace("px", "") : 0;
    var cardMinHeight = cardElement.css("min-height") ? cardElement.css("min-height").replace("px", "") : 0;

    var scaleWidth = cardMaxWidth / cardMinWidth ;
    var scaleHeight = cardMaxHeight / cardMinHeight ;
    var scale = Math.min(scaleWidth, scaleHeight, 1);

    // scale
    $("html", printFrame.document).css("font-size", ( scaleRoot * scale ) + "cm");

    // grid size
    var style = document.createElement('style');
    style.id = 'gridStyle';
    style.type = 'text/css';
    style.innerHTML = ".card { "+
    "width: calc( 100% / " + columnCount + " );" +
    "height: calc( 100% / " + rowCount + " );"+
    "}";
    $("head", printFrame.document).append(style);
  }

  function cropCards() {
    var cardElements = Array.from(global.printFrame.document.querySelectorAll(".card"));
    cardElements.forEach(function(cardElement) {
      var cardContent = cardElement.querySelectorAll(".card-body")[0];
      if (cardContent.scrollHeight > cardContent.offsetHeight) {
        cardContent.classList.add("zigzag");
      } else {
        cardContent.classList.remove("zigzag");
      }
    });
  }

  function closePrintPreview() {
    $("#card-printer-iframe").remove();
  }

  //############################################################################################################################
  //############################################################################################################################
  //############################################################################################################################

  // http://www.cssdesk.com/T9hXg

  function printPreviewElement() {
    var result = $('<div/>').html(global.printPreviewHtml).contents();

    // info
    result.find("#set-header").click(function(event) { 
      global.settings.setHeader = prompt("Write the header. Let empty or cancel to reset.", global.settings.setHeader);;
      saveSettings();
      main();
      return true;
    });
    
    result.find("#set-s1").click(function(event) { 
      global.settings.s1 = prompt("Actual Value:'" + global.settings.s1 + "'. Now you can show customfields, just write 'customfield_xxx'. Let empty or cancel to reset.",global.settings.s1);;
      saveSettings();
      main();
      return true;
    });
    
    result.find("#set-s2").click(function(event) { 
      global.settings.s2 = prompt("Actual Value:'" + global.settings.s2 + "'. Now you can show customfields, just write 'customfield_xxx'. Let empty or cancel to reset.",global.settings.s2);;
      saveSettings();
      main();
      return true;
    });
    
    result.find("#set-s3").click(function(event) { 
      global.settings.s3 = prompt("Actual Value:'" + global.settings.s3 + "'. Now you can show customfields, just write 'customfield_xxx'. Let empty or cancel to reset.",global.settings.s3);;
      saveSettings();
      main();
      return true;
    });
    
    result.find("#report-issue").click(function(event) {
      window.open('https://jirasupport.atlassian.net/servicedesk/customer/portal/1');
      return false;
    });

    result.find("#about").click(function(event) {
      window.open('http://www.mraddon.com');
      return false;
    });
    
    result.find("#qoomon").click(function(event) {
      window.open('http://qoomon.blogspot.com.es/2014/01/jira-issue-card-printer-bookmarklet.html');
      return false;
    });

    // enable single card page

    result.find("#single-card-page-checkbox").click(function() {
      global.settings.singleCardPage = this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // hide description

    result.find("#description-checkbox").click(function() {
      global.settings.hideDescription = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // show assignee

    result.find("#assignee-checkbox").click(function() {
      global.settings.hideAssignee = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });
    
    // show reporter

    result.find("#reporter-checkbox").click(function() {
      global.settings.hideReporter = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });
    
    // show components

    result.find("#components-checkbox").click(function() {
      global.settings.hideComponents = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // show due date

    result.find("#due-date-checkbox").click(function() {
      global.settings.hideDueDate = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // show due date

    result.find("#estimate-checkbox").click(function() {
      global.settings.hideEstimate = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

	// show labels

    result.find("#labels-checkbox").click(function() {
      global.settings.hideLabels = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // show QR Code

    result.find("#qr-code-checkbox").click(function() {
      global.settings.hideQrCode = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // scale font

    result.find("#scaleRange").on("input", function() {
      global.settings.scale = $(this).val();
      saveSettings();
      redrawCards();
    });

    // grid

    result.find("#rowCount").on("input", function() {
      global.settings.rowCount = $(this).val();
      saveSettings();
      redrawCards();
    });
    result.find("#rowCount").click(function() {
      this.select();
    });


    result.find("#columnCount").on("input", function() {
      global.settings.colCount = $(this).val();
      saveSettings();
      redrawCards();
    });
    result.find("#columnCount").click(function() {
      this.select();
    });


    // print

    result.find("#card-print-dialog-print")
      .click(function(event) {
        print();
        return false;
      });

    // closePrintPreview

    result.find("#card-print-dialog-cancel")
      .click(function(event) {
        closePrintPreview();
        return false;
      });

    result.click(function(event) {
        if (event.target == this) {
          closePrintPreview();
        }
      return true;
    });

    $(document).keyup(function(e) {
      if (e.keyCode == 27) { // ESC
        closePrintPreview();
      }
    });

    // prevent background scrolling
    result.scroll(function(event) {
        return false;
    });

    return result;
  }

  function printPreviewElementStyle() {
    var result = $(document.createElement('style'))
      .attr("type", "text/css")
      .html(global.printPreviewCss);
    return result;
  }

  // card layout: http://jsfiddle.net/qoomon/ykbLb2pw/76

  function cardElement(issueKey) {
    var result = $('<div/>').html(global.cardHtml).contents()
      .attr("id", issueKey)
    return result;
  }

  function cardElementStyle() {
    var result = $(document.createElement('style'))
      .attr("type", "text/css")
      .html(global.cardCss);
    return result;
  }

  //############################################################################################################################
  // APP Specific Functions
  //############################################################################################################################

  function getIssueTrackers(){
    var issueTrackers = []

    var jiraFunctions = (function(module) {
      module.name = "JIRA";

      module.baseUrl = function() {
        var jiraBaseUrl = window.location.origin;
        try { jiraBaseUrl = $("input[title='baseURL']").attr('value'); } catch(ex){}
        return jiraBaseUrl
      }

      module.isEligible = function(){
        return $("meta[name='application-name'][ content='JIRA']").length > 0;
      }

      module.getSelectedIssueKeyList = function() {

        //Issues
        if (/.*\/issues\/.*/g.test(document.URL)) {

          var issues =  $('.issue-list > li').map(function() {
              return $(this).attr('data-key');
          });

          //backward compatibility
          if (issues.empty()) {
            issues =  $('tr[data-issuekey]').map(function() {
              return $(this).attr('data-issuekey');
            });
          }

          return issues;
        }

        //Browse
        if (/.*\/browse\/.*/g.test(document.URL)) {
          return [document.URL.match(/.*\/browse\/([^?]*).*/)[1]];
        }

        //Project
        if (/.*\/projects\/.*/g.test(document.URL)) {
          return [document.URL.match(/.*\/projects\/[^\/]*\/[^\/]*\/([^?]*).*/)[1]];
        }

        // RapidBoard
        if (/.*\/secure\/RapidBoard.jspa.*/g.test(document.URL)) {
          return $('div[data-issue-key].ghx-selected').map(function() {
            return $(this).attr('data-issue-key');
          });
        }

        return [];
      };

      module.getCardData = function(issueKey) {
        var promises = [];
        var issueData = {};

        promises.push(module.getIssueData(issueKey).then(function(data) {
          var promises = [];
          issueData.key = data.key;
          issueData.type = data.fields.issuetype.name.toLowerCase();
          issueData.summary = data.fields.summary;
          issueData.description = data.renderedFields.description;
          
          if (data.fields.assignee) {
            issueData.assignee = data.fields.assignee.displayName;
            var avatarUrl = data.fields.assignee.avatarUrls['48x48'];
            if (avatarUrl.indexOf("ownerId=") >= 0) {
              issueData.avatarUrl = avatarUrl;
            }
          }
          
          if (data.fields.reporter) {
            issueData.reporter = data.fields.reporter.displayName;
            var avatarUrlreporter = data.fields.reporter.avatarUrls['48x48'];
            if (avatarUrlreporter.indexOf("ownerId=") >= 0) {
              issueData.avatarUrlreporter = avatarUrlreporter;
            }
          }

          if (data.fields.duedate) {
            issueData.dueDate = formatDate(new Date(data.fields.duedate));
          }

          issueData.hasAttachment = data.fields.attachment.length > 0;
          issueData.estimate = data.fields.storyPoints;
          issueData.labels = data.fields.labels.toString();
          if ( data.fields.components.length > 0) {
          	issueData.components = data.fields.components[0].name;
          } 
          if ( data.fields.components.length > 1) {
          	issueData.components = issueData.components + "," + data.fields.components[1].name;
          } 

		  
          if (data.fields.parent) {
            promises.push(module.getIssueData(data.fields.parent.key).then(function(data) {
              issueData.superIssue = {};
              issueData.superIssue.key = data.key;
              issueData.superIssue.summary = data.fields.summary;
            }));
          } else if (data.fields.epicLink) {
            promises.push(module.getIssueData(data.fields.epicLink).then(function(data) {
              issueData.superIssue = {};
              issueData.superIssue.key = data.key;
              issueData.superIssue.summary = data.fields.epicName;
            }));
          }

          issueData.url = module.baseUrl() + "/browse/" + issueData.key;

		  //alert( data.fields.s1 + " o " + data.fields.s2 + " o " + data.fields.s3 );
		  issueData.s1 = data.fields.s1
		  if ( data.fields.s1.value ) issueData.s1 = data.fields.s1.value
		  issueData.s2 = data.fields.s2
		  if ( data.fields.s2.value ) issueData.s2 = data.fields.s2.value
		  issueData.s3 = data.fields.s3
		  if ( data.fields.s3.value ) issueData.s3 = data.fields.s3.value
		  
          return Promise.all(promises);
        }));

        return Promise.all(promises).then(function(results){return issueData;});
      };

      module.getIssueData = function(issueKey) {
        //https://docs.atlassian.com/jira/REST/latest/
        var url = module.baseUrl() + '/rest/api/2/issue/' + issueKey + '?expand=renderedFields,names';
        console.log("IssueUrl: " + url);
        //console.log("Issue: " + issueKey + " Loading...");
        return httpGetJSON(url).then(function(responseData) {
          //console.log("Issue: " + issueKey + " Loaded!");
          // add custom fields with field names
          $.each(responseData.names, function(key, value) {
            if (key.startsWith("customfield_")) {
              var fieldName = value.toCamelCase();
              var fieldValue = responseData.fields[key];
              
              //Switch field s1
              if (global.settings.s1 != "" &&  global.settings.s1 != null &&  global.settings.s1 != "null") {
   			 	if (key == global.settings.s1){
                  fieldName = 's1'
                }
    		  }
    		  
    		  //Switch field s2
   			  if (global.settings.s2 != "" &&  global.settings.s2 != null &&  global.settings.s2 != "null") {
    			if (key == global.settings.s2){
                  fieldName = 's2'
                }
    		  }
    		  
    		  //Switch field s3
   			  if (global.settings.s3 != "" &&  global.settings.s3 != null &&  global.settings.s3 != "null") {
    			if (key == global.settings.s3){
                  fieldName = 's3'
                }
    		  }

              //deposit-solutions specific field mapping
              if(/.*\.deposit-solutions.com/g.test(window.location.hostname)){
                if (key == 'customfield_10006'){
                  fieldName = 'epicLink'
                }
                if (key == 'customfield_10007'){
                  fieldName = 'epicName'
                }
                if (key == 'customfield_10002'){
                  fieldName = 'storyPoints'
                }
              }
              
              //lufthansa specific field mapping
               if(/.*trackspace.lhsystems.com/g.test(window.location.hostname)){
                if (key == 'Xcustomfield_10006'){
                  fieldName = 'epicLink'
                }
                if (key == 'Xcustomfield_10007'){
                  fieldName = 'epicName'
                }
                if (key == 'Xcustomfield_10002'){
                  fieldName = 'storyPoints'
                }
                if (fieldName == 'desiredDate') {
                 fieldName ='dueDate'
                 fieldValue = formatDate(new Date(fieldValue));
                }
              }
              
              //console.log("add new field: " + fieldName + " with value from " + key);
              responseData.fields[fieldName] = fieldValue;
            }
          });
          return responseData;
        });
      };

      return module;
    }({}));
    issueTrackers.push(jiraFunctions);


    return issueTrackers;
  }

  //############################################################################################################################
  //############################################################################################################################
  //############################################################################################################################

  function initGoogleAnalytics() {
    if (global.isDev) {
      this.ga = function(){ console.log("GoogleAnalytics: " + Object.keys(arguments).map(key => arguments[key]))}
      return;
    }
    // <GoogleAnalytics>
    (function(i, s, o, g, r, a, m) {
      i['GoogleAnalyticsObject'] = r;
      i[r] = i[r] || function() {
        (i[r].q = i[r].q || []).push(arguments)
      }, i[r].l = 1 * new Date();
      a = s.createElement(o),
        m = s.getElementsByTagName(o)[0];
      a.async = 1;
      a.src = g;
      m.parentNode.insertBefore(a, m)
    })(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

    ga('create', 'UA-50840116-3', {
      'alwaysSendReferrer': true
    });
    ga('set', 'page', '/cardprinter');
  }

  //############################################################################################################################
  //############################################################################################################################
  //############################################################################################################################

  function parseBool(text, def){
    if(text == 'true') return true;
    else if ( text == 'false') return false;
    else return def;
  }

  function appendScript(url, callback) {

    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.src = url;

    // Then bind the event to the callback function.
    // There are several events for cross browser compatibility.
    script.onreadystatechange = callback;
    script.onload = callback;

    head.appendChild(script);
  }

  function readCookie(name) {
    var cookies = document.cookie.split('; ');

    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i].split('=');
      if (cookie[0] == name) return cookie[1];
    }
    return null;
  }

  function writeCookie(name, value) {
    var expireDate = new Date();  // current date & time
    expireDate.setFullYear(expireDate.getFullYear() + 1) // one year
    document.cookie = name + "=" + value + "; path=/; expires=" + expireDate.toGMTString();

    // cleanup due to former path
    document.cookie = name + "=; expires=" + new Date(0).toGMTString();
  }

  function httpGetCORS(){
    //arguments[0] = 'https://jsonp.afeld.me/?url=' + arguments[0];
    //arguments[0] = 'http://cors.io/?u=' + arguments[0];
    arguments[0] = 'https://crossorigin.me/' + arguments[0];
    return httpGet.apply(this, arguments);
  }

  function httpGet(){
    return Promise.resolve($.get.apply(this, arguments));
  }

  function httpGetJSON(){
    return Promise.resolve($.getJSON.apply(this, arguments));
  }

  function resizeIframe(iframe) {
    iframe = $(iframe);
    iframe.height(iframe[0].contentWindow.document.body.height);
  }

  function addStringFunctions() {

    //trim string - remove leading and trailing whitespaces
    if (!String.prototype.trim) {
      String.prototype.trim = function() {
        return this.replace(/^\s+|\s+$/g, '');
      };
    }

    if (!String.prototype.startsWith) {
      String.prototype.startsWith = function(str) {
        return this.slice(0, str.length) == str;
      };
    }

    if (!String.prototype.endsWith) {
      String.prototype.endsWith = function(str) {
        return this.slice(-str.length) == str;
      };
    }

    if (!String.prototype.toCamelCase) {
      String.prototype.toCamelCase = function() {
        // remove all characters that should not be in a variable name
        // as well underscores an numbers from the beginning of the string
        var s = this.replace(/([^a-zA-Z0-9_\- ])|^[_0-9]+/g, "").trim().toLowerCase();
        // uppercase letters preceeded by a hyphen or a space
        s = s.replace(/([ -]+)([a-zA-Z0-9])/g, function(a, b, c) {
          return c.toUpperCase();
        });
        // uppercase letters following numbers
        s = s.replace(/([0-9]+)([a-zA-Z])/g, function(a, b, c) {
          return b + c.toUpperCase();
        });
        return s;
      }
    }
  }

  function formatDate(date) {
    var shortMonths = {'Jan': 1, 'Feb':2, 'Mar':3, 'Apr':4, 'May':5, 'Jun':6, 'Jul':7, 'Aug':8, 'Sep':9, 'Oct':10, 'Nov':11, 'Dec':12 };
    var dateSplit = date.toString().split(" ");
    // Mo 28.11.
    return dateSplit[0] + " " + dateSplit[2] + "." + shortMonths[dateSplit[1]] + ".";
  }

  function multilineString(commentFunction) {
      return commentFunction.toString()
          .replace(/^[^\/]+\/\*!?/, '')
          .replace(/\*\/[^\/]+$/, '');
  }

  //############################################################################################################################
  // Resources
  //############################################################################################################################
  function getResources(){
   var resources = {};
   resources.cardHtml = multilineString(function(){/*
     <div class="card">
       <div class="card-content">
         <div class="card-body shadow">
           <div class="issue-summary"></div>
           <div class="issue-description"></div>
         </div>
         <div class="card-header">
           <div class="author">
             <span>Qoomon.com & MrAddon.com</span>
             <br>
             <span>©BengtBrodersen / ®RaulPelaez</span>
           </div>
           <div class="issue-id badge"></div>
           <div class="issue-id-fadeout"></div>
           <div class="issue-icon badge" type="loading"></div>
           <div class="issue-estimate badge"></div>
           <div class="issue-s1 badge"></div>
           <div class="issue-s2 badge"></div>
           <div class="issue-s3 badge"></div>
           <div class="issue-due-box">
             <div class="issue-due-date badge"></div>
             <div class="issue-due-icon badge"></div>
           </div>
         </div>
         <div class="card-footer">
           <div class="issue-qr-code badge"></div>
           <div class="issue-attachment badge"></div>
           <div class="issue-assignee badge"></div>
           <div class="issue-reporter badge"></div>
           <div class="issue-epic-box badge">
             <span class="issue-epic-id"></span><br>
             <span class="issue-epic-name"></span>
           </div>
           <div class="issue-labels badge"></div>
           <div class="issue-components badge"></div>
         </div>
       </div>
     </div>
     */});
    resources.cardCss = multilineString(function(){/*
     * {
       box-sizing: border-box;
       overflow: hidden;
     }
     html {
       background-color: LIGHTGREY;
       padding: 0rem;
       margin: 1rem;
       font-size: 1.0cm;
       overflow-y: scroll;
     }
     body {
       padding: 0rem;
       margin: 0rem;
       max-height: 100%;
       max-width: 100%;
       overflow: visible;
     }
     .badge, .shadow {
       border-style: solid;
       border-color: #454545;
       border-top-width: 0.12rem;
       border-left-width: 0.12rem;
       border-bottom-width: 0.21rem;
       border-right-width: 0.21rem;
       border-radius: 0.25rem;
     }
     .badge {
       background-color: WHITESMOKE;
     }
     .hidden {
       display: none;
     }
     .zigzag {
       border-bottom-width: 0rem;
     }
     .zigzag::after {
         box-sizing: border-box;
         position: absolute;
         bottom: 0.00rem;
         left: 0.0rem;
         content: "";
         width: 100%;
         border-style: solid;
         border-bottom-width: 0.5rem;
         border-image: url(https://rawgit.com/qoomon/Jira-Issue-Card-Printer/develop/resources//Tearing.png);
         border-image-width: 0 0 0.7rem 0;
         border-image-slice: 56 0 56 1;
         border-image-repeat: round round;
     }
     #preload {
       position: fixed;
       top: 0rem;
       left: 100%;
     }
     .author {
       color: DIMGREY;
       position: relative;
       top: 0.2rem;
       left: calc(50% - 2rem);
       font-size: 0.8rem;
       overflow: visible;
       line-height: 0.38rem;
     }
     .author > span:nth-of-type(2) {
       position: relative;
       top: 0.1rem;
       left: 0.65rem;
       font-size: 0.5em;
     }
     .card {
       position: relative;
       float: left;
       height: 100%;
       width: 100%;
       padding: 0.5rem;
       min-width: 14.5rem;
       min-height: 8.65rem;
       overflow: hidden;
       background-color: WHITE;
     }
     .card::before {
         box-sizing: border-box;
         overflow: visible;
         position: absolute;
         top: 0.0rem;
         left: 0.0rem;
         content: "";
         width: 100%;
         height: 100%;
         border-color: LightGray;
         border-style: dashed;
         border-width: 0.03cm;
     }
     .card-content {
       position: relative;
       height: 100%;
       // find .card-header;
       padding-top: 2rem;
       // find .card-footer;
       padding-bottom: 1.3rem;
     }
     .card-body {
       position: relative;
       height: 100%;
       margin-left: 0.4rem;
       margin-right: 0.4rem;
       padding-top: 1.1rem;
       padding-bottom: 1.1rem;
       padding-left: 0.4rem;
       padding-right: 0.4rem;
       background: WHITE;
     }
     .card-header {
       position: absolute;
       top: 0rem;
       height: 4.2rem;
       width: 100%;
     }
     .card-footer {
       position: absolute;
       bottom: 0rem;
       height: 2.2rem;
       width: 100%;
     }
     .issue-summary {
       font-weight: bold;
       font-size: 0.9rem;
     }
     
     .issue-description {
       margin-top: 0.1rem;
       display: block;
       font-size: 0.6rem;
       line-height: 0.62rem;
       overflow: hidden;
     }
     .issue-description p:first-of-type {
       margin-top: 0rem;
     }
     .issue-description p:last-of-type {
       margin-bottom: 0rem;
     }
     .issue-id {
       position: absolute;
       left: 1rem;
       top: 1.2rem;
       height: 1.5rem;
       max-width: calc(100% - 7.5rem);
       min-width: 6.0rem;
       padding-left: 2.1rem;
       padding-right: 0.4rem;
       background-color: WHITESMOKE;
       line-height: 1.3rem;
       font-size: 0.8rem;
       font-weight: bold;
       text-align: center;
       white-space: nowrap;
       direction: rtl;
     }
     .issue-id-fadeout {
       position: absolute;
       left: 2.4rem;
       top: 1.3rem;
       width: 1.2rem;
       height: 1.2rem;
       z-index: 0;
       background: linear-gradient(to left, rgba(224, 224, 224, 0) 0%, rgba(224, 224, 224, 1) 60%);
     }
     .issue-icon {
       position: absolute;
       left: 0rem;
       top: 0rem;
       height: 3.0rem;
       width: 3.0rem;
       border-radius: 50%;
       background-color: LIGHTSEAGREEN;
       background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/Objects.png);
       background-repeat: no-repeat;
       background-position: center;
       background-size: 63%;
     }
     .issue-icon[type="loading"]{
       background-color: DEEPSKYBLUE;
       background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/CloudLoading.png);
     }
     .issue-icon[type="story"], .issue-icon[type="user story"] {
       background-color: GOLD;
       background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/Bulb.png);
     }
     .issue-icon[type="bug"], .issue-icon[type="problem"], .issue-icon[type="correction"]  {
       background-color: CRIMSON;
       background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/Bug.png);
     }
     .issue-icon[type="epic"] {
       background-color: ROYALBLUE;
       background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/Flash.png);
     }
     .issue-icon[type="task"], .issue-icon[type="sub-task"], .issue-icon[type="technical task"],
     .issue-icon[type="aufgabe"], .issue-icon[type="unteraufgabe"], .issue-icon[type="technische aufgabe"]  {
       background-color: WHEAT;
       background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/Task.png);
     }
     .issue-icon[type="new feature"] {
       background-color: LIMEGREEN;
       background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/Plus.png);
     }
     .issue-icon[type="improvement"],
     .issue-icon[type="verbesserung"] {
       background-color: CORNFLOWERBLUE;
       background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/Arrow.png);
     }
     .issue-icon[type="research"] {
       background-color: MEDIUMTURQUOISE;
       background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/ErlenmeyerFlask.png);
     }
     .issue-icon[type="test"] {
       background-color: ORANGE;
       background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/CrashDummy.png);
     }
     .issue-estimate {
       position: absolute;
       left: 2.5rem;
       top: 0.0rem;
       height: 1.6rem;
       width: 1.6rem;
       border-radius: 50%;
       background-color: WHITESMOKE;
       line-height: 1.4rem;
       font-size: 0.9rem;
       font-weight: bold;
       text-align: center;
     }
     
     .issue-qr-code {
       position: absolute;
       left: 0rem;
       top: 0rem;
       width: 2.2rem;
       height: 2.2rem;
       background-image: url(https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=L|1&chl=blog.qoomon.com);
       background-repeat: no-repeat;
       background-size: cover;
       background-position: center;
     }
     .issue-attachment {
       position: absolute;
       left: 2.5rem;
       top: 0rem;
       width: 2.0rem;
       height: 2.0rem;
       border-radius: 50%;
       background-color: LIGHTSKYBLUE;
       background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/Attachment.png);
       background-repeat: no-repeat;
       background-position: center;
       background-size: 70%;
     }
     .issue-assignee {
       position: absolute;
       top: 0rem;
       right: 0rem;
       width: 2.2rem;
       height: 2.2rem;
       border-radius: 50%;
       background-color: WHITESMOKE;
       //background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/ninja.png);
       background-repeat: no-repeat;
       background-position: center;
       background-size: cover;
       //-webkit-filter: contrast(200%) grayscale(100%);
       //filter: contrast(200%) grayscale(100%);
       text-align: center;
       font-weight: bold;
       font-size: 1.4rem;
       line-height: 1.9rem;
     }
      .issue-reporter {
       position: absolute;
       top: 0rem;
       right: 10rem;
       width: 2.2rem;
       height: 2.2rem;
       border-radius: 50%;
       background-color: WHITESMOKE;
       //background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/ninja.png);
       background-repeat: no-repeat;
       background-position: center;
       background-size: cover;
       //-webkit-filter: contrast(200%) grayscale(100%);
       //filter: contrast(200%) grayscale(100%);
       text-align: center;
       font-weight: bold;
       font-size: 1.4rem;
       line-height: 1.9rem;
     }
     .issue-epic-box {
       position: absolute;
       right: 2.5rem;
       top: 0rem;
       width: auto;
       min-width: 2rem;
       width: auto;
       max-width: calc(100% - 7.5rem);
       height: auto;
       max-height: 2.2rem;
       padding-top: 0.1rem;
       padding-bottom: 0.2rem;
       padding-left: 0.3rem;
       padding-right: 0.3rem;
       text-align: left;
       font-size: 0.5rem;
       line-height: 0.55rem;
     }
     .issue-epic-id {
       font-size: 0.6rem;
       font-weight: bold;
       max-width: 1rem;
     }
     .issue-epic-name {
       font-size: 0.55rem;
       font-weight: bold;
     }
     .issue-labels {
       font-size: 0.6rem;
       font-weight: bold;
       max-width: 10rem;
       position: absolute;
       left: 5rem;
       top: 0rem;
       padding-left: 0.2rem;
       padding-right: 0.2rem;
     }
     .issue-components {
       font-size: 0.6rem;
       font-weight: bold;
       max-width: 10rem;
       position: absolute;
       left: 5rem;
       top: 1rem;
       padding-left: 0.2rem;
       padding-right: 0.2rem;
     }
     .issue-s1 {
       font-size: 0.6rem;
       font-weight: bold;
       max-width: 10rem;
       position: absolute;
       left: 9rem;
       top: 1rem;
       padding-left: 0.2rem;
       padding-right: 0.2rem;
     }
     .issue-s2 {
       font-size: 0.6rem;
       font-weight: bold;
       max-width: 10rem;
       position: absolute;
       left: 9rem;
       top: 2rem;
       padding-left: 0.2rem;
       padding-right: 0.2rem;
     }
     .issue-s3 {
       font-size: 0.6rem;
       font-weight: bold;
       max-width: 10rem;
       position: absolute;
       left: 9rem;
       top: 3rem;
       padding-left: 0.2rem;
       padding-right: 0.2rem;
     }
     .issue-due-date-box {
       position: absolute;
       right: 0rem;
       top: 0rem;
       overflow: visible !important;
     }
     .issue-due-date {
       position: absolute;
       top: 1.3rem;
       right: 1rem;
       width: 5.3rem;
       height: 1.3rem;
       padding-left: 0.2rem;
       padding-right: 1.4rem;
       text-align: center;
       font-weight: bold;
       font-size: 0.7rem;
       line-height: 1.0rem;
     }
     .issue-due-icon {
       position: absolute;
       top: 0.5rem;
       right: 0rem;
       width: 2.5rem;
       height: 2.5rem;
       border-radius: 50%;
       background-color: ORCHID;
       background-image: url(https://rpelaez.github.io/Jira-Issue-Card-Printer/resources/icons/AlarmClock.png);
       background-repeat: no-repeat;
       background-position: center;
       background-size: 65%;
     }
     @media print {
       @page {
         margin: 0.0mm;
         padding: 0.0mm;
       }
       html {
         margin: 0.0mm;
         padding: 0.0mm;
         background-color: WHITE !important;
         -webkit-print-color-adjust: exact !important;
         print-color-adjust: exact !important;
       }
       .card {
         page-break-inside: avoid !important;
         margin: 0.0mm !important;
       }
     }
     */});
    resources.printPreviewHtml = multilineString(function(){/*
     <div id="card-print-overlay">
       <div id="card-print-dialog">
         <div id="card-print-dialog-header">
           <div id="card-print-dialog-title">Issue Card Printer</div>
           <div id="info">
             <label id="info-line"><b></b></label>
             <div id="set-header" class="ui-element button" >Header</div>
             <div id="set-s1" class="ui-element button" >CF.1</div>
             <div id="set-s2" class="ui-element button" >CF.2</div>
             <div id="set-s3" class="ui-element button" >CF.3</div>
             <div id="report-issue" class="ui-element button" >Support</div>
             <div id="about" class="ui-element button" >MrAddon®</div>
             <div id="qoomon" class="ui-element button" >Qoomon©</div>
           </div>
         </div>
         <div id="card-print-dialog-content">
           <iframe id="card-print-dialog-content-iframe"></iframe>
         </div>
         <div id="card-print-dialog-footer">
           <div class="buttons">
             <div class="ui-element" style="float: left;" >
               <input id="columnCount" type="number" min="0" max="9" class="numberInput" style="float: left; width: 18px; padding: 2px;" value="1"/>
               <div style="float: left; margin-left: 5px; margin-right: 5px;">x</div>
               <input id="rowCount" type="number" min="0" max="9" class="numberInput" style="float: left; width: 18px; padding: 2px;" value="2"/>
               <label style="float: left; margin-left:5px;">Grid</label>
             </div>
             <div class="ui-element" style="float: left;">
               <form style="float: left;" oninput="amount.value=parseFloat(scaleRange.value).toFixed(1)">
                 <input id="scaleRange" type="range" min="-1.0" max="1.0" step="0.1" value="0.0" style="float: left; width: 70px; position: relative;
         top: -2px;" />
                 <label>Zoom</label>
                 <output style="float: left; width: 22px; margin-left:2px;" name="amount" for="scaleRange"></output>
               </form>

             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="single-card-page-checkbox" type="checkbox"/>
               <label for="single-card-page-checkbox"></label>
               <label for="single-card-page-checkbox">1xPage</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="description-checkbox" type="checkbox"/>
               <label for="description-checkbox"></label>
               <label for="description-checkbo">Desc</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="reporter-checkbox" type="checkbox"/>
               <label for="reporter-checkbox"></label>
               <label for="reporter-checkbox">Report</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="assignee-checkbox" type="checkbox"/>
               <label for="assignee-checkbox"></label>
               <label for="assignee-checkbox">Assig</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="due-date-checkbox" type="checkbox"/>
               <label for="due-date-checkbox"></label>
               <label for="due-date-checkbox">DueDate</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="estimate-checkbox" type="checkbox"/>
               <label for="estimate-checkbox"></label>
               <label for="estimate-checkbox">Points</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="components-checkbox" type="checkbox"/>
               <label for="components-checkbox"></label>
               <label for="components-checkbox">Component</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="labels-checkbox" type="checkbox"/>
               <label for="labels-checkbox"></label>
               <label for="labels-checkbox">Label</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="qr-code-checkbox" type="checkbox"/>
               <label for="qr-code-checkbox"></label>
               <label for="qr-code-checkbox">QR</label>
             </div>

             <div id="card-print-dialog-print" class="ui-element button button-primary" >Print</div>
           </div>
         </div>
       </div>
     </div>
     */});
    resources.printPreviewCss = multilineString(function(){/*
     * {
       font-family: Arial, sans-serif;
       color: #656565;
     }
     #card-print-overlay {
       position: fixed;
       height: 100%;
       width: 100%;
       top: 0;
       left: 0;
       background: rgba(0, 0, 0, 0.5);
       box-sizing: border-box;
       word-wrap: break-word;
       z-index: 99999;
     }
     #card-print-dialog {
       position: relative;
       top: 60px;
       right: 0px;
       left: 0px;
       height: calc(100% - 120px);
       width: 1000px;
       margin: auto;
       border-style: solid;
       border-color: #cccccc;
       border-width: 1px;
       -webkit-border-radius: 4px;
       border-radius: 4px;
       overflow: hidden;
     }
     #card-print-dialog-header {
       position: relative;
       background: #f0f0f0;
       height: 25px;
       border-bottom: 1px solid #cccccc;
       padding: 10px 15px 15px 15px;
     }
     #card-print-dialog-content {
       position: relative;
       background: white;
       height: calc(100% - 106px);
       width: 100%;
       overflow: hidden;
     }
     #card-print-dialog-content-iframe {
       position: relative;
       height: 100%;
       width: 100%;
       overflow: hidden;
       border: none;
     }
     #card-print-dialog-footer {
       position: relative;
       background: #f0f0f0;
       border-top: 1px solid #cccccc;
       height: 30px;
       padding: 15px 15px 10px 15px;
       text-align: right;
       font-size: 13px;
     }
     #buttons {
       position: relative;
       float: right;
       display: inline-block;
       height 30px;
     }
     #info {
       position: relative;
       float: right;
       display: inline-block;
       height: 30px;
     }
     #info-line {
       font-size: 14px;
       line-height: 29px;
       margin-right: 8.4rem;
     }
     #card-print-dialog-title {
       position: relative;
       float: left;
       color: rgb(51, 51, 51);
       display: block;
       font-size: 20px;
       font-weight: normal;
       height: 30px;
       line-height: 30px;
     }
     .ui-element {
       color: #656565;
       font-size: 12px;
       font-weight: 600;
       display: inline-block;
       margin: 5px 5px;
       vertical-align: baseline;
     }
     .button {
         cursor: pointer;
         background-color: #DEDEDE;
         border: 1px solid #D4D4D4;
         border-radius: 2px;
         display: inline-block;
         font-size: 13px;
         font-weight: 700;
         padding: 0.8px 10px;
         margin: 0px 1px;
         text-decoration: none;
         text-align: center;
     }
     .button-primary{
         background-color: #5689db;
         border: 1px solid #5689db;
         color: #fff;
     }
     label {
       display: block;
       margin-left: 5px;
       float:left;
     }
     label[for] {
       cursor: pointer;
     }
     .checkbox {
       position: relative;
       width: auto;
       height: auto;
     }
     .checkbox  input[type=checkbox]{
       display: none;
     }
     .checkbox input[type=checkbox]  + label {
       margin: 0px;
       position: relative;
       width: 15px;
       height: 15px;
       border-radius: 4px;
       background-color: #DEDEDE;
       border: 1px solid #D4D4D4;
     }
     .checkbox input[type=checkbox] + label::after {
       opacity: 0;
       content: '';
       position: absolute;
       width: 6px;
       height: 3px;
       background: transparent;
       top: 4px;
       left: 4px;
       border: 2px solid #656565;
       border-top: none;
       border-right: none;
       transform: rotate(-45deg);
     }
     .checkbox input[type=checkbox]:checked + label::after {
       opacity: 1;
     }
     input[type=number].numberInput {
         color: #656565;
         position: relative;
         top: -2;
         font-size: 12px;
         font-weight: 700;
         width:1.5em;
         padding:3px;
         margin:0;
         border:1px solid #ddd;
         border-radius:5px;
         text-align: center;
         background-color: #DEDEDE;
         border: 1px solid #D4D4D4;
         width: 100px;
     }
     input[type=number].numberInput::-webkit-inner-spin-button,
     input[type=number].numberInput ::-webkit-outer-spin-button {
        -webkit-appearance: none;
     }
     input[type=number].numberInput:hover{
         border:1px solid #ddd;
         background-color: #f6f6f6;
     }
     input[type=number].numberInput:focus{
         outline:none;
         border:1px solid #ddd;
         background-color: #f6f6f6;
     }
     */});

     return resources;
   }


})();
