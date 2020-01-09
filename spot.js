/**
 * Spot.js 0.0.3
 *
 *  Spot.js is a web tracker tag
 *
 *  Spot observes window.spotDataLayer array
 *
 */

/*
var spotConfigs = {
  "cust100": {
    apiHost: "https://api-cust100.demostellar.com",
    apiEndpoint: "/edp/api/event",
    apiAuthorization: "Bearer 9d93dd6d82531de07978181313a29978bab3c4c0a3112cbe527e10cd1c3add8d:27ceca09315271167c9c88859fe02965716d7f8d844055eb354dff659cc569d9",
    useNavigatorBeacon: false },
  "qa-master": {
    apiHost: "https://qa-master.demostellar.com",
    apiEndpoint: "/edp/api/event",
    apiAuthorization: "Bearer 51c22975c02f9aa17cc2a3afc9834c52ae5fb2b320c9815a72f2641763199f3e:0f9201e41766d68f55097ef365b444806396952355f6c35b19df1fe27470570e",
    useNavigatorBeacon: false },
  "growingtree": {
    apiHost: "https://growingtree.demostellar.com",
    apiEndpoint: "/edp/api/event",
    apiAuthorization: "Bearer 7ed9828b0021035c22f1b142db14704bc4eb95b11f93d973bd9c9b698cf736e4:3e1824ff3ec2d7e2e20c13fa00d60d4dbc4a965d5fd48a1f4887338759c1d8e7",
    useNavigatorBeacon: false }
};
*/

//
// Implementation
//
function SpotJs () {
  let spotjs = {
    name: "spotjs 0.0.3 "+Math.random().toString(36).substring(7),
    apiConfig: {},
    eventConfig: {},
    dataLayer: null,
    sent: []
  }

  spotjs.onDataLayerPush = function () {
    console.log("spotjs.onDataLayerPush");
    spotjs.processDataLayer();
  }

  spotjs.processDataLayer = function () {
    console.log("spotjs.processDataLayer dataLayer =", spotjs.dataLayer)
    if (spotjs.onDataLayerPush) {
      while (spotjs.dataLayer.length) {
        let data = spotjs.dataLayer.shift();
        if (typeof data !== "object") {
          console.log("spotjs.processDataLayer skipping non-object item", data)
          return;
        }
        if (data && data.type) {
          if (data.type === "apiconfig") {
            spotjs.processApiConfig(data);
          }
          else if (data.type === "eventconfig") {
            spotjs.processEventConfig(data);
          }
          else {
            if (!spotjs.apiConfig.apiHost) {
              spotjs.dataLayer.unshift(data);
            }
            else {
              spotjs.processEvent(data);
            }
          }
        }
      }
    }
  }

  // Allow the tag to provide API config, such as API details.
  spotjs.processApiConfig = function (data) {
    console.log("spotjs.processApiConfig data =", data);
    if (data.apiHost) {
      spotjs.apiConfig = data;
    }
  }

  spotjs.processEventConfig = function (data) {
    console.log("spotjs.processEventConfig data =", data);
    spotjs.eventConfig = data;
  }

  // Process a business event, such as a page visit, add to cart, etc.
  spotjs.processEvent = function (data) {
    console.log("spotjs.processEvent data =", data);
    if (!data.iso_time) {
      let dateobj = new Date();
      data.iso_time = dateobj.toISOString();
    }
    var evt = {
      "event": {
        "type": data.type || spotjs.eventConfig.eventType || "web",
        "iso_time": data.iso_time
      },
      "client": {
        "identifier": {
          "id": data.dt, 
          "id_field": spotjs.eventConfig.idField || "integration_id"
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
    if (spotjs.apiConfig.useNavigatorBeacon && navigator.sendBeacon) {
      let blob = new Blob(data, { "type": "application/json" });
      navigator.sendBeacon(spotjs.apiConfig.apiHost + spotjs.apiConfig.apiEndpoint, blob);
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
      xhr.open("POST", spotjs.apiConfig.apiHost+spotjs.apiConfig.apiEndpoint, true);
      xhr.setRequestHeader("Content-Type", spotjs.apiConfig.contentType || "application/json");
      xhr.setRequestHeader("Authorization", spotjs.apiConfig.apiAuthorization);
      // TODO - update sent status in async callbacks
      //spotjs.sent[evtId].status = "done";
      xhr.send(data);
    }
  }

  // Init Data Layer
  if (!spotjs.dataLayer) {
    if (typeof window.spotDataLayer === 'undefined') {
      window.spotDataLayer = [];
    }
    spotjs.dataLayer = window.spotDataLayer;
    spotjs.dataLayer.push = function(e) {
      Array.prototype.push.call(spotjs.dataLayer, e);
      spotjs.onDataLayerPush();
    };
    spotjs.processDataLayer();
  }

  console.log (spotjs.name, "loaded");
  return spotjs;
}

if (!window.spotjs) {
  window.spotjs = SpotJs();
}
