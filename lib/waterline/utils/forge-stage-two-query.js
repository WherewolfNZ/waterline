/**
 * Module dependencies
 */

var util = require('util');
var _ = require('lodash');
var flaverr = require('flaverr');
var normalizePkValues = require('./normalize-pk-values');
var normalizeCriteria = require('./normalize-criteria');


/**
 * forgeStageTwoQuery()
 *
 * Normalize and validate userland query options (called a "stage 1 query" -- see `ARCHITECTURE.md`)
 * i.e. these are things like `criteria` or `populates` that are passed in, either explicitly or
 * implicitly, to a static model method (fka "collection method") such as `.find()`.
 *
 * > This DOES NOT RETURN ANYTHING!  Instead, it modifies the provided "stage 1 query" in-place.
 * > And when this is finished, the provided "stage 1 query" will be a normalized, validated
 * > "stage 2 query" - aka logical protostatement.
 *
 *
 * @param {Dictionary} query   [A stage 1 query to destructively mutate into a stage 2 query.]
 *   | @property {String} method
 *   | @property {Dictionary} meta
 *   | @property {String} using
 *   |
 *   |...PLUS a number of other potential properties, depending on the "method". (see below)
 *
 * @param {Ref} orm
 *        The Waterline ORM instance.
 *        > Useful for accessing the model definitions.
 *
 *
 * @throws {Error} If it encounters irrecoverable problems or deprecated usage in the provided query opts.
 * @throws {Error} If anything else unexpected occurs
 */
module.exports = function forgeStageTwoQuery(query, orm) {


  //   ██████╗██╗  ██╗███████╗ ██████╗██╗  ██╗    ████████╗██╗  ██╗███████╗
  //  ██╔════╝██║  ██║██╔════╝██╔════╝██║ ██╔╝    ╚══██╔══╝██║  ██║██╔════╝
  //  ██║     ███████║█████╗  ██║     █████╔╝        ██║   ███████║█████╗
  //  ██║     ██╔══██║██╔══╝  ██║     ██╔═██╗        ██║   ██╔══██║██╔══╝
  //  ╚██████╗██║  ██║███████╗╚██████╗██║  ██╗       ██║   ██║  ██║███████╗
  //   ╚═════╝╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝       ╚═╝   ╚═╝  ╚═╝╚══════╝
  //
  //  ███████╗███████╗███████╗███████╗███╗   ██╗████████╗██╗ █████╗ ██╗     ███████╗
  //  ██╔════╝██╔════╝██╔════╝██╔════╝████╗  ██║╚══██╔══╝██║██╔══██╗██║     ██╔════╝
  //  █████╗  ███████╗███████╗█████╗  ██╔██╗ ██║   ██║   ██║███████║██║     ███████╗
  //  ██╔══╝  ╚════██║╚════██║██╔══╝  ██║╚██╗██║   ██║   ██║██╔══██║██║     ╚════██║
  //  ███████╗███████║███████║███████╗██║ ╚████║   ██║   ██║██║  ██║███████╗███████║
  //  ╚══════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝



  //  ┌─┐┬ ┬┌─┐┌─┐┬┌─  ╔╦╗╔═╗╔╦╗╔═╗    ┌─  ┬┌─┐  ┌─┐┬─┐┌─┐┬  ┬┬┌┬┐┌─┐┌┬┐  ─┐
  //  │  ├─┤├┤ │  ├┴┐  ║║║║╣  ║ ╠═╣    │   │├┤   ├─┘├┬┘│ │└┐┌┘│ ││├┤  ││   │
  //  └─┘┴ ┴└─┘└─┘┴ ┴  ╩ ╩╚═╝ ╩ ╩ ╩    └─  ┴└    ┴  ┴└─└─┘ └┘ ┴─┴┘└─┘─┴┘  ─┘
  // If specified, check `meta`.
  if (!_.isUndefined(query.meta)) {

    if (!_.isObject(query.meta) || _.isArray(query.meta) || _.isFunction(query.meta)) {
      throw new Error(
        'If `meta` is provided, it should be a dictionary (i.e. a plain JavaScript object).'+
        '  But instead, got: ' + util.inspect(query.meta, {depth:null})
      );
    }

  }//>-•


  //  ┌─┐┬ ┬┌─┐┌─┐┬┌─  ╦ ╦╔═╗╦╔╗╔╔═╗
  //  │  ├─┤├┤ │  ├┴┐  ║ ║╚═╗║║║║║ ╦
  //  └─┘┴ ┴└─┘└─┘┴ ┴  ╚═╝╚═╝╩╝╚╝╚═╝
  // Always check `using`.
  if (!_.isString(query.using) || query.using === '') {
    throw new Error(
      'Consistency violation: Every stage 1 query should include a property called `using` as a non-empty string.'+
      '  But instead, got: ' + util.inspect(query.using, {depth:null})
    );
  }//-•

  // Look up model definition.
  var modelDef = orm.collections[query.using];
  if (!modelDef) {
    throw new Error('Consistency violation: The specified `using` ("'+query.using+'") does not match the identity of any registered model.');
  }



  //  ┌─┐┬ ┬┌─┐┌─┐┬┌─  ╔╦╗╔═╗╔╦╗╦ ╦╔═╗╔╦╗
  //  │  ├─┤├┤ │  ├┴┐  ║║║║╣  ║ ╠═╣║ ║ ║║
  //  └─┘┴ ┴└─┘└─┘┴ ┴  ╩ ╩╚═╝ ╩ ╩ ╩╚═╝═╩╝
  //   ┬   ┌─┐┬ ┬┌─┐┌─┐┬┌─  ┌─┐┌─┐┬─┐  ┌─┐─┐ ┬┌┬┐┬─┐┌─┐┌┐┌┌─┐┌─┐┬ ┬┌─┐  ┬┌─┌─┐┬ ┬┌─┐
  //  ┌┼─  │  ├─┤├┤ │  ├┴┐  ├┤ │ │├┬┘  ├┤ ┌┴┬┘ │ ├┬┘├─┤│││├┤ │ ││ │└─┐  ├┴┐├┤ └┬┘└─┐
  //  └┘   └─┘┴ ┴└─┘└─┘┴ ┴  └  └─┘┴└─  └─┘┴ └─ ┴ ┴└─┴ ┴┘└┘└─┘└─┘└─┘└─┘  ┴ ┴└─┘ ┴ └─┘┘
  //  ┌─┐┬─┐  ┌┬┐┬┌─┐┌─┐┬┌┐┌┌─┐  ┌┬┐┌─┐┌┐┌┌┬┐┌─┐┌┬┐┌─┐┬─┐┬ ┬  ┬┌─┌─┐┬ ┬┌─┐
  //  │ │├┬┘  ││││└─┐└─┐│││││ ┬  │││├─┤│││ ││├─┤ │ │ │├┬┘└┬┘  ├┴┐├┤ └┬┘└─┐
  //  └─┘┴└─  ┴ ┴┴└─┘└─┘┴┘└┘└─┘  ┴ ┴┴ ┴┘└┘─┴┘┴ ┴ ┴ └─┘┴└─ ┴   ┴ ┴└─┘ ┴ └─┘
  // Always check `method`.
  if (!_.isString(query.method) || query.method === '') {
    throw new Error(
      'Consistency violation: Every stage 1 query should include a property called `method` as a non-empty string.'+
      '  But instead, got: ' + util.inspect(query.method, {depth:null})
    );
  }//-•


  // Check that we recognize the specified `method`, and that mandatory keys are present.
  var additionalMandatoryKeys = (function _getAdditionalMandatoryKeys (){

    switch(query.method) {

      case 'find':                 return [ 'criteria', 'populates' ];
      case 'findOne':              return [ 'criteria', 'populates' ];
      case 'count':                return [ 'criteria' ];
      case 'sum':                  return [ 'criteria', 'numericAttrName' ];
      case 'avg':                  return [ 'criteria', 'numericAttrName' ];
      case 'stream':               return [ 'criteria', 'eachRecordfn', 'eachBatchFn' ];

      case 'create':               return [ 'newRecord' ];
      case 'createEach':           return [ 'newRecords' ];

      case 'update':               return [ 'criteria', 'valuesToSet' ];
      case 'destroy':              return [ 'criteria' ];
      case 'addToCollection':      return [ 'targetRecordIds', 'collectionAttrName', 'associatedIds' ];
      case 'removeFromCollection': return [ 'targetRecordIds', 'collectionAttrName', 'associatedIds' ];
      case 'replaceCollection':    return [ 'targetRecordIds', 'collectionAttrName', 'associatedIds' ];

      default:
        throw new Error('Consistency violation: Unrecognized `method` ("'+query.method+'")');

    }

  })();//</self-calling function :: _getAdditionalMandatoryKeys()>


  var missingKeys = _.difference(additionalMandatoryKeys, _.keys(query));
  if (missingKeys.length > 0) {
    throw new Error('Consistency violation: Missing mandatory keys: '+missingKeys);
  }


  // Now check that we see ONLY the expected keys for that method.
  // (i.e. there should never be any miscellaneous stuff hanging out on the stage1 query dictionary)

  // We start off by building up an array of legal keys, starting with the universally-legal ones.
  var allowedKeys = [
    'meta',
    'using',
    'method'
  ].concat(additionalMandatoryKeys);


  // Then finally, we check that no extraneous keys are present.
  var extraneousKeys = _.difference(_.keys(query), allowedKeys);
  if (extraneousKeys.length > 0) {
    throw new Error('Consistency violation: Contains extraneous keys: '+extraneousKeys);
  }





  //   ██████╗██████╗ ██╗████████╗███████╗██████╗ ██╗ █████╗
  //  ██╔════╝██╔══██╗██║╚══██╔══╝██╔════╝██╔══██╗██║██╔══██╗
  //  ██║     ██████╔╝██║   ██║   █████╗  ██████╔╝██║███████║
  //  ██║     ██╔══██╗██║   ██║   ██╔══╝  ██╔══██╗██║██╔══██║
  //  ╚██████╗██║  ██║██║   ██║   ███████╗██║  ██║██║██║  ██║
  //   ╚═════╝╚═╝  ╚═╝╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝
  //

  if (!_.isUndefined(query.criteria)) {

    // Assert that `criteria` is a dictionary.
    if (!_.isPlainObject(query.criteria)) {
      throw flaverr('E_INVALID_CRITERIA', new Error(
        '`criteria` must be a dictionary.  But instead, got: '+util.inspect(query.criteria, {depth: null})
      ));
    }//-•

    // Try to normalize populate criteria somewhat
    try {
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // TODO: get in there and finish all the cases
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      query.criteria = normalizeCriteria(query.criteria);
    } catch (e) {
      switch (e.code) {
        case 'E_INVALID':
          throw flaverr('E_INVALID_CRITERIA', new Error('Failed to normalize provided criteria: '+e.message));
        default:
          throw e;
      }
    }//>-•

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // < additional validation / normalization >
    // TODO: pull this stuff into the `normalizeCriteria()`  utility
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // Validate/normalize `select` clause.
    if (!_.isUndefined(query.criteria.select)) {
      // TODO: tolerant validation
    }
    // Otherwise, if no `select` clause was provided, give it a default value.
    else {
      query.criteria.select = ['*'];
    }

    // Validate/normalize `omit` clause.
    if (!_.isUndefined(query.criteria.omit)) {
      // TODO: tolerant validation
    }
    // Otherwise, if no `omit` clause was provided, give it a default value.
    else {
      query.criteria.omit = [];
    }

    // Validate/normalize `where` clause.
    if (!_.isUndefined(query.criteria.where)) {
      // TODO: tolerant validation
    }
    // Otherwise, if no `where` clause was provided, give it a default value.
    else {
      query.criteria.where = {};
    }

    // Validate/normalize `limit` clause.
    if (!_.isUndefined(query.criteria.limit)) {
      // TODO: tolerant validation
    }
    // Otherwise, if no `limit` clause was provided, give it a default value.
    else {
      query.criteria.limit = Number.MAX_SAFE_INTEGER;
    }

    // Validate/normalize `skip` clause.
    if (!_.isUndefined(query.criteria.skip)) {
      // TODO: tolerant validation
    }
    // Otherwise, if no `skip` clause was provided, give it a default value.
    else {
      query.criteria.skip = 0;
    }

    // Validate/normalize `sort` clause.
    if (!_.isUndefined(query.criteria.sort)) {
      // TODO: tolerant validation
    }
    // Otherwise, if no `sort` clause was provided, give it a default value.
    else {
      query.criteria.sort = Number.MAX_SAFE_INTEGER;
    }


    // For compatibility, tolerate the presence of a `.populates` on the criteria dictionary (but scrub that sucker off right away).
    delete query.criteria.populates;

    // Ensure there aren't any extraneous properties.
    // TODO

    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    // </ additional validation / normalization >
    // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  }//>-•





  //  ██████╗  ██████╗ ██████╗ ██╗   ██╗██╗      █████╗ ████████╗███████╗███████╗
  //  ██╔══██╗██╔═══██╗██╔══██╗██║   ██║██║     ██╔══██╗╚══██╔══╝██╔════╝██╔════╝
  //  ██████╔╝██║   ██║██████╔╝██║   ██║██║     ███████║   ██║   █████╗  ███████╗
  //  ██╔═══╝ ██║   ██║██╔═══╝ ██║   ██║██║     ██╔══██║   ██║   ██╔══╝  ╚════██║
  //  ██║     ╚██████╔╝██║     ╚██████╔╝███████╗██║  ██║   ██║   ███████╗███████║
  //  ╚═╝      ╚═════╝ ╚═╝      ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚══════╝
  //

  if (!_.isUndefined(query.populates)) {

    // Assert that `populates` is a dictionary.
    if (!_.isPlainObject(query.populates)) {
      throw flaverr('E_INVALID_POPULATES', new Error(
        '`populates` must be a dictionary.  But instead, got: '+util.inspect(query.populates, {depth: null})
      ));
    }//-•

    // Ensure each populate value is fully formed
    _.each(_.keys(query.populates), function(populateAttributeName) {

      // Get a reference to the RHS for this particular populate criteria.
      // (This is just for convenience below.)
      var populateCriteria = query.populates[populateAttributeName];

      // Assert that this populate's criteria is a dictionary.
      if (!_.isPlainObject(populateCriteria)) {
        throw flaverr('E_INVALID_POPULATES', new Error(
          'The RHS of every key in `populates` should always be a dictionary, but was not the case this time.  The criteria for populating `'+populateAttributeName+'` is invalid-- instead of a dictionary, got: '+util.inspect(populateCriteria, {depth: null})
        ));
      }//-•

      // Try to normalize populate criteria somewhat
      try {
        // - - - - - - - - - - - - - - - - - - - - - - - - - - - -
        // TODO: get in there and finish all the cases
        // - - - - - - - - - - - - - - - - - - - - - - - - - - - -
        query.populates[populateAttributeName] = normalizeCriteria(populateCriteria);
      } catch (e) {
        switch (e.code) {
          case 'E_INVALID':
            throw flaverr('E_INVALID_POPULATES', new Error('Failed to normalize criteria provided for populating `'+populateAttributeName+'`: '+e.message));
          default:
            throw e;
        }
      }//>-•

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // < additional validation / normalization >
      // TODO: pull this stuff into the `normalizeCriteria()`  utility
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

      // Validate/normalize `select` clause.
      if (!_.isUndefined(populateCriteria.select)) {
        // TODO: tolerant validation
      }
      // Otherwise, if no `select` clause was provided, give it a default value.
      else {
        populateCriteria.select = ['*'];
      }

      // Validate/normalize `omit` clause.
      if (!_.isUndefined(populateCriteria.omit)) {
        // TODO: tolerant validation
      }
      // Otherwise, if no `omit` clause was provided, give it a default value.
      else {
        populateCriteria.omit = [];
      }

      // Validate/normalize `where` clause.
      if (!_.isUndefined(populateCriteria.where)) {
        // TODO: tolerant validation
      }
      // Otherwise, if no `where` clause was provided, give it a default value.
      else {
        populateCriteria.where = {};
      }

      // Validate/normalize `limit` clause.
      if (!_.isUndefined(populateCriteria.limit)) {
        // TODO: tolerant validation
      }
      // Otherwise, if no `limit` clause was provided, give it a default value.
      else {
        populateCriteria.limit = Number.MAX_SAFE_INTEGER;
      }

      // Validate/normalize `skip` clause.
      if (!_.isUndefined(populateCriteria.skip)) {
        // TODO: tolerant validation
      }
      // Otherwise, if no `skip` clause was provided, give it a default value.
      else {
        populateCriteria.skip = 0;
      }

      // Validate/normalize `sort` clause.
      if (!_.isUndefined(populateCriteria.sort)) {
        // TODO: tolerant validation
      }
      // Otherwise, if no `sort` clause was provided, give it a default value.
      else {
        populateCriteria.sort = Number.MAX_SAFE_INTEGER;
      }

      // Ensure there are no extraneous properties.
      // TODO

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
      // </ additional validation / normalization >
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

    });//</_.each() key in the `populates` dictionary>

  }//>-•









  //  ███╗   ██╗██╗   ██╗███╗   ███╗███████╗██████╗ ██╗ ██████╗
  //  ████╗  ██║██║   ██║████╗ ████║██╔════╝██╔══██╗██║██╔════╝
  //  ██╔██╗ ██║██║   ██║██╔████╔██║█████╗  ██████╔╝██║██║
  //  ██║╚██╗██║██║   ██║██║╚██╔╝██║██╔══╝  ██╔══██╗██║██║
  //  ██║ ╚████║╚██████╔╝██║ ╚═╝ ██║███████╗██║  ██║██║╚██████╗
  //  ╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝╚═╝ ╚═════╝
  //
  //   █████╗ ████████╗████████╗██████╗     ███╗   ██╗ █████╗ ███╗   ███╗███████╗
  //  ██╔══██╗╚══██╔══╝╚══██╔══╝██╔══██╗    ████╗  ██║██╔══██╗████╗ ████║██╔════╝
  //  ███████║   ██║      ██║   ██████╔╝    ██╔██╗ ██║███████║██╔████╔██║█████╗
  //  ██╔══██║   ██║      ██║   ██╔══██╗    ██║╚██╗██║██╔══██║██║╚██╔╝██║██╔══╝
  //  ██║  ██║   ██║      ██║   ██║  ██║    ██║ ╚████║██║  ██║██║ ╚═╝ ██║███████╗
  //  ╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚═╝  ╚═╝    ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝
  //
  if (!_.isUndefined(query.numericAttrName)) {

    if (!_.isString(query.numericAttrName)) {
      throw flaverr('E_INVALID_NUMERIC_ATTR_NAME', new Error('Instead of a string, got: '+util.inspect(query.numericAttrName,{depth:null})));
    }

    // Look up the attribute by name, using the model definition.
    var attrDef = modelDef.attributes[query.numericAttrName];

    // Validate that an attribute by this name actually exists in this model definition.
    if (!attrDef) {
      throw flaverr('E_INVALID_NUMERIC_ATTR_NAME', new Error('There is no attribute named `'+query.numericAttrName+'` defined in this model.'));
    }

    // Validate that the attribute with this name is a number.
    if (attrDef.type !== 'number') {
      throw flaverr('E_INVALID_NUMERIC_ATTR_NAME', new Error('The attribute named `'+query.numericAttrName+'` defined in this model is not guaranteed to be a number (it should declare `type: \'number\'`).'));
    }

  }//>-•





  //  ███████╗ █████╗  ██████╗██╗  ██╗    ██████╗ ███████╗ ██████╗ ██████╗ ██████╗ ██████╗
  //  ██╔════╝██╔══██╗██╔════╝██║  ██║    ██╔══██╗██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗
  //  █████╗  ███████║██║     ███████║    ██████╔╝█████╗  ██║     ██║   ██║██████╔╝██║  ██║
  //  ██╔══╝  ██╔══██║██║     ██╔══██║    ██╔══██╗██╔══╝  ██║     ██║   ██║██╔══██╗██║  ██║
  //  ███████╗██║  ██║╚██████╗██║  ██║    ██║  ██║███████╗╚██████╗╚██████╔╝██║  ██║██████╔╝
  //  ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝
  //
  //   ██╗███████╗███╗   ██╗██╗
  //  ██╔╝██╔════╝████╗  ██║╚██╗
  //  ██║ █████╗  ██╔██╗ ██║ ██║
  //  ██║ ██╔══╝  ██║╚██╗██║ ██║
  //  ╚██╗██║     ██║ ╚████║██╔╝
  //   ╚═╝╚═╝     ╚═╝  ╚═══╝╚═╝
  //
  if (!_.isUndefined(query.eachRecordFn)) {

    if (!_.isFunction(query.eachRecordFn)) {
      throw flaverr('E_INVALID_EACH_RECORD_FN', new Error('Instead of a function, got: '+util.inspect(query.eachRecordFn,{depth:null})));
    }

  }//>-•





  //  ███████╗ █████╗  ██████╗██╗  ██╗    ██████╗  █████╗ ████████╗ ██████╗██╗  ██╗
  //  ██╔════╝██╔══██╗██╔════╝██║  ██║    ██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██║  ██║
  //  █████╗  ███████║██║     ███████║    ██████╔╝███████║   ██║   ██║     ███████║
  //  ██╔══╝  ██╔══██║██║     ██╔══██║    ██╔══██╗██╔══██║   ██║   ██║     ██╔══██║
  //  ███████╗██║  ██║╚██████╗██║  ██║    ██████╔╝██║  ██║   ██║   ╚██████╗██║  ██║
  //  ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝
  //
  //   ██╗███████╗███╗   ██╗██╗
  //  ██╔╝██╔════╝████╗  ██║╚██╗
  //  ██║ █████╗  ██╔██╗ ██║ ██║
  //  ██║ ██╔══╝  ██║╚██╗██║ ██║
  //  ╚██╗██║     ██║ ╚████║██╔╝
  //   ╚═╝╚═╝     ╚═╝  ╚═══╝╚═╝
  //
  if (!_.isUndefined(query.eachBatchFn)) {

    if (!_.isFunction(query.eachBatchFn)) {
      throw flaverr('E_INVALID_EACH_BATCH_FN', new Error('Instead of a function, got: '+util.inspect(query.eachBatchFn,{depth:null})));
    }

  }//>-•




  //  ███╗   ██╗███████╗██╗    ██╗    ██████╗ ███████╗ ██████╗ ██████╗ ██████╗ ██████╗
  //  ████╗  ██║██╔════╝██║    ██║    ██╔══██╗██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗
  //  ██╔██╗ ██║█████╗  ██║ █╗ ██║    ██████╔╝█████╗  ██║     ██║   ██║██████╔╝██║  ██║
  //  ██║╚██╗██║██╔══╝  ██║███╗██║    ██╔══██╗██╔══╝  ██║     ██║   ██║██╔══██╗██║  ██║
  //  ██║ ╚████║███████╗╚███╔███╔╝    ██║  ██║███████╗╚██████╗╚██████╔╝██║  ██║██████╔╝
  //  ╚═╝  ╚═══╝╚══════╝ ╚══╝╚══╝     ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝
  //
  if (!_.isUndefined(query.newRecord)) {

    if (!_.isObject(query.newRecord) || _.isFunction(query.newRecord) || _.isArray(query.newRecord)) {
      throw flaverr('E_INVALID_NEW_RECORD', new Error('Expecting a dictionary (plain JavaScript object) but instead, got: '+util.inspect(query.newRecord,{depth:null})));
    }


    // TODO: more

  }//>-•





  //  ███╗   ██╗███████╗██╗    ██╗    ██████╗ ███████╗ ██████╗ ██████╗ ██████╗ ██████╗ ███████╗
  //  ████╗  ██║██╔════╝██║    ██║    ██╔══██╗██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗██╔════╝
  //  ██╔██╗ ██║█████╗  ██║ █╗ ██║    ██████╔╝█████╗  ██║     ██║   ██║██████╔╝██║  ██║███████╗
  //  ██║╚██╗██║██╔══╝  ██║███╗██║    ██╔══██╗██╔══╝  ██║     ██║   ██║██╔══██╗██║  ██║╚════██║
  //  ██║ ╚████║███████╗╚███╔███╔╝    ██║  ██║███████╗╚██████╗╚██████╔╝██║  ██║██████╔╝███████║
  //  ╚═╝  ╚═══╝╚══════╝ ╚══╝╚══╝     ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ ╚══════╝
  //
  if (!_.isUndefined(query.newRecords)) {

    if (!_.isArray(query.newRecords)) {
      throw flaverr('E_INVALID_NEW_RECORDS', new Error('Expecting an array but instead, got: '+util.inspect(query.newRecords,{depth:null})));
    }

    _.each(query.newRecords, function (newRecord){

      if (!_.isObject(newRecord) || _.isFunction(newRecord) || _.isArray(newRecord)) {
        throw flaverr('E_INVALID_NEW_RECORDS', new Error('Expecting an array of dictionaries (plain JavaScript objects) but one of the items in the provided array is invalid.  Instead of a dictionary, got: '+util.inspect(newRecord,{depth:null})));
      }

      // TODO: more

    });//</_.each()>

  }//>-•






  //  ██╗   ██╗ █████╗ ██╗     ██╗   ██╗███████╗███████╗
  //  ██║   ██║██╔══██╗██║     ██║   ██║██╔════╝██╔════╝
  //  ██║   ██║███████║██║     ██║   ██║█████╗  ███████╗
  //  ╚██╗ ██╔╝██╔══██║██║     ██║   ██║██╔══╝  ╚════██║
  //   ╚████╔╝ ██║  ██║███████╗╚██████╔╝███████╗███████║
  //    ╚═══╝  ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚══════╝╚══════╝
  //
  //  ████████╗ ██████╗     ███████╗███████╗████████╗
  //  ╚══██╔══╝██╔═══██╗    ██╔════╝██╔════╝╚══██╔══╝
  //     ██║   ██║   ██║    ███████╗█████╗     ██║
  //     ██║   ██║   ██║    ╚════██║██╔══╝     ██║
  //     ██║   ╚██████╔╝    ███████║███████╗   ██║
  //     ╚═╝    ╚═════╝     ╚══════╝╚══════╝   ╚═╝
  //
  if (!_.isUndefined(query.valuesToSet)) {

    if (!_.isObject(query.valuesToSet) || _.isFunction(query.valuesToSet) || _.isArray(query.valuesToSet)) {
      throw flaverr('E_INVALID_VALUES_TO_SET', new Error('Expecting a dictionary (plain JavaScript object) but instead, got: '+util.inspect(query.valuesToSet,{depth:null})));
    }

    // TODO: more

  }//>-•






  //  ████████╗ █████╗ ██████╗  ██████╗ ███████╗████████╗
  //  ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝ ██╔════╝╚══██╔══╝
  //     ██║   ███████║██████╔╝██║  ███╗█████╗     ██║
  //     ██║   ██╔══██║██╔══██╗██║   ██║██╔══╝     ██║
  //     ██║   ██║  ██║██║  ██║╚██████╔╝███████╗   ██║
  //     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝
  //
  //  ██████╗ ███████╗ ██████╗ ██████╗ ██████╗ ██████╗     ██╗██████╗ ███████╗
  //  ██╔══██╗██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗    ██║██╔══██╗██╔════╝
  //  ██████╔╝█████╗  ██║     ██║   ██║██████╔╝██║  ██║    ██║██║  ██║███████╗
  //  ██╔══██╗██╔══╝  ██║     ██║   ██║██╔══██╗██║  ██║    ██║██║  ██║╚════██║
  //  ██║  ██║███████╗╚██████╗╚██████╔╝██║  ██║██████╔╝    ██║██████╔╝███████║
  //  ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝     ╚═╝╚═════╝ ╚══════╝
  //
  if (!_.isUndefined(query.targetRecordIds)) {

    //  ┬  ┬┌─┐┬  ┬┌┬┐┌─┐┌┬┐┌─┐  ┌┬┐┌─┐┬─┐┌─┐┌─┐┌┬┐  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐  ┬┌┬┐┌─┐
    //  └┐┌┘├─┤│  │ ││├─┤ │ ├┤    │ ├─┤├┬┘│ ┬├┤  │   ├┬┘├┤ │  │ │├┬┘ ││  │ ││└─┐
    //   └┘ ┴ ┴┴─┘┴─┴┘┴ ┴ ┴ └─┘   ┴ ┴ ┴┴└─└─┘└─┘ ┴   ┴└─└─┘└─┘└─┘┴└──┴┘  ┴─┴┘└─┘
    // Normalize (and validate) the specified target record pk values.
    // (if a singular string or number was provided, this converts it into an array.)
    try {
      query.targetRecordIds = normalizePkValues(query.targetRecordIds);
    } catch(e) {
      switch (e.code) {
        case 'E_INVALID_PK_VALUES':
          throw flaverr('E_INVALID_TARGET_RECORD_IDS', new Error('Invalid primary key value(s): '+e.message));
        default:
          throw e;
      }
    }//< / catch : normalizePkValues >


  }//>-•








  //   ██████╗ ██████╗ ██╗     ██╗     ███████╗ ██████╗████████╗██╗ ██████╗ ███╗   ██╗
  //  ██╔════╝██╔═══██╗██║     ██║     ██╔════╝██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
  //  ██║     ██║   ██║██║     ██║     █████╗  ██║        ██║   ██║██║   ██║██╔██╗ ██║
  //  ██║     ██║   ██║██║     ██║     ██╔══╝  ██║        ██║   ██║██║   ██║██║╚██╗██║
  //  ╚██████╗╚██████╔╝███████╗███████╗███████╗╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
  //   ╚═════╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
  //
  //   █████╗ ████████╗████████╗██████╗     ███╗   ██╗ █████╗ ███╗   ███╗███████╗
  //  ██╔══██╗╚══██╔══╝╚══██╔══╝██╔══██╗    ████╗  ██║██╔══██╗████╗ ████║██╔════╝
  //  ███████║   ██║      ██║   ██████╔╝    ██╔██╗ ██║███████║██╔████╔██║█████╗
  //  ██╔══██║   ██║      ██║   ██╔══██╗    ██║╚██╗██║██╔══██║██║╚██╔╝██║██╔══╝
  //  ██║  ██║   ██║      ██║   ██║  ██║    ██║ ╚████║██║  ██║██║ ╚═╝ ██║███████╗
  //  ╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚═╝  ╚═╝    ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝
  //
  if (!_.isUndefined(query.collectionAttrName)) {

    //  ╦  ╦╔═╗╦  ╦╔╦╗╔═╗╔╦╗╔═╗  ┌─┐┌─┐┌─┐┌─┐┌─┐┬┌─┐┌┬┐┬┌─┐┌┐┌  ┌┐┌┌─┐┌┬┐┌─┐
    //  ╚╗╔╝╠═╣║  ║ ║║╠═╣ ║ ║╣   ├─┤└─┐└─┐│ ││  │├─┤ │ ││ ││││  │││├─┤│││├┤
    //   ╚╝ ╩ ╩╩═╝╩═╩╝╩ ╩ ╩ ╚═╝  ┴ ┴└─┘└─┘└─┘└─┘┴┴ ┴ ┴ ┴└─┘┘└┘  ┘└┘┴ ┴┴ ┴└─┘
    //  ┌─    ┌─┐┌─┐┬─┐  ┌─┐  ╔═╗╔═╗╦  ╦  ╔═╗╔═╗╔╦╗╦╔═╗╔╗╔  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔    ─┐
    //  │───  ├┤ │ │├┬┘  ├─┤  ║  ║ ║║  ║  ║╣ ║   ║ ║║ ║║║║  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║  ───│
    //  └─    └  └─┘┴└─  ┴ ┴  ╚═╝╚═╝╩═╝╩═╝╚═╝╚═╝ ╩ ╩╚═╝╝╚╝  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝    ─┘
    //
    // Validate association name.
    if (!_.isString(query.collectionAttrName)) {
      throw flaverr('E_INVALID_COLLECTION_ATTR_NAME', new Error('Instead of a string, got: '+util.inspect(query.collectionAttrName,{depth:null})));
    }

    // Look up the association by this name in this model definition.
    var associationDef = modelDef.attributes[query.collectionAttrName];

    // Validate that an association by this name actually exists in this model definition.
    if (!associationDef) {
      throw flaverr('E_INVALID_COLLECTION_ATTR_NAME', new Error('There is no attribute named `'+query.collectionAttrName+'` defined in this model.'));
    }

    // Validate that the association with this name is a collection association.
    if (!associationDef.collection) {
      throw flaverr('E_INVALID_COLLECTION_ATTR_NAME', new Error('The attribute named `'+query.collectionAttrName+'` defined in this model is not a collection association.'));
    }

  }//>-•









  //   █████╗ ███████╗███████╗ ██████╗  ██████╗██╗ █████╗ ████████╗███████╗██████╗
  //  ██╔══██╗██╔════╝██╔════╝██╔═══██╗██╔════╝██║██╔══██╗╚══██╔══╝██╔════╝██╔══██╗
  //  ███████║███████╗███████╗██║   ██║██║     ██║███████║   ██║   █████╗  ██║  ██║
  //  ██╔══██║╚════██║╚════██║██║   ██║██║     ██║██╔══██║   ██║   ██╔══╝  ██║  ██║
  //  ██║  ██║███████║███████║╚██████╔╝╚██████╗██║██║  ██║   ██║   ███████╗██████╔╝
  //  ╚═╝  ╚═╝╚══════╝╚══════╝ ╚═════╝  ╚═════╝╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═════╝
  //
  //  ██╗██████╗ ███████╗
  //  ██║██╔══██╗██╔════╝
  //  ██║██║  ██║███████╗
  //  ██║██║  ██║╚════██║
  //  ██║██████╔╝███████║
  //  ╚═╝╚═════╝ ╚══════╝
  //
  if (!_.isUndefined(query.associatedIds)) {

    //  ┬  ┬┌─┐┬  ┬┌┬┐┌─┐┌┬┐┌─┐  ┌─┐┌─┐┌─┐┌─┐┌─┐┬┌─┐┌┬┐┌─┐┌┬┐  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐  ┬┌┬┐┌─┐
    //  └┐┌┘├─┤│  │ ││├─┤ │ ├┤   ├─┤└─┐└─┐│ ││  │├─┤ │ ├┤  ││  ├┬┘├┤ │  │ │├┬┘ ││  │ ││└─┐
    //   └┘ ┴ ┴┴─┘┴─┴┘┴ ┴ ┴ └─┘  ┴ ┴└─┘└─┘└─┘└─┘┴┴ ┴ ┴ └─┘─┴┘  ┴└─└─┘└─┘└─┘┴└──┴┘  ┴─┴┘└─┘
    // Validate the provided set of associated record ids.
    // (if a singular string or number was provided, this converts it into an array.)
    try {
      query.associatedIds = normalizePkValues(query.associatedIds);
    } catch(e) {
      switch (e.code) {
        case 'E_INVALID_PK_VALUES':
          throw flaverr('E_INVALID_ASSOCIATED_IDS', new Error('Invalid primary key value(s): '+e.message));
        default:
          throw e;
      }
    }//< / catch :: normalizePkValues >

  }//>-•



  // --
  // The provided "stage 1 query" is now a logical protostatement ("stage 2 query").
  //
  // Do not return anything.
  return;

};