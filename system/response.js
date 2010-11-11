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

CacheableRequest.LOG_CACHING = NO;

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
      if (CacheableRequest.LOG_CACHING) console.log('CacheableRequest.Response: LOAD CACHE', data);
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
      var db = this._database = SCLocalStorage.SQLiteDatabase.create({ name: 'CacheableRequest' });

      var version = Number(this._database.get('version'));

      if (version < 0.1) {
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
        }, {
          success: function(){ db.set('version', '0.1'); }
        });
      }

      if (version < 0.2) {
        this._database.transaction("ALTER TABLE responses ADD COLUMN lastUsed INTEGER;", {
          success: function(){ db.set('version', '0.2'); }
        });
      }
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
    cached.addObserver('status', this, '_didFindCached');
  },

  _didFindCached: function(cached){
    if (cached.get('status') & SCLocalStorage.READY) {
      var data, response;

      cached.removeObserver('status', this, '_didFindCached');

      if (cached.get('length') === 0) {
        if (CacheableRequest.LOG_CACHING) console.log('CacheableRequest.Response: NO CACHE');
        return;
      }

      data = SC.json.decode(cached.objectAt(0).response);
      response = cached.get('response');

      if (data.rawResponseText) {
        if (response.get('isXML')) {
          if (window.DOMParser) {
            data.encodedBody = (new DOMParser()).parseFromString(data.rawResponseText,"text/xml");
          } else {
            // Internet Explorer
            xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = "false";
            data.encodedBody = xmlDoc.loadXML(data.rawResponseText); 
          }
        } else {
          data.encodedBody = data.rawResponseText;
        }
        delete data.rawResponseText;
      }

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

    // Get raw response text, since we can't JSON encode the XML
    var rawRequest = response.getPath('originalResponse.rawRequest'),
        rawResponseText = rawRequest ? rawRequest.responseText : null;

    data = {
      status: response.get('status'),
      timedOut: response.get('timedOut'),
      isError: response.get('isError'),
      errorObject: errorObject,
      isCancelled: response.get('isCancelled'),
      rawResponseText: rawResponseText
    };

    baseValues = {
      isJSON:   request.get('isJSON') ? 1 : 0,
      isXML:    request.get('isXML')  ? 1 : 0,
      headers:  SC.json.encode(request.get('headers')),
      address:  request.get('address'),
      type:     request.get('type'),
      body:     request.get('body') || '',
    };

    if (CacheableRequest.LOG_CACHING) console.log('CacheableRequest.Response: CACHING', baseValues, data);

    this.database().destroy('responses', baseValues);

    this.database().insert('responses', SC.extend(baseValues, {
      lastUsed: Date.now(),
      response: SC.json.encode(data)
    }));

    this.cleanupCache();
  },

  cleanupCache: function(){
    var lastUsed = SCLocalStorage.RecordArray.create();
    this._database.transaction("SELECT lastUsed FROM responses ORDER BY lastUsed DESC LIMIT 10;", {
      queryData: function(t, results){ lastUsed.set('rawResults', results); }
    });
    lastUsed.addObserver('status', this, '_didGetLastUsed');
  },

  _didGetLastUsed: function(response){
    if (response.get('status') & SCLocalStorage.READY) {
      response.removeObserver('status', this, '_didGetLastUsed');
      var lastUsed = response.get('lastObject').lastUsed;
      this._database.destroy('responses', ["lastUsed < ? OR lastUsed IS NULL", [lastUsed]]);
    }
  }

});
