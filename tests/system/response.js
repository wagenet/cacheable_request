// ==========================================================================
// CacheableRequest.Response Unit Test
// ==========================================================================
/*globals CacheableRequest */

var response, originalResponse, originalFindCached, originalCacheResponse,
    findCachedCount, updateFromOriginalCount, cacheResponseCount, notifyCount, tryOriginalCount;


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
