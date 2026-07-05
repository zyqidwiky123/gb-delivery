//
//  injectAJAX.h
//  Bugsee
//
//  Created by ANDREY KOVALEV on 25.08.16.
//  Copyright © 2016 Bugsee. All rights reserved.
//

// XMLHttpRequest monkey-patch
// Note: all comments must start from the line beginning.
(function(xhr) {

    if (xhr._bgs_send_saved) {
//already installed
        return;
    }

    var urlRegExp = new RegExp('^(?:[a-z]+:)?\/\/', 'i');

    function guid() {
        function s4() {
                return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }

    function originalXMLHTTPRequestFromContext(context)
    {
         var obj = context;

//Zone.js
         if (context.__zone_symbol__originalInstance){
             if (bugseeIsDebug) console.log("zone js");
             obj = context.__zone_symbol__originalInstance;
         }

         return obj;
    }

    function sendEventToBugsee(type,uuid, method, url, requestHeaders, responseHeaders, requestData, responseData, status, statusText, error, isLargeResponse=false)
    {
        var eventDict = {"uuid":uuid, "type":type};

        if (statusText) eventDict.statusText = statusText;
        if (status) eventDict.status = status;
        if (method) eventDict.method = method;

        if (error) eventDict.error = error;

        if (url) eventDict.url = url;

        if (requestHeaders) eventDict.requestHeaders = requestHeaders;
        if (responseHeaders) eventDict.responseHeaders = responseHeaders;

        if (requestData) {
// approximate length
            var length = requestData.length*2;
             if (length > MAX_BODY_DATA_LENGTH){
                 eventDict.isLargeRequest = true;
             }else{
                eventDict.requestData = requestData;
             }
        }

         if (responseData)
         {
             var length = responseData.length*2;
             if (length > MAX_BODY_DATA_LENGTH || isLargeResponse){
                eventDict.isLargeResponse = true;
             }else{
                eventDict.responseData = responseData;
             }
         }

// send event as dictionary.
        var message = JSON.stringify(eventDict);
        if (window.Cordova && window.Cordova.exec) {
            var params = [message];
            window.Cordova.exec(function(){}, function(){}, "Bugsee", "internal_onAjaxNetworkEvent", params);
        } else if (window.BugseeNetworkJsListener) {
            BugseeNetworkJsListener.onAjaxNetworkEvent(message);
        } else if (bugseeIsDebug) {
            console.log("No way to interact with native code.");
        }
    }

     var reqHeaders = xhr.setRequestHeader;
     xhr.setRequestHeader = function(header, value){
         var originalContext = originalXMLHTTPRequestFromContext(this);
         if(!originalContext.xhrheaders){originalContext.xhrheaders = new Map();}
         originalContext.xhrheaders.set(header, value);
         return reqHeaders.apply(this, arguments);
     };

    var open = xhr.open;
    xhr.open = function(method, url, async) {
        var originalContext = originalXMLHTTPRequestFromContext(this);
        originalContext._bgs_method = method;
        if (!urlRegExp.test(url)){
            originalContext._bgs_url = (window.location.origin + url);
        } else{
            originalContext._bgs_url = url;
        }
        open.apply(this, arguments);
    };

    var send = xhr.send;
    xhr.send = function(data) {
        var currentContext = this;
        var originalContext = originalXMLHTTPRequestFromContext(this);
        var uuid = guid();
        var method = originalContext._bgs_method;
        var url = originalContext._bgs_url;
        sendEventToBugsee("req",uuid,method,url,currentContext.xhrheaders,"",data,"","","","");

        function sendCompleteMSG(responseType,response, reqHeaders, respHeaders, status, statusText, error){

            handleResponse(response,responseType,function(txt, isLargeResponse=false){
                var type = "resp";
                var reqData = "";
                var headers = "";

                sendEventToBugsee(type,uuid,method,url,headers,respHeaders,reqData,txt,status,statusText,error, isLargeResponse);
            });
        }

        function handleResponse(response,type,callback) {
            if (!response) {
                return callback(null);
            }

            if (type === "text" || !type) {
                return callback(response);
            }

            if (type === "json") {
                return callback(JSON.stringify(response));
            }

            if (type === "document") {
                var oSerializer = new XMLSerializer();
                return callback(oSerializer.serializeToString(response));
            }

            if (type === "blob") {
                if (/text/.test(response.type) || /json/.test(response.type)) {
                    if (response.size > MAX_BODY_DATA_LENGTH)
                    {
                        return callback("Blob { size: " + response.size + ", type: " + response.type + " }" + "(Blob is too large)", true);
                    }

                    var reader = new FileReader();
                    reader.addEventListener('loadend', function(e) {
                        callback(e.srcElement.result);
                    });

                    reader.readAsText(response);
                } else {
                    return callback("Blob { size: " + response.size + ", type: " + response.type + " }");
                }
            }

            if (type === "arraybuffer") {

                if (response.byteLength > MAX_BODY_DATA_LENGTH)
                {
                    return callback("ArrayBuffer{ byteLength: " + response.byteLength + " }" + "(ArrayBuffer is too large)", true);
                }

                var result = arrayBufferToString(response);
                if (result === null) {
                    result = "ArrayBuffer{ byteLength: " + response.byteLength + " }";
                }

                callback(result);
            }
        }

        function arrayBufferToString(buffer){
            var byteArray = new Uint8Array(buffer);
            var str = "", cc = 0, numBytes = 0;
            for (var i=0, len = byteArray.length; i<len; ++i){
                var v = byteArray[i];
                if (numBytes > 0){
//2 bit determining that this is a tailing byte + 6 bit of payload
                    if ((cc&192) === 192){
//processing tailing-bytes
                        cc = (cc << 6) | (v & 63);
                    } else {
                        return null;
                    }
                } else if (v < 128){
//single-byte
                    numBytes = 1;
                    cc = v;
                } else if (v < 192){
//these are tailing-bytes
                    return null;
                } else if (v < 224){
//3 bits of header + 5bits of payload
                    numBytes = 2;
                    cc = v & 31;
                } else if (v < 240){
//4 bits of header + 4bit of payload
                    numBytes = 3;
                    cc = v & 15;
                } else {
                    return null;
                }
                if (--numBytes === 0){
                    str += String.fromCharCode(cc);
                }
            }

            if (numBytes){
                return null;
            }

            return str;
        }

        if (!currentContext.onreadystatechange || !currentContext.onreadystatechange._bgs_was_wrapped){
            currentContext._bgs_rsc_saved = currentContext.onreadystatechange;
            currentContext.onreadystatechange = function() {
                if(this.readyState == 4){
                    sendCompleteMSG(this.responseType, this.response, this.xhrheaders, this.getAllResponseHeaders(), this.status, this.statusText, "");
                }

                currentContext._bgs_rsc_saved && currentContext._bgs_rsc_saved.apply(currentContext, arguments);
            };

            currentContext.onreadystatechange._bgs_was_wrapped = true;
        }

            if (!currentContext.onload || !currentContext.onload._bgs_was_wrapped){
                currentContext._bgs_load_saved = currentContext.onload;
                currentContext.onload = function() {
                    sendCompleteMSG(this.responseType, this.response, this.xhrheaders, this.getAllResponseHeaders(), this.status, this.statusText, "");

                    currentContext._bgs_load_saved && currentContext._bgs_load_saved.apply(currentContext, arguments);
                };

                currentContext.onload._bgs_was_wrapped = true;
            }

        if (!currentContext.onerror || !currentContext.onerror._bgs_was_wrapped){
            currentContext._bgs_onerr_saved = currentContext.onerror;
            currentContext.onerror = function(err) {
                sendCompleteMSG(this.responseType, this.response, this.xhrheaders, this.getAllResponseHeaders(), this.status, this.statusText, err.message);
                currentContext._bgs_onerr_saved && currentContext._bgs_onerr_saved.apply(currentContext, arguments);
            };

            currentContext.onerror._bgs_was_wrapped = true;
        }

        if (!currentContext.ontimeout || !currentContext.ontimeout._bgs_was_wrapped){
            currentContext._bgs_ontimeout_saved = currentContext.ontimeout;
            currentContext.ontimeout = function(err) {
                sendCompleteMSG(this.responseType, this.response, this.xhrheaders, this.getAllResponseHeaders(), this.status, this.statusText, err.message);
                currentContext._bgs_ontimeout_saved && currentContext._bgs_ontimeout_saved.apply(currentContext, arguments);
            };

            currentContext.ontimeout._bgs_was_wrapped = true;
        }

        if (!currentContext.onabort || !currentContext.onabort._bgs_was_wrapped){
            currentContext._bgs_onabort_saved = currentContext.onabort;
            currentContext.onabort = function(err) {
                sendCompleteMSG(this.responseType, this.response, this.xhrheaders, this.getAllResponseHeaders(), this.status, this.statusText, err.message);
                currentContext._bgs_onabort_saved && currentContext._bgs_onabort_saved.apply(currentContext, arguments);
            };

            currentContext.onabort._bgs_was_wrapped = true;
        }

        send.apply(this, arguments);
    };

    xhr._bgs_send_saved = 1;
 
})(XMLHttpRequest.prototype);
