var assert = require('assert');
var Waterline = require('../../../lib/waterline');

describe('Uniqueness error diagnostics ::', function() {
  var model;
  var keys;

  before(function(done) {
    var waterline = new Waterline();
    waterline.registerModel(Waterline.Model.extend({
      identity: 'person',
      datastore: 'test',
      primaryKey: 'id',
      attributes: {
        id: { type: 'number' },
        name: { type: 'string', columnName: 'display_name' },
        score: { type: 'number' },
        enabled: { type: 'boolean' },
        privateNote: { type: 'string' }
      },
      beforeCreate: function(record, next) {
        record.name = record.name.trim();
        return next();
      }
    }));

    // Match sails-postgresql: its normalized error supplies keys but no native value or detail.
    function notUnique(datastore, query, cb) {
      var err = new Error('Duplicate record');
      err.footprint = { identity: 'notUnique', keys: keys };
      return cb(err);
    }

    waterline.initialize({
      adapters: { fixture: { create: notUnique, createEach: notUnique, update: notUnique } },
      datastores: { test: { adapter: 'fixture' } }
    }, function(err, orm) {
      if (err) { return done(err); }
      model = orm.collections.person;
      return done();
    });
  });

  beforeEach(function() {
    keys = ['display_name'];
  });

  it('includes the post-lifecycle create value and maps physical columns to attributes', function(done) {
    model.create({ name: ' duplicate ', privateNote: 'do-not-log-this' }).exec(function(err) {
      assert.strictEqual(err.name, 'AdapterError');
      assert.strictEqual(err.code, 'E_UNIQUE');
      assert.strictEqual(err.modelIdentity, 'person');
      assert.strictEqual(err.adapterMethodName, 'create');
      assert.deepStrictEqual(err.attrNames, ['name']);
      assert.deepStrictEqual(err.keys, ['display_name']);
      assert.deepStrictEqual(err.keyValues, [{ display_name: 'duplicate' }]);
      assert(err.message.indexOf('Model: person.') !== -1);
      assert(err.message.indexOf('Attempted key/value(s): {"display_name":"duplicate"}.') !== -1);
      assert(err.stack.indexOf(err.message) !== -1);
      assert.strictEqual(err.message.indexOf('do-not-log-this'), -1);
      assert.strictEqual(err.raw.message, 'Duplicate record');
      assert.deepStrictEqual(JSON.parse(JSON.stringify(err)).keyValues, err.keyValues);
      return done();
    });
  });

  it('includes the new update value rather than a value from the selection criteria', function(done) {
    model.update({ name: 'original' }, { name: 'duplicate', privateNote: 'do-not-log-this' }).exec(function(err) {
      assert.strictEqual(err.code, 'E_UNIQUE');
      assert.strictEqual(err.adapterMethodName, 'update');
      assert.deepStrictEqual(err.keyValues, [{ display_name: 'duplicate' }]);
      assert(err.message.indexOf('Attempted key/value(s): {"display_name":"duplicate"}.') !== -1);
      assert.strictEqual(err.message.indexOf('original'), -1);
      assert.strictEqual(err.message.indexOf('do-not-log-this'), -1);
      return done();
    });
  });

  it('labels bulk insert values as candidates without exposing unrelated fields', function(done) {
    model.createEach([
      { name: 'first', privateNote: 'first-secret' },
      { name: 'duplicate', privateNote: 'second-secret' }
    ]).exec(function(err) {
      assert.strictEqual(err.code, 'E_UNIQUE');
      assert.strictEqual(err.adapterMethodName, 'createEach');
      assert.deepStrictEqual(err.keyValues, [{ display_name: 'first' }, { display_name: 'duplicate' }]);
      assert(err.message.indexOf('Candidate key/value sets: [{"display_name":"first"},{"display_name":"duplicate"}].') !== -1);
      assert.strictEqual(err.message.indexOf('secret'), -1);
      return done();
    });
  });

  it('retains zero, false and empty values in a multi-column constraint', function(done) {
    keys = ['score', 'enabled', 'display_name'];
    model.create({ score: 0, enabled: false, name: '' }).exec(function(err) {
      assert.strictEqual(err.code, 'E_UNIQUE');
      assert.deepStrictEqual(err.attrNames, ['score', 'enabled', 'name']);
      assert.deepStrictEqual(err.keyValues, [{ score: 0, enabled: false, display_name: '' }]);
      assert(err.message.indexOf('"score":0') !== -1);
      assert(err.message.indexOf('"enabled":false') !== -1);
      assert(err.message.indexOf('"display_name":""') !== -1);
      return done();
    });
  });

  it('escapes newlines in values so the diagnostic stays on one log line', function(done) {
    model.create({ name: 'first\nsecond' }).exec(function(err) {
      assert.strictEqual(err.code, 'E_UNIQUE');
      assert.strictEqual(err.message.indexOf('\n'), -1);
      assert(err.message.indexOf('first\\nsecond') !== -1);
      return done();
    });
  });

  it('does not invent values for keys absent from an update', function(done) {
    model.update({ name: 'original' }, { score: 1 }).exec(function(err) {
      assert.strictEqual(err.code, 'E_UNIQUE');
      assert.deepStrictEqual(err.keyValues, [{}]);
      assert(err.message.indexOf('Keys: ["display_name"].') !== -1);
      assert(err.message.indexOf('Conflicting values were not supplied') !== -1);
      assert.strictEqual(err.message.indexOf('original'), -1);
      return done();
    });
  });

  it('preserves E_UNIQUE when the adapter supplies no keys', function(done) {
    keys = [];
    model.create({ name: 'duplicate', privateNote: 'do-not-log-this' }).exec(function(err) {
      assert.strictEqual(err.code, 'E_UNIQUE');
      assert.deepStrictEqual(err.attrNames, []);
      assert.deepStrictEqual(err.keys, []);
      assert.deepStrictEqual(err.keyValues, [{}]);
      assert(err.message.indexOf('Conflicting values were not supplied') !== -1);
      assert.strictEqual(err.message.indexOf('do-not-log-this'), -1);
      return done();
    });
  });
});
