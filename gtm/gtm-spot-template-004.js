/**
 *  Spot Sandbox Template
 *  This is a sandbox-based version of Spot.js.
 *  This is the body of a function with a single parameter, data, i.e.
 *    function spot(data) { ... }
 */
let spot = { dt: null, ut: null };

const log = require('logToConsole');
log('spot template 0.0.4');
log('data =', data);


//
// Require
//
const queryPermission = require('queryPermission');

const addEventCallback = require('addEventCallback');

const generateRandom = require('generateRandom');

const getCookieValues = require('getCookieValues');
const setCookie = require('setCookie');

const getReferrerUrl = require('getReferrerUrl');
const getUrl = require('getUrl');

//const copyFromWindow = require('copyFromWindow');
const encodeUriComponent = require('encodeUriComponent');
//const encodeUri = require('encodeUri');
const createQueue = require('createQueue');
const copyFromWindow = require('copyFromWindow');
const sendPixel = require('sendPixel');

//
// Data Layer
//
let spotData = [];
  if (queryPermission('access_globals', 'readwrite', 'spotData')) {
  spot.dataLayerPush = createQueue('spotData');
  spot.dataLayerPush({ "data": data });
  spotData = copyFromWindow('spotData');
  //log ("spotData =", spotData);
}
//
// Inject Script
//
if (data.scriptUrl) {
  const injectScript = require('injectScript');
  if (queryPermission('inject_script', data.scriptUrl)) {
    if (spotData.length === 1) {
      injectScript(data.scriptUrl);
    }
  }
}

//
// Page Referer
//
spot.getReferrer = function(paramName) {
  let paramValue;
  if (queryPermission('get_referrer', paramName)) {
    paramValue = getReferrerUrl(paramName);
    log('referrer', paramName, '=', paramValue);
  }
  return paramValue;
};
//spot.getReferrer();

//
// Page Location
//
spot.getURL = function(paramName) {
  let paramValue;
  if (queryPermission('get_url', paramName)) {
    paramValue = getUrl(paramName);
    log('url', paramName, '=', paramValue);
  }
  return paramValue;
};
//spot.getURL();

// 
// Cookies
//
spot.getCookie = function(cookieName) {
  let cookieValues = null,
      cookieValue = null;
  if (queryPermission('get_cookies', cookieName)) {
    cookieValues = getCookieValues(cookieName);
    log('getCookie', cookieName, '=', cookieValues);
    if (cookieValues && cookieValues[0]) {
      cookieValue = cookieValues[0];
      log('getCookie', cookieName, '=', cookieValue);
    }
  }
  return cookieValue;
};

spot.setCookie = function(cookieName, cookieValue, options) {
  if (queryPermission('set_cookies', cookieName, options)) {
    setCookie(cookieName, cookieValue, options);
    log('setCookie', cookieName, '=', cookieValue);
  }
};

spot.generateToken = function (prefix) {
  return (prefix||'')+generateRandom(10000000000, 1000000000000);
};


// Cookie tests
spot.dt = spot.getCookie(data.cookiePrefix+'dt');
if (!spot.dt) {
  spot.dt = spot.generateToken('dt');
  log('generating token', spot.dt, ' for host =', spot.getURL('host'));
  spot.setCookie(data.cookiePrefix+'dt', spot.dt, {
    'domain': data.cookieDomain || spot.getURL('host'),
    'path': '/',
    'max-age': 60*60*24*365,
    'secure': true
  });
}
 
//
// Call Event API
//
spot.callEventsApi = function (apiEndpoint, apiParams, opts) {
  let url = data.apiHost+apiEndpoint;
  const last = url.charAt(url.length - 1);
  let delimiter = '&';
  if (url.indexOf('?') < 0) {
    delimiter = '?';
  } else if (last == '?' || last == '&') {
    delimiter = '';
  }

  apiParams = apiParams || {};
  for (const p in apiParams) {
    if (p && apiParams[p]) {
      url += delimiter+encodeUriComponent(p)+'='+encodeUriComponent(apiParams[p]);
      delimiter = '&';
    }
  }

  opts = opts || {};
  opts.onSuccess = opts.onSuccess || data.gtmOnSuccess;
  opts.onFailure = opts.onFailure || data.gtmOnFailure;

  log("spot.callEventsApi", url);
  sendPixel(url, opts.onSuccess, opts.onFailure);
};

//
// Submit Event
//
let apiParams = { "dt": spot.dt, "ut": spot.ut, "eventType": data.eventType };
if (data.eventParams) {
  data.eventParams.forEach(function(p) {
    if (p.key && p.value) {
      apiParams[p.key] = p.value;
    }
  });
}
spot.callEventsApi("/spot", apiParams);

// Call data.gtmOnSuccess when the tag is finished.
data.gtmOnSuccess();
