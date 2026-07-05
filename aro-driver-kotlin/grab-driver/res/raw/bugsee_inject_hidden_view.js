//
//  injectHiddenView.h
//  Bugsee
//
//  Created by ANDREY KOVALEV on 25.08.16.
//  Copyright © 2016 Bugsee. All rights reserved.
//
// Note: all comments must start from the line beginning.

(function() {
    var element = window.Element;
    if (element) {
        var proto = element.prototype;
        var originalAttach = proto.attachShadow;
        if (originalAttach) {
            var newAttach = function attachShadow() {
                var shadowRoot = originalAttach.apply(this, arguments);
                this.__bgs_shadowRoot = shadowRoot;
                return shadowRoot;
            };
            element.prototype.attachShadow = newAttach;
        }
    }
})();

var querySelectorAllDeep = (function() {
    "use strict";

    function querySelectorAllDeepInternal(container, selector) {
        return _querySelectorDeep(container, selector, true);
    }

    function _querySelectorDeep(container, selector, findMany) {
        var lightElement = container.querySelector(selector);

        if (document.head.createShadowRoot || document.head.attachShadow) {
// no need to do any special if selector matches something specific in light-dom
            if (!findMany && lightElement) {
                return lightElement;
            }
// do best to support complex selectors and split the query
            var splitSelector = selector.replace(/\s*([,>+~]+)\s*/g, "$1").split(" ");
            var possibleElementsIndex = splitSelector.length - 1;
            var possibleElements = collectAllElementsDeep(container, splitSelector[possibleElementsIndex]);
            var findElements = findMatchingElement(
                splitSelector,
                possibleElementsIndex
            );
            if (findMany) {
                return possibleElements.filter(findElements);
            } else {
                return possibleElements.find(findElements);
            }
        } else {
            if (!findMany) {
                return lightElement;
            } else {
                return container.querySelectorAll(selector);
            }
        }
    }

    function findMatchingElement(splitSelector, possibleElementsIndex) {
        return function (element) {
            var position = possibleElementsIndex;
            var parent = element;
            var foundElement = false;
            while (parent) {
                var foundMatch = parent.matches(splitSelector[position]);
                if (foundMatch && position === 0) {
                    foundElement = true;
                    break;
                }
                if (foundMatch) {
                    position--;
                }
                parent = findParentOrHost(parent);
            }
            return foundElement;
        };
    }

    function findParentOrHost(element) {
        var parentNode = element.parentNode;
        return parentNode && parentNode.host ?
            parentNode.host :
            parentNode === document ?
            null :
            parentNode;
    }

    function collectAllElementsDeep(container, selector) {
        var allElements = [];
        var findAllElements = function findAllElements(nodes) {
            for (var i = 0, el;
                (el = nodes[i]); ++i) {
                allElements.push(el);
// If the element has a shadow root, dig deeper.
                var shadowRoot = el.shadowRoot || el.__bgs_shadowRoot;
                if (shadowRoot) {
                    findAllElements(shadowRoot.querySelectorAll("*"));
                }
            }
        };

        findAllElements(container.querySelectorAll("*"));

        return selector ? allElements.filter(function(el) {
                return el.matches(selector);
            }) : allElements;
    }

    return querySelectorAllDeepInternal;
})();

if (!window.bugsee) {
    window.bugsee = new BugseeInternal();
}

// find all bugsee-hide elements
function BugseeInternal() {
    this.iframeInputTexts = [];
    this.inputTexts = [];
    this.lastJson = "";
}

// find elements input[type = password] with no bugsee-show class
function findAllInputSecureTexts(element) {
    var inputFields = Array.prototype.slice.call(querySelectorAllDeep(element, "input[type=password]:not(.bugsee-hide), input[autocomplete*=\"cc-\"]:not(.bugsee-hide)"));

// Set bugsee-hide class to all inputs of password type in order to keep them hidden if password field will become visible to user (show password GUI option).
    for (var ind = 0; ind < inputFields.length; ++ind) {
        inputFields[ind].className += " bugsee-hide";
    }

    inputFields = Array.prototype.slice.call(querySelectorAllDeep(element, "input.bugsee-hide, textarea.bugsee-hide, select.bugsee-hide, input[autocomplete*=\"cc-\"]"));

    var hiddenInputs = [];
    for (var ind = 0; ind < inputFields.length; ++ind) {
        var input = inputFields[ind];

        if (!hasClass(input, "bugsee-show")) {
            hiddenInputs.push(input);
        }
    }
    return hiddenInputs;
};

//events about focus or unfocus inputs, to hide keyboard and touches.
function focusField(e) {
    var message = e.type;

    if (message == "click") {
        message = "focus";
    }

    if (window.Cordova && window.Cordova.exec) {
        var params = [message];
        window.Cordova.exec(function() {}, function() {}, "Bugsee", "internal_onFocusChanged", params);
    } else if (window.BugseeJsListener) {
        window.BugseeJsListener.onFocusChanged(message);
    } else if (bugseeIsDebug) {
        console.log("No way to interact with native code.");
    }
};

function removeFocusTextListeners(array) {
// remove listeners for onfocus/onblur events
    for (i = 0; i < array.length; ++i) {
        var element = array[i];
        element.removeEventListener("focus", focusField, true);
        element.removeEventListener("click", focusField, true);
        element.removeEventListener("blur", focusField, true);
    }
};

function addFocusTextListeners(array) {
// add listeners for onfocus/onblur events
    for (i = 0; i < array.length; ++i) {
        var element = array[i];
        element.addEventListener("focus", focusField, true);
        element.addEventListener("click", focusField, true);
        element.addEventListener("blur", focusField, true);
    }
};

function getPositionWithinViewport(element, isInFrame) {
    var rect = element.getBoundingClientRect();

    var top = rect.top + (isInFrame ? 0 : window.scrollY);
    var left = rect.left + (isInFrame ? 0 : window.scrollX);
    var width = rect.width;
    var height = rect.height;

    /*var layeredParent = getLayeredParentElement(element);
    if (layeredParent) {
        var lrRect = layeredParent.getBoundingClientRect();
        top -= lrRect.top;
        left -= lrRect.left;
    }*/

    return {
        top: top,
        left: left,
        width: width,
        height: height
    };
}

/**
 * Gets bounding rectangle for the specified element
 */
function getRectForElement(element) {
    var rect = getPositionWithinViewport(element);

    var rectDict = {
        left: Math.floor(rect.left),
        top: Math.floor(rect.top),
        right: Math.ceil(rect.left + rect.width),
        bottom: Math.ceil(rect.top + rect.height)
    };

    return rectDict;
};

/**
 * Gets bounding rectangle for the specified element
 * within an IFrame
 */
function getRectForIFrame(iframe, element) {
    var rect = getPositionWithinViewport(element, true);
    var ifRect = getPositionWithinViewport(iframe);

    var left = rect.left + ifRect.left;
    var top = rect.top + ifRect.top;
    var width = rect.width;
    var height = rect.height;

    var rectDict = {
        left: Math.floor(left),
        top: Math.floor(top),
        right: Math.ceil(left + width),
        bottom: Math.ceil(top + height)
    };

    return rectDict;
};

/**
 * Determines whether element has the provided CSS class
 */
function hasClass(element, cssClass) {
    if (element.classList) {
        return element.classList.contains(cssClass);
    }

    return (element.className || "").indexOf(cssClass) >= 0;
};

function justUpdateInputs() {
    window.bugsee.updateCurrentHiddenViews();
}

function trackLoadingNestedIFrame(iframe) {
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    var wnd = iframe.contentWindow;

    doc.addEventListener("DOMContentLoaded", justUpdateInputs, true);
    wnd.addEventListener("load", justUpdateInputs, true);
}

function updateIFrameHiddenViewsInternal(elements) {
    if (bugsee.iframeInputTexts.length > 0) {
        removeFocusTextListeners(bugsee.iframeInputTexts);
    }

    bugsee.iframeInputTexts = [];
    var iframes = document.getElementsByTagName("iframe");

    for (var ind = 0; ind < iframes.length; ++ind) {
        var iframe = iframes[ind];

        var content = null;

        try {
            content = iframe.contentDocument || iframe.contentWindow.document;
        } catch (e) {
            continue;
        }

        if (!content) {
            continue;
        }

        if (content.readyState === 'loading') {
            try {
                trackLoadingNestedIFrame(iframe);
            } catch (e) {}
            continue;
        }

        var inputs = findAllInputSecureTexts(content);
        var activeElement = iframe.activeElement;

        for (var i = 0; i < inputs.length; i++) {
            var text = inputs[i];
            var rect = getRectForIFrame(iframe, text);

            bugsee.iframeInputTexts.push(text);

            elements.push({
                type: "text",
                rect: rect
            });

            if (text === activeElement) {
                focusField({
                    "type": "focus"
                });
            }
        }

        var hiddenElements = querySelectorAllDeep(iframe, ".bugsee-hide");
        for (var i = 0; i < hiddenElements.length; i++) {
            var currentElement = hiddenElements[i];
            var rect = getRectForIFrame(iframe, currentElement);
            if (currentElement.tagName.toLowerCase() != "input") {
                elements.push({
                    type: "hiddenElement",
                    rect: rect
                });
            }
        }
    }

    if (bugsee.iframeInputTexts.length > 0) {
        addFocusTextListeners(bugsee.iframeInputTexts);
    }
};

function updateHiddenViewsInternal(elements) {
    if (bugsee.inputTexts.length > 0)
        removeFocusTextListeners(bugsee.inputTexts);

    bugsee.inputTexts = findAllInputSecureTexts(document);
    addFocusTextListeners(bugsee.inputTexts);

    var activeElement = document.activeElement;
// grab input texts rects
    for (var ind = 0; ind < bugsee.inputTexts.length; ++ind) {
        var text = bugsee.inputTexts[ind];
        var rect = getRectForElement(text);

        elements.push({
            type: "text",
            rect: rect
        });
// send focus second time to be sure that we don't lost this
// event between remove and add focus text listeners
        if (text === activeElement) {
            focusField({
                "type": "focus"
            });
        }
    }

    var hiddenElements = querySelectorAllDeep(document, ".bugsee-hide");
    for (var ind = 0; ind < hiddenElements.length; ind++) {
        var element = hiddenElements[ind];
        var rect = getRectForElement(element);

        if (element.tagName.toLowerCase() != "input") {
            elements.push({
                type: "hiddenElement",
                rect: rect
            });
        }
    }
}

//Get hidden view rects on window load
BugseeInternal.prototype.updateCurrentHiddenViews = function() {
    var elements = [];
    updateHiddenViewsInternal(elements);
    updateIFrameHiddenViewsInternal(elements);

    var json = JSON.stringify(elements);

// back to java
    this.lastJson = json;

    if (window.Cordova && window.Cordova.exec) {
        var params = [this.lastJson];
        window.Cordova.exec(function() {}, function() {}, "Bugsee", "internal_onViewsUpdated", params);
    } else if (window.BugseeJsListener) {
        window.BugseeJsListener.onViewsUpdated(this.lastJson);
    } else if (bugseeIsDebug) {
        console.log("No way to interact with native code.");
    }
    return elements;
};


var mutationTimeoutID;
var fastMutationsCount = 0;
var lastMutationTimestamp = 0;

function clearScheduledMutationTracking() {
    if (mutationTimeoutID) {
        clearTimeout(mutationTimeoutID);
        mutationTimeoutID = null;
    }
}

function mutationCallback() {
    clearScheduledMutationTracking();
    window.bugsee.updateCurrentHiddenViews();
};


function createDomObserver() {
    return new MutationObserver(function(mutations) {
        var nowMs = Date.now();
        if (nowMs - lastMutationTimestamp < 150) {
            fastMutationsCount++;
        } else {
            fastMutationsCount = 0;
        }
        lastMutationTimestamp = nowMs;

        if (fastMutationsCount >= 2) {
            if (!mutationTimeoutID) {
                mutationTimeoutID = setTimeout(mutationCallback, 200);
            }
        } else {
            mutationCallback();
        }
    });
}

function initInterception() {
    var supportsOrientationChange = "onorientationchange" in window;
    var orientationEvent = supportsOrientationChange ? "orientationchange" : "resize";

    window.addEventListener(orientationEvent, function() {
        setTimeout(mutationCallback, 100);
    }, false);
}

function startInterception() {
    window.bugsee.updateCurrentHiddenViews();

    var observer = createDomObserver();
    var target = document.body;
    var config = {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
    };

    observer.observe(target, config);
}


if (!window.bugseeIsExist) {
    initInterception();

    if (document.readyState !== "loading") {
        startInterception();
    } else {
        document.addEventListener("DOMContentLoaded", startInterception, true);
    }

    window.addEventListener("load", justUpdateInputs, true);
}