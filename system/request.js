// ==========================================================================
// Project:   CacheableRequest - A Request Caching Framework for SproutCore
// Copyright: ©2010 Strobe Inc., Peter Wagenet, and contributors.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================

CacheableRequest.Request = SC.Request.extend({

  canCache: YES,

  /**
    Converts the current request to cacheable.

    @param {Boolean} flag YES to make cacheable, NO or undefined
    @returns {SC.Request} recevier
  */
  cache: function(flag) {
    if (flag === undefined) flag = YES;
    return this.set('canCache', flag);
  },

  COPY_KEYS: SC.Request.prototype.COPY_KEYS.concat('canCache'),

  /**
    Will fire the actual request.  If you have set the request to use JSON 
    mode then you can pass any object that can be converted to JSON as the 
    body.  Otherwise you should pass a string body.

    @param {String|Object} body (optional)
    @returns {SC.Response} new response object
  */
  send: function(body) {
    // Sanity-check:  Be sure a timeout value was not specified if the request
    // is synchronous (because it wouldn't work).
    var timeout = this.get('timeout');
    if (timeout) {
      if (!this.get('isAsynchronous')) throw "Timeout values cannot be used with synchronous requests";
    }
    else if (timeout === 0) {
      throw "The timeout value must either not be specified or must be greater than 0";
    }

    if (body) this.set('body', body);
    return CacheableRequest.Request.manager.sendRequest(this.copy()._prep());
  },

  /**
    Resends the current request.  This is more efficient than calling send()
    for requests that have already been used in a send.  Otherwise acts just
    like send().  Does not take a body argument.

    @returns {SC.Response} new response object
  */
  resend: function() {
    var req = this.get('source') ? this : this.copy()._prep();
    return CacheableRequest.Request.manager.sendRequest(req);
  }

});

// We're extending a deep copy, fun!
CacheableRequest.Request.manager = SC.extend(SC.copy(SC.Request.manager, YES), {

  /**
    Invoked by the send() method on a request.  This will create a new low-
    level transport object and queue it if needed.

    @param {SC.Request} request the request to send
    @returns {SC.Object} response object
  */
  sendRequest: function(request){
    var standardResponse, cachedResponse;

    // Create standard request
    standardResponse = SC.Request.manager.sendRequest(request);

    if (request.get('canCache')) {
      // Get cached request
      cachedResponse = CacheableRequest.Response.create({ request: request, originalResponse: standardResponse });
    }

    return cachedResponse || standardResponse;
  }

});
