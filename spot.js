/**
 * Spot.js 0.0.3
 *
 *  Spot.js is a web tracker tag
 *
 *  Spot observes window.spotDataLayer array
 *
 */

//
// Implementation
//
function SpotJs (customConfig) {

  let config = {
    apiContentType: 'application/json',
    apiHost: 'https://growingtree.demostellar.com',
    apiEndpoint: '/api/edp/event',
    apiAuthorization: 'Bearer 7ed9828b0021035c22f1b142db14704bc4eb95b11f93d973bd9c9b698cf736e4:3e1824ff3ec2d7e2e20c13fa00d60d4dbc4a965d5fd48a1f4887338759c1d8e7:6d228e44e479cca02776f2d8b5a0f191e09a0e0fe7bdfa84b7a43152820d9403',
    dtCookieName: 'spot_dt',
    dtCookieName: 'spot_dt',
    cookieMaxAage: 60*60*24*365,
    useNavigatorBeacon: false,
    dataLayerId: 'spotDataLayer'
  };
  Object.assign(config, customConfig);

  let spotjs = {
    name: "spotjs 0.0.3 "+Math.random().toString(36).substring(7),
    dataLayer: null,
    config: config,
    sent: []
  };

  // Init Data Layer
  spotjs.initDataLayer = function () {
    if (!spotjs.dataLayer) {
      // TODO - use config.dataLayerId
      if (typeof spotDataLayer === 'undefined') {
        console.log("spotjs initializing empty spotDataLayer");
        window.spotDataLayer = [];
      }
      else {
        console.log("spotjs found existing spotDataLayer =", spotDataLayer);
      }
      console.log("spotjs extending spotDataLayer.push");
      spotjs.dataLayer = spotDataLayer;
      spotjs.dataLayer.push = function(e) {
        Array.prototype.push.call(spotjs.dataLayer, e);
        spotjs.onDataLayerPush();
      };
      spotjs.processDataLayer();
    }
  }

  spotjs.onDataLayerPush = function () {
    console.log("spotjs.onDataLayerPush");
    spotjs.processDataLayer();
  }

  spotjs.processDataLayer = function () {
    console.log("spotjs.processDataLayer dataLayer =", JSON.stringify(spotjs.dataLayer))
    if (spotjs.onDataLayerPush) {
      while (spotjs.dataLayer.length) {
        let data = spotjs.dataLayer.shift();
        if (typeof data !== "object") {
          console.log("spotjs.processDataLayer skipping non-object item", data)
          return;
        }
        if (data) {
          if (data.config) {
            spotjs.processConfig(data);
          }
          if (data.type) {
            spotjs.processEvent(data);
          }
        }
      }
    }
  }

  // Allow the tag to provide config, such as API details.
  spotjs.processConfig = function (data) {
    console.log("spotjs.processConfig data.config =", JSON.stringify(data.config);
    Object.assign(config, data.config);
    console.log("spotjs.processConfig config =", config);
  }

  // Process a business event, such as a page visit, add to cart, etc.
  spotjs.processEvent = function (data) {
    console.log("spotjs.processEvent data =", data);
    if (!data.dt) {
      data.dt = spotjs.loadDeviceToken();
    }
    if (!data.iso_time) {
      let dateobj = new Date();
      data.iso_time = dateobj.toISOString();
    }
    var evt = {
      "event": {
        "type": data.type,
        "iso_time": data.iso_time
      },
      "client": {
        "identifier": {
          "id": data.dt, 
          "id_field": config.idField
        }
      },
      "campaign": {
        "ext_parent_id": "1",
        "camp_id": "1"
      }
    };
    console.log("spotjs.processEvent evt =", evt);
    spotjs.sendEvent(evt);
  }

  spotjs.sendEvent = function (evt) {
    let evtId = spotjs.sent.length+1;
    let data = JSON.stringify(evt);
    console.log("spotjs.sendEvent evt =", evt);
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
          console.log(this.responseText, this);
          //this.status = 204;
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

  spotjs.loadDeviceToken = function () {
    let dt = spotjs.getCookie(config.dtCookieName);
    if (dt === null && dt !== "NO TRACK") {
      dt = spotjs.createDeviceToken();
    }
    return dt;
  }
  spotjs.createDeviceToken = function () {
    let dt = spotjs.uuidv4();
    spotjs.setCookie(config.dtCookieName, dt, config);
    return dt;
  }
  spotjs.getCookie = function (name) {
    var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return v ? v[2] : null;
  }
  spotjs.setCookie = function (name, value, options) {
    let c = name+'='+value;
    c += '; SameSite=None';
    c += '; Secure=true';
    c += '; Max-Age='+config.cookieMaxAge;
    c += "; Path=/";
    document.cookie = c;
  }

  // Utils
  spotjs.uuidv4 = function () {
   return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }


  // Run init methods and return spotjs object
  spotjs.initDataLayer();
  console.log(spotjs.name, "created");
  return spotjs;
}

if (!window.spotjs) {
  window.spotjs = SpotJs({ customConfig: 0 });
}
