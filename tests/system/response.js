// ==========================================================================
// CacheableRequest.Response Unit Test
// ==========================================================================
/*globals CacheableRequest */

var response, originalResponse, originalFindCached, originalCacheResponse, originalDatabaseCreate,
    findCachedCount, updateFromOriginalCount, cacheResponseCount, notifyCount, tryOriginalCount,
    databaseCreateParams, databaseTableParams, databaseFindParams, databaseInsertParams, databaseDestroyParams;


function jsonCompare(a, b){
  return SC.json.encode(a) == SC.json.encode(b);
}


module("CacheableRequest.Response: Basic", {
  setup: function(){
    response = CacheableRequest.Response.create({
      originalResponse: {
        fire:            function(){ return "fire"; },
        invokeTransport: function(){ return "invokeTransport"; },
        receive:         function(callback, content){ return ["receive", callback, content]; },
        cancel:          function(){ return "cancel"; },
        timeoutReached:  function(){ return "timeoutReached"; }
      }
    });
  },
  teardown: function(){
    response = null;
  }
});

test("pass-through methods", function(){
  equals(response.fire(), "fire", "fire() should pass-through");
  equals(response.invokeTransport(), "invokeTransport", "invokeTransport() should pass-through");
  equals(SC.json.encode(response.receive('callback', 'content')), SC.json.encode(["receive", 'callback', 'content']), "receive() should pass-through");
  equals(response.cancel(), "cancel", "cancel() should pass-through");
  equals(response.timeoutReached(), "timeoutReached", "timeoutReached() should pass-through");
});



module("CacheableRequest.Response: Init", {
  setup: function(){
    findCachedCount = 0;
    originalFindCached = CacheableRequest.Response.findCached;
    CacheableRequest.Response.findCached = function(response){ findCachedCount++; };
  },
  teardown: function(){
    CacheableRequest.Response.findCached = originalFindCached;
  }
});

test("init should try to findCached", function(){
  CacheableRequest.Response.create();
  equals(findCachedCount, 1, "should have called findCached");
});



module("CacheableRequest.Response: Status Changes", {
  setup: function(){
    originalResponse = SC.Response.create();
    // Mark as if we've already got a cached response
    response = CacheableRequest.Response.create({ originalResponse: originalResponse, status: 200, isCached: YES });
    updateFromOriginalCount = 0;
    response._updateFromOriginal = function(){ updateFromOriginalCount++; };
  },
  teardown: function(){
    response = null;
    originalResponse = null;
  }
});

test("should update if originalResponse.status is success", function(){
  originalResponse.set('status', 200);
  equals(updateFromOriginalCount, 1, "should call updateFromOriginal");
});

test("should update if originalResponse.status is failure and current is also failure", function(){
  response.set('status', 404);
  originalResponse.set('status', 404);
  equals(updateFromOriginalCount, 1, "should call updateFromOriginalCount");
});

test("should not update if originalResponse.status is failure and current is success", function(){
  originalResponse.set('status', 404);
  equals(updateFromOriginalCount, 0, "should not call updateFromOriginalCount");
});



module("CacheableRequest.Response: Updates", {
  setup: function(){
    originalResponse = SC.Response.create({
      timedOut:    'timedOut',
      isError:     'isError',
      errorObject: 'errorObject',
      isCancelled: 'isCancelled',
      encodedBody: 'encodedBody',
      status:      'status'
    });
    response = CacheableRequest.Response.create({ originalResponse: originalResponse, isCached: YES });

    cacheResponseCount = 0;
    originalCacheResponse = CacheableRequest.Response.cacheResponse;
    CacheableRequest.Response.cacheResponse = function(response){ cacheResponseCount++; };
  },
  teardown: function(){
    CacheableRequest.Response.cacheResponse = originalCacheResponse;
    response = null;
    originalResponse = null;
  }
});

test("update from original", function(){
  response._updateFromOriginal();
  equals(response.get('timedOut'),    'timedOut',    "should transfer timedOut");
  equals(response.get('isError'),     'isError',     "should transfer isError");
  equals(response.get('errorObject'), 'errorObject', "should transfer errorObject");
  equals(response.get('isCancelled'), 'isCancelled', "should transfer isCancelled");
  equals(response.get('encodedBody'), 'encodedBody', "should transfer encodedBody");
  equals(response.get('status'),      'status',      "should transfer status");
});

test("should mark as final and not cached", function(){
  response._updateFromOriginal();
  equals(response.get('isCached'), NO, "isCached should be NO");
  equals(response.get('isFinal'), YES, "isFinal should be YES");
});

test("should cacheResponse", function(){
  response._updateFromOriginal();
  equals(cacheResponseCount, 1, "should cacheResponse");
});



module("CacheableRequest.Response: LoadCache", {
  setup: function(){
    notifyCount = 0;
    tryOriginalCount = 0;
    response = CacheableRequest.Response.create();
    response.notify = function(){ notifyCount++; };
    response._tryOriginal = function(){ tryOriginalCount++; };
  },
  teardown: function(){
    response = null;
  }
});

test("should not loadCache if isFinal", function(){
  response.set('isFinal', YES);
  response.loadCache({});
  equals(response.get('isCached'), NO, "should not load cache");
});

test("should update data", function(){
  response.loadCache({
    timedOut: 'timedOut',
    isError:  'isError',
    errorObject: 'errorObject',
    isCancelled: 'isCancelled',
    encodedBody: 'encodedBody',
    status:      'status'
  });

  equals(response.get('timedOut'),    'timedOut',    "should load timedOut");
  equals(response.get('isError'),     'isError',     "should load isError");
  equals(response.get('errorObject'), 'errorObject', "should load errorObject");
  equals(response.get('isCancelled'), 'isCancelled', "should load isCancelled");
  equals(response.get('encodedBody'), 'encodedBody', "should load encodedBody");
  equals(response.get('status'),      'status',      "should load status");
  equals(response.get('isCached'), YES, "should set isCached");
});

test("should call notify and _tryOriginal", function(){
  response.loadCache({});
  equals(notifyCount, 1, "should call notify");
  equals(tryOriginalCount, 1, "should call _tryOriginal");
});



module("CacheableRequest.Response: Class Methods", {
  setup: function(){
    originalDatabaseCreate = SCLocalStorage.SQLiteDatabase.create;
    SCLocalStorage.SQLiteDatabase.create = function(){
      databaseCreateParams = SC.A(arguments);
      return {
        createTable: function(){
          databaseTableParams = SC.A(arguments);
        },
        find: function(){
          databaseFindParams = SC.A(arguments);
          return SC.Object.create();
        },
        insert: function(){
          databaseInsertParams = SC.A(arguments);
        },
        destroy: function(){
          databaseDestroyParams = SC.A(arguments);
        }
      }
    };
    CacheableRequest.Response.database(); // Initialize database
    databaseCreateParams = null;
    databaseTableParams = null;
    databaseFindParams = null;
    databaseInsertParams = null;
    databaseDestroyParams = null;
  },
  teardown: function(){
    SCLocalStorage.SQLiteDatabase.create = originalDatabaseCreate;
    CacheableRequest.Response._database = null;
  }
});

test("initialize database", function(){
  CacheableRequest.Response._database = null;
  CacheableRequest.Response.database();

  ok(jsonCompare(databaseCreateParams[0], { name: 'CacheableRequest' }), "should create database named CacheableRequest");

  equals(databaseTableParams[0], 'responses', "should create table named 'responses'");

  var expected = {
    isJSON:   'integer',
    isXML:    'integer',
    headers:  'text',
    address:  'text',
    type:     'text',
    body:     'text',
    response: 'text'
  };
  ok(jsonCompare(databaseTableParams[1], expected), "should have proper fields");
});

test("findCached", function(){
  var ret = CacheableRequest.Response.findCached(SC.Object.create({
    request: SC.Object.create({
      isJSON: YES,
      isXML: NO,
      headers: null,
      address: 'http://google.com',
      type: 'GET',
      body: null
    })
  }));

  var expectedParams = {
    isJSON: 1,
    isXML: 0,
    headers: 'null',
    address: 'http://google.com',
    type: 'GET',
    body: ''
  };
  ok(jsonCompare(databaseFindParams, ['responses', expectedParams]), "should have proper find arguments");

  // TODO: Test setting of response and observer
});

test("_didFindCached JSON", function(){
  var loadCacheData;

  var encodedBody = SC.json.encode({ a: 1 });

  var cached = [{
    response: SC.json.encode({
      rawResponseText: encodedBody
    })
  }];
  cached.set('status', SCLocalStorage.READY);
  cached.set('response', SC.Object.create({
    isJSON: YES,
    isXML: NO,
    loadCache: function(data){ loadCacheData = data; }
  }));

  CacheableRequest.Response._didFindCached(cached);

  var expected = {
    encodedBody: encodedBody
  };
  ok(jsonCompare(loadCacheData, expected), "should load proper data into cache");
});

test("_didFindCached XML", function(){
  var loadCacheData;

  var cached = [{
    response: SC.json.encode({
      rawResponseText: '<?xml version="1.0" encoding="UTF-8"?><item><name>Test</name></item>'
    })
  }];
  cached.set('status', SCLocalStorage.READY);
  cached.set('response', SC.Object.create({
    isJSON: NO,
    isXML: YES,
    loadCache: function(data){ loadCacheData = data; }
  }));

  CacheableRequest.Response._didFindCached(cached);

  equals(loadCacheData.encodedBody.getElementsByTagName('item')[0].textContent, 'Test', "should parse into xml");
});
