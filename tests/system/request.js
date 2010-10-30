// ==========================================================================
// CacheableRequest.Request Unit Test
// ==========================================================================
/*globals CacheableRequest */

var request, originalManager, originalResponse, sendCounter, createCounter;

module("CacheableRequest.Request: Basic", {
  setup: function(){
    request = CacheableRequest.Request.getUrl('/');
  },
  teardown: function(){
    request = null;
  }
});

test("should cache by default", function(){
  equals(request.get('canCache'), YES, "canCache should be YES");
});

test("should be able to switch caching", function(){
  request.cache(NO);
  equals(request.get('canCache'), NO, "canCache should be NO");
  request.cache(YES);
  equals(request.get('canCache'), YES, "canCache should be YES");
});

test("cache() should set YES by default", function(){
  request.set('canCache', NO);
  request.cache();
  equals(request.get('canCache'), YES, "canCache should be YES");
});

test("copies cache status", function(){
  request.cache(NO);
  equals(request.copy().get('canCache'), NO, "canCache should be NO");
});

module("CacheableRequest.Request: Sending", {
  setup: function(){
    request = CacheableRequest.Request.getUrl('/');

    sendCounter = 0;
    originalManager = CacheableRequest.Request.manager;
    CacheableRequest.Request.manager = {
      sendRequest: function(){
        sendCounter++;
      }
    };
  },

  teardown: function(){
    CacheableRequest.Request.manager = originalManager;
    request = null;
  }
});

test("send() should use CacheableRequest.Request.manager", function(){
  request.send();
  equals(sendCounter, 1, "sendCounter should be 1");
});

test("resend() should use CacheableRequest.Request.manager", function(){
  request.send()
  request.resend();
  equals(sendCounter, 2, "sendCounter should be 2");
});


module("CacheableRequest.Request.manager", {
  setup: function(){
    request = CacheableRequest.Request.getUrl('/');

    sendCounter = 0;
    originalManager = SC.Request.manager;
    SC.Request.manager = {
      sendRequest: function(){
        sendCounter++;
        return "SC.Response"
      }
    };

    originalResponse = CacheableRequest.Response;
    CacheableRequest.Response = {
      create: function(hash){
        createCounter++;
        return hash;
      }
    }
  },
  teardown: function(){
    SC.Request.manager = originalManager;
    CacheableRequest.Response = originalResponse;
    request = null;
  }
});

test("sendRequest should return cachedResponse if canCache", function(){
  var resp = request.cache().send();
  equals(sendCounter, 1, "should send to original manager");
  equals(resp.request.get('address'), request.get('address'), "should create CacheableRequest.Response with matching request");
  equals(resp.originalResponse, "SC.Response", "should create CacheableRequest.Response with standardResponse");
});

test("sendRequest should return standardResponse if cannotCache", function(){
  var resp = request.cache(NO).send();
  equals(sendCounter, 1, "should send to original manager");
  equals(resp, "SC.Response", "should be standard response");
});
