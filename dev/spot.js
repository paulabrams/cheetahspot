/**
 * "Spot" CD Tag
 * Copyright (c) 2020 Cheetah Digital, inc.
 */

function SpotJs () {
  let version = "0.1.6";

  //@orivate tag config
  let config = {
    apiAuth: null,
    apiHost: null,
    apiEndpoint: '/edp/api/event',
    apiContentType: 'application/json',
    defaultCampaign: { "camp_id": "0", "ext_parent_id": "0" },
    eventType: 'tag',
    eventSubtype: 'tag',
    eventSource: "cdtag",
    dta: 'device_token',
    uta: 'user_token',
    sta: 'session_token',
    dataLayerId: 'spot_data',
    cookiePrefix: 'spot_',
    sessionLength: 60*30, // default 30 min
    cookieMaxAge: 60*60*24*60, // default 2 months
    logLevel: 2, // 0:none, 1:error, 2:info, 3:trace
    tagParams: {
      'spot_user': 'spot_user',
      'spot_ut': 'spot_ut',
      'spot_uta': 'spot_uta',
      'spot_camp_id': 'spot_camp_id' },
    eventParamKeys: { 'sub_type': 'sub_type' }
  };

  // Spot Config can be overridden with a javascript variable on the page.
  if (window.spot_config) {
    Object.assign(config, spot_config);
  }

  // Spot User object
  let user = { dt: null, ut: null, st: null, uta: config.uta, optin: null, dnt: null };

  // @return object
  let spotjs = {
    name: "spotjs "+version,
    config: config,
    user: user,
    dataLayer: null,
    sentEvents: [],
    pendingEvents: []
  };

  // @private logger
  let emptyFn = function(){},
      log = config.logLevel ? console.log.bind(window.console) : emptyFn,
      logError = config.logLevel >=1 ? log : emptyFn,
      logInfo  = config.logLevel >=2 ? log : emptyFn,
      logTrace = config.logLevel >=3 ? log : emptyFn;

  // @public push event to data layer
  let push = spotjs.push = function (eventType, params) {
    spotjs.dataLayer.push({ "event": eventType || config.eventType, "params": params });
  }

  // @public identify
  let identify = spotjs.identify = function (user2) {
    setUser(user2);
  }

  // @public signin - identify plus optin
  let signIn = spotjs.signin = function (user2) {
    setUser(user2);
    setOptin(1);
  }

  // @private setuser - setter with validation
  let setUser = function (user2) {
    if (typeof user2 !== "object") {
      logError("spotjs.setUser error - user object is required", user2);
      return false;
    }
    if (redact(user2.uta, user2.ut)) {
      user2.ut = "redacted";
      logError("spotjs.setUser error - obvious sensitive info not allowed as identifier");
      return false;
    }
    logTrace("spotjs.setUser applying user2 =", JSON.stringify(user2));
    Object.assign(spotjs.user, user2);
    logTrace("spotjs.setUser user =", JSON.stringify(user));
    return true;
  }
  
  // @public Signout - clear user token cookie
  let signOut = spotjs.signout = function () {
    user.ut = "";
    user.uta = config.uta;
    setCookie("ut", "");
    setCookie("uta", "");
  }

  // @public setOptin - set optin and dnt
  let setOptin = spotjs.setOptin = function (optin) {
    user.optin = optin === 0 ? 0 : 1;
    user.dnt = user.optin === 0 ? 1 : 0;
    setCookie("dnt", user.dnt);
  }

  // @private detectUser - load spot_user from querystring or variable
  let detectUser = function () {
    let user2 = null,
        param = null;
    if (typeof window[config.tagParams.spot_user] !== "undefined") {
      user2 = window[config.tagParams.spot_user];
      logTrace("spotjs.detectUser found spot_user variable = ", user2);
    }
    if (!user2) {
      param = getParam(config.tagParams.spot_user, "base64json");
      if (param) {
        user2 = param;
        logTrace("spotjs.detectUser found spot_user querystring param = ", user2);
      }
    }
    if (!user2) {
      param = getParam(config.tagParams.spot_ut);
      if (param) {
        user2 = { ut: param, uta: getParam(config.tagParams.spot_uta) };
        logTrace("spotjs.detectUser found spot_ut querystring param = ", user2);
      }
    }
    if (user2 && typeof user2 === "object") {
      if (!user2.uta) { user2.uta = config.uta; }
      logInfo("spotjs.detectUser user2 = ", user2);
      setUser(user2);
      spotjs.pendingEvents.push({ "event": "identify", "params": user2 });
    }
  }

  // @private initDataLayer
  let initDataLayer = function () {
    if (!spotjs.dataLayer) {
      spotjs.dataLayer = window[config.dataLayerId] = window[config.dataLayerId] || [];
      while (spotjs.pendingEvents.length) {
        spotjs.dataLayer.push(spotjs.pendingEvents.shift());
      }
      spotjs.dataLayer.push = function(e) {
        Array.prototype.push.call(spotjs.dataLayer, e);
        processDataLayer();
      };
    }
  }

  // @private processDataLayer
  let processDataLayer = function () {
    logTrace("spotjs.processDataLayer dataLayer =", JSON.stringify(spotjs.dataLayer));
    if (spotjs.dataLayer) {
      while (spotjs.dataLayer.length) {
        let data = spotjs.dataLayer.shift();
        logTrace("spotjs.processDataLayer data =", JSON.stringify(data));
        if (typeof data !== "object") {
          logTrace("spotjs.processDataLayer skipping non-object item", data)
          continue;
        }
        if (data.config && typeof data.config === "object") {
          logTrace("spotjs.processDataLayer setting config", data.config)
          setConfig(data.config);
        }
        let configError = validateConfig();
        if (configError) {
          logError("spotjs.processDataLayer error - exiting due to invalid config:", configError);
          spotjs.pendingEvents.push(data);
          continue;
        }
        let proceed = sandboxFunction(data.before, data);
        if (proceed === false) {
          sandboxFunction(data.cancel, data);
          continue;
        }
        if (data.event) {
          processEvent(data);
        }
        sandboxFunction(data.after, data);
      }
    }
  }

  // @private sandboxFunction
  let sandboxFunction = function(fnName, data) {
    if (fnName && typeof window[fnName] === "function") {
      try { 
        return window[fnName](data);
      }
      catch (e) {
        logError("spotjs.sandboxFunction error - function", data.before, " exception", e);
      }
    }
    return null;
  }

  // @public setConfig
  let setConfig = spotjs.setConfig = function (config2) {
    if (typeof config2 !== "object") {
      logError("spotjs.setConfig error - config object is required");
    }
    Object.assign(config, config2);
    logTrace("spotjs.setConfig config2 =", config2);
    Object.assign(config, config2);
    logTrace("spotjs.setConfig config =", config);

    let configError = validateConfig();
    if (configError) {
      logError("spotjs.setConfig error - invalid config:", configError);
    }
    else {
      // Process events waiting for valid config
      while (spotjs.pendingEvents.length) {
        spotjs.dataLayer.push(spotjs.pendingEvents.shift());
      }
    }
  }

  // @private validateConfig
  let validateConfig = function () {
    if (!config.apiHost) {
      return "error: apiHost is required";
    }
    else if (!config.apiAuth) {
      return "error: apiAuth is required";
    }
    return false; // no errors = valid
  }


  // @private processEvent - main event handler
  let processEvent = function (data) {
    data = data || {};
    if (!data.event) {
      return;
    }
    processSpecialEvents(data);
    if (data.send === false) {
      logInfo("spotjs.processEvent exiting - do not send");
      return;
    }
    processCookies(data);
    logTrace("spotjs.processEvent data =", data);
    // Construct event payload
    var evt = {},
        dateobj = new Date();
    evt.event = {
      "type": data.event,
      "sub_type": config.eventSubtype,
      "iso_time": dateobj.toISOString() };
    try { evt.event.local_tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(e){ }
    processCampaign(data);
    evt.campaign = data.campaign;
    evt.source = config.eventSource;
    // Event Client
    evt.client = {}
    evt.client.identifier = { "id": user.ut, "id_field": user.uta };
    evt.client[config.dta] = user.dt;
    evt.client[config.sta] = user.st;
    evt.client.user_agent = "user_agent_raw : "+navigator.userAgent;
    // Params JSON
    if (typeof data.params !== "object") {
      data.params = {};
    }
    let params_json = {};
    for (const key of Object.keys(data.params)) {
      let val = formatEventParam(evt.event, key, data.params[key]);
      if (config.eventParamKeys[key] !== undefined) {
        // set known params on event object
        evt.event[config.eventParamKeys[key]] = val;
      }
      else if (key !== "ut" && key !== "uta"){
        // send unknown event params in params_json
        params_json[key] = val;
        evt.params_json = params_json;
      }
    }
    // Update Attributes
    let update_attributes = data.update_attributes || {};
    // Set Visitor for anonymous
    if (!evt.client.identifier.id || redact(evt.client.identifier.id_field, evt.client.identifier.id)) {
      evt.client.identifier.id = user.dt;
      evt.client.identifier.id_field = config.dta;
      update_attributes.visitor = true;
    }
    if (Object.keys(update_attributes).length) {
      evt.callback = { "update_attributes": update_attributes };
    }

    logTrace("spotjs.processEvent", evt.event.type, " evt=", evt);
    sendEvent(evt);
  }

  // @private sendEvent - xhr transport
  let sendEvent = function (evt) {
    let xhr = new XMLHttpRequest();
    let evtId = evt.event.type+"-"+spotjs.sentEvents.length;
    logTrace("spotjs.sendEvent evtId =", evtId, " evt =", evt);
    spotjs.sentEvents.push({ "id": evtId, "evt": evt, "xhr": xhr });
    xhr.withCredentials = true;
    xhr.open("POST", config.apiHost+config.apiEndpoint, true);
    xhr.setRequestHeader("Content-Type", config.apiContentType);
    xhr.setRequestHeader("Authorization", config.apiAuth);
    xhr.addEventListener("readystatechange", function() {
      if(this.readyState === 4) {
        logInfo("spotjs.sendEvent", evtId, "completed =", this.responseText);
      }
    });
    let xhrBody = JSON.stringify(evt);
    logInfo("spotjs.sendEvent", evtId, "sending =", xhrBody);
    xhr.send(xhrBody);
  }

  // @private processSpecialEvents
  let processSpecialEvents = function (data) {
    if (!data.event) {
      return;
    }
    data.send = user.dnt !== 1;
    switch (data.event) {
      case "identify":
        identify(data.params);
        break;
      case "signin":
        signIn(data.params);
        data.send = true;
        break;
      case "signout":
        signOut();
        break;
      case "optin":
        setOptin(1);
        data.send = true;
        break;
      case "optout":
        setOptin(0);
        break;
      default:
        break;
    }
  }

  // @private processCampaign
  let processCampaign = function (data) {
    data.campaign = data.campaign || config.defaultCampaign;
    if (data.campaign.camp_id === config.defaultCampaign.camp_id) {
      let param = getParam(config.tagParams.spot_camp_id);
      if (param) {
        data.campaign.camp_id = param;
      }
    }
  }

  // @private processCookies
  let processCookies = function (data) {
    processCookie("dt", "{uuidv4}", data);
    processCookie("ut", null, data);
    processCookie("uta", config.uta, data);
    processCookie("st", "{uuidv4}", data, { cookieMaxAge: config.sessionLength });
    processCookie("dnt", null, data);
  }

  // @private processCookie
  let processCookie = function (key, defaultVal, data, options) {
    let cookieVal = getCookie(key);
    if (user[key] === undefined || user[key] === null) {
      if (data[key] !== undefined) {
        user[key] = data[key];
      }
      else if (cookieVal) {
        user[key] = cookieVal;
      }
      if (user[key] === undefined || user[key] === null) {
        if (defaultVal === "{uuidv4}") {
          user[key] = uuidv4();
        }
        else if (defaultVal !== null) {
          user[key] = defaultVal;
        }
      }
    }
    setCookie(key, user[key], options);
  }

  // @private getCookie
  let getCookie = function (name) {
    var v = document.cookie.match('(^|;) ?'+config.cookiePrefix+name+'=([^;]*)(;|$)');
    let v2 = v ? v[2] : null;
    if (v2 === "" || v2 === "null" || v2 === "redacted") { v2 = null; }
    return v2;
  }
  
  // @private setCookie
  let setCookie = function (name, value, options) {
    if (value === undefined || value === null) { return; }
    options = options || {};
    options.cookieMaxAge = options.cookieMaxAge || config.cookieMaxAge;
    if (redact(name, value)) {
      value = "redacted";
    }
    let c = config.cookiePrefix+name+'='+value+'; SameSite=None; Secure=true; Max-Age='+options.cookieMaxAge+';  Path=/;';
    logTrace("spotjs.setCookie c=", c);
    document.cookie = c;
  }

  // @private redact - do not use obviously sensitive info
  let redact = function (name, val) {
    if (name === 'email' || /^.+@.+\..+$/.test(val)) {
      return 'email';
    }
    return false;
  }

  // @private formatEventParam
  let formatEventParam = function (eventType, key, val) {
    if (redact(key, val)) {
      return 'redacted';
    }
    switch (val) {
      case "{url}":        return document.location.href;
      case "{referrer}":   return document.location.href;
      case "{useragent}":  return navigator.userAgent;
      default:             return val;
    }
  }

  // @private getParam from querystring
  let getParam = function (name, format) {
    let url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    let val = decodeURIComponent(results[2].replace(/\+/g, ' '));
    if (val && format === "base64json") {
      try {
        if (val.indexOf("{") !== 0) { val = atob(val) }
        val = JSON.parse(val);
      }
      catch (e) {
        logError("spotjs.getParam could not parse querystring param = ", name, " as", format);
      }
    }
    return val;
  }

  // @private uuidv4
  let uuidv4 = function () {
   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  spotjs.instance = uuidv4();
  // Detect user state prior to processing any events
  detectUser();
  // Init the array of events to process
  initDataLayer();
  // Finally, process any existing events
  processDataLayer();

  logInfo(spotjs.name, "ready", spotjs.instance);
  return spotjs;
}

if (!window.spotjs) {
  window.spotjs = SpotJs();
}
