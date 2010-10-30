// ==========================================================================
// Project:   CacheableRequest - A Request Caching Framework for SproutCore
// Copyright: ©2010 Strobe Inc., Peter Wagenet, and contributors.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================

/**
 KNOWN ISSUES

  - If original request errors quickly it may notify before the cache has loaded
  - We may want to avoid caching errors
  - No cache size limits

*/

CacheableRequest.Response = SC.Response.extend({

  isCached: NO,
  isFinal: NO,

  originalResponse: null,

  // This assumes status gets changed last
  _tryOriginal: function(){
    var currentStatus = this.get('status'),
        newStatus = this.getPath('originalResponse.status'),
        currentSuccess = (currentStatus >= 200) && (currentStatus < 300),
        newSuccess = (newStatus >= 200) && (newStatus < 300),
        isCached = this.get('isCached');

    if (newStatus === -100) return;

    if (newSuccess || (!currentSuccess && isCached)) {
      this._updateFromOriginal();
    }
  }.observes('*originalResponse.status'),

  _updateFromOriginal: function(){
    var response = this.get('originalResponse');

    this.beginPropertyChanges();
    this.set('timedOut', response.get('timedOut'));
    this.set('isError', response.get('isError'));
    this.set('errorObject', response.get('errorObject'));
    this.set('isCancelled', response.get('isCancelled'));
    this.set('encodedBody', response.get('encodedBody'));
    this.set('status', response.get('status'));
    this.set('isCached', NO);
    this.set('isFinal', YES);
    this.endPropertyChanges();

    CacheableRequest.Response.cacheResponse(this);
  },

  fire: function(){
    return this.get('originalResponse').fire();
  },

  invokeTransport: function(){
    return this.get('originalResponse').invokeTransport();
  },

  receive: function(callback, content) {
    return this.get('originalResponse').receive(callback, content);
  },

  cancel: function(){
    return this.get('originalResponse').cancel();
  },

  timeoutReached: function(){
    return this.get('originalResponse').timeoutReached();
  },

  loadCache: function(data){
    if (!this.get('isFinal')) {
      this.beginPropertyChanges();
      this.set('timedOut', data.timedOut);
      this.set('isError', data.isError);
      this.set('errorObject', data.errorObject);
      this.set('isCancelled', data.isCancelled);
      this.set('encodedBody', data.encodedBody);
      this.set('status', data.status);
      this.set('isCached', YES);
      this.endPropertyChanges();
      this.notify();
      this._tryOriginal();
    }
  },

  init: function(){
    sc_super();
    CacheableRequest.Response.findCached(this);
  }

});

CacheableRequest.Response.mixin({

  database: function(){
    if (!this._database) {
      this._database = SCLocalStorage.SQLiteDatabase.create({ name: 'CacheableRequest' });

      // Expand this to filter by more params like headers
      this._database.createTable('responses', {
        // Request data
        isJSON:   'integer', // 0 or 1
        isXML:    'integer', // 0 or 1
        headers:  'text', // JSON
        address:  'text',
        type:     'text',
        body:     'text',
        response: 'text' // JSON
      });
    }

    return this._database;
  },

  findCached: function(response){
    var request = response.get('request');
    if (!request) return;

    cached = this.database().find('responses', {
      isJSON:  request.get('isJSON') ? 1 : 0,
      isXML:   request.get('isXML')  ? 1 : 0,
      headers: SC.json.encode(request.get('headers')),
      address: request.get('address'),
      type:    request.get('type'),
      body:    request.get('body') || ''
    });
    cached.set('response', response); // Just for internal use
    cached.addObserver('status', this, '_didFindCached', request);
  },

  _didFindCached: function(cached){
    if (cached.get('status') & SCLocalStorage.READY) {
      var data, response;

      cached.removeObserver('status', this, '_didFindCached');

      if (cached.get('length') === 0) {
        console.log('No cache');
        return;
      }

      data = SC.json.decode(cached.objectAt(0).response);
      response = cached.get('response');

      SC.RunLoop.begin();
      response.loadCache(data);
      SC.RunLoop.end();
    }
  },

  cacheResponse: function(response) {
    var request, data, baseValues;

    request = response.get('request');

    // Fix issues with circularity
    var errorObject = response.get('errorObject');
    if (errorObject) {
      errorObject = SC.copy(errorObject);
      errorObject.errorValue = null;
    }

    data = {
      status: response.get('status'),
      timedOut: response.get('timedOut'),
      isError: response.get('isError'),
      errorObject: errorObject,
      isCancelled: response.get('isCancelled'),
      encodedBody: response.get('encodedBody')
    };

    baseValues = {
      isJSON:   request.get('isJSON') ? 1 : 0,
      isXML:    request.get('isXML')  ? 1 : 0,
      headers:  SC.json.encode(request.get('headers')),
      address:  request.get('address'),
      type:     request.get('type'),
      body:     request.get('body') || '',
    };

    this.database().destroy('responses', baseValues);

    this.database().insert('responses', SC.extend(baseValues, {
      response: SC.json.encode(data)
    }));
  }

});
