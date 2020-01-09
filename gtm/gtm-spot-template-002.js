/**
 *  Spot Sandbox
 *  This is a sandbox-based version of Spot.js.
 *  This is the body of a function with a single parameter, data, i.e.
 *    function spot(data) { ... }
 */
let spot = {};
const log = require('logToConsole');
log('spot 0.0.1');
log('data =', data);

//
// Require
//
const queryPermission = require('queryPermission');

const getCookieValues = require('getCookieValues');
const setCookie = require('setCookie');

const copyFromWindow = require('copyFromWindow');
const getReferrerUrl = require('getReferrerUrl');
const getUrl = require('getUrl');

const encodeUriComponent = require('encodeUriComponent');
const encodeUri = require('encodeUri');

const sendPixel = require('sendPixel');

// 
// Cookies
//

spot.getCookie = function(cookieName) {
  let cookieValues = null;
  if (queryPermission('get_cookies', cookieName)) {
    cookieValues = getCookieValues(cookieName);
    log('cookieValues =', cookieValues);
  }
  return cookieValues;
};

spot.setCookie = function(cookieName, cookieValue, options) {
  if (queryPermission('set_cookies', cookieName, options)) {
    setCookie(cookieName, cookieValue, options);
  }
};


// Cookie tests
spot.getCookie('spot_dt');
spot.setCookie({
  'domain': 'tagmanager.google.com',
  'path': '/',
  'max-age': 60*60*24*365,
  'secure': true
});

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
spot.getReferrer();

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
spot.getURL();



// let loc = copyFromWindow('location');
// log('loc =', loc);
//let url = encodeUri(data.url);
//log('url =', url);

//const createQueue = require('createQueue');
//if (queryPermission('access_globals', 'readwrite', 'dataLayer')) {
//  const dataLayerPush = createQueue('dataLayer');
//}


 
//
// Beacon
//
/*
if (data.useCacheBuster) {
  const encode = require('encodeUriComponent');
  const cacheBusterQueryParam = data.cacheBusterQueryParam || 'gtmcb';
  const last = url.charAt(url.length - 1);
  let delimiter = '&';
  if (url.indexOf('?') < 0) {
    delimiter = '?';
  } else if (last == '?' || last == '&') {
    delimiter = '';
  }
  url += delimiter +
      encodeUriComponent(cacheBusterQueryParam) + '=' + encodeUriComponent(data.randomNumber);
}
sendPixel(url, data.gtmOnSuccess, data.gtmOnFailure);
*/

// Call data.gtmOnSuccess when the tag is finished.
data.gtmOnSuccess();
