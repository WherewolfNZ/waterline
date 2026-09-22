var assert = require('assert');
var Waterline = require('../../../lib/waterline');

describe('After FindOne Lifecycle Callback on findOne ::', function() {
  describe('When a record is found ::', function() {
    var person;
    var timesCalled;

    before(function(done) {
      var waterline = new Waterline();
      var Model = Waterline.Model.extend({
        identity: 'user',
        datastore: 'foo',
        primaryKey: 'id',
        fetchRecordsOnCreate: true,
        attributes: {
          id: {
            type: 'number'
          },
          name: {
            type: 'string'
          }
        },

        afterFindOne: function(record, cb) {
          timesCalled++;
          record.name = record.name + ' updated';
          return cb();
        }
      });

      waterline.registerModel(Model);

      // Fixture Adapter Def
      var adapterDef = { find: function(con, query, cb) { return cb(null, [
          {id: 1, name: 'John Doe', criteria: query.criteria},
        ]); }};

      var connections = {
        'foo': {
          adapter: 'foobar'
        }
      };

      waterline.initialize({ adapters: { foobar: adapterDef }, datastores: connections }, function(err, orm) {
        if (err) {
          return done(err);
        }
        person = orm.collections.user;
        return done();
      });
    });

    beforeEach(function() {
      timesCalled = 0;
    });

    it('should run afterFindOne when findOne finds a record', function(done) {
      person.findOne({ id: 1 }, { }, function(err, record) {
        if (err) {
          return done(err);
        }

        assert.equal(timesCalled, 1);
        assert.equal(record.name, 'John Doe updated');
        return done();
      });
    });

    it('should not run afterFindOne when skipAllLifecycleCallbacks is true', function(done) {
      person.findOne({ id: 1 })
        .meta({
          skipAllLifecycleCallbacks: true
        })
        .exec(function(err, record) {
          if (err) {
            return done(err);
          }

          assert.equal(timesCalled, 0);
          assert.equal(record.name, 'John Doe');
          return done();
        });
    });
  });

  describe('When no record matches ::', function() {
    var person;
    var timesCalled;
    var observedRecord;

    before(function(done) {
      var waterline = new Waterline();
      var Model = Waterline.Model.extend({
        identity: 'user',
        datastore: 'foo',
        primaryKey: 'id',
        attributes: {
          id: {
            type: 'number'
          },
          name: {
            type: 'string'
          }
        },

        afterFindOne: function(record, cb) {
          timesCalled++;
          observedRecord = record;
          return cb();
        }
      });

      waterline.registerModel(Model);

      // Fixture Adapter Def
      var adapterDef = { find: function(con, query, cb) { return cb(null, []); }};

      var connections = {
        'foo': {
          adapter: 'foobar'
        }
      };

      waterline.initialize({ adapters: { foobar: adapterDef }, datastores: connections }, function(err, orm) {
        if (err) {
          return done(err);
        }
        person = orm.collections.user;
        return done();
      });
    });

    beforeEach(function() {
      timesCalled = 0;
      observedRecord = 'not yet called';
    });

    // NOTE: the callback still runs when nothing matched, and is handed `undefined`
    // rather than a record. An `afterFindOne` that dereferences its first argument
    // must therefore guard for that, or it will throw on every miss.
    it('should still run afterFindOne, with an undefined record', function(done) {
      person.findOne({ id: 99 }, { }, function(err, record) {
        if (err) {
          return done(err);
        }

        assert.equal(timesCalled, 1);
        assert.equal(observedRecord, undefined);
        assert.equal(record, undefined);
        return done();
      });
    });
  });

  describe('When afterFindOne errors ::', function() {
    var person;

    before(function(done) {
      var waterline = new Waterline();
      var Model = Waterline.Model.extend({
        identity: 'user',
        datastore: 'foo',
        primaryKey: 'id',
        attributes: {
          id: {
            type: 'number'
          },
          name: {
            type: 'string'
          }
        },

        afterFindOne: function(record, cb) {
          return cb(new Error('Whoops, afterFindOne'));
        }
      });

      waterline.registerModel(Model);

      // Fixture Adapter Def
      var adapterDef = { find: function(con, query, cb) { return cb(null, [
          {id: 1, name: 'John Doe'},
        ]); }};

      var connections = {
        'foo': {
          adapter: 'foobar'
        }
      };

      waterline.initialize({ adapters: { foobar: adapterDef }, datastores: connections }, function(err, orm) {
        if (err) {
          return done(err);
        }
        person = orm.collections.user;
        return done();
      });
    });

    it('should surface the error instead of the record', function(done) {
      person.findOne({ id: 1 }, { }, function(err, record) {
        assert(err);
        assert.equal(err.message, 'Whoops, afterFindOne');
        assert.equal(record, undefined);
        return done();
      });
    });
  });
});
