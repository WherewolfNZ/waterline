var assert = require('assert');
var Waterline = require('../../../lib/waterline');

describe('After FindOne Lifecycle Callback on findOrCreate::', function() {
  describe('When the record already exists ::', function() {
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

    it('should run afterFindOne when findOrCreate finds a record', function(done) {
      person.findOrCreate({ id: 1 }, { name: 'John Doe' }, function(err, record, wasCreated) {
        if (err) {
          return done(err);
        }

        assert.equal(timesCalled, 1);
        assert.equal(record.name, 'John Doe updated');
        assert.equal(wasCreated, false);
        return done();
      });
    });
  });

  describe('When the record has to be created ::', function() {
    var person;
    var timesCalled;
    var observedRecord;

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
          observedRecord = record;
          return cb();
        }
      });

      waterline.registerModel(Model);

      // Fixture Adapter Def
      // Nothing matches, so findOrCreate falls through to `create`.
      var adapterDef = {
        find: function(con, query, cb) { return cb(null, []); },
        create: function(con, query, cb) { return cb(null, query.newRecord); }
      };

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

    // NOTE: the lookup that findOrCreate performs before creating still fires
    // `afterFindOne`, handing it `undefined` because nothing matched. The callback
    // does NOT run again for the record that is then created, so the returned
    // record is untouched by it.
    it('should run afterFindOne for the failed lookup, with an undefined record', function(done) {
      person.findOrCreate({ id: 5 }, { id: 5, name: 'New Guy' }, function(err, record, wasCreated) {
        if (err) {
          return done(err);
        }

        assert.equal(timesCalled, 1);
        assert.equal(observedRecord, undefined);
        assert.equal(record.name, 'New Guy');
        assert.equal(wasCreated, true);
        return done();
      });
    });
  });
});
