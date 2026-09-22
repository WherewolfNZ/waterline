var assert = require('assert');
var Waterline = require('../../../lib/waterline');

//  Build a fresh ORM whose `user` model uses the given `beforeUpdate` implementation.
//
//  Returns a context object straight away; it is populated by the time `done` fires.
//  `lastQuery` holds the stage-3 query the adapter received, so a test can assert on
//  what actually reached the adapter rather than only on what came back.
function buildOrm(beforeUpdate, done) {
  var context = { person: undefined, lastQuery: undefined };
  var waterline = new Waterline();

  var Model = Waterline.Model.extend({
    identity: 'user',
    datastore: 'foo',
    primaryKey: 'id',
    fetchRecordsOnUpdate: true,
    attributes: {
      id: {
        type: 'number'
      },
      name: {
        type: 'string'
      }
    },

    beforeUpdate: beforeUpdate
  });

  waterline.registerModel(Model);

  // Fixture Adapter Def
  var adapterDef = { update: function(con, query, cb) {
    context.lastQuery = query;
    return cb(null, [{ id: 1, name: query.valuesToSet.name }]);
  }};

  var connections = {
    'foo': {
      adapter: 'foobar'
    }
  };

  waterline.initialize({ adapters: { foobar: adapterDef }, datastores: connections }, function(err, orm) {
    if (err) {
      return done(err);
    }
    context.person = orm.collections.user;
    return done();
  });

  return context;
}

describe('Before Update Lifecycle Callback ::', function() {

  // A two-argument `beforeUpdate` is the long-standing signature, and models still
  // written that way must keep working untouched.
  describe('Update with a two-argument callback ::', function() {
    var ctx;
    var timesCalled;

    before(function(done) {
      ctx = buildOrm(function(valuesToSet, cb) {
        timesCalled++;
        valuesToSet.name = valuesToSet.name + ' updated';
        return cb();
      }, done);
    });

    beforeEach(function() {
      timesCalled = 0;
      ctx.lastQuery = undefined;
    });

    it('should run beforeUpdate and mutate values', function(done) {
      ctx.person.update({ id: 1 }, { name: 'test' }, function(err, records) {
        if (err) {
          return done(err);
        }

        assert.equal(timesCalled, 1);
        assert.equal(ctx.lastQuery.valuesToSet.name, 'test updated');
        assert.equal(records[0].name, 'test updated');
        return done();
      });
    });

    it('should not run beforeUpdate when skipAllLifecycleCallbacks is true', function(done) {
      ctx.person.update({ id: 1 }, { name: 'test' })
        .meta({ skipAllLifecycleCallbacks: true })
        .exec(function(err, records) {
          if (err) {
            return done(err);
          }

          assert.equal(timesCalled, 0);
          assert.equal(ctx.lastQuery.valuesToSet.name, 'test');
          assert.equal(records[0].name, 'test');
          return done();
        });
    });
  });

  // A three-argument `beforeUpdate` additionally receives an options dictionary
  // holding the query's criteria and meta.
  describe('Update with a three-argument callback ::', function() {
    var ctx;
    var timesCalled;
    var observedOptions;

    before(function(done) {
      ctx = buildOrm(function(valuesToSet, options, cb) {
        timesCalled++;
        observedOptions = options;
        valuesToSet.name = valuesToSet.name + ' updated';
        return cb();
      }, done);
    });

    beforeEach(function() {
      timesCalled = 0;
      observedOptions = undefined;
      ctx.lastQuery = undefined;
    });

    it('should run beforeUpdate and mutate values', function(done) {
      ctx.person.update({ id: 1 }, { name: 'test' }, function(err, records) {
        if (err) {
          return done(err);
        }

        assert.equal(timesCalled, 1);
        assert.equal(ctx.lastQuery.valuesToSet.name, 'test updated');
        assert.equal(records[0].name, 'test updated');
        return done();
      });
    });

    it('should receive an options dictionary as its second argument', function(done) {
      ctx.person.update({ id: 1 }, { name: 'test' }, function(err) {
        if (err) {
          return done(err);
        }

        assert(observedOptions);
        assert.deepEqual(Object.keys(observedOptions).sort(), ['criteria', 'meta']);
        return done();
      });
    });

    it('should receive the normalized criteria as options.criteria', function(done) {
      ctx.person.update({ id: 1 }, { name: 'test' }, function(err) {
        if (err) {
          return done(err);
        }

        assert.deepEqual(observedOptions.criteria.where, { id: 1 });
        return done();
      });
    });

    it('should receive a criteria whose where clause reflects a more complex query', function(done) {
      ctx.person.update({ name: { in: ['a', 'b'] } }, { name: 'test' }, function(err) {
        if (err) {
          return done(err);
        }

        assert.deepEqual(observedOptions.criteria.where, { name: { in: ['a', 'b'] } });
        return done();
      });
    });

    it('should receive the query meta as options.meta', function(done) {
      ctx.person.update({ id: 1 }, { name: 'test' })
        .meta({ myCustomFlag: 'yep' })
        .exec(function(err) {
          if (err) {
            return done(err);
          }

          assert(observedOptions.meta);
          assert.equal(observedOptions.meta.myCustomFlag, 'yep');
          return done();
        });
    });

    it('should receive the same criteria the adapter is then given', function(done) {
      ctx.person.update({ id: 1 }, { name: 'test' }, function(err) {
        if (err) {
          return done(err);
        }

        assert.deepEqual(observedOptions.criteria.where, ctx.lastQuery.criteria.where);
        return done();
      });
    });

    it('should not run beforeUpdate when skipAllLifecycleCallbacks is true', function(done) {
      ctx.person.update({ id: 1 }, { name: 'test' })
        .meta({ skipAllLifecycleCallbacks: true })
        .exec(function(err, records) {
          if (err) {
            return done(err);
          }

          assert.equal(timesCalled, 0);
          assert.equal(ctx.lastQuery.valuesToSet.name, 'test');
          assert.equal(records[0].name, 'test');
          return done();
        });
    });
  });

  describe('Update when a two-argument callback errors ::', function() {
    var ctx;

    before(function(done) {
      ctx = buildOrm(function(valuesToSet, cb) {
        return cb(new Error('Whoops, two-arg'));
      }, done);
    });

    it('should abort the update and surface the error', function(done) {
      ctx.person.update({ id: 1 }, { name: 'test' }, function(err) {
        assert(err);
        assert.equal(err.message, 'Whoops, two-arg');
        assert.equal(ctx.lastQuery, undefined, 'the adapter should never have been called');
        return done();
      });
    });
  });

  describe('Update when a three-argument callback errors ::', function() {
    var ctx;

    before(function(done) {
      ctx = buildOrm(function(valuesToSet, options, cb) {
        return cb(new Error('Whoops, three-arg'));
      }, done);
    });

    it('should abort the update and surface the error', function(done) {
      ctx.person.update({ id: 1 }, { name: 'test' }, function(err) {
        assert(err);
        assert.equal(err.message, 'Whoops, three-arg');
        assert.equal(ctx.lastQuery, undefined, 'the adapter should never have been called');
        return done();
      });
    });
  });

  describe('Update on a model with no beforeUpdate callback ::', function() {
    var ctx;

    before(function(done) {
      ctx = buildOrm(undefined, done);
    });

    it('should update normally', function(done) {
      ctx.person.update({ id: 1 }, { name: 'test' }, function(err, records) {
        if (err) {
          return done(err);
        }

        assert.equal(records[0].name, 'test');
        return done();
      });
    });
  });
});
