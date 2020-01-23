/**
 * Spot.js
 *
 *  Spot.js is a web tracker tag
 *
 *  Spot observes window.spot_data array
 *
 */

//
// Implementation
//
function SpotJs () {

  let config = {
    apiContentType: 'application/json',
    apiHost: 'https://growingtree.demostellar.com',
    apiEndpoint: '/edp/api/event',
    apiAuthorization: 'Bearer 7ed9828b0021035c22f1b142db14704bc4eb95b11f93d973bd9c9b698cf736e4:3e1824ff3ec2d7e2e20c13fa00d60d4dbc4a965d5fd48a1f4887338759c1d8e7:6d228e44e479cca02776f2d8b5a0f191e09a0e0fe7bdfa84b7a43152820d9403',
    cookiePrefix: 'spot_',
    dtCookieName: 'spot_dt',
    utCookieName: 'spot_ut',
    dtIdField: 'integration_id', // TODO - use device_id or visitor_id? Also update GTM template.
    utIdField: 'integration_id', // TODO
    cookieMaxAge: 60*60*24*365,
    useNavigatorBeacon: false,
    dataLayerId: 'spot_data',
    defaultCampaign: { "ext_parent_id": "1", "camp_id": "1" },
    debug: 1
  };


  let user = { dt: null, ut: null, known: null, visitor: null, optIn: null, optOut: null, update_attributes: {} };

  let spotjs = {
    name: "spotjs 0.0.5 "+Math.random().toString(36).substring(7),
    config: config,
    user: user,
    dataLayer: null,
    sent: []
  };

  // log wrapper
  let log = spotjs.log = config.debug ? console.log.bind(window.console) : function(){};

  // Init Data Layer
  let initDataLayer = function () {
    if (!spotjs.dataLayer) {
      spotjs.dataLayer = window[config.dataLayerId] = window[config.dataLayerId] || [];
      spotjs.dataLayer.push = function(e) {
        Array.prototype.push.call(spotjs.dataLayer, e);
        processDataLayer();
      };
      processDataLayer();
    }
  }

  // Helper function to push an event to the data layer
  let track = function (eventType, params) {
    spot.dataLayer.push({ "type": eventType, "params": params });
  }

  // Helper function to push user info to the data layer
  let identify = function (user2) {
    if (typeof user2 === "object") {
      Object.assign(user, user2);
    }
    spot.dataLayer.push({ "type": "identify", "params": user2 });
  }

  let optIn = function () {
    user.optIn = true;
    user.optOut = false;
    if (user.dt === "OPTOUT") {
      setCookie(config.dtCookieName, "", config);
    }
    if (user.ut === "OPTOUT") {
      setCookie(config.utCookieName, "", config);
    }
  }
  
  let optOut = function () {
    user.optIn = false;
    user.optOut = true;
    setCookie(config.dtCookieName, "OPTOUT", config);
    setCookie(config.utCookieName, "OPTOUT", config);
  }

  let processDataLayer = function () {
    log("spotjs.processDataLayer dataLayer =", JSON.stringify(spotjs.dataLayer))
    if (spotjs.dataLayer) {
      while (spotjs.dataLayer.length) {
        let data = spotjs.dataLayer.shift();
        if (typeof data !== "object") {
          log("spotjs.processDataLayer skipping non-object item", data)
          return;
        }
        if (data) {
          if (data.config && typeof data.config === "object") {
            applyConfig(data.config);
          }
          if (data.type) {
            processEvent(data);
          }
        }
      }
    }
  }

  // Allow the tag to provide config, such as API details.
  let applyConfig = function (config2) {
    if (typeof config2 === "object") {
      log("spotjs.applyConfig config2 =", JSON.stringify(config2));
      Object.assign(config, config2);
      config.dtCookieName = config.cookiePrefix+'dt';
      config.utCookieName = config.cookiePrefix+'ut';
      log("spotjs.applyConfig config =", config);
    }
  }

  // Process a business event, such as a page visit, add to cart, etc.
  let processEvent = function (data) {
    log("spotjs.processEvent data =", data);
    if (!data.type) {
      log("spotjs.processEvent error - data.type is required");
    }
    processUser(data);
    if (!data.iso_time) {
      let dateobj = new Date();
      data.iso_time = dateobj.toISOString();
    }
    var evt = {
      "event": { "type": data.type, "iso_time": data.iso_time },
      "client": { "identifier": { "id": "", "id_field": "" } },
      "campaign": data.campaign || config.defaultCampaign
    };
    evt.client.identifier.id = user.known ? user.ut : user.dt;
    evt.client.identifier.id_field = user.known ? config.dtIdfield : config.utIdField;
    if (Object.keys(data.params).length) {
      evt.event.params_json = data.params;
    }
    data.update_attributes = data.update_attributes || {};
    Object.apply(data.update_attributes, user.update_attributes);
    if (data.update_attributes.visitor === undefined && user.visitor !== null) {
      data.update_attributes.visitor = user.visitor;
    }
    if (Object.keys(data.update_attributes).length) {
      evt.callback = { "update_attributes": data.update_attributes };
    }
    log("spotjs.processEvent evt =", evt);
    sendEvent(evt);
  }

  let sendEvent = function (evt) {
    let evtId = spotjs.sent.length+1;
    let data = JSON.stringify(evt);
    log("spotjs.sendEvent evt =", evt);
    spotjs.sent[evtId] = { "status": "sent", "evt": evt };
    if (config.useNavigatorBeacon && navigator.sendBeacon) {
      let blob = new Blob(data, { "type": "application/json" });
      navigator.sendBeacon(config.apiHost + config.apiEndpoint, blob);
      spotjs.sent[evtId].status = "done";
    }
    else {
      let xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      xhr.addEventListener("readystatechange", function() {
        if(this.readyState === 4) {
          //log(this.responseText, this);
        }
      });
      xhr.open("POST", config.apiHost+config.apiEndpoint, true);
      xhr.setRequestHeader("Content-Type", config.apiContentType);
      xhr.setRequestHeader("Authorization", config.apiAuthorization);
      // TODO - update sent status in async callbacks
      //spotjs.sent[evtId].status = "done";
      xhr.send(data);
    }
  }

  let processUser = function (data) {
    getTokenCookie("dt", true, data);
    getTokenCookie("ut", false, data);
    if (user.ut) { // known
      user.known = true;
      user.visitor = null;
      if (user.ut === "OPTOUT") {
        user.optOut = true;
      }
    }
    else { // anonymous
      user.known = false;
      user.visitor = true;
      if (user.dt === "OPTOUT") {
        user.optOut = true;
      }
    }
  }


  // Utils
  let getTokenCookie = function (token, generate, data) {
    let cookieName = config[token+'CookieName'], 
        cookieVal = getCookie(cookieName);
    if (!user[token]) {
      if (typeof data === "object" && data[token]) {
        user[token] = data[token];
      }
      else if (cookieVal) {
        user[token] = cookieVal;
      }
      if (!user[token] && generate) {
        // generate token
        user[token] = uuidv4();
      }
    }
    if (user[token] !== cookieVal) {
      setCookie(cookieName, user[token], config);
    }
  }

  let getCookie = function (name) {
    var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return v ? v[2] : null;
  }

  let setCookie = function (name, value, options) {
    let c = name+'='+value;
    c += '; SameSite=None';
    c += '; Secure=true';
    c += '; Max-Age='+config.cookieMaxAge;
    c += "; Path=/";
    document.cookie = c;
    log("spotjs.setCookie c=", c);
  }

  let uuidv4 = function () {
   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Interface methods
  spotjs.applyConfig = applyConfig;
  spotjs.identify = identify;
  spotjs.track = track;

  // Run init methods and return spotjs object
  initDataLayer();

  log(spotjs.name, "created");
  return spotjs;
}

if (!window.spotjs) {
  window.spotjs = SpotJs();
}
