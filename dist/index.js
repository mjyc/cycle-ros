(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getGlobal() {
    var globalObj;
    if (typeof window !== 'undefined') {
        globalObj = window;
    }
    else if (typeof global !== 'undefined') {
        globalObj = global;
    }
    else {
        globalObj = this;
    }
    globalObj.Cyclejs = globalObj.Cyclejs || {};
    globalObj = globalObj.Cyclejs;
    globalObj.adaptStream = globalObj.adaptStream || (function (x) { return x; });
    return globalObj;
}
function setAdapt(f) {
    getGlobal().adaptStream = f;
}
exports.setAdapt = setAdapt;
function adapt(stream) {
    return getGlobal().adaptStream(stream);
}
exports.adapt = adapt;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var internals_1 = require("./internals");
/**
 * A function that prepares the Cycle application to be executed. Takes a `main`
 * function and prepares to circularly connects it to the given collection of
 * driver functions. As an output, `setup()` returns an object with three
 * properties: `sources`, `sinks` and `run`. Only when `run()` is called will
 * the application actually execute. Refer to the documentation of `run()` for
 * more details.
 *
 * **Example:**
 * ```js
 * import {setup} from '@cycle/run';
 * const {sources, sinks, run} = setup(main, drivers);
 * // ...
 * const dispose = run(); // Executes the application
 * // ...
 * dispose();
 * ```
 *
 * @param {Function} main a function that takes `sources` as input and outputs
 * `sinks`.
 * @param {Object} drivers an object where keys are driver names and values
 * are driver functions.
 * @return {Object} an object with three properties: `sources`, `sinks` and
 * `run`. `sources` is the collection of driver sources, `sinks` is the
 * collection of driver sinks, these can be used for debugging or testing. `run`
 * is the function that once called will execute the application.
 * @function setup
 */
function setup(main, drivers) {
    if (typeof main !== "function") {
        throw new Error("First argument given to Cycle must be the 'main' " + "function.");
    }
    if (typeof drivers !== "object" || drivers === null) {
        throw new Error("Second argument given to Cycle must be an object " +
            "with driver functions as properties.");
    }
    if (internals_1.isObjectEmpty(drivers)) {
        throw new Error("Second argument given to Cycle must be an object " +
            "with at least one driver function declared as a property.");
    }
    var engine = setupReusable(drivers);
    var sinks = main(engine.sources);
    if (typeof window !== 'undefined') {
        window.Cyclejs = window.Cyclejs || {};
        window.Cyclejs.sinks = sinks;
    }
    function _run() {
        var disposeRun = engine.run(sinks);
        return function dispose() {
            disposeRun();
            engine.dispose();
        };
    }
    return { sinks: sinks, sources: engine.sources, run: _run };
}
exports.setup = setup;
/**
 * A partially-applied variant of setup() which accepts only the drivers, and
 * allows many `main` functions to execute and reuse this same set of drivers.
 *
 * Takes an object with driver functions as input, and outputs an object which
 * contains the generated sources (from those drivers) and a `run` function
 * (which in turn expects sinks as argument). This `run` function can be called
 * multiple times with different arguments, and it will reuse the drivers that
 * were passed to `setupReusable`.
 *
 * **Example:**
 * ```js
 * import {setupReusable} from '@cycle/run';
 * const {sources, run, dispose} = setupReusable(drivers);
 * // ...
 * const sinks = main(sources);
 * const disposeRun = run(sinks);
 * // ...
 * disposeRun();
 * // ...
 * dispose(); // ends the reusability of drivers
 * ```
 *
 * @param {Object} drivers an object where keys are driver names and values
 * are driver functions.
 * @return {Object} an object with three properties: `sources`, `run` and
 * `dispose`. `sources` is the collection of driver sources, `run` is the
 * function that once called with 'sinks' as argument, will execute the
 * application, tying together sources with sinks. `dispose` terminates the
 * reusable resources used by the drivers. Note also that `run` returns a
 * dispose function which terminates resources that are specific (not reusable)
 * to that run.
 * @function setupReusable
 */
function setupReusable(drivers) {
    if (typeof drivers !== "object" || drivers === null) {
        throw new Error("Argument given to setupReusable must be an object " +
            "with driver functions as properties.");
    }
    if (internals_1.isObjectEmpty(drivers)) {
        throw new Error("Argument given to setupReusable must be an object " +
            "with at least one driver function declared as a property.");
    }
    var sinkProxies = internals_1.makeSinkProxies(drivers);
    var rawSources = internals_1.callDrivers(drivers, sinkProxies);
    var sources = internals_1.adaptSources(rawSources);
    function _run(sinks) {
        return internals_1.replicateMany(sinks, sinkProxies);
    }
    function disposeEngine() {
        internals_1.disposeSources(sources);
        internals_1.disposeSinkProxies(sinkProxies);
    }
    return { sources: sources, run: _run, dispose: disposeEngine };
}
exports.setupReusable = setupReusable;
/**
 * Takes a `main` function and circularly connects it to the given collection
 * of driver functions.
 *
 * **Example:**
 * ```js
 * import run from '@cycle/run';
 * const dispose = run(main, drivers);
 * // ...
 * dispose();
 * ```
 *
 * The `main` function expects a collection of "source" streams (returned from
 * drivers) as input, and should return a collection of "sink" streams (to be
 * given to drivers). A "collection of streams" is a JavaScript object where
 * keys match the driver names registered by the `drivers` object, and values
 * are the streams. Refer to the documentation of each driver to see more
 * details on what types of sources it outputs and sinks it receives.
 *
 * @param {Function} main a function that takes `sources` as input and outputs
 * `sinks`.
 * @param {Object} drivers an object where keys are driver names and values
 * are driver functions.
 * @return {Function} a dispose function, used to terminate the execution of the
 * Cycle.js program, cleaning up resources used.
 * @function run
 */
function run(main, drivers) {
    var program = setup(main, drivers);
    if (typeof window !== 'undefined' &&
        window['CyclejsDevTool_startGraphSerializer']) {
        window['CyclejsDevTool_startGraphSerializer'](program.sinks);
    }
    return program.run();
}
exports.run = run;
exports.default = run;

},{"./internals":3}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var xstream_1 = require("xstream");
var quicktask_1 = require("quicktask");
var adapt_1 = require("./adapt");
var scheduleMicrotask = quicktask_1.default();
function makeSinkProxies(drivers) {
    var sinkProxies = {};
    for (var name_1 in drivers) {
        if (drivers.hasOwnProperty(name_1)) {
            sinkProxies[name_1] = xstream_1.default.create();
        }
    }
    return sinkProxies;
}
exports.makeSinkProxies = makeSinkProxies;
function callDrivers(drivers, sinkProxies) {
    var sources = {};
    for (var name_2 in drivers) {
        if (drivers.hasOwnProperty(name_2)) {
            sources[name_2] = drivers[name_2](sinkProxies[name_2], name_2);
            if (sources[name_2] && typeof sources[name_2] === 'object') {
                sources[name_2]._isCycleSource = name_2;
            }
        }
    }
    return sources;
}
exports.callDrivers = callDrivers;
// NOTE: this will mutate `sources`.
function adaptSources(sources) {
    for (var name_3 in sources) {
        if (sources.hasOwnProperty(name_3) &&
            sources[name_3] &&
            typeof sources[name_3]['shamefullySendNext'] === 'function') {
            sources[name_3] = adapt_1.adapt(sources[name_3]);
        }
    }
    return sources;
}
exports.adaptSources = adaptSources;
function replicateMany(sinks, sinkProxies) {
    var sinkNames = Object.keys(sinks).filter(function (name) { return !!sinkProxies[name]; });
    var buffers = {};
    var replicators = {};
    sinkNames.forEach(function (name) {
        buffers[name] = { _n: [], _e: [] };
        replicators[name] = {
            next: function (x) { return buffers[name]._n.push(x); },
            error: function (err) { return buffers[name]._e.push(err); },
            complete: function () { },
        };
    });
    var subscriptions = sinkNames.map(function (name) {
        return xstream_1.default.fromObservable(sinks[name]).subscribe(replicators[name]);
    });
    sinkNames.forEach(function (name) {
        var listener = sinkProxies[name];
        var next = function (x) {
            scheduleMicrotask(function () { return listener._n(x); });
        };
        var error = function (err) {
            scheduleMicrotask(function () {
                (console.error || console.log)(err);
                listener._e(err);
            });
        };
        buffers[name]._n.forEach(next);
        buffers[name]._e.forEach(error);
        replicators[name].next = next;
        replicators[name].error = error;
        // because sink.subscribe(replicator) had mutated replicator to add
        // _n, _e, _c, we must also update these:
        replicators[name]._n = next;
        replicators[name]._e = error;
    });
    buffers = null; // free up for GC
    return function disposeReplication() {
        subscriptions.forEach(function (s) { return s.unsubscribe(); });
    };
}
exports.replicateMany = replicateMany;
function disposeSinkProxies(sinkProxies) {
    Object.keys(sinkProxies).forEach(function (name) { return sinkProxies[name]._c(); });
}
exports.disposeSinkProxies = disposeSinkProxies;
function disposeSources(sources) {
    for (var k in sources) {
        if (sources.hasOwnProperty(k) &&
            sources[k] &&
            sources[k].dispose) {
            sources[k].dispose();
        }
    }
}
exports.disposeSources = disposeSources;
function isObjectEmpty(obj) {
    return Object.keys(obj).length === 0;
}
exports.isObjectEmpty = isObjectEmpty;

},{"./adapt":1,"quicktask":7,"xstream":51}],4:[function(require,module,exports){
/*!
 * EventEmitter2
 * https://github.com/hij1nx/EventEmitter2
 *
 * Copyright (c) 2013 hij1nx
 * Licensed under the MIT license.
 */
;!function(undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {
      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      this._events.maxListeners = conf.maxListeners !== undefined ? conf.maxListeners : defaultMaxListeners;
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);
      conf.verboseMemoryLeak && (this.verboseMemoryLeak = conf.verboseMemoryLeak);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    } else {
      this._events.maxListeners = defaultMaxListeners;
    }
  }

  function logPossibleMemoryLeak(count, eventName) {
    var errorMsg = '(node) warning: possible EventEmitter memory ' +
        'leak detected. %d listeners added. ' +
        'Use emitter.setMaxListeners() to increase limit.';

    if(this.verboseMemoryLeak){
      errorMsg += ' Event name: %s.';
      console.error(errorMsg, count, eventName);
    } else {
      console.error(errorMsg, count);
    }

    if (console.trace){
      console.trace();
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    this.verboseMemoryLeak = false;
    configure.call(this, conf);
  }
  EventEmitter.EventEmitter2 = EventEmitter; // backwards compatibility for exporting EventEmitter property

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }

    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }

        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name !== undefined) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else {
          if (typeof tree._listeners === 'function') {
            tree._listeners = [tree._listeners];
          }

          tree._listeners.push(listener);

          if (
            !tree._listeners.warned &&
            this._events.maxListeners > 0 &&
            tree._listeners.length > this._events.maxListeners
          ) {
            tree._listeners.warned = true;
            logPossibleMemoryLeak.call(this, tree._listeners.length, name);
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  }

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    if (n !== undefined) {
      this._events || init.call(this);
      this._events.maxListeners = n;
      if (!this._conf) this._conf = {};
      this._conf.maxListeners = n;
    }
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    }

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) {
        return false;
      }
    }

    var al = arguments.length;
    var args,l,i,j;
    var handler;

    if (this._all && this._all.length) {
      handler = this._all.slice();
      if (al > 3) {
        args = new Array(al);
        for (j = 0; j < al; j++) args[j] = arguments[j];
      }

      for (i = 0, l = handler.length; i < l; i++) {
        this.event = type;
        switch (al) {
        case 1:
          handler[i].call(this, type);
          break;
        case 2:
          handler[i].call(this, type, arguments[1]);
          break;
        case 3:
          handler[i].call(this, type, arguments[1], arguments[2]);
          break;
        default:
          handler[i].apply(this, args);
        }
      }
    }

    if (this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    } else {
      handler = this._events[type];
      if (typeof handler === 'function') {
        this.event = type;
        switch (al) {
        case 1:
          handler.call(this);
          break;
        case 2:
          handler.call(this, arguments[1]);
          break;
        case 3:
          handler.call(this, arguments[1], arguments[2]);
          break;
        default:
          args = new Array(al - 1);
          for (j = 1; j < al; j++) args[j - 1] = arguments[j];
          handler.apply(this, args);
        }
        return true;
      } else if (handler) {
        // need to make copy of handlers because list can change in the middle
        // of emit call
        handler = handler.slice();
      }
    }

    if (handler && handler.length) {
      if (al > 3) {
        args = new Array(al - 1);
        for (j = 1; j < al; j++) args[j - 1] = arguments[j];
      }
      for (i = 0, l = handler.length; i < l; i++) {
        this.event = type;
        switch (al) {
        case 1:
          handler[i].call(this);
          break;
        case 2:
          handler[i].call(this, arguments[1]);
          break;
        case 3:
          handler[i].call(this, arguments[1], arguments[2]);
          break;
        default:
          handler[i].apply(this, args);
        }
      }
      return true;
    } else if (!this._all && type === 'error') {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }

    return !!this._all;
  };

  EventEmitter.prototype.emitAsync = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
        if (!this._events.newListener) { return Promise.resolve([false]); }
    }

    var promises= [];

    var al = arguments.length;
    var args,l,i,j;
    var handler;

    if (this._all) {
      if (al > 3) {
        args = new Array(al);
        for (j = 1; j < al; j++) args[j] = arguments[j];
      }
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        switch (al) {
        case 1:
          promises.push(this._all[i].call(this, type));
          break;
        case 2:
          promises.push(this._all[i].call(this, type, arguments[1]));
          break;
        case 3:
          promises.push(this._all[i].call(this, type, arguments[1], arguments[2]));
          break;
        default:
          promises.push(this._all[i].apply(this, args));
        }
      }
    }

    if (this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    } else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      switch (al) {
      case 1:
        promises.push(handler.call(this));
        break;
      case 2:
        promises.push(handler.call(this, arguments[1]));
        break;
      case 3:
        promises.push(handler.call(this, arguments[1], arguments[2]));
        break;
      default:
        args = new Array(al - 1);
        for (j = 1; j < al; j++) args[j - 1] = arguments[j];
        promises.push(handler.apply(this, args));
      }
    } else if (handler && handler.length) {
      if (al > 3) {
        args = new Array(al - 1);
        for (j = 1; j < al; j++) args[j - 1] = arguments[j];
      }
      for (i = 0, l = handler.length; i < l; i++) {
        this.event = type;
        switch (al) {
        case 1:
          promises.push(handler[i].call(this));
          break;
        case 2:
          promises.push(handler[i].call(this, arguments[1]));
          break;
        case 3:
          promises.push(handler[i].call(this, arguments[1], arguments[2]));
          break;
        default:
          promises.push(handler[i].apply(this, args));
        }
      }
    } else if (!this._all && type === 'error') {
      if (arguments[1] instanceof Error) {
        return Promise.reject(arguments[1]); // Unhandled 'error' event
      } else {
        return Promise.reject("Uncaught, unspecified 'error' event.");
      }
    }

    return Promise.all(promises);
  };

  EventEmitter.prototype.on = function(type, listener) {
    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if (this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else {
      if (typeof this._events[type] === 'function') {
        // Change to array.
        this._events[type] = [this._events[type]];
      }

      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (
        !this._events[type].warned &&
        this._events.maxListeners > 0 &&
        this._events[type].length > this._events.maxListeners
      ) {
        this._events[type].warned = true;
        logPossibleMemoryLeak.call(this, this._events[type].length, type);
      }
    }

    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {
    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    if (!this._all) {
      this._all = [];
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          continue;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1);
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }

        this.emit("removeListener", type, listener);

        return this;
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }

        this.emit("removeListener", type, listener);
      }
    }

    function recursivelyGarbageCollect(root) {
      if (root === undefined) {
        return;
      }
      var keys = Object.keys(root);
      for (var i in keys) {
        var key = keys[i];
        var obj = root[key];
        if ((obj instanceof Function) || (typeof obj !== "object") || (obj === null))
          continue;
        if (Object.keys(obj).length > 0) {
          recursivelyGarbageCollect(root[key]);
        }
        if (Object.keys(obj).length === 0) {
          delete root[key];
        }
      }
    }
    recursivelyGarbageCollect(this.listenerTree);

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          this.emit("removeListenerAny", fn);
          return this;
        }
      }
    } else {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++)
        this.emit("removeListenerAny", fns[i]);
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if (this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else if (this._events) {
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if (this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenerCount = function(type) {
    return this.listeners(type).length;
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
     // AMD. Register as an anonymous module.
    define(function() {
      return EventEmitter;
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    module.exports = EventEmitter;
  }
  else {
    // Browser global.
    window.EventEmitter2 = EventEmitter;
  }
}();

},{}],5:[function(require,module,exports){
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],6:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],7:[function(require,module,exports){
(function (process,setImmediate){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function microtask() {
    if (typeof MutationObserver !== 'undefined') {
        var node_1 = document.createTextNode('');
        var queue_1 = [];
        var i_1 = 0;
        new MutationObserver(function () {
            while (queue_1.length) {
                queue_1.shift()();
            }
        }).observe(node_1, { characterData: true });
        return function (fn) {
            queue_1.push(fn);
            node_1.data = i_1 = 1 - i_1;
        };
    }
    else if (typeof setImmediate !== 'undefined') {
        return setImmediate;
    }
    else if (typeof process !== 'undefined') {
        return process.nextTick;
    }
    else {
        return setTimeout;
    }
}
exports.default = microtask;

}).call(this,require('_process'),require("timers").setImmediate)

},{"_process":6,"timers":49}],8:[function(require,module,exports){
/**
 * @fileOverview
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * If you use roslib in a browser, all the classes will be exported to a global variable called ROSLIB.
 *
 * If you use nodejs, this is the variable you get when you require('roslib')
 */
var ROSLIB = this.ROSLIB || {
  REVISION : '0.20.0'
};

var assign = require('object-assign');

// Add core components
assign(ROSLIB, require('./core'));

assign(ROSLIB, require('./actionlib'));

assign(ROSLIB, require('./math'));

assign(ROSLIB, require('./tf'));

assign(ROSLIB, require('./urdf'));

module.exports = ROSLIB;

},{"./actionlib":13,"./core":22,"./math":27,"./tf":30,"./urdf":42,"object-assign":5}],9:[function(require,module,exports){
/**
 * @fileOverview
 * @author Russell Toris - rctoris@wpi.edu
 */

var Topic = require('../core/Topic');
var Message = require('../core/Message');
var EventEmitter2 = require('eventemitter2').EventEmitter2;

/**
 * An actionlib action client.
 *
 * Emits the following events:
 *  * 'timeout' - if a timeout occurred while sending a goal
 *  * 'status' - the status messages received from the action server
 *  * 'feedback' -  the feedback messages received from the action server
 *  * 'result' - the result returned from the action server
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * serverName - the action server name, like /fibonacci
 *   * actionName - the action message name, like 'actionlib_tutorials/FibonacciAction'
 *   * timeout - the timeout length when connecting to the action server
 */
function ActionClient(options) {
  var that = this;
  options = options || {};
  this.ros = options.ros;
  this.serverName = options.serverName;
  this.actionName = options.actionName;
  this.timeout = options.timeout;
  this.omitFeedback = options.omitFeedback;
  this.omitStatus = options.omitStatus;
  this.omitResult = options.omitResult;
  this.goals = {};

  // flag to check if a status has been received
  var receivedStatus = false;

  // create the topics associated with actionlib
  this.feedbackListener = new Topic({
    ros : this.ros,
    name : this.serverName + '/feedback',
    messageType : this.actionName + 'Feedback'
  });

  this.statusListener = new Topic({
    ros : this.ros,
    name : this.serverName + '/status',
    messageType : 'actionlib_msgs/GoalStatusArray'
  });

  this.resultListener = new Topic({
    ros : this.ros,
    name : this.serverName + '/result',
    messageType : this.actionName + 'Result'
  });

  this.goalTopic = new Topic({
    ros : this.ros,
    name : this.serverName + '/goal',
    messageType : this.actionName + 'Goal'
  });

  this.cancelTopic = new Topic({
    ros : this.ros,
    name : this.serverName + '/cancel',
    messageType : 'actionlib_msgs/GoalID'
  });

  // advertise the goal and cancel topics
  this.goalTopic.advertise();
  this.cancelTopic.advertise();

  // subscribe to the status topic
  if (!this.omitStatus) {
    this.statusListener.subscribe(function(statusMessage) {
      receivedStatus = true;
      statusMessage.status_list.forEach(function(status) {
        var goal = that.goals[status.goal_id.id];
        if (goal) {
          goal.emit('status', status);
        }
      });
    });
  }

  // subscribe the the feedback topic
  if (!this.omitFeedback) {
    this.feedbackListener.subscribe(function(feedbackMessage) {
      var goal = that.goals[feedbackMessage.status.goal_id.id];
      if (goal) {
        goal.emit('status', feedbackMessage.status);
        goal.emit('feedback', feedbackMessage.feedback);
      }
    });
  }

  // subscribe to the result topic
  if (!this.omitResult) {
    this.resultListener.subscribe(function(resultMessage) {
      var goal = that.goals[resultMessage.status.goal_id.id];

      if (goal) {
        goal.emit('status', resultMessage.status);
        goal.emit('result', resultMessage.result);
      }
    });
  }

  // If timeout specified, emit a 'timeout' event if the action server does not respond
  if (this.timeout) {
    setTimeout(function() {
      if (!receivedStatus) {
        that.emit('timeout');
      }
    }, this.timeout);
  }
}

ActionClient.prototype.__proto__ = EventEmitter2.prototype;

/**
 * Cancel all goals associated with this ActionClient.
 */
ActionClient.prototype.cancel = function() {
  var cancelMessage = new Message();
  this.cancelTopic.publish(cancelMessage);
};

/**
 * Unsubscribe and unadvertise all topics associated with this ActionClient.
 */
ActionClient.prototype.dispose = function() {
  this.goalTopic.unadvertise();
  this.cancelTopic.unadvertise();
  if (!this.omitStatus) {this.statusListener.unsubscribe();}
  if (!this.omitFeedback) {this.feedbackListener.unsubscribe();}
  if (!this.omitResult) {this.resultListener.unsubscribe();}
};

module.exports = ActionClient;

},{"../core/Message":14,"../core/Topic":21,"eventemitter2":4}],10:[function(require,module,exports){
/**
 * @fileOverview
 * @author Justin Young - justin@oodar.com.au
 * @author Russell Toris - rctoris@wpi.edu
 */

var Topic = require('../core/Topic');
var Message = require('../core/Message');
var EventEmitter2 = require('eventemitter2').EventEmitter2;

/**
 * An actionlib action listener
 *
 * Emits the following events:
 *  * 'status' - the status messages received from the action server
 *  * 'feedback' -  the feedback messages received from the action server
 *  * 'result' - the result returned from the action server
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * serverName - the action server name, like /fibonacci
 *   * actionName - the action message name, like 'actionlib_tutorials/FibonacciAction'
 */
function ActionListener(options) {
  var that = this;
  options = options || {};
  this.ros = options.ros;
  this.serverName = options.serverName;
  this.actionName = options.actionName;
  this.timeout = options.timeout;
  this.omitFeedback = options.omitFeedback;
  this.omitStatus = options.omitStatus;
  this.omitResult = options.omitResult;


  // create the topics associated with actionlib
  var goalListener = new Topic({
    ros : this.ros,
    name : this.serverName + '/goal',
    messageType : this.actionName + 'Goal'
  });

  var feedbackListener = new Topic({
    ros : this.ros,
    name : this.serverName + '/feedback',
    messageType : this.actionName + 'Feedback'
  });

  var statusListener = new Topic({
    ros : this.ros,
    name : this.serverName + '/status',
    messageType : 'actionlib_msgs/GoalStatusArray'
  });

  var resultListener = new Topic({
    ros : this.ros,
    name : this.serverName + '/result',
    messageType : this.actionName + 'Result'
  });

  goalListener.subscribe(function(goalMessage) {
      that.emit('goal', goalMessage);
  });

  statusListener.subscribe(function(statusMessage) {
      statusMessage.status_list.forEach(function(status) {
          that.emit('status', status);
      });
  });

  feedbackListener.subscribe(function(feedbackMessage) {
      that.emit('status', feedbackMessage.status);
      that.emit('feedback', feedbackMessage.feedback);
  });

  // subscribe to the result topic
  resultListener.subscribe(function(resultMessage) {
      that.emit('status', resultMessage.status);
      that.emit('result', resultMessage.result);
  });

}

ActionListener.prototype.__proto__ = EventEmitter2.prototype;

module.exports = ActionListener;

},{"../core/Message":14,"../core/Topic":21,"eventemitter2":4}],11:[function(require,module,exports){
/**
 * @fileOverview
 * @author Russell Toris - rctoris@wpi.edu
 */

var Message = require('../core/Message');
var EventEmitter2 = require('eventemitter2').EventEmitter2;

/**
 * An actionlib goal goal is associated with an action server.
 *
 * Emits the following events:
 *  * 'timeout' - if a timeout occurred while sending a goal
 *
 *  @constructor
 *  @param object with following keys:
 *   * actionClient - the ROSLIB.ActionClient to use with this goal
 *   * goalMessage - The JSON object containing the goal for the action server
 */
function Goal(options) {
  var that = this;
  this.actionClient = options.actionClient;
  this.goalMessage = options.goalMessage;
  this.isFinished = false;

  // Used to create random IDs
  var date = new Date();

  // Create a random ID
  this.goalID = 'goal_' + Math.random() + '_' + date.getTime();
  // Fill in the goal message
  this.goalMessage = new Message({
    goal_id : {
      stamp : {
        secs : 0,
        nsecs : 0
      },
      id : this.goalID
    },
    goal : this.goalMessage
  });

  this.on('status', function(status) {
    that.status = status;
  });

  this.on('result', function(result) {
    that.isFinished = true;
    that.result = result;
  });

  this.on('feedback', function(feedback) {
    that.feedback = feedback;
  });

  // Add the goal
  this.actionClient.goals[this.goalID] = this;
}

Goal.prototype.__proto__ = EventEmitter2.prototype;

/**
 * Send the goal to the action server.
 *
 * @param timeout (optional) - a timeout length for the goal's result
 */
Goal.prototype.send = function(timeout) {
  var that = this;
  that.actionClient.goalTopic.publish(that.goalMessage);
  if (timeout) {
    setTimeout(function() {
      if (!that.isFinished) {
        that.emit('timeout');
      }
    }, timeout);
  }
};

/**
 * Cancel the current goal.
 */
Goal.prototype.cancel = function() {
  var cancelMessage = new Message({
    id : this.goalID
  });
  this.actionClient.cancelTopic.publish(cancelMessage);
};

module.exports = Goal;
},{"../core/Message":14,"eventemitter2":4}],12:[function(require,module,exports){
/**
 * @fileOverview
 * @author Laura Lindzey - lindzey@gmail.com
 */

var Topic = require('../core/Topic');
var Message = require('../core/Message');
var EventEmitter2 = require('eventemitter2').EventEmitter2;

/**
 * An actionlib action server client.
 *
 * Emits the following events:
 *  * 'goal' - goal sent by action client
 *  * 'cancel' - action client has canceled the request
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * serverName - the action server name, like /fibonacci
 *   * actionName - the action message name, like 'actionlib_tutorials/FibonacciAction'
 */

function SimpleActionServer(options) {
    var that = this;
    options = options || {};
    this.ros = options.ros;
    this.serverName = options.serverName;
    this.actionName = options.actionName;

    // create and advertise publishers
    this.feedbackPublisher = new Topic({
        ros : this.ros,
        name : this.serverName + '/feedback',
        messageType : this.actionName + 'Feedback'
    });
    this.feedbackPublisher.advertise();

    var statusPublisher = new Topic({
        ros : this.ros,
        name : this.serverName + '/status',
        messageType : 'actionlib_msgs/GoalStatusArray'
    });
    statusPublisher.advertise();

    this.resultPublisher = new Topic({
        ros : this.ros,
        name : this.serverName + '/result',
        messageType : this.actionName + 'Result'
    });
    this.resultPublisher.advertise();

    // create and subscribe to listeners
    var goalListener = new Topic({
        ros : this.ros,
        name : this.serverName + '/goal',
        messageType : this.actionName + 'Goal'
    });

    var cancelListener = new Topic({
        ros : this.ros,
        name : this.serverName + '/cancel',
        messageType : 'actionlib_msgs/GoalID'
    });

    // Track the goals and their status in order to publish status...
    this.statusMessage = new Message({
        header : {
            stamp : {secs : 0, nsecs : 100},
            frame_id : ''
        },
        status_list : []
    });

    // needed for handling preemption prompted by a new goal being received
    this.currentGoal = null; // currently tracked goal
    this.nextGoal = null; // the one that'll be preempting

    goalListener.subscribe(function(goalMessage) {
        
    if(that.currentGoal) {
            that.nextGoal = goalMessage;
            // needs to happen AFTER rest is set up
            that.emit('cancel');
    } else {
            that.statusMessage.status_list = [{goal_id : goalMessage.goal_id, status : 1}];
            that.currentGoal = goalMessage;
            that.emit('goal', goalMessage.goal);
    }
    });

    // helper function for determing ordering of timestamps
    // returns t1 < t2
    var isEarlier = function(t1, t2) {
        if(t1.secs > t2.secs) {
            return false;
        } else if(t1.secs < t2.secs) {
            return true;
        } else if(t1.nsecs < t2.nsecs) {
            return true;
        } else {
            return false;
        }
    };

    // TODO: this may be more complicated than necessary, since I'm
    // not sure if the callbacks can ever wind up with a scenario
    // where we've been preempted by a next goal, it hasn't finished
    // processing, and then we get a cancel message
    cancelListener.subscribe(function(cancelMessage) {

        // cancel ALL goals if both empty
        if(cancelMessage.stamp.secs === 0 && cancelMessage.stamp.secs === 0 && cancelMessage.id === '') {
            that.nextGoal = null;
            if(that.currentGoal) {
                that.emit('cancel');
            }
        } else { // treat id and stamp independently
            if(that.currentGoal && cancelMessage.id === that.currentGoal.goal_id.id) {
                that.emit('cancel');
            } else if(that.nextGoal && cancelMessage.id === that.nextGoal.goal_id.id) {
                that.nextGoal = null;
            }

            if(that.nextGoal && isEarlier(that.nextGoal.goal_id.stamp,
                                          cancelMessage.stamp)) {
                that.nextGoal = null;
            }
            if(that.currentGoal && isEarlier(that.currentGoal.goal_id.stamp,
                                             cancelMessage.stamp)) {
                
                that.emit('cancel');
            }
        }
    });

    // publish status at pseudo-fixed rate; required for clients to know they've connected
    var statusInterval = setInterval( function() {
        var currentTime = new Date();
        var secs = Math.floor(currentTime.getTime()/1000);
        var nsecs = Math.round(1000000000*(currentTime.getTime()/1000-secs));
        that.statusMessage.header.stamp.secs = secs;
        that.statusMessage.header.stamp.nsecs = nsecs;
        statusPublisher.publish(that.statusMessage);
    }, 500); // publish every 500ms

}

SimpleActionServer.prototype.__proto__ = EventEmitter2.prototype;

/**
*  Set action state to succeeded and return to client
*/

SimpleActionServer.prototype.setSucceeded = function(result2) {
    

    var resultMessage = new Message({
        status : {goal_id : this.currentGoal.goal_id, status : 3},
        result : result2
    });
    this.resultPublisher.publish(resultMessage);

    this.statusMessage.status_list = [];
    if(this.nextGoal) {
        this.currentGoal = this.nextGoal;
        this.nextGoal = null;
        this.emit('goal', this.currentGoal.goal);
    } else {
        this.currentGoal = null;
    }
};

/**
*  Function to send feedback
*/

SimpleActionServer.prototype.sendFeedback = function(feedback2) {

    var feedbackMessage = new Message({
        status : {goal_id : this.currentGoal.goal_id, status : 1},
        feedback : feedback2
    });
    this.feedbackPublisher.publish(feedbackMessage);
};

/**
*  Handle case where client requests preemption
*/

SimpleActionServer.prototype.setPreempted = function() {

    this.statusMessage.status_list = [];
    var resultMessage = new Message({
        status : {goal_id : this.currentGoal.goal_id, status : 2},
    });
    this.resultPublisher.publish(resultMessage);

    if(this.nextGoal) {
        this.currentGoal = this.nextGoal;
        this.nextGoal = null;
        this.emit('goal', this.currentGoal.goal);
    } else {
        this.currentGoal = null;
    }
};

module.exports = SimpleActionServer;
},{"../core/Message":14,"../core/Topic":21,"eventemitter2":4}],13:[function(require,module,exports){
var Ros = require('../core/Ros');
var mixin = require('../mixin');

var action = module.exports = {
    ActionClient: require('./ActionClient'),
    ActionListener: require('./ActionListener'),
    Goal: require('./Goal'),
    SimpleActionServer: require('./SimpleActionServer')
};

mixin(Ros, ['ActionClient', 'SimpleActionServer'], action);

},{"../core/Ros":16,"../mixin":28,"./ActionClient":9,"./ActionListener":10,"./Goal":11,"./SimpleActionServer":12}],14:[function(require,module,exports){
/**
 * @fileoverview
 * @author Brandon Alexander - baalexander@gmail.com
 */

var assign = require('object-assign');

/**
 * Message objects are used for publishing and subscribing to and from topics.
 *
 * @constructor
 * @param values - object matching the fields defined in the .msg definition file
 */
function Message(values) {
  assign(this, values);
}

module.exports = Message;
},{"object-assign":5}],15:[function(require,module,exports){
/**
 * @fileoverview
 * @author Brandon Alexander - baalexander@gmail.com
 */

var Service = require('./Service');
var ServiceRequest = require('./ServiceRequest');

/**
 * A ROS parameter.
 *
 * @constructor
 * @param options - possible keys include:
 *   * ros - the ROSLIB.Ros connection handle
 *   * name - the param name, like max_vel_x
 */
function Param(options) {
  options = options || {};
  this.ros = options.ros;
  this.name = options.name;
}

/**
 * Fetches the value of the param.
 *
 * @param callback - function with the following params:
 *  * value - the value of the param from ROS.
 */
Param.prototype.get = function(callback) {
  var paramClient = new Service({
    ros : this.ros,
    name : '/rosapi/get_param',
    serviceType : 'rosapi/GetParam'
  });

  var request = new ServiceRequest({
    name : this.name
  });

  paramClient.callService(request, function(result) {
    var value = JSON.parse(result.value);
    callback(value);
  });
};

/**
 * Sets the value of the param in ROS.
 *
 * @param value - value to set param to.
 */
Param.prototype.set = function(value, callback) {
  var paramClient = new Service({
    ros : this.ros,
    name : '/rosapi/set_param',
    serviceType : 'rosapi/SetParam'
  });

  var request = new ServiceRequest({
    name : this.name,
    value : JSON.stringify(value)
  });

  paramClient.callService(request, callback);
};

/**
 * Delete this parameter on the ROS server.
 */
Param.prototype.delete = function(callback) {
  var paramClient = new Service({
    ros : this.ros,
    name : '/rosapi/delete_param',
    serviceType : 'rosapi/DeleteParam'
  });

  var request = new ServiceRequest({
    name : this.name
  });

  paramClient.callService(request, callback);
};

module.exports = Param;
},{"./Service":17,"./ServiceRequest":18}],16:[function(require,module,exports){
/**
 * @fileoverview
 * @author Brandon Alexander - baalexander@gmail.com
 */

var WebSocket = require('ws');
var socketAdapter = require('./SocketAdapter.js');

var Service = require('./Service');
var ServiceRequest = require('./ServiceRequest');

var assign = require('object-assign');
var EventEmitter2 = require('eventemitter2').EventEmitter2;

/**
 * Manages connection to the server and all interactions with ROS.
 *
 * Emits the following events:
 *  * 'error' - there was an error with ROS
 *  * 'connection' - connected to the WebSocket server
 *  * 'close' - disconnected to the WebSocket server
 *  * <topicName> - a message came from rosbridge with the given topic name
 *  * <serviceID> - a service response came from rosbridge with the given ID
 *
 * @constructor
 * @param options - possible keys include: <br>
 *   * url (optional) - (can be specified later with `connect`) the WebSocket URL for rosbridge or the node server url to connect using socket.io (if socket.io exists in the page) <br>
 *   * groovyCompatibility - don't use interfaces that changed after the last groovy release or rosbridge_suite and related tools (defaults to true)
 *   * transportLibrary (optional) - one of 'websocket' (default), 'socket.io' or RTCPeerConnection instance controlling how the connection is created in `connect`.
 *   * transportOptions (optional) - the options to use use when creating a connection. Currently only used if `transportLibrary` is RTCPeerConnection.
 */
function Ros(options) {
  options = options || {};
  this.socket = null;
  this.idCounter = 0;
  this.isConnected = false;
  this.transportLibrary = options.transportLibrary || 'websocket';
  this.transportOptions = options.transportOptions || {};

  if (typeof options.groovyCompatibility === 'undefined') {
    this.groovyCompatibility = true;
  }
  else {
    this.groovyCompatibility = options.groovyCompatibility;
  }

  // Sets unlimited event listeners.
  this.setMaxListeners(0);

  // begin by checking if a URL was given
  if (options.url) {
    this.connect(options.url);
  }
}

Ros.prototype.__proto__ = EventEmitter2.prototype;

/**
 * Connect to the specified WebSocket.
 *
 * @param url - WebSocket URL or RTCDataChannel label for Rosbridge
 */
Ros.prototype.connect = function(url) {
  if (this.transportLibrary === 'socket.io') {
    this.socket = assign(io(url, {'force new connection': true}), socketAdapter(this));
    this.socket.on('connect', this.socket.onopen);
    this.socket.on('data', this.socket.onmessage);
    this.socket.on('close', this.socket.onclose);
    this.socket.on('error', this.socket.onerror);
  } else if (this.transportLibrary.constructor.name === 'RTCPeerConnection') {
    this.socket = assign(this.transportLibrary.createDataChannel(url, this.transportOptions), socketAdapter(this));
  }else {
    this.socket = assign(new WebSocket(url), socketAdapter(this));
  }

};

/**
 * Disconnect from the WebSocket server.
 */
Ros.prototype.close = function() {
  if (this.socket) {
    this.socket.close();
  }
};

/**
 * Sends an authorization request to the server.
 *
 * @param mac - MAC (hash) string given by the trusted source.
 * @param client - IP of the client.
 * @param dest - IP of the destination.
 * @param rand - Random string given by the trusted source.
 * @param t - Time of the authorization request.
 * @param level - User level as a string given by the client.
 * @param end - End time of the client's session.
 */
Ros.prototype.authenticate = function(mac, client, dest, rand, t, level, end) {
  // create the request
  var auth = {
    op : 'auth',
    mac : mac,
    client : client,
    dest : dest,
    rand : rand,
    t : t,
    level : level,
    end : end
  };
  // send the request
  this.callOnConnection(auth);
};

/**
 * Sends the message over the WebSocket, but queues the message up if not yet
 * connected.
 */
Ros.prototype.callOnConnection = function(message) {
  var that = this;
  var messageJson = JSON.stringify(message);
  var emitter = null;
  if (this.transportLibrary === 'socket.io') {
    emitter = function(msg){that.socket.emit('operation', msg);};
  } else {
    emitter = function(msg){that.socket.send(msg);};
  }

  if (!this.isConnected) {
    that.once('connection', function() {
      emitter(messageJson);
    });
  } else {
    emitter(messageJson);
  }
};

/**
 * Sends a set_level request to the server
 *
 * @param level - Status level (none, error, warning, info)
 * @param id - Optional: Operation ID to change status level on
 */
Ros.prototype.setStatusLevel = function(level, id){
  var levelMsg = {
    op: 'set_level',
    level: level,
    id: id
  };

  this.callOnConnection(levelMsg);
};

/**
 * Retrieves Action Servers in ROS as an array of string
 *
 *   * actionservers - Array of action server names
 */
Ros.prototype.getActionServers = function(callback, failedCallback) {
  var getActionServers = new Service({
    ros : this,
    name : '/rosapi/action_servers',
    serviceType : 'rosapi/GetActionServers'
  });

  var request = new ServiceRequest({});
  if (typeof failedCallback === 'function'){
    getActionServers.callService(request,
      function(result) {
        callback(result.action_servers);
      },
      function(message){
        failedCallback(message);
      }
    );
  }else{
    getActionServers.callService(request, function(result) {
      callback(result.action_servers);
    });
  }
};

/**
 * Retrieves list of topics in ROS as an array.
 *
 * @param callback function with params:
 *   * topics - Array of topic names
 */
Ros.prototype.getTopics = function(callback, failedCallback) {
  var topicsClient = new Service({
    ros : this,
    name : '/rosapi/topics',
    serviceType : 'rosapi/Topics'
  });

  var request = new ServiceRequest();
  if (typeof failedCallback === 'function'){
    topicsClient.callService(request,
      function(result) {
        callback(result);
      },
      function(message){
        failedCallback(message);
      }
    );
  }else{
    topicsClient.callService(request, function(result) {
      callback(result);
    });
  }
};

/**
 * Retrieves Topics in ROS as an array as specific type
 *
 * @param topicType topic type to find:
 * @param callback function with params:
 *   * topics - Array of topic names
 */
Ros.prototype.getTopicsForType = function(topicType, callback, failedCallback) {
  var topicsForTypeClient = new Service({
    ros : this,
    name : '/rosapi/topics_for_type',
    serviceType : 'rosapi/TopicsForType'
  });

  var request = new ServiceRequest({
    type: topicType
  });
  if (typeof failedCallback === 'function'){
    topicsForTypeClient.callService(request,
      function(result) {
        callback(result.topics);
      },
      function(message){
        failedCallback(message);
      }
    );
  }else{
    topicsForTypeClient.callService(request, function(result) {
      callback(result.topics);
    });
  }
};

/**
 * Retrieves list of active service names in ROS.
 *
 * @param callback - function with the following params:
 *   * services - array of service names
 */
Ros.prototype.getServices = function(callback, failedCallback) {
  var servicesClient = new Service({
    ros : this,
    name : '/rosapi/services',
    serviceType : 'rosapi/Services'
  });

  var request = new ServiceRequest();
  if (typeof failedCallback === 'function'){
    servicesClient.callService(request,
      function(result) {
        callback(result.services);
      },
      function(message) {
        failedCallback(message);
      }
    );
  }else{
    servicesClient.callService(request, function(result) {
      callback(result.services);
    });
  }
};

/**
 * Retrieves list of services in ROS as an array as specific type
 *
 * @param serviceType service type to find:
 * @param callback function with params:
 *   * topics - Array of service names
 */
Ros.prototype.getServicesForType = function(serviceType, callback, failedCallback) {
  var servicesForTypeClient = new Service({
    ros : this,
    name : '/rosapi/services_for_type',
    serviceType : 'rosapi/ServicesForType'
  });

  var request = new ServiceRequest({
    type: serviceType
  });
  if (typeof failedCallback === 'function'){
    servicesForTypeClient.callService(request,
      function(result) {
        callback(result.services);
      },
      function(message) {
        failedCallback(message);
      }
    );
  }else{
    servicesForTypeClient.callService(request, function(result) {
      callback(result.services);
    });
  }
};

/**
 * Retrieves a detail of ROS service request.
 *
 * @param service name of service:
 * @param callback - function with params:
 *   * type - String of the service type
 */
Ros.prototype.getServiceRequestDetails = function(type, callback, failedCallback) {
  var serviceTypeClient = new Service({
    ros : this,
    name : '/rosapi/service_request_details',
    serviceType : 'rosapi/ServiceRequestDetails'
  });
  var request = new ServiceRequest({
    type: type
  });

  if (typeof failedCallback === 'function'){
    serviceTypeClient.callService(request,
      function(result) {
        callback(result);
      },
      function(message){
        failedCallback(message);
      }
    );
  }else{
    serviceTypeClient.callService(request, function(result) {
      callback(result);
    });
  }
};

/**
 * Retrieves a detail of ROS service request.
 *
 * @param service name of service:
 * @param callback - function with params:
 *   * type - String of the service type
 */
Ros.prototype.getServiceResponseDetails = function(type, callback, failedCallback) {
  var serviceTypeClient = new Service({
    ros : this,
    name : '/rosapi/service_response_details',
    serviceType : 'rosapi/ServiceResponseDetails'
  });
  var request = new ServiceRequest({
    type: type
  });

  if (typeof failedCallback === 'function'){
    serviceTypeClient.callService(request,
      function(result) {
        callback(result);
      },
      function(message){
        failedCallback(message);
      }
    );
  }else{
    serviceTypeClient.callService(request, function(result) {
      callback(result);
    });
  }
};

/**
 * Retrieves list of active node names in ROS.
 *
 * @param callback - function with the following params:
 *   * nodes - array of node names
 */
Ros.prototype.getNodes = function(callback, failedCallback) {
  var nodesClient = new Service({
    ros : this,
    name : '/rosapi/nodes',
    serviceType : 'rosapi/Nodes'
  });

  var request = new ServiceRequest();
  if (typeof failedCallback === 'function'){
    nodesClient.callService(request,
      function(result) {
        callback(result.nodes);
      },
      function(message) {
        failedCallback(message);
      }
    );
  }else{
    nodesClient.callService(request, function(result) {
      callback(result.nodes);
    });
  }
};

/**
  * Retrieves list subscribed topics, publishing topics and services of a specific node
  *
  * @param node name of the node:
  * @param callback - function with params:
  *   * publications - array of published topic names
  *   * subscriptions - array of subscribed topic names
  *   * services - array of service names hosted
  */
Ros.prototype.getNodeDetails = function(node, callback, failedCallback) {
  var nodesClient = new Service({
    ros : this,
    name : '/rosapi/node_details',
    serviceType : 'rosapi/NodeDetails'
  });

  var request = new ServiceRequest({
    node: node
  });
  if (typeof failedCallback === 'function'){
    nodesClient.callService(request,
      function(result) {
        callback(result.subscribing, result.publishing, result.services);
      },
      function(message) {
        failedCallback(message);
      }
    );
  } else {
    nodesClient.callService(request, function(result) {
      callback(result);
    });
  }
};

/**
 * Retrieves list of param names from the ROS Parameter Server.
 *
 * @param callback function with params:
 *  * params - array of param names.
 */
Ros.prototype.getParams = function(callback, failedCallback) {
  var paramsClient = new Service({
    ros : this,
    name : '/rosapi/get_param_names',
    serviceType : 'rosapi/GetParamNames'
  });
  var request = new ServiceRequest();
  if (typeof failedCallback === 'function'){
    paramsClient.callService(request,
      function(result) {
        callback(result.names);
      },
      function(message){
        failedCallback(message);
      }
    );
  }else{
    paramsClient.callService(request, function(result) {
      callback(result.names);
    });
  }
};

/**
 * Retrieves a type of ROS topic.
 *
 * @param topic name of the topic:
 * @param callback - function with params:
 *   * type - String of the topic type
 */
Ros.prototype.getTopicType = function(topic, callback, failedCallback) {
  var topicTypeClient = new Service({
    ros : this,
    name : '/rosapi/topic_type',
    serviceType : 'rosapi/TopicType'
  });
  var request = new ServiceRequest({
    topic: topic
  });

  if (typeof failedCallback === 'function'){
    topicTypeClient.callService(request,
      function(result) {
        callback(result.type);
      },
      function(message){
        failedCallback(message);
      }
    );
  }else{
    topicTypeClient.callService(request, function(result) {
      callback(result.type);
    });
  }
};

/**
 * Retrieves a type of ROS service.
 *
 * @param service name of service:
 * @param callback - function with params:
 *   * type - String of the service type
 */
Ros.prototype.getServiceType = function(service, callback, failedCallback) {
  var serviceTypeClient = new Service({
    ros : this,
    name : '/rosapi/service_type',
    serviceType : 'rosapi/ServiceType'
  });
  var request = new ServiceRequest({
    service: service
  });

  if (typeof failedCallback === 'function'){
    serviceTypeClient.callService(request,
      function(result) {
        callback(result.type);
      },
      function(message){
        failedCallback(message);
      }
    );
  }else{
    serviceTypeClient.callService(request, function(result) {
      callback(result.type);
    });
  }
};

/**
 * Retrieves a detail of ROS message.
 *
 * @param callback - function with params:
 *   * details - Array of the message detail
 * @param message - String of a topic type
 */
Ros.prototype.getMessageDetails = function(message, callback, failedCallback) {
  var messageDetailClient = new Service({
    ros : this,
    name : '/rosapi/message_details',
    serviceType : 'rosapi/MessageDetails'
  });
  var request = new ServiceRequest({
    type: message
  });

  if (typeof failedCallback === 'function'){
    messageDetailClient.callService(request,
      function(result) {
        callback(result.typedefs);
      },
      function(message){
        failedCallback(message);
      }
    );
  }else{
    messageDetailClient.callService(request, function(result) {
      callback(result.typedefs);
    });
  }
};

/**
 * Decode a typedefs into a dictionary like `rosmsg show foo/bar`
 *
 * @param defs - array of type_def dictionary
 */
Ros.prototype.decodeTypeDefs = function(defs) {
  var that = this;

  // calls itself recursively to resolve type definition using hints.
  var decodeTypeDefsRec = function(theType, hints) {
    var typeDefDict = {};
    for (var i = 0; i < theType.fieldnames.length; i++) {
      var arrayLen = theType.fieldarraylen[i];
      var fieldName = theType.fieldnames[i];
      var fieldType = theType.fieldtypes[i];
      if (fieldType.indexOf('/') === -1) { // check the fieldType includes '/' or not
        if (arrayLen === -1) {
          typeDefDict[fieldName] = fieldType;
        }
        else {
          typeDefDict[fieldName] = [fieldType];
        }
      }
      else {
        // lookup the name
        var sub = false;
        for (var j = 0; j < hints.length; j++) {
          if (hints[j].type.toString() === fieldType.toString()) {
            sub = hints[j];
            break;
          }
        }
        if (sub) {
          var subResult = decodeTypeDefsRec(sub, hints);
          if (arrayLen === -1) {
          }
          else {
            typeDefDict[fieldName] = [subResult];
          }
        }
        else {
          that.emit('error', 'Cannot find ' + fieldType + ' in decodeTypeDefs');
        }
      }
    }
    return typeDefDict;
  };

  return decodeTypeDefsRec(defs[0], defs);
};


module.exports = Ros;

},{"./Service":17,"./ServiceRequest":18,"./SocketAdapter.js":20,"eventemitter2":4,"object-assign":5,"ws":43}],17:[function(require,module,exports){
/**
 * @fileoverview
 * @author Brandon Alexander - baalexander@gmail.com
 */

var ServiceResponse = require('./ServiceResponse');
var ServiceRequest = require('./ServiceRequest');
var EventEmitter2 = require('eventemitter2').EventEmitter2;

/**
 * A ROS service client.
 *
 * @constructor
 * @params options - possible keys include:
 *   * ros - the ROSLIB.Ros connection handle
 *   * name - the service name, like /add_two_ints
 *   * serviceType - the service type, like 'rospy_tutorials/AddTwoInts'
 */
function Service(options) {
  options = options || {};
  this.ros = options.ros;
  this.name = options.name;
  this.serviceType = options.serviceType;
  this.isAdvertised = false;

  this._serviceCallback = null;
}
Service.prototype.__proto__ = EventEmitter2.prototype;
/**
 * Calls the service. Returns the service response in the callback.
 *
 * @param request - the ROSLIB.ServiceRequest to send
 * @param callback - function with params:
 *   * response - the response from the service request
 * @param failedCallback - the callback function when the service call failed (optional). Params:
 *   * error - the error message reported by ROS
 */
Service.prototype.callService = function(request, callback, failedCallback) {
  if (this.isAdvertised) {
    return;
  }

  var serviceCallId = 'call_service:' + this.name + ':' + (++this.ros.idCounter);

  if (callback || failedCallback) {
    this.ros.once(serviceCallId, function(message) {
      if (message.result !== undefined && message.result === false) {
        if (typeof failedCallback === 'function') {
          failedCallback(message.values);
        }
      } else if (typeof callback === 'function') {
        callback(new ServiceResponse(message.values));
      }
    });
  }

  var call = {
    op : 'call_service',
    id : serviceCallId,
    service : this.name,
    args : request
  };
  this.ros.callOnConnection(call);
};

/**
 * Every time a message is published for the given topic, the callback
 * will be called with the message object.
 *
 * @param callback - function with the following params:
 *   * message - the published message
 */
Service.prototype.advertise = function(callback) {
  if (this.isAdvertised || typeof callback !== 'function') {
    return;
  }

  this._serviceCallback = callback;
  this.ros.on(this.name, this._serviceResponse.bind(this));
  this.ros.callOnConnection({
    op: 'advertise_service',
    type: this.serviceType,
    service: this.name
  });
  this.isAdvertised = true;
};

Service.prototype.unadvertise = function() {
  if (!this.isAdvertised) {
    return;
  }
  this.ros.callOnConnection({
    op: 'unadvertise_service',
    service: this.name
  });
  this.isAdvertised = false;
};

Service.prototype._serviceResponse = function(rosbridgeRequest) {
  var response = {};
  var success = this._serviceCallback(rosbridgeRequest.args, response);

  var call = {
    op: 'service_response',
    service: this.name,
    values: new ServiceResponse(response),
    result: success
  };

  if (rosbridgeRequest.id) {
    call.id = rosbridgeRequest.id;
  }

  this.ros.callOnConnection(call);
};

module.exports = Service;
},{"./ServiceRequest":18,"./ServiceResponse":19,"eventemitter2":4}],18:[function(require,module,exports){
/**
 * @fileoverview
 * @author Brandon Alexander - balexander@willowgarage.com
 */

var assign = require('object-assign');

/**
 * A ServiceRequest is passed into the service call.
 *
 * @constructor
 * @param values - object matching the fields defined in the .srv definition file
 */
function ServiceRequest(values) {
  assign(this, values);
}

module.exports = ServiceRequest;
},{"object-assign":5}],19:[function(require,module,exports){
/**
 * @fileoverview
 * @author Brandon Alexander - balexander@willowgarage.com
 */

var assign = require('object-assign');

/**
 * A ServiceResponse is returned from the service call.
 *
 * @constructor
 * @param values - object matching the fields defined in the .srv definition file
 */
function ServiceResponse(values) {
  assign(this, values);
}

module.exports = ServiceResponse;
},{"object-assign":5}],20:[function(require,module,exports){
/**
 * Socket event handling utilities for handling events on either
 * WebSocket and TCP sockets
 *
 * Note to anyone reviewing this code: these functions are called
 * in the context of their parent object, unless bound
 * @fileOverview
 */
'use strict';

var decompressPng = require('../util/decompressPng');
var WebSocket = require('ws');
var BSON = null;
if(typeof bson !== 'undefined'){
    BSON = bson().BSON;
}

/**
 * Events listeners for a WebSocket or TCP socket to a JavaScript
 * ROS Client. Sets up Messages for a given topic to trigger an
 * event on the ROS client.
 *
 * @namespace SocketAdapter
 * @private
 */
function SocketAdapter(client) {
  function handleMessage(message) {
    if (message.op === 'publish') {
      client.emit(message.topic, message.msg);
    } else if (message.op === 'service_response') {
      client.emit(message.id, message);
    } else if (message.op === 'call_service') {
      client.emit(message.service, message);
    } else if(message.op === 'status'){
      if(message.id){
        client.emit('status:'+message.id, message);
      } else {
        client.emit('status', message);
      }
    }
  }

  function handlePng(message, callback) {
    if (message.op === 'png') {
      decompressPng(message.data, callback);
    } else {
      callback(message);
    }
  }

  function decodeBSON(data, callback) {
    if (!BSON) {
      throw 'Cannot process BSON encoded message without BSON header.';
    }
    var reader = new FileReader();
    reader.onload  = function() {
      var uint8Array = new Uint8Array(this.result);
      var msg = BSON.deserialize(uint8Array);
      callback(msg);
    };
    reader.readAsArrayBuffer(data);
  }

  return {
    /**
     * Emits a 'connection' event on WebSocket connection.
     *
     * @param event - the argument to emit with the event.
     * @memberof SocketAdapter
     */
    onopen: function onOpen(event) {
      client.isConnected = true;
      client.emit('connection', event);
    },

    /**
     * Emits a 'close' event on WebSocket disconnection.
     *
     * @param event - the argument to emit with the event.
     * @memberof SocketAdapter
     */
    onclose: function onClose(event) {
      client.isConnected = false;
      client.emit('close', event);
    },

    /**
     * Emits an 'error' event whenever there was an error.
     *
     * @param event - the argument to emit with the event.
     * @memberof SocketAdapter
     */
    onerror: function onError(event) {
      client.emit('error', event);
    },

    /**
     * Parses message responses from rosbridge and sends to the appropriate
     * topic, service, or param.
     *
     * @param message - the raw JSON message from rosbridge.
     * @memberof SocketAdapter
     */
    onmessage: function onMessage(data) {
      if (typeof Blob !== 'undefined' && data.data instanceof Blob) {
        decodeBSON(data.data, function (message) {
          handlePng(message, handleMessage);
        });
      } else {
        var message = JSON.parse(typeof data === 'string' ? data : data.data);
        handlePng(message, handleMessage);
      }
    }
  };
}

module.exports = SocketAdapter;

},{"../util/decompressPng":45,"ws":43}],21:[function(require,module,exports){
/**
 * @fileoverview
 * @author Brandon Alexander - baalexander@gmail.com
 */

var EventEmitter2 = require('eventemitter2').EventEmitter2;
var Message = require('./Message');

/**
 * Publish and/or subscribe to a topic in ROS.
 *
 * Emits the following events:
 *  * 'warning' - if there are any warning during the Topic creation
 *  * 'message' - the message data from rosbridge
 *
 * @constructor
 * @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * name - the topic name, like /cmd_vel
 *   * messageType - the message type, like 'std_msgs/String'
 *   * compression - the type of compression to use, like 'png'
 *   * throttle_rate - the rate (in ms in between messages) at which to throttle the topics
 *   * queue_size - the queue created at bridge side for re-publishing webtopics (defaults to 100)
 *   * latch - latch the topic when publishing
 *   * queue_length - the queue length at bridge side used when subscribing (defaults to 0, no queueing).
 *   * reconnect_on_close - the flag to enable resubscription and readvertisement on close event(defaults to true).
 */
function Topic(options) {
  options = options || {};
  this.ros = options.ros;
  this.name = options.name;
  this.messageType = options.messageType;
  this.isAdvertised = false;
  this.compression = options.compression || 'none';
  this.throttle_rate = options.throttle_rate || 0;
  this.latch = options.latch || false;
  this.queue_size = options.queue_size || 100;
  this.queue_length = options.queue_length || 0;
  this.reconnect_on_close = options.reconnect_on_close || true;

  // Check for valid compression types
  if (this.compression && this.compression !== 'png' &&
    this.compression !== 'none') {
    this.emit('warning', this.compression +
      ' compression is not supported. No compression will be used.');
  }

  // Check if throttle rate is negative
  if (this.throttle_rate < 0) {
    this.emit('warning', this.throttle_rate + ' is not allowed. Set to 0');
    this.throttle_rate = 0;
  }

  var that = this;
  if (this.reconnect_on_close) {
    this.callForSubscribeAndAdvertise = function(message) {
      that.ros.callOnConnection(message);

      that.waitForReconnect = false;
      that.reconnectFunc = function() {
        if(!that.waitForReconnect) {
          that.waitForReconnect = true;
          that.ros.callOnConnection(message);
          that.ros.once('connection', function() {
            that.waitForReconnect = false;
          });
        }
      };
      that.ros.on('close', that.reconnectFunc);
    };
  }
  else {
    this.callForSubscribeAndAdvertise = this.ros.callOnConnection;
  }

  this._messageCallback = function(data) {
    that.emit('message', new Message(data));
  };
}
Topic.prototype.__proto__ = EventEmitter2.prototype;

/**
 * Every time a message is published for the given topic, the callback
 * will be called with the message object.
 *
 * @param callback - function with the following params:
 *   * message - the published message
 */
Topic.prototype.subscribe = function(callback) {
  if (typeof callback === 'function') {
    this.on('message', callback);
  }

  if (this.subscribeId) { return; }
  this.ros.on(this.name, this._messageCallback);
  this.subscribeId = 'subscribe:' + this.name + ':' + (++this.ros.idCounter);

  this.callForSubscribeAndAdvertise({
    op: 'subscribe',
    id: this.subscribeId,
    type: this.messageType,
    topic: this.name,
    compression: this.compression,
    throttle_rate: this.throttle_rate,
    queue_length: this.queue_length
  });
};

/**
 * Unregisters as a subscriber for the topic. Unsubscribing stop remove
 * all subscribe callbacks. To remove a call back, you must explicitly
 * pass the callback function in.
 *
 * @param callback - the optional callback to unregister, if
 *     * provided and other listeners are registered the topic won't
 *     * unsubscribe, just stop emitting to the passed listener
 */
Topic.prototype.unsubscribe = function(callback) {
  if (callback) {
    this.off('message', callback);
    // If there is any other callbacks still subscribed don't unsubscribe
    if (this.listeners('message').length) { return; }
  }
  if (!this.subscribeId) { return; }
  // Note: Don't call this.removeAllListeners, allow client to handle that themselves
  this.ros.off(this.name, this._messageCallback);
  if(this.reconnect_on_close) {
    this.ros.off('close', this.reconnectFunc);
  }
  this.emit('unsubscribe');
  this.ros.callOnConnection({
    op: 'unsubscribe',
    id: this.subscribeId,
    topic: this.name
  });
  this.subscribeId = null;
};


/**
 * Registers as a publisher for the topic.
 */
Topic.prototype.advertise = function() {
  if (this.isAdvertised) {
    return;
  }
  this.advertiseId = 'advertise:' + this.name + ':' + (++this.ros.idCounter);
  this.callForSubscribeAndAdvertise({
    op: 'advertise',
    id: this.advertiseId,
    type: this.messageType,
    topic: this.name,
    latch: this.latch,
    queue_size: this.queue_size
  });
  this.isAdvertised = true;

  if(!this.reconnect_on_close) {
    var that = this;
    this.ros.on('close', function() {
      that.isAdvertised = false;
    });
  }
};

/**
 * Unregisters as a publisher for the topic.
 */
Topic.prototype.unadvertise = function() {
  if (!this.isAdvertised) {
    return;
  }
  if(this.reconnect_on_close) {
    this.ros.off('close', this.reconnectFunc);
  }
  this.emit('unadvertise');
  this.ros.callOnConnection({
    op: 'unadvertise',
    id: this.advertiseId,
    topic: this.name
  });
  this.isAdvertised = false;
};

/**
 * Publish the message.
 *
 * @param message - A ROSLIB.Message object.
 */
Topic.prototype.publish = function(message) {
  if (!this.isAdvertised) {
    this.advertise();
  }

  this.ros.idCounter++;
  var call = {
    op: 'publish',
    id: 'publish:' + this.name + ':' + this.ros.idCounter,
    topic: this.name,
    msg: message,
    latch: this.latch
  };
  this.ros.callOnConnection(call);
};

module.exports = Topic;

},{"./Message":14,"eventemitter2":4}],22:[function(require,module,exports){
var mixin = require('../mixin');

var core = module.exports = {
    Ros: require('./Ros'),
    Topic: require('./Topic'),
    Message: require('./Message'),
    Param: require('./Param'),
    Service: require('./Service'),
    ServiceRequest: require('./ServiceRequest'),
    ServiceResponse: require('./ServiceResponse')
};

mixin(core.Ros, ['Param', 'Service', 'Topic'], core);

},{"../mixin":28,"./Message":14,"./Param":15,"./Ros":16,"./Service":17,"./ServiceRequest":18,"./ServiceResponse":19,"./Topic":21}],23:[function(require,module,exports){
/**
 * @fileoverview
 * @author David Gossow - dgossow@willowgarage.com
 */

var Vector3 = require('./Vector3');
var Quaternion = require('./Quaternion');

/**
 * A Pose in 3D space. Values are copied into this object.
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * position - the Vector3 describing the position
 *   * orientation - the ROSLIB.Quaternion describing the orientation
 */
function Pose(options) {
  options = options || {};
  // copy the values into this object if they exist
  this.position = new Vector3(options.position);
  this.orientation = new Quaternion(options.orientation);
}

/**
 * Apply a transform against this pose.
 *
 * @param tf the transform
 */
Pose.prototype.applyTransform = function(tf) {
  this.position.multiplyQuaternion(tf.rotation);
  this.position.add(tf.translation);
  var tmp = tf.rotation.clone();
  tmp.multiply(this.orientation);
  this.orientation = tmp;
};

/**
 * Clone a copy of this pose.
 *
 * @returns the cloned pose
 */
Pose.prototype.clone = function() {
  return new Pose(this);
};

module.exports = Pose;
},{"./Quaternion":24,"./Vector3":26}],24:[function(require,module,exports){
/**
 * @fileoverview
 * @author David Gossow - dgossow@willowgarage.com
 */

/**
 * A Quaternion.
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * x - the x value
 *   * y - the y value
 *   * z - the z value
 *   * w - the w value
 */
function Quaternion(options) {
  options = options || {};
  this.x = options.x || 0;
  this.y = options.y || 0;
  this.z = options.z || 0;
  this.w = (typeof options.w === 'number') ? options.w : 1;
}

/**
 * Perform a conjugation on this quaternion.
 */
Quaternion.prototype.conjugate = function() {
  this.x *= -1;
  this.y *= -1;
  this.z *= -1;
};

/**
 * Return the norm of this quaternion.
 */
Quaternion.prototype.norm = function() {
  return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
};

/**
 * Perform a normalization on this quaternion.
 */
Quaternion.prototype.normalize = function() {
  var l = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  if (l === 0) {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 1;
  } else {
    l = 1 / l;
    this.x = this.x * l;
    this.y = this.y * l;
    this.z = this.z * l;
    this.w = this.w * l;
  }
};

/**
 * Convert this quaternion into its inverse.
 */
Quaternion.prototype.invert = function() {
  this.conjugate();
  this.normalize();
};

/**
 * Set the values of this quaternion to the product of itself and the given quaternion.
 *
 * @param q the quaternion to multiply with
 */
Quaternion.prototype.multiply = function(q) {
  var newX = this.x * q.w + this.y * q.z - this.z * q.y + this.w * q.x;
  var newY = -this.x * q.z + this.y * q.w + this.z * q.x + this.w * q.y;
  var newZ = this.x * q.y - this.y * q.x + this.z * q.w + this.w * q.z;
  var newW = -this.x * q.x - this.y * q.y - this.z * q.z + this.w * q.w;
  this.x = newX;
  this.y = newY;
  this.z = newZ;
  this.w = newW;
};

/**
 * Clone a copy of this quaternion.
 *
 * @returns the cloned quaternion
 */
Quaternion.prototype.clone = function() {
  return new Quaternion(this);
};

module.exports = Quaternion;

},{}],25:[function(require,module,exports){
/**
 * @fileoverview
 * @author David Gossow - dgossow@willowgarage.com
 */

var Vector3 = require('./Vector3');
var Quaternion = require('./Quaternion');

/**
 * A Transform in 3-space. Values are copied into this object.
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * translation - the Vector3 describing the translation
 *   * rotation - the ROSLIB.Quaternion describing the rotation
 */
function Transform(options) {
  options = options || {};
  // Copy the values into this object if they exist
  this.translation = new Vector3(options.translation);
  this.rotation = new Quaternion(options.rotation);
}

/**
 * Clone a copy of this transform.
 *
 * @returns the cloned transform
 */
Transform.prototype.clone = function() {
  return new Transform(this);
};

module.exports = Transform;
},{"./Quaternion":24,"./Vector3":26}],26:[function(require,module,exports){
/**
 * @fileoverview
 * @author David Gossow - dgossow@willowgarage.com
 */

/**
 * A 3D vector.
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * x - the x value
 *   * y - the y value
 *   * z - the z value
 */
function Vector3(options) {
  options = options || {};
  this.x = options.x || 0;
  this.y = options.y || 0;
  this.z = options.z || 0;
}

/**
 * Set the values of this vector to the sum of itself and the given vector.
 *
 * @param v the vector to add with
 */
Vector3.prototype.add = function(v) {
  this.x += v.x;
  this.y += v.y;
  this.z += v.z;
};

/**
 * Set the values of this vector to the difference of itself and the given vector.
 *
 * @param v the vector to subtract with
 */
Vector3.prototype.subtract = function(v) {
  this.x -= v.x;
  this.y -= v.y;
  this.z -= v.z;
};

/**
 * Multiply the given Quaternion with this vector.
 *
 * @param q - the quaternion to multiply with
 */
Vector3.prototype.multiplyQuaternion = function(q) {
  var ix = q.w * this.x + q.y * this.z - q.z * this.y;
  var iy = q.w * this.y + q.z * this.x - q.x * this.z;
  var iz = q.w * this.z + q.x * this.y - q.y * this.x;
  var iw = -q.x * this.x - q.y * this.y - q.z * this.z;
  this.x = ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y;
  this.y = iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z;
  this.z = iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x;
};

/**
 * Clone a copy of this vector.
 *
 * @returns the cloned vector
 */
Vector3.prototype.clone = function() {
  return new Vector3(this);
};

module.exports = Vector3;
},{}],27:[function(require,module,exports){
module.exports = {
    Pose: require('./Pose'),
    Quaternion: require('./Quaternion'),
    Transform: require('./Transform'),
    Vector3: require('./Vector3')
};

},{"./Pose":23,"./Quaternion":24,"./Transform":25,"./Vector3":26}],28:[function(require,module,exports){
/**
 * Mixin a feature to the core/Ros prototype.
 * For example, mixin(Ros, ['Topic'], {Topic: <Topic>})
 * will add a topic bound to any Ros instances so a user
 * can call `var topic = ros.Topic({name: '/foo'});`
 *
 * @author Graeme Yeates - github.com/megawac
 */
module.exports = function(Ros, classes, features) {
    classes.forEach(function(className) {
        var Class = features[className];
        Ros.prototype[className] = function(options) {
            options.ros = this;
            return new Class(options);
        };
    });
};

},{}],29:[function(require,module,exports){
/**
 * @fileoverview
 * @author David Gossow - dgossow@willowgarage.com
 */

var ActionClient = require('../actionlib/ActionClient');
var Goal = require('../actionlib/Goal');

var Service = require('../core/Service.js');
var ServiceRequest = require('../core/ServiceRequest.js');

var Transform = require('../math/Transform');

/**
 * A TF Client that listens to TFs from tf2_web_republisher.
 *
 *  @constructor
 *  @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * fixedFrame - the fixed frame, like /base_link
 *   * angularThres - the angular threshold for the TF republisher
 *   * transThres - the translation threshold for the TF republisher
 *   * rate - the rate for the TF republisher
 *   * updateDelay - the time (in ms) to wait after a new subscription
 *                   to update the TF republisher's list of TFs
 *   * topicTimeout - the timeout parameter for the TF republisher
 *   * serverName (optional) - the name of the tf2_web_republisher server
 *   * repubServiceName (optional) - the name of the republish_tfs service (non groovy compatibility mode only)
 *   																 default: '/republish_tfs'
 */
function TFClient(options) {
  options = options || {};
  this.ros = options.ros;
  this.fixedFrame = options.fixedFrame || '/base_link';
  this.angularThres = options.angularThres || 2.0;
  this.transThres = options.transThres || 0.01;
  this.rate = options.rate || 10.0;
  this.updateDelay = options.updateDelay || 50;
  var seconds = options.topicTimeout || 2.0;
  var secs = Math.floor(seconds);
  var nsecs = Math.floor((seconds - secs) * 1000000000);
  this.topicTimeout = {
    secs: secs,
    nsecs: nsecs
  };
  this.serverName = options.serverName || '/tf2_web_republisher';
  this.repubServiceName = options.repubServiceName || '/republish_tfs';

  this.currentGoal = false;
  this.currentTopic = false;
  this.frameInfos = {};
  this.republisherUpdateRequested = false;

  // Create an Action client
  this.actionClient = this.ros.ActionClient({
    serverName : this.serverName,
    actionName : 'tf2_web_republisher/TFSubscriptionAction',
    omitStatus : true,
    omitResult : true
  });

  // Create a Service client
  this.serviceClient = this.ros.Service({
    name: this.repubServiceName,
    serviceType: 'tf2_web_republisher/RepublishTFs'
  });
}

/**
 * Process the incoming TF message and send them out using the callback
 * functions.
 *
 * @param tf - the TF message from the server
 */
TFClient.prototype.processTFArray = function(tf) {
  var that = this;
  tf.transforms.forEach(function(transform) {
    var frameID = transform.child_frame_id;
    if (frameID[0] === '/')
    {
      frameID = frameID.substring(1);
    }
    var info = this.frameInfos[frameID];
    if (info) {
      info.transform = new Transform({
        translation : transform.transform.translation,
        rotation : transform.transform.rotation
      });
      info.cbs.forEach(function(cb) {
        cb(info.transform);
      });
    }
  }, this);
};

/**
 * Create and send a new goal (or service request) to the tf2_web_republisher
 * based on the current list of TFs.
 */
TFClient.prototype.updateGoal = function() {
  var goalMessage = {
    source_frames : Object.keys(this.frameInfos),
    target_frame : this.fixedFrame,
    angular_thres : this.angularThres,
    trans_thres : this.transThres,
    rate : this.rate
  };

  // if we're running in groovy compatibility mode (the default)
  // then use the action interface to tf2_web_republisher
  if(this.ros.groovyCompatibility) {
    if (this.currentGoal) {
      this.currentGoal.cancel();
    }
    this.currentGoal = new Goal({
      actionClient : this.actionClient,
      goalMessage : goalMessage
    });

    this.currentGoal.on('feedback', this.processTFArray.bind(this));
    this.currentGoal.send();
  }
  else {
    // otherwise, use the service interface
    // The service interface has the same parameters as the action,
    // plus the timeout
    goalMessage.timeout = this.topicTimeout;
    var request = new ServiceRequest(goalMessage);

    this.serviceClient.callService(request, this.processResponse.bind(this));
  }

  this.republisherUpdateRequested = false;
};

/**
 * Process the service response and subscribe to the tf republisher
 * topic
 *
 * @param response the service response containing the topic name
 */
TFClient.prototype.processResponse = function(response) {
  // if we subscribed to a topic before, unsubscribe so
  // the republisher stops publishing it
  if (this.currentTopic) {
    this.currentTopic.unsubscribe();
  }

  this.currentTopic = this.ros.Topic({
    name: response.topic_name,
    messageType: 'tf2_web_republisher/TFArray'
  });
  this.currentTopic.subscribe(this.processTFArray.bind(this));
};

/**
 * Subscribe to the given TF frame.
 *
 * @param frameID - the TF frame to subscribe to
 * @param callback - function with params:
 *   * transform - the transform data
 */
TFClient.prototype.subscribe = function(frameID, callback) {
  // remove leading slash, if it's there
  if (frameID[0] === '/')
  {
    frameID = frameID.substring(1);
  }
  // if there is no callback registered for the given frame, create emtpy callback list
  if (!this.frameInfos[frameID]) {
    this.frameInfos[frameID] = {
      cbs: []
    };
    if (!this.republisherUpdateRequested) {
      setTimeout(this.updateGoal.bind(this), this.updateDelay);
      this.republisherUpdateRequested = true;
    }
  }
  // if we already have a transform, call back immediately
  else if (this.frameInfos[frameID].transform) {
    callback(this.frameInfos[frameID].transform);
  }
  this.frameInfos[frameID].cbs.push(callback);
};

/**
 * Unsubscribe from the given TF frame.
 *
 * @param frameID - the TF frame to unsubscribe from
 * @param callback - the callback function to remove
 */
TFClient.prototype.unsubscribe = function(frameID, callback) {
  // remove leading slash, if it's there
  if (frameID[0] === '/')
  {
    frameID = frameID.substring(1);
  }
  var info = this.frameInfos[frameID];
  for (var cbs = info && info.cbs || [], idx = cbs.length; idx--;) {
    if (cbs[idx] === callback) {
      cbs.splice(idx, 1);
    }
  }
  if (!callback || cbs.length === 0) {
    delete this.frameInfos[frameID];
  }
};

/**
 * Unsubscribe and unadvertise all topics associated with this TFClient.
 */
TFClient.prototype.dispose = function() {
  this.actionClient.dispose();
  if (this.currentTopic) {
    this.currentTopic.unsubscribe();
  }
};

module.exports = TFClient;

},{"../actionlib/ActionClient":9,"../actionlib/Goal":11,"../core/Service.js":17,"../core/ServiceRequest.js":18,"../math/Transform":25}],30:[function(require,module,exports){
var Ros = require('../core/Ros');
var mixin = require('../mixin');

var tf = module.exports = {
    TFClient: require('./TFClient')
};

mixin(Ros, ['TFClient'], tf);
},{"../core/Ros":16,"../mixin":28,"./TFClient":29}],31:[function(require,module,exports){
/**
 * @fileOverview 
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

var Vector3 = require('../math/Vector3');
var UrdfTypes = require('./UrdfTypes');

/**
 * A Box element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
function UrdfBox(options) {
  this.dimension = null;
  this.type = UrdfTypes.URDF_BOX;

  // Parse the xml string
  var xyz = options.xml.getAttribute('size').split(' ');
  this.dimension = new Vector3({
    x : parseFloat(xyz[0]),
    y : parseFloat(xyz[1]),
    z : parseFloat(xyz[2])
  });
}

module.exports = UrdfBox;
},{"../math/Vector3":26,"./UrdfTypes":40}],32:[function(require,module,exports){
/**
 * @fileOverview 
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A Color element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
function UrdfColor(options) {
  // Parse the xml string
  var rgba = options.xml.getAttribute('rgba').split(' ');
  this.r = parseFloat(rgba[0]);
  this.g = parseFloat(rgba[1]);
  this.b = parseFloat(rgba[2]);
  this.a = parseFloat(rgba[3]);
}

module.exports = UrdfColor;
},{}],33:[function(require,module,exports){
/**
 * @fileOverview 
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

var UrdfTypes = require('./UrdfTypes');

/**
 * A Cylinder element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
function UrdfCylinder(options) {
  this.type = UrdfTypes.URDF_CYLINDER;
  this.length = parseFloat(options.xml.getAttribute('length'));
  this.radius = parseFloat(options.xml.getAttribute('radius'));
}

module.exports = UrdfCylinder;
},{"./UrdfTypes":40}],34:[function(require,module,exports){
/**
 * @fileOverview
 * @author David V. Lu!!  davidvlu@gmail.com
 */

/**
 * A Joint element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
function UrdfJoint(options) {
  this.name = options.xml.getAttribute('name');
  this.type = options.xml.getAttribute('type');

  var parents = options.xml.getElementsByTagName('parent');
  if(parents.length > 0) {
    this.parent = parents[0].getAttribute('link');
  }

  var children = options.xml.getElementsByTagName('child');
  if(children.length > 0) {
    this.child = children[0].getAttribute('link');
  }

  var limits = options.xml.getElementsByTagName('limit');
  if (limits.length > 0) {
    this.minval = parseFloat( limits[0].getAttribute('lower') );
    this.maxval = parseFloat( limits[0].getAttribute('upper') );
  }
}

module.exports = UrdfJoint;

},{}],35:[function(require,module,exports){
/**
 * @fileOverview 
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

var UrdfVisual = require('./UrdfVisual');

/**
 * A Link element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
function UrdfLink(options) {
  this.name = options.xml.getAttribute('name');
  this.visuals = [];
  var visuals = options.xml.getElementsByTagName('visual');

  for( var i=0; i<visuals.length; i++ ) {
    this.visuals.push( new UrdfVisual({
      xml : visuals[i]
    }) );
  }
}

module.exports = UrdfLink;
},{"./UrdfVisual":41}],36:[function(require,module,exports){
/**
 * @fileOverview 
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

var UrdfColor = require('./UrdfColor');

/**
 * A Material element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
function UrdfMaterial(options) {
  this.textureFilename = null;
  this.color = null;

  this.name = options.xml.getAttribute('name');

  // Texture
  var textures = options.xml.getElementsByTagName('texture');
  if (textures.length > 0) {
    this.textureFilename = textures[0].getAttribute('filename');
  }

  // Color
  var colors = options.xml.getElementsByTagName('color');
  if (colors.length > 0) {
    // Parse the RBGA string
    this.color = new UrdfColor({
      xml : colors[0]
    });
  }
}

UrdfMaterial.prototype.isLink = function() {
  return this.color === null && this.textureFilename === null;
};

var assign = require('object-assign');

UrdfMaterial.prototype.assign = function(obj) {
    return assign(this, obj);
};

module.exports = UrdfMaterial;

},{"./UrdfColor":32,"object-assign":5}],37:[function(require,module,exports){
/**
 * @fileOverview 
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

var Vector3 = require('../math/Vector3');
var UrdfTypes = require('./UrdfTypes');

/**
 * A Mesh element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
function UrdfMesh(options) {
  this.scale = null;

  this.type = UrdfTypes.URDF_MESH;
  this.filename = options.xml.getAttribute('filename');

  // Check for a scale
  var scale = options.xml.getAttribute('scale');
  if (scale) {
    // Get the XYZ
    var xyz = scale.split(' ');
    this.scale = new Vector3({
      x : parseFloat(xyz[0]),
      y : parseFloat(xyz[1]),
      z : parseFloat(xyz[2])
    });
  }
}

module.exports = UrdfMesh;
},{"../math/Vector3":26,"./UrdfTypes":40}],38:[function(require,module,exports){
/**
 * @fileOverview 
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

var UrdfMaterial = require('./UrdfMaterial');
var UrdfLink = require('./UrdfLink');
var UrdfJoint = require('./UrdfJoint');
var DOMParser = require('xmldom').DOMParser;

// See https://developer.mozilla.org/docs/XPathResult#Constants
var XPATH_FIRST_ORDERED_NODE_TYPE = 9;

/**
 * A URDF Model can be used to parse a given URDF into the appropriate elements.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 *  * string - the XML element to parse as a string
 */
function UrdfModel(options) {
  options = options || {};
  var xmlDoc = options.xml;
  var string = options.string;
  this.materials = {};
  this.links = {};
  this.joints = {};

  // Check if we are using a string or an XML element
  if (string) {
    // Parse the string
    var parser = new DOMParser();
    xmlDoc = parser.parseFromString(string, 'text/xml');
  }

  // Initialize the model with the given XML node.
  // Get the robot tag
  var robotXml = xmlDoc.documentElement;

  // Get the robot name
  this.name = robotXml.getAttribute('name');

  // Parse all the visual elements we need
  for (var nodes = robotXml.childNodes, i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.tagName === 'material') {
      var material = new UrdfMaterial({
        xml : node
      });
      // Make sure this is unique
      if (this.materials[material.name] !== void 0) {
        if( this.materials[material.name].isLink() ) {
          this.materials[material.name].assign( material );
        } else {
          console.warn('Material ' + material.name + 'is not unique.');
        }
      } else {
        this.materials[material.name] = material;
      }
    } else if (node.tagName === 'link') {
      var link = new UrdfLink({
        xml : node
      });
      // Make sure this is unique
      if (this.links[link.name] !== void 0) {
        console.warn('Link ' + link.name + ' is not unique.');
      } else {
        // Check for a material
        for( var j=0; j<link.visuals.length; j++ )
        {
          var mat = link.visuals[j].material; 
          if ( mat !== null ) {
            if (this.materials[mat.name] !== void 0) {
              link.visuals[j].material = this.materials[mat.name];
            } else {
              this.materials[mat.name] = mat;
            }
          }
        }

        // Add the link
        this.links[link.name] = link;
      }
    } else if (node.tagName === 'joint') {
      var joint = new UrdfJoint({
        xml : node
      });
      this.joints[joint.name] = joint;
    }
  }
}

module.exports = UrdfModel;

},{"./UrdfJoint":34,"./UrdfLink":35,"./UrdfMaterial":36,"xmldom":46}],39:[function(require,module,exports){
/**
 * @fileOverview 
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

var UrdfTypes = require('./UrdfTypes');

/**
 * A Sphere element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
function UrdfSphere(options) {
  this.type = UrdfTypes.URDF_SPHERE;
  this.radius = parseFloat(options.xml.getAttribute('radius'));
}

module.exports = UrdfSphere;
},{"./UrdfTypes":40}],40:[function(require,module,exports){
module.exports = {
	URDF_SPHERE : 0,
	URDF_BOX : 1,
	URDF_CYLINDER : 2,
	URDF_MESH : 3
};

},{}],41:[function(require,module,exports){
/**
 * @fileOverview 
 * @author Benjamin Pitzer - ben.pitzer@gmail.com
 * @author Russell Toris - rctoris@wpi.edu
 */

var Pose = require('../math/Pose');
var Vector3 = require('../math/Vector3');
var Quaternion = require('../math/Quaternion');

var UrdfCylinder = require('./UrdfCylinder');
var UrdfBox = require('./UrdfBox');
var UrdfMaterial = require('./UrdfMaterial');
var UrdfMesh = require('./UrdfMesh');
var UrdfSphere = require('./UrdfSphere');

/**
 * A Visual element in a URDF.
 *
 * @constructor
 * @param options - object with following keys:
 *  * xml - the XML element to parse
 */
function UrdfVisual(options) {
  var xml = options.xml;
  this.origin = null;
  this.geometry = null;
  this.material = null;

  // Origin
  var origins = xml.getElementsByTagName('origin');
  if (origins.length === 0) {
    // use the identity as the default
    this.origin = new Pose();
  } else {
    // Check the XYZ
    var xyz = origins[0].getAttribute('xyz');
    var position = new Vector3();
    if (xyz) {
      xyz = xyz.split(' ');
      position = new Vector3({
        x : parseFloat(xyz[0]),
        y : parseFloat(xyz[1]),
        z : parseFloat(xyz[2])
      });
    }

    // Check the RPY
    var rpy = origins[0].getAttribute('rpy');
    var orientation = new Quaternion();
    if (rpy) {
      rpy = rpy.split(' ');
      // Convert from RPY
      var roll = parseFloat(rpy[0]);
      var pitch = parseFloat(rpy[1]);
      var yaw = parseFloat(rpy[2]);
      var phi = roll / 2.0;
      var the = pitch / 2.0;
      var psi = yaw / 2.0;
      var x = Math.sin(phi) * Math.cos(the) * Math.cos(psi) - Math.cos(phi) * Math.sin(the)
          * Math.sin(psi);
      var y = Math.cos(phi) * Math.sin(the) * Math.cos(psi) + Math.sin(phi) * Math.cos(the)
          * Math.sin(psi);
      var z = Math.cos(phi) * Math.cos(the) * Math.sin(psi) - Math.sin(phi) * Math.sin(the)
          * Math.cos(psi);
      var w = Math.cos(phi) * Math.cos(the) * Math.cos(psi) + Math.sin(phi) * Math.sin(the)
          * Math.sin(psi);

      orientation = new Quaternion({
        x : x,
        y : y,
        z : z,
        w : w
      });
      orientation.normalize();
    }
    this.origin = new Pose({
      position : position,
      orientation : orientation
    });
  }

  // Geometry
  var geoms = xml.getElementsByTagName('geometry');
  if (geoms.length > 0) {
    var geom = geoms[0];
    var shape = null;
    // Check for the shape
    for (var i = 0; i < geom.childNodes.length; i++) {
      var node = geom.childNodes[i];
      if (node.nodeType === 1) {
        shape = node;
        break;
      }
    }
    // Check the type
    var type = shape.nodeName;
    if (type === 'sphere') {
      this.geometry = new UrdfSphere({
        xml : shape
      });
    } else if (type === 'box') {
      this.geometry = new UrdfBox({
        xml : shape
      });
    } else if (type === 'cylinder') {
      this.geometry = new UrdfCylinder({
        xml : shape
      });
    } else if (type === 'mesh') {
      this.geometry = new UrdfMesh({
        xml : shape
      });
    } else {
      console.warn('Unknown geometry type ' + type);
    }
  }

  // Material
  var materials = xml.getElementsByTagName('material');
  if (materials.length > 0) {
    this.material = new UrdfMaterial({
      xml : materials[0]
    });
  }
}

module.exports = UrdfVisual;
},{"../math/Pose":23,"../math/Quaternion":24,"../math/Vector3":26,"./UrdfBox":31,"./UrdfCylinder":33,"./UrdfMaterial":36,"./UrdfMesh":37,"./UrdfSphere":39}],42:[function(require,module,exports){
module.exports = require('object-assign')({
    UrdfBox: require('./UrdfBox'),
    UrdfColor: require('./UrdfColor'),
    UrdfCylinder: require('./UrdfCylinder'),
    UrdfLink: require('./UrdfLink'),
    UrdfMaterial: require('./UrdfMaterial'),
    UrdfMesh: require('./UrdfMesh'),
    UrdfModel: require('./UrdfModel'),
    UrdfSphere: require('./UrdfSphere'),
    UrdfVisual: require('./UrdfVisual')
}, require('./UrdfTypes'));

},{"./UrdfBox":31,"./UrdfColor":32,"./UrdfCylinder":33,"./UrdfLink":35,"./UrdfMaterial":36,"./UrdfMesh":37,"./UrdfModel":38,"./UrdfSphere":39,"./UrdfTypes":40,"./UrdfVisual":41,"object-assign":5}],43:[function(require,module,exports){
(function (global){
module.exports = global.WebSocket;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],44:[function(require,module,exports){
/* global document */
module.exports = function Canvas() {
	return document.createElement('canvas');
};
},{}],45:[function(require,module,exports){
(function (global){
/**
 * @fileOverview
 * @author Graeme Yeates - github.com/megawac
 */

'use strict';

var Canvas = require('canvas');
var Image = Canvas.Image || global.Image;

/**
 * If a message was compressed as a PNG image (a compression hack since
 * gzipping over WebSockets * is not supported yet), this function places the
 * "image" in a canvas element then decodes the * "image" as a Base64 string.
 *
 * @private
 * @param data - object containing the PNG data.
 * @param callback - function with params:
 *   * data - the uncompressed data
 */
function decompressPng(data, callback) {
  // Uncompresses the data before sending it through (use image/canvas to do so).
  var image = new Image();
  // When the image loads, extracts the raw data (JSON message).
  image.onload = function() {
    // Creates a local canvas to draw on.
    var canvas = new Canvas();
    var context = canvas.getContext('2d');

    // Sets width and height.
    canvas.width = image.width;
    canvas.height = image.height;

    // Prevents anti-aliasing and loosing data
    context.imageSmoothingEnabled = false;
    context.webkitImageSmoothingEnabled = false;
    context.mozImageSmoothingEnabled = false;

    // Puts the data into the image.
    context.drawImage(image, 0, 0);
    // Grabs the raw, uncompressed data.
    var imageData = context.getImageData(0, 0, image.width, image.height).data;

    // Constructs the JSON.
    var jsonData = '';
    for (var i = 0; i < imageData.length; i += 4) {
      // RGB
      jsonData += String.fromCharCode(imageData[i], imageData[i + 1], imageData[i + 2]);
    }
    callback(JSON.parse(jsonData));
  };
  // Sends the image data to load.
  image.src = 'data:image/png;base64,' + data;
}

module.exports = decompressPng;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"canvas":44}],46:[function(require,module,exports){
(function (global){
exports.DOMImplementation = global.DOMImplementation;
exports.XMLSerializer = global.XMLSerializer;
exports.DOMParser = global.DOMParser;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],47:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _ponyfill = require('./ponyfill.js');

var _ponyfill2 = _interopRequireDefault(_ponyfill);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var root; /* global window */


if (typeof self !== 'undefined') {
  root = self;
} else if (typeof window !== 'undefined') {
  root = window;
} else if (typeof global !== 'undefined') {
  root = global;
} else if (typeof module !== 'undefined') {
  root = module;
} else {
  root = Function('return this')();
}

var result = (0, _ponyfill2['default'])(root);
exports['default'] = result;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./ponyfill.js":48}],48:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports['default'] = symbolObservablePonyfill;
function symbolObservablePonyfill(root) {
	var result;
	var _Symbol = root.Symbol;

	if (typeof _Symbol === 'function') {
		if (_Symbol.observable) {
			result = _Symbol.observable;
		} else {
			result = _Symbol('observable');
			_Symbol.observable = result;
		}
	} else {
		result = '@@observable';
	}

	return result;
};
},{}],49:[function(require,module,exports){
(function (setImmediate,clearImmediate){
var nextTick = require('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this,require("timers").setImmediate,require("timers").clearImmediate)

},{"process/browser.js":6,"timers":49}],50:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("../index");
var DOMEventProducer = /** @class */ (function () {
    function DOMEventProducer(node, eventType, useCapture) {
        this.node = node;
        this.eventType = eventType;
        this.useCapture = useCapture;
        this.type = 'fromEvent';
    }
    DOMEventProducer.prototype._start = function (out) {
        this.listener = function (e) { return out._n(e); };
        this.node.addEventListener(this.eventType, this.listener, this.useCapture);
    };
    DOMEventProducer.prototype._stop = function () {
        this.node.removeEventListener(this.eventType, this.listener, this.useCapture);
        this.listener = null;
    };
    return DOMEventProducer;
}());
exports.DOMEventProducer = DOMEventProducer;
var NodeEventProducer = /** @class */ (function () {
    function NodeEventProducer(node, eventName) {
        this.node = node;
        this.eventName = eventName;
        this.type = 'fromEvent';
    }
    NodeEventProducer.prototype._start = function (out) {
        this.listener = function () {
            var args = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }
            return (args.length > 1) ? out._n(args) : out._n(args[0]);
        };
        this.node.addListener(this.eventName, this.listener);
    };
    NodeEventProducer.prototype._stop = function () {
        this.node.removeListener(this.eventName, this.listener);
        this.listener = null;
    };
    return NodeEventProducer;
}());
exports.NodeEventProducer = NodeEventProducer;
function isEmitter(element) {
    return element.emit && element.addListener;
}
function fromEvent(element, eventName, useCapture) {
    if (useCapture === void 0) { useCapture = false; }
    if (isEmitter(element)) {
        return new index_1.Stream(new NodeEventProducer(element, eventName));
    }
    else {
        return new index_1.Stream(new DOMEventProducer(element, eventName, useCapture));
    }
}
exports.default = fromEvent;

},{"../index":51}],51:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var symbol_observable_1 = require("symbol-observable");
var NO = {};
exports.NO = NO;
function noop() { }
function cp(a) {
    var l = a.length;
    var b = Array(l);
    for (var i = 0; i < l; ++i)
        b[i] = a[i];
    return b;
}
function and(f1, f2) {
    return function andFn(t) {
        return f1(t) && f2(t);
    };
}
function _try(c, t, u) {
    try {
        return c.f(t);
    }
    catch (e) {
        u._e(e);
        return NO;
    }
}
var NO_IL = {
    _n: noop,
    _e: noop,
    _c: noop,
};
exports.NO_IL = NO_IL;
// mutates the input
function internalizeProducer(producer) {
    producer._start = function _start(il) {
        il.next = il._n;
        il.error = il._e;
        il.complete = il._c;
        this.start(il);
    };
    producer._stop = producer.stop;
}
var StreamSub = /** @class */ (function () {
    function StreamSub(_stream, _listener) {
        this._stream = _stream;
        this._listener = _listener;
    }
    StreamSub.prototype.unsubscribe = function () {
        this._stream._remove(this._listener);
    };
    return StreamSub;
}());
var Observer = /** @class */ (function () {
    function Observer(_listener) {
        this._listener = _listener;
    }
    Observer.prototype.next = function (value) {
        this._listener._n(value);
    };
    Observer.prototype.error = function (err) {
        this._listener._e(err);
    };
    Observer.prototype.complete = function () {
        this._listener._c();
    };
    return Observer;
}());
var FromObservable = /** @class */ (function () {
    function FromObservable(observable) {
        this.type = 'fromObservable';
        this.ins = observable;
        this.active = false;
    }
    FromObservable.prototype._start = function (out) {
        this.out = out;
        this.active = true;
        this._sub = this.ins.subscribe(new Observer(out));
        if (!this.active)
            this._sub.unsubscribe();
    };
    FromObservable.prototype._stop = function () {
        if (this._sub)
            this._sub.unsubscribe();
        this.active = false;
    };
    return FromObservable;
}());
var Merge = /** @class */ (function () {
    function Merge(insArr) {
        this.type = 'merge';
        this.insArr = insArr;
        this.out = NO;
        this.ac = 0;
    }
    Merge.prototype._start = function (out) {
        this.out = out;
        var s = this.insArr;
        var L = s.length;
        this.ac = L;
        for (var i = 0; i < L; i++)
            s[i]._add(this);
    };
    Merge.prototype._stop = function () {
        var s = this.insArr;
        var L = s.length;
        for (var i = 0; i < L; i++)
            s[i]._remove(this);
        this.out = NO;
    };
    Merge.prototype._n = function (t) {
        var u = this.out;
        if (u === NO)
            return;
        u._n(t);
    };
    Merge.prototype._e = function (err) {
        var u = this.out;
        if (u === NO)
            return;
        u._e(err);
    };
    Merge.prototype._c = function () {
        if (--this.ac <= 0) {
            var u = this.out;
            if (u === NO)
                return;
            u._c();
        }
    };
    return Merge;
}());
var CombineListener = /** @class */ (function () {
    function CombineListener(i, out, p) {
        this.i = i;
        this.out = out;
        this.p = p;
        p.ils.push(this);
    }
    CombineListener.prototype._n = function (t) {
        var p = this.p, out = this.out;
        if (out === NO)
            return;
        if (p.up(t, this.i)) {
            var a = p.vals;
            var l = a.length;
            var b = Array(l);
            for (var i = 0; i < l; ++i)
                b[i] = a[i];
            out._n(b);
        }
    };
    CombineListener.prototype._e = function (err) {
        var out = this.out;
        if (out === NO)
            return;
        out._e(err);
    };
    CombineListener.prototype._c = function () {
        var p = this.p;
        if (p.out === NO)
            return;
        if (--p.Nc === 0)
            p.out._c();
    };
    return CombineListener;
}());
var Combine = /** @class */ (function () {
    function Combine(insArr) {
        this.type = 'combine';
        this.insArr = insArr;
        this.out = NO;
        this.ils = [];
        this.Nc = this.Nn = 0;
        this.vals = [];
    }
    Combine.prototype.up = function (t, i) {
        var v = this.vals[i];
        var Nn = !this.Nn ? 0 : v === NO ? --this.Nn : this.Nn;
        this.vals[i] = t;
        return Nn === 0;
    };
    Combine.prototype._start = function (out) {
        this.out = out;
        var s = this.insArr;
        var n = this.Nc = this.Nn = s.length;
        var vals = this.vals = new Array(n);
        if (n === 0) {
            out._n([]);
            out._c();
        }
        else {
            for (var i = 0; i < n; i++) {
                vals[i] = NO;
                s[i]._add(new CombineListener(i, out, this));
            }
        }
    };
    Combine.prototype._stop = function () {
        var s = this.insArr;
        var n = s.length;
        var ils = this.ils;
        for (var i = 0; i < n; i++)
            s[i]._remove(ils[i]);
        this.out = NO;
        this.ils = [];
        this.vals = [];
    };
    return Combine;
}());
var FromArray = /** @class */ (function () {
    function FromArray(a) {
        this.type = 'fromArray';
        this.a = a;
    }
    FromArray.prototype._start = function (out) {
        var a = this.a;
        for (var i = 0, n = a.length; i < n; i++)
            out._n(a[i]);
        out._c();
    };
    FromArray.prototype._stop = function () {
    };
    return FromArray;
}());
var FromPromise = /** @class */ (function () {
    function FromPromise(p) {
        this.type = 'fromPromise';
        this.on = false;
        this.p = p;
    }
    FromPromise.prototype._start = function (out) {
        var prod = this;
        this.on = true;
        this.p.then(function (v) {
            if (prod.on) {
                out._n(v);
                out._c();
            }
        }, function (e) {
            out._e(e);
        }).then(noop, function (err) {
            setTimeout(function () { throw err; });
        });
    };
    FromPromise.prototype._stop = function () {
        this.on = false;
    };
    return FromPromise;
}());
var Periodic = /** @class */ (function () {
    function Periodic(period) {
        this.type = 'periodic';
        this.period = period;
        this.intervalID = -1;
        this.i = 0;
    }
    Periodic.prototype._start = function (out) {
        var self = this;
        function intervalHandler() { out._n(self.i++); }
        this.intervalID = setInterval(intervalHandler, this.period);
    };
    Periodic.prototype._stop = function () {
        if (this.intervalID !== -1)
            clearInterval(this.intervalID);
        this.intervalID = -1;
        this.i = 0;
    };
    return Periodic;
}());
var Debug = /** @class */ (function () {
    function Debug(ins, arg) {
        this.type = 'debug';
        this.ins = ins;
        this.out = NO;
        this.s = noop;
        this.l = '';
        if (typeof arg === 'string')
            this.l = arg;
        else if (typeof arg === 'function')
            this.s = arg;
    }
    Debug.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    Debug.prototype._stop = function () {
        this.ins._remove(this);
        this.out = NO;
    };
    Debug.prototype._n = function (t) {
        var u = this.out;
        if (u === NO)
            return;
        var s = this.s, l = this.l;
        if (s !== noop) {
            try {
                s(t);
            }
            catch (e) {
                u._e(e);
            }
        }
        else if (l)
            console.log(l + ':', t);
        else
            console.log(t);
        u._n(t);
    };
    Debug.prototype._e = function (err) {
        var u = this.out;
        if (u === NO)
            return;
        u._e(err);
    };
    Debug.prototype._c = function () {
        var u = this.out;
        if (u === NO)
            return;
        u._c();
    };
    return Debug;
}());
var Drop = /** @class */ (function () {
    function Drop(max, ins) {
        this.type = 'drop';
        this.ins = ins;
        this.out = NO;
        this.max = max;
        this.dropped = 0;
    }
    Drop.prototype._start = function (out) {
        this.out = out;
        this.dropped = 0;
        this.ins._add(this);
    };
    Drop.prototype._stop = function () {
        this.ins._remove(this);
        this.out = NO;
    };
    Drop.prototype._n = function (t) {
        var u = this.out;
        if (u === NO)
            return;
        if (this.dropped++ >= this.max)
            u._n(t);
    };
    Drop.prototype._e = function (err) {
        var u = this.out;
        if (u === NO)
            return;
        u._e(err);
    };
    Drop.prototype._c = function () {
        var u = this.out;
        if (u === NO)
            return;
        u._c();
    };
    return Drop;
}());
var EndWhenListener = /** @class */ (function () {
    function EndWhenListener(out, op) {
        this.out = out;
        this.op = op;
    }
    EndWhenListener.prototype._n = function () {
        this.op.end();
    };
    EndWhenListener.prototype._e = function (err) {
        this.out._e(err);
    };
    EndWhenListener.prototype._c = function () {
        this.op.end();
    };
    return EndWhenListener;
}());
var EndWhen = /** @class */ (function () {
    function EndWhen(o, ins) {
        this.type = 'endWhen';
        this.ins = ins;
        this.out = NO;
        this.o = o;
        this.oil = NO_IL;
    }
    EndWhen.prototype._start = function (out) {
        this.out = out;
        this.o._add(this.oil = new EndWhenListener(out, this));
        this.ins._add(this);
    };
    EndWhen.prototype._stop = function () {
        this.ins._remove(this);
        this.o._remove(this.oil);
        this.out = NO;
        this.oil = NO_IL;
    };
    EndWhen.prototype.end = function () {
        var u = this.out;
        if (u === NO)
            return;
        u._c();
    };
    EndWhen.prototype._n = function (t) {
        var u = this.out;
        if (u === NO)
            return;
        u._n(t);
    };
    EndWhen.prototype._e = function (err) {
        var u = this.out;
        if (u === NO)
            return;
        u._e(err);
    };
    EndWhen.prototype._c = function () {
        this.end();
    };
    return EndWhen;
}());
var Filter = /** @class */ (function () {
    function Filter(passes, ins) {
        this.type = 'filter';
        this.ins = ins;
        this.out = NO;
        this.f = passes;
    }
    Filter.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    Filter.prototype._stop = function () {
        this.ins._remove(this);
        this.out = NO;
    };
    Filter.prototype._n = function (t) {
        var u = this.out;
        if (u === NO)
            return;
        var r = _try(this, t, u);
        if (r === NO || !r)
            return;
        u._n(t);
    };
    Filter.prototype._e = function (err) {
        var u = this.out;
        if (u === NO)
            return;
        u._e(err);
    };
    Filter.prototype._c = function () {
        var u = this.out;
        if (u === NO)
            return;
        u._c();
    };
    return Filter;
}());
var FlattenListener = /** @class */ (function () {
    function FlattenListener(out, op) {
        this.out = out;
        this.op = op;
    }
    FlattenListener.prototype._n = function (t) {
        this.out._n(t);
    };
    FlattenListener.prototype._e = function (err) {
        this.out._e(err);
    };
    FlattenListener.prototype._c = function () {
        this.op.inner = NO;
        this.op.less();
    };
    return FlattenListener;
}());
var Flatten = /** @class */ (function () {
    function Flatten(ins) {
        this.type = 'flatten';
        this.ins = ins;
        this.out = NO;
        this.open = true;
        this.inner = NO;
        this.il = NO_IL;
    }
    Flatten.prototype._start = function (out) {
        this.out = out;
        this.open = true;
        this.inner = NO;
        this.il = NO_IL;
        this.ins._add(this);
    };
    Flatten.prototype._stop = function () {
        this.ins._remove(this);
        if (this.inner !== NO)
            this.inner._remove(this.il);
        this.out = NO;
        this.open = true;
        this.inner = NO;
        this.il = NO_IL;
    };
    Flatten.prototype.less = function () {
        var u = this.out;
        if (u === NO)
            return;
        if (!this.open && this.inner === NO)
            u._c();
    };
    Flatten.prototype._n = function (s) {
        var u = this.out;
        if (u === NO)
            return;
        var _a = this, inner = _a.inner, il = _a.il;
        if (inner !== NO && il !== NO_IL)
            inner._remove(il);
        (this.inner = s)._add(this.il = new FlattenListener(u, this));
    };
    Flatten.prototype._e = function (err) {
        var u = this.out;
        if (u === NO)
            return;
        u._e(err);
    };
    Flatten.prototype._c = function () {
        this.open = false;
        this.less();
    };
    return Flatten;
}());
var Fold = /** @class */ (function () {
    function Fold(f, seed, ins) {
        var _this = this;
        this.type = 'fold';
        this.ins = ins;
        this.out = NO;
        this.f = function (t) { return f(_this.acc, t); };
        this.acc = this.seed = seed;
    }
    Fold.prototype._start = function (out) {
        this.out = out;
        this.acc = this.seed;
        out._n(this.acc);
        this.ins._add(this);
    };
    Fold.prototype._stop = function () {
        this.ins._remove(this);
        this.out = NO;
        this.acc = this.seed;
    };
    Fold.prototype._n = function (t) {
        var u = this.out;
        if (u === NO)
            return;
        var r = _try(this, t, u);
        if (r === NO)
            return;
        u._n(this.acc = r);
    };
    Fold.prototype._e = function (err) {
        var u = this.out;
        if (u === NO)
            return;
        u._e(err);
    };
    Fold.prototype._c = function () {
        var u = this.out;
        if (u === NO)
            return;
        u._c();
    };
    return Fold;
}());
var Last = /** @class */ (function () {
    function Last(ins) {
        this.type = 'last';
        this.ins = ins;
        this.out = NO;
        this.has = false;
        this.val = NO;
    }
    Last.prototype._start = function (out) {
        this.out = out;
        this.has = false;
        this.ins._add(this);
    };
    Last.prototype._stop = function () {
        this.ins._remove(this);
        this.out = NO;
        this.val = NO;
    };
    Last.prototype._n = function (t) {
        this.has = true;
        this.val = t;
    };
    Last.prototype._e = function (err) {
        var u = this.out;
        if (u === NO)
            return;
        u._e(err);
    };
    Last.prototype._c = function () {
        var u = this.out;
        if (u === NO)
            return;
        if (this.has) {
            u._n(this.val);
            u._c();
        }
        else
            u._e(new Error('last() failed because input stream completed'));
    };
    return Last;
}());
var MapOp = /** @class */ (function () {
    function MapOp(project, ins) {
        this.type = 'map';
        this.ins = ins;
        this.out = NO;
        this.f = project;
    }
    MapOp.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    MapOp.prototype._stop = function () {
        this.ins._remove(this);
        this.out = NO;
    };
    MapOp.prototype._n = function (t) {
        var u = this.out;
        if (u === NO)
            return;
        var r = _try(this, t, u);
        if (r === NO)
            return;
        u._n(r);
    };
    MapOp.prototype._e = function (err) {
        var u = this.out;
        if (u === NO)
            return;
        u._e(err);
    };
    MapOp.prototype._c = function () {
        var u = this.out;
        if (u === NO)
            return;
        u._c();
    };
    return MapOp;
}());
var Remember = /** @class */ (function () {
    function Remember(ins) {
        this.type = 'remember';
        this.ins = ins;
        this.out = NO;
    }
    Remember.prototype._start = function (out) {
        this.out = out;
        this.ins._add(out);
    };
    Remember.prototype._stop = function () {
        this.ins._remove(this.out);
        this.out = NO;
    };
    return Remember;
}());
var ReplaceError = /** @class */ (function () {
    function ReplaceError(replacer, ins) {
        this.type = 'replaceError';
        this.ins = ins;
        this.out = NO;
        this.f = replacer;
    }
    ReplaceError.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    ReplaceError.prototype._stop = function () {
        this.ins._remove(this);
        this.out = NO;
    };
    ReplaceError.prototype._n = function (t) {
        var u = this.out;
        if (u === NO)
            return;
        u._n(t);
    };
    ReplaceError.prototype._e = function (err) {
        var u = this.out;
        if (u === NO)
            return;
        try {
            this.ins._remove(this);
            (this.ins = this.f(err))._add(this);
        }
        catch (e) {
            u._e(e);
        }
    };
    ReplaceError.prototype._c = function () {
        var u = this.out;
        if (u === NO)
            return;
        u._c();
    };
    return ReplaceError;
}());
var StartWith = /** @class */ (function () {
    function StartWith(ins, val) {
        this.type = 'startWith';
        this.ins = ins;
        this.out = NO;
        this.val = val;
    }
    StartWith.prototype._start = function (out) {
        this.out = out;
        this.out._n(this.val);
        this.ins._add(out);
    };
    StartWith.prototype._stop = function () {
        this.ins._remove(this.out);
        this.out = NO;
    };
    return StartWith;
}());
var Take = /** @class */ (function () {
    function Take(max, ins) {
        this.type = 'take';
        this.ins = ins;
        this.out = NO;
        this.max = max;
        this.taken = 0;
    }
    Take.prototype._start = function (out) {
        this.out = out;
        this.taken = 0;
        if (this.max <= 0)
            out._c();
        else
            this.ins._add(this);
    };
    Take.prototype._stop = function () {
        this.ins._remove(this);
        this.out = NO;
    };
    Take.prototype._n = function (t) {
        var u = this.out;
        if (u === NO)
            return;
        var m = ++this.taken;
        if (m < this.max)
            u._n(t);
        else if (m === this.max) {
            u._n(t);
            u._c();
        }
    };
    Take.prototype._e = function (err) {
        var u = this.out;
        if (u === NO)
            return;
        u._e(err);
    };
    Take.prototype._c = function () {
        var u = this.out;
        if (u === NO)
            return;
        u._c();
    };
    return Take;
}());
var Stream = /** @class */ (function () {
    function Stream(producer) {
        this._prod = producer || NO;
        this._ils = [];
        this._stopID = NO;
        this._dl = NO;
        this._d = false;
        this._target = NO;
        this._err = NO;
    }
    Stream.prototype._n = function (t) {
        var a = this._ils;
        var L = a.length;
        if (this._d)
            this._dl._n(t);
        if (L == 1)
            a[0]._n(t);
        else if (L == 0)
            return;
        else {
            var b = cp(a);
            for (var i = 0; i < L; i++)
                b[i]._n(t);
        }
    };
    Stream.prototype._e = function (err) {
        if (this._err !== NO)
            return;
        this._err = err;
        var a = this._ils;
        var L = a.length;
        this._x();
        if (this._d)
            this._dl._e(err);
        if (L == 1)
            a[0]._e(err);
        else if (L == 0)
            return;
        else {
            var b = cp(a);
            for (var i = 0; i < L; i++)
                b[i]._e(err);
        }
        if (!this._d && L == 0)
            throw this._err;
    };
    Stream.prototype._c = function () {
        var a = this._ils;
        var L = a.length;
        this._x();
        if (this._d)
            this._dl._c();
        if (L == 1)
            a[0]._c();
        else if (L == 0)
            return;
        else {
            var b = cp(a);
            for (var i = 0; i < L; i++)
                b[i]._c();
        }
    };
    Stream.prototype._x = function () {
        if (this._ils.length === 0)
            return;
        if (this._prod !== NO)
            this._prod._stop();
        this._err = NO;
        this._ils = [];
    };
    Stream.prototype._stopNow = function () {
        // WARNING: code that calls this method should
        // first check if this._prod is valid (not `NO`)
        this._prod._stop();
        this._err = NO;
        this._stopID = NO;
    };
    Stream.prototype._add = function (il) {
        var ta = this._target;
        if (ta !== NO)
            return ta._add(il);
        var a = this._ils;
        a.push(il);
        if (a.length > 1)
            return;
        if (this._stopID !== NO) {
            clearTimeout(this._stopID);
            this._stopID = NO;
        }
        else {
            var p = this._prod;
            if (p !== NO)
                p._start(this);
        }
    };
    Stream.prototype._remove = function (il) {
        var _this = this;
        var ta = this._target;
        if (ta !== NO)
            return ta._remove(il);
        var a = this._ils;
        var i = a.indexOf(il);
        if (i > -1) {
            a.splice(i, 1);
            if (this._prod !== NO && a.length <= 0) {
                this._err = NO;
                this._stopID = setTimeout(function () { return _this._stopNow(); });
            }
            else if (a.length === 1) {
                this._pruneCycles();
            }
        }
    };
    // If all paths stemming from `this` stream eventually end at `this`
    // stream, then we remove the single listener of `this` stream, to
    // force it to end its execution and dispose resources. This method
    // assumes as a precondition that this._ils has just one listener.
    Stream.prototype._pruneCycles = function () {
        if (this._hasNoSinks(this, []))
            this._remove(this._ils[0]);
    };
    // Checks whether *there is no* path starting from `x` that leads to an end
    // listener (sink) in the stream graph, following edges A->B where B is a
    // listener of A. This means these paths constitute a cycle somehow. Is given
    // a trace of all visited nodes so far.
    Stream.prototype._hasNoSinks = function (x, trace) {
        if (trace.indexOf(x) !== -1)
            return true;
        else if (x.out === this)
            return true;
        else if (x.out && x.out !== NO)
            return this._hasNoSinks(x.out, trace.concat(x));
        else if (x._ils) {
            for (var i = 0, N = x._ils.length; i < N; i++)
                if (!this._hasNoSinks(x._ils[i], trace.concat(x)))
                    return false;
            return true;
        }
        else
            return false;
    };
    Stream.prototype.ctor = function () {
        return this instanceof MemoryStream ? MemoryStream : Stream;
    };
    /**
     * Adds a Listener to the Stream.
     *
     * @param {Listener} listener
     */
    Stream.prototype.addListener = function (listener) {
        listener._n = listener.next || noop;
        listener._e = listener.error || noop;
        listener._c = listener.complete || noop;
        this._add(listener);
    };
    /**
     * Removes a Listener from the Stream, assuming the Listener was added to it.
     *
     * @param {Listener<T>} listener
     */
    Stream.prototype.removeListener = function (listener) {
        this._remove(listener);
    };
    /**
     * Adds a Listener to the Stream returning a Subscription to remove that
     * listener.
     *
     * @param {Listener} listener
     * @returns {Subscription}
     */
    Stream.prototype.subscribe = function (listener) {
        this.addListener(listener);
        return new StreamSub(this, listener);
    };
    /**
     * Add interop between most.js and RxJS 5
     *
     * @returns {Stream}
     */
    Stream.prototype[symbol_observable_1.default] = function () {
        return this;
    };
    /**
     * Creates a new Stream given a Producer.
     *
     * @factory true
     * @param {Producer} producer An optional Producer that dictates how to
     * start, generate events, and stop the Stream.
     * @return {Stream}
     */
    Stream.create = function (producer) {
        if (producer) {
            if (typeof producer.start !== 'function'
                || typeof producer.stop !== 'function')
                throw new Error('producer requires both start and stop functions');
            internalizeProducer(producer); // mutates the input
        }
        return new Stream(producer);
    };
    /**
     * Creates a new MemoryStream given a Producer.
     *
     * @factory true
     * @param {Producer} producer An optional Producer that dictates how to
     * start, generate events, and stop the Stream.
     * @return {MemoryStream}
     */
    Stream.createWithMemory = function (producer) {
        if (producer)
            internalizeProducer(producer); // mutates the input
        return new MemoryStream(producer);
    };
    /**
     * Creates a Stream that does nothing when started. It never emits any event.
     *
     * Marble diagram:
     *
     * ```text
     *          never
     * -----------------------
     * ```
     *
     * @factory true
     * @return {Stream}
     */
    Stream.never = function () {
        return new Stream({ _start: noop, _stop: noop });
    };
    /**
     * Creates a Stream that immediately emits the "complete" notification when
     * started, and that's it.
     *
     * Marble diagram:
     *
     * ```text
     * empty
     * -|
     * ```
     *
     * @factory true
     * @return {Stream}
     */
    Stream.empty = function () {
        return new Stream({
            _start: function (il) { il._c(); },
            _stop: noop,
        });
    };
    /**
     * Creates a Stream that immediately emits an "error" notification with the
     * value you passed as the `error` argument when the stream starts, and that's
     * it.
     *
     * Marble diagram:
     *
     * ```text
     * throw(X)
     * -X
     * ```
     *
     * @factory true
     * @param error The error event to emit on the created stream.
     * @return {Stream}
     */
    Stream.throw = function (error) {
        return new Stream({
            _start: function (il) { il._e(error); },
            _stop: noop,
        });
    };
    /**
     * Creates a stream from an Array, Promise, or an Observable.
     *
     * @factory true
     * @param {Array|PromiseLike|Observable} input The input to make a stream from.
     * @return {Stream}
     */
    Stream.from = function (input) {
        if (typeof input[symbol_observable_1.default] === 'function')
            return Stream.fromObservable(input);
        else if (typeof input.then === 'function')
            return Stream.fromPromise(input);
        else if (Array.isArray(input))
            return Stream.fromArray(input);
        throw new TypeError("Type of input to from() must be an Array, Promise, or Observable");
    };
    /**
     * Creates a Stream that immediately emits the arguments that you give to
     * *of*, then completes.
     *
     * Marble diagram:
     *
     * ```text
     * of(1,2,3)
     * 123|
     * ```
     *
     * @factory true
     * @param a The first value you want to emit as an event on the stream.
     * @param b The second value you want to emit as an event on the stream. One
     * or more of these values may be given as arguments.
     * @return {Stream}
     */
    Stream.of = function () {
        var items = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            items[_i] = arguments[_i];
        }
        return Stream.fromArray(items);
    };
    /**
     * Converts an array to a stream. The returned stream will emit synchronously
     * all the items in the array, and then complete.
     *
     * Marble diagram:
     *
     * ```text
     * fromArray([1,2,3])
     * 123|
     * ```
     *
     * @factory true
     * @param {Array} array The array to be converted as a stream.
     * @return {Stream}
     */
    Stream.fromArray = function (array) {
        return new Stream(new FromArray(array));
    };
    /**
     * Converts a promise to a stream. The returned stream will emit the resolved
     * value of the promise, and then complete. However, if the promise is
     * rejected, the stream will emit the corresponding error.
     *
     * Marble diagram:
     *
     * ```text
     * fromPromise( ----42 )
     * -----------------42|
     * ```
     *
     * @factory true
     * @param {PromiseLike} promise The promise to be converted as a stream.
     * @return {Stream}
     */
    Stream.fromPromise = function (promise) {
        return new Stream(new FromPromise(promise));
    };
    /**
     * Converts an Observable into a Stream.
     *
     * @factory true
     * @param {any} observable The observable to be converted as a stream.
     * @return {Stream}
     */
    Stream.fromObservable = function (obs) {
        if (obs.endWhen)
            return obs;
        var o = typeof obs[symbol_observable_1.default] === 'function' ? obs[symbol_observable_1.default]() : obs;
        return new Stream(new FromObservable(o));
    };
    /**
     * Creates a stream that periodically emits incremental numbers, every
     * `period` milliseconds.
     *
     * Marble diagram:
     *
     * ```text
     *     periodic(1000)
     * ---0---1---2---3---4---...
     * ```
     *
     * @factory true
     * @param {number} period The interval in milliseconds to use as a rate of
     * emission.
     * @return {Stream}
     */
    Stream.periodic = function (period) {
        return new Stream(new Periodic(period));
    };
    Stream.prototype._map = function (project) {
        return new (this.ctor())(new MapOp(project, this));
    };
    /**
     * Transforms each event from the input Stream through a `project` function,
     * to get a Stream that emits those transformed events.
     *
     * Marble diagram:
     *
     * ```text
     * --1---3--5-----7------
     *    map(i => i * 10)
     * --10--30-50----70-----
     * ```
     *
     * @param {Function} project A function of type `(t: T) => U` that takes event
     * `t` of type `T` from the input Stream and produces an event of type `U`, to
     * be emitted on the output Stream.
     * @return {Stream}
     */
    Stream.prototype.map = function (project) {
        return this._map(project);
    };
    /**
     * It's like `map`, but transforms each input event to always the same
     * constant value on the output Stream.
     *
     * Marble diagram:
     *
     * ```text
     * --1---3--5-----7-----
     *       mapTo(10)
     * --10--10-10----10----
     * ```
     *
     * @param projectedValue A value to emit on the output Stream whenever the
     * input Stream emits any value.
     * @return {Stream}
     */
    Stream.prototype.mapTo = function (projectedValue) {
        var s = this.map(function () { return projectedValue; });
        var op = s._prod;
        op.type = 'mapTo';
        return s;
    };
    /**
     * Only allows events that pass the test given by the `passes` argument.
     *
     * Each event from the input stream is given to the `passes` function. If the
     * function returns `true`, the event is forwarded to the output stream,
     * otherwise it is ignored and not forwarded.
     *
     * Marble diagram:
     *
     * ```text
     * --1---2--3-----4-----5---6--7-8--
     *     filter(i => i % 2 === 0)
     * ------2--------4---------6----8--
     * ```
     *
     * @param {Function} passes A function of type `(t: T) => boolean` that takes
     * an event from the input stream and checks if it passes, by returning a
     * boolean.
     * @return {Stream}
     */
    Stream.prototype.filter = function (passes) {
        var p = this._prod;
        if (p instanceof Filter)
            return new Stream(new Filter(and(p.f, passes), p.ins));
        return new Stream(new Filter(passes, this));
    };
    /**
     * Lets the first `amount` many events from the input stream pass to the
     * output stream, then makes the output stream complete.
     *
     * Marble diagram:
     *
     * ```text
     * --a---b--c----d---e--
     *    take(3)
     * --a---b--c|
     * ```
     *
     * @param {number} amount How many events to allow from the input stream
     * before completing the output stream.
     * @return {Stream}
     */
    Stream.prototype.take = function (amount) {
        return new (this.ctor())(new Take(amount, this));
    };
    /**
     * Ignores the first `amount` many events from the input stream, and then
     * after that starts forwarding events from the input stream to the output
     * stream.
     *
     * Marble diagram:
     *
     * ```text
     * --a---b--c----d---e--
     *       drop(3)
     * --------------d---e--
     * ```
     *
     * @param {number} amount How many events to ignore from the input stream
     * before forwarding all events from the input stream to the output stream.
     * @return {Stream}
     */
    Stream.prototype.drop = function (amount) {
        return new Stream(new Drop(amount, this));
    };
    /**
     * When the input stream completes, the output stream will emit the last event
     * emitted by the input stream, and then will also complete.
     *
     * Marble diagram:
     *
     * ```text
     * --a---b--c--d----|
     *       last()
     * -----------------d|
     * ```
     *
     * @return {Stream}
     */
    Stream.prototype.last = function () {
        return new Stream(new Last(this));
    };
    /**
     * Prepends the given `initial` value to the sequence of events emitted by the
     * input stream. The returned stream is a MemoryStream, which means it is
     * already `remember()`'d.
     *
     * Marble diagram:
     *
     * ```text
     * ---1---2-----3---
     *   startWith(0)
     * 0--1---2-----3---
     * ```
     *
     * @param initial The value or event to prepend.
     * @return {MemoryStream}
     */
    Stream.prototype.startWith = function (initial) {
        return new MemoryStream(new StartWith(this, initial));
    };
    /**
     * Uses another stream to determine when to complete the current stream.
     *
     * When the given `other` stream emits an event or completes, the output
     * stream will complete. Before that happens, the output stream will behaves
     * like the input stream.
     *
     * Marble diagram:
     *
     * ```text
     * ---1---2-----3--4----5----6---
     *   endWhen( --------a--b--| )
     * ---1---2-----3--4--|
     * ```
     *
     * @param other Some other stream that is used to know when should the output
     * stream of this operator complete.
     * @return {Stream}
     */
    Stream.prototype.endWhen = function (other) {
        return new (this.ctor())(new EndWhen(other, this));
    };
    /**
     * "Folds" the stream onto itself.
     *
     * Combines events from the past throughout
     * the entire execution of the input stream, allowing you to accumulate them
     * together. It's essentially like `Array.prototype.reduce`. The returned
     * stream is a MemoryStream, which means it is already `remember()`'d.
     *
     * The output stream starts by emitting the `seed` which you give as argument.
     * Then, when an event happens on the input stream, it is combined with that
     * seed value through the `accumulate` function, and the output value is
     * emitted on the output stream. `fold` remembers that output value as `acc`
     * ("accumulator"), and then when a new input event `t` happens, `acc` will be
     * combined with that to produce the new `acc` and so forth.
     *
     * Marble diagram:
     *
     * ```text
     * ------1-----1--2----1----1------
     *   fold((acc, x) => acc + x, 3)
     * 3-----4-----5--7----8----9------
     * ```
     *
     * @param {Function} accumulate A function of type `(acc: R, t: T) => R` that
     * takes the previous accumulated value `acc` and the incoming event from the
     * input stream and produces the new accumulated value.
     * @param seed The initial accumulated value, of type `R`.
     * @return {MemoryStream}
     */
    Stream.prototype.fold = function (accumulate, seed) {
        return new MemoryStream(new Fold(accumulate, seed, this));
    };
    /**
     * Replaces an error with another stream.
     *
     * When (and if) an error happens on the input stream, instead of forwarding
     * that error to the output stream, *replaceError* will call the `replace`
     * function which returns the stream that the output stream will replicate.
     * And, in case that new stream also emits an error, `replace` will be called
     * again to get another stream to start replicating.
     *
     * Marble diagram:
     *
     * ```text
     * --1---2-----3--4-----X
     *   replaceError( () => --10--| )
     * --1---2-----3--4--------10--|
     * ```
     *
     * @param {Function} replace A function of type `(err) => Stream` that takes
     * the error that occurred on the input stream or on the previous replacement
     * stream and returns a new stream. The output stream will behave like the
     * stream that this function returns.
     * @return {Stream}
     */
    Stream.prototype.replaceError = function (replace) {
        return new (this.ctor())(new ReplaceError(replace, this));
    };
    /**
     * Flattens a "stream of streams", handling only one nested stream at a time
     * (no concurrency).
     *
     * If the input stream is a stream that emits streams, then this operator will
     * return an output stream which is a flat stream: emits regular events. The
     * flattening happens without concurrency. It works like this: when the input
     * stream emits a nested stream, *flatten* will start imitating that nested
     * one. However, as soon as the next nested stream is emitted on the input
     * stream, *flatten* will forget the previous nested one it was imitating, and
     * will start imitating the new nested one.
     *
     * Marble diagram:
     *
     * ```text
     * --+--------+---------------
     *   \        \
     *    \       ----1----2---3--
     *    --a--b----c----d--------
     *           flatten
     * -----a--b------1----2---3--
     * ```
     *
     * @return {Stream}
     */
    Stream.prototype.flatten = function () {
        var p = this._prod;
        return new Stream(new Flatten(this));
    };
    /**
     * Passes the input stream to a custom operator, to produce an output stream.
     *
     * *compose* is a handy way of using an existing function in a chained style.
     * Instead of writing `outStream = f(inStream)` you can write
     * `outStream = inStream.compose(f)`.
     *
     * @param {function} operator A function that takes a stream as input and
     * returns a stream as well.
     * @return {Stream}
     */
    Stream.prototype.compose = function (operator) {
        return operator(this);
    };
    /**
     * Returns an output stream that behaves like the input stream, but also
     * remembers the most recent event that happens on the input stream, so that a
     * newly added listener will immediately receive that memorised event.
     *
     * @return {MemoryStream}
     */
    Stream.prototype.remember = function () {
        return new MemoryStream(new Remember(this));
    };
    /**
     * Returns an output stream that identically behaves like the input stream,
     * but also runs a `spy` function for each event, to help you debug your app.
     *
     * *debug* takes a `spy` function as argument, and runs that for each event
     * happening on the input stream. If you don't provide the `spy` argument,
     * then *debug* will just `console.log` each event. This helps you to
     * understand the flow of events through some operator chain.
     *
     * Please note that if the output stream has no listeners, then it will not
     * start, which means `spy` will never run because no actual event happens in
     * that case.
     *
     * Marble diagram:
     *
     * ```text
     * --1----2-----3-----4--
     *         debug
     * --1----2-----3-----4--
     * ```
     *
     * @param {function} labelOrSpy A string to use as the label when printing
     * debug information on the console, or a 'spy' function that takes an event
     * as argument, and does not need to return anything.
     * @return {Stream}
     */
    Stream.prototype.debug = function (labelOrSpy) {
        return new (this.ctor())(new Debug(this, labelOrSpy));
    };
    /**
     * *imitate* changes this current Stream to emit the same events that the
     * `other` given Stream does. This method returns nothing.
     *
     * This method exists to allow one thing: **circular dependency of streams**.
     * For instance, let's imagine that for some reason you need to create a
     * circular dependency where stream `first$` depends on stream `second$`
     * which in turn depends on `first$`:
     *
     * <!-- skip-example -->
     * ```js
     * import delay from 'xstream/extra/delay'
     *
     * var first$ = second$.map(x => x * 10).take(3);
     * var second$ = first$.map(x => x + 1).startWith(1).compose(delay(100));
     * ```
     *
     * However, that is invalid JavaScript, because `second$` is undefined
     * on the first line. This is how *imitate* can help solve it:
     *
     * ```js
     * import delay from 'xstream/extra/delay'
     *
     * var secondProxy$ = xs.create();
     * var first$ = secondProxy$.map(x => x * 10).take(3);
     * var second$ = first$.map(x => x + 1).startWith(1).compose(delay(100));
     * secondProxy$.imitate(second$);
     * ```
     *
     * We create `secondProxy$` before the others, so it can be used in the
     * declaration of `first$`. Then, after both `first$` and `second$` are
     * defined, we hook `secondProxy$` with `second$` with `imitate()` to tell
     * that they are "the same". `imitate` will not trigger the start of any
     * stream, it just binds `secondProxy$` and `second$` together.
     *
     * The following is an example where `imitate()` is important in Cycle.js
     * applications. A parent component contains some child components. A child
     * has an action stream which is given to the parent to define its state:
     *
     * <!-- skip-example -->
     * ```js
     * const childActionProxy$ = xs.create();
     * const parent = Parent({...sources, childAction$: childActionProxy$});
     * const childAction$ = parent.state$.map(s => s.child.action$).flatten();
     * childActionProxy$.imitate(childAction$);
     * ```
     *
     * Note, though, that **`imitate()` does not support MemoryStreams**. If we
     * would attempt to imitate a MemoryStream in a circular dependency, we would
     * either get a race condition (where the symptom would be "nothing happens")
     * or an infinite cyclic emission of values. It's useful to think about
     * MemoryStreams as cells in a spreadsheet. It doesn't make any sense to
     * define a spreadsheet cell `A1` with a formula that depends on `B1` and
     * cell `B1` defined with a formula that depends on `A1`.
     *
     * If you find yourself wanting to use `imitate()` with a
     * MemoryStream, you should rework your code around `imitate()` to use a
     * Stream instead. Look for the stream in the circular dependency that
     * represents an event stream, and that would be a candidate for creating a
     * proxy Stream which then imitates the target Stream.
     *
     * @param {Stream} target The other stream to imitate on the current one. Must
     * not be a MemoryStream.
     */
    Stream.prototype.imitate = function (target) {
        if (target instanceof MemoryStream)
            throw new Error('A MemoryStream was given to imitate(), but it only ' +
                'supports a Stream. Read more about this restriction here: ' +
                'https://github.com/staltz/xstream#faq');
        this._target = target;
        for (var ils = this._ils, N = ils.length, i = 0; i < N; i++)
            target._add(ils[i]);
        this._ils = [];
    };
    /**
     * Forces the Stream to emit the given value to its listeners.
     *
     * As the name indicates, if you use this, you are most likely doing something
     * The Wrong Way. Please try to understand the reactive way before using this
     * method. Use it only when you know what you are doing.
     *
     * @param value The "next" value you want to broadcast to all listeners of
     * this Stream.
     */
    Stream.prototype.shamefullySendNext = function (value) {
        this._n(value);
    };
    /**
     * Forces the Stream to emit the given error to its listeners.
     *
     * As the name indicates, if you use this, you are most likely doing something
     * The Wrong Way. Please try to understand the reactive way before using this
     * method. Use it only when you know what you are doing.
     *
     * @param {any} error The error you want to broadcast to all the listeners of
     * this Stream.
     */
    Stream.prototype.shamefullySendError = function (error) {
        this._e(error);
    };
    /**
     * Forces the Stream to emit the "completed" event to its listeners.
     *
     * As the name indicates, if you use this, you are most likely doing something
     * The Wrong Way. Please try to understand the reactive way before using this
     * method. Use it only when you know what you are doing.
     */
    Stream.prototype.shamefullySendComplete = function () {
        this._c();
    };
    /**
     * Adds a "debug" listener to the stream. There can only be one debug
     * listener, that's why this is 'setDebugListener'. To remove the debug
     * listener, just call setDebugListener(null).
     *
     * A debug listener is like any other listener. The only difference is that a
     * debug listener is "stealthy": its presence/absence does not trigger the
     * start/stop of the stream (or the producer inside the stream). This is
     * useful so you can inspect what is going on without changing the behavior
     * of the program. If you have an idle stream and you add a normal listener to
     * it, the stream will start executing. But if you set a debug listener on an
     * idle stream, it won't start executing (not until the first normal listener
     * is added).
     *
     * As the name indicates, we don't recommend using this method to build app
     * logic. In fact, in most cases the debug operator works just fine. Only use
     * this one if you know what you're doing.
     *
     * @param {Listener<T>} listener
     */
    Stream.prototype.setDebugListener = function (listener) {
        if (!listener) {
            this._d = false;
            this._dl = NO;
        }
        else {
            this._d = true;
            listener._n = listener.next || noop;
            listener._e = listener.error || noop;
            listener._c = listener.complete || noop;
            this._dl = listener;
        }
    };
    /**
     * Blends multiple streams together, emitting events from all of them
     * concurrently.
     *
     * *merge* takes multiple streams as arguments, and creates a stream that
     * behaves like each of the argument streams, in parallel.
     *
     * Marble diagram:
     *
     * ```text
     * --1----2-----3--------4---
     * ----a-----b----c---d------
     *            merge
     * --1-a--2--b--3-c---d--4---
     * ```
     *
     * @factory true
     * @param {Stream} stream1 A stream to merge together with other streams.
     * @param {Stream} stream2 A stream to merge together with other streams. Two
     * or more streams may be given as arguments.
     * @return {Stream}
     */
    Stream.merge = function merge() {
        var streams = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            streams[_i] = arguments[_i];
        }
        return new Stream(new Merge(streams));
    };
    /**
     * Combines multiple input streams together to return a stream whose events
     * are arrays that collect the latest events from each input stream.
     *
     * *combine* internally remembers the most recent event from each of the input
     * streams. When any of the input streams emits an event, that event together
     * with all the other saved events are combined into an array. That array will
     * be emitted on the output stream. It's essentially a way of joining together
     * the events from multiple streams.
     *
     * Marble diagram:
     *
     * ```text
     * --1----2-----3--------4---
     * ----a-----b-----c--d------
     *          combine
     * ----1a-2a-2b-3b-3c-3d-4d--
     * ```
     *
     * @factory true
     * @param {Stream} stream1 A stream to combine together with other streams.
     * @param {Stream} stream2 A stream to combine together with other streams.
     * Multiple streams, not just two, may be given as arguments.
     * @return {Stream}
     */
    Stream.combine = function combine() {
        var streams = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            streams[_i] = arguments[_i];
        }
        return new Stream(new Combine(streams));
    };
    return Stream;
}());
exports.Stream = Stream;
var MemoryStream = /** @class */ (function (_super) {
    __extends(MemoryStream, _super);
    function MemoryStream(producer) {
        var _this = _super.call(this, producer) || this;
        _this._has = false;
        return _this;
    }
    MemoryStream.prototype._n = function (x) {
        this._v = x;
        this._has = true;
        _super.prototype._n.call(this, x);
    };
    MemoryStream.prototype._add = function (il) {
        var ta = this._target;
        if (ta !== NO)
            return ta._add(il);
        var a = this._ils;
        a.push(il);
        if (a.length > 1) {
            if (this._has)
                il._n(this._v);
            return;
        }
        if (this._stopID !== NO) {
            if (this._has)
                il._n(this._v);
            clearTimeout(this._stopID);
            this._stopID = NO;
        }
        else if (this._has)
            il._n(this._v);
        else {
            var p = this._prod;
            if (p !== NO)
                p._start(this);
        }
    };
    MemoryStream.prototype._stopNow = function () {
        this._has = false;
        _super.prototype._stopNow.call(this);
    };
    MemoryStream.prototype._x = function () {
        this._has = false;
        _super.prototype._x.call(this);
    };
    MemoryStream.prototype.map = function (project) {
        return this._map(project);
    };
    MemoryStream.prototype.mapTo = function (projectedValue) {
        return _super.prototype.mapTo.call(this, projectedValue);
    };
    MemoryStream.prototype.take = function (amount) {
        return _super.prototype.take.call(this, amount);
    };
    MemoryStream.prototype.endWhen = function (other) {
        return _super.prototype.endWhen.call(this, other);
    };
    MemoryStream.prototype.replaceError = function (replace) {
        return _super.prototype.replaceError.call(this, replace);
    };
    MemoryStream.prototype.remember = function () {
        return this;
    };
    MemoryStream.prototype.debug = function (labelOrSpy) {
        return _super.prototype.debug.call(this, labelOrSpy);
    };
    return MemoryStream;
}(Stream));
exports.MemoryStream = MemoryStream;
var xs = Stream;
exports.default = xs;

},{"symbol-observable":47}],52:[function(require,module,exports){
'use strict';

var _run = require('@cycle/run');

var _xstream = require('xstream');

var _xstream2 = _interopRequireDefault(_xstream);

var _makeROSDriver = require('./makeROSDriver');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function main(sources) {
  // adapted from from
  //   https://github.com/RobotWebTools/roslibjs/blob/master/examples/simple.html

  // Publishing a Topic
  // ------------------

  // Run `rostopic echo /cmd_vel` on the machine running ROS to see published
  //   messages.
  var topic$ = _xstream2.default.of({
    type: 'topic',
    value: {
      name: '/cmd_vel',
      message: {
        linear: {
          x: 0.1,
          y: 0.2,
          z: 0.3
        },
        angular: {
          x: -0.1,
          y: -0.2,
          z: -0.3
        }
      }
    }
  });

  //Subscribing to a Topic
  //----------------------

  // Run `rostopic pub /listener std_msgs/String "data: 'Hello world'!"` on the
  //   machine running ROS to publish messages and check the console for
  //   received messages.
  sources.ROS.filter(function (value) {
    return value.type === 'topic' && value.value.name === '/listener';
  }).addListener({
    next: function next(value) {
      var topic = value.value;
      console.log('Received message on ' + topic.name + ': ' + topic.message.data);
    }
  });

  // Calling a service
  // -----------------

  // Run `rosrun rospy_tutorials add_two_ints_server` to start the service server
  var service$ = _xstream2.default.of({
    type: 'service',
    value: {
      name: '/add_two_ints',
      request: {
        a: 1,
        b: 2
      }
    }
  });

  sources.ROS.filter(function (value) {
    return value.type === 'service' && value.value.name === '/add_two_ints';
  }).map(function (value) {
    return value.value.response$;
  }).flatten().addListener({
    next: function next(result) {
      console.log('Result for service call: ' + result.sum);
    },
    error: function error(err) {
      return console.error(err);
    }
  });

  // adapted from from
  //   https://github.com/RobotWebTools/roslibjs/blob/master/examples/fibonacci.html

  // The ActionClient
  // ----------------

  // Run `rosrun actionlib_tutorials fibonacci_server` to start the action server
  var action$ = _xstream2.default.periodic(3000).mapTo({
    type: 'action',
    value: {
      name: '/fibonacci',
      goalMessage: {
        order: 1
      }
    }
  });

  var fibonacciClient = sources.ROS.filter(function (value) {
    return value.type === 'action' && value.value.name === '/fibonacci';
  });
  fibonacciClient.map(function (value) {
    return value.value.feedback$;
  }).flatten().addListener({
    next: function next(feedback) {
      console.log('Feedback: ' + feedback.sequence);
    }
  });
  fibonacciClient.map(function (value) {
    return value.value.result$;
  }).flatten().addListener({
    next: function next(result) {
      console.log('Final Result: ' + result.sequence);
    }
  });

  var ros$ = _xstream2.default.merge(topic$, service$, action$);
  return {
    ROS: ros$
  };
}

(0, _run.run)(main, {
  ROS: (0, _makeROSDriver.makeROSDriver)({
    roslib: { url: 'ws://localhost:9090' },
    topics: [{
      name: '/cmd_vel',
      messageType: 'geometry_msgs/Twist'
    }, {
      name: '/listener',
      messageType: 'std_msgs/String'
    }],
    services: [{
      name: '/add_two_ints',
      serviceType: 'rospy_tutorials/AddTwoInts'
    }],
    actions: [{
      serverName: '/fibonacci',
      actionName: 'actionlib_tutorials/FibonacciAction'
    }]
  })
});

},{"./makeROSDriver":53,"@cycle/run":2,"xstream":51}],53:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.makeROSDriver = makeROSDriver;

var _roslib = require('roslib');

var _roslib2 = _interopRequireDefault(_roslib);

var _xstream = require('xstream');

var _xstream2 = _interopRequireDefault(_xstream);

var _fromEvent = require('xstream/extra/fromEvent');

var _fromEvent2 = _interopRequireDefault(_fromEvent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function makeROSDriver(options) {
  if (!options) {
    options = {};
  }
  if (!options.topics) {
    options.topics = [];
  }
  if (!options.services) {
    options.services = [];
  }
  if (!options.actions) {
    options.actions = [];
  }

  // For options.roslib, see
  //   https://github.com/RobotWebTools/roslibjs/blob/master/src/core/Ros.js#L26-L30
  var ros = new _roslib2.default.Ros(options.roslib);
  var topics = {};
  options.topics.map(function (topicOptions) {
    // For topicOptions, see
    //   https://github.com/RobotWebTools/roslibjs/blob/master/src/core/Topic.js#L17-L26
    topics[topicOptions.name] = new _roslib2.default.Topic(_extends({}, topicOptions, {
      ros: ros
    }));
  });
  var services = {};
  options.services.map(function (serviceOptions) {
    // For topicOptions, see
    //   https://github.com/RobotWebTools/roslibjs/blob/master/src/core/Service.js#L14-L17
    services[serviceOptions.name] = new _roslib2.default.Service(_extends({}, serviceOptions, {
      ros: ros
    }));
  });
  var serviceClient$ = _xstream2.default.create();
  var actions = {};
  options.actions.map(function (actionOptions) {
    // For topicOptions, see
    //   https://github.com/RobotWebTools/roslibjs/blob/master/src/actionlib/ActionClient.js#L20-L24
    actions[actionOptions.serverName] = new _roslib2.default.ActionClient(_extends({}, actionOptions, {
      ros: ros
    }));
  });
  // https://github.com/RobotWebTools/roslibjs/blob/master/src/actionlib/ActionClient.js#L14-L17
  var actionClient$ = _xstream2.default.create();

  return function (outgoing$) {

    outgoing$.addListener({
      next: function next(outgoing) {
        switch (outgoing.type) {
          case 'topic':
            // // Example outgoing "topic" value
            // outgoing = {
            //   type: 'topic',
            //   value: {
            //     name: '/cmd_vel',
            //     message: {
            //       linear : {
            //         x : 0.1,
            //         y : 0.2,
            //         z : 0.3,
            //       },
            //       angular : {
            //         x : -0.1,
            //         y : -0.2,
            //         z : -0.3,
            //       },
            //     },
            //   },
            // }
            topics[outgoing.value.name].publish(outgoing.value.message);
            break;
          case 'service':
            // // Example outgoing "service" value
            // incoming = {
            //   type: 'service',
            //   value: {
            //     name: '/add_two_ints',
            //     request: {
            //       a: 1,
            //       b: 2,
            //     },
            //   },
            // }
            serviceClient$.shamefullySendNext({
              name: outgoing.value.name,
              response$: _xstream2.default.create({
                start: function start(listener) {
                  services[outgoing.value.name].callService(new _roslib2.default.ServiceRequest(outgoing.value.request), function (response) {
                    listener.next(response);
                    listener.complete();
                  }, listener.error.bind(listener));
                },
                stop: function stop() {}
              })
            });
            break;
          case 'action':
            // // Example outgoing "action" value
            // incoming = {
            //   type: 'action',
            //   value: {
            //     name: '/fibonacci',
            //     goalMessage: {
            //       order: 7,
            //     },
            //   },
            // }
            var goal = new _roslib2.default.Goal({
              actionClient: actions[outgoing.value.name],
              goalMessage: outgoing.value.goalMessage
            });
            actionClient$.shamefullySendNext({
              name: outgoing.value.name,
              timeout$: (0, _fromEvent2.default)(goal, 'timeout'),
              status$: (0, _fromEvent2.default)(goal, 'status'),
              feedback$: (0, _fromEvent2.default)(goal, 'feedback'),
              result$: (0, _fromEvent2.default)(goal, 'result')
            });
            goal.send();
            break;
          default:
            console.warn('Unknown outgoing.type', outgoing.type);
        }
      },
      error: function error() {},
      complete: function complete() {}
    });

    var incoming$ = _xstream2.default.create({
      start: function start(listener) {
        Object.keys(topics).map(function (topic) {
          topics[topic].subscribe(function (message) {
            // // Example incoming "topic" value
            // incoming = {
            //   type: 'topic',
            //   value: {
            //     name: '/cmd_vel',
            //     message: {
            //       linear : {
            //         x : 0.1,
            //         y : 0.2,
            //         z : 0.3,
            //       },
            //       angular : {
            //         x : -0.1,
            //         y : -0.2,
            //         z : -0.3,
            //       },
            //     },
            //   },
            // }
            listener.next({ type: 'topic', value: { name: topic, message: message } });
          });
        });

        serviceClient$.addListener({
          next: function next(serviceClient) {
            // // Example incoming "service" value
            // incoming = {
            //   type: 'service',
            //   value: {
            //     name: '/add_two_ints',
            //     response$: // an xstream that emits a response object
            //   },
            // }
            listener.next({ type: 'service', value: serviceClient });
          }
        });

        actionClient$.addListener({
          next: function next(actionClient) {
            // // Example incoming "action" value
            // incoming = {
            //   type: 'action',
            //   value: {
            //     name: '/fibonacci',
            //     response$: // an xstream that emits timeout
            //     status$: // an xstream that emits status
            //     feedback$: // an xstream that emits feedback
            //     result$: // an xstream that emits results
            //   },
            // }
            listener.next({ type: 'action', value: actionClient });
          }
        });
      },
      stop: function stop() {
        Object.keys(topics).map(function (topic) {
          topics[topic].unsubscribe();
        });
      }
    });

    return incoming$;
  };
}

},{"roslib":8,"xstream":51,"xstream/extra/fromEvent":50}]},{},[52])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvQGN5Y2xlL3J1bi9saWIvY2pzL2FkYXB0LmpzIiwibm9kZV9tb2R1bGVzL0BjeWNsZS9ydW4vbGliL2Nqcy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AY3ljbGUvcnVuL2xpYi9janMvaW50ZXJuYWxzLmpzIiwibm9kZV9tb2R1bGVzL2V2ZW50ZW1pdHRlcjIvbGliL2V2ZW50ZW1pdHRlcjIuanMiLCJub2RlX21vZHVsZXMvb2JqZWN0LWFzc2lnbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvcXVpY2t0YXNrL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvUm9zTGliLmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvYWN0aW9ubGliL0FjdGlvbkNsaWVudC5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL2FjdGlvbmxpYi9BY3Rpb25MaXN0ZW5lci5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL2FjdGlvbmxpYi9Hb2FsLmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvYWN0aW9ubGliL1NpbXBsZUFjdGlvblNlcnZlci5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL2FjdGlvbmxpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL2NvcmUvTWVzc2FnZS5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL2NvcmUvUGFyYW0uanMiLCJub2RlX21vZHVsZXMvcm9zbGliL3NyYy9jb3JlL1Jvcy5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL2NvcmUvU2VydmljZS5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL2NvcmUvU2VydmljZVJlcXVlc3QuanMiLCJub2RlX21vZHVsZXMvcm9zbGliL3NyYy9jb3JlL1NlcnZpY2VSZXNwb25zZS5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL2NvcmUvU29ja2V0QWRhcHRlci5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL2NvcmUvVG9waWMuanMiLCJub2RlX21vZHVsZXMvcm9zbGliL3NyYy9jb3JlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvbWF0aC9Qb3NlLmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvbWF0aC9RdWF0ZXJuaW9uLmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvbWF0aC9UcmFuc2Zvcm0uanMiLCJub2RlX21vZHVsZXMvcm9zbGliL3NyYy9tYXRoL1ZlY3RvcjMuanMiLCJub2RlX21vZHVsZXMvcm9zbGliL3NyYy9tYXRoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvbWl4aW4uanMiLCJub2RlX21vZHVsZXMvcm9zbGliL3NyYy90Zi9URkNsaWVudC5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL3RmL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvdXJkZi9VcmRmQm94LmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvdXJkZi9VcmRmQ29sb3IuanMiLCJub2RlX21vZHVsZXMvcm9zbGliL3NyYy91cmRmL1VyZGZDeWxpbmRlci5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL3VyZGYvVXJkZkpvaW50LmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvdXJkZi9VcmRmTGluay5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL3VyZGYvVXJkZk1hdGVyaWFsLmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvdXJkZi9VcmRmTWVzaC5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL3VyZGYvVXJkZk1vZGVsLmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvdXJkZi9VcmRmU3BoZXJlLmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvdXJkZi9VcmRmVHlwZXMuanMiLCJub2RlX21vZHVsZXMvcm9zbGliL3NyYy91cmRmL1VyZGZWaXN1YWwuanMiLCJub2RlX21vZHVsZXMvcm9zbGliL3NyYy91cmRmL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Jvc2xpYi9zcmMvdXRpbC9zaGltL1dlYlNvY2tldC5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL3V0aWwvc2hpbS9jYW52YXMuanMiLCJub2RlX21vZHVsZXMvcm9zbGliL3NyYy91dGlsL3NoaW0vZGVjb21wcmVzc1BuZy5qcyIsIm5vZGVfbW9kdWxlcy9yb3NsaWIvc3JjL3V0aWwvc2hpbS94bWxkb20uanMiLCJub2RlX21vZHVsZXMvc3ltYm9sLW9ic2VydmFibGUvbGliL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3N5bWJvbC1vYnNlcnZhYmxlL2xpYi9wb255ZmlsbC5qcyIsIm5vZGVfbW9kdWxlcy90aW1lcnMtYnJvd3NlcmlmeS9tYWluLmpzIiwibm9kZV9tb2R1bGVzL3hzdHJlYW0vc3JjL2V4dHJhL2Zyb21FdmVudC50cyIsIm5vZGVfbW9kdWxlcy94c3RyZWFtL3NyYy9pbmRleC50cyIsInNyYy9pbmRleC5qcyIsInNyYy9tYWtlUk9TRHJpdmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzbUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNYQTs7OztBQ0FBO0FBQ0E7QUFDQTtBQUNBOzs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3ZEQTtBQUNBO0FBQ0E7Ozs7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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QUFDQSxxQkFBUyxJQUFULENBQWMsRUFBQyxNQUFNLFFBQVAsRUFBaUIsT0FBTyxZQUF4QixFQUFkO0FBQ0Q7QUFkdUIsU0FBMUI7QUFpQkQsT0ExRHlCO0FBMkQxQixZQUFNLGdCQUFNO0FBQ1YsZUFBTyxJQUFQLENBQVksTUFBWixFQUFvQixHQUFwQixDQUF3QixpQkFBUztBQUMvQixpQkFBTyxLQUFQLEVBQWMsV0FBZDtBQUNELFNBRkQ7QUFHRDtBQS9EeUIsS0FBVixDQUFsQjs7QUFrRUEsV0FBTyxTQUFQO0FBQ0QsR0EzSkQ7QUE0SkQiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmZ1bmN0aW9uIGdldEdsb2JhbCgpIHtcbiAgICB2YXIgZ2xvYmFsT2JqO1xuICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBnbG9iYWxPYmogPSB3aW5kb3c7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGdsb2JhbE9iaiA9IGdsb2JhbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGdsb2JhbE9iaiA9IHRoaXM7XG4gICAgfVxuICAgIGdsb2JhbE9iai5DeWNsZWpzID0gZ2xvYmFsT2JqLkN5Y2xlanMgfHwge307XG4gICAgZ2xvYmFsT2JqID0gZ2xvYmFsT2JqLkN5Y2xlanM7XG4gICAgZ2xvYmFsT2JqLmFkYXB0U3RyZWFtID0gZ2xvYmFsT2JqLmFkYXB0U3RyZWFtIHx8IChmdW5jdGlvbiAoeCkgeyByZXR1cm4geDsgfSk7XG4gICAgcmV0dXJuIGdsb2JhbE9iajtcbn1cbmZ1bmN0aW9uIHNldEFkYXB0KGYpIHtcbiAgICBnZXRHbG9iYWwoKS5hZGFwdFN0cmVhbSA9IGY7XG59XG5leHBvcnRzLnNldEFkYXB0ID0gc2V0QWRhcHQ7XG5mdW5jdGlvbiBhZGFwdChzdHJlYW0pIHtcbiAgICByZXR1cm4gZ2V0R2xvYmFsKCkuYWRhcHRTdHJlYW0oc3RyZWFtKTtcbn1cbmV4cG9ydHMuYWRhcHQgPSBhZGFwdDtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFkYXB0LmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xudmFyIGludGVybmFsc18xID0gcmVxdWlyZShcIi4vaW50ZXJuYWxzXCIpO1xuLyoqXG4gKiBBIGZ1bmN0aW9uIHRoYXQgcHJlcGFyZXMgdGhlIEN5Y2xlIGFwcGxpY2F0aW9uIHRvIGJlIGV4ZWN1dGVkLiBUYWtlcyBhIGBtYWluYFxuICogZnVuY3Rpb24gYW5kIHByZXBhcmVzIHRvIGNpcmN1bGFybHkgY29ubmVjdHMgaXQgdG8gdGhlIGdpdmVuIGNvbGxlY3Rpb24gb2ZcbiAqIGRyaXZlciBmdW5jdGlvbnMuIEFzIGFuIG91dHB1dCwgYHNldHVwKClgIHJldHVybnMgYW4gb2JqZWN0IHdpdGggdGhyZWVcbiAqIHByb3BlcnRpZXM6IGBzb3VyY2VzYCwgYHNpbmtzYCBhbmQgYHJ1bmAuIE9ubHkgd2hlbiBgcnVuKClgIGlzIGNhbGxlZCB3aWxsXG4gKiB0aGUgYXBwbGljYXRpb24gYWN0dWFsbHkgZXhlY3V0ZS4gUmVmZXIgdG8gdGhlIGRvY3VtZW50YXRpb24gb2YgYHJ1bigpYCBmb3JcbiAqIG1vcmUgZGV0YWlscy5cbiAqXG4gKiAqKkV4YW1wbGU6KipcbiAqIGBgYGpzXG4gKiBpbXBvcnQge3NldHVwfSBmcm9tICdAY3ljbGUvcnVuJztcbiAqIGNvbnN0IHtzb3VyY2VzLCBzaW5rcywgcnVufSA9IHNldHVwKG1haW4sIGRyaXZlcnMpO1xuICogLy8gLi4uXG4gKiBjb25zdCBkaXNwb3NlID0gcnVuKCk7IC8vIEV4ZWN1dGVzIHRoZSBhcHBsaWNhdGlvblxuICogLy8gLi4uXG4gKiBkaXNwb3NlKCk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBtYWluIGEgZnVuY3Rpb24gdGhhdCB0YWtlcyBgc291cmNlc2AgYXMgaW5wdXQgYW5kIG91dHB1dHNcbiAqIGBzaW5rc2AuXG4gKiBAcGFyYW0ge09iamVjdH0gZHJpdmVycyBhbiBvYmplY3Qgd2hlcmUga2V5cyBhcmUgZHJpdmVyIG5hbWVzIGFuZCB2YWx1ZXNcbiAqIGFyZSBkcml2ZXIgZnVuY3Rpb25zLlxuICogQHJldHVybiB7T2JqZWN0fSBhbiBvYmplY3Qgd2l0aCB0aHJlZSBwcm9wZXJ0aWVzOiBgc291cmNlc2AsIGBzaW5rc2AgYW5kXG4gKiBgcnVuYC4gYHNvdXJjZXNgIGlzIHRoZSBjb2xsZWN0aW9uIG9mIGRyaXZlciBzb3VyY2VzLCBgc2lua3NgIGlzIHRoZVxuICogY29sbGVjdGlvbiBvZiBkcml2ZXIgc2lua3MsIHRoZXNlIGNhbiBiZSB1c2VkIGZvciBkZWJ1Z2dpbmcgb3IgdGVzdGluZy4gYHJ1bmBcbiAqIGlzIHRoZSBmdW5jdGlvbiB0aGF0IG9uY2UgY2FsbGVkIHdpbGwgZXhlY3V0ZSB0aGUgYXBwbGljYXRpb24uXG4gKiBAZnVuY3Rpb24gc2V0dXBcbiAqL1xuZnVuY3Rpb24gc2V0dXAobWFpbiwgZHJpdmVycykge1xuICAgIGlmICh0eXBlb2YgbWFpbiAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkZpcnN0IGFyZ3VtZW50IGdpdmVuIHRvIEN5Y2xlIG11c3QgYmUgdGhlICdtYWluJyBcIiArIFwiZnVuY3Rpb24uXCIpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGRyaXZlcnMgIT09IFwib2JqZWN0XCIgfHwgZHJpdmVycyA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTZWNvbmQgYXJndW1lbnQgZ2l2ZW4gdG8gQ3ljbGUgbXVzdCBiZSBhbiBvYmplY3QgXCIgK1xuICAgICAgICAgICAgXCJ3aXRoIGRyaXZlciBmdW5jdGlvbnMgYXMgcHJvcGVydGllcy5cIik7XG4gICAgfVxuICAgIGlmIChpbnRlcm5hbHNfMS5pc09iamVjdEVtcHR5KGRyaXZlcnMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlNlY29uZCBhcmd1bWVudCBnaXZlbiB0byBDeWNsZSBtdXN0IGJlIGFuIG9iamVjdCBcIiArXG4gICAgICAgICAgICBcIndpdGggYXQgbGVhc3Qgb25lIGRyaXZlciBmdW5jdGlvbiBkZWNsYXJlZCBhcyBhIHByb3BlcnR5LlwiKTtcbiAgICB9XG4gICAgdmFyIGVuZ2luZSA9IHNldHVwUmV1c2FibGUoZHJpdmVycyk7XG4gICAgdmFyIHNpbmtzID0gbWFpbihlbmdpbmUuc291cmNlcyk7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHdpbmRvdy5DeWNsZWpzID0gd2luZG93LkN5Y2xlanMgfHwge307XG4gICAgICAgIHdpbmRvdy5DeWNsZWpzLnNpbmtzID0gc2lua3M7XG4gICAgfVxuICAgIGZ1bmN0aW9uIF9ydW4oKSB7XG4gICAgICAgIHZhciBkaXNwb3NlUnVuID0gZW5naW5lLnJ1bihzaW5rcyk7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBkaXNwb3NlKCkge1xuICAgICAgICAgICAgZGlzcG9zZVJ1bigpO1xuICAgICAgICAgICAgZW5naW5lLmRpc3Bvc2UoKTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIHsgc2lua3M6IHNpbmtzLCBzb3VyY2VzOiBlbmdpbmUuc291cmNlcywgcnVuOiBfcnVuIH07XG59XG5leHBvcnRzLnNldHVwID0gc2V0dXA7XG4vKipcbiAqIEEgcGFydGlhbGx5LWFwcGxpZWQgdmFyaWFudCBvZiBzZXR1cCgpIHdoaWNoIGFjY2VwdHMgb25seSB0aGUgZHJpdmVycywgYW5kXG4gKiBhbGxvd3MgbWFueSBgbWFpbmAgZnVuY3Rpb25zIHRvIGV4ZWN1dGUgYW5kIHJldXNlIHRoaXMgc2FtZSBzZXQgb2YgZHJpdmVycy5cbiAqXG4gKiBUYWtlcyBhbiBvYmplY3Qgd2l0aCBkcml2ZXIgZnVuY3Rpb25zIGFzIGlucHV0LCBhbmQgb3V0cHV0cyBhbiBvYmplY3Qgd2hpY2hcbiAqIGNvbnRhaW5zIHRoZSBnZW5lcmF0ZWQgc291cmNlcyAoZnJvbSB0aG9zZSBkcml2ZXJzKSBhbmQgYSBgcnVuYCBmdW5jdGlvblxuICogKHdoaWNoIGluIHR1cm4gZXhwZWN0cyBzaW5rcyBhcyBhcmd1bWVudCkuIFRoaXMgYHJ1bmAgZnVuY3Rpb24gY2FuIGJlIGNhbGxlZFxuICogbXVsdGlwbGUgdGltZXMgd2l0aCBkaWZmZXJlbnQgYXJndW1lbnRzLCBhbmQgaXQgd2lsbCByZXVzZSB0aGUgZHJpdmVycyB0aGF0XG4gKiB3ZXJlIHBhc3NlZCB0byBgc2V0dXBSZXVzYWJsZWAuXG4gKlxuICogKipFeGFtcGxlOioqXG4gKiBgYGBqc1xuICogaW1wb3J0IHtzZXR1cFJldXNhYmxlfSBmcm9tICdAY3ljbGUvcnVuJztcbiAqIGNvbnN0IHtzb3VyY2VzLCBydW4sIGRpc3Bvc2V9ID0gc2V0dXBSZXVzYWJsZShkcml2ZXJzKTtcbiAqIC8vIC4uLlxuICogY29uc3Qgc2lua3MgPSBtYWluKHNvdXJjZXMpO1xuICogY29uc3QgZGlzcG9zZVJ1biA9IHJ1bihzaW5rcyk7XG4gKiAvLyAuLi5cbiAqIGRpc3Bvc2VSdW4oKTtcbiAqIC8vIC4uLlxuICogZGlzcG9zZSgpOyAvLyBlbmRzIHRoZSByZXVzYWJpbGl0eSBvZiBkcml2ZXJzXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gZHJpdmVycyBhbiBvYmplY3Qgd2hlcmUga2V5cyBhcmUgZHJpdmVyIG5hbWVzIGFuZCB2YWx1ZXNcbiAqIGFyZSBkcml2ZXIgZnVuY3Rpb25zLlxuICogQHJldHVybiB7T2JqZWN0fSBhbiBvYmplY3Qgd2l0aCB0aHJlZSBwcm9wZXJ0aWVzOiBgc291cmNlc2AsIGBydW5gIGFuZFxuICogYGRpc3Bvc2VgLiBgc291cmNlc2AgaXMgdGhlIGNvbGxlY3Rpb24gb2YgZHJpdmVyIHNvdXJjZXMsIGBydW5gIGlzIHRoZVxuICogZnVuY3Rpb24gdGhhdCBvbmNlIGNhbGxlZCB3aXRoICdzaW5rcycgYXMgYXJndW1lbnQsIHdpbGwgZXhlY3V0ZSB0aGVcbiAqIGFwcGxpY2F0aW9uLCB0eWluZyB0b2dldGhlciBzb3VyY2VzIHdpdGggc2lua3MuIGBkaXNwb3NlYCB0ZXJtaW5hdGVzIHRoZVxuICogcmV1c2FibGUgcmVzb3VyY2VzIHVzZWQgYnkgdGhlIGRyaXZlcnMuIE5vdGUgYWxzbyB0aGF0IGBydW5gIHJldHVybnMgYVxuICogZGlzcG9zZSBmdW5jdGlvbiB3aGljaCB0ZXJtaW5hdGVzIHJlc291cmNlcyB0aGF0IGFyZSBzcGVjaWZpYyAobm90IHJldXNhYmxlKVxuICogdG8gdGhhdCBydW4uXG4gKiBAZnVuY3Rpb24gc2V0dXBSZXVzYWJsZVxuICovXG5mdW5jdGlvbiBzZXR1cFJldXNhYmxlKGRyaXZlcnMpIHtcbiAgICBpZiAodHlwZW9mIGRyaXZlcnMgIT09IFwib2JqZWN0XCIgfHwgZHJpdmVycyA9PT0gbnVsbCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBcmd1bWVudCBnaXZlbiB0byBzZXR1cFJldXNhYmxlIG11c3QgYmUgYW4gb2JqZWN0IFwiICtcbiAgICAgICAgICAgIFwid2l0aCBkcml2ZXIgZnVuY3Rpb25zIGFzIHByb3BlcnRpZXMuXCIpO1xuICAgIH1cbiAgICBpZiAoaW50ZXJuYWxzXzEuaXNPYmplY3RFbXB0eShkcml2ZXJzKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBcmd1bWVudCBnaXZlbiB0byBzZXR1cFJldXNhYmxlIG11c3QgYmUgYW4gb2JqZWN0IFwiICtcbiAgICAgICAgICAgIFwid2l0aCBhdCBsZWFzdCBvbmUgZHJpdmVyIGZ1bmN0aW9uIGRlY2xhcmVkIGFzIGEgcHJvcGVydHkuXCIpO1xuICAgIH1cbiAgICB2YXIgc2lua1Byb3hpZXMgPSBpbnRlcm5hbHNfMS5tYWtlU2lua1Byb3hpZXMoZHJpdmVycyk7XG4gICAgdmFyIHJhd1NvdXJjZXMgPSBpbnRlcm5hbHNfMS5jYWxsRHJpdmVycyhkcml2ZXJzLCBzaW5rUHJveGllcyk7XG4gICAgdmFyIHNvdXJjZXMgPSBpbnRlcm5hbHNfMS5hZGFwdFNvdXJjZXMocmF3U291cmNlcyk7XG4gICAgZnVuY3Rpb24gX3J1bihzaW5rcykge1xuICAgICAgICByZXR1cm4gaW50ZXJuYWxzXzEucmVwbGljYXRlTWFueShzaW5rcywgc2lua1Byb3hpZXMpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBkaXNwb3NlRW5naW5lKCkge1xuICAgICAgICBpbnRlcm5hbHNfMS5kaXNwb3NlU291cmNlcyhzb3VyY2VzKTtcbiAgICAgICAgaW50ZXJuYWxzXzEuZGlzcG9zZVNpbmtQcm94aWVzKHNpbmtQcm94aWVzKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgc291cmNlczogc291cmNlcywgcnVuOiBfcnVuLCBkaXNwb3NlOiBkaXNwb3NlRW5naW5lIH07XG59XG5leHBvcnRzLnNldHVwUmV1c2FibGUgPSBzZXR1cFJldXNhYmxlO1xuLyoqXG4gKiBUYWtlcyBhIGBtYWluYCBmdW5jdGlvbiBhbmQgY2lyY3VsYXJseSBjb25uZWN0cyBpdCB0byB0aGUgZ2l2ZW4gY29sbGVjdGlvblxuICogb2YgZHJpdmVyIGZ1bmN0aW9ucy5cbiAqXG4gKiAqKkV4YW1wbGU6KipcbiAqIGBgYGpzXG4gKiBpbXBvcnQgcnVuIGZyb20gJ0BjeWNsZS9ydW4nO1xuICogY29uc3QgZGlzcG9zZSA9IHJ1bihtYWluLCBkcml2ZXJzKTtcbiAqIC8vIC4uLlxuICogZGlzcG9zZSgpO1xuICogYGBgXG4gKlxuICogVGhlIGBtYWluYCBmdW5jdGlvbiBleHBlY3RzIGEgY29sbGVjdGlvbiBvZiBcInNvdXJjZVwiIHN0cmVhbXMgKHJldHVybmVkIGZyb21cbiAqIGRyaXZlcnMpIGFzIGlucHV0LCBhbmQgc2hvdWxkIHJldHVybiBhIGNvbGxlY3Rpb24gb2YgXCJzaW5rXCIgc3RyZWFtcyAodG8gYmVcbiAqIGdpdmVuIHRvIGRyaXZlcnMpLiBBIFwiY29sbGVjdGlvbiBvZiBzdHJlYW1zXCIgaXMgYSBKYXZhU2NyaXB0IG9iamVjdCB3aGVyZVxuICoga2V5cyBtYXRjaCB0aGUgZHJpdmVyIG5hbWVzIHJlZ2lzdGVyZWQgYnkgdGhlIGBkcml2ZXJzYCBvYmplY3QsIGFuZCB2YWx1ZXNcbiAqIGFyZSB0aGUgc3RyZWFtcy4gUmVmZXIgdG8gdGhlIGRvY3VtZW50YXRpb24gb2YgZWFjaCBkcml2ZXIgdG8gc2VlIG1vcmVcbiAqIGRldGFpbHMgb24gd2hhdCB0eXBlcyBvZiBzb3VyY2VzIGl0IG91dHB1dHMgYW5kIHNpbmtzIGl0IHJlY2VpdmVzLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG1haW4gYSBmdW5jdGlvbiB0aGF0IHRha2VzIGBzb3VyY2VzYCBhcyBpbnB1dCBhbmQgb3V0cHV0c1xuICogYHNpbmtzYC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBkcml2ZXJzIGFuIG9iamVjdCB3aGVyZSBrZXlzIGFyZSBkcml2ZXIgbmFtZXMgYW5kIHZhbHVlc1xuICogYXJlIGRyaXZlciBmdW5jdGlvbnMuXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn0gYSBkaXNwb3NlIGZ1bmN0aW9uLCB1c2VkIHRvIHRlcm1pbmF0ZSB0aGUgZXhlY3V0aW9uIG9mIHRoZVxuICogQ3ljbGUuanMgcHJvZ3JhbSwgY2xlYW5pbmcgdXAgcmVzb3VyY2VzIHVzZWQuXG4gKiBAZnVuY3Rpb24gcnVuXG4gKi9cbmZ1bmN0aW9uIHJ1bihtYWluLCBkcml2ZXJzKSB7XG4gICAgdmFyIHByb2dyYW0gPSBzZXR1cChtYWluLCBkcml2ZXJzKTtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgICAgd2luZG93WydDeWNsZWpzRGV2VG9vbF9zdGFydEdyYXBoU2VyaWFsaXplciddKSB7XG4gICAgICAgIHdpbmRvd1snQ3ljbGVqc0RldlRvb2xfc3RhcnRHcmFwaFNlcmlhbGl6ZXInXShwcm9ncmFtLnNpbmtzKTtcbiAgICB9XG4gICAgcmV0dXJuIHByb2dyYW0ucnVuKCk7XG59XG5leHBvcnRzLnJ1biA9IHJ1bjtcbmV4cG9ydHMuZGVmYXVsdCA9IHJ1bjtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsIlwidXNlIHN0cmljdFwiO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xudmFyIHhzdHJlYW1fMSA9IHJlcXVpcmUoXCJ4c3RyZWFtXCIpO1xudmFyIHF1aWNrdGFza18xID0gcmVxdWlyZShcInF1aWNrdGFza1wiKTtcbnZhciBhZGFwdF8xID0gcmVxdWlyZShcIi4vYWRhcHRcIik7XG52YXIgc2NoZWR1bGVNaWNyb3Rhc2sgPSBxdWlja3Rhc2tfMS5kZWZhdWx0KCk7XG5mdW5jdGlvbiBtYWtlU2lua1Byb3hpZXMoZHJpdmVycykge1xuICAgIHZhciBzaW5rUHJveGllcyA9IHt9O1xuICAgIGZvciAodmFyIG5hbWVfMSBpbiBkcml2ZXJzKSB7XG4gICAgICAgIGlmIChkcml2ZXJzLmhhc093blByb3BlcnR5KG5hbWVfMSkpIHtcbiAgICAgICAgICAgIHNpbmtQcm94aWVzW25hbWVfMV0gPSB4c3RyZWFtXzEuZGVmYXVsdC5jcmVhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc2lua1Byb3hpZXM7XG59XG5leHBvcnRzLm1ha2VTaW5rUHJveGllcyA9IG1ha2VTaW5rUHJveGllcztcbmZ1bmN0aW9uIGNhbGxEcml2ZXJzKGRyaXZlcnMsIHNpbmtQcm94aWVzKSB7XG4gICAgdmFyIHNvdXJjZXMgPSB7fTtcbiAgICBmb3IgKHZhciBuYW1lXzIgaW4gZHJpdmVycykge1xuICAgICAgICBpZiAoZHJpdmVycy5oYXNPd25Qcm9wZXJ0eShuYW1lXzIpKSB7XG4gICAgICAgICAgICBzb3VyY2VzW25hbWVfMl0gPSBkcml2ZXJzW25hbWVfMl0oc2lua1Byb3hpZXNbbmFtZV8yXSwgbmFtZV8yKTtcbiAgICAgICAgICAgIGlmIChzb3VyY2VzW25hbWVfMl0gJiYgdHlwZW9mIHNvdXJjZXNbbmFtZV8yXSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBzb3VyY2VzW25hbWVfMl0uX2lzQ3ljbGVTb3VyY2UgPSBuYW1lXzI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHNvdXJjZXM7XG59XG5leHBvcnRzLmNhbGxEcml2ZXJzID0gY2FsbERyaXZlcnM7XG4vLyBOT1RFOiB0aGlzIHdpbGwgbXV0YXRlIGBzb3VyY2VzYC5cbmZ1bmN0aW9uIGFkYXB0U291cmNlcyhzb3VyY2VzKSB7XG4gICAgZm9yICh2YXIgbmFtZV8zIGluIHNvdXJjZXMpIHtcbiAgICAgICAgaWYgKHNvdXJjZXMuaGFzT3duUHJvcGVydHkobmFtZV8zKSAmJlxuICAgICAgICAgICAgc291cmNlc1tuYW1lXzNdICYmXG4gICAgICAgICAgICB0eXBlb2Ygc291cmNlc1tuYW1lXzNdWydzaGFtZWZ1bGx5U2VuZE5leHQnXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgc291cmNlc1tuYW1lXzNdID0gYWRhcHRfMS5hZGFwdChzb3VyY2VzW25hbWVfM10pO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzb3VyY2VzO1xufVxuZXhwb3J0cy5hZGFwdFNvdXJjZXMgPSBhZGFwdFNvdXJjZXM7XG5mdW5jdGlvbiByZXBsaWNhdGVNYW55KHNpbmtzLCBzaW5rUHJveGllcykge1xuICAgIHZhciBzaW5rTmFtZXMgPSBPYmplY3Qua2V5cyhzaW5rcykuZmlsdGVyKGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiAhIXNpbmtQcm94aWVzW25hbWVdOyB9KTtcbiAgICB2YXIgYnVmZmVycyA9IHt9O1xuICAgIHZhciByZXBsaWNhdG9ycyA9IHt9O1xuICAgIHNpbmtOYW1lcy5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIGJ1ZmZlcnNbbmFtZV0gPSB7IF9uOiBbXSwgX2U6IFtdIH07XG4gICAgICAgIHJlcGxpY2F0b3JzW25hbWVdID0ge1xuICAgICAgICAgICAgbmV4dDogZnVuY3Rpb24gKHgpIHsgcmV0dXJuIGJ1ZmZlcnNbbmFtZV0uX24ucHVzaCh4KTsgfSxcbiAgICAgICAgICAgIGVycm9yOiBmdW5jdGlvbiAoZXJyKSB7IHJldHVybiBidWZmZXJzW25hbWVdLl9lLnB1c2goZXJyKTsgfSxcbiAgICAgICAgICAgIGNvbXBsZXRlOiBmdW5jdGlvbiAoKSB7IH0sXG4gICAgICAgIH07XG4gICAgfSk7XG4gICAgdmFyIHN1YnNjcmlwdGlvbnMgPSBzaW5rTmFtZXMubWFwKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHJldHVybiB4c3RyZWFtXzEuZGVmYXVsdC5mcm9tT2JzZXJ2YWJsZShzaW5rc1tuYW1lXSkuc3Vic2NyaWJlKHJlcGxpY2F0b3JzW25hbWVdKTtcbiAgICB9KTtcbiAgICBzaW5rTmFtZXMuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICB2YXIgbGlzdGVuZXIgPSBzaW5rUHJveGllc1tuYW1lXTtcbiAgICAgICAgdmFyIG5leHQgPSBmdW5jdGlvbiAoeCkge1xuICAgICAgICAgICAgc2NoZWR1bGVNaWNyb3Rhc2soZnVuY3Rpb24gKCkgeyByZXR1cm4gbGlzdGVuZXIuX24oeCk7IH0pO1xuICAgICAgICB9O1xuICAgICAgICB2YXIgZXJyb3IgPSBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBzY2hlZHVsZU1pY3JvdGFzayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgKGNvbnNvbGUuZXJyb3IgfHwgY29uc29sZS5sb2cpKGVycik7XG4gICAgICAgICAgICAgICAgbGlzdGVuZXIuX2UoZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgICBidWZmZXJzW25hbWVdLl9uLmZvckVhY2gobmV4dCk7XG4gICAgICAgIGJ1ZmZlcnNbbmFtZV0uX2UuZm9yRWFjaChlcnJvcik7XG4gICAgICAgIHJlcGxpY2F0b3JzW25hbWVdLm5leHQgPSBuZXh0O1xuICAgICAgICByZXBsaWNhdG9yc1tuYW1lXS5lcnJvciA9IGVycm9yO1xuICAgICAgICAvLyBiZWNhdXNlIHNpbmsuc3Vic2NyaWJlKHJlcGxpY2F0b3IpIGhhZCBtdXRhdGVkIHJlcGxpY2F0b3IgdG8gYWRkXG4gICAgICAgIC8vIF9uLCBfZSwgX2MsIHdlIG11c3QgYWxzbyB1cGRhdGUgdGhlc2U6XG4gICAgICAgIHJlcGxpY2F0b3JzW25hbWVdLl9uID0gbmV4dDtcbiAgICAgICAgcmVwbGljYXRvcnNbbmFtZV0uX2UgPSBlcnJvcjtcbiAgICB9KTtcbiAgICBidWZmZXJzID0gbnVsbDsgLy8gZnJlZSB1cCBmb3IgR0NcbiAgICByZXR1cm4gZnVuY3Rpb24gZGlzcG9zZVJlcGxpY2F0aW9uKCkge1xuICAgICAgICBzdWJzY3JpcHRpb25zLmZvckVhY2goZnVuY3Rpb24gKHMpIHsgcmV0dXJuIHMudW5zdWJzY3JpYmUoKTsgfSk7XG4gICAgfTtcbn1cbmV4cG9ydHMucmVwbGljYXRlTWFueSA9IHJlcGxpY2F0ZU1hbnk7XG5mdW5jdGlvbiBkaXNwb3NlU2lua1Byb3hpZXMoc2lua1Byb3hpZXMpIHtcbiAgICBPYmplY3Qua2V5cyhzaW5rUHJveGllcykuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gc2lua1Byb3hpZXNbbmFtZV0uX2MoKTsgfSk7XG59XG5leHBvcnRzLmRpc3Bvc2VTaW5rUHJveGllcyA9IGRpc3Bvc2VTaW5rUHJveGllcztcbmZ1bmN0aW9uIGRpc3Bvc2VTb3VyY2VzKHNvdXJjZXMpIHtcbiAgICBmb3IgKHZhciBrIGluIHNvdXJjZXMpIHtcbiAgICAgICAgaWYgKHNvdXJjZXMuaGFzT3duUHJvcGVydHkoaykgJiZcbiAgICAgICAgICAgIHNvdXJjZXNba10gJiZcbiAgICAgICAgICAgIHNvdXJjZXNba10uZGlzcG9zZSkge1xuICAgICAgICAgICAgc291cmNlc1trXS5kaXNwb3NlKCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5leHBvcnRzLmRpc3Bvc2VTb3VyY2VzID0gZGlzcG9zZVNvdXJjZXM7XG5mdW5jdGlvbiBpc09iamVjdEVtcHR5KG9iaikge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopLmxlbmd0aCA9PT0gMDtcbn1cbmV4cG9ydHMuaXNPYmplY3RFbXB0eSA9IGlzT2JqZWN0RW1wdHk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbnRlcm5hbHMuanMubWFwIiwiLyohXHJcbiAqIEV2ZW50RW1pdHRlcjJcclxuICogaHR0cHM6Ly9naXRodWIuY29tL2hpajFueC9FdmVudEVtaXR0ZXIyXHJcbiAqXHJcbiAqIENvcHlyaWdodCAoYykgMjAxMyBoaWoxbnhcclxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxyXG4gKi9cclxuOyFmdW5jdGlvbih1bmRlZmluZWQpIHtcclxuXHJcbiAgdmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5ID8gQXJyYXkuaXNBcnJheSA6IGZ1bmN0aW9uIF9pc0FycmF5KG9iaikge1xyXG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSBcIltvYmplY3QgQXJyYXldXCI7XHJcbiAgfTtcclxuICB2YXIgZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xyXG5cclxuICBmdW5jdGlvbiBpbml0KCkge1xyXG4gICAgdGhpcy5fZXZlbnRzID0ge307XHJcbiAgICBpZiAodGhpcy5fY29uZikge1xyXG4gICAgICBjb25maWd1cmUuY2FsbCh0aGlzLCB0aGlzLl9jb25mKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIGNvbmZpZ3VyZShjb25mKSB7XHJcbiAgICBpZiAoY29uZikge1xyXG4gICAgICB0aGlzLl9jb25mID0gY29uZjtcclxuXHJcbiAgICAgIGNvbmYuZGVsaW1pdGVyICYmICh0aGlzLmRlbGltaXRlciA9IGNvbmYuZGVsaW1pdGVyKTtcclxuICAgICAgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyA9IGNvbmYubWF4TGlzdGVuZXJzICE9PSB1bmRlZmluZWQgPyBjb25mLm1heExpc3RlbmVycyA6IGRlZmF1bHRNYXhMaXN0ZW5lcnM7XHJcbiAgICAgIGNvbmYud2lsZGNhcmQgJiYgKHRoaXMud2lsZGNhcmQgPSBjb25mLndpbGRjYXJkKTtcclxuICAgICAgY29uZi5uZXdMaXN0ZW5lciAmJiAodGhpcy5uZXdMaXN0ZW5lciA9IGNvbmYubmV3TGlzdGVuZXIpO1xyXG4gICAgICBjb25mLnZlcmJvc2VNZW1vcnlMZWFrICYmICh0aGlzLnZlcmJvc2VNZW1vcnlMZWFrID0gY29uZi52ZXJib3NlTWVtb3J5TGVhayk7XHJcblxyXG4gICAgICBpZiAodGhpcy53aWxkY2FyZCkge1xyXG4gICAgICAgIHRoaXMubGlzdGVuZXJUcmVlID0ge307XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgPSBkZWZhdWx0TWF4TGlzdGVuZXJzO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gbG9nUG9zc2libGVNZW1vcnlMZWFrKGNvdW50LCBldmVudE5hbWUpIHtcclxuICAgIHZhciBlcnJvck1zZyA9ICcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcclxuICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcclxuICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJztcclxuXHJcbiAgICBpZih0aGlzLnZlcmJvc2VNZW1vcnlMZWFrKXtcclxuICAgICAgZXJyb3JNc2cgKz0gJyBFdmVudCBuYW1lOiAlcy4nO1xyXG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yTXNnLCBjb3VudCwgZXZlbnROYW1lKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3JNc2csIGNvdW50KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoY29uc29sZS50cmFjZSl7XHJcbiAgICAgIGNvbnNvbGUudHJhY2UoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIEV2ZW50RW1pdHRlcihjb25mKSB7XHJcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcclxuICAgIHRoaXMubmV3TGlzdGVuZXIgPSBmYWxzZTtcclxuICAgIHRoaXMudmVyYm9zZU1lbW9yeUxlYWsgPSBmYWxzZTtcclxuICAgIGNvbmZpZ3VyZS5jYWxsKHRoaXMsIGNvbmYpO1xyXG4gIH1cclxuICBFdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyMiA9IEV2ZW50RW1pdHRlcjsgLy8gYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgZm9yIGV4cG9ydGluZyBFdmVudEVtaXR0ZXIgcHJvcGVydHlcclxuXHJcbiAgLy9cclxuICAvLyBBdHRlbnRpb24sIGZ1bmN0aW9uIHJldHVybiB0eXBlIG5vdyBpcyBhcnJheSwgYWx3YXlzICFcclxuICAvLyBJdCBoYXMgemVybyBlbGVtZW50cyBpZiBubyBhbnkgbWF0Y2hlcyBmb3VuZCBhbmQgb25lIG9yIG1vcmVcclxuICAvLyBlbGVtZW50cyAobGVhZnMpIGlmIHRoZXJlIGFyZSBtYXRjaGVzXHJcbiAgLy9cclxuICBmdW5jdGlvbiBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWUsIGkpIHtcclxuICAgIGlmICghdHJlZSkge1xyXG4gICAgICByZXR1cm4gW107XHJcbiAgICB9XHJcbiAgICB2YXIgbGlzdGVuZXJzPVtdLCBsZWFmLCBsZW4sIGJyYW5jaCwgeFRyZWUsIHh4VHJlZSwgaXNvbGF0ZWRCcmFuY2gsIGVuZFJlYWNoZWQsXHJcbiAgICAgICAgdHlwZUxlbmd0aCA9IHR5cGUubGVuZ3RoLCBjdXJyZW50VHlwZSA9IHR5cGVbaV0sIG5leHRUeXBlID0gdHlwZVtpKzFdO1xyXG4gICAgaWYgKGkgPT09IHR5cGVMZW5ndGggJiYgdHJlZS5fbGlzdGVuZXJzKSB7XHJcbiAgICAgIC8vXHJcbiAgICAgIC8vIElmIGF0IHRoZSBlbmQgb2YgdGhlIGV2ZW50KHMpIGxpc3QgYW5kIHRoZSB0cmVlIGhhcyBsaXN0ZW5lcnNcclxuICAgICAgLy8gaW52b2tlIHRob3NlIGxpc3RlbmVycy5cclxuICAgICAgLy9cclxuICAgICAgaWYgKHR5cGVvZiB0cmVlLl9saXN0ZW5lcnMgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICBoYW5kbGVycyAmJiBoYW5kbGVycy5wdXNoKHRyZWUuX2xpc3RlbmVycyk7XHJcbiAgICAgICAgcmV0dXJuIFt0cmVlXTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBmb3IgKGxlYWYgPSAwLCBsZW4gPSB0cmVlLl9saXN0ZW5lcnMubGVuZ3RoOyBsZWFmIDwgbGVuOyBsZWFmKyspIHtcclxuICAgICAgICAgIGhhbmRsZXJzICYmIGhhbmRsZXJzLnB1c2godHJlZS5fbGlzdGVuZXJzW2xlYWZdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFt0cmVlXTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmICgoY3VycmVudFR5cGUgPT09ICcqJyB8fCBjdXJyZW50VHlwZSA9PT0gJyoqJykgfHwgdHJlZVtjdXJyZW50VHlwZV0pIHtcclxuICAgICAgLy9cclxuICAgICAgLy8gSWYgdGhlIGV2ZW50IGVtaXR0ZWQgaXMgJyonIGF0IHRoaXMgcGFydFxyXG4gICAgICAvLyBvciB0aGVyZSBpcyBhIGNvbmNyZXRlIG1hdGNoIGF0IHRoaXMgcGF0Y2hcclxuICAgICAgLy9cclxuICAgICAgaWYgKGN1cnJlbnRUeXBlID09PSAnKicpIHtcclxuICAgICAgICBmb3IgKGJyYW5jaCBpbiB0cmVlKSB7XHJcbiAgICAgICAgICBpZiAoYnJhbmNoICE9PSAnX2xpc3RlbmVycycgJiYgdHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XHJcbiAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkrMSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbGlzdGVuZXJzO1xyXG4gICAgICB9IGVsc2UgaWYoY3VycmVudFR5cGUgPT09ICcqKicpIHtcclxuICAgICAgICBlbmRSZWFjaGVkID0gKGkrMSA9PT0gdHlwZUxlbmd0aCB8fCAoaSsyID09PSB0eXBlTGVuZ3RoICYmIG5leHRUeXBlID09PSAnKicpKTtcclxuICAgICAgICBpZihlbmRSZWFjaGVkICYmIHRyZWUuX2xpc3RlbmVycykge1xyXG4gICAgICAgICAgLy8gVGhlIG5leHQgZWxlbWVudCBoYXMgYSBfbGlzdGVuZXJzLCBhZGQgaXQgdG8gdGhlIGhhbmRsZXJzLlxyXG4gICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWUsIHR5cGVMZW5ndGgpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAoYnJhbmNoIGluIHRyZWUpIHtcclxuICAgICAgICAgIGlmIChicmFuY2ggIT09ICdfbGlzdGVuZXJzJyAmJiB0cmVlLmhhc093blByb3BlcnR5KGJyYW5jaCkpIHtcclxuICAgICAgICAgICAgaWYoYnJhbmNoID09PSAnKicgfHwgYnJhbmNoID09PSAnKionKSB7XHJcbiAgICAgICAgICAgICAgaWYodHJlZVticmFuY2hdLl9saXN0ZW5lcnMgJiYgIWVuZFJlYWNoZWQpIHtcclxuICAgICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIHR5cGVMZW5ndGgpKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSkpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYoYnJhbmNoID09PSBuZXh0VHlwZSkge1xyXG4gICAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2JyYW5jaF0sIGkrMikpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgIC8vIE5vIG1hdGNoIG9uIHRoaXMgb25lLCBzaGlmdCBpbnRvIHRoZSB0cmVlIGJ1dCBub3QgaW4gdGhlIHR5cGUgYXJyYXkuXHJcbiAgICAgICAgICAgICAgbGlzdGVuZXJzID0gbGlzdGVuZXJzLmNvbmNhdChzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHRyZWVbYnJhbmNoXSwgaSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBsaXN0ZW5lcnM7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5jb25jYXQoc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB0cmVlW2N1cnJlbnRUeXBlXSwgaSsxKSk7XHJcbiAgICB9XHJcblxyXG4gICAgeFRyZWUgPSB0cmVlWycqJ107XHJcbiAgICBpZiAoeFRyZWUpIHtcclxuICAgICAgLy9cclxuICAgICAgLy8gSWYgdGhlIGxpc3RlbmVyIHRyZWUgd2lsbCBhbGxvdyBhbnkgbWF0Y2ggZm9yIHRoaXMgcGFydCxcclxuICAgICAgLy8gdGhlbiByZWN1cnNpdmVseSBleHBsb3JlIGFsbCBicmFuY2hlcyBvZiB0aGUgdHJlZVxyXG4gICAgICAvL1xyXG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHhUcmVlLCBpKzEpO1xyXG4gICAgfVxyXG5cclxuICAgIHh4VHJlZSA9IHRyZWVbJyoqJ107XHJcbiAgICBpZih4eFRyZWUpIHtcclxuICAgICAgaWYoaSA8IHR5cGVMZW5ndGgpIHtcclxuICAgICAgICBpZih4eFRyZWUuX2xpc3RlbmVycykge1xyXG4gICAgICAgICAgLy8gSWYgd2UgaGF2ZSBhIGxpc3RlbmVyIG9uIGEgJyoqJywgaXQgd2lsbCBjYXRjaCBhbGwsIHNvIGFkZCBpdHMgaGFuZGxlci5cclxuICAgICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlLCB0eXBlTGVuZ3RoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEJ1aWxkIGFycmF5cyBvZiBtYXRjaGluZyBuZXh0IGJyYW5jaGVzIGFuZCBvdGhlcnMuXHJcbiAgICAgICAgZm9yKGJyYW5jaCBpbiB4eFRyZWUpIHtcclxuICAgICAgICAgIGlmKGJyYW5jaCAhPT0gJ19saXN0ZW5lcnMnICYmIHh4VHJlZS5oYXNPd25Qcm9wZXJ0eShicmFuY2gpKSB7XHJcbiAgICAgICAgICAgIGlmKGJyYW5jaCA9PT0gbmV4dFR5cGUpIHtcclxuICAgICAgICAgICAgICAvLyBXZSBrbm93IHRoZSBuZXh0IGVsZW1lbnQgd2lsbCBtYXRjaCwgc28ganVtcCB0d2ljZS5cclxuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVticmFuY2hdLCBpKzIpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYoYnJhbmNoID09PSBjdXJyZW50VHlwZSkge1xyXG4gICAgICAgICAgICAgIC8vIEN1cnJlbnQgbm9kZSBtYXRjaGVzLCBtb3ZlIGludG8gdGhlIHRyZWUuXHJcbiAgICAgICAgICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlKGhhbmRsZXJzLCB0eXBlLCB4eFRyZWVbYnJhbmNoXSwgaSsxKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICBpc29sYXRlZEJyYW5jaCA9IHt9O1xyXG4gICAgICAgICAgICAgIGlzb2xhdGVkQnJhbmNoW2JyYW5jaF0gPSB4eFRyZWVbYnJhbmNoXTtcclxuICAgICAgICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHsgJyoqJzogaXNvbGF0ZWRCcmFuY2ggfSwgaSsxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIGlmKHh4VHJlZS5fbGlzdGVuZXJzKSB7XHJcbiAgICAgICAgLy8gV2UgaGF2ZSByZWFjaGVkIHRoZSBlbmQgYW5kIHN0aWxsIG9uIGEgJyoqJ1xyXG4gICAgICAgIHNlYXJjaExpc3RlbmVyVHJlZShoYW5kbGVycywgdHlwZSwgeHhUcmVlLCB0eXBlTGVuZ3RoKTtcclxuICAgICAgfSBlbHNlIGlmKHh4VHJlZVsnKiddICYmIHh4VHJlZVsnKiddLl9saXN0ZW5lcnMpIHtcclxuICAgICAgICBzZWFyY2hMaXN0ZW5lclRyZWUoaGFuZGxlcnMsIHR5cGUsIHh4VHJlZVsnKiddLCB0eXBlTGVuZ3RoKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBsaXN0ZW5lcnM7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBncm93TGlzdGVuZXJUcmVlKHR5cGUsIGxpc3RlbmVyKSB7XHJcblxyXG4gICAgdHlwZSA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xyXG5cclxuICAgIC8vXHJcbiAgICAvLyBMb29rcyBmb3IgdHdvIGNvbnNlY3V0aXZlICcqKicsIGlmIHNvLCBkb24ndCBhZGQgdGhlIGV2ZW50IGF0IGFsbC5cclxuICAgIC8vXHJcbiAgICBmb3IodmFyIGkgPSAwLCBsZW4gPSB0eXBlLmxlbmd0aDsgaSsxIDwgbGVuOyBpKyspIHtcclxuICAgICAgaWYodHlwZVtpXSA9PT0gJyoqJyAmJiB0eXBlW2krMV0gPT09ICcqKicpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB2YXIgdHJlZSA9IHRoaXMubGlzdGVuZXJUcmVlO1xyXG4gICAgdmFyIG5hbWUgPSB0eXBlLnNoaWZ0KCk7XHJcblxyXG4gICAgd2hpbGUgKG5hbWUgIT09IHVuZGVmaW5lZCkge1xyXG5cclxuICAgICAgaWYgKCF0cmVlW25hbWVdKSB7XHJcbiAgICAgICAgdHJlZVtuYW1lXSA9IHt9O1xyXG4gICAgICB9XHJcblxyXG4gICAgICB0cmVlID0gdHJlZVtuYW1lXTtcclxuXHJcbiAgICAgIGlmICh0eXBlLmxlbmd0aCA9PT0gMCkge1xyXG5cclxuICAgICAgICBpZiAoIXRyZWUuX2xpc3RlbmVycykge1xyXG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzID0gbGlzdGVuZXI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgaWYgKHR5cGVvZiB0cmVlLl9saXN0ZW5lcnMgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgdHJlZS5fbGlzdGVuZXJzID0gW3RyZWUuX2xpc3RlbmVyc107XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xyXG5cclxuICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgIXRyZWUuX2xpc3RlbmVycy53YXJuZWQgJiZcclxuICAgICAgICAgICAgdGhpcy5fZXZlbnRzLm1heExpc3RlbmVycyA+IDAgJiZcclxuICAgICAgICAgICAgdHJlZS5fbGlzdGVuZXJzLmxlbmd0aCA+IHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnNcclxuICAgICAgICAgICkge1xyXG4gICAgICAgICAgICB0cmVlLl9saXN0ZW5lcnMud2FybmVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgbG9nUG9zc2libGVNZW1vcnlMZWFrLmNhbGwodGhpcywgdHJlZS5fbGlzdGVuZXJzLmxlbmd0aCwgbmFtZSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICB9XHJcbiAgICAgIG5hbWUgPSB0eXBlLnNoaWZ0KCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW5cclxuICAvLyAxMCBsaXN0ZW5lcnMgYXJlIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2hcclxuICAvLyBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cclxuICAvL1xyXG4gIC8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xyXG4gIC8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmRlbGltaXRlciA9ICcuJztcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XHJcbiAgICBpZiAobiAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XHJcbiAgICAgIHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnMgPSBuO1xyXG4gICAgICBpZiAoIXRoaXMuX2NvbmYpIHRoaXMuX2NvbmYgPSB7fTtcclxuICAgICAgdGhpcy5fY29uZi5tYXhMaXN0ZW5lcnMgPSBuO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZXZlbnQgPSAnJztcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24oZXZlbnQsIGZuKSB7XHJcbiAgICB0aGlzLm1hbnkoZXZlbnQsIDEsIGZuKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubWFueSA9IGZ1bmN0aW9uKGV2ZW50LCB0dGwsIGZuKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hbnkgb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGxpc3RlbmVyKCkge1xyXG4gICAgICBpZiAoLS10dGwgPT09IDApIHtcclxuICAgICAgICBzZWxmLm9mZihldmVudCwgbGlzdGVuZXIpO1xyXG4gICAgICB9XHJcbiAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcblxyXG4gICAgbGlzdGVuZXIuX29yaWdpbiA9IGZuO1xyXG5cclxuICAgIHRoaXMub24oZXZlbnQsIGxpc3RlbmVyKTtcclxuXHJcbiAgICByZXR1cm4gc2VsZjtcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbigpIHtcclxuXHJcbiAgICB0aGlzLl9ldmVudHMgfHwgaW5pdC5jYWxsKHRoaXMpO1xyXG5cclxuICAgIHZhciB0eXBlID0gYXJndW1lbnRzWzBdO1xyXG5cclxuICAgIGlmICh0eXBlID09PSAnbmV3TGlzdGVuZXInICYmICF0aGlzLm5ld0xpc3RlbmVyKSB7XHJcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGFsID0gYXJndW1lbnRzLmxlbmd0aDtcclxuICAgIHZhciBhcmdzLGwsaSxqO1xyXG4gICAgdmFyIGhhbmRsZXI7XHJcblxyXG4gICAgaWYgKHRoaXMuX2FsbCAmJiB0aGlzLl9hbGwubGVuZ3RoKSB7XHJcbiAgICAgIGhhbmRsZXIgPSB0aGlzLl9hbGwuc2xpY2UoKTtcclxuICAgICAgaWYgKGFsID4gMykge1xyXG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkoYWwpO1xyXG4gICAgICAgIGZvciAoaiA9IDA7IGogPCBhbDsgaisrKSBhcmdzW2pdID0gYXJndW1lbnRzW2pdO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBmb3IgKGkgPSAwLCBsID0gaGFuZGxlci5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcclxuICAgICAgICBzd2l0Y2ggKGFsKSB7XHJcbiAgICAgICAgY2FzZSAxOlxyXG4gICAgICAgICAgaGFuZGxlcltpXS5jYWxsKHRoaXMsIHR5cGUpO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAyOlxyXG4gICAgICAgICAgaGFuZGxlcltpXS5jYWxsKHRoaXMsIHR5cGUsIGFyZ3VtZW50c1sxXSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDM6XHJcbiAgICAgICAgICBoYW5kbGVyW2ldLmNhbGwodGhpcywgdHlwZSwgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgIGhhbmRsZXJbaV0uYXBwbHkodGhpcywgYXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgaGFuZGxlciA9IFtdO1xyXG4gICAgICB2YXIgbnMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KHRoaXMuZGVsaW1pdGVyKSA6IHR5cGUuc2xpY2UoKTtcclxuICAgICAgc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgaGFuZGxlciwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XHJcbiAgICAgIGlmICh0eXBlb2YgaGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xyXG4gICAgICAgIHN3aXRjaCAoYWwpIHtcclxuICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDI6XHJcbiAgICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMzpcclxuICAgICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgYXJncyA9IG5ldyBBcnJheShhbCAtIDEpO1xyXG4gICAgICAgICAgZm9yIChqID0gMTsgaiA8IGFsOyBqKyspIGFyZ3NbaiAtIDFdID0gYXJndW1lbnRzW2pdO1xyXG4gICAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgIH0gZWxzZSBpZiAoaGFuZGxlcikge1xyXG4gICAgICAgIC8vIG5lZWQgdG8gbWFrZSBjb3B5IG9mIGhhbmRsZXJzIGJlY2F1c2UgbGlzdCBjYW4gY2hhbmdlIGluIHRoZSBtaWRkbGVcclxuICAgICAgICAvLyBvZiBlbWl0IGNhbGxcclxuICAgICAgICBoYW5kbGVyID0gaGFuZGxlci5zbGljZSgpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGhhbmRsZXIgJiYgaGFuZGxlci5sZW5ndGgpIHtcclxuICAgICAgaWYgKGFsID4gMykge1xyXG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkoYWwgLSAxKTtcclxuICAgICAgICBmb3IgKGogPSAxOyBqIDwgYWw7IGorKykgYXJnc1tqIC0gMV0gPSBhcmd1bWVudHNbal07XHJcbiAgICAgIH1cclxuICAgICAgZm9yIChpID0gMCwgbCA9IGhhbmRsZXIubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgdGhpcy5ldmVudCA9IHR5cGU7XHJcbiAgICAgICAgc3dpdGNoIChhbCkge1xyXG4gICAgICAgIGNhc2UgMTpcclxuICAgICAgICAgIGhhbmRsZXJbaV0uY2FsbCh0aGlzKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMjpcclxuICAgICAgICAgIGhhbmRsZXJbaV0uY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAzOlxyXG4gICAgICAgICAgaGFuZGxlcltpXS5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICBoYW5kbGVyW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0gZWxzZSBpZiAoIXRoaXMuX2FsbCAmJiB0eXBlID09PSAnZXJyb3InKSB7XHJcbiAgICAgIGlmIChhcmd1bWVudHNbMV0gaW5zdGFuY2VvZiBFcnJvcikge1xyXG4gICAgICAgIHRocm93IGFyZ3VtZW50c1sxXTsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmNhdWdodCwgdW5zcGVjaWZpZWQgJ2Vycm9yJyBldmVudC5cIik7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiAhIXRoaXMuX2FsbDtcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXRBc3luYyA9IGZ1bmN0aW9uKCkge1xyXG5cclxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XHJcblxyXG4gICAgdmFyIHR5cGUgPSBhcmd1bWVudHNbMF07XHJcblxyXG4gICAgaWYgKHR5cGUgPT09ICduZXdMaXN0ZW5lcicgJiYgIXRoaXMubmV3TGlzdGVuZXIpIHtcclxuICAgICAgICBpZiAoIXRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcikgeyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFtmYWxzZV0pOyB9XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHByb21pc2VzPSBbXTtcclxuXHJcbiAgICB2YXIgYWwgPSBhcmd1bWVudHMubGVuZ3RoO1xyXG4gICAgdmFyIGFyZ3MsbCxpLGo7XHJcbiAgICB2YXIgaGFuZGxlcjtcclxuXHJcbiAgICBpZiAodGhpcy5fYWxsKSB7XHJcbiAgICAgIGlmIChhbCA+IDMpIHtcclxuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGFsKTtcclxuICAgICAgICBmb3IgKGogPSAxOyBqIDwgYWw7IGorKykgYXJnc1tqXSA9IGFyZ3VtZW50c1tqXTtcclxuICAgICAgfVxyXG4gICAgICBmb3IgKGkgPSAwLCBsID0gdGhpcy5fYWxsLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xyXG4gICAgICAgIHN3aXRjaCAoYWwpIHtcclxuICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICBwcm9taXNlcy5wdXNoKHRoaXMuX2FsbFtpXS5jYWxsKHRoaXMsIHR5cGUpKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMjpcclxuICAgICAgICAgIHByb21pc2VzLnB1c2godGhpcy5fYWxsW2ldLmNhbGwodGhpcywgdHlwZSwgYXJndW1lbnRzWzFdKSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDM6XHJcbiAgICAgICAgICBwcm9taXNlcy5wdXNoKHRoaXMuX2FsbFtpXS5jYWxsKHRoaXMsIHR5cGUsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgcHJvbWlzZXMucHVzaCh0aGlzLl9hbGxbaV0uYXBwbHkodGhpcywgYXJncykpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgIGhhbmRsZXIgPSBbXTtcclxuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XHJcbiAgICAgIHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIGhhbmRsZXIsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0eXBlb2YgaGFuZGxlciA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aGlzLmV2ZW50ID0gdHlwZTtcclxuICAgICAgc3dpdGNoIChhbCkge1xyXG4gICAgICBjYXNlIDE6XHJcbiAgICAgICAgcHJvbWlzZXMucHVzaChoYW5kbGVyLmNhbGwodGhpcykpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIDI6XHJcbiAgICAgICAgcHJvbWlzZXMucHVzaChoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIGNhc2UgMzpcclxuICAgICAgICBwcm9taXNlcy5wdXNoKGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSkpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkoYWwgLSAxKTtcclxuICAgICAgICBmb3IgKGogPSAxOyBqIDwgYWw7IGorKykgYXJnc1tqIC0gMV0gPSBhcmd1bWVudHNbal07XHJcbiAgICAgICAgcHJvbWlzZXMucHVzaChoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIGlmIChoYW5kbGVyICYmIGhhbmRsZXIubGVuZ3RoKSB7XHJcbiAgICAgIGlmIChhbCA+IDMpIHtcclxuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGFsIC0gMSk7XHJcbiAgICAgICAgZm9yIChqID0gMTsgaiA8IGFsOyBqKyspIGFyZ3NbaiAtIDFdID0gYXJndW1lbnRzW2pdO1xyXG4gICAgICB9XHJcbiAgICAgIGZvciAoaSA9IDAsIGwgPSBoYW5kbGVyLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHRoaXMuZXZlbnQgPSB0eXBlO1xyXG4gICAgICAgIHN3aXRjaCAoYWwpIHtcclxuICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICBwcm9taXNlcy5wdXNoKGhhbmRsZXJbaV0uY2FsbCh0aGlzKSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDI6XHJcbiAgICAgICAgICBwcm9taXNlcy5wdXNoKGhhbmRsZXJbaV0uY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMzpcclxuICAgICAgICAgIHByb21pc2VzLnB1c2goaGFuZGxlcltpXS5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgcHJvbWlzZXMucHVzaChoYW5kbGVyW2ldLmFwcGx5KHRoaXMsIGFyZ3MpKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSBpZiAoIXRoaXMuX2FsbCAmJiB0eXBlID09PSAnZXJyb3InKSB7XHJcbiAgICAgIGlmIChhcmd1bWVudHNbMV0gaW5zdGFuY2VvZiBFcnJvcikge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChhcmd1bWVudHNbMV0pOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChcIlVuY2F1Z2h0LCB1bnNwZWNpZmllZCAnZXJyb3InIGV2ZW50LlwiKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcyk7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XHJcbiAgICBpZiAodHlwZW9mIHR5cGUgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgdGhpcy5vbkFueSh0eXBlKTtcclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uIG9ubHkgYWNjZXB0cyBpbnN0YW5jZXMgb2YgRnVuY3Rpb24nKTtcclxuICAgIH1cclxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XHJcblxyXG4gICAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PSBcIm5ld0xpc3RlbmVyc1wiISBCZWZvcmVcclxuICAgIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJzXCIuXHJcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xyXG5cclxuICAgIGlmICh0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgIGdyb3dMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCB0eXBlLCBsaXN0ZW5lcik7XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSB7XHJcbiAgICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxyXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICBpZiAodHlwZW9mIHRoaXMuX2V2ZW50c1t0eXBlXSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIC8vIENoYW5nZSB0byBhcnJheS5cclxuICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxyXG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XHJcblxyXG4gICAgICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xyXG4gICAgICBpZiAoXHJcbiAgICAgICAgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgJiZcclxuICAgICAgICB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzID4gMCAmJlxyXG4gICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzXHJcbiAgICAgICkge1xyXG4gICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xyXG4gICAgICAgIGxvZ1Bvc3NpYmxlTWVtb3J5TGVhay5jYWxsKHRoaXMsIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgsIHR5cGUpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbkFueSA9IGZ1bmN0aW9uKGZuKSB7XHJcbiAgICBpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignb25Bbnkgb25seSBhY2NlcHRzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy5fYWxsKSB7XHJcbiAgICAgIHRoaXMuX2FsbCA9IFtdO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEFkZCB0aGUgZnVuY3Rpb24gdG8gdGhlIGV2ZW50IGxpc3RlbmVyIGNvbGxlY3Rpb24uXHJcbiAgICB0aGlzLl9hbGwucHVzaChmbik7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbjtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xyXG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlbW92ZUxpc3RlbmVyIG9ubHkgdGFrZXMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGhhbmRsZXJzLGxlYWZzPVtdO1xyXG5cclxuICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XHJcbiAgICAgIGxlYWZzID0gc2VhcmNoTGlzdGVuZXJUcmVlLmNhbGwodGhpcywgbnVsbCwgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAvLyBkb2VzIG5vdCB1c2UgbGlzdGVuZXJzKCksIHNvIG5vIHNpZGUgZWZmZWN0IG9mIGNyZWF0aW5nIF9ldmVudHNbdHlwZV1cclxuICAgICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHJldHVybiB0aGlzO1xyXG4gICAgICBoYW5kbGVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcclxuICAgICAgbGVhZnMucHVzaCh7X2xpc3RlbmVyczpoYW5kbGVyc30pO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGlMZWFmPTA7IGlMZWFmPGxlYWZzLmxlbmd0aDsgaUxlYWYrKykge1xyXG4gICAgICB2YXIgbGVhZiA9IGxlYWZzW2lMZWFmXTtcclxuICAgICAgaGFuZGxlcnMgPSBsZWFmLl9saXN0ZW5lcnM7XHJcbiAgICAgIGlmIChpc0FycmF5KGhhbmRsZXJzKSkge1xyXG5cclxuICAgICAgICB2YXIgcG9zaXRpb24gPSAtMTtcclxuXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGhhbmRsZXJzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICBpZiAoaGFuZGxlcnNbaV0gPT09IGxpc3RlbmVyIHx8XHJcbiAgICAgICAgICAgIChoYW5kbGVyc1tpXS5saXN0ZW5lciAmJiBoYW5kbGVyc1tpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHx8XHJcbiAgICAgICAgICAgIChoYW5kbGVyc1tpXS5fb3JpZ2luICYmIGhhbmRsZXJzW2ldLl9vcmlnaW4gPT09IGxpc3RlbmVyKSkge1xyXG4gICAgICAgICAgICBwb3NpdGlvbiA9IGk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHBvc2l0aW9uIDwgMCkge1xyXG4gICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZih0aGlzLndpbGRjYXJkKSB7XHJcbiAgICAgICAgICBsZWFmLl9saXN0ZW5lcnMuc3BsaWNlKHBvc2l0aW9uLCAxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0uc3BsaWNlKHBvc2l0aW9uLCAxKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChoYW5kbGVycy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgICAgICAgZGVsZXRlIGxlYWYuX2xpc3RlbmVycztcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5lbWl0KFwicmVtb3ZlTGlzdGVuZXJcIiwgdHlwZSwgbGlzdGVuZXIpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgfVxyXG4gICAgICBlbHNlIGlmIChoYW5kbGVycyA9PT0gbGlzdGVuZXIgfHxcclxuICAgICAgICAoaGFuZGxlcnMubGlzdGVuZXIgJiYgaGFuZGxlcnMubGlzdGVuZXIgPT09IGxpc3RlbmVyKSB8fFxyXG4gICAgICAgIChoYW5kbGVycy5fb3JpZ2luICYmIGhhbmRsZXJzLl9vcmlnaW4gPT09IGxpc3RlbmVyKSkge1xyXG4gICAgICAgIGlmKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgICAgIGRlbGV0ZSBsZWFmLl9saXN0ZW5lcnM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuZW1pdChcInJlbW92ZUxpc3RlbmVyXCIsIHR5cGUsIGxpc3RlbmVyKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHJlY3Vyc2l2ZWx5R2FyYmFnZUNvbGxlY3Qocm9vdCkge1xyXG4gICAgICBpZiAocm9vdCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMocm9vdCk7XHJcbiAgICAgIGZvciAodmFyIGkgaW4ga2V5cykge1xyXG4gICAgICAgIHZhciBrZXkgPSBrZXlzW2ldO1xyXG4gICAgICAgIHZhciBvYmogPSByb290W2tleV07XHJcbiAgICAgICAgaWYgKChvYmogaW5zdGFuY2VvZiBGdW5jdGlvbikgfHwgKHR5cGVvZiBvYmogIT09IFwib2JqZWN0XCIpIHx8IChvYmogPT09IG51bGwpKVxyXG4gICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKG9iaikubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgcmVjdXJzaXZlbHlHYXJiYWdlQ29sbGVjdChyb290W2tleV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoT2JqZWN0LmtleXMob2JqKS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgIGRlbGV0ZSByb290W2tleV07XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZWN1cnNpdmVseUdhcmJhZ2VDb2xsZWN0KHRoaXMubGlzdGVuZXJUcmVlKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZkFueSA9IGZ1bmN0aW9uKGZuKSB7XHJcbiAgICB2YXIgaSA9IDAsIGwgPSAwLCBmbnM7XHJcbiAgICBpZiAoZm4gJiYgdGhpcy5fYWxsICYmIHRoaXMuX2FsbC5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGZucyA9IHRoaXMuX2FsbDtcclxuICAgICAgZm9yKGkgPSAwLCBsID0gZm5zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmKGZuID09PSBmbnNbaV0pIHtcclxuICAgICAgICAgIGZucy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgICAgICB0aGlzLmVtaXQoXCJyZW1vdmVMaXN0ZW5lckFueVwiLCBmbik7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGZucyA9IHRoaXMuX2FsbDtcclxuICAgICAgZm9yKGkgPSAwLCBsID0gZm5zLmxlbmd0aDsgaSA8IGw7IGkrKylcclxuICAgICAgICB0aGlzLmVtaXQoXCJyZW1vdmVMaXN0ZW5lckFueVwiLCBmbnNbaV0pO1xyXG4gICAgICB0aGlzLl9hbGwgPSBbXTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZjtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XHJcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAhdGhpcy5fZXZlbnRzIHx8IGluaXQuY2FsbCh0aGlzKTtcclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgdmFyIG5zID0gdHlwZW9mIHR5cGUgPT09ICdzdHJpbmcnID8gdHlwZS5zcGxpdCh0aGlzLmRlbGltaXRlcikgOiB0eXBlLnNsaWNlKCk7XHJcbiAgICAgIHZhciBsZWFmcyA9IHNlYXJjaExpc3RlbmVyVHJlZS5jYWxsKHRoaXMsIG51bGwsIG5zLCB0aGlzLmxpc3RlbmVyVHJlZSwgMCk7XHJcblxyXG4gICAgICBmb3IgKHZhciBpTGVhZj0wOyBpTGVhZjxsZWFmcy5sZW5ndGg7IGlMZWFmKyspIHtcclxuICAgICAgICB2YXIgbGVhZiA9IGxlYWZzW2lMZWFmXTtcclxuICAgICAgICBsZWFmLl9saXN0ZW5lcnMgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHMpIHtcclxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbnVsbDtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xyXG4gICAgaWYgKHRoaXMud2lsZGNhcmQpIHtcclxuICAgICAgdmFyIGhhbmRsZXJzID0gW107XHJcbiAgICAgIHZhciBucyA9IHR5cGVvZiB0eXBlID09PSAnc3RyaW5nJyA/IHR5cGUuc3BsaXQodGhpcy5kZWxpbWl0ZXIpIDogdHlwZS5zbGljZSgpO1xyXG4gICAgICBzZWFyY2hMaXN0ZW5lclRyZWUuY2FsbCh0aGlzLCBoYW5kbGVycywgbnMsIHRoaXMubGlzdGVuZXJUcmVlLCAwKTtcclxuICAgICAgcmV0dXJuIGhhbmRsZXJzO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX2V2ZW50cyB8fCBpbml0LmNhbGwodGhpcyk7XHJcblxyXG4gICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFtdO1xyXG4gICAgaWYgKCFpc0FycmF5KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHtcclxuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5fZXZlbnRzW3R5cGVdO1xyXG4gIH07XHJcblxyXG4gIEV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcclxuICAgIHJldHVybiB0aGlzLmxpc3RlbmVycyh0eXBlKS5sZW5ndGg7XHJcbiAgfTtcclxuXHJcbiAgRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnNBbnkgPSBmdW5jdGlvbigpIHtcclxuXHJcbiAgICBpZih0aGlzLl9hbGwpIHtcclxuICAgICAgcmV0dXJuIHRoaXMuX2FsbDtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICByZXR1cm4gW107XHJcbiAgICB9XHJcblxyXG4gIH07XHJcblxyXG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcclxuICAgICAvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUuXHJcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XHJcbiAgICAgIHJldHVybiBFdmVudEVtaXR0ZXI7XHJcbiAgICB9KTtcclxuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xyXG4gICAgLy8gQ29tbW9uSlNcclxuICAgIG1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xyXG4gIH1cclxuICBlbHNlIHtcclxuICAgIC8vIEJyb3dzZXIgZ2xvYmFsLlxyXG4gICAgd2luZG93LkV2ZW50RW1pdHRlcjIgPSBFdmVudEVtaXR0ZXI7XHJcbiAgfVxyXG59KCk7XHJcbiIsIi8qXG5vYmplY3QtYXNzaWduXG4oYykgU2luZHJlIFNvcmh1c1xuQGxpY2Vuc2UgTUlUXG4qL1xuXG4ndXNlIHN0cmljdCc7XG4vKiBlc2xpbnQtZGlzYWJsZSBuby11bnVzZWQtdmFycyAqL1xudmFyIGdldE93blByb3BlcnR5U3ltYm9scyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHM7XG52YXIgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHByb3BJc0VudW1lcmFibGUgPSBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlO1xuXG5mdW5jdGlvbiB0b09iamVjdCh2YWwpIHtcblx0aWYgKHZhbCA9PT0gbnVsbCB8fCB2YWwgPT09IHVuZGVmaW5lZCkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ09iamVjdC5hc3NpZ24gY2Fubm90IGJlIGNhbGxlZCB3aXRoIG51bGwgb3IgdW5kZWZpbmVkJyk7XG5cdH1cblxuXHRyZXR1cm4gT2JqZWN0KHZhbCk7XG59XG5cbmZ1bmN0aW9uIHNob3VsZFVzZU5hdGl2ZSgpIHtcblx0dHJ5IHtcblx0XHRpZiAoIU9iamVjdC5hc3NpZ24pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBEZXRlY3QgYnVnZ3kgcHJvcGVydHkgZW51bWVyYXRpb24gb3JkZXIgaW4gb2xkZXIgVjggdmVyc2lvbnMuXG5cblx0XHQvLyBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvdjgvaXNzdWVzL2RldGFpbD9pZD00MTE4XG5cdFx0dmFyIHRlc3QxID0gbmV3IFN0cmluZygnYWJjJyk7ICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLW5ldy13cmFwcGVyc1xuXHRcdHRlc3QxWzVdID0gJ2RlJztcblx0XHRpZiAoT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGVzdDEpWzBdID09PSAnNScpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBodHRwczovL2J1Z3MuY2hyb21pdW0ub3JnL3AvdjgvaXNzdWVzL2RldGFpbD9pZD0zMDU2XG5cdFx0dmFyIHRlc3QyID0ge307XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCAxMDsgaSsrKSB7XG5cdFx0XHR0ZXN0MlsnXycgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGkpXSA9IGk7XG5cdFx0fVxuXHRcdHZhciBvcmRlcjIgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0ZXN0MikubWFwKGZ1bmN0aW9uIChuKSB7XG5cdFx0XHRyZXR1cm4gdGVzdDJbbl07XG5cdFx0fSk7XG5cdFx0aWYgKG9yZGVyMi5qb2luKCcnKSAhPT0gJzAxMjM0NTY3ODknKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gaHR0cHM6Ly9idWdzLmNocm9taXVtLm9yZy9wL3Y4L2lzc3Vlcy9kZXRhaWw/aWQ9MzA1NlxuXHRcdHZhciB0ZXN0MyA9IHt9O1xuXHRcdCdhYmNkZWZnaGlqa2xtbm9wcXJzdCcuc3BsaXQoJycpLmZvckVhY2goZnVuY3Rpb24gKGxldHRlcikge1xuXHRcdFx0dGVzdDNbbGV0dGVyXSA9IGxldHRlcjtcblx0XHR9KTtcblx0XHRpZiAoT2JqZWN0LmtleXMoT2JqZWN0LmFzc2lnbih7fSwgdGVzdDMpKS5qb2luKCcnKSAhPT1cblx0XHRcdFx0J2FiY2RlZmdoaWprbG1ub3BxcnN0Jykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9IGNhdGNoIChlcnIpIHtcblx0XHQvLyBXZSBkb24ndCBleHBlY3QgYW55IG9mIHRoZSBhYm92ZSB0byB0aHJvdywgYnV0IGJldHRlciB0byBiZSBzYWZlLlxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNob3VsZFVzZU5hdGl2ZSgpID8gT2JqZWN0LmFzc2lnbiA6IGZ1bmN0aW9uICh0YXJnZXQsIHNvdXJjZSkge1xuXHR2YXIgZnJvbTtcblx0dmFyIHRvID0gdG9PYmplY3QodGFyZ2V0KTtcblx0dmFyIHN5bWJvbHM7XG5cblx0Zm9yICh2YXIgcyA9IDE7IHMgPCBhcmd1bWVudHMubGVuZ3RoOyBzKyspIHtcblx0XHRmcm9tID0gT2JqZWN0KGFyZ3VtZW50c1tzXSk7XG5cblx0XHRmb3IgKHZhciBrZXkgaW4gZnJvbSkge1xuXHRcdFx0aWYgKGhhc093blByb3BlcnR5LmNhbGwoZnJvbSwga2V5KSkge1xuXHRcdFx0XHR0b1trZXldID0gZnJvbVtrZXldO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChnZXRPd25Qcm9wZXJ0eVN5bWJvbHMpIHtcblx0XHRcdHN5bWJvbHMgPSBnZXRPd25Qcm9wZXJ0eVN5bWJvbHMoZnJvbSk7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHN5bWJvbHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHByb3BJc0VudW1lcmFibGUuY2FsbChmcm9tLCBzeW1ib2xzW2ldKSkge1xuXHRcdFx0XHRcdHRvW3N5bWJvbHNbaV1dID0gZnJvbVtzeW1ib2xzW2ldXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0bztcbn07XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG5mdW5jdGlvbiBtaWNyb3Rhc2soKSB7XG4gICAgaWYgKHR5cGVvZiBNdXRhdGlvbk9ic2VydmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB2YXIgbm9kZV8xID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICAgICAgICB2YXIgcXVldWVfMSA9IFtdO1xuICAgICAgICB2YXIgaV8xID0gMDtcbiAgICAgICAgbmV3IE11dGF0aW9uT2JzZXJ2ZXIoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgd2hpbGUgKHF1ZXVlXzEubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcXVldWVfMS5zaGlmdCgpKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLm9ic2VydmUobm9kZV8xLCB7IGNoYXJhY3RlckRhdGE6IHRydWUgfSk7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZm4pIHtcbiAgICAgICAgICAgIHF1ZXVlXzEucHVzaChmbik7XG4gICAgICAgICAgICBub2RlXzEuZGF0YSA9IGlfMSA9IDEgLSBpXzE7XG4gICAgICAgIH07XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBzZXRJbW1lZGlhdGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybiBzZXRJbW1lZGlhdGU7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm4gcHJvY2Vzcy5uZXh0VGljaztcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0O1xuICAgIH1cbn1cbmV4cG9ydHMuZGVmYXVsdCA9IG1pY3JvdGFzaztcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4LmpzLm1hcCIsIi8qKlxuICogQGZpbGVPdmVydmlld1xuICogQGF1dGhvciBSdXNzZWxsIFRvcmlzIC0gcmN0b3Jpc0B3cGkuZWR1XG4gKi9cblxuLyoqXG4gKiBJZiB5b3UgdXNlIHJvc2xpYiBpbiBhIGJyb3dzZXIsIGFsbCB0aGUgY2xhc3NlcyB3aWxsIGJlIGV4cG9ydGVkIHRvIGEgZ2xvYmFsIHZhcmlhYmxlIGNhbGxlZCBST1NMSUIuXG4gKlxuICogSWYgeW91IHVzZSBub2RlanMsIHRoaXMgaXMgdGhlIHZhcmlhYmxlIHlvdSBnZXQgd2hlbiB5b3UgcmVxdWlyZSgncm9zbGliJylcbiAqL1xudmFyIFJPU0xJQiA9IHRoaXMuUk9TTElCIHx8IHtcbiAgUkVWSVNJT04gOiAnMC4yMC4wJ1xufTtcblxudmFyIGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcblxuLy8gQWRkIGNvcmUgY29tcG9uZW50c1xuYXNzaWduKFJPU0xJQiwgcmVxdWlyZSgnLi9jb3JlJykpO1xuXG5hc3NpZ24oUk9TTElCLCByZXF1aXJlKCcuL2FjdGlvbmxpYicpKTtcblxuYXNzaWduKFJPU0xJQiwgcmVxdWlyZSgnLi9tYXRoJykpO1xuXG5hc3NpZ24oUk9TTElCLCByZXF1aXJlKCcuL3RmJykpO1xuXG5hc3NpZ24oUk9TTElCLCByZXF1aXJlKCcuL3VyZGYnKSk7XG5cbm1vZHVsZS5leHBvcnRzID0gUk9TTElCO1xuIiwiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3XG4gKiBAYXV0aG9yIFJ1c3NlbGwgVG9yaXMgLSByY3RvcmlzQHdwaS5lZHVcbiAqL1xuXG52YXIgVG9waWMgPSByZXF1aXJlKCcuLi9jb3JlL1RvcGljJyk7XG52YXIgTWVzc2FnZSA9IHJlcXVpcmUoJy4uL2NvcmUvTWVzc2FnZScpO1xudmFyIEV2ZW50RW1pdHRlcjIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIyJykuRXZlbnRFbWl0dGVyMjtcblxuLyoqXG4gKiBBbiBhY3Rpb25saWIgYWN0aW9uIGNsaWVudC5cbiAqXG4gKiBFbWl0cyB0aGUgZm9sbG93aW5nIGV2ZW50czpcbiAqICAqICd0aW1lb3V0JyAtIGlmIGEgdGltZW91dCBvY2N1cnJlZCB3aGlsZSBzZW5kaW5nIGEgZ29hbFxuICogICogJ3N0YXR1cycgLSB0aGUgc3RhdHVzIG1lc3NhZ2VzIHJlY2VpdmVkIGZyb20gdGhlIGFjdGlvbiBzZXJ2ZXJcbiAqICAqICdmZWVkYmFjaycgLSAgdGhlIGZlZWRiYWNrIG1lc3NhZ2VzIHJlY2VpdmVkIGZyb20gdGhlIGFjdGlvbiBzZXJ2ZXJcbiAqICAqICdyZXN1bHQnIC0gdGhlIHJlc3VsdCByZXR1cm5lZCBmcm9tIHRoZSBhY3Rpb24gc2VydmVyXG4gKlxuICogIEBjb25zdHJ1Y3RvclxuICogIEBwYXJhbSBvcHRpb25zIC0gb2JqZWN0IHdpdGggZm9sbG93aW5nIGtleXM6XG4gKiAgICogcm9zIC0gdGhlIFJPU0xJQi5Sb3MgY29ubmVjdGlvbiBoYW5kbGVcbiAqICAgKiBzZXJ2ZXJOYW1lIC0gdGhlIGFjdGlvbiBzZXJ2ZXIgbmFtZSwgbGlrZSAvZmlib25hY2NpXG4gKiAgICogYWN0aW9uTmFtZSAtIHRoZSBhY3Rpb24gbWVzc2FnZSBuYW1lLCBsaWtlICdhY3Rpb25saWJfdHV0b3JpYWxzL0ZpYm9uYWNjaUFjdGlvbidcbiAqICAgKiB0aW1lb3V0IC0gdGhlIHRpbWVvdXQgbGVuZ3RoIHdoZW4gY29ubmVjdGluZyB0byB0aGUgYWN0aW9uIHNlcnZlclxuICovXG5mdW5jdGlvbiBBY3Rpb25DbGllbnQob3B0aW9ucykge1xuICB2YXIgdGhhdCA9IHRoaXM7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB0aGlzLnJvcyA9IG9wdGlvbnMucm9zO1xuICB0aGlzLnNlcnZlck5hbWUgPSBvcHRpb25zLnNlcnZlck5hbWU7XG4gIHRoaXMuYWN0aW9uTmFtZSA9IG9wdGlvbnMuYWN0aW9uTmFtZTtcbiAgdGhpcy50aW1lb3V0ID0gb3B0aW9ucy50aW1lb3V0O1xuICB0aGlzLm9taXRGZWVkYmFjayA9IG9wdGlvbnMub21pdEZlZWRiYWNrO1xuICB0aGlzLm9taXRTdGF0dXMgPSBvcHRpb25zLm9taXRTdGF0dXM7XG4gIHRoaXMub21pdFJlc3VsdCA9IG9wdGlvbnMub21pdFJlc3VsdDtcbiAgdGhpcy5nb2FscyA9IHt9O1xuXG4gIC8vIGZsYWcgdG8gY2hlY2sgaWYgYSBzdGF0dXMgaGFzIGJlZW4gcmVjZWl2ZWRcbiAgdmFyIHJlY2VpdmVkU3RhdHVzID0gZmFsc2U7XG5cbiAgLy8gY3JlYXRlIHRoZSB0b3BpY3MgYXNzb2NpYXRlZCB3aXRoIGFjdGlvbmxpYlxuICB0aGlzLmZlZWRiYWNrTGlzdGVuZXIgPSBuZXcgVG9waWMoe1xuICAgIHJvcyA6IHRoaXMucm9zLFxuICAgIG5hbWUgOiB0aGlzLnNlcnZlck5hbWUgKyAnL2ZlZWRiYWNrJyxcbiAgICBtZXNzYWdlVHlwZSA6IHRoaXMuYWN0aW9uTmFtZSArICdGZWVkYmFjaydcbiAgfSk7XG5cbiAgdGhpcy5zdGF0dXNMaXN0ZW5lciA9IG5ldyBUb3BpYyh7XG4gICAgcm9zIDogdGhpcy5yb3MsXG4gICAgbmFtZSA6IHRoaXMuc2VydmVyTmFtZSArICcvc3RhdHVzJyxcbiAgICBtZXNzYWdlVHlwZSA6ICdhY3Rpb25saWJfbXNncy9Hb2FsU3RhdHVzQXJyYXknXG4gIH0pO1xuXG4gIHRoaXMucmVzdWx0TGlzdGVuZXIgPSBuZXcgVG9waWMoe1xuICAgIHJvcyA6IHRoaXMucm9zLFxuICAgIG5hbWUgOiB0aGlzLnNlcnZlck5hbWUgKyAnL3Jlc3VsdCcsXG4gICAgbWVzc2FnZVR5cGUgOiB0aGlzLmFjdGlvbk5hbWUgKyAnUmVzdWx0J1xuICB9KTtcblxuICB0aGlzLmdvYWxUb3BpYyA9IG5ldyBUb3BpYyh7XG4gICAgcm9zIDogdGhpcy5yb3MsXG4gICAgbmFtZSA6IHRoaXMuc2VydmVyTmFtZSArICcvZ29hbCcsXG4gICAgbWVzc2FnZVR5cGUgOiB0aGlzLmFjdGlvbk5hbWUgKyAnR29hbCdcbiAgfSk7XG5cbiAgdGhpcy5jYW5jZWxUb3BpYyA9IG5ldyBUb3BpYyh7XG4gICAgcm9zIDogdGhpcy5yb3MsXG4gICAgbmFtZSA6IHRoaXMuc2VydmVyTmFtZSArICcvY2FuY2VsJyxcbiAgICBtZXNzYWdlVHlwZSA6ICdhY3Rpb25saWJfbXNncy9Hb2FsSUQnXG4gIH0pO1xuXG4gIC8vIGFkdmVydGlzZSB0aGUgZ29hbCBhbmQgY2FuY2VsIHRvcGljc1xuICB0aGlzLmdvYWxUb3BpYy5hZHZlcnRpc2UoKTtcbiAgdGhpcy5jYW5jZWxUb3BpYy5hZHZlcnRpc2UoKTtcblxuICAvLyBzdWJzY3JpYmUgdG8gdGhlIHN0YXR1cyB0b3BpY1xuICBpZiAoIXRoaXMub21pdFN0YXR1cykge1xuICAgIHRoaXMuc3RhdHVzTGlzdGVuZXIuc3Vic2NyaWJlKGZ1bmN0aW9uKHN0YXR1c01lc3NhZ2UpIHtcbiAgICAgIHJlY2VpdmVkU3RhdHVzID0gdHJ1ZTtcbiAgICAgIHN0YXR1c01lc3NhZ2Uuc3RhdHVzX2xpc3QuZm9yRWFjaChmdW5jdGlvbihzdGF0dXMpIHtcbiAgICAgICAgdmFyIGdvYWwgPSB0aGF0LmdvYWxzW3N0YXR1cy5nb2FsX2lkLmlkXTtcbiAgICAgICAgaWYgKGdvYWwpIHtcbiAgICAgICAgICBnb2FsLmVtaXQoJ3N0YXR1cycsIHN0YXR1cyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gc3Vic2NyaWJlIHRoZSB0aGUgZmVlZGJhY2sgdG9waWNcbiAgaWYgKCF0aGlzLm9taXRGZWVkYmFjaykge1xuICAgIHRoaXMuZmVlZGJhY2tMaXN0ZW5lci5zdWJzY3JpYmUoZnVuY3Rpb24oZmVlZGJhY2tNZXNzYWdlKSB7XG4gICAgICB2YXIgZ29hbCA9IHRoYXQuZ29hbHNbZmVlZGJhY2tNZXNzYWdlLnN0YXR1cy5nb2FsX2lkLmlkXTtcbiAgICAgIGlmIChnb2FsKSB7XG4gICAgICAgIGdvYWwuZW1pdCgnc3RhdHVzJywgZmVlZGJhY2tNZXNzYWdlLnN0YXR1cyk7XG4gICAgICAgIGdvYWwuZW1pdCgnZmVlZGJhY2snLCBmZWVkYmFja01lc3NhZ2UuZmVlZGJhY2spO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gc3Vic2NyaWJlIHRvIHRoZSByZXN1bHQgdG9waWNcbiAgaWYgKCF0aGlzLm9taXRSZXN1bHQpIHtcbiAgICB0aGlzLnJlc3VsdExpc3RlbmVyLnN1YnNjcmliZShmdW5jdGlvbihyZXN1bHRNZXNzYWdlKSB7XG4gICAgICB2YXIgZ29hbCA9IHRoYXQuZ29hbHNbcmVzdWx0TWVzc2FnZS5zdGF0dXMuZ29hbF9pZC5pZF07XG5cbiAgICAgIGlmIChnb2FsKSB7XG4gICAgICAgIGdvYWwuZW1pdCgnc3RhdHVzJywgcmVzdWx0TWVzc2FnZS5zdGF0dXMpO1xuICAgICAgICBnb2FsLmVtaXQoJ3Jlc3VsdCcsIHJlc3VsdE1lc3NhZ2UucmVzdWx0KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIElmIHRpbWVvdXQgc3BlY2lmaWVkLCBlbWl0IGEgJ3RpbWVvdXQnIGV2ZW50IGlmIHRoZSBhY3Rpb24gc2VydmVyIGRvZXMgbm90IHJlc3BvbmRcbiAgaWYgKHRoaXMudGltZW91dCkge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXJlY2VpdmVkU3RhdHVzKSB7XG4gICAgICAgIHRoYXQuZW1pdCgndGltZW91dCcpO1xuICAgICAgfVxuICAgIH0sIHRoaXMudGltZW91dCk7XG4gIH1cbn1cblxuQWN0aW9uQ2xpZW50LnByb3RvdHlwZS5fX3Byb3RvX18gPSBFdmVudEVtaXR0ZXIyLnByb3RvdHlwZTtcblxuLyoqXG4gKiBDYW5jZWwgYWxsIGdvYWxzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIEFjdGlvbkNsaWVudC5cbiAqL1xuQWN0aW9uQ2xpZW50LnByb3RvdHlwZS5jYW5jZWwgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGNhbmNlbE1lc3NhZ2UgPSBuZXcgTWVzc2FnZSgpO1xuICB0aGlzLmNhbmNlbFRvcGljLnB1Ymxpc2goY2FuY2VsTWVzc2FnZSk7XG59O1xuXG4vKipcbiAqIFVuc3Vic2NyaWJlIGFuZCB1bmFkdmVydGlzZSBhbGwgdG9waWNzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIEFjdGlvbkNsaWVudC5cbiAqL1xuQWN0aW9uQ2xpZW50LnByb3RvdHlwZS5kaXNwb3NlID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuZ29hbFRvcGljLnVuYWR2ZXJ0aXNlKCk7XG4gIHRoaXMuY2FuY2VsVG9waWMudW5hZHZlcnRpc2UoKTtcbiAgaWYgKCF0aGlzLm9taXRTdGF0dXMpIHt0aGlzLnN0YXR1c0xpc3RlbmVyLnVuc3Vic2NyaWJlKCk7fVxuICBpZiAoIXRoaXMub21pdEZlZWRiYWNrKSB7dGhpcy5mZWVkYmFja0xpc3RlbmVyLnVuc3Vic2NyaWJlKCk7fVxuICBpZiAoIXRoaXMub21pdFJlc3VsdCkge3RoaXMucmVzdWx0TGlzdGVuZXIudW5zdWJzY3JpYmUoKTt9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFjdGlvbkNsaWVudDtcbiIsIi8qKlxuICogQGZpbGVPdmVydmlld1xuICogQGF1dGhvciBKdXN0aW4gWW91bmcgLSBqdXN0aW5Ab29kYXIuY29tLmF1XG4gKiBAYXV0aG9yIFJ1c3NlbGwgVG9yaXMgLSByY3RvcmlzQHdwaS5lZHVcbiAqL1xuXG52YXIgVG9waWMgPSByZXF1aXJlKCcuLi9jb3JlL1RvcGljJyk7XG52YXIgTWVzc2FnZSA9IHJlcXVpcmUoJy4uL2NvcmUvTWVzc2FnZScpO1xudmFyIEV2ZW50RW1pdHRlcjIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIyJykuRXZlbnRFbWl0dGVyMjtcblxuLyoqXG4gKiBBbiBhY3Rpb25saWIgYWN0aW9uIGxpc3RlbmVyXG4gKlxuICogRW1pdHMgdGhlIGZvbGxvd2luZyBldmVudHM6XG4gKiAgKiAnc3RhdHVzJyAtIHRoZSBzdGF0dXMgbWVzc2FnZXMgcmVjZWl2ZWQgZnJvbSB0aGUgYWN0aW9uIHNlcnZlclxuICogICogJ2ZlZWRiYWNrJyAtICB0aGUgZmVlZGJhY2sgbWVzc2FnZXMgcmVjZWl2ZWQgZnJvbSB0aGUgYWN0aW9uIHNlcnZlclxuICogICogJ3Jlc3VsdCcgLSB0aGUgcmVzdWx0IHJldHVybmVkIGZyb20gdGhlIGFjdGlvbiBzZXJ2ZXJcbiAqXG4gKiAgQGNvbnN0cnVjdG9yXG4gKiAgQHBhcmFtIG9wdGlvbnMgLSBvYmplY3Qgd2l0aCBmb2xsb3dpbmcga2V5czpcbiAqICAgKiByb3MgLSB0aGUgUk9TTElCLlJvcyBjb25uZWN0aW9uIGhhbmRsZVxuICogICAqIHNlcnZlck5hbWUgLSB0aGUgYWN0aW9uIHNlcnZlciBuYW1lLCBsaWtlIC9maWJvbmFjY2lcbiAqICAgKiBhY3Rpb25OYW1lIC0gdGhlIGFjdGlvbiBtZXNzYWdlIG5hbWUsIGxpa2UgJ2FjdGlvbmxpYl90dXRvcmlhbHMvRmlib25hY2NpQWN0aW9uJ1xuICovXG5mdW5jdGlvbiBBY3Rpb25MaXN0ZW5lcihvcHRpb25zKSB7XG4gIHZhciB0aGF0ID0gdGhpcztcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHRoaXMucm9zID0gb3B0aW9ucy5yb3M7XG4gIHRoaXMuc2VydmVyTmFtZSA9IG9wdGlvbnMuc2VydmVyTmFtZTtcbiAgdGhpcy5hY3Rpb25OYW1lID0gb3B0aW9ucy5hY3Rpb25OYW1lO1xuICB0aGlzLnRpbWVvdXQgPSBvcHRpb25zLnRpbWVvdXQ7XG4gIHRoaXMub21pdEZlZWRiYWNrID0gb3B0aW9ucy5vbWl0RmVlZGJhY2s7XG4gIHRoaXMub21pdFN0YXR1cyA9IG9wdGlvbnMub21pdFN0YXR1cztcbiAgdGhpcy5vbWl0UmVzdWx0ID0gb3B0aW9ucy5vbWl0UmVzdWx0O1xuXG5cbiAgLy8gY3JlYXRlIHRoZSB0b3BpY3MgYXNzb2NpYXRlZCB3aXRoIGFjdGlvbmxpYlxuICB2YXIgZ29hbExpc3RlbmVyID0gbmV3IFRvcGljKHtcbiAgICByb3MgOiB0aGlzLnJvcyxcbiAgICBuYW1lIDogdGhpcy5zZXJ2ZXJOYW1lICsgJy9nb2FsJyxcbiAgICBtZXNzYWdlVHlwZSA6IHRoaXMuYWN0aW9uTmFtZSArICdHb2FsJ1xuICB9KTtcblxuICB2YXIgZmVlZGJhY2tMaXN0ZW5lciA9IG5ldyBUb3BpYyh7XG4gICAgcm9zIDogdGhpcy5yb3MsXG4gICAgbmFtZSA6IHRoaXMuc2VydmVyTmFtZSArICcvZmVlZGJhY2snLFxuICAgIG1lc3NhZ2VUeXBlIDogdGhpcy5hY3Rpb25OYW1lICsgJ0ZlZWRiYWNrJ1xuICB9KTtcblxuICB2YXIgc3RhdHVzTGlzdGVuZXIgPSBuZXcgVG9waWMoe1xuICAgIHJvcyA6IHRoaXMucm9zLFxuICAgIG5hbWUgOiB0aGlzLnNlcnZlck5hbWUgKyAnL3N0YXR1cycsXG4gICAgbWVzc2FnZVR5cGUgOiAnYWN0aW9ubGliX21zZ3MvR29hbFN0YXR1c0FycmF5J1xuICB9KTtcblxuICB2YXIgcmVzdWx0TGlzdGVuZXIgPSBuZXcgVG9waWMoe1xuICAgIHJvcyA6IHRoaXMucm9zLFxuICAgIG5hbWUgOiB0aGlzLnNlcnZlck5hbWUgKyAnL3Jlc3VsdCcsXG4gICAgbWVzc2FnZVR5cGUgOiB0aGlzLmFjdGlvbk5hbWUgKyAnUmVzdWx0J1xuICB9KTtcblxuICBnb2FsTGlzdGVuZXIuc3Vic2NyaWJlKGZ1bmN0aW9uKGdvYWxNZXNzYWdlKSB7XG4gICAgICB0aGF0LmVtaXQoJ2dvYWwnLCBnb2FsTWVzc2FnZSk7XG4gIH0pO1xuXG4gIHN0YXR1c0xpc3RlbmVyLnN1YnNjcmliZShmdW5jdGlvbihzdGF0dXNNZXNzYWdlKSB7XG4gICAgICBzdGF0dXNNZXNzYWdlLnN0YXR1c19saXN0LmZvckVhY2goZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgICAgICAgdGhhdC5lbWl0KCdzdGF0dXMnLCBzdGF0dXMpO1xuICAgICAgfSk7XG4gIH0pO1xuXG4gIGZlZWRiYWNrTGlzdGVuZXIuc3Vic2NyaWJlKGZ1bmN0aW9uKGZlZWRiYWNrTWVzc2FnZSkge1xuICAgICAgdGhhdC5lbWl0KCdzdGF0dXMnLCBmZWVkYmFja01lc3NhZ2Uuc3RhdHVzKTtcbiAgICAgIHRoYXQuZW1pdCgnZmVlZGJhY2snLCBmZWVkYmFja01lc3NhZ2UuZmVlZGJhY2spO1xuICB9KTtcblxuICAvLyBzdWJzY3JpYmUgdG8gdGhlIHJlc3VsdCB0b3BpY1xuICByZXN1bHRMaXN0ZW5lci5zdWJzY3JpYmUoZnVuY3Rpb24ocmVzdWx0TWVzc2FnZSkge1xuICAgICAgdGhhdC5lbWl0KCdzdGF0dXMnLCByZXN1bHRNZXNzYWdlLnN0YXR1cyk7XG4gICAgICB0aGF0LmVtaXQoJ3Jlc3VsdCcsIHJlc3VsdE1lc3NhZ2UucmVzdWx0KTtcbiAgfSk7XG5cbn1cblxuQWN0aW9uTGlzdGVuZXIucHJvdG90eXBlLl9fcHJvdG9fXyA9IEV2ZW50RW1pdHRlcjIucHJvdG90eXBlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFjdGlvbkxpc3RlbmVyO1xuIiwiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3XG4gKiBAYXV0aG9yIFJ1c3NlbGwgVG9yaXMgLSByY3RvcmlzQHdwaS5lZHVcbiAqL1xuXG52YXIgTWVzc2FnZSA9IHJlcXVpcmUoJy4uL2NvcmUvTWVzc2FnZScpO1xudmFyIEV2ZW50RW1pdHRlcjIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIyJykuRXZlbnRFbWl0dGVyMjtcblxuLyoqXG4gKiBBbiBhY3Rpb25saWIgZ29hbCBnb2FsIGlzIGFzc29jaWF0ZWQgd2l0aCBhbiBhY3Rpb24gc2VydmVyLlxuICpcbiAqIEVtaXRzIHRoZSBmb2xsb3dpbmcgZXZlbnRzOlxuICogICogJ3RpbWVvdXQnIC0gaWYgYSB0aW1lb3V0IG9jY3VycmVkIHdoaWxlIHNlbmRpbmcgYSBnb2FsXG4gKlxuICogIEBjb25zdHJ1Y3RvclxuICogIEBwYXJhbSBvYmplY3Qgd2l0aCBmb2xsb3dpbmcga2V5czpcbiAqICAgKiBhY3Rpb25DbGllbnQgLSB0aGUgUk9TTElCLkFjdGlvbkNsaWVudCB0byB1c2Ugd2l0aCB0aGlzIGdvYWxcbiAqICAgKiBnb2FsTWVzc2FnZSAtIFRoZSBKU09OIG9iamVjdCBjb250YWluaW5nIHRoZSBnb2FsIGZvciB0aGUgYWN0aW9uIHNlcnZlclxuICovXG5mdW5jdGlvbiBHb2FsKG9wdGlvbnMpIHtcbiAgdmFyIHRoYXQgPSB0aGlzO1xuICB0aGlzLmFjdGlvbkNsaWVudCA9IG9wdGlvbnMuYWN0aW9uQ2xpZW50O1xuICB0aGlzLmdvYWxNZXNzYWdlID0gb3B0aW9ucy5nb2FsTWVzc2FnZTtcbiAgdGhpcy5pc0ZpbmlzaGVkID0gZmFsc2U7XG5cbiAgLy8gVXNlZCB0byBjcmVhdGUgcmFuZG9tIElEc1xuICB2YXIgZGF0ZSA9IG5ldyBEYXRlKCk7XG5cbiAgLy8gQ3JlYXRlIGEgcmFuZG9tIElEXG4gIHRoaXMuZ29hbElEID0gJ2dvYWxfJyArIE1hdGgucmFuZG9tKCkgKyAnXycgKyBkYXRlLmdldFRpbWUoKTtcbiAgLy8gRmlsbCBpbiB0aGUgZ29hbCBtZXNzYWdlXG4gIHRoaXMuZ29hbE1lc3NhZ2UgPSBuZXcgTWVzc2FnZSh7XG4gICAgZ29hbF9pZCA6IHtcbiAgICAgIHN0YW1wIDoge1xuICAgICAgICBzZWNzIDogMCxcbiAgICAgICAgbnNlY3MgOiAwXG4gICAgICB9LFxuICAgICAgaWQgOiB0aGlzLmdvYWxJRFxuICAgIH0sXG4gICAgZ29hbCA6IHRoaXMuZ29hbE1lc3NhZ2VcbiAgfSk7XG5cbiAgdGhpcy5vbignc3RhdHVzJywgZnVuY3Rpb24oc3RhdHVzKSB7XG4gICAgdGhhdC5zdGF0dXMgPSBzdGF0dXM7XG4gIH0pO1xuXG4gIHRoaXMub24oJ3Jlc3VsdCcsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgIHRoYXQuaXNGaW5pc2hlZCA9IHRydWU7XG4gICAgdGhhdC5yZXN1bHQgPSByZXN1bHQ7XG4gIH0pO1xuXG4gIHRoaXMub24oJ2ZlZWRiYWNrJywgZnVuY3Rpb24oZmVlZGJhY2spIHtcbiAgICB0aGF0LmZlZWRiYWNrID0gZmVlZGJhY2s7XG4gIH0pO1xuXG4gIC8vIEFkZCB0aGUgZ29hbFxuICB0aGlzLmFjdGlvbkNsaWVudC5nb2Fsc1t0aGlzLmdvYWxJRF0gPSB0aGlzO1xufVxuXG5Hb2FsLnByb3RvdHlwZS5fX3Byb3RvX18gPSBFdmVudEVtaXR0ZXIyLnByb3RvdHlwZTtcblxuLyoqXG4gKiBTZW5kIHRoZSBnb2FsIHRvIHRoZSBhY3Rpb24gc2VydmVyLlxuICpcbiAqIEBwYXJhbSB0aW1lb3V0IChvcHRpb25hbCkgLSBhIHRpbWVvdXQgbGVuZ3RoIGZvciB0aGUgZ29hbCdzIHJlc3VsdFxuICovXG5Hb2FsLnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24odGltZW91dCkge1xuICB2YXIgdGhhdCA9IHRoaXM7XG4gIHRoYXQuYWN0aW9uQ2xpZW50LmdvYWxUb3BpYy5wdWJsaXNoKHRoYXQuZ29hbE1lc3NhZ2UpO1xuICBpZiAodGltZW91dCkge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXRoYXQuaXNGaW5pc2hlZCkge1xuICAgICAgICB0aGF0LmVtaXQoJ3RpbWVvdXQnKTtcbiAgICAgIH1cbiAgICB9LCB0aW1lb3V0KTtcbiAgfVxufTtcblxuLyoqXG4gKiBDYW5jZWwgdGhlIGN1cnJlbnQgZ29hbC5cbiAqL1xuR29hbC5wcm90b3R5cGUuY2FuY2VsID0gZnVuY3Rpb24oKSB7XG4gIHZhciBjYW5jZWxNZXNzYWdlID0gbmV3IE1lc3NhZ2Uoe1xuICAgIGlkIDogdGhpcy5nb2FsSURcbiAgfSk7XG4gIHRoaXMuYWN0aW9uQ2xpZW50LmNhbmNlbFRvcGljLnB1Ymxpc2goY2FuY2VsTWVzc2FnZSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEdvYWw7IiwiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3XG4gKiBAYXV0aG9yIExhdXJhIExpbmR6ZXkgLSBsaW5kemV5QGdtYWlsLmNvbVxuICovXG5cbnZhciBUb3BpYyA9IHJlcXVpcmUoJy4uL2NvcmUvVG9waWMnKTtcbnZhciBNZXNzYWdlID0gcmVxdWlyZSgnLi4vY29yZS9NZXNzYWdlJyk7XG52YXIgRXZlbnRFbWl0dGVyMiA9IHJlcXVpcmUoJ2V2ZW50ZW1pdHRlcjInKS5FdmVudEVtaXR0ZXIyO1xuXG4vKipcbiAqIEFuIGFjdGlvbmxpYiBhY3Rpb24gc2VydmVyIGNsaWVudC5cbiAqXG4gKiBFbWl0cyB0aGUgZm9sbG93aW5nIGV2ZW50czpcbiAqICAqICdnb2FsJyAtIGdvYWwgc2VudCBieSBhY3Rpb24gY2xpZW50XG4gKiAgKiAnY2FuY2VsJyAtIGFjdGlvbiBjbGllbnQgaGFzIGNhbmNlbGVkIHRoZSByZXF1ZXN0XG4gKlxuICogIEBjb25zdHJ1Y3RvclxuICogIEBwYXJhbSBvcHRpb25zIC0gb2JqZWN0IHdpdGggZm9sbG93aW5nIGtleXM6XG4gKiAgICogcm9zIC0gdGhlIFJPU0xJQi5Sb3MgY29ubmVjdGlvbiBoYW5kbGVcbiAqICAgKiBzZXJ2ZXJOYW1lIC0gdGhlIGFjdGlvbiBzZXJ2ZXIgbmFtZSwgbGlrZSAvZmlib25hY2NpXG4gKiAgICogYWN0aW9uTmFtZSAtIHRoZSBhY3Rpb24gbWVzc2FnZSBuYW1lLCBsaWtlICdhY3Rpb25saWJfdHV0b3JpYWxzL0ZpYm9uYWNjaUFjdGlvbidcbiAqL1xuXG5mdW5jdGlvbiBTaW1wbGVBY3Rpb25TZXJ2ZXIob3B0aW9ucykge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB0aGlzLnJvcyA9IG9wdGlvbnMucm9zO1xuICAgIHRoaXMuc2VydmVyTmFtZSA9IG9wdGlvbnMuc2VydmVyTmFtZTtcbiAgICB0aGlzLmFjdGlvbk5hbWUgPSBvcHRpb25zLmFjdGlvbk5hbWU7XG5cbiAgICAvLyBjcmVhdGUgYW5kIGFkdmVydGlzZSBwdWJsaXNoZXJzXG4gICAgdGhpcy5mZWVkYmFja1B1Ymxpc2hlciA9IG5ldyBUb3BpYyh7XG4gICAgICAgIHJvcyA6IHRoaXMucm9zLFxuICAgICAgICBuYW1lIDogdGhpcy5zZXJ2ZXJOYW1lICsgJy9mZWVkYmFjaycsXG4gICAgICAgIG1lc3NhZ2VUeXBlIDogdGhpcy5hY3Rpb25OYW1lICsgJ0ZlZWRiYWNrJ1xuICAgIH0pO1xuICAgIHRoaXMuZmVlZGJhY2tQdWJsaXNoZXIuYWR2ZXJ0aXNlKCk7XG5cbiAgICB2YXIgc3RhdHVzUHVibGlzaGVyID0gbmV3IFRvcGljKHtcbiAgICAgICAgcm9zIDogdGhpcy5yb3MsXG4gICAgICAgIG5hbWUgOiB0aGlzLnNlcnZlck5hbWUgKyAnL3N0YXR1cycsXG4gICAgICAgIG1lc3NhZ2VUeXBlIDogJ2FjdGlvbmxpYl9tc2dzL0dvYWxTdGF0dXNBcnJheSdcbiAgICB9KTtcbiAgICBzdGF0dXNQdWJsaXNoZXIuYWR2ZXJ0aXNlKCk7XG5cbiAgICB0aGlzLnJlc3VsdFB1Ymxpc2hlciA9IG5ldyBUb3BpYyh7XG4gICAgICAgIHJvcyA6IHRoaXMucm9zLFxuICAgICAgICBuYW1lIDogdGhpcy5zZXJ2ZXJOYW1lICsgJy9yZXN1bHQnLFxuICAgICAgICBtZXNzYWdlVHlwZSA6IHRoaXMuYWN0aW9uTmFtZSArICdSZXN1bHQnXG4gICAgfSk7XG4gICAgdGhpcy5yZXN1bHRQdWJsaXNoZXIuYWR2ZXJ0aXNlKCk7XG5cbiAgICAvLyBjcmVhdGUgYW5kIHN1YnNjcmliZSB0byBsaXN0ZW5lcnNcbiAgICB2YXIgZ29hbExpc3RlbmVyID0gbmV3IFRvcGljKHtcbiAgICAgICAgcm9zIDogdGhpcy5yb3MsXG4gICAgICAgIG5hbWUgOiB0aGlzLnNlcnZlck5hbWUgKyAnL2dvYWwnLFxuICAgICAgICBtZXNzYWdlVHlwZSA6IHRoaXMuYWN0aW9uTmFtZSArICdHb2FsJ1xuICAgIH0pO1xuXG4gICAgdmFyIGNhbmNlbExpc3RlbmVyID0gbmV3IFRvcGljKHtcbiAgICAgICAgcm9zIDogdGhpcy5yb3MsXG4gICAgICAgIG5hbWUgOiB0aGlzLnNlcnZlck5hbWUgKyAnL2NhbmNlbCcsXG4gICAgICAgIG1lc3NhZ2VUeXBlIDogJ2FjdGlvbmxpYl9tc2dzL0dvYWxJRCdcbiAgICB9KTtcblxuICAgIC8vIFRyYWNrIHRoZSBnb2FscyBhbmQgdGhlaXIgc3RhdHVzIGluIG9yZGVyIHRvIHB1Ymxpc2ggc3RhdHVzLi4uXG4gICAgdGhpcy5zdGF0dXNNZXNzYWdlID0gbmV3IE1lc3NhZ2Uoe1xuICAgICAgICBoZWFkZXIgOiB7XG4gICAgICAgICAgICBzdGFtcCA6IHtzZWNzIDogMCwgbnNlY3MgOiAxMDB9LFxuICAgICAgICAgICAgZnJhbWVfaWQgOiAnJ1xuICAgICAgICB9LFxuICAgICAgICBzdGF0dXNfbGlzdCA6IFtdXG4gICAgfSk7XG5cbiAgICAvLyBuZWVkZWQgZm9yIGhhbmRsaW5nIHByZWVtcHRpb24gcHJvbXB0ZWQgYnkgYSBuZXcgZ29hbCBiZWluZyByZWNlaXZlZFxuICAgIHRoaXMuY3VycmVudEdvYWwgPSBudWxsOyAvLyBjdXJyZW50bHkgdHJhY2tlZCBnb2FsXG4gICAgdGhpcy5uZXh0R29hbCA9IG51bGw7IC8vIHRoZSBvbmUgdGhhdCdsbCBiZSBwcmVlbXB0aW5nXG5cbiAgICBnb2FsTGlzdGVuZXIuc3Vic2NyaWJlKGZ1bmN0aW9uKGdvYWxNZXNzYWdlKSB7XG4gICAgICAgIFxuICAgIGlmKHRoYXQuY3VycmVudEdvYWwpIHtcbiAgICAgICAgICAgIHRoYXQubmV4dEdvYWwgPSBnb2FsTWVzc2FnZTtcbiAgICAgICAgICAgIC8vIG5lZWRzIHRvIGhhcHBlbiBBRlRFUiByZXN0IGlzIHNldCB1cFxuICAgICAgICAgICAgdGhhdC5lbWl0KCdjYW5jZWwnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhhdC5zdGF0dXNNZXNzYWdlLnN0YXR1c19saXN0ID0gW3tnb2FsX2lkIDogZ29hbE1lc3NhZ2UuZ29hbF9pZCwgc3RhdHVzIDogMX1dO1xuICAgICAgICAgICAgdGhhdC5jdXJyZW50R29hbCA9IGdvYWxNZXNzYWdlO1xuICAgICAgICAgICAgdGhhdC5lbWl0KCdnb2FsJywgZ29hbE1lc3NhZ2UuZ29hbCk7XG4gICAgfVxuICAgIH0pO1xuXG4gICAgLy8gaGVscGVyIGZ1bmN0aW9uIGZvciBkZXRlcm1pbmcgb3JkZXJpbmcgb2YgdGltZXN0YW1wc1xuICAgIC8vIHJldHVybnMgdDEgPCB0MlxuICAgIHZhciBpc0VhcmxpZXIgPSBmdW5jdGlvbih0MSwgdDIpIHtcbiAgICAgICAgaWYodDEuc2VjcyA+IHQyLnNlY3MpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBlbHNlIGlmKHQxLnNlY3MgPCB0Mi5zZWNzKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmKHQxLm5zZWNzIDwgdDIubnNlY3MpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIFRPRE86IHRoaXMgbWF5IGJlIG1vcmUgY29tcGxpY2F0ZWQgdGhhbiBuZWNlc3NhcnksIHNpbmNlIEknbVxuICAgIC8vIG5vdCBzdXJlIGlmIHRoZSBjYWxsYmFja3MgY2FuIGV2ZXIgd2luZCB1cCB3aXRoIGEgc2NlbmFyaW9cbiAgICAvLyB3aGVyZSB3ZSd2ZSBiZWVuIHByZWVtcHRlZCBieSBhIG5leHQgZ29hbCwgaXQgaGFzbid0IGZpbmlzaGVkXG4gICAgLy8gcHJvY2Vzc2luZywgYW5kIHRoZW4gd2UgZ2V0IGEgY2FuY2VsIG1lc3NhZ2VcbiAgICBjYW5jZWxMaXN0ZW5lci5zdWJzY3JpYmUoZnVuY3Rpb24oY2FuY2VsTWVzc2FnZSkge1xuXG4gICAgICAgIC8vIGNhbmNlbCBBTEwgZ29hbHMgaWYgYm90aCBlbXB0eVxuICAgICAgICBpZihjYW5jZWxNZXNzYWdlLnN0YW1wLnNlY3MgPT09IDAgJiYgY2FuY2VsTWVzc2FnZS5zdGFtcC5zZWNzID09PSAwICYmIGNhbmNlbE1lc3NhZ2UuaWQgPT09ICcnKSB7XG4gICAgICAgICAgICB0aGF0Lm5leHRHb2FsID0gbnVsbDtcbiAgICAgICAgICAgIGlmKHRoYXQuY3VycmVudEdvYWwpIHtcbiAgICAgICAgICAgICAgICB0aGF0LmVtaXQoJ2NhbmNlbCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgeyAvLyB0cmVhdCBpZCBhbmQgc3RhbXAgaW5kZXBlbmRlbnRseVxuICAgICAgICAgICAgaWYodGhhdC5jdXJyZW50R29hbCAmJiBjYW5jZWxNZXNzYWdlLmlkID09PSB0aGF0LmN1cnJlbnRHb2FsLmdvYWxfaWQuaWQpIHtcbiAgICAgICAgICAgICAgICB0aGF0LmVtaXQoJ2NhbmNlbCcpO1xuICAgICAgICAgICAgfSBlbHNlIGlmKHRoYXQubmV4dEdvYWwgJiYgY2FuY2VsTWVzc2FnZS5pZCA9PT0gdGhhdC5uZXh0R29hbC5nb2FsX2lkLmlkKSB7XG4gICAgICAgICAgICAgICAgdGhhdC5uZXh0R29hbCA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHRoYXQubmV4dEdvYWwgJiYgaXNFYXJsaWVyKHRoYXQubmV4dEdvYWwuZ29hbF9pZC5zdGFtcCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbmNlbE1lc3NhZ2Uuc3RhbXApKSB7XG4gICAgICAgICAgICAgICAgdGhhdC5uZXh0R29hbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZih0aGF0LmN1cnJlbnRHb2FsICYmIGlzRWFybGllcih0aGF0LmN1cnJlbnRHb2FsLmdvYWxfaWQuc3RhbXAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW5jZWxNZXNzYWdlLnN0YW1wKSkge1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRoYXQuZW1pdCgnY2FuY2VsJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIHB1Ymxpc2ggc3RhdHVzIGF0IHBzZXVkby1maXhlZCByYXRlOyByZXF1aXJlZCBmb3IgY2xpZW50cyB0byBrbm93IHRoZXkndmUgY29ubmVjdGVkXG4gICAgdmFyIHN0YXR1c0ludGVydmFsID0gc2V0SW50ZXJ2YWwoIGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY3VycmVudFRpbWUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICB2YXIgc2VjcyA9IE1hdGguZmxvb3IoY3VycmVudFRpbWUuZ2V0VGltZSgpLzEwMDApO1xuICAgICAgICB2YXIgbnNlY3MgPSBNYXRoLnJvdW5kKDEwMDAwMDAwMDAqKGN1cnJlbnRUaW1lLmdldFRpbWUoKS8xMDAwLXNlY3MpKTtcbiAgICAgICAgdGhhdC5zdGF0dXNNZXNzYWdlLmhlYWRlci5zdGFtcC5zZWNzID0gc2VjcztcbiAgICAgICAgdGhhdC5zdGF0dXNNZXNzYWdlLmhlYWRlci5zdGFtcC5uc2VjcyA9IG5zZWNzO1xuICAgICAgICBzdGF0dXNQdWJsaXNoZXIucHVibGlzaCh0aGF0LnN0YXR1c01lc3NhZ2UpO1xuICAgIH0sIDUwMCk7IC8vIHB1Ymxpc2ggZXZlcnkgNTAwbXNcblxufVxuXG5TaW1wbGVBY3Rpb25TZXJ2ZXIucHJvdG90eXBlLl9fcHJvdG9fXyA9IEV2ZW50RW1pdHRlcjIucHJvdG90eXBlO1xuXG4vKipcbiogIFNldCBhY3Rpb24gc3RhdGUgdG8gc3VjY2VlZGVkIGFuZCByZXR1cm4gdG8gY2xpZW50XG4qL1xuXG5TaW1wbGVBY3Rpb25TZXJ2ZXIucHJvdG90eXBlLnNldFN1Y2NlZWRlZCA9IGZ1bmN0aW9uKHJlc3VsdDIpIHtcbiAgICBcblxuICAgIHZhciByZXN1bHRNZXNzYWdlID0gbmV3IE1lc3NhZ2Uoe1xuICAgICAgICBzdGF0dXMgOiB7Z29hbF9pZCA6IHRoaXMuY3VycmVudEdvYWwuZ29hbF9pZCwgc3RhdHVzIDogM30sXG4gICAgICAgIHJlc3VsdCA6IHJlc3VsdDJcbiAgICB9KTtcbiAgICB0aGlzLnJlc3VsdFB1Ymxpc2hlci5wdWJsaXNoKHJlc3VsdE1lc3NhZ2UpO1xuXG4gICAgdGhpcy5zdGF0dXNNZXNzYWdlLnN0YXR1c19saXN0ID0gW107XG4gICAgaWYodGhpcy5uZXh0R29hbCkge1xuICAgICAgICB0aGlzLmN1cnJlbnRHb2FsID0gdGhpcy5uZXh0R29hbDtcbiAgICAgICAgdGhpcy5uZXh0R29hbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZW1pdCgnZ29hbCcsIHRoaXMuY3VycmVudEdvYWwuZ29hbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jdXJyZW50R29hbCA9IG51bGw7XG4gICAgfVxufTtcblxuLyoqXG4qICBGdW5jdGlvbiB0byBzZW5kIGZlZWRiYWNrXG4qL1xuXG5TaW1wbGVBY3Rpb25TZXJ2ZXIucHJvdG90eXBlLnNlbmRGZWVkYmFjayA9IGZ1bmN0aW9uKGZlZWRiYWNrMikge1xuXG4gICAgdmFyIGZlZWRiYWNrTWVzc2FnZSA9IG5ldyBNZXNzYWdlKHtcbiAgICAgICAgc3RhdHVzIDoge2dvYWxfaWQgOiB0aGlzLmN1cnJlbnRHb2FsLmdvYWxfaWQsIHN0YXR1cyA6IDF9LFxuICAgICAgICBmZWVkYmFjayA6IGZlZWRiYWNrMlxuICAgIH0pO1xuICAgIHRoaXMuZmVlZGJhY2tQdWJsaXNoZXIucHVibGlzaChmZWVkYmFja01lc3NhZ2UpO1xufTtcblxuLyoqXG4qICBIYW5kbGUgY2FzZSB3aGVyZSBjbGllbnQgcmVxdWVzdHMgcHJlZW1wdGlvblxuKi9cblxuU2ltcGxlQWN0aW9uU2VydmVyLnByb3RvdHlwZS5zZXRQcmVlbXB0ZWQgPSBmdW5jdGlvbigpIHtcblxuICAgIHRoaXMuc3RhdHVzTWVzc2FnZS5zdGF0dXNfbGlzdCA9IFtdO1xuICAgIHZhciByZXN1bHRNZXNzYWdlID0gbmV3IE1lc3NhZ2Uoe1xuICAgICAgICBzdGF0dXMgOiB7Z29hbF9pZCA6IHRoaXMuY3VycmVudEdvYWwuZ29hbF9pZCwgc3RhdHVzIDogMn0sXG4gICAgfSk7XG4gICAgdGhpcy5yZXN1bHRQdWJsaXNoZXIucHVibGlzaChyZXN1bHRNZXNzYWdlKTtcblxuICAgIGlmKHRoaXMubmV4dEdvYWwpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50R29hbCA9IHRoaXMubmV4dEdvYWw7XG4gICAgICAgIHRoaXMubmV4dEdvYWwgPSBudWxsO1xuICAgICAgICB0aGlzLmVtaXQoJ2dvYWwnLCB0aGlzLmN1cnJlbnRHb2FsLmdvYWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuY3VycmVudEdvYWwgPSBudWxsO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU2ltcGxlQWN0aW9uU2VydmVyOyIsInZhciBSb3MgPSByZXF1aXJlKCcuLi9jb3JlL1JvcycpO1xudmFyIG1peGluID0gcmVxdWlyZSgnLi4vbWl4aW4nKTtcblxudmFyIGFjdGlvbiA9IG1vZHVsZS5leHBvcnRzID0ge1xuICAgIEFjdGlvbkNsaWVudDogcmVxdWlyZSgnLi9BY3Rpb25DbGllbnQnKSxcbiAgICBBY3Rpb25MaXN0ZW5lcjogcmVxdWlyZSgnLi9BY3Rpb25MaXN0ZW5lcicpLFxuICAgIEdvYWw6IHJlcXVpcmUoJy4vR29hbCcpLFxuICAgIFNpbXBsZUFjdGlvblNlcnZlcjogcmVxdWlyZSgnLi9TaW1wbGVBY3Rpb25TZXJ2ZXInKVxufTtcblxubWl4aW4oUm9zLCBbJ0FjdGlvbkNsaWVudCcsICdTaW1wbGVBY3Rpb25TZXJ2ZXInXSwgYWN0aW9uKTtcbiIsIi8qKlxuICogQGZpbGVvdmVydmlld1xuICogQGF1dGhvciBCcmFuZG9uIEFsZXhhbmRlciAtIGJhYWxleGFuZGVyQGdtYWlsLmNvbVxuICovXG5cbnZhciBhc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG5cbi8qKlxuICogTWVzc2FnZSBvYmplY3RzIGFyZSB1c2VkIGZvciBwdWJsaXNoaW5nIGFuZCBzdWJzY3JpYmluZyB0byBhbmQgZnJvbSB0b3BpY3MuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gdmFsdWVzIC0gb2JqZWN0IG1hdGNoaW5nIHRoZSBmaWVsZHMgZGVmaW5lZCBpbiB0aGUgLm1zZyBkZWZpbml0aW9uIGZpbGVcbiAqL1xuZnVuY3Rpb24gTWVzc2FnZSh2YWx1ZXMpIHtcbiAgYXNzaWduKHRoaXMsIHZhbHVlcyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gTWVzc2FnZTsiLCIvKipcbiAqIEBmaWxlb3ZlcnZpZXdcbiAqIEBhdXRob3IgQnJhbmRvbiBBbGV4YW5kZXIgLSBiYWFsZXhhbmRlckBnbWFpbC5jb21cbiAqL1xuXG52YXIgU2VydmljZSA9IHJlcXVpcmUoJy4vU2VydmljZScpO1xudmFyIFNlcnZpY2VSZXF1ZXN0ID0gcmVxdWlyZSgnLi9TZXJ2aWNlUmVxdWVzdCcpO1xuXG4vKipcbiAqIEEgUk9TIHBhcmFtZXRlci5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSBvcHRpb25zIC0gcG9zc2libGUga2V5cyBpbmNsdWRlOlxuICogICAqIHJvcyAtIHRoZSBST1NMSUIuUm9zIGNvbm5lY3Rpb24gaGFuZGxlXG4gKiAgICogbmFtZSAtIHRoZSBwYXJhbSBuYW1lLCBsaWtlIG1heF92ZWxfeFxuICovXG5mdW5jdGlvbiBQYXJhbShvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB0aGlzLnJvcyA9IG9wdGlvbnMucm9zO1xuICB0aGlzLm5hbWUgPSBvcHRpb25zLm5hbWU7XG59XG5cbi8qKlxuICogRmV0Y2hlcyB0aGUgdmFsdWUgb2YgdGhlIHBhcmFtLlxuICpcbiAqIEBwYXJhbSBjYWxsYmFjayAtIGZ1bmN0aW9uIHdpdGggdGhlIGZvbGxvd2luZyBwYXJhbXM6XG4gKiAgKiB2YWx1ZSAtIHRoZSB2YWx1ZSBvZiB0aGUgcGFyYW0gZnJvbSBST1MuXG4gKi9cblBhcmFtLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICB2YXIgcGFyYW1DbGllbnQgPSBuZXcgU2VydmljZSh7XG4gICAgcm9zIDogdGhpcy5yb3MsXG4gICAgbmFtZSA6ICcvcm9zYXBpL2dldF9wYXJhbScsXG4gICAgc2VydmljZVR5cGUgOiAncm9zYXBpL0dldFBhcmFtJ1xuICB9KTtcblxuICB2YXIgcmVxdWVzdCA9IG5ldyBTZXJ2aWNlUmVxdWVzdCh7XG4gICAgbmFtZSA6IHRoaXMubmFtZVxuICB9KTtcblxuICBwYXJhbUNsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICB2YXIgdmFsdWUgPSBKU09OLnBhcnNlKHJlc3VsdC52YWx1ZSk7XG4gICAgY2FsbGJhY2sodmFsdWUpO1xuICB9KTtcbn07XG5cbi8qKlxuICogU2V0cyB0aGUgdmFsdWUgb2YgdGhlIHBhcmFtIGluIFJPUy5cbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSB2YWx1ZSB0byBzZXQgcGFyYW0gdG8uXG4gKi9cblBhcmFtLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbih2YWx1ZSwgY2FsbGJhY2spIHtcbiAgdmFyIHBhcmFtQ2xpZW50ID0gbmV3IFNlcnZpY2Uoe1xuICAgIHJvcyA6IHRoaXMucm9zLFxuICAgIG5hbWUgOiAnL3Jvc2FwaS9zZXRfcGFyYW0nLFxuICAgIHNlcnZpY2VUeXBlIDogJ3Jvc2FwaS9TZXRQYXJhbSdcbiAgfSk7XG5cbiAgdmFyIHJlcXVlc3QgPSBuZXcgU2VydmljZVJlcXVlc3Qoe1xuICAgIG5hbWUgOiB0aGlzLm5hbWUsXG4gICAgdmFsdWUgOiBKU09OLnN0cmluZ2lmeSh2YWx1ZSlcbiAgfSk7XG5cbiAgcGFyYW1DbGllbnQuY2FsbFNlcnZpY2UocmVxdWVzdCwgY2FsbGJhY2spO1xufTtcblxuLyoqXG4gKiBEZWxldGUgdGhpcyBwYXJhbWV0ZXIgb24gdGhlIFJPUyBzZXJ2ZXIuXG4gKi9cblBhcmFtLnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICB2YXIgcGFyYW1DbGllbnQgPSBuZXcgU2VydmljZSh7XG4gICAgcm9zIDogdGhpcy5yb3MsXG4gICAgbmFtZSA6ICcvcm9zYXBpL2RlbGV0ZV9wYXJhbScsXG4gICAgc2VydmljZVR5cGUgOiAncm9zYXBpL0RlbGV0ZVBhcmFtJ1xuICB9KTtcblxuICB2YXIgcmVxdWVzdCA9IG5ldyBTZXJ2aWNlUmVxdWVzdCh7XG4gICAgbmFtZSA6IHRoaXMubmFtZVxuICB9KTtcblxuICBwYXJhbUNsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LCBjYWxsYmFjayk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcmFtOyIsIi8qKlxuICogQGZpbGVvdmVydmlld1xuICogQGF1dGhvciBCcmFuZG9uIEFsZXhhbmRlciAtIGJhYWxleGFuZGVyQGdtYWlsLmNvbVxuICovXG5cbnZhciBXZWJTb2NrZXQgPSByZXF1aXJlKCd3cycpO1xudmFyIHNvY2tldEFkYXB0ZXIgPSByZXF1aXJlKCcuL1NvY2tldEFkYXB0ZXIuanMnKTtcblxudmFyIFNlcnZpY2UgPSByZXF1aXJlKCcuL1NlcnZpY2UnKTtcbnZhciBTZXJ2aWNlUmVxdWVzdCA9IHJlcXVpcmUoJy4vU2VydmljZVJlcXVlc3QnKTtcblxudmFyIGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcbnZhciBFdmVudEVtaXR0ZXIyID0gcmVxdWlyZSgnZXZlbnRlbWl0dGVyMicpLkV2ZW50RW1pdHRlcjI7XG5cbi8qKlxuICogTWFuYWdlcyBjb25uZWN0aW9uIHRvIHRoZSBzZXJ2ZXIgYW5kIGFsbCBpbnRlcmFjdGlvbnMgd2l0aCBST1MuXG4gKlxuICogRW1pdHMgdGhlIGZvbGxvd2luZyBldmVudHM6XG4gKiAgKiAnZXJyb3InIC0gdGhlcmUgd2FzIGFuIGVycm9yIHdpdGggUk9TXG4gKiAgKiAnY29ubmVjdGlvbicgLSBjb25uZWN0ZWQgdG8gdGhlIFdlYlNvY2tldCBzZXJ2ZXJcbiAqICAqICdjbG9zZScgLSBkaXNjb25uZWN0ZWQgdG8gdGhlIFdlYlNvY2tldCBzZXJ2ZXJcbiAqICAqIDx0b3BpY05hbWU+IC0gYSBtZXNzYWdlIGNhbWUgZnJvbSByb3NicmlkZ2Ugd2l0aCB0aGUgZ2l2ZW4gdG9waWMgbmFtZVxuICogICogPHNlcnZpY2VJRD4gLSBhIHNlcnZpY2UgcmVzcG9uc2UgY2FtZSBmcm9tIHJvc2JyaWRnZSB3aXRoIHRoZSBnaXZlbiBJRFxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIG9wdGlvbnMgLSBwb3NzaWJsZSBrZXlzIGluY2x1ZGU6IDxicj5cbiAqICAgKiB1cmwgKG9wdGlvbmFsKSAtIChjYW4gYmUgc3BlY2lmaWVkIGxhdGVyIHdpdGggYGNvbm5lY3RgKSB0aGUgV2ViU29ja2V0IFVSTCBmb3Igcm9zYnJpZGdlIG9yIHRoZSBub2RlIHNlcnZlciB1cmwgdG8gY29ubmVjdCB1c2luZyBzb2NrZXQuaW8gKGlmIHNvY2tldC5pbyBleGlzdHMgaW4gdGhlIHBhZ2UpIDxicj5cbiAqICAgKiBncm9vdnlDb21wYXRpYmlsaXR5IC0gZG9uJ3QgdXNlIGludGVyZmFjZXMgdGhhdCBjaGFuZ2VkIGFmdGVyIHRoZSBsYXN0IGdyb292eSByZWxlYXNlIG9yIHJvc2JyaWRnZV9zdWl0ZSBhbmQgcmVsYXRlZCB0b29scyAoZGVmYXVsdHMgdG8gdHJ1ZSlcbiAqICAgKiB0cmFuc3BvcnRMaWJyYXJ5IChvcHRpb25hbCkgLSBvbmUgb2YgJ3dlYnNvY2tldCcgKGRlZmF1bHQpLCAnc29ja2V0LmlvJyBvciBSVENQZWVyQ29ubmVjdGlvbiBpbnN0YW5jZSBjb250cm9sbGluZyBob3cgdGhlIGNvbm5lY3Rpb24gaXMgY3JlYXRlZCBpbiBgY29ubmVjdGAuXG4gKiAgICogdHJhbnNwb3J0T3B0aW9ucyAob3B0aW9uYWwpIC0gdGhlIG9wdGlvbnMgdG8gdXNlIHVzZSB3aGVuIGNyZWF0aW5nIGEgY29ubmVjdGlvbi4gQ3VycmVudGx5IG9ubHkgdXNlZCBpZiBgdHJhbnNwb3J0TGlicmFyeWAgaXMgUlRDUGVlckNvbm5lY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIFJvcyhvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB0aGlzLnNvY2tldCA9IG51bGw7XG4gIHRoaXMuaWRDb3VudGVyID0gMDtcbiAgdGhpcy5pc0Nvbm5lY3RlZCA9IGZhbHNlO1xuICB0aGlzLnRyYW5zcG9ydExpYnJhcnkgPSBvcHRpb25zLnRyYW5zcG9ydExpYnJhcnkgfHwgJ3dlYnNvY2tldCc7XG4gIHRoaXMudHJhbnNwb3J0T3B0aW9ucyA9IG9wdGlvbnMudHJhbnNwb3J0T3B0aW9ucyB8fCB7fTtcblxuICBpZiAodHlwZW9mIG9wdGlvbnMuZ3Jvb3Z5Q29tcGF0aWJpbGl0eSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aGlzLmdyb292eUNvbXBhdGliaWxpdHkgPSB0cnVlO1xuICB9XG4gIGVsc2Uge1xuICAgIHRoaXMuZ3Jvb3Z5Q29tcGF0aWJpbGl0eSA9IG9wdGlvbnMuZ3Jvb3Z5Q29tcGF0aWJpbGl0eTtcbiAgfVxuXG4gIC8vIFNldHMgdW5saW1pdGVkIGV2ZW50IGxpc3RlbmVycy5cbiAgdGhpcy5zZXRNYXhMaXN0ZW5lcnMoMCk7XG5cbiAgLy8gYmVnaW4gYnkgY2hlY2tpbmcgaWYgYSBVUkwgd2FzIGdpdmVuXG4gIGlmIChvcHRpb25zLnVybCkge1xuICAgIHRoaXMuY29ubmVjdChvcHRpb25zLnVybCk7XG4gIH1cbn1cblxuUm9zLnByb3RvdHlwZS5fX3Byb3RvX18gPSBFdmVudEVtaXR0ZXIyLnByb3RvdHlwZTtcblxuLyoqXG4gKiBDb25uZWN0IHRvIHRoZSBzcGVjaWZpZWQgV2ViU29ja2V0LlxuICpcbiAqIEBwYXJhbSB1cmwgLSBXZWJTb2NrZXQgVVJMIG9yIFJUQ0RhdGFDaGFubmVsIGxhYmVsIGZvciBSb3NicmlkZ2VcbiAqL1xuUm9zLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24odXJsKSB7XG4gIGlmICh0aGlzLnRyYW5zcG9ydExpYnJhcnkgPT09ICdzb2NrZXQuaW8nKSB7XG4gICAgdGhpcy5zb2NrZXQgPSBhc3NpZ24oaW8odXJsLCB7J2ZvcmNlIG5ldyBjb25uZWN0aW9uJzogdHJ1ZX0pLCBzb2NrZXRBZGFwdGVyKHRoaXMpKTtcbiAgICB0aGlzLnNvY2tldC5vbignY29ubmVjdCcsIHRoaXMuc29ja2V0Lm9ub3Blbik7XG4gICAgdGhpcy5zb2NrZXQub24oJ2RhdGEnLCB0aGlzLnNvY2tldC5vbm1lc3NhZ2UpO1xuICAgIHRoaXMuc29ja2V0Lm9uKCdjbG9zZScsIHRoaXMuc29ja2V0Lm9uY2xvc2UpO1xuICAgIHRoaXMuc29ja2V0Lm9uKCdlcnJvcicsIHRoaXMuc29ja2V0Lm9uZXJyb3IpO1xuICB9IGVsc2UgaWYgKHRoaXMudHJhbnNwb3J0TGlicmFyeS5jb25zdHJ1Y3Rvci5uYW1lID09PSAnUlRDUGVlckNvbm5lY3Rpb24nKSB7XG4gICAgdGhpcy5zb2NrZXQgPSBhc3NpZ24odGhpcy50cmFuc3BvcnRMaWJyYXJ5LmNyZWF0ZURhdGFDaGFubmVsKHVybCwgdGhpcy50cmFuc3BvcnRPcHRpb25zKSwgc29ja2V0QWRhcHRlcih0aGlzKSk7XG4gIH1lbHNlIHtcbiAgICB0aGlzLnNvY2tldCA9IGFzc2lnbihuZXcgV2ViU29ja2V0KHVybCksIHNvY2tldEFkYXB0ZXIodGhpcykpO1xuICB9XG5cbn07XG5cbi8qKlxuICogRGlzY29ubmVjdCBmcm9tIHRoZSBXZWJTb2NrZXQgc2VydmVyLlxuICovXG5Sb3MucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLnNvY2tldCkge1xuICAgIHRoaXMuc29ja2V0LmNsb3NlKCk7XG4gIH1cbn07XG5cbi8qKlxuICogU2VuZHMgYW4gYXV0aG9yaXphdGlvbiByZXF1ZXN0IHRvIHRoZSBzZXJ2ZXIuXG4gKlxuICogQHBhcmFtIG1hYyAtIE1BQyAoaGFzaCkgc3RyaW5nIGdpdmVuIGJ5IHRoZSB0cnVzdGVkIHNvdXJjZS5cbiAqIEBwYXJhbSBjbGllbnQgLSBJUCBvZiB0aGUgY2xpZW50LlxuICogQHBhcmFtIGRlc3QgLSBJUCBvZiB0aGUgZGVzdGluYXRpb24uXG4gKiBAcGFyYW0gcmFuZCAtIFJhbmRvbSBzdHJpbmcgZ2l2ZW4gYnkgdGhlIHRydXN0ZWQgc291cmNlLlxuICogQHBhcmFtIHQgLSBUaW1lIG9mIHRoZSBhdXRob3JpemF0aW9uIHJlcXVlc3QuXG4gKiBAcGFyYW0gbGV2ZWwgLSBVc2VyIGxldmVsIGFzIGEgc3RyaW5nIGdpdmVuIGJ5IHRoZSBjbGllbnQuXG4gKiBAcGFyYW0gZW5kIC0gRW5kIHRpbWUgb2YgdGhlIGNsaWVudCdzIHNlc3Npb24uXG4gKi9cblJvcy5wcm90b3R5cGUuYXV0aGVudGljYXRlID0gZnVuY3Rpb24obWFjLCBjbGllbnQsIGRlc3QsIHJhbmQsIHQsIGxldmVsLCBlbmQpIHtcbiAgLy8gY3JlYXRlIHRoZSByZXF1ZXN0XG4gIHZhciBhdXRoID0ge1xuICAgIG9wIDogJ2F1dGgnLFxuICAgIG1hYyA6IG1hYyxcbiAgICBjbGllbnQgOiBjbGllbnQsXG4gICAgZGVzdCA6IGRlc3QsXG4gICAgcmFuZCA6IHJhbmQsXG4gICAgdCA6IHQsXG4gICAgbGV2ZWwgOiBsZXZlbCxcbiAgICBlbmQgOiBlbmRcbiAgfTtcbiAgLy8gc2VuZCB0aGUgcmVxdWVzdFxuICB0aGlzLmNhbGxPbkNvbm5lY3Rpb24oYXV0aCk7XG59O1xuXG4vKipcbiAqIFNlbmRzIHRoZSBtZXNzYWdlIG92ZXIgdGhlIFdlYlNvY2tldCwgYnV0IHF1ZXVlcyB0aGUgbWVzc2FnZSB1cCBpZiBub3QgeWV0XG4gKiBjb25uZWN0ZWQuXG4gKi9cblJvcy5wcm90b3R5cGUuY2FsbE9uQ29ubmVjdGlvbiA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgdmFyIHRoYXQgPSB0aGlzO1xuICB2YXIgbWVzc2FnZUpzb24gPSBKU09OLnN0cmluZ2lmeShtZXNzYWdlKTtcbiAgdmFyIGVtaXR0ZXIgPSBudWxsO1xuICBpZiAodGhpcy50cmFuc3BvcnRMaWJyYXJ5ID09PSAnc29ja2V0LmlvJykge1xuICAgIGVtaXR0ZXIgPSBmdW5jdGlvbihtc2cpe3RoYXQuc29ja2V0LmVtaXQoJ29wZXJhdGlvbicsIG1zZyk7fTtcbiAgfSBlbHNlIHtcbiAgICBlbWl0dGVyID0gZnVuY3Rpb24obXNnKXt0aGF0LnNvY2tldC5zZW5kKG1zZyk7fTtcbiAgfVxuXG4gIGlmICghdGhpcy5pc0Nvbm5lY3RlZCkge1xuICAgIHRoYXQub25jZSgnY29ubmVjdGlvbicsIGZ1bmN0aW9uKCkge1xuICAgICAgZW1pdHRlcihtZXNzYWdlSnNvbik7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgZW1pdHRlcihtZXNzYWdlSnNvbik7XG4gIH1cbn07XG5cbi8qKlxuICogU2VuZHMgYSBzZXRfbGV2ZWwgcmVxdWVzdCB0byB0aGUgc2VydmVyXG4gKlxuICogQHBhcmFtIGxldmVsIC0gU3RhdHVzIGxldmVsIChub25lLCBlcnJvciwgd2FybmluZywgaW5mbylcbiAqIEBwYXJhbSBpZCAtIE9wdGlvbmFsOiBPcGVyYXRpb24gSUQgdG8gY2hhbmdlIHN0YXR1cyBsZXZlbCBvblxuICovXG5Sb3MucHJvdG90eXBlLnNldFN0YXR1c0xldmVsID0gZnVuY3Rpb24obGV2ZWwsIGlkKXtcbiAgdmFyIGxldmVsTXNnID0ge1xuICAgIG9wOiAnc2V0X2xldmVsJyxcbiAgICBsZXZlbDogbGV2ZWwsXG4gICAgaWQ6IGlkXG4gIH07XG5cbiAgdGhpcy5jYWxsT25Db25uZWN0aW9uKGxldmVsTXNnKTtcbn07XG5cbi8qKlxuICogUmV0cmlldmVzIEFjdGlvbiBTZXJ2ZXJzIGluIFJPUyBhcyBhbiBhcnJheSBvZiBzdHJpbmdcbiAqXG4gKiAgICogYWN0aW9uc2VydmVycyAtIEFycmF5IG9mIGFjdGlvbiBzZXJ2ZXIgbmFtZXNcbiAqL1xuUm9zLnByb3RvdHlwZS5nZXRBY3Rpb25TZXJ2ZXJzID0gZnVuY3Rpb24oY2FsbGJhY2ssIGZhaWxlZENhbGxiYWNrKSB7XG4gIHZhciBnZXRBY3Rpb25TZXJ2ZXJzID0gbmV3IFNlcnZpY2Uoe1xuICAgIHJvcyA6IHRoaXMsXG4gICAgbmFtZSA6ICcvcm9zYXBpL2FjdGlvbl9zZXJ2ZXJzJyxcbiAgICBzZXJ2aWNlVHlwZSA6ICdyb3NhcGkvR2V0QWN0aW9uU2VydmVycydcbiAgfSk7XG5cbiAgdmFyIHJlcXVlc3QgPSBuZXcgU2VydmljZVJlcXVlc3Qoe30pO1xuICBpZiAodHlwZW9mIGZhaWxlZENhbGxiYWNrID09PSAnZnVuY3Rpb24nKXtcbiAgICBnZXRBY3Rpb25TZXJ2ZXJzLmNhbGxTZXJ2aWNlKHJlcXVlc3QsXG4gICAgICBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgY2FsbGJhY2socmVzdWx0LmFjdGlvbl9zZXJ2ZXJzKTtcbiAgICAgIH0sXG4gICAgICBmdW5jdGlvbihtZXNzYWdlKXtcbiAgICAgICAgZmFpbGVkQ2FsbGJhY2sobWVzc2FnZSk7XG4gICAgICB9XG4gICAgKTtcbiAgfWVsc2V7XG4gICAgZ2V0QWN0aW9uU2VydmVycy5jYWxsU2VydmljZShyZXF1ZXN0LCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgIGNhbGxiYWNrKHJlc3VsdC5hY3Rpb25fc2VydmVycyk7XG4gICAgfSk7XG4gIH1cbn07XG5cbi8qKlxuICogUmV0cmlldmVzIGxpc3Qgb2YgdG9waWNzIGluIFJPUyBhcyBhbiBhcnJheS5cbiAqXG4gKiBAcGFyYW0gY2FsbGJhY2sgZnVuY3Rpb24gd2l0aCBwYXJhbXM6XG4gKiAgICogdG9waWNzIC0gQXJyYXkgb2YgdG9waWMgbmFtZXNcbiAqL1xuUm9zLnByb3RvdHlwZS5nZXRUb3BpY3MgPSBmdW5jdGlvbihjYWxsYmFjaywgZmFpbGVkQ2FsbGJhY2spIHtcbiAgdmFyIHRvcGljc0NsaWVudCA9IG5ldyBTZXJ2aWNlKHtcbiAgICByb3MgOiB0aGlzLFxuICAgIG5hbWUgOiAnL3Jvc2FwaS90b3BpY3MnLFxuICAgIHNlcnZpY2VUeXBlIDogJ3Jvc2FwaS9Ub3BpY3MnXG4gIH0pO1xuXG4gIHZhciByZXF1ZXN0ID0gbmV3IFNlcnZpY2VSZXF1ZXN0KCk7XG4gIGlmICh0eXBlb2YgZmFpbGVkQ2FsbGJhY2sgPT09ICdmdW5jdGlvbicpe1xuICAgIHRvcGljc0NsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LFxuICAgICAgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNhbGxiYWNrKHJlc3VsdCk7XG4gICAgICB9LFxuICAgICAgZnVuY3Rpb24obWVzc2FnZSl7XG4gICAgICAgIGZhaWxlZENhbGxiYWNrKG1lc3NhZ2UpO1xuICAgICAgfVxuICAgICk7XG4gIH1lbHNle1xuICAgIHRvcGljc0NsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgIGNhbGxiYWNrKHJlc3VsdCk7XG4gICAgfSk7XG4gIH1cbn07XG5cbi8qKlxuICogUmV0cmlldmVzIFRvcGljcyBpbiBST1MgYXMgYW4gYXJyYXkgYXMgc3BlY2lmaWMgdHlwZVxuICpcbiAqIEBwYXJhbSB0b3BpY1R5cGUgdG9waWMgdHlwZSB0byBmaW5kOlxuICogQHBhcmFtIGNhbGxiYWNrIGZ1bmN0aW9uIHdpdGggcGFyYW1zOlxuICogICAqIHRvcGljcyAtIEFycmF5IG9mIHRvcGljIG5hbWVzXG4gKi9cblJvcy5wcm90b3R5cGUuZ2V0VG9waWNzRm9yVHlwZSA9IGZ1bmN0aW9uKHRvcGljVHlwZSwgY2FsbGJhY2ssIGZhaWxlZENhbGxiYWNrKSB7XG4gIHZhciB0b3BpY3NGb3JUeXBlQ2xpZW50ID0gbmV3IFNlcnZpY2Uoe1xuICAgIHJvcyA6IHRoaXMsXG4gICAgbmFtZSA6ICcvcm9zYXBpL3RvcGljc19mb3JfdHlwZScsXG4gICAgc2VydmljZVR5cGUgOiAncm9zYXBpL1RvcGljc0ZvclR5cGUnXG4gIH0pO1xuXG4gIHZhciByZXF1ZXN0ID0gbmV3IFNlcnZpY2VSZXF1ZXN0KHtcbiAgICB0eXBlOiB0b3BpY1R5cGVcbiAgfSk7XG4gIGlmICh0eXBlb2YgZmFpbGVkQ2FsbGJhY2sgPT09ICdmdW5jdGlvbicpe1xuICAgIHRvcGljc0ZvclR5cGVDbGllbnQuY2FsbFNlcnZpY2UocmVxdWVzdCxcbiAgICAgIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBjYWxsYmFjayhyZXN1bHQudG9waWNzKTtcbiAgICAgIH0sXG4gICAgICBmdW5jdGlvbihtZXNzYWdlKXtcbiAgICAgICAgZmFpbGVkQ2FsbGJhY2sobWVzc2FnZSk7XG4gICAgICB9XG4gICAgKTtcbiAgfWVsc2V7XG4gICAgdG9waWNzRm9yVHlwZUNsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgIGNhbGxiYWNrKHJlc3VsdC50b3BpY3MpO1xuICAgIH0pO1xuICB9XG59O1xuXG4vKipcbiAqIFJldHJpZXZlcyBsaXN0IG9mIGFjdGl2ZSBzZXJ2aWNlIG5hbWVzIGluIFJPUy5cbiAqXG4gKiBAcGFyYW0gY2FsbGJhY2sgLSBmdW5jdGlvbiB3aXRoIHRoZSBmb2xsb3dpbmcgcGFyYW1zOlxuICogICAqIHNlcnZpY2VzIC0gYXJyYXkgb2Ygc2VydmljZSBuYW1lc1xuICovXG5Sb3MucHJvdG90eXBlLmdldFNlcnZpY2VzID0gZnVuY3Rpb24oY2FsbGJhY2ssIGZhaWxlZENhbGxiYWNrKSB7XG4gIHZhciBzZXJ2aWNlc0NsaWVudCA9IG5ldyBTZXJ2aWNlKHtcbiAgICByb3MgOiB0aGlzLFxuICAgIG5hbWUgOiAnL3Jvc2FwaS9zZXJ2aWNlcycsXG4gICAgc2VydmljZVR5cGUgOiAncm9zYXBpL1NlcnZpY2VzJ1xuICB9KTtcblxuICB2YXIgcmVxdWVzdCA9IG5ldyBTZXJ2aWNlUmVxdWVzdCgpO1xuICBpZiAodHlwZW9mIGZhaWxlZENhbGxiYWNrID09PSAnZnVuY3Rpb24nKXtcbiAgICBzZXJ2aWNlc0NsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LFxuICAgICAgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNhbGxiYWNrKHJlc3VsdC5zZXJ2aWNlcyk7XG4gICAgICB9LFxuICAgICAgZnVuY3Rpb24obWVzc2FnZSkge1xuICAgICAgICBmYWlsZWRDYWxsYmFjayhtZXNzYWdlKTtcbiAgICAgIH1cbiAgICApO1xuICB9ZWxzZXtcbiAgICBzZXJ2aWNlc0NsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgIGNhbGxiYWNrKHJlc3VsdC5zZXJ2aWNlcyk7XG4gICAgfSk7XG4gIH1cbn07XG5cbi8qKlxuICogUmV0cmlldmVzIGxpc3Qgb2Ygc2VydmljZXMgaW4gUk9TIGFzIGFuIGFycmF5IGFzIHNwZWNpZmljIHR5cGVcbiAqXG4gKiBAcGFyYW0gc2VydmljZVR5cGUgc2VydmljZSB0eXBlIHRvIGZpbmQ6XG4gKiBAcGFyYW0gY2FsbGJhY2sgZnVuY3Rpb24gd2l0aCBwYXJhbXM6XG4gKiAgICogdG9waWNzIC0gQXJyYXkgb2Ygc2VydmljZSBuYW1lc1xuICovXG5Sb3MucHJvdG90eXBlLmdldFNlcnZpY2VzRm9yVHlwZSA9IGZ1bmN0aW9uKHNlcnZpY2VUeXBlLCBjYWxsYmFjaywgZmFpbGVkQ2FsbGJhY2spIHtcbiAgdmFyIHNlcnZpY2VzRm9yVHlwZUNsaWVudCA9IG5ldyBTZXJ2aWNlKHtcbiAgICByb3MgOiB0aGlzLFxuICAgIG5hbWUgOiAnL3Jvc2FwaS9zZXJ2aWNlc19mb3JfdHlwZScsXG4gICAgc2VydmljZVR5cGUgOiAncm9zYXBpL1NlcnZpY2VzRm9yVHlwZSdcbiAgfSk7XG5cbiAgdmFyIHJlcXVlc3QgPSBuZXcgU2VydmljZVJlcXVlc3Qoe1xuICAgIHR5cGU6IHNlcnZpY2VUeXBlXG4gIH0pO1xuICBpZiAodHlwZW9mIGZhaWxlZENhbGxiYWNrID09PSAnZnVuY3Rpb24nKXtcbiAgICBzZXJ2aWNlc0ZvclR5cGVDbGllbnQuY2FsbFNlcnZpY2UocmVxdWVzdCxcbiAgICAgIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBjYWxsYmFjayhyZXN1bHQuc2VydmljZXMpO1xuICAgICAgfSxcbiAgICAgIGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgZmFpbGVkQ2FsbGJhY2sobWVzc2FnZSk7XG4gICAgICB9XG4gICAgKTtcbiAgfWVsc2V7XG4gICAgc2VydmljZXNGb3JUeXBlQ2xpZW50LmNhbGxTZXJ2aWNlKHJlcXVlc3QsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgY2FsbGJhY2socmVzdWx0LnNlcnZpY2VzKTtcbiAgICB9KTtcbiAgfVxufTtcblxuLyoqXG4gKiBSZXRyaWV2ZXMgYSBkZXRhaWwgb2YgUk9TIHNlcnZpY2UgcmVxdWVzdC5cbiAqXG4gKiBAcGFyYW0gc2VydmljZSBuYW1lIG9mIHNlcnZpY2U6XG4gKiBAcGFyYW0gY2FsbGJhY2sgLSBmdW5jdGlvbiB3aXRoIHBhcmFtczpcbiAqICAgKiB0eXBlIC0gU3RyaW5nIG9mIHRoZSBzZXJ2aWNlIHR5cGVcbiAqL1xuUm9zLnByb3RvdHlwZS5nZXRTZXJ2aWNlUmVxdWVzdERldGFpbHMgPSBmdW5jdGlvbih0eXBlLCBjYWxsYmFjaywgZmFpbGVkQ2FsbGJhY2spIHtcbiAgdmFyIHNlcnZpY2VUeXBlQ2xpZW50ID0gbmV3IFNlcnZpY2Uoe1xuICAgIHJvcyA6IHRoaXMsXG4gICAgbmFtZSA6ICcvcm9zYXBpL3NlcnZpY2VfcmVxdWVzdF9kZXRhaWxzJyxcbiAgICBzZXJ2aWNlVHlwZSA6ICdyb3NhcGkvU2VydmljZVJlcXVlc3REZXRhaWxzJ1xuICB9KTtcbiAgdmFyIHJlcXVlc3QgPSBuZXcgU2VydmljZVJlcXVlc3Qoe1xuICAgIHR5cGU6IHR5cGVcbiAgfSk7XG5cbiAgaWYgKHR5cGVvZiBmYWlsZWRDYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJyl7XG4gICAgc2VydmljZVR5cGVDbGllbnQuY2FsbFNlcnZpY2UocmVxdWVzdCxcbiAgICAgIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBjYWxsYmFjayhyZXN1bHQpO1xuICAgICAgfSxcbiAgICAgIGZ1bmN0aW9uKG1lc3NhZ2Upe1xuICAgICAgICBmYWlsZWRDYWxsYmFjayhtZXNzYWdlKTtcbiAgICAgIH1cbiAgICApO1xuICB9ZWxzZXtcbiAgICBzZXJ2aWNlVHlwZUNsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgIGNhbGxiYWNrKHJlc3VsdCk7XG4gICAgfSk7XG4gIH1cbn07XG5cbi8qKlxuICogUmV0cmlldmVzIGEgZGV0YWlsIG9mIFJPUyBzZXJ2aWNlIHJlcXVlc3QuXG4gKlxuICogQHBhcmFtIHNlcnZpY2UgbmFtZSBvZiBzZXJ2aWNlOlxuICogQHBhcmFtIGNhbGxiYWNrIC0gZnVuY3Rpb24gd2l0aCBwYXJhbXM6XG4gKiAgICogdHlwZSAtIFN0cmluZyBvZiB0aGUgc2VydmljZSB0eXBlXG4gKi9cblJvcy5wcm90b3R5cGUuZ2V0U2VydmljZVJlc3BvbnNlRGV0YWlscyA9IGZ1bmN0aW9uKHR5cGUsIGNhbGxiYWNrLCBmYWlsZWRDYWxsYmFjaykge1xuICB2YXIgc2VydmljZVR5cGVDbGllbnQgPSBuZXcgU2VydmljZSh7XG4gICAgcm9zIDogdGhpcyxcbiAgICBuYW1lIDogJy9yb3NhcGkvc2VydmljZV9yZXNwb25zZV9kZXRhaWxzJyxcbiAgICBzZXJ2aWNlVHlwZSA6ICdyb3NhcGkvU2VydmljZVJlc3BvbnNlRGV0YWlscydcbiAgfSk7XG4gIHZhciByZXF1ZXN0ID0gbmV3IFNlcnZpY2VSZXF1ZXN0KHtcbiAgICB0eXBlOiB0eXBlXG4gIH0pO1xuXG4gIGlmICh0eXBlb2YgZmFpbGVkQ2FsbGJhY2sgPT09ICdmdW5jdGlvbicpe1xuICAgIHNlcnZpY2VUeXBlQ2xpZW50LmNhbGxTZXJ2aWNlKHJlcXVlc3QsXG4gICAgICBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgY2FsbGJhY2socmVzdWx0KTtcbiAgICAgIH0sXG4gICAgICBmdW5jdGlvbihtZXNzYWdlKXtcbiAgICAgICAgZmFpbGVkQ2FsbGJhY2sobWVzc2FnZSk7XG4gICAgICB9XG4gICAgKTtcbiAgfWVsc2V7XG4gICAgc2VydmljZVR5cGVDbGllbnQuY2FsbFNlcnZpY2UocmVxdWVzdCwgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICBjYWxsYmFjayhyZXN1bHQpO1xuICAgIH0pO1xuICB9XG59O1xuXG4vKipcbiAqIFJldHJpZXZlcyBsaXN0IG9mIGFjdGl2ZSBub2RlIG5hbWVzIGluIFJPUy5cbiAqXG4gKiBAcGFyYW0gY2FsbGJhY2sgLSBmdW5jdGlvbiB3aXRoIHRoZSBmb2xsb3dpbmcgcGFyYW1zOlxuICogICAqIG5vZGVzIC0gYXJyYXkgb2Ygbm9kZSBuYW1lc1xuICovXG5Sb3MucHJvdG90eXBlLmdldE5vZGVzID0gZnVuY3Rpb24oY2FsbGJhY2ssIGZhaWxlZENhbGxiYWNrKSB7XG4gIHZhciBub2Rlc0NsaWVudCA9IG5ldyBTZXJ2aWNlKHtcbiAgICByb3MgOiB0aGlzLFxuICAgIG5hbWUgOiAnL3Jvc2FwaS9ub2RlcycsXG4gICAgc2VydmljZVR5cGUgOiAncm9zYXBpL05vZGVzJ1xuICB9KTtcblxuICB2YXIgcmVxdWVzdCA9IG5ldyBTZXJ2aWNlUmVxdWVzdCgpO1xuICBpZiAodHlwZW9mIGZhaWxlZENhbGxiYWNrID09PSAnZnVuY3Rpb24nKXtcbiAgICBub2Rlc0NsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LFxuICAgICAgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNhbGxiYWNrKHJlc3VsdC5ub2Rlcyk7XG4gICAgICB9LFxuICAgICAgZnVuY3Rpb24obWVzc2FnZSkge1xuICAgICAgICBmYWlsZWRDYWxsYmFjayhtZXNzYWdlKTtcbiAgICAgIH1cbiAgICApO1xuICB9ZWxzZXtcbiAgICBub2Rlc0NsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LCBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgIGNhbGxiYWNrKHJlc3VsdC5ub2Rlcyk7XG4gICAgfSk7XG4gIH1cbn07XG5cbi8qKlxuICAqIFJldHJpZXZlcyBsaXN0IHN1YnNjcmliZWQgdG9waWNzLCBwdWJsaXNoaW5nIHRvcGljcyBhbmQgc2VydmljZXMgb2YgYSBzcGVjaWZpYyBub2RlXG4gICpcbiAgKiBAcGFyYW0gbm9kZSBuYW1lIG9mIHRoZSBub2RlOlxuICAqIEBwYXJhbSBjYWxsYmFjayAtIGZ1bmN0aW9uIHdpdGggcGFyYW1zOlxuICAqICAgKiBwdWJsaWNhdGlvbnMgLSBhcnJheSBvZiBwdWJsaXNoZWQgdG9waWMgbmFtZXNcbiAgKiAgICogc3Vic2NyaXB0aW9ucyAtIGFycmF5IG9mIHN1YnNjcmliZWQgdG9waWMgbmFtZXNcbiAgKiAgICogc2VydmljZXMgLSBhcnJheSBvZiBzZXJ2aWNlIG5hbWVzIGhvc3RlZFxuICAqL1xuUm9zLnByb3RvdHlwZS5nZXROb2RlRGV0YWlscyA9IGZ1bmN0aW9uKG5vZGUsIGNhbGxiYWNrLCBmYWlsZWRDYWxsYmFjaykge1xuICB2YXIgbm9kZXNDbGllbnQgPSBuZXcgU2VydmljZSh7XG4gICAgcm9zIDogdGhpcyxcbiAgICBuYW1lIDogJy9yb3NhcGkvbm9kZV9kZXRhaWxzJyxcbiAgICBzZXJ2aWNlVHlwZSA6ICdyb3NhcGkvTm9kZURldGFpbHMnXG4gIH0pO1xuXG4gIHZhciByZXF1ZXN0ID0gbmV3IFNlcnZpY2VSZXF1ZXN0KHtcbiAgICBub2RlOiBub2RlXG4gIH0pO1xuICBpZiAodHlwZW9mIGZhaWxlZENhbGxiYWNrID09PSAnZnVuY3Rpb24nKXtcbiAgICBub2Rlc0NsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LFxuICAgICAgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNhbGxiYWNrKHJlc3VsdC5zdWJzY3JpYmluZywgcmVzdWx0LnB1Ymxpc2hpbmcsIHJlc3VsdC5zZXJ2aWNlcyk7XG4gICAgICB9LFxuICAgICAgZnVuY3Rpb24obWVzc2FnZSkge1xuICAgICAgICBmYWlsZWRDYWxsYmFjayhtZXNzYWdlKTtcbiAgICAgIH1cbiAgICApO1xuICB9IGVsc2Uge1xuICAgIG5vZGVzQ2xpZW50LmNhbGxTZXJ2aWNlKHJlcXVlc3QsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgY2FsbGJhY2socmVzdWx0KTtcbiAgICB9KTtcbiAgfVxufTtcblxuLyoqXG4gKiBSZXRyaWV2ZXMgbGlzdCBvZiBwYXJhbSBuYW1lcyBmcm9tIHRoZSBST1MgUGFyYW1ldGVyIFNlcnZlci5cbiAqXG4gKiBAcGFyYW0gY2FsbGJhY2sgZnVuY3Rpb24gd2l0aCBwYXJhbXM6XG4gKiAgKiBwYXJhbXMgLSBhcnJheSBvZiBwYXJhbSBuYW1lcy5cbiAqL1xuUm9zLnByb3RvdHlwZS5nZXRQYXJhbXMgPSBmdW5jdGlvbihjYWxsYmFjaywgZmFpbGVkQ2FsbGJhY2spIHtcbiAgdmFyIHBhcmFtc0NsaWVudCA9IG5ldyBTZXJ2aWNlKHtcbiAgICByb3MgOiB0aGlzLFxuICAgIG5hbWUgOiAnL3Jvc2FwaS9nZXRfcGFyYW1fbmFtZXMnLFxuICAgIHNlcnZpY2VUeXBlIDogJ3Jvc2FwaS9HZXRQYXJhbU5hbWVzJ1xuICB9KTtcbiAgdmFyIHJlcXVlc3QgPSBuZXcgU2VydmljZVJlcXVlc3QoKTtcbiAgaWYgKHR5cGVvZiBmYWlsZWRDYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJyl7XG4gICAgcGFyYW1zQ2xpZW50LmNhbGxTZXJ2aWNlKHJlcXVlc3QsXG4gICAgICBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgICAgY2FsbGJhY2socmVzdWx0Lm5hbWVzKTtcbiAgICAgIH0sXG4gICAgICBmdW5jdGlvbihtZXNzYWdlKXtcbiAgICAgICAgZmFpbGVkQ2FsbGJhY2sobWVzc2FnZSk7XG4gICAgICB9XG4gICAgKTtcbiAgfWVsc2V7XG4gICAgcGFyYW1zQ2xpZW50LmNhbGxTZXJ2aWNlKHJlcXVlc3QsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgY2FsbGJhY2socmVzdWx0Lm5hbWVzKTtcbiAgICB9KTtcbiAgfVxufTtcblxuLyoqXG4gKiBSZXRyaWV2ZXMgYSB0eXBlIG9mIFJPUyB0b3BpYy5cbiAqXG4gKiBAcGFyYW0gdG9waWMgbmFtZSBvZiB0aGUgdG9waWM6XG4gKiBAcGFyYW0gY2FsbGJhY2sgLSBmdW5jdGlvbiB3aXRoIHBhcmFtczpcbiAqICAgKiB0eXBlIC0gU3RyaW5nIG9mIHRoZSB0b3BpYyB0eXBlXG4gKi9cblJvcy5wcm90b3R5cGUuZ2V0VG9waWNUeXBlID0gZnVuY3Rpb24odG9waWMsIGNhbGxiYWNrLCBmYWlsZWRDYWxsYmFjaykge1xuICB2YXIgdG9waWNUeXBlQ2xpZW50ID0gbmV3IFNlcnZpY2Uoe1xuICAgIHJvcyA6IHRoaXMsXG4gICAgbmFtZSA6ICcvcm9zYXBpL3RvcGljX3R5cGUnLFxuICAgIHNlcnZpY2VUeXBlIDogJ3Jvc2FwaS9Ub3BpY1R5cGUnXG4gIH0pO1xuICB2YXIgcmVxdWVzdCA9IG5ldyBTZXJ2aWNlUmVxdWVzdCh7XG4gICAgdG9waWM6IHRvcGljXG4gIH0pO1xuXG4gIGlmICh0eXBlb2YgZmFpbGVkQ2FsbGJhY2sgPT09ICdmdW5jdGlvbicpe1xuICAgIHRvcGljVHlwZUNsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LFxuICAgICAgZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgIGNhbGxiYWNrKHJlc3VsdC50eXBlKTtcbiAgICAgIH0sXG4gICAgICBmdW5jdGlvbihtZXNzYWdlKXtcbiAgICAgICAgZmFpbGVkQ2FsbGJhY2sobWVzc2FnZSk7XG4gICAgICB9XG4gICAgKTtcbiAgfWVsc2V7XG4gICAgdG9waWNUeXBlQ2xpZW50LmNhbGxTZXJ2aWNlKHJlcXVlc3QsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgY2FsbGJhY2socmVzdWx0LnR5cGUpO1xuICAgIH0pO1xuICB9XG59O1xuXG4vKipcbiAqIFJldHJpZXZlcyBhIHR5cGUgb2YgUk9TIHNlcnZpY2UuXG4gKlxuICogQHBhcmFtIHNlcnZpY2UgbmFtZSBvZiBzZXJ2aWNlOlxuICogQHBhcmFtIGNhbGxiYWNrIC0gZnVuY3Rpb24gd2l0aCBwYXJhbXM6XG4gKiAgICogdHlwZSAtIFN0cmluZyBvZiB0aGUgc2VydmljZSB0eXBlXG4gKi9cblJvcy5wcm90b3R5cGUuZ2V0U2VydmljZVR5cGUgPSBmdW5jdGlvbihzZXJ2aWNlLCBjYWxsYmFjaywgZmFpbGVkQ2FsbGJhY2spIHtcbiAgdmFyIHNlcnZpY2VUeXBlQ2xpZW50ID0gbmV3IFNlcnZpY2Uoe1xuICAgIHJvcyA6IHRoaXMsXG4gICAgbmFtZSA6ICcvcm9zYXBpL3NlcnZpY2VfdHlwZScsXG4gICAgc2VydmljZVR5cGUgOiAncm9zYXBpL1NlcnZpY2VUeXBlJ1xuICB9KTtcbiAgdmFyIHJlcXVlc3QgPSBuZXcgU2VydmljZVJlcXVlc3Qoe1xuICAgIHNlcnZpY2U6IHNlcnZpY2VcbiAgfSk7XG5cbiAgaWYgKHR5cGVvZiBmYWlsZWRDYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJyl7XG4gICAgc2VydmljZVR5cGVDbGllbnQuY2FsbFNlcnZpY2UocmVxdWVzdCxcbiAgICAgIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBjYWxsYmFjayhyZXN1bHQudHlwZSk7XG4gICAgICB9LFxuICAgICAgZnVuY3Rpb24obWVzc2FnZSl7XG4gICAgICAgIGZhaWxlZENhbGxiYWNrKG1lc3NhZ2UpO1xuICAgICAgfVxuICAgICk7XG4gIH1lbHNle1xuICAgIHNlcnZpY2VUeXBlQ2xpZW50LmNhbGxTZXJ2aWNlKHJlcXVlc3QsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgY2FsbGJhY2socmVzdWx0LnR5cGUpO1xuICAgIH0pO1xuICB9XG59O1xuXG4vKipcbiAqIFJldHJpZXZlcyBhIGRldGFpbCBvZiBST1MgbWVzc2FnZS5cbiAqXG4gKiBAcGFyYW0gY2FsbGJhY2sgLSBmdW5jdGlvbiB3aXRoIHBhcmFtczpcbiAqICAgKiBkZXRhaWxzIC0gQXJyYXkgb2YgdGhlIG1lc3NhZ2UgZGV0YWlsXG4gKiBAcGFyYW0gbWVzc2FnZSAtIFN0cmluZyBvZiBhIHRvcGljIHR5cGVcbiAqL1xuUm9zLnByb3RvdHlwZS5nZXRNZXNzYWdlRGV0YWlscyA9IGZ1bmN0aW9uKG1lc3NhZ2UsIGNhbGxiYWNrLCBmYWlsZWRDYWxsYmFjaykge1xuICB2YXIgbWVzc2FnZURldGFpbENsaWVudCA9IG5ldyBTZXJ2aWNlKHtcbiAgICByb3MgOiB0aGlzLFxuICAgIG5hbWUgOiAnL3Jvc2FwaS9tZXNzYWdlX2RldGFpbHMnLFxuICAgIHNlcnZpY2VUeXBlIDogJ3Jvc2FwaS9NZXNzYWdlRGV0YWlscydcbiAgfSk7XG4gIHZhciByZXF1ZXN0ID0gbmV3IFNlcnZpY2VSZXF1ZXN0KHtcbiAgICB0eXBlOiBtZXNzYWdlXG4gIH0pO1xuXG4gIGlmICh0eXBlb2YgZmFpbGVkQ2FsbGJhY2sgPT09ICdmdW5jdGlvbicpe1xuICAgIG1lc3NhZ2VEZXRhaWxDbGllbnQuY2FsbFNlcnZpY2UocmVxdWVzdCxcbiAgICAgIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgICBjYWxsYmFjayhyZXN1bHQudHlwZWRlZnMpO1xuICAgICAgfSxcbiAgICAgIGZ1bmN0aW9uKG1lc3NhZ2Upe1xuICAgICAgICBmYWlsZWRDYWxsYmFjayhtZXNzYWdlKTtcbiAgICAgIH1cbiAgICApO1xuICB9ZWxzZXtcbiAgICBtZXNzYWdlRGV0YWlsQ2xpZW50LmNhbGxTZXJ2aWNlKHJlcXVlc3QsIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgY2FsbGJhY2socmVzdWx0LnR5cGVkZWZzKTtcbiAgICB9KTtcbiAgfVxufTtcblxuLyoqXG4gKiBEZWNvZGUgYSB0eXBlZGVmcyBpbnRvIGEgZGljdGlvbmFyeSBsaWtlIGByb3Ntc2cgc2hvdyBmb28vYmFyYFxuICpcbiAqIEBwYXJhbSBkZWZzIC0gYXJyYXkgb2YgdHlwZV9kZWYgZGljdGlvbmFyeVxuICovXG5Sb3MucHJvdG90eXBlLmRlY29kZVR5cGVEZWZzID0gZnVuY3Rpb24oZGVmcykge1xuICB2YXIgdGhhdCA9IHRoaXM7XG5cbiAgLy8gY2FsbHMgaXRzZWxmIHJlY3Vyc2l2ZWx5IHRvIHJlc29sdmUgdHlwZSBkZWZpbml0aW9uIHVzaW5nIGhpbnRzLlxuICB2YXIgZGVjb2RlVHlwZURlZnNSZWMgPSBmdW5jdGlvbih0aGVUeXBlLCBoaW50cykge1xuICAgIHZhciB0eXBlRGVmRGljdCA9IHt9O1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhlVHlwZS5maWVsZG5hbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYXJyYXlMZW4gPSB0aGVUeXBlLmZpZWxkYXJyYXlsZW5baV07XG4gICAgICB2YXIgZmllbGROYW1lID0gdGhlVHlwZS5maWVsZG5hbWVzW2ldO1xuICAgICAgdmFyIGZpZWxkVHlwZSA9IHRoZVR5cGUuZmllbGR0eXBlc1tpXTtcbiAgICAgIGlmIChmaWVsZFR5cGUuaW5kZXhPZignLycpID09PSAtMSkgeyAvLyBjaGVjayB0aGUgZmllbGRUeXBlIGluY2x1ZGVzICcvJyBvciBub3RcbiAgICAgICAgaWYgKGFycmF5TGVuID09PSAtMSkge1xuICAgICAgICAgIHR5cGVEZWZEaWN0W2ZpZWxkTmFtZV0gPSBmaWVsZFR5cGU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdHlwZURlZkRpY3RbZmllbGROYW1lXSA9IFtmaWVsZFR5cGVdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgLy8gbG9va3VwIHRoZSBuYW1lXG4gICAgICAgIHZhciBzdWIgPSBmYWxzZTtcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBoaW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgIGlmIChoaW50c1tqXS50eXBlLnRvU3RyaW5nKCkgPT09IGZpZWxkVHlwZS50b1N0cmluZygpKSB7XG4gICAgICAgICAgICBzdWIgPSBoaW50c1tqXTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoc3ViKSB7XG4gICAgICAgICAgdmFyIHN1YlJlc3VsdCA9IGRlY29kZVR5cGVEZWZzUmVjKHN1YiwgaGludHMpO1xuICAgICAgICAgIGlmIChhcnJheUxlbiA9PT0gLTEpIHtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0eXBlRGVmRGljdFtmaWVsZE5hbWVdID0gW3N1YlJlc3VsdF07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoYXQuZW1pdCgnZXJyb3InLCAnQ2Fubm90IGZpbmQgJyArIGZpZWxkVHlwZSArICcgaW4gZGVjb2RlVHlwZURlZnMnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHlwZURlZkRpY3Q7XG4gIH07XG5cbiAgcmV0dXJuIGRlY29kZVR5cGVEZWZzUmVjKGRlZnNbMF0sIGRlZnMpO1xufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IFJvcztcbiIsIi8qKlxuICogQGZpbGVvdmVydmlld1xuICogQGF1dGhvciBCcmFuZG9uIEFsZXhhbmRlciAtIGJhYWxleGFuZGVyQGdtYWlsLmNvbVxuICovXG5cbnZhciBTZXJ2aWNlUmVzcG9uc2UgPSByZXF1aXJlKCcuL1NlcnZpY2VSZXNwb25zZScpO1xudmFyIFNlcnZpY2VSZXF1ZXN0ID0gcmVxdWlyZSgnLi9TZXJ2aWNlUmVxdWVzdCcpO1xudmFyIEV2ZW50RW1pdHRlcjIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIyJykuRXZlbnRFbWl0dGVyMjtcblxuLyoqXG4gKiBBIFJPUyBzZXJ2aWNlIGNsaWVudC5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbXMgb3B0aW9ucyAtIHBvc3NpYmxlIGtleXMgaW5jbHVkZTpcbiAqICAgKiByb3MgLSB0aGUgUk9TTElCLlJvcyBjb25uZWN0aW9uIGhhbmRsZVxuICogICAqIG5hbWUgLSB0aGUgc2VydmljZSBuYW1lLCBsaWtlIC9hZGRfdHdvX2ludHNcbiAqICAgKiBzZXJ2aWNlVHlwZSAtIHRoZSBzZXJ2aWNlIHR5cGUsIGxpa2UgJ3Jvc3B5X3R1dG9yaWFscy9BZGRUd29JbnRzJ1xuICovXG5mdW5jdGlvbiBTZXJ2aWNlKG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHRoaXMucm9zID0gb3B0aW9ucy5yb3M7XG4gIHRoaXMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgdGhpcy5zZXJ2aWNlVHlwZSA9IG9wdGlvbnMuc2VydmljZVR5cGU7XG4gIHRoaXMuaXNBZHZlcnRpc2VkID0gZmFsc2U7XG5cbiAgdGhpcy5fc2VydmljZUNhbGxiYWNrID0gbnVsbDtcbn1cblNlcnZpY2UucHJvdG90eXBlLl9fcHJvdG9fXyA9IEV2ZW50RW1pdHRlcjIucHJvdG90eXBlO1xuLyoqXG4gKiBDYWxscyB0aGUgc2VydmljZS4gUmV0dXJucyB0aGUgc2VydmljZSByZXNwb25zZSBpbiB0aGUgY2FsbGJhY2suXG4gKlxuICogQHBhcmFtIHJlcXVlc3QgLSB0aGUgUk9TTElCLlNlcnZpY2VSZXF1ZXN0IHRvIHNlbmRcbiAqIEBwYXJhbSBjYWxsYmFjayAtIGZ1bmN0aW9uIHdpdGggcGFyYW1zOlxuICogICAqIHJlc3BvbnNlIC0gdGhlIHJlc3BvbnNlIGZyb20gdGhlIHNlcnZpY2UgcmVxdWVzdFxuICogQHBhcmFtIGZhaWxlZENhbGxiYWNrIC0gdGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHdoZW4gdGhlIHNlcnZpY2UgY2FsbCBmYWlsZWQgKG9wdGlvbmFsKS4gUGFyYW1zOlxuICogICAqIGVycm9yIC0gdGhlIGVycm9yIG1lc3NhZ2UgcmVwb3J0ZWQgYnkgUk9TXG4gKi9cblNlcnZpY2UucHJvdG90eXBlLmNhbGxTZXJ2aWNlID0gZnVuY3Rpb24ocmVxdWVzdCwgY2FsbGJhY2ssIGZhaWxlZENhbGxiYWNrKSB7XG4gIGlmICh0aGlzLmlzQWR2ZXJ0aXNlZCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBzZXJ2aWNlQ2FsbElkID0gJ2NhbGxfc2VydmljZTonICsgdGhpcy5uYW1lICsgJzonICsgKCsrdGhpcy5yb3MuaWRDb3VudGVyKTtcblxuICBpZiAoY2FsbGJhY2sgfHwgZmFpbGVkQ2FsbGJhY2spIHtcbiAgICB0aGlzLnJvcy5vbmNlKHNlcnZpY2VDYWxsSWQsIGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICAgIGlmIChtZXNzYWdlLnJlc3VsdCAhPT0gdW5kZWZpbmVkICYmIG1lc3NhZ2UucmVzdWx0ID09PSBmYWxzZSkge1xuICAgICAgICBpZiAodHlwZW9mIGZhaWxlZENhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgZmFpbGVkQ2FsbGJhY2sobWVzc2FnZS52YWx1ZXMpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayhuZXcgU2VydmljZVJlc3BvbnNlKG1lc3NhZ2UudmFsdWVzKSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICB2YXIgY2FsbCA9IHtcbiAgICBvcCA6ICdjYWxsX3NlcnZpY2UnLFxuICAgIGlkIDogc2VydmljZUNhbGxJZCxcbiAgICBzZXJ2aWNlIDogdGhpcy5uYW1lLFxuICAgIGFyZ3MgOiByZXF1ZXN0XG4gIH07XG4gIHRoaXMucm9zLmNhbGxPbkNvbm5lY3Rpb24oY2FsbCk7XG59O1xuXG4vKipcbiAqIEV2ZXJ5IHRpbWUgYSBtZXNzYWdlIGlzIHB1Ymxpc2hlZCBmb3IgdGhlIGdpdmVuIHRvcGljLCB0aGUgY2FsbGJhY2tcbiAqIHdpbGwgYmUgY2FsbGVkIHdpdGggdGhlIG1lc3NhZ2Ugb2JqZWN0LlxuICpcbiAqIEBwYXJhbSBjYWxsYmFjayAtIGZ1bmN0aW9uIHdpdGggdGhlIGZvbGxvd2luZyBwYXJhbXM6XG4gKiAgICogbWVzc2FnZSAtIHRoZSBwdWJsaXNoZWQgbWVzc2FnZVxuICovXG5TZXJ2aWNlLnByb3RvdHlwZS5hZHZlcnRpc2UgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICBpZiAodGhpcy5pc0FkdmVydGlzZWQgfHwgdHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5fc2VydmljZUNhbGxiYWNrID0gY2FsbGJhY2s7XG4gIHRoaXMucm9zLm9uKHRoaXMubmFtZSwgdGhpcy5fc2VydmljZVJlc3BvbnNlLmJpbmQodGhpcykpO1xuICB0aGlzLnJvcy5jYWxsT25Db25uZWN0aW9uKHtcbiAgICBvcDogJ2FkdmVydGlzZV9zZXJ2aWNlJyxcbiAgICB0eXBlOiB0aGlzLnNlcnZpY2VUeXBlLFxuICAgIHNlcnZpY2U6IHRoaXMubmFtZVxuICB9KTtcbiAgdGhpcy5pc0FkdmVydGlzZWQgPSB0cnVlO1xufTtcblxuU2VydmljZS5wcm90b3R5cGUudW5hZHZlcnRpc2UgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLmlzQWR2ZXJ0aXNlZCkge1xuICAgIHJldHVybjtcbiAgfVxuICB0aGlzLnJvcy5jYWxsT25Db25uZWN0aW9uKHtcbiAgICBvcDogJ3VuYWR2ZXJ0aXNlX3NlcnZpY2UnLFxuICAgIHNlcnZpY2U6IHRoaXMubmFtZVxuICB9KTtcbiAgdGhpcy5pc0FkdmVydGlzZWQgPSBmYWxzZTtcbn07XG5cblNlcnZpY2UucHJvdG90eXBlLl9zZXJ2aWNlUmVzcG9uc2UgPSBmdW5jdGlvbihyb3NicmlkZ2VSZXF1ZXN0KSB7XG4gIHZhciByZXNwb25zZSA9IHt9O1xuICB2YXIgc3VjY2VzcyA9IHRoaXMuX3NlcnZpY2VDYWxsYmFjayhyb3NicmlkZ2VSZXF1ZXN0LmFyZ3MsIHJlc3BvbnNlKTtcblxuICB2YXIgY2FsbCA9IHtcbiAgICBvcDogJ3NlcnZpY2VfcmVzcG9uc2UnLFxuICAgIHNlcnZpY2U6IHRoaXMubmFtZSxcbiAgICB2YWx1ZXM6IG5ldyBTZXJ2aWNlUmVzcG9uc2UocmVzcG9uc2UpLFxuICAgIHJlc3VsdDogc3VjY2Vzc1xuICB9O1xuXG4gIGlmIChyb3NicmlkZ2VSZXF1ZXN0LmlkKSB7XG4gICAgY2FsbC5pZCA9IHJvc2JyaWRnZVJlcXVlc3QuaWQ7XG4gIH1cblxuICB0aGlzLnJvcy5jYWxsT25Db25uZWN0aW9uKGNhbGwpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTZXJ2aWNlOyIsIi8qKlxuICogQGZpbGVvdmVydmlld1xuICogQGF1dGhvciBCcmFuZG9uIEFsZXhhbmRlciAtIGJhbGV4YW5kZXJAd2lsbG93Z2FyYWdlLmNvbVxuICovXG5cbnZhciBhc3NpZ24gPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJyk7XG5cbi8qKlxuICogQSBTZXJ2aWNlUmVxdWVzdCBpcyBwYXNzZWQgaW50byB0aGUgc2VydmljZSBjYWxsLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHZhbHVlcyAtIG9iamVjdCBtYXRjaGluZyB0aGUgZmllbGRzIGRlZmluZWQgaW4gdGhlIC5zcnYgZGVmaW5pdGlvbiBmaWxlXG4gKi9cbmZ1bmN0aW9uIFNlcnZpY2VSZXF1ZXN0KHZhbHVlcykge1xuICBhc3NpZ24odGhpcywgdmFsdWVzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTZXJ2aWNlUmVxdWVzdDsiLCIvKipcbiAqIEBmaWxlb3ZlcnZpZXdcbiAqIEBhdXRob3IgQnJhbmRvbiBBbGV4YW5kZXIgLSBiYWxleGFuZGVyQHdpbGxvd2dhcmFnZS5jb21cbiAqL1xuXG52YXIgYXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpO1xuXG4vKipcbiAqIEEgU2VydmljZVJlc3BvbnNlIGlzIHJldHVybmVkIGZyb20gdGhlIHNlcnZpY2UgY2FsbC5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB2YWx1ZXMgLSBvYmplY3QgbWF0Y2hpbmcgdGhlIGZpZWxkcyBkZWZpbmVkIGluIHRoZSAuc3J2IGRlZmluaXRpb24gZmlsZVxuICovXG5mdW5jdGlvbiBTZXJ2aWNlUmVzcG9uc2UodmFsdWVzKSB7XG4gIGFzc2lnbih0aGlzLCB2YWx1ZXMpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFNlcnZpY2VSZXNwb25zZTsiLCIvKipcbiAqIFNvY2tldCBldmVudCBoYW5kbGluZyB1dGlsaXRpZXMgZm9yIGhhbmRsaW5nIGV2ZW50cyBvbiBlaXRoZXJcbiAqIFdlYlNvY2tldCBhbmQgVENQIHNvY2tldHNcbiAqXG4gKiBOb3RlIHRvIGFueW9uZSByZXZpZXdpbmcgdGhpcyBjb2RlOiB0aGVzZSBmdW5jdGlvbnMgYXJlIGNhbGxlZFxuICogaW4gdGhlIGNvbnRleHQgb2YgdGhlaXIgcGFyZW50IG9iamVjdCwgdW5sZXNzIGJvdW5kXG4gKiBAZmlsZU92ZXJ2aWV3XG4gKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIGRlY29tcHJlc3NQbmcgPSByZXF1aXJlKCcuLi91dGlsL2RlY29tcHJlc3NQbmcnKTtcbnZhciBXZWJTb2NrZXQgPSByZXF1aXJlKCd3cycpO1xudmFyIEJTT04gPSBudWxsO1xuaWYodHlwZW9mIGJzb24gIT09ICd1bmRlZmluZWQnKXtcbiAgICBCU09OID0gYnNvbigpLkJTT047XG59XG5cbi8qKlxuICogRXZlbnRzIGxpc3RlbmVycyBmb3IgYSBXZWJTb2NrZXQgb3IgVENQIHNvY2tldCB0byBhIEphdmFTY3JpcHRcbiAqIFJPUyBDbGllbnQuIFNldHMgdXAgTWVzc2FnZXMgZm9yIGEgZ2l2ZW4gdG9waWMgdG8gdHJpZ2dlciBhblxuICogZXZlbnQgb24gdGhlIFJPUyBjbGllbnQuXG4gKlxuICogQG5hbWVzcGFjZSBTb2NrZXRBZGFwdGVyXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBTb2NrZXRBZGFwdGVyKGNsaWVudCkge1xuICBmdW5jdGlvbiBoYW5kbGVNZXNzYWdlKG1lc3NhZ2UpIHtcbiAgICBpZiAobWVzc2FnZS5vcCA9PT0gJ3B1Ymxpc2gnKSB7XG4gICAgICBjbGllbnQuZW1pdChtZXNzYWdlLnRvcGljLCBtZXNzYWdlLm1zZyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlLm9wID09PSAnc2VydmljZV9yZXNwb25zZScpIHtcbiAgICAgIGNsaWVudC5lbWl0KG1lc3NhZ2UuaWQsIG1lc3NhZ2UpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZS5vcCA9PT0gJ2NhbGxfc2VydmljZScpIHtcbiAgICAgIGNsaWVudC5lbWl0KG1lc3NhZ2Uuc2VydmljZSwgbWVzc2FnZSk7XG4gICAgfSBlbHNlIGlmKG1lc3NhZ2Uub3AgPT09ICdzdGF0dXMnKXtcbiAgICAgIGlmKG1lc3NhZ2UuaWQpe1xuICAgICAgICBjbGllbnQuZW1pdCgnc3RhdHVzOicrbWVzc2FnZS5pZCwgbWVzc2FnZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjbGllbnQuZW1pdCgnc3RhdHVzJywgbWVzc2FnZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaGFuZGxlUG5nKG1lc3NhZ2UsIGNhbGxiYWNrKSB7XG4gICAgaWYgKG1lc3NhZ2Uub3AgPT09ICdwbmcnKSB7XG4gICAgICBkZWNvbXByZXNzUG5nKG1lc3NhZ2UuZGF0YSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayhtZXNzYWdlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWNvZGVCU09OKGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCFCU09OKSB7XG4gICAgICB0aHJvdyAnQ2Fubm90IHByb2Nlc3MgQlNPTiBlbmNvZGVkIG1lc3NhZ2Ugd2l0aG91dCBCU09OIGhlYWRlci4nO1xuICAgIH1cbiAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICByZWFkZXIub25sb2FkICA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHVpbnQ4QXJyYXkgPSBuZXcgVWludDhBcnJheSh0aGlzLnJlc3VsdCk7XG4gICAgICB2YXIgbXNnID0gQlNPTi5kZXNlcmlhbGl6ZSh1aW50OEFycmF5KTtcbiAgICAgIGNhbGxiYWNrKG1zZyk7XG4gICAgfTtcbiAgICByZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIoZGF0YSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVtaXRzIGEgJ2Nvbm5lY3Rpb24nIGV2ZW50IG9uIFdlYlNvY2tldCBjb25uZWN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIGV2ZW50IC0gdGhlIGFyZ3VtZW50IHRvIGVtaXQgd2l0aCB0aGUgZXZlbnQuXG4gICAgICogQG1lbWJlcm9mIFNvY2tldEFkYXB0ZXJcbiAgICAgKi9cbiAgICBvbm9wZW46IGZ1bmN0aW9uIG9uT3BlbihldmVudCkge1xuICAgICAgY2xpZW50LmlzQ29ubmVjdGVkID0gdHJ1ZTtcbiAgICAgIGNsaWVudC5lbWl0KCdjb25uZWN0aW9uJywgZXZlbnQpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBFbWl0cyBhICdjbG9zZScgZXZlbnQgb24gV2ViU29ja2V0IGRpc2Nvbm5lY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZXZlbnQgLSB0aGUgYXJndW1lbnQgdG8gZW1pdCB3aXRoIHRoZSBldmVudC5cbiAgICAgKiBAbWVtYmVyb2YgU29ja2V0QWRhcHRlclxuICAgICAqL1xuICAgIG9uY2xvc2U6IGZ1bmN0aW9uIG9uQ2xvc2UoZXZlbnQpIHtcbiAgICAgIGNsaWVudC5pc0Nvbm5lY3RlZCA9IGZhbHNlO1xuICAgICAgY2xpZW50LmVtaXQoJ2Nsb3NlJywgZXZlbnQpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBFbWl0cyBhbiAnZXJyb3InIGV2ZW50IHdoZW5ldmVyIHRoZXJlIHdhcyBhbiBlcnJvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBldmVudCAtIHRoZSBhcmd1bWVudCB0byBlbWl0IHdpdGggdGhlIGV2ZW50LlxuICAgICAqIEBtZW1iZXJvZiBTb2NrZXRBZGFwdGVyXG4gICAgICovXG4gICAgb25lcnJvcjogZnVuY3Rpb24gb25FcnJvcihldmVudCkge1xuICAgICAgY2xpZW50LmVtaXQoJ2Vycm9yJywgZXZlbnQpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBQYXJzZXMgbWVzc2FnZSByZXNwb25zZXMgZnJvbSByb3NicmlkZ2UgYW5kIHNlbmRzIHRvIHRoZSBhcHByb3ByaWF0ZVxuICAgICAqIHRvcGljLCBzZXJ2aWNlLCBvciBwYXJhbS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBtZXNzYWdlIC0gdGhlIHJhdyBKU09OIG1lc3NhZ2UgZnJvbSByb3NicmlkZ2UuXG4gICAgICogQG1lbWJlcm9mIFNvY2tldEFkYXB0ZXJcbiAgICAgKi9cbiAgICBvbm1lc3NhZ2U6IGZ1bmN0aW9uIG9uTWVzc2FnZShkYXRhKSB7XG4gICAgICBpZiAodHlwZW9mIEJsb2IgIT09ICd1bmRlZmluZWQnICYmIGRhdGEuZGF0YSBpbnN0YW5jZW9mIEJsb2IpIHtcbiAgICAgICAgZGVjb2RlQlNPTihkYXRhLmRhdGEsIGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgICAgICAgaGFuZGxlUG5nKG1lc3NhZ2UsIGhhbmRsZU1lc3NhZ2UpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBtZXNzYWdlID0gSlNPTi5wYXJzZSh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBkYXRhIDogZGF0YS5kYXRhKTtcbiAgICAgICAgaGFuZGxlUG5nKG1lc3NhZ2UsIGhhbmRsZU1lc3NhZ2UpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTb2NrZXRBZGFwdGVyO1xuIiwiLyoqXG4gKiBAZmlsZW92ZXJ2aWV3XG4gKiBAYXV0aG9yIEJyYW5kb24gQWxleGFuZGVyIC0gYmFhbGV4YW5kZXJAZ21haWwuY29tXG4gKi9cblxudmFyIEV2ZW50RW1pdHRlcjIgPSByZXF1aXJlKCdldmVudGVtaXR0ZXIyJykuRXZlbnRFbWl0dGVyMjtcbnZhciBNZXNzYWdlID0gcmVxdWlyZSgnLi9NZXNzYWdlJyk7XG5cbi8qKlxuICogUHVibGlzaCBhbmQvb3Igc3Vic2NyaWJlIHRvIGEgdG9waWMgaW4gUk9TLlxuICpcbiAqIEVtaXRzIHRoZSBmb2xsb3dpbmcgZXZlbnRzOlxuICogICogJ3dhcm5pbmcnIC0gaWYgdGhlcmUgYXJlIGFueSB3YXJuaW5nIGR1cmluZyB0aGUgVG9waWMgY3JlYXRpb25cbiAqICAqICdtZXNzYWdlJyAtIHRoZSBtZXNzYWdlIGRhdGEgZnJvbSByb3NicmlkZ2VcbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSBvcHRpb25zIC0gb2JqZWN0IHdpdGggZm9sbG93aW5nIGtleXM6XG4gKiAgICogcm9zIC0gdGhlIFJPU0xJQi5Sb3MgY29ubmVjdGlvbiBoYW5kbGVcbiAqICAgKiBuYW1lIC0gdGhlIHRvcGljIG5hbWUsIGxpa2UgL2NtZF92ZWxcbiAqICAgKiBtZXNzYWdlVHlwZSAtIHRoZSBtZXNzYWdlIHR5cGUsIGxpa2UgJ3N0ZF9tc2dzL1N0cmluZydcbiAqICAgKiBjb21wcmVzc2lvbiAtIHRoZSB0eXBlIG9mIGNvbXByZXNzaW9uIHRvIHVzZSwgbGlrZSAncG5nJ1xuICogICAqIHRocm90dGxlX3JhdGUgLSB0aGUgcmF0ZSAoaW4gbXMgaW4gYmV0d2VlbiBtZXNzYWdlcykgYXQgd2hpY2ggdG8gdGhyb3R0bGUgdGhlIHRvcGljc1xuICogICAqIHF1ZXVlX3NpemUgLSB0aGUgcXVldWUgY3JlYXRlZCBhdCBicmlkZ2Ugc2lkZSBmb3IgcmUtcHVibGlzaGluZyB3ZWJ0b3BpY3MgKGRlZmF1bHRzIHRvIDEwMClcbiAqICAgKiBsYXRjaCAtIGxhdGNoIHRoZSB0b3BpYyB3aGVuIHB1Ymxpc2hpbmdcbiAqICAgKiBxdWV1ZV9sZW5ndGggLSB0aGUgcXVldWUgbGVuZ3RoIGF0IGJyaWRnZSBzaWRlIHVzZWQgd2hlbiBzdWJzY3JpYmluZyAoZGVmYXVsdHMgdG8gMCwgbm8gcXVldWVpbmcpLlxuICogICAqIHJlY29ubmVjdF9vbl9jbG9zZSAtIHRoZSBmbGFnIHRvIGVuYWJsZSByZXN1YnNjcmlwdGlvbiBhbmQgcmVhZHZlcnRpc2VtZW50IG9uIGNsb3NlIGV2ZW50KGRlZmF1bHRzIHRvIHRydWUpLlxuICovXG5mdW5jdGlvbiBUb3BpYyhvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB0aGlzLnJvcyA9IG9wdGlvbnMucm9zO1xuICB0aGlzLm5hbWUgPSBvcHRpb25zLm5hbWU7XG4gIHRoaXMubWVzc2FnZVR5cGUgPSBvcHRpb25zLm1lc3NhZ2VUeXBlO1xuICB0aGlzLmlzQWR2ZXJ0aXNlZCA9IGZhbHNlO1xuICB0aGlzLmNvbXByZXNzaW9uID0gb3B0aW9ucy5jb21wcmVzc2lvbiB8fCAnbm9uZSc7XG4gIHRoaXMudGhyb3R0bGVfcmF0ZSA9IG9wdGlvbnMudGhyb3R0bGVfcmF0ZSB8fCAwO1xuICB0aGlzLmxhdGNoID0gb3B0aW9ucy5sYXRjaCB8fCBmYWxzZTtcbiAgdGhpcy5xdWV1ZV9zaXplID0gb3B0aW9ucy5xdWV1ZV9zaXplIHx8IDEwMDtcbiAgdGhpcy5xdWV1ZV9sZW5ndGggPSBvcHRpb25zLnF1ZXVlX2xlbmd0aCB8fCAwO1xuICB0aGlzLnJlY29ubmVjdF9vbl9jbG9zZSA9IG9wdGlvbnMucmVjb25uZWN0X29uX2Nsb3NlIHx8IHRydWU7XG5cbiAgLy8gQ2hlY2sgZm9yIHZhbGlkIGNvbXByZXNzaW9uIHR5cGVzXG4gIGlmICh0aGlzLmNvbXByZXNzaW9uICYmIHRoaXMuY29tcHJlc3Npb24gIT09ICdwbmcnICYmXG4gICAgdGhpcy5jb21wcmVzc2lvbiAhPT0gJ25vbmUnKSB7XG4gICAgdGhpcy5lbWl0KCd3YXJuaW5nJywgdGhpcy5jb21wcmVzc2lvbiArXG4gICAgICAnIGNvbXByZXNzaW9uIGlzIG5vdCBzdXBwb3J0ZWQuIE5vIGNvbXByZXNzaW9uIHdpbGwgYmUgdXNlZC4nKTtcbiAgfVxuXG4gIC8vIENoZWNrIGlmIHRocm90dGxlIHJhdGUgaXMgbmVnYXRpdmVcbiAgaWYgKHRoaXMudGhyb3R0bGVfcmF0ZSA8IDApIHtcbiAgICB0aGlzLmVtaXQoJ3dhcm5pbmcnLCB0aGlzLnRocm90dGxlX3JhdGUgKyAnIGlzIG5vdCBhbGxvd2VkLiBTZXQgdG8gMCcpO1xuICAgIHRoaXMudGhyb3R0bGVfcmF0ZSA9IDA7XG4gIH1cblxuICB2YXIgdGhhdCA9IHRoaXM7XG4gIGlmICh0aGlzLnJlY29ubmVjdF9vbl9jbG9zZSkge1xuICAgIHRoaXMuY2FsbEZvclN1YnNjcmliZUFuZEFkdmVydGlzZSA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICAgIHRoYXQucm9zLmNhbGxPbkNvbm5lY3Rpb24obWVzc2FnZSk7XG5cbiAgICAgIHRoYXQud2FpdEZvclJlY29ubmVjdCA9IGZhbHNlO1xuICAgICAgdGhhdC5yZWNvbm5lY3RGdW5jID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmKCF0aGF0LndhaXRGb3JSZWNvbm5lY3QpIHtcbiAgICAgICAgICB0aGF0LndhaXRGb3JSZWNvbm5lY3QgPSB0cnVlO1xuICAgICAgICAgIHRoYXQucm9zLmNhbGxPbkNvbm5lY3Rpb24obWVzc2FnZSk7XG4gICAgICAgICAgdGhhdC5yb3Mub25jZSgnY29ubmVjdGlvbicsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhhdC53YWl0Rm9yUmVjb25uZWN0ID0gZmFsc2U7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICB0aGF0LnJvcy5vbignY2xvc2UnLCB0aGF0LnJlY29ubmVjdEZ1bmMpO1xuICAgIH07XG4gIH1cbiAgZWxzZSB7XG4gICAgdGhpcy5jYWxsRm9yU3Vic2NyaWJlQW5kQWR2ZXJ0aXNlID0gdGhpcy5yb3MuY2FsbE9uQ29ubmVjdGlvbjtcbiAgfVxuXG4gIHRoaXMuX21lc3NhZ2VDYWxsYmFjayA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICB0aGF0LmVtaXQoJ21lc3NhZ2UnLCBuZXcgTWVzc2FnZShkYXRhKSk7XG4gIH07XG59XG5Ub3BpYy5wcm90b3R5cGUuX19wcm90b19fID0gRXZlbnRFbWl0dGVyMi5wcm90b3R5cGU7XG5cbi8qKlxuICogRXZlcnkgdGltZSBhIG1lc3NhZ2UgaXMgcHVibGlzaGVkIGZvciB0aGUgZ2l2ZW4gdG9waWMsIHRoZSBjYWxsYmFja1xuICogd2lsbCBiZSBjYWxsZWQgd2l0aCB0aGUgbWVzc2FnZSBvYmplY3QuXG4gKlxuICogQHBhcmFtIGNhbGxiYWNrIC0gZnVuY3Rpb24gd2l0aCB0aGUgZm9sbG93aW5nIHBhcmFtczpcbiAqICAgKiBtZXNzYWdlIC0gdGhlIHB1Ymxpc2hlZCBtZXNzYWdlXG4gKi9cblRvcGljLnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy5vbignbWVzc2FnZScsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIGlmICh0aGlzLnN1YnNjcmliZUlkKSB7IHJldHVybjsgfVxuICB0aGlzLnJvcy5vbih0aGlzLm5hbWUsIHRoaXMuX21lc3NhZ2VDYWxsYmFjayk7XG4gIHRoaXMuc3Vic2NyaWJlSWQgPSAnc3Vic2NyaWJlOicgKyB0aGlzLm5hbWUgKyAnOicgKyAoKyt0aGlzLnJvcy5pZENvdW50ZXIpO1xuXG4gIHRoaXMuY2FsbEZvclN1YnNjcmliZUFuZEFkdmVydGlzZSh7XG4gICAgb3A6ICdzdWJzY3JpYmUnLFxuICAgIGlkOiB0aGlzLnN1YnNjcmliZUlkLFxuICAgIHR5cGU6IHRoaXMubWVzc2FnZVR5cGUsXG4gICAgdG9waWM6IHRoaXMubmFtZSxcbiAgICBjb21wcmVzc2lvbjogdGhpcy5jb21wcmVzc2lvbixcbiAgICB0aHJvdHRsZV9yYXRlOiB0aGlzLnRocm90dGxlX3JhdGUsXG4gICAgcXVldWVfbGVuZ3RoOiB0aGlzLnF1ZXVlX2xlbmd0aFxuICB9KTtcbn07XG5cbi8qKlxuICogVW5yZWdpc3RlcnMgYXMgYSBzdWJzY3JpYmVyIGZvciB0aGUgdG9waWMuIFVuc3Vic2NyaWJpbmcgc3RvcCByZW1vdmVcbiAqIGFsbCBzdWJzY3JpYmUgY2FsbGJhY2tzLiBUbyByZW1vdmUgYSBjYWxsIGJhY2ssIHlvdSBtdXN0IGV4cGxpY2l0bHlcbiAqIHBhc3MgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uIGluLlxuICpcbiAqIEBwYXJhbSBjYWxsYmFjayAtIHRoZSBvcHRpb25hbCBjYWxsYmFjayB0byB1bnJlZ2lzdGVyLCBpZlxuICogICAgICogcHJvdmlkZWQgYW5kIG90aGVyIGxpc3RlbmVycyBhcmUgcmVnaXN0ZXJlZCB0aGUgdG9waWMgd29uJ3RcbiAqICAgICAqIHVuc3Vic2NyaWJlLCBqdXN0IHN0b3AgZW1pdHRpbmcgdG8gdGhlIHBhc3NlZCBsaXN0ZW5lclxuICovXG5Ub3BpYy5wcm90b3R5cGUudW5zdWJzY3JpYmUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICBpZiAoY2FsbGJhY2spIHtcbiAgICB0aGlzLm9mZignbWVzc2FnZScsIGNhbGxiYWNrKTtcbiAgICAvLyBJZiB0aGVyZSBpcyBhbnkgb3RoZXIgY2FsbGJhY2tzIHN0aWxsIHN1YnNjcmliZWQgZG9uJ3QgdW5zdWJzY3JpYmVcbiAgICBpZiAodGhpcy5saXN0ZW5lcnMoJ21lc3NhZ2UnKS5sZW5ndGgpIHsgcmV0dXJuOyB9XG4gIH1cbiAgaWYgKCF0aGlzLnN1YnNjcmliZUlkKSB7IHJldHVybjsgfVxuICAvLyBOb3RlOiBEb24ndCBjYWxsIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzLCBhbGxvdyBjbGllbnQgdG8gaGFuZGxlIHRoYXQgdGhlbXNlbHZlc1xuICB0aGlzLnJvcy5vZmYodGhpcy5uYW1lLCB0aGlzLl9tZXNzYWdlQ2FsbGJhY2spO1xuICBpZih0aGlzLnJlY29ubmVjdF9vbl9jbG9zZSkge1xuICAgIHRoaXMucm9zLm9mZignY2xvc2UnLCB0aGlzLnJlY29ubmVjdEZ1bmMpO1xuICB9XG4gIHRoaXMuZW1pdCgndW5zdWJzY3JpYmUnKTtcbiAgdGhpcy5yb3MuY2FsbE9uQ29ubmVjdGlvbih7XG4gICAgb3A6ICd1bnN1YnNjcmliZScsXG4gICAgaWQ6IHRoaXMuc3Vic2NyaWJlSWQsXG4gICAgdG9waWM6IHRoaXMubmFtZVxuICB9KTtcbiAgdGhpcy5zdWJzY3JpYmVJZCA9IG51bGw7XG59O1xuXG5cbi8qKlxuICogUmVnaXN0ZXJzIGFzIGEgcHVibGlzaGVyIGZvciB0aGUgdG9waWMuXG4gKi9cblRvcGljLnByb3RvdHlwZS5hZHZlcnRpc2UgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuaXNBZHZlcnRpc2VkKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHRoaXMuYWR2ZXJ0aXNlSWQgPSAnYWR2ZXJ0aXNlOicgKyB0aGlzLm5hbWUgKyAnOicgKyAoKyt0aGlzLnJvcy5pZENvdW50ZXIpO1xuICB0aGlzLmNhbGxGb3JTdWJzY3JpYmVBbmRBZHZlcnRpc2Uoe1xuICAgIG9wOiAnYWR2ZXJ0aXNlJyxcbiAgICBpZDogdGhpcy5hZHZlcnRpc2VJZCxcbiAgICB0eXBlOiB0aGlzLm1lc3NhZ2VUeXBlLFxuICAgIHRvcGljOiB0aGlzLm5hbWUsXG4gICAgbGF0Y2g6IHRoaXMubGF0Y2gsXG4gICAgcXVldWVfc2l6ZTogdGhpcy5xdWV1ZV9zaXplXG4gIH0pO1xuICB0aGlzLmlzQWR2ZXJ0aXNlZCA9IHRydWU7XG5cbiAgaWYoIXRoaXMucmVjb25uZWN0X29uX2Nsb3NlKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHRoaXMucm9zLm9uKCdjbG9zZScsIGZ1bmN0aW9uKCkge1xuICAgICAgdGhhdC5pc0FkdmVydGlzZWQgPSBmYWxzZTtcbiAgICB9KTtcbiAgfVxufTtcblxuLyoqXG4gKiBVbnJlZ2lzdGVycyBhcyBhIHB1Ymxpc2hlciBmb3IgdGhlIHRvcGljLlxuICovXG5Ub3BpYy5wcm90b3R5cGUudW5hZHZlcnRpc2UgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCF0aGlzLmlzQWR2ZXJ0aXNlZCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZih0aGlzLnJlY29ubmVjdF9vbl9jbG9zZSkge1xuICAgIHRoaXMucm9zLm9mZignY2xvc2UnLCB0aGlzLnJlY29ubmVjdEZ1bmMpO1xuICB9XG4gIHRoaXMuZW1pdCgndW5hZHZlcnRpc2UnKTtcbiAgdGhpcy5yb3MuY2FsbE9uQ29ubmVjdGlvbih7XG4gICAgb3A6ICd1bmFkdmVydGlzZScsXG4gICAgaWQ6IHRoaXMuYWR2ZXJ0aXNlSWQsXG4gICAgdG9waWM6IHRoaXMubmFtZVxuICB9KTtcbiAgdGhpcy5pc0FkdmVydGlzZWQgPSBmYWxzZTtcbn07XG5cbi8qKlxuICogUHVibGlzaCB0aGUgbWVzc2FnZS5cbiAqXG4gKiBAcGFyYW0gbWVzc2FnZSAtIEEgUk9TTElCLk1lc3NhZ2Ugb2JqZWN0LlxuICovXG5Ub3BpYy5wcm90b3R5cGUucHVibGlzaCA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgaWYgKCF0aGlzLmlzQWR2ZXJ0aXNlZCkge1xuICAgIHRoaXMuYWR2ZXJ0aXNlKCk7XG4gIH1cblxuICB0aGlzLnJvcy5pZENvdW50ZXIrKztcbiAgdmFyIGNhbGwgPSB7XG4gICAgb3A6ICdwdWJsaXNoJyxcbiAgICBpZDogJ3B1Ymxpc2g6JyArIHRoaXMubmFtZSArICc6JyArIHRoaXMucm9zLmlkQ291bnRlcixcbiAgICB0b3BpYzogdGhpcy5uYW1lLFxuICAgIG1zZzogbWVzc2FnZSxcbiAgICBsYXRjaDogdGhpcy5sYXRjaFxuICB9O1xuICB0aGlzLnJvcy5jYWxsT25Db25uZWN0aW9uKGNhbGwpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBUb3BpYztcbiIsInZhciBtaXhpbiA9IHJlcXVpcmUoJy4uL21peGluJyk7XG5cbnZhciBjb3JlID0gbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgUm9zOiByZXF1aXJlKCcuL1JvcycpLFxuICAgIFRvcGljOiByZXF1aXJlKCcuL1RvcGljJyksXG4gICAgTWVzc2FnZTogcmVxdWlyZSgnLi9NZXNzYWdlJyksXG4gICAgUGFyYW06IHJlcXVpcmUoJy4vUGFyYW0nKSxcbiAgICBTZXJ2aWNlOiByZXF1aXJlKCcuL1NlcnZpY2UnKSxcbiAgICBTZXJ2aWNlUmVxdWVzdDogcmVxdWlyZSgnLi9TZXJ2aWNlUmVxdWVzdCcpLFxuICAgIFNlcnZpY2VSZXNwb25zZTogcmVxdWlyZSgnLi9TZXJ2aWNlUmVzcG9uc2UnKVxufTtcblxubWl4aW4oY29yZS5Sb3MsIFsnUGFyYW0nLCAnU2VydmljZScsICdUb3BpYyddLCBjb3JlKTtcbiIsIi8qKlxuICogQGZpbGVvdmVydmlld1xuICogQGF1dGhvciBEYXZpZCBHb3Nzb3cgLSBkZ29zc293QHdpbGxvd2dhcmFnZS5jb21cbiAqL1xuXG52YXIgVmVjdG9yMyA9IHJlcXVpcmUoJy4vVmVjdG9yMycpO1xudmFyIFF1YXRlcm5pb24gPSByZXF1aXJlKCcuL1F1YXRlcm5pb24nKTtcblxuLyoqXG4gKiBBIFBvc2UgaW4gM0Qgc3BhY2UuIFZhbHVlcyBhcmUgY29waWVkIGludG8gdGhpcyBvYmplY3QuXG4gKlxuICogIEBjb25zdHJ1Y3RvclxuICogIEBwYXJhbSBvcHRpb25zIC0gb2JqZWN0IHdpdGggZm9sbG93aW5nIGtleXM6XG4gKiAgICogcG9zaXRpb24gLSB0aGUgVmVjdG9yMyBkZXNjcmliaW5nIHRoZSBwb3NpdGlvblxuICogICAqIG9yaWVudGF0aW9uIC0gdGhlIFJPU0xJQi5RdWF0ZXJuaW9uIGRlc2NyaWJpbmcgdGhlIG9yaWVudGF0aW9uXG4gKi9cbmZ1bmN0aW9uIFBvc2Uob3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgLy8gY29weSB0aGUgdmFsdWVzIGludG8gdGhpcyBvYmplY3QgaWYgdGhleSBleGlzdFxuICB0aGlzLnBvc2l0aW9uID0gbmV3IFZlY3RvcjMob3B0aW9ucy5wb3NpdGlvbik7XG4gIHRoaXMub3JpZW50YXRpb24gPSBuZXcgUXVhdGVybmlvbihvcHRpb25zLm9yaWVudGF0aW9uKTtcbn1cblxuLyoqXG4gKiBBcHBseSBhIHRyYW5zZm9ybSBhZ2FpbnN0IHRoaXMgcG9zZS5cbiAqXG4gKiBAcGFyYW0gdGYgdGhlIHRyYW5zZm9ybVxuICovXG5Qb3NlLnByb3RvdHlwZS5hcHBseVRyYW5zZm9ybSA9IGZ1bmN0aW9uKHRmKSB7XG4gIHRoaXMucG9zaXRpb24ubXVsdGlwbHlRdWF0ZXJuaW9uKHRmLnJvdGF0aW9uKTtcbiAgdGhpcy5wb3NpdGlvbi5hZGQodGYudHJhbnNsYXRpb24pO1xuICB2YXIgdG1wID0gdGYucm90YXRpb24uY2xvbmUoKTtcbiAgdG1wLm11bHRpcGx5KHRoaXMub3JpZW50YXRpb24pO1xuICB0aGlzLm9yaWVudGF0aW9uID0gdG1wO1xufTtcblxuLyoqXG4gKiBDbG9uZSBhIGNvcHkgb2YgdGhpcyBwb3NlLlxuICpcbiAqIEByZXR1cm5zIHRoZSBjbG9uZWQgcG9zZVxuICovXG5Qb3NlLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFBvc2UodGhpcyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBvc2U7IiwiLyoqXG4gKiBAZmlsZW92ZXJ2aWV3XG4gKiBAYXV0aG9yIERhdmlkIEdvc3NvdyAtIGRnb3Nzb3dAd2lsbG93Z2FyYWdlLmNvbVxuICovXG5cbi8qKlxuICogQSBRdWF0ZXJuaW9uLlxuICpcbiAqICBAY29uc3RydWN0b3JcbiAqICBAcGFyYW0gb3B0aW9ucyAtIG9iamVjdCB3aXRoIGZvbGxvd2luZyBrZXlzOlxuICogICAqIHggLSB0aGUgeCB2YWx1ZVxuICogICAqIHkgLSB0aGUgeSB2YWx1ZVxuICogICAqIHogLSB0aGUgeiB2YWx1ZVxuICogICAqIHcgLSB0aGUgdyB2YWx1ZVxuICovXG5mdW5jdGlvbiBRdWF0ZXJuaW9uKG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHRoaXMueCA9IG9wdGlvbnMueCB8fCAwO1xuICB0aGlzLnkgPSBvcHRpb25zLnkgfHwgMDtcbiAgdGhpcy56ID0gb3B0aW9ucy56IHx8IDA7XG4gIHRoaXMudyA9ICh0eXBlb2Ygb3B0aW9ucy53ID09PSAnbnVtYmVyJykgPyBvcHRpb25zLncgOiAxO1xufVxuXG4vKipcbiAqIFBlcmZvcm0gYSBjb25qdWdhdGlvbiBvbiB0aGlzIHF1YXRlcm5pb24uXG4gKi9cblF1YXRlcm5pb24ucHJvdG90eXBlLmNvbmp1Z2F0ZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLnggKj0gLTE7XG4gIHRoaXMueSAqPSAtMTtcbiAgdGhpcy56ICo9IC0xO1xufTtcblxuLyoqXG4gKiBSZXR1cm4gdGhlIG5vcm0gb2YgdGhpcyBxdWF0ZXJuaW9uLlxuICovXG5RdWF0ZXJuaW9uLnByb3RvdHlwZS5ub3JtID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBNYXRoLnNxcnQodGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53KTtcbn07XG5cbi8qKlxuICogUGVyZm9ybSBhIG5vcm1hbGl6YXRpb24gb24gdGhpcyBxdWF0ZXJuaW9uLlxuICovXG5RdWF0ZXJuaW9uLnByb3RvdHlwZS5ub3JtYWxpemUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGwgPSBNYXRoLnNxcnQodGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53KTtcbiAgaWYgKGwgPT09IDApIHtcbiAgICB0aGlzLnggPSAwO1xuICAgIHRoaXMueSA9IDA7XG4gICAgdGhpcy56ID0gMDtcbiAgICB0aGlzLncgPSAxO1xuICB9IGVsc2Uge1xuICAgIGwgPSAxIC8gbDtcbiAgICB0aGlzLnggPSB0aGlzLnggKiBsO1xuICAgIHRoaXMueSA9IHRoaXMueSAqIGw7XG4gICAgdGhpcy56ID0gdGhpcy56ICogbDtcbiAgICB0aGlzLncgPSB0aGlzLncgKiBsO1xuICB9XG59O1xuXG4vKipcbiAqIENvbnZlcnQgdGhpcyBxdWF0ZXJuaW9uIGludG8gaXRzIGludmVyc2UuXG4gKi9cblF1YXRlcm5pb24ucHJvdG90eXBlLmludmVydCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmNvbmp1Z2F0ZSgpO1xuICB0aGlzLm5vcm1hbGl6ZSgpO1xufTtcblxuLyoqXG4gKiBTZXQgdGhlIHZhbHVlcyBvZiB0aGlzIHF1YXRlcm5pb24gdG8gdGhlIHByb2R1Y3Qgb2YgaXRzZWxmIGFuZCB0aGUgZ2l2ZW4gcXVhdGVybmlvbi5cbiAqXG4gKiBAcGFyYW0gcSB0aGUgcXVhdGVybmlvbiB0byBtdWx0aXBseSB3aXRoXG4gKi9cblF1YXRlcm5pb24ucHJvdG90eXBlLm11bHRpcGx5ID0gZnVuY3Rpb24ocSkge1xuICB2YXIgbmV3WCA9IHRoaXMueCAqIHEudyArIHRoaXMueSAqIHEueiAtIHRoaXMueiAqIHEueSArIHRoaXMudyAqIHEueDtcbiAgdmFyIG5ld1kgPSAtdGhpcy54ICogcS56ICsgdGhpcy55ICogcS53ICsgdGhpcy56ICogcS54ICsgdGhpcy53ICogcS55O1xuICB2YXIgbmV3WiA9IHRoaXMueCAqIHEueSAtIHRoaXMueSAqIHEueCArIHRoaXMueiAqIHEudyArIHRoaXMudyAqIHEuejtcbiAgdmFyIG5ld1cgPSAtdGhpcy54ICogcS54IC0gdGhpcy55ICogcS55IC0gdGhpcy56ICogcS56ICsgdGhpcy53ICogcS53O1xuICB0aGlzLnggPSBuZXdYO1xuICB0aGlzLnkgPSBuZXdZO1xuICB0aGlzLnogPSBuZXdaO1xuICB0aGlzLncgPSBuZXdXO1xufTtcblxuLyoqXG4gKiBDbG9uZSBhIGNvcHkgb2YgdGhpcyBxdWF0ZXJuaW9uLlxuICpcbiAqIEByZXR1cm5zIHRoZSBjbG9uZWQgcXVhdGVybmlvblxuICovXG5RdWF0ZXJuaW9uLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFF1YXRlcm5pb24odGhpcyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1YXRlcm5pb247XG4iLCIvKipcbiAqIEBmaWxlb3ZlcnZpZXdcbiAqIEBhdXRob3IgRGF2aWQgR29zc293IC0gZGdvc3Nvd0B3aWxsb3dnYXJhZ2UuY29tXG4gKi9cblxudmFyIFZlY3RvcjMgPSByZXF1aXJlKCcuL1ZlY3RvcjMnKTtcbnZhciBRdWF0ZXJuaW9uID0gcmVxdWlyZSgnLi9RdWF0ZXJuaW9uJyk7XG5cbi8qKlxuICogQSBUcmFuc2Zvcm0gaW4gMy1zcGFjZS4gVmFsdWVzIGFyZSBjb3BpZWQgaW50byB0aGlzIG9iamVjdC5cbiAqXG4gKiAgQGNvbnN0cnVjdG9yXG4gKiAgQHBhcmFtIG9wdGlvbnMgLSBvYmplY3Qgd2l0aCBmb2xsb3dpbmcga2V5czpcbiAqICAgKiB0cmFuc2xhdGlvbiAtIHRoZSBWZWN0b3IzIGRlc2NyaWJpbmcgdGhlIHRyYW5zbGF0aW9uXG4gKiAgICogcm90YXRpb24gLSB0aGUgUk9TTElCLlF1YXRlcm5pb24gZGVzY3JpYmluZyB0aGUgcm90YXRpb25cbiAqL1xuZnVuY3Rpb24gVHJhbnNmb3JtKG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIC8vIENvcHkgdGhlIHZhbHVlcyBpbnRvIHRoaXMgb2JqZWN0IGlmIHRoZXkgZXhpc3RcbiAgdGhpcy50cmFuc2xhdGlvbiA9IG5ldyBWZWN0b3IzKG9wdGlvbnMudHJhbnNsYXRpb24pO1xuICB0aGlzLnJvdGF0aW9uID0gbmV3IFF1YXRlcm5pb24ob3B0aW9ucy5yb3RhdGlvbik7XG59XG5cbi8qKlxuICogQ2xvbmUgYSBjb3B5IG9mIHRoaXMgdHJhbnNmb3JtLlxuICpcbiAqIEByZXR1cm5zIHRoZSBjbG9uZWQgdHJhbnNmb3JtXG4gKi9cblRyYW5zZm9ybS5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIG5ldyBUcmFuc2Zvcm0odGhpcyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRyYW5zZm9ybTsiLCIvKipcbiAqIEBmaWxlb3ZlcnZpZXdcbiAqIEBhdXRob3IgRGF2aWQgR29zc293IC0gZGdvc3Nvd0B3aWxsb3dnYXJhZ2UuY29tXG4gKi9cblxuLyoqXG4gKiBBIDNEIHZlY3Rvci5cbiAqXG4gKiAgQGNvbnN0cnVjdG9yXG4gKiAgQHBhcmFtIG9wdGlvbnMgLSBvYmplY3Qgd2l0aCBmb2xsb3dpbmcga2V5czpcbiAqICAgKiB4IC0gdGhlIHggdmFsdWVcbiAqICAgKiB5IC0gdGhlIHkgdmFsdWVcbiAqICAgKiB6IC0gdGhlIHogdmFsdWVcbiAqL1xuZnVuY3Rpb24gVmVjdG9yMyhvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB0aGlzLnggPSBvcHRpb25zLnggfHwgMDtcbiAgdGhpcy55ID0gb3B0aW9ucy55IHx8IDA7XG4gIHRoaXMueiA9IG9wdGlvbnMueiB8fCAwO1xufVxuXG4vKipcbiAqIFNldCB0aGUgdmFsdWVzIG9mIHRoaXMgdmVjdG9yIHRvIHRoZSBzdW0gb2YgaXRzZWxmIGFuZCB0aGUgZ2l2ZW4gdmVjdG9yLlxuICpcbiAqIEBwYXJhbSB2IHRoZSB2ZWN0b3IgdG8gYWRkIHdpdGhcbiAqL1xuVmVjdG9yMy5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24odikge1xuICB0aGlzLnggKz0gdi54O1xuICB0aGlzLnkgKz0gdi55O1xuICB0aGlzLnogKz0gdi56O1xufTtcblxuLyoqXG4gKiBTZXQgdGhlIHZhbHVlcyBvZiB0aGlzIHZlY3RvciB0byB0aGUgZGlmZmVyZW5jZSBvZiBpdHNlbGYgYW5kIHRoZSBnaXZlbiB2ZWN0b3IuXG4gKlxuICogQHBhcmFtIHYgdGhlIHZlY3RvciB0byBzdWJ0cmFjdCB3aXRoXG4gKi9cblZlY3RvcjMucHJvdG90eXBlLnN1YnRyYWN0ID0gZnVuY3Rpb24odikge1xuICB0aGlzLnggLT0gdi54O1xuICB0aGlzLnkgLT0gdi55O1xuICB0aGlzLnogLT0gdi56O1xufTtcblxuLyoqXG4gKiBNdWx0aXBseSB0aGUgZ2l2ZW4gUXVhdGVybmlvbiB3aXRoIHRoaXMgdmVjdG9yLlxuICpcbiAqIEBwYXJhbSBxIC0gdGhlIHF1YXRlcm5pb24gdG8gbXVsdGlwbHkgd2l0aFxuICovXG5WZWN0b3IzLnByb3RvdHlwZS5tdWx0aXBseVF1YXRlcm5pb24gPSBmdW5jdGlvbihxKSB7XG4gIHZhciBpeCA9IHEudyAqIHRoaXMueCArIHEueSAqIHRoaXMueiAtIHEueiAqIHRoaXMueTtcbiAgdmFyIGl5ID0gcS53ICogdGhpcy55ICsgcS56ICogdGhpcy54IC0gcS54ICogdGhpcy56O1xuICB2YXIgaXogPSBxLncgKiB0aGlzLnogKyBxLnggKiB0aGlzLnkgLSBxLnkgKiB0aGlzLng7XG4gIHZhciBpdyA9IC1xLnggKiB0aGlzLnggLSBxLnkgKiB0aGlzLnkgLSBxLnogKiB0aGlzLno7XG4gIHRoaXMueCA9IGl4ICogcS53ICsgaXcgKiAtcS54ICsgaXkgKiAtcS56IC0gaXogKiAtcS55O1xuICB0aGlzLnkgPSBpeSAqIHEudyArIGl3ICogLXEueSArIGl6ICogLXEueCAtIGl4ICogLXEuejtcbiAgdGhpcy56ID0gaXogKiBxLncgKyBpdyAqIC1xLnogKyBpeCAqIC1xLnkgLSBpeSAqIC1xLng7XG59O1xuXG4vKipcbiAqIENsb25lIGEgY29weSBvZiB0aGlzIHZlY3Rvci5cbiAqXG4gKiBAcmV0dXJucyB0aGUgY2xvbmVkIHZlY3RvclxuICovXG5WZWN0b3IzLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbmV3IFZlY3RvcjModGhpcyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFZlY3RvcjM7IiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgUG9zZTogcmVxdWlyZSgnLi9Qb3NlJyksXG4gICAgUXVhdGVybmlvbjogcmVxdWlyZSgnLi9RdWF0ZXJuaW9uJyksXG4gICAgVHJhbnNmb3JtOiByZXF1aXJlKCcuL1RyYW5zZm9ybScpLFxuICAgIFZlY3RvcjM6IHJlcXVpcmUoJy4vVmVjdG9yMycpXG59O1xuIiwiLyoqXG4gKiBNaXhpbiBhIGZlYXR1cmUgdG8gdGhlIGNvcmUvUm9zIHByb3RvdHlwZS5cbiAqIEZvciBleGFtcGxlLCBtaXhpbihSb3MsIFsnVG9waWMnXSwge1RvcGljOiA8VG9waWM+fSlcbiAqIHdpbGwgYWRkIGEgdG9waWMgYm91bmQgdG8gYW55IFJvcyBpbnN0YW5jZXMgc28gYSB1c2VyXG4gKiBjYW4gY2FsbCBgdmFyIHRvcGljID0gcm9zLlRvcGljKHtuYW1lOiAnL2Zvbyd9KTtgXG4gKlxuICogQGF1dGhvciBHcmFlbWUgWWVhdGVzIC0gZ2l0aHViLmNvbS9tZWdhd2FjXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oUm9zLCBjbGFzc2VzLCBmZWF0dXJlcykge1xuICAgIGNsYXNzZXMuZm9yRWFjaChmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgICAgICAgdmFyIENsYXNzID0gZmVhdHVyZXNbY2xhc3NOYW1lXTtcbiAgICAgICAgUm9zLnByb3RvdHlwZVtjbGFzc05hbWVdID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICAgICAgb3B0aW9ucy5yb3MgPSB0aGlzO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBDbGFzcyhvcHRpb25zKTtcbiAgICAgICAgfTtcbiAgICB9KTtcbn07XG4iLCIvKipcbiAqIEBmaWxlb3ZlcnZpZXdcbiAqIEBhdXRob3IgRGF2aWQgR29zc293IC0gZGdvc3Nvd0B3aWxsb3dnYXJhZ2UuY29tXG4gKi9cblxudmFyIEFjdGlvbkNsaWVudCA9IHJlcXVpcmUoJy4uL2FjdGlvbmxpYi9BY3Rpb25DbGllbnQnKTtcbnZhciBHb2FsID0gcmVxdWlyZSgnLi4vYWN0aW9ubGliL0dvYWwnKTtcblxudmFyIFNlcnZpY2UgPSByZXF1aXJlKCcuLi9jb3JlL1NlcnZpY2UuanMnKTtcbnZhciBTZXJ2aWNlUmVxdWVzdCA9IHJlcXVpcmUoJy4uL2NvcmUvU2VydmljZVJlcXVlc3QuanMnKTtcblxudmFyIFRyYW5zZm9ybSA9IHJlcXVpcmUoJy4uL21hdGgvVHJhbnNmb3JtJyk7XG5cbi8qKlxuICogQSBURiBDbGllbnQgdGhhdCBsaXN0ZW5zIHRvIFRGcyBmcm9tIHRmMl93ZWJfcmVwdWJsaXNoZXIuXG4gKlxuICogIEBjb25zdHJ1Y3RvclxuICogIEBwYXJhbSBvcHRpb25zIC0gb2JqZWN0IHdpdGggZm9sbG93aW5nIGtleXM6XG4gKiAgICogcm9zIC0gdGhlIFJPU0xJQi5Sb3MgY29ubmVjdGlvbiBoYW5kbGVcbiAqICAgKiBmaXhlZEZyYW1lIC0gdGhlIGZpeGVkIGZyYW1lLCBsaWtlIC9iYXNlX2xpbmtcbiAqICAgKiBhbmd1bGFyVGhyZXMgLSB0aGUgYW5ndWxhciB0aHJlc2hvbGQgZm9yIHRoZSBURiByZXB1Ymxpc2hlclxuICogICAqIHRyYW5zVGhyZXMgLSB0aGUgdHJhbnNsYXRpb24gdGhyZXNob2xkIGZvciB0aGUgVEYgcmVwdWJsaXNoZXJcbiAqICAgKiByYXRlIC0gdGhlIHJhdGUgZm9yIHRoZSBURiByZXB1Ymxpc2hlclxuICogICAqIHVwZGF0ZURlbGF5IC0gdGhlIHRpbWUgKGluIG1zKSB0byB3YWl0IGFmdGVyIGEgbmV3IHN1YnNjcmlwdGlvblxuICogICAgICAgICAgICAgICAgICAgdG8gdXBkYXRlIHRoZSBURiByZXB1Ymxpc2hlcidzIGxpc3Qgb2YgVEZzXG4gKiAgICogdG9waWNUaW1lb3V0IC0gdGhlIHRpbWVvdXQgcGFyYW1ldGVyIGZvciB0aGUgVEYgcmVwdWJsaXNoZXJcbiAqICAgKiBzZXJ2ZXJOYW1lIChvcHRpb25hbCkgLSB0aGUgbmFtZSBvZiB0aGUgdGYyX3dlYl9yZXB1Ymxpc2hlciBzZXJ2ZXJcbiAqICAgKiByZXB1YlNlcnZpY2VOYW1lIChvcHRpb25hbCkgLSB0aGUgbmFtZSBvZiB0aGUgcmVwdWJsaXNoX3RmcyBzZXJ2aWNlIChub24gZ3Jvb3Z5IGNvbXBhdGliaWxpdHkgbW9kZSBvbmx5KVxuICogICBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCBkZWZhdWx0OiAnL3JlcHVibGlzaF90ZnMnXG4gKi9cbmZ1bmN0aW9uIFRGQ2xpZW50KG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHRoaXMucm9zID0gb3B0aW9ucy5yb3M7XG4gIHRoaXMuZml4ZWRGcmFtZSA9IG9wdGlvbnMuZml4ZWRGcmFtZSB8fCAnL2Jhc2VfbGluayc7XG4gIHRoaXMuYW5ndWxhclRocmVzID0gb3B0aW9ucy5hbmd1bGFyVGhyZXMgfHwgMi4wO1xuICB0aGlzLnRyYW5zVGhyZXMgPSBvcHRpb25zLnRyYW5zVGhyZXMgfHwgMC4wMTtcbiAgdGhpcy5yYXRlID0gb3B0aW9ucy5yYXRlIHx8IDEwLjA7XG4gIHRoaXMudXBkYXRlRGVsYXkgPSBvcHRpb25zLnVwZGF0ZURlbGF5IHx8IDUwO1xuICB2YXIgc2Vjb25kcyA9IG9wdGlvbnMudG9waWNUaW1lb3V0IHx8IDIuMDtcbiAgdmFyIHNlY3MgPSBNYXRoLmZsb29yKHNlY29uZHMpO1xuICB2YXIgbnNlY3MgPSBNYXRoLmZsb29yKChzZWNvbmRzIC0gc2VjcykgKiAxMDAwMDAwMDAwKTtcbiAgdGhpcy50b3BpY1RpbWVvdXQgPSB7XG4gICAgc2Vjczogc2VjcyxcbiAgICBuc2VjczogbnNlY3NcbiAgfTtcbiAgdGhpcy5zZXJ2ZXJOYW1lID0gb3B0aW9ucy5zZXJ2ZXJOYW1lIHx8ICcvdGYyX3dlYl9yZXB1Ymxpc2hlcic7XG4gIHRoaXMucmVwdWJTZXJ2aWNlTmFtZSA9IG9wdGlvbnMucmVwdWJTZXJ2aWNlTmFtZSB8fCAnL3JlcHVibGlzaF90ZnMnO1xuXG4gIHRoaXMuY3VycmVudEdvYWwgPSBmYWxzZTtcbiAgdGhpcy5jdXJyZW50VG9waWMgPSBmYWxzZTtcbiAgdGhpcy5mcmFtZUluZm9zID0ge307XG4gIHRoaXMucmVwdWJsaXNoZXJVcGRhdGVSZXF1ZXN0ZWQgPSBmYWxzZTtcblxuICAvLyBDcmVhdGUgYW4gQWN0aW9uIGNsaWVudFxuICB0aGlzLmFjdGlvbkNsaWVudCA9IHRoaXMucm9zLkFjdGlvbkNsaWVudCh7XG4gICAgc2VydmVyTmFtZSA6IHRoaXMuc2VydmVyTmFtZSxcbiAgICBhY3Rpb25OYW1lIDogJ3RmMl93ZWJfcmVwdWJsaXNoZXIvVEZTdWJzY3JpcHRpb25BY3Rpb24nLFxuICAgIG9taXRTdGF0dXMgOiB0cnVlLFxuICAgIG9taXRSZXN1bHQgOiB0cnVlXG4gIH0pO1xuXG4gIC8vIENyZWF0ZSBhIFNlcnZpY2UgY2xpZW50XG4gIHRoaXMuc2VydmljZUNsaWVudCA9IHRoaXMucm9zLlNlcnZpY2Uoe1xuICAgIG5hbWU6IHRoaXMucmVwdWJTZXJ2aWNlTmFtZSxcbiAgICBzZXJ2aWNlVHlwZTogJ3RmMl93ZWJfcmVwdWJsaXNoZXIvUmVwdWJsaXNoVEZzJ1xuICB9KTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIHRoZSBpbmNvbWluZyBURiBtZXNzYWdlIGFuZCBzZW5kIHRoZW0gb3V0IHVzaW5nIHRoZSBjYWxsYmFja1xuICogZnVuY3Rpb25zLlxuICpcbiAqIEBwYXJhbSB0ZiAtIHRoZSBURiBtZXNzYWdlIGZyb20gdGhlIHNlcnZlclxuICovXG5URkNsaWVudC5wcm90b3R5cGUucHJvY2Vzc1RGQXJyYXkgPSBmdW5jdGlvbih0Zikge1xuICB2YXIgdGhhdCA9IHRoaXM7XG4gIHRmLnRyYW5zZm9ybXMuZm9yRWFjaChmdW5jdGlvbih0cmFuc2Zvcm0pIHtcbiAgICB2YXIgZnJhbWVJRCA9IHRyYW5zZm9ybS5jaGlsZF9mcmFtZV9pZDtcbiAgICBpZiAoZnJhbWVJRFswXSA9PT0gJy8nKVxuICAgIHtcbiAgICAgIGZyYW1lSUQgPSBmcmFtZUlELnN1YnN0cmluZygxKTtcbiAgICB9XG4gICAgdmFyIGluZm8gPSB0aGlzLmZyYW1lSW5mb3NbZnJhbWVJRF07XG4gICAgaWYgKGluZm8pIHtcbiAgICAgIGluZm8udHJhbnNmb3JtID0gbmV3IFRyYW5zZm9ybSh7XG4gICAgICAgIHRyYW5zbGF0aW9uIDogdHJhbnNmb3JtLnRyYW5zZm9ybS50cmFuc2xhdGlvbixcbiAgICAgICAgcm90YXRpb24gOiB0cmFuc2Zvcm0udHJhbnNmb3JtLnJvdGF0aW9uXG4gICAgICB9KTtcbiAgICAgIGluZm8uY2JzLmZvckVhY2goZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgY2IoaW5mby50cmFuc2Zvcm0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9LCB0aGlzKTtcbn07XG5cbi8qKlxuICogQ3JlYXRlIGFuZCBzZW5kIGEgbmV3IGdvYWwgKG9yIHNlcnZpY2UgcmVxdWVzdCkgdG8gdGhlIHRmMl93ZWJfcmVwdWJsaXNoZXJcbiAqIGJhc2VkIG9uIHRoZSBjdXJyZW50IGxpc3Qgb2YgVEZzLlxuICovXG5URkNsaWVudC5wcm90b3R5cGUudXBkYXRlR29hbCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgZ29hbE1lc3NhZ2UgPSB7XG4gICAgc291cmNlX2ZyYW1lcyA6IE9iamVjdC5rZXlzKHRoaXMuZnJhbWVJbmZvcyksXG4gICAgdGFyZ2V0X2ZyYW1lIDogdGhpcy5maXhlZEZyYW1lLFxuICAgIGFuZ3VsYXJfdGhyZXMgOiB0aGlzLmFuZ3VsYXJUaHJlcyxcbiAgICB0cmFuc190aHJlcyA6IHRoaXMudHJhbnNUaHJlcyxcbiAgICByYXRlIDogdGhpcy5yYXRlXG4gIH07XG5cbiAgLy8gaWYgd2UncmUgcnVubmluZyBpbiBncm9vdnkgY29tcGF0aWJpbGl0eSBtb2RlICh0aGUgZGVmYXVsdClcbiAgLy8gdGhlbiB1c2UgdGhlIGFjdGlvbiBpbnRlcmZhY2UgdG8gdGYyX3dlYl9yZXB1Ymxpc2hlclxuICBpZih0aGlzLnJvcy5ncm9vdnlDb21wYXRpYmlsaXR5KSB7XG4gICAgaWYgKHRoaXMuY3VycmVudEdvYWwpIHtcbiAgICAgIHRoaXMuY3VycmVudEdvYWwuY2FuY2VsKCk7XG4gICAgfVxuICAgIHRoaXMuY3VycmVudEdvYWwgPSBuZXcgR29hbCh7XG4gICAgICBhY3Rpb25DbGllbnQgOiB0aGlzLmFjdGlvbkNsaWVudCxcbiAgICAgIGdvYWxNZXNzYWdlIDogZ29hbE1lc3NhZ2VcbiAgICB9KTtcblxuICAgIHRoaXMuY3VycmVudEdvYWwub24oJ2ZlZWRiYWNrJywgdGhpcy5wcm9jZXNzVEZBcnJheS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLmN1cnJlbnRHb2FsLnNlbmQoKTtcbiAgfVxuICBlbHNlIHtcbiAgICAvLyBvdGhlcndpc2UsIHVzZSB0aGUgc2VydmljZSBpbnRlcmZhY2VcbiAgICAvLyBUaGUgc2VydmljZSBpbnRlcmZhY2UgaGFzIHRoZSBzYW1lIHBhcmFtZXRlcnMgYXMgdGhlIGFjdGlvbixcbiAgICAvLyBwbHVzIHRoZSB0aW1lb3V0XG4gICAgZ29hbE1lc3NhZ2UudGltZW91dCA9IHRoaXMudG9waWNUaW1lb3V0O1xuICAgIHZhciByZXF1ZXN0ID0gbmV3IFNlcnZpY2VSZXF1ZXN0KGdvYWxNZXNzYWdlKTtcblxuICAgIHRoaXMuc2VydmljZUNsaWVudC5jYWxsU2VydmljZShyZXF1ZXN0LCB0aGlzLnByb2Nlc3NSZXNwb25zZS5iaW5kKHRoaXMpKTtcbiAgfVxuXG4gIHRoaXMucmVwdWJsaXNoZXJVcGRhdGVSZXF1ZXN0ZWQgPSBmYWxzZTtcbn07XG5cbi8qKlxuICogUHJvY2VzcyB0aGUgc2VydmljZSByZXNwb25zZSBhbmQgc3Vic2NyaWJlIHRvIHRoZSB0ZiByZXB1Ymxpc2hlclxuICogdG9waWNcbiAqXG4gKiBAcGFyYW0gcmVzcG9uc2UgdGhlIHNlcnZpY2UgcmVzcG9uc2UgY29udGFpbmluZyB0aGUgdG9waWMgbmFtZVxuICovXG5URkNsaWVudC5wcm90b3R5cGUucHJvY2Vzc1Jlc3BvbnNlID0gZnVuY3Rpb24ocmVzcG9uc2UpIHtcbiAgLy8gaWYgd2Ugc3Vic2NyaWJlZCB0byBhIHRvcGljIGJlZm9yZSwgdW5zdWJzY3JpYmUgc29cbiAgLy8gdGhlIHJlcHVibGlzaGVyIHN0b3BzIHB1Ymxpc2hpbmcgaXRcbiAgaWYgKHRoaXMuY3VycmVudFRvcGljKSB7XG4gICAgdGhpcy5jdXJyZW50VG9waWMudW5zdWJzY3JpYmUoKTtcbiAgfVxuXG4gIHRoaXMuY3VycmVudFRvcGljID0gdGhpcy5yb3MuVG9waWMoe1xuICAgIG5hbWU6IHJlc3BvbnNlLnRvcGljX25hbWUsXG4gICAgbWVzc2FnZVR5cGU6ICd0ZjJfd2ViX3JlcHVibGlzaGVyL1RGQXJyYXknXG4gIH0pO1xuICB0aGlzLmN1cnJlbnRUb3BpYy5zdWJzY3JpYmUodGhpcy5wcm9jZXNzVEZBcnJheS5iaW5kKHRoaXMpKTtcbn07XG5cbi8qKlxuICogU3Vic2NyaWJlIHRvIHRoZSBnaXZlbiBURiBmcmFtZS5cbiAqXG4gKiBAcGFyYW0gZnJhbWVJRCAtIHRoZSBURiBmcmFtZSB0byBzdWJzY3JpYmUgdG9cbiAqIEBwYXJhbSBjYWxsYmFjayAtIGZ1bmN0aW9uIHdpdGggcGFyYW1zOlxuICogICAqIHRyYW5zZm9ybSAtIHRoZSB0cmFuc2Zvcm0gZGF0YVxuICovXG5URkNsaWVudC5wcm90b3R5cGUuc3Vic2NyaWJlID0gZnVuY3Rpb24oZnJhbWVJRCwgY2FsbGJhY2spIHtcbiAgLy8gcmVtb3ZlIGxlYWRpbmcgc2xhc2gsIGlmIGl0J3MgdGhlcmVcbiAgaWYgKGZyYW1lSURbMF0gPT09ICcvJylcbiAge1xuICAgIGZyYW1lSUQgPSBmcmFtZUlELnN1YnN0cmluZygxKTtcbiAgfVxuICAvLyBpZiB0aGVyZSBpcyBubyBjYWxsYmFjayByZWdpc3RlcmVkIGZvciB0aGUgZ2l2ZW4gZnJhbWUsIGNyZWF0ZSBlbXRweSBjYWxsYmFjayBsaXN0XG4gIGlmICghdGhpcy5mcmFtZUluZm9zW2ZyYW1lSURdKSB7XG4gICAgdGhpcy5mcmFtZUluZm9zW2ZyYW1lSURdID0ge1xuICAgICAgY2JzOiBbXVxuICAgIH07XG4gICAgaWYgKCF0aGlzLnJlcHVibGlzaGVyVXBkYXRlUmVxdWVzdGVkKSB7XG4gICAgICBzZXRUaW1lb3V0KHRoaXMudXBkYXRlR29hbC5iaW5kKHRoaXMpLCB0aGlzLnVwZGF0ZURlbGF5KTtcbiAgICAgIHRoaXMucmVwdWJsaXNoZXJVcGRhdGVSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgIH1cbiAgfVxuICAvLyBpZiB3ZSBhbHJlYWR5IGhhdmUgYSB0cmFuc2Zvcm0sIGNhbGwgYmFjayBpbW1lZGlhdGVseVxuICBlbHNlIGlmICh0aGlzLmZyYW1lSW5mb3NbZnJhbWVJRF0udHJhbnNmb3JtKSB7XG4gICAgY2FsbGJhY2sodGhpcy5mcmFtZUluZm9zW2ZyYW1lSURdLnRyYW5zZm9ybSk7XG4gIH1cbiAgdGhpcy5mcmFtZUluZm9zW2ZyYW1lSURdLmNicy5wdXNoKGNhbGxiYWNrKTtcbn07XG5cbi8qKlxuICogVW5zdWJzY3JpYmUgZnJvbSB0aGUgZ2l2ZW4gVEYgZnJhbWUuXG4gKlxuICogQHBhcmFtIGZyYW1lSUQgLSB0aGUgVEYgZnJhbWUgdG8gdW5zdWJzY3JpYmUgZnJvbVxuICogQHBhcmFtIGNhbGxiYWNrIC0gdGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIHJlbW92ZVxuICovXG5URkNsaWVudC5wcm90b3R5cGUudW5zdWJzY3JpYmUgPSBmdW5jdGlvbihmcmFtZUlELCBjYWxsYmFjaykge1xuICAvLyByZW1vdmUgbGVhZGluZyBzbGFzaCwgaWYgaXQncyB0aGVyZVxuICBpZiAoZnJhbWVJRFswXSA9PT0gJy8nKVxuICB7XG4gICAgZnJhbWVJRCA9IGZyYW1lSUQuc3Vic3RyaW5nKDEpO1xuICB9XG4gIHZhciBpbmZvID0gdGhpcy5mcmFtZUluZm9zW2ZyYW1lSURdO1xuICBmb3IgKHZhciBjYnMgPSBpbmZvICYmIGluZm8uY2JzIHx8IFtdLCBpZHggPSBjYnMubGVuZ3RoOyBpZHgtLTspIHtcbiAgICBpZiAoY2JzW2lkeF0gPT09IGNhbGxiYWNrKSB7XG4gICAgICBjYnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgfVxuICB9XG4gIGlmICghY2FsbGJhY2sgfHwgY2JzLmxlbmd0aCA9PT0gMCkge1xuICAgIGRlbGV0ZSB0aGlzLmZyYW1lSW5mb3NbZnJhbWVJRF07XG4gIH1cbn07XG5cbi8qKlxuICogVW5zdWJzY3JpYmUgYW5kIHVuYWR2ZXJ0aXNlIGFsbCB0b3BpY3MgYXNzb2NpYXRlZCB3aXRoIHRoaXMgVEZDbGllbnQuXG4gKi9cblRGQ2xpZW50LnByb3RvdHlwZS5kaXNwb3NlID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuYWN0aW9uQ2xpZW50LmRpc3Bvc2UoKTtcbiAgaWYgKHRoaXMuY3VycmVudFRvcGljKSB7XG4gICAgdGhpcy5jdXJyZW50VG9waWMudW5zdWJzY3JpYmUoKTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBURkNsaWVudDtcbiIsInZhciBSb3MgPSByZXF1aXJlKCcuLi9jb3JlL1JvcycpO1xudmFyIG1peGluID0gcmVxdWlyZSgnLi4vbWl4aW4nKTtcblxudmFyIHRmID0gbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgVEZDbGllbnQ6IHJlcXVpcmUoJy4vVEZDbGllbnQnKVxufTtcblxubWl4aW4oUm9zLCBbJ1RGQ2xpZW50J10sIHRmKTsiLCIvKipcbiAqIEBmaWxlT3ZlcnZpZXcgXG4gKiBAYXV0aG9yIEJlbmphbWluIFBpdHplciAtIGJlbi5waXR6ZXJAZ21haWwuY29tXG4gKiBAYXV0aG9yIFJ1c3NlbGwgVG9yaXMgLSByY3RvcmlzQHdwaS5lZHVcbiAqL1xuXG52YXIgVmVjdG9yMyA9IHJlcXVpcmUoJy4uL21hdGgvVmVjdG9yMycpO1xudmFyIFVyZGZUeXBlcyA9IHJlcXVpcmUoJy4vVXJkZlR5cGVzJyk7XG5cbi8qKlxuICogQSBCb3ggZWxlbWVudCBpbiBhIFVSREYuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gb3B0aW9ucyAtIG9iamVjdCB3aXRoIGZvbGxvd2luZyBrZXlzOlxuICogICogeG1sIC0gdGhlIFhNTCBlbGVtZW50IHRvIHBhcnNlXG4gKi9cbmZ1bmN0aW9uIFVyZGZCb3gob3B0aW9ucykge1xuICB0aGlzLmRpbWVuc2lvbiA9IG51bGw7XG4gIHRoaXMudHlwZSA9IFVyZGZUeXBlcy5VUkRGX0JPWDtcblxuICAvLyBQYXJzZSB0aGUgeG1sIHN0cmluZ1xuICB2YXIgeHl6ID0gb3B0aW9ucy54bWwuZ2V0QXR0cmlidXRlKCdzaXplJykuc3BsaXQoJyAnKTtcbiAgdGhpcy5kaW1lbnNpb24gPSBuZXcgVmVjdG9yMyh7XG4gICAgeCA6IHBhcnNlRmxvYXQoeHl6WzBdKSxcbiAgICB5IDogcGFyc2VGbG9hdCh4eXpbMV0pLFxuICAgIHogOiBwYXJzZUZsb2F0KHh5elsyXSlcbiAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVXJkZkJveDsiLCIvKipcbiAqIEBmaWxlT3ZlcnZpZXcgXG4gKiBAYXV0aG9yIEJlbmphbWluIFBpdHplciAtIGJlbi5waXR6ZXJAZ21haWwuY29tXG4gKiBAYXV0aG9yIFJ1c3NlbGwgVG9yaXMgLSByY3RvcmlzQHdwaS5lZHVcbiAqL1xuXG4vKipcbiAqIEEgQ29sb3IgZWxlbWVudCBpbiBhIFVSREYuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gb3B0aW9ucyAtIG9iamVjdCB3aXRoIGZvbGxvd2luZyBrZXlzOlxuICogICogeG1sIC0gdGhlIFhNTCBlbGVtZW50IHRvIHBhcnNlXG4gKi9cbmZ1bmN0aW9uIFVyZGZDb2xvcihvcHRpb25zKSB7XG4gIC8vIFBhcnNlIHRoZSB4bWwgc3RyaW5nXG4gIHZhciByZ2JhID0gb3B0aW9ucy54bWwuZ2V0QXR0cmlidXRlKCdyZ2JhJykuc3BsaXQoJyAnKTtcbiAgdGhpcy5yID0gcGFyc2VGbG9hdChyZ2JhWzBdKTtcbiAgdGhpcy5nID0gcGFyc2VGbG9hdChyZ2JhWzFdKTtcbiAgdGhpcy5iID0gcGFyc2VGbG9hdChyZ2JhWzJdKTtcbiAgdGhpcy5hID0gcGFyc2VGbG9hdChyZ2JhWzNdKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBVcmRmQ29sb3I7IiwiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3IFxuICogQGF1dGhvciBCZW5qYW1pbiBQaXR6ZXIgLSBiZW4ucGl0emVyQGdtYWlsLmNvbVxuICogQGF1dGhvciBSdXNzZWxsIFRvcmlzIC0gcmN0b3Jpc0B3cGkuZWR1XG4gKi9cblxudmFyIFVyZGZUeXBlcyA9IHJlcXVpcmUoJy4vVXJkZlR5cGVzJyk7XG5cbi8qKlxuICogQSBDeWxpbmRlciBlbGVtZW50IGluIGEgVVJERi5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSBvcHRpb25zIC0gb2JqZWN0IHdpdGggZm9sbG93aW5nIGtleXM6XG4gKiAgKiB4bWwgLSB0aGUgWE1MIGVsZW1lbnQgdG8gcGFyc2VcbiAqL1xuZnVuY3Rpb24gVXJkZkN5bGluZGVyKG9wdGlvbnMpIHtcbiAgdGhpcy50eXBlID0gVXJkZlR5cGVzLlVSREZfQ1lMSU5ERVI7XG4gIHRoaXMubGVuZ3RoID0gcGFyc2VGbG9hdChvcHRpb25zLnhtbC5nZXRBdHRyaWJ1dGUoJ2xlbmd0aCcpKTtcbiAgdGhpcy5yYWRpdXMgPSBwYXJzZUZsb2F0KG9wdGlvbnMueG1sLmdldEF0dHJpYnV0ZSgncmFkaXVzJykpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFVyZGZDeWxpbmRlcjsiLCIvKipcbiAqIEBmaWxlT3ZlcnZpZXdcbiAqIEBhdXRob3IgRGF2aWQgVi4gTHUhISAgZGF2aWR2bHVAZ21haWwuY29tXG4gKi9cblxuLyoqXG4gKiBBIEpvaW50IGVsZW1lbnQgaW4gYSBVUkRGLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIG9wdGlvbnMgLSBvYmplY3Qgd2l0aCBmb2xsb3dpbmcga2V5czpcbiAqICAqIHhtbCAtIHRoZSBYTUwgZWxlbWVudCB0byBwYXJzZVxuICovXG5mdW5jdGlvbiBVcmRmSm9pbnQob3B0aW9ucykge1xuICB0aGlzLm5hbWUgPSBvcHRpb25zLnhtbC5nZXRBdHRyaWJ1dGUoJ25hbWUnKTtcbiAgdGhpcy50eXBlID0gb3B0aW9ucy54bWwuZ2V0QXR0cmlidXRlKCd0eXBlJyk7XG5cbiAgdmFyIHBhcmVudHMgPSBvcHRpb25zLnhtbC5nZXRFbGVtZW50c0J5VGFnTmFtZSgncGFyZW50Jyk7XG4gIGlmKHBhcmVudHMubGVuZ3RoID4gMCkge1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50c1swXS5nZXRBdHRyaWJ1dGUoJ2xpbmsnKTtcbiAgfVxuXG4gIHZhciBjaGlsZHJlbiA9IG9wdGlvbnMueG1sLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdjaGlsZCcpO1xuICBpZihjaGlsZHJlbi5sZW5ndGggPiAwKSB7XG4gICAgdGhpcy5jaGlsZCA9IGNoaWxkcmVuWzBdLmdldEF0dHJpYnV0ZSgnbGluaycpO1xuICB9XG5cbiAgdmFyIGxpbWl0cyA9IG9wdGlvbnMueG1sLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdsaW1pdCcpO1xuICBpZiAobGltaXRzLmxlbmd0aCA+IDApIHtcbiAgICB0aGlzLm1pbnZhbCA9IHBhcnNlRmxvYXQoIGxpbWl0c1swXS5nZXRBdHRyaWJ1dGUoJ2xvd2VyJykgKTtcbiAgICB0aGlzLm1heHZhbCA9IHBhcnNlRmxvYXQoIGxpbWl0c1swXS5nZXRBdHRyaWJ1dGUoJ3VwcGVyJykgKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFVyZGZKb2ludDtcbiIsIi8qKlxuICogQGZpbGVPdmVydmlldyBcbiAqIEBhdXRob3IgQmVuamFtaW4gUGl0emVyIC0gYmVuLnBpdHplckBnbWFpbC5jb21cbiAqIEBhdXRob3IgUnVzc2VsbCBUb3JpcyAtIHJjdG9yaXNAd3BpLmVkdVxuICovXG5cbnZhciBVcmRmVmlzdWFsID0gcmVxdWlyZSgnLi9VcmRmVmlzdWFsJyk7XG5cbi8qKlxuICogQSBMaW5rIGVsZW1lbnQgaW4gYSBVUkRGLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIG9wdGlvbnMgLSBvYmplY3Qgd2l0aCBmb2xsb3dpbmcga2V5czpcbiAqICAqIHhtbCAtIHRoZSBYTUwgZWxlbWVudCB0byBwYXJzZVxuICovXG5mdW5jdGlvbiBVcmRmTGluayhvcHRpb25zKSB7XG4gIHRoaXMubmFtZSA9IG9wdGlvbnMueG1sLmdldEF0dHJpYnV0ZSgnbmFtZScpO1xuICB0aGlzLnZpc3VhbHMgPSBbXTtcbiAgdmFyIHZpc3VhbHMgPSBvcHRpb25zLnhtbC5nZXRFbGVtZW50c0J5VGFnTmFtZSgndmlzdWFsJyk7XG5cbiAgZm9yKCB2YXIgaT0wOyBpPHZpc3VhbHMubGVuZ3RoOyBpKysgKSB7XG4gICAgdGhpcy52aXN1YWxzLnB1c2goIG5ldyBVcmRmVmlzdWFsKHtcbiAgICAgIHhtbCA6IHZpc3VhbHNbaV1cbiAgICB9KSApO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVXJkZkxpbms7IiwiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3IFxuICogQGF1dGhvciBCZW5qYW1pbiBQaXR6ZXIgLSBiZW4ucGl0emVyQGdtYWlsLmNvbVxuICogQGF1dGhvciBSdXNzZWxsIFRvcmlzIC0gcmN0b3Jpc0B3cGkuZWR1XG4gKi9cblxudmFyIFVyZGZDb2xvciA9IHJlcXVpcmUoJy4vVXJkZkNvbG9yJyk7XG5cbi8qKlxuICogQSBNYXRlcmlhbCBlbGVtZW50IGluIGEgVVJERi5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSBvcHRpb25zIC0gb2JqZWN0IHdpdGggZm9sbG93aW5nIGtleXM6XG4gKiAgKiB4bWwgLSB0aGUgWE1MIGVsZW1lbnQgdG8gcGFyc2VcbiAqL1xuZnVuY3Rpb24gVXJkZk1hdGVyaWFsKG9wdGlvbnMpIHtcbiAgdGhpcy50ZXh0dXJlRmlsZW5hbWUgPSBudWxsO1xuICB0aGlzLmNvbG9yID0gbnVsbDtcblxuICB0aGlzLm5hbWUgPSBvcHRpb25zLnhtbC5nZXRBdHRyaWJ1dGUoJ25hbWUnKTtcblxuICAvLyBUZXh0dXJlXG4gIHZhciB0ZXh0dXJlcyA9IG9wdGlvbnMueG1sLmdldEVsZW1lbnRzQnlUYWdOYW1lKCd0ZXh0dXJlJyk7XG4gIGlmICh0ZXh0dXJlcy5sZW5ndGggPiAwKSB7XG4gICAgdGhpcy50ZXh0dXJlRmlsZW5hbWUgPSB0ZXh0dXJlc1swXS5nZXRBdHRyaWJ1dGUoJ2ZpbGVuYW1lJyk7XG4gIH1cblxuICAvLyBDb2xvclxuICB2YXIgY29sb3JzID0gb3B0aW9ucy54bWwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2NvbG9yJyk7XG4gIGlmIChjb2xvcnMubGVuZ3RoID4gMCkge1xuICAgIC8vIFBhcnNlIHRoZSBSQkdBIHN0cmluZ1xuICAgIHRoaXMuY29sb3IgPSBuZXcgVXJkZkNvbG9yKHtcbiAgICAgIHhtbCA6IGNvbG9yc1swXVxuICAgIH0pO1xuICB9XG59XG5cblVyZGZNYXRlcmlhbC5wcm90b3R5cGUuaXNMaW5rID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLmNvbG9yID09PSBudWxsICYmIHRoaXMudGV4dHVyZUZpbGVuYW1lID09PSBudWxsO1xufTtcblxudmFyIGFzc2lnbiA9IHJlcXVpcmUoJ29iamVjdC1hc3NpZ24nKTtcblxuVXJkZk1hdGVyaWFsLnByb3RvdHlwZS5hc3NpZ24gPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gYXNzaWduKHRoaXMsIG9iaik7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVyZGZNYXRlcmlhbDtcbiIsIi8qKlxuICogQGZpbGVPdmVydmlldyBcbiAqIEBhdXRob3IgQmVuamFtaW4gUGl0emVyIC0gYmVuLnBpdHplckBnbWFpbC5jb21cbiAqIEBhdXRob3IgUnVzc2VsbCBUb3JpcyAtIHJjdG9yaXNAd3BpLmVkdVxuICovXG5cbnZhciBWZWN0b3IzID0gcmVxdWlyZSgnLi4vbWF0aC9WZWN0b3IzJyk7XG52YXIgVXJkZlR5cGVzID0gcmVxdWlyZSgnLi9VcmRmVHlwZXMnKTtcblxuLyoqXG4gKiBBIE1lc2ggZWxlbWVudCBpbiBhIFVSREYuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gb3B0aW9ucyAtIG9iamVjdCB3aXRoIGZvbGxvd2luZyBrZXlzOlxuICogICogeG1sIC0gdGhlIFhNTCBlbGVtZW50IHRvIHBhcnNlXG4gKi9cbmZ1bmN0aW9uIFVyZGZNZXNoKG9wdGlvbnMpIHtcbiAgdGhpcy5zY2FsZSA9IG51bGw7XG5cbiAgdGhpcy50eXBlID0gVXJkZlR5cGVzLlVSREZfTUVTSDtcbiAgdGhpcy5maWxlbmFtZSA9IG9wdGlvbnMueG1sLmdldEF0dHJpYnV0ZSgnZmlsZW5hbWUnKTtcblxuICAvLyBDaGVjayBmb3IgYSBzY2FsZVxuICB2YXIgc2NhbGUgPSBvcHRpb25zLnhtbC5nZXRBdHRyaWJ1dGUoJ3NjYWxlJyk7XG4gIGlmIChzY2FsZSkge1xuICAgIC8vIEdldCB0aGUgWFlaXG4gICAgdmFyIHh5eiA9IHNjYWxlLnNwbGl0KCcgJyk7XG4gICAgdGhpcy5zY2FsZSA9IG5ldyBWZWN0b3IzKHtcbiAgICAgIHggOiBwYXJzZUZsb2F0KHh5elswXSksXG4gICAgICB5IDogcGFyc2VGbG9hdCh4eXpbMV0pLFxuICAgICAgeiA6IHBhcnNlRmxvYXQoeHl6WzJdKVxuICAgIH0pO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVXJkZk1lc2g7IiwiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3IFxuICogQGF1dGhvciBCZW5qYW1pbiBQaXR6ZXIgLSBiZW4ucGl0emVyQGdtYWlsLmNvbVxuICogQGF1dGhvciBSdXNzZWxsIFRvcmlzIC0gcmN0b3Jpc0B3cGkuZWR1XG4gKi9cblxudmFyIFVyZGZNYXRlcmlhbCA9IHJlcXVpcmUoJy4vVXJkZk1hdGVyaWFsJyk7XG52YXIgVXJkZkxpbmsgPSByZXF1aXJlKCcuL1VyZGZMaW5rJyk7XG52YXIgVXJkZkpvaW50ID0gcmVxdWlyZSgnLi9VcmRmSm9pbnQnKTtcbnZhciBET01QYXJzZXIgPSByZXF1aXJlKCd4bWxkb20nKS5ET01QYXJzZXI7XG5cbi8vIFNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9kb2NzL1hQYXRoUmVzdWx0I0NvbnN0YW50c1xudmFyIFhQQVRIX0ZJUlNUX09SREVSRURfTk9ERV9UWVBFID0gOTtcblxuLyoqXG4gKiBBIFVSREYgTW9kZWwgY2FuIGJlIHVzZWQgdG8gcGFyc2UgYSBnaXZlbiBVUkRGIGludG8gdGhlIGFwcHJvcHJpYXRlIGVsZW1lbnRzLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIG9wdGlvbnMgLSBvYmplY3Qgd2l0aCBmb2xsb3dpbmcga2V5czpcbiAqICAqIHhtbCAtIHRoZSBYTUwgZWxlbWVudCB0byBwYXJzZVxuICogICogc3RyaW5nIC0gdGhlIFhNTCBlbGVtZW50IHRvIHBhcnNlIGFzIGEgc3RyaW5nXG4gKi9cbmZ1bmN0aW9uIFVyZGZNb2RlbChvcHRpb25zKSB7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgeG1sRG9jID0gb3B0aW9ucy54bWw7XG4gIHZhciBzdHJpbmcgPSBvcHRpb25zLnN0cmluZztcbiAgdGhpcy5tYXRlcmlhbHMgPSB7fTtcbiAgdGhpcy5saW5rcyA9IHt9O1xuICB0aGlzLmpvaW50cyA9IHt9O1xuXG4gIC8vIENoZWNrIGlmIHdlIGFyZSB1c2luZyBhIHN0cmluZyBvciBhbiBYTUwgZWxlbWVudFxuICBpZiAoc3RyaW5nKSB7XG4gICAgLy8gUGFyc2UgdGhlIHN0cmluZ1xuICAgIHZhciBwYXJzZXIgPSBuZXcgRE9NUGFyc2VyKCk7XG4gICAgeG1sRG9jID0gcGFyc2VyLnBhcnNlRnJvbVN0cmluZyhzdHJpbmcsICd0ZXh0L3htbCcpO1xuICB9XG5cbiAgLy8gSW5pdGlhbGl6ZSB0aGUgbW9kZWwgd2l0aCB0aGUgZ2l2ZW4gWE1MIG5vZGUuXG4gIC8vIEdldCB0aGUgcm9ib3QgdGFnXG4gIHZhciByb2JvdFhtbCA9IHhtbERvYy5kb2N1bWVudEVsZW1lbnQ7XG5cbiAgLy8gR2V0IHRoZSByb2JvdCBuYW1lXG4gIHRoaXMubmFtZSA9IHJvYm90WG1sLmdldEF0dHJpYnV0ZSgnbmFtZScpO1xuXG4gIC8vIFBhcnNlIGFsbCB0aGUgdmlzdWFsIGVsZW1lbnRzIHdlIG5lZWRcbiAgZm9yICh2YXIgbm9kZXMgPSByb2JvdFhtbC5jaGlsZE5vZGVzLCBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG5vZGUgPSBub2Rlc1tpXTtcbiAgICBpZiAobm9kZS50YWdOYW1lID09PSAnbWF0ZXJpYWwnKSB7XG4gICAgICB2YXIgbWF0ZXJpYWwgPSBuZXcgVXJkZk1hdGVyaWFsKHtcbiAgICAgICAgeG1sIDogbm9kZVxuICAgICAgfSk7XG4gICAgICAvLyBNYWtlIHN1cmUgdGhpcyBpcyB1bmlxdWVcbiAgICAgIGlmICh0aGlzLm1hdGVyaWFsc1ttYXRlcmlhbC5uYW1lXSAhPT0gdm9pZCAwKSB7XG4gICAgICAgIGlmKCB0aGlzLm1hdGVyaWFsc1ttYXRlcmlhbC5uYW1lXS5pc0xpbmsoKSApIHtcbiAgICAgICAgICB0aGlzLm1hdGVyaWFsc1ttYXRlcmlhbC5uYW1lXS5hc3NpZ24oIG1hdGVyaWFsICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdNYXRlcmlhbCAnICsgbWF0ZXJpYWwubmFtZSArICdpcyBub3QgdW5pcXVlLicpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm1hdGVyaWFsc1ttYXRlcmlhbC5uYW1lXSA9IG1hdGVyaWFsO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobm9kZS50YWdOYW1lID09PSAnbGluaycpIHtcbiAgICAgIHZhciBsaW5rID0gbmV3IFVyZGZMaW5rKHtcbiAgICAgICAgeG1sIDogbm9kZVxuICAgICAgfSk7XG4gICAgICAvLyBNYWtlIHN1cmUgdGhpcyBpcyB1bmlxdWVcbiAgICAgIGlmICh0aGlzLmxpbmtzW2xpbmsubmFtZV0gIT09IHZvaWQgMCkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ0xpbmsgJyArIGxpbmsubmFtZSArICcgaXMgbm90IHVuaXF1ZS4nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIENoZWNrIGZvciBhIG1hdGVyaWFsXG4gICAgICAgIGZvciggdmFyIGo9MDsgajxsaW5rLnZpc3VhbHMubGVuZ3RoOyBqKysgKVxuICAgICAgICB7XG4gICAgICAgICAgdmFyIG1hdCA9IGxpbmsudmlzdWFsc1tqXS5tYXRlcmlhbDsgXG4gICAgICAgICAgaWYgKCBtYXQgIT09IG51bGwgKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5tYXRlcmlhbHNbbWF0Lm5hbWVdICE9PSB2b2lkIDApIHtcbiAgICAgICAgICAgICAgbGluay52aXN1YWxzW2pdLm1hdGVyaWFsID0gdGhpcy5tYXRlcmlhbHNbbWF0Lm5hbWVdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhpcy5tYXRlcmlhbHNbbWF0Lm5hbWVdID0gbWF0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFkZCB0aGUgbGlua1xuICAgICAgICB0aGlzLmxpbmtzW2xpbmsubmFtZV0gPSBsaW5rO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobm9kZS50YWdOYW1lID09PSAnam9pbnQnKSB7XG4gICAgICB2YXIgam9pbnQgPSBuZXcgVXJkZkpvaW50KHtcbiAgICAgICAgeG1sIDogbm9kZVxuICAgICAgfSk7XG4gICAgICB0aGlzLmpvaW50c1tqb2ludC5uYW1lXSA9IGpvaW50O1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFVyZGZNb2RlbDtcbiIsIi8qKlxuICogQGZpbGVPdmVydmlldyBcbiAqIEBhdXRob3IgQmVuamFtaW4gUGl0emVyIC0gYmVuLnBpdHplckBnbWFpbC5jb21cbiAqIEBhdXRob3IgUnVzc2VsbCBUb3JpcyAtIHJjdG9yaXNAd3BpLmVkdVxuICovXG5cbnZhciBVcmRmVHlwZXMgPSByZXF1aXJlKCcuL1VyZGZUeXBlcycpO1xuXG4vKipcbiAqIEEgU3BoZXJlIGVsZW1lbnQgaW4gYSBVUkRGLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIG9wdGlvbnMgLSBvYmplY3Qgd2l0aCBmb2xsb3dpbmcga2V5czpcbiAqICAqIHhtbCAtIHRoZSBYTUwgZWxlbWVudCB0byBwYXJzZVxuICovXG5mdW5jdGlvbiBVcmRmU3BoZXJlKG9wdGlvbnMpIHtcbiAgdGhpcy50eXBlID0gVXJkZlR5cGVzLlVSREZfU1BIRVJFO1xuICB0aGlzLnJhZGl1cyA9IHBhcnNlRmxvYXQob3B0aW9ucy54bWwuZ2V0QXR0cmlidXRlKCdyYWRpdXMnKSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVXJkZlNwaGVyZTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcblx0VVJERl9TUEhFUkUgOiAwLFxuXHRVUkRGX0JPWCA6IDEsXG5cdFVSREZfQ1lMSU5ERVIgOiAyLFxuXHRVUkRGX01FU0ggOiAzXG59O1xuIiwiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3IFxuICogQGF1dGhvciBCZW5qYW1pbiBQaXR6ZXIgLSBiZW4ucGl0emVyQGdtYWlsLmNvbVxuICogQGF1dGhvciBSdXNzZWxsIFRvcmlzIC0gcmN0b3Jpc0B3cGkuZWR1XG4gKi9cblxudmFyIFBvc2UgPSByZXF1aXJlKCcuLi9tYXRoL1Bvc2UnKTtcbnZhciBWZWN0b3IzID0gcmVxdWlyZSgnLi4vbWF0aC9WZWN0b3IzJyk7XG52YXIgUXVhdGVybmlvbiA9IHJlcXVpcmUoJy4uL21hdGgvUXVhdGVybmlvbicpO1xuXG52YXIgVXJkZkN5bGluZGVyID0gcmVxdWlyZSgnLi9VcmRmQ3lsaW5kZXInKTtcbnZhciBVcmRmQm94ID0gcmVxdWlyZSgnLi9VcmRmQm94Jyk7XG52YXIgVXJkZk1hdGVyaWFsID0gcmVxdWlyZSgnLi9VcmRmTWF0ZXJpYWwnKTtcbnZhciBVcmRmTWVzaCA9IHJlcXVpcmUoJy4vVXJkZk1lc2gnKTtcbnZhciBVcmRmU3BoZXJlID0gcmVxdWlyZSgnLi9VcmRmU3BoZXJlJyk7XG5cbi8qKlxuICogQSBWaXN1YWwgZWxlbWVudCBpbiBhIFVSREYuXG4gKlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0gb3B0aW9ucyAtIG9iamVjdCB3aXRoIGZvbGxvd2luZyBrZXlzOlxuICogICogeG1sIC0gdGhlIFhNTCBlbGVtZW50IHRvIHBhcnNlXG4gKi9cbmZ1bmN0aW9uIFVyZGZWaXN1YWwob3B0aW9ucykge1xuICB2YXIgeG1sID0gb3B0aW9ucy54bWw7XG4gIHRoaXMub3JpZ2luID0gbnVsbDtcbiAgdGhpcy5nZW9tZXRyeSA9IG51bGw7XG4gIHRoaXMubWF0ZXJpYWwgPSBudWxsO1xuXG4gIC8vIE9yaWdpblxuICB2YXIgb3JpZ2lucyA9IHhtbC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnb3JpZ2luJyk7XG4gIGlmIChvcmlnaW5zLmxlbmd0aCA9PT0gMCkge1xuICAgIC8vIHVzZSB0aGUgaWRlbnRpdHkgYXMgdGhlIGRlZmF1bHRcbiAgICB0aGlzLm9yaWdpbiA9IG5ldyBQb3NlKCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gQ2hlY2sgdGhlIFhZWlxuICAgIHZhciB4eXogPSBvcmlnaW5zWzBdLmdldEF0dHJpYnV0ZSgneHl6Jyk7XG4gICAgdmFyIHBvc2l0aW9uID0gbmV3IFZlY3RvcjMoKTtcbiAgICBpZiAoeHl6KSB7XG4gICAgICB4eXogPSB4eXouc3BsaXQoJyAnKTtcbiAgICAgIHBvc2l0aW9uID0gbmV3IFZlY3RvcjMoe1xuICAgICAgICB4IDogcGFyc2VGbG9hdCh4eXpbMF0pLFxuICAgICAgICB5IDogcGFyc2VGbG9hdCh4eXpbMV0pLFxuICAgICAgICB6IDogcGFyc2VGbG9hdCh4eXpbMl0pXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayB0aGUgUlBZXG4gICAgdmFyIHJweSA9IG9yaWdpbnNbMF0uZ2V0QXR0cmlidXRlKCdycHknKTtcbiAgICB2YXIgb3JpZW50YXRpb24gPSBuZXcgUXVhdGVybmlvbigpO1xuICAgIGlmIChycHkpIHtcbiAgICAgIHJweSA9IHJweS5zcGxpdCgnICcpO1xuICAgICAgLy8gQ29udmVydCBmcm9tIFJQWVxuICAgICAgdmFyIHJvbGwgPSBwYXJzZUZsb2F0KHJweVswXSk7XG4gICAgICB2YXIgcGl0Y2ggPSBwYXJzZUZsb2F0KHJweVsxXSk7XG4gICAgICB2YXIgeWF3ID0gcGFyc2VGbG9hdChycHlbMl0pO1xuICAgICAgdmFyIHBoaSA9IHJvbGwgLyAyLjA7XG4gICAgICB2YXIgdGhlID0gcGl0Y2ggLyAyLjA7XG4gICAgICB2YXIgcHNpID0geWF3IC8gMi4wO1xuICAgICAgdmFyIHggPSBNYXRoLnNpbihwaGkpICogTWF0aC5jb3ModGhlKSAqIE1hdGguY29zKHBzaSkgLSBNYXRoLmNvcyhwaGkpICogTWF0aC5zaW4odGhlKVxuICAgICAgICAgICogTWF0aC5zaW4ocHNpKTtcbiAgICAgIHZhciB5ID0gTWF0aC5jb3MocGhpKSAqIE1hdGguc2luKHRoZSkgKiBNYXRoLmNvcyhwc2kpICsgTWF0aC5zaW4ocGhpKSAqIE1hdGguY29zKHRoZSlcbiAgICAgICAgICAqIE1hdGguc2luKHBzaSk7XG4gICAgICB2YXIgeiA9IE1hdGguY29zKHBoaSkgKiBNYXRoLmNvcyh0aGUpICogTWF0aC5zaW4ocHNpKSAtIE1hdGguc2luKHBoaSkgKiBNYXRoLnNpbih0aGUpXG4gICAgICAgICAgKiBNYXRoLmNvcyhwc2kpO1xuICAgICAgdmFyIHcgPSBNYXRoLmNvcyhwaGkpICogTWF0aC5jb3ModGhlKSAqIE1hdGguY29zKHBzaSkgKyBNYXRoLnNpbihwaGkpICogTWF0aC5zaW4odGhlKVxuICAgICAgICAgICogTWF0aC5zaW4ocHNpKTtcblxuICAgICAgb3JpZW50YXRpb24gPSBuZXcgUXVhdGVybmlvbih7XG4gICAgICAgIHggOiB4LFxuICAgICAgICB5IDogeSxcbiAgICAgICAgeiA6IHosXG4gICAgICAgIHcgOiB3XG4gICAgICB9KTtcbiAgICAgIG9yaWVudGF0aW9uLm5vcm1hbGl6ZSgpO1xuICAgIH1cbiAgICB0aGlzLm9yaWdpbiA9IG5ldyBQb3NlKHtcbiAgICAgIHBvc2l0aW9uIDogcG9zaXRpb24sXG4gICAgICBvcmllbnRhdGlvbiA6IG9yaWVudGF0aW9uXG4gICAgfSk7XG4gIH1cblxuICAvLyBHZW9tZXRyeVxuICB2YXIgZ2VvbXMgPSB4bWwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2dlb21ldHJ5Jyk7XG4gIGlmIChnZW9tcy5sZW5ndGggPiAwKSB7XG4gICAgdmFyIGdlb20gPSBnZW9tc1swXTtcbiAgICB2YXIgc2hhcGUgPSBudWxsO1xuICAgIC8vIENoZWNrIGZvciB0aGUgc2hhcGVcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGdlb20uY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIG5vZGUgPSBnZW9tLmNoaWxkTm9kZXNbaV07XG4gICAgICBpZiAobm9kZS5ub2RlVHlwZSA9PT0gMSkge1xuICAgICAgICBzaGFwZSA9IG5vZGU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBDaGVjayB0aGUgdHlwZVxuICAgIHZhciB0eXBlID0gc2hhcGUubm9kZU5hbWU7XG4gICAgaWYgKHR5cGUgPT09ICdzcGhlcmUnKSB7XG4gICAgICB0aGlzLmdlb21ldHJ5ID0gbmV3IFVyZGZTcGhlcmUoe1xuICAgICAgICB4bWwgOiBzaGFwZVxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnYm94Jykge1xuICAgICAgdGhpcy5nZW9tZXRyeSA9IG5ldyBVcmRmQm94KHtcbiAgICAgICAgeG1sIDogc2hhcGVcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2N5bGluZGVyJykge1xuICAgICAgdGhpcy5nZW9tZXRyeSA9IG5ldyBVcmRmQ3lsaW5kZXIoe1xuICAgICAgICB4bWwgOiBzaGFwZVxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnbWVzaCcpIHtcbiAgICAgIHRoaXMuZ2VvbWV0cnkgPSBuZXcgVXJkZk1lc2goe1xuICAgICAgICB4bWwgOiBzaGFwZVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUud2FybignVW5rbm93biBnZW9tZXRyeSB0eXBlICcgKyB0eXBlKTtcbiAgICB9XG4gIH1cblxuICAvLyBNYXRlcmlhbFxuICB2YXIgbWF0ZXJpYWxzID0geG1sLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdtYXRlcmlhbCcpO1xuICBpZiAobWF0ZXJpYWxzLmxlbmd0aCA+IDApIHtcbiAgICB0aGlzLm1hdGVyaWFsID0gbmV3IFVyZGZNYXRlcmlhbCh7XG4gICAgICB4bWwgOiBtYXRlcmlhbHNbMF1cbiAgICB9KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFVyZGZWaXN1YWw7IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCdvYmplY3QtYXNzaWduJykoe1xuICAgIFVyZGZCb3g6IHJlcXVpcmUoJy4vVXJkZkJveCcpLFxuICAgIFVyZGZDb2xvcjogcmVxdWlyZSgnLi9VcmRmQ29sb3InKSxcbiAgICBVcmRmQ3lsaW5kZXI6IHJlcXVpcmUoJy4vVXJkZkN5bGluZGVyJyksXG4gICAgVXJkZkxpbms6IHJlcXVpcmUoJy4vVXJkZkxpbmsnKSxcbiAgICBVcmRmTWF0ZXJpYWw6IHJlcXVpcmUoJy4vVXJkZk1hdGVyaWFsJyksXG4gICAgVXJkZk1lc2g6IHJlcXVpcmUoJy4vVXJkZk1lc2gnKSxcbiAgICBVcmRmTW9kZWw6IHJlcXVpcmUoJy4vVXJkZk1vZGVsJyksXG4gICAgVXJkZlNwaGVyZTogcmVxdWlyZSgnLi9VcmRmU3BoZXJlJyksXG4gICAgVXJkZlZpc3VhbDogcmVxdWlyZSgnLi9VcmRmVmlzdWFsJylcbn0sIHJlcXVpcmUoJy4vVXJkZlR5cGVzJykpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBnbG9iYWwuV2ViU29ja2V0OyIsIi8qIGdsb2JhbCBkb2N1bWVudCAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBDYW52YXMoKSB7XG5cdHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbn07IiwiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3XG4gKiBAYXV0aG9yIEdyYWVtZSBZZWF0ZXMgLSBnaXRodWIuY29tL21lZ2F3YWNcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBDYW52YXMgPSByZXF1aXJlKCdjYW52YXMnKTtcbnZhciBJbWFnZSA9IENhbnZhcy5JbWFnZSB8fCBnbG9iYWwuSW1hZ2U7XG5cbi8qKlxuICogSWYgYSBtZXNzYWdlIHdhcyBjb21wcmVzc2VkIGFzIGEgUE5HIGltYWdlIChhIGNvbXByZXNzaW9uIGhhY2sgc2luY2VcbiAqIGd6aXBwaW5nIG92ZXIgV2ViU29ja2V0cyAqIGlzIG5vdCBzdXBwb3J0ZWQgeWV0KSwgdGhpcyBmdW5jdGlvbiBwbGFjZXMgdGhlXG4gKiBcImltYWdlXCIgaW4gYSBjYW52YXMgZWxlbWVudCB0aGVuIGRlY29kZXMgdGhlICogXCJpbWFnZVwiIGFzIGEgQmFzZTY0IHN0cmluZy5cbiAqXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIGRhdGEgLSBvYmplY3QgY29udGFpbmluZyB0aGUgUE5HIGRhdGEuXG4gKiBAcGFyYW0gY2FsbGJhY2sgLSBmdW5jdGlvbiB3aXRoIHBhcmFtczpcbiAqICAgKiBkYXRhIC0gdGhlIHVuY29tcHJlc3NlZCBkYXRhXG4gKi9cbmZ1bmN0aW9uIGRlY29tcHJlc3NQbmcoZGF0YSwgY2FsbGJhY2spIHtcbiAgLy8gVW5jb21wcmVzc2VzIHRoZSBkYXRhIGJlZm9yZSBzZW5kaW5nIGl0IHRocm91Z2ggKHVzZSBpbWFnZS9jYW52YXMgdG8gZG8gc28pLlxuICB2YXIgaW1hZ2UgPSBuZXcgSW1hZ2UoKTtcbiAgLy8gV2hlbiB0aGUgaW1hZ2UgbG9hZHMsIGV4dHJhY3RzIHRoZSByYXcgZGF0YSAoSlNPTiBtZXNzYWdlKS5cbiAgaW1hZ2Uub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgLy8gQ3JlYXRlcyBhIGxvY2FsIGNhbnZhcyB0byBkcmF3IG9uLlxuICAgIHZhciBjYW52YXMgPSBuZXcgQ2FudmFzKCk7XG4gICAgdmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcblxuICAgIC8vIFNldHMgd2lkdGggYW5kIGhlaWdodC5cbiAgICBjYW52YXMud2lkdGggPSBpbWFnZS53aWR0aDtcbiAgICBjYW52YXMuaGVpZ2h0ID0gaW1hZ2UuaGVpZ2h0O1xuXG4gICAgLy8gUHJldmVudHMgYW50aS1hbGlhc2luZyBhbmQgbG9vc2luZyBkYXRhXG4gICAgY29udGV4dC5pbWFnZVNtb290aGluZ0VuYWJsZWQgPSBmYWxzZTtcbiAgICBjb250ZXh0LndlYmtpdEltYWdlU21vb3RoaW5nRW5hYmxlZCA9IGZhbHNlO1xuICAgIGNvbnRleHQubW96SW1hZ2VTbW9vdGhpbmdFbmFibGVkID0gZmFsc2U7XG5cbiAgICAvLyBQdXRzIHRoZSBkYXRhIGludG8gdGhlIGltYWdlLlxuICAgIGNvbnRleHQuZHJhd0ltYWdlKGltYWdlLCAwLCAwKTtcbiAgICAvLyBHcmFicyB0aGUgcmF3LCB1bmNvbXByZXNzZWQgZGF0YS5cbiAgICB2YXIgaW1hZ2VEYXRhID0gY29udGV4dC5nZXRJbWFnZURhdGEoMCwgMCwgaW1hZ2Uud2lkdGgsIGltYWdlLmhlaWdodCkuZGF0YTtcblxuICAgIC8vIENvbnN0cnVjdHMgdGhlIEpTT04uXG4gICAgdmFyIGpzb25EYXRhID0gJyc7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbWFnZURhdGEubGVuZ3RoOyBpICs9IDQpIHtcbiAgICAgIC8vIFJHQlxuICAgICAganNvbkRhdGEgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShpbWFnZURhdGFbaV0sIGltYWdlRGF0YVtpICsgMV0sIGltYWdlRGF0YVtpICsgMl0pO1xuICAgIH1cbiAgICBjYWxsYmFjayhKU09OLnBhcnNlKGpzb25EYXRhKSk7XG4gIH07XG4gIC8vIFNlbmRzIHRoZSBpbWFnZSBkYXRhIHRvIGxvYWQuXG4gIGltYWdlLnNyYyA9ICdkYXRhOmltYWdlL3BuZztiYXNlNjQsJyArIGRhdGE7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZGVjb21wcmVzc1BuZzsiLCJleHBvcnRzLkRPTUltcGxlbWVudGF0aW9uID0gZ2xvYmFsLkRPTUltcGxlbWVudGF0aW9uO1xuZXhwb3J0cy5YTUxTZXJpYWxpemVyID0gZ2xvYmFsLlhNTFNlcmlhbGl6ZXI7XG5leHBvcnRzLkRPTVBhcnNlciA9IGdsb2JhbC5ET01QYXJzZXI7IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX3BvbnlmaWxsID0gcmVxdWlyZSgnLi9wb255ZmlsbC5qcycpO1xuXG52YXIgX3BvbnlmaWxsMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3BvbnlmaWxsKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG52YXIgcm9vdDsgLyogZ2xvYmFsIHdpbmRvdyAqL1xuXG5cbmlmICh0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgcm9vdCA9IHNlbGY7XG59IGVsc2UgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gIHJvb3QgPSB3aW5kb3c7XG59IGVsc2UgaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG4gIHJvb3QgPSBnbG9iYWw7XG59IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSB7XG4gIHJvb3QgPSBtb2R1bGU7XG59IGVsc2Uge1xuICByb290ID0gRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcbn1cblxudmFyIHJlc3VsdCA9ICgwLCBfcG9ueWZpbGwyWydkZWZhdWx0J10pKHJvb3QpO1xuZXhwb3J0c1snZGVmYXVsdCddID0gcmVzdWx0OyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG5cdHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IHN5bWJvbE9ic2VydmFibGVQb255ZmlsbDtcbmZ1bmN0aW9uIHN5bWJvbE9ic2VydmFibGVQb255ZmlsbChyb290KSB7XG5cdHZhciByZXN1bHQ7XG5cdHZhciBfU3ltYm9sID0gcm9vdC5TeW1ib2w7XG5cblx0aWYgKHR5cGVvZiBfU3ltYm9sID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0aWYgKF9TeW1ib2wub2JzZXJ2YWJsZSkge1xuXHRcdFx0cmVzdWx0ID0gX1N5bWJvbC5vYnNlcnZhYmxlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQgPSBfU3ltYm9sKCdvYnNlcnZhYmxlJyk7XG5cdFx0XHRfU3ltYm9sLm9ic2VydmFibGUgPSByZXN1bHQ7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHJlc3VsdCA9ICdAQG9ic2VydmFibGUnO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn07IiwidmFyIG5leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy9icm93c2VyLmpzJykubmV4dFRpY2s7XG52YXIgYXBwbHkgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHk7XG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgaW1tZWRpYXRlSWRzID0ge307XG52YXIgbmV4dEltbWVkaWF0ZUlkID0gMDtcblxuLy8gRE9NIEFQSXMsIGZvciBjb21wbGV0ZW5lc3NcblxuZXhwb3J0cy5zZXRUaW1lb3V0ID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldFRpbWVvdXQsIHdpbmRvdywgYXJndW1lbnRzKSwgY2xlYXJUaW1lb3V0KTtcbn07XG5leHBvcnRzLnNldEludGVydmFsID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBuZXcgVGltZW91dChhcHBseS5jYWxsKHNldEludGVydmFsLCB3aW5kb3csIGFyZ3VtZW50cyksIGNsZWFySW50ZXJ2YWwpO1xufTtcbmV4cG9ydHMuY2xlYXJUaW1lb3V0ID1cbmV4cG9ydHMuY2xlYXJJbnRlcnZhbCA9IGZ1bmN0aW9uKHRpbWVvdXQpIHsgdGltZW91dC5jbG9zZSgpOyB9O1xuXG5mdW5jdGlvbiBUaW1lb3V0KGlkLCBjbGVhckZuKSB7XG4gIHRoaXMuX2lkID0gaWQ7XG4gIHRoaXMuX2NsZWFyRm4gPSBjbGVhckZuO1xufVxuVGltZW91dC5wcm90b3R5cGUudW5yZWYgPSBUaW1lb3V0LnByb3RvdHlwZS5yZWYgPSBmdW5jdGlvbigpIHt9O1xuVGltZW91dC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5fY2xlYXJGbi5jYWxsKHdpbmRvdywgdGhpcy5faWQpO1xufTtcblxuLy8gRG9lcyBub3Qgc3RhcnQgdGhlIHRpbWUsIGp1c3Qgc2V0cyB1cCB0aGUgbWVtYmVycyBuZWVkZWQuXG5leHBvcnRzLmVucm9sbCA9IGZ1bmN0aW9uKGl0ZW0sIG1zZWNzKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSBtc2Vjcztcbn07XG5cbmV4cG9ydHMudW5lbnJvbGwgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcbiAgaXRlbS5faWRsZVRpbWVvdXQgPSAtMTtcbn07XG5cbmV4cG9ydHMuX3VucmVmQWN0aXZlID0gZXhwb3J0cy5hY3RpdmUgPSBmdW5jdGlvbihpdGVtKSB7XG4gIGNsZWFyVGltZW91dChpdGVtLl9pZGxlVGltZW91dElkKTtcblxuICB2YXIgbXNlY3MgPSBpdGVtLl9pZGxlVGltZW91dDtcbiAgaWYgKG1zZWNzID49IDApIHtcbiAgICBpdGVtLl9pZGxlVGltZW91dElkID0gc2V0VGltZW91dChmdW5jdGlvbiBvblRpbWVvdXQoKSB7XG4gICAgICBpZiAoaXRlbS5fb25UaW1lb3V0KVxuICAgICAgICBpdGVtLl9vblRpbWVvdXQoKTtcbiAgICB9LCBtc2Vjcyk7XG4gIH1cbn07XG5cbi8vIFRoYXQncyBub3QgaG93IG5vZGUuanMgaW1wbGVtZW50cyBpdCBidXQgdGhlIGV4cG9zZWQgYXBpIGlzIHRoZSBzYW1lLlxuZXhwb3J0cy5zZXRJbW1lZGlhdGUgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSBcImZ1bmN0aW9uXCIgPyBzZXRJbW1lZGlhdGUgOiBmdW5jdGlvbihmbikge1xuICB2YXIgaWQgPSBuZXh0SW1tZWRpYXRlSWQrKztcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHMubGVuZ3RoIDwgMiA/IGZhbHNlIDogc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gIGltbWVkaWF0ZUlkc1tpZF0gPSB0cnVlO1xuXG4gIG5leHRUaWNrKGZ1bmN0aW9uIG9uTmV4dFRpY2soKSB7XG4gICAgaWYgKGltbWVkaWF0ZUlkc1tpZF0pIHtcbiAgICAgIC8vIGZuLmNhbGwoKSBpcyBmYXN0ZXIgc28gd2Ugb3B0aW1pemUgZm9yIHRoZSBjb21tb24gdXNlLWNhc2VcbiAgICAgIC8vIEBzZWUgaHR0cDovL2pzcGVyZi5jb20vY2FsbC1hcHBseS1zZWd1XG4gICAgICBpZiAoYXJncykge1xuICAgICAgICBmbi5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZuLmNhbGwobnVsbCk7XG4gICAgICB9XG4gICAgICAvLyBQcmV2ZW50IGlkcyBmcm9tIGxlYWtpbmdcbiAgICAgIGV4cG9ydHMuY2xlYXJJbW1lZGlhdGUoaWQpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGlkO1xufTtcblxuZXhwb3J0cy5jbGVhckltbWVkaWF0ZSA9IHR5cGVvZiBjbGVhckltbWVkaWF0ZSA9PT0gXCJmdW5jdGlvblwiID8gY2xlYXJJbW1lZGlhdGUgOiBmdW5jdGlvbihpZCkge1xuICBkZWxldGUgaW1tZWRpYXRlSWRzW2lkXTtcbn07IiwiLy8vIDxyZWZlcmVuY2UgdHlwZXM9XCJub2RlXCIgLz5cbmltcG9ydCB7RXZlbnRFbWl0dGVyfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IHtTdHJlYW0sIEludGVybmFsUHJvZHVjZXIsIEludGVybmFsTGlzdGVuZXJ9IGZyb20gJy4uL2luZGV4JztcblxuZXhwb3J0IGNsYXNzIERPTUV2ZW50UHJvZHVjZXIgaW1wbGVtZW50cyBJbnRlcm5hbFByb2R1Y2VyPEV2ZW50PiB7XG4gIHB1YmxpYyB0eXBlID0gJ2Zyb21FdmVudCc7XG4gIHByaXZhdGUgbGlzdGVuZXI6IEV2ZW50TGlzdGVuZXIgfCBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgbm9kZTogRXZlbnRUYXJnZXQsXG4gICAgICAgICAgICAgIHByaXZhdGUgZXZlbnRUeXBlOiBzdHJpbmcsXG4gICAgICAgICAgICAgIHByaXZhdGUgdXNlQ2FwdHVyZTogYm9vbGVhbikge1xuICB9XG5cbiAgX3N0YXJ0KG91dDogSW50ZXJuYWxMaXN0ZW5lcjxFdmVudD4pIHtcbiAgICB0aGlzLmxpc3RlbmVyID0gKGUpID0+IG91dC5fbihlKTtcbiAgICB0aGlzLm5vZGUuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLmV2ZW50VHlwZSwgdGhpcy5saXN0ZW5lciwgdGhpcy51c2VDYXB0dXJlKTtcbiAgfVxuXG4gIF9zdG9wKCkge1xuICAgIHRoaXMubm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMuZXZlbnRUeXBlLCB0aGlzLmxpc3RlbmVyIGFzIGFueSwgdGhpcy51c2VDYXB0dXJlKTtcbiAgICB0aGlzLmxpc3RlbmVyID0gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTm9kZUV2ZW50UHJvZHVjZXIgaW1wbGVtZW50cyBJbnRlcm5hbFByb2R1Y2VyPGFueT4ge1xuICBwdWJsaWMgdHlwZSA9ICdmcm9tRXZlbnQnO1xuICBwcml2YXRlIGxpc3RlbmVyOiBGdW5jdGlvbiB8IG51bGw7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBub2RlOiBFdmVudEVtaXR0ZXIsIHByaXZhdGUgZXZlbnROYW1lOiBzdHJpbmcpIHsgfVxuXG4gIF9zdGFydChvdXQ6IEludGVybmFsTGlzdGVuZXI8YW55Pikge1xuICAgIHRoaXMubGlzdGVuZXIgPSAoLi4uYXJnczogQXJyYXk8YW55PikgPT4ge1xuICAgICAgcmV0dXJuIChhcmdzLmxlbmd0aCA+IDEpID8gb3V0Ll9uKGFyZ3MpIDogb3V0Ll9uKGFyZ3NbMF0pO1xuICAgIH07XG4gICAgdGhpcy5ub2RlLmFkZExpc3RlbmVyKHRoaXMuZXZlbnROYW1lLCB0aGlzLmxpc3RlbmVyKTtcbiAgfVxuXG4gIF9zdG9wKCkge1xuICAgIHRoaXMubm9kZS5yZW1vdmVMaXN0ZW5lcih0aGlzLmV2ZW50TmFtZSwgdGhpcy5saXN0ZW5lciBhcyBhbnkpO1xuICAgIHRoaXMubGlzdGVuZXIgPSBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzRW1pdHRlcihlbGVtZW50OiBhbnkpOiBlbGVtZW50IGlzIEV2ZW50RW1pdHRlciB7XG4gIHJldHVybiBlbGVtZW50LmVtaXQgJiYgZWxlbWVudC5hZGRMaXN0ZW5lcjtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgc3RyZWFtIGJhc2VkIG9uIGVpdGhlcjpcbiAqIC0gRE9NIGV2ZW50cyB3aXRoIHRoZSBuYW1lIGBldmVudE5hbWVgIGZyb20gYSBwcm92aWRlZCB0YXJnZXQgbm9kZVxuICogLSBFdmVudHMgd2l0aCB0aGUgbmFtZSBgZXZlbnROYW1lYCBmcm9tIGEgcHJvdmlkZWQgTm9kZUpTIEV2ZW50RW1pdHRlclxuICpcbiAqIFdoZW4gY3JlYXRpbmcgYSBzdHJlYW0gZnJvbSBFdmVudEVtaXR0ZXJzLCBpZiB0aGUgc291cmNlIGV2ZW50IGhhcyBtb3JlIHRoYW5cbiAqIG9uZSBhcmd1bWVudCBhbGwgdGhlIGFyZ3VtZW50cyB3aWxsIGJlIGFnZ3JlZ2F0ZWQgaW50byBhbiBhcnJheSBpbiB0aGVcbiAqIHJlc3VsdCBzdHJlYW0uXG4gKlxuICogKFRpcDogd2hlbiB1c2luZyB0aGlzIGZhY3Rvcnkgd2l0aCBUeXBlU2NyaXB0LCB5b3Ugd2lsbCBuZWVkIHR5cGVzIGZvclxuICogTm9kZS5qcyBiZWNhdXNlIGZyb21FdmVudCBrbm93cyBob3cgdG8gaGFuZGxlIGJvdGggRE9NIGV2ZW50cyBhbmQgTm9kZS5qc1xuICogRXZlbnRFbWl0dGVyLiBKdXN0IGluc3RhbGwgYEB0eXBlcy9ub2RlYClcbiAqXG4gKiBNYXJibGUgZGlhZ3JhbTpcbiAqXG4gKiBgYGB0ZXh0XG4gKiAgIGZyb21FdmVudChlbGVtZW50LCBldmVudE5hbWUpXG4gKiAtLS1ldi0tZXYtLS0tZXYtLS0tLS0tLS0tLS0tLS1cbiAqIGBgYFxuICpcbiAqIEV4YW1wbGVzOlxuICpcbiAqIGBgYGpzXG4gKiBpbXBvcnQgZnJvbUV2ZW50IGZyb20gJ3hzdHJlYW0vZXh0cmEvZnJvbUV2ZW50J1xuICpcbiAqIGNvbnN0IHN0cmVhbSA9IGZyb21FdmVudChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuYnV0dG9uJyksICdjbGljaycpXG4gKiAgIC5tYXBUbygnQnV0dG9uIGNsaWNrZWQhJylcbiAqXG4gKiBzdHJlYW0uYWRkTGlzdGVuZXIoe1xuICogICBuZXh0OiBpID0+IGNvbnNvbGUubG9nKGkpLFxuICogICBlcnJvcjogZXJyID0+IGNvbnNvbGUuZXJyb3IoZXJyKSxcbiAqICAgY29tcGxldGU6ICgpID0+IGNvbnNvbGUubG9nKCdjb21wbGV0ZWQnKVxuICogfSlcbiAqIGBgYFxuICpcbiAqIGBgYHRleHRcbiAqID4gJ0J1dHRvbiBjbGlja2VkISdcbiAqID4gJ0J1dHRvbiBjbGlja2VkISdcbiAqID4gJ0J1dHRvbiBjbGlja2VkISdcbiAqIGBgYFxuICpcbiAqIGBgYGpzXG4gKiBpbXBvcnQgZnJvbUV2ZW50IGZyb20gJ3hzdHJlYW0vZXh0cmEvZnJvbUV2ZW50J1xuICogaW1wb3J0IHtFdmVudEVtaXR0ZXJ9IGZyb20gJ2V2ZW50cydcbiAqXG4gKiBjb25zdCBNeUVtaXR0ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKClcbiAqIGNvbnN0IHN0cmVhbSA9IGZyb21FdmVudChNeUVtaXR0ZXIsICdmb28nKVxuICpcbiAqIHN0cmVhbS5hZGRMaXN0ZW5lcih7XG4gKiAgIG5leHQ6IGkgPT4gY29uc29sZS5sb2coaSksXG4gKiAgIGVycm9yOiBlcnIgPT4gY29uc29sZS5lcnJvcihlcnIpLFxuICogICBjb21wbGV0ZTogKCkgPT4gY29uc29sZS5sb2coJ2NvbXBsZXRlZCcpXG4gKiB9KVxuICpcbiAqIE15RW1pdHRlci5lbWl0KCdmb28nLCAnYmFyJylcbiAqIGBgYFxuICpcbiAqIGBgYHRleHRcbiAqID4gJ2JhcidcbiAqIGBgYFxuICpcbiAqIGBgYGpzXG4gKiBpbXBvcnQgZnJvbUV2ZW50IGZyb20gJ3hzdHJlYW0vZXh0cmEvZnJvbUV2ZW50J1xuICogaW1wb3J0IHtFdmVudEVtaXR0ZXJ9IGZyb20gJ2V2ZW50cydcbiAqXG4gKiBjb25zdCBNeUVtaXR0ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKClcbiAqIGNvbnN0IHN0cmVhbSA9IGZyb21FdmVudChNeUVtaXR0ZXIsICdmb28nKVxuICpcbiAqIHN0cmVhbS5hZGRMaXN0ZW5lcih7XG4gKiAgIG5leHQ6IGkgPT4gY29uc29sZS5sb2coaSksXG4gKiAgIGVycm9yOiBlcnIgPT4gY29uc29sZS5lcnJvcihlcnIpLFxuICogICBjb21wbGV0ZTogKCkgPT4gY29uc29sZS5sb2coJ2NvbXBsZXRlZCcpXG4gKiB9KVxuICpcbiAqIE15RW1pdHRlci5lbWl0KCdmb28nLCAnYmFyJywgJ2JheicsICdidXp6JylcbiAqIGBgYFxuICpcbiAqIGBgYHRleHRcbiAqID4gWydiYXInLCAnYmF6JywgJ2J1enonXVxuICogYGBgXG4gKlxuICogQGZhY3RvcnkgdHJ1ZVxuICogQHBhcmFtIHtFdmVudFRhcmdldHxFdmVudEVtaXR0ZXJ9IGVsZW1lbnQgVGhlIGVsZW1lbnQgdXBvbiB3aGljaCB0byBsaXN0ZW4uXG4gKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lIFRoZSBuYW1lIG9mIHRoZSBldmVudCBmb3Igd2hpY2ggdG8gbGlzdGVuLlxuICogQHBhcmFtIHtib29sZWFuP30gdXNlQ2FwdHVyZSBBbiBvcHRpb25hbCBib29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoYXQgZXZlbnRzIG9mXG4gKiB0aGlzIHR5cGUgd2lsbCBiZSBkaXNwYXRjaGVkIHRvIHRoZSByZWdpc3RlcmVkIGxpc3RlbmVyIGJlZm9yZSBiZWluZ1xuICogZGlzcGF0Y2hlZCB0byBhbnkgRXZlbnRUYXJnZXQgYmVuZWF0aCBpdCBpbiB0aGUgRE9NIHRyZWUuIERlZmF1bHRzIHRvIGZhbHNlLlxuICogQHJldHVybiB7U3RyZWFtfVxuICovXG5cbmZ1bmN0aW9uIGZyb21FdmVudDxUID0gYW55PihlbGVtZW50OiBFdmVudEVtaXR0ZXIsIGV2ZW50TmFtZTogc3RyaW5nKTogU3RyZWFtPFQ+O1xuZnVuY3Rpb24gZnJvbUV2ZW50PFQgZXh0ZW5kcyBFdmVudCA9IEV2ZW50PihlbGVtZW50OiBFdmVudFRhcmdldCwgZXZlbnROYW1lOiBzdHJpbmcsIHVzZUNhcHR1cmU/OiBib29sZWFuKTogU3RyZWFtPFQ+O1xuXG5mdW5jdGlvbiBmcm9tRXZlbnQ8VCA9IGFueT4oZWxlbWVudDogRXZlbnRFbWl0dGVyIHwgRXZlbnRUYXJnZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnROYW1lOiBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlQ2FwdHVyZTogYm9vbGVhbiA9IGZhbHNlKTogU3RyZWFtPFQ+IHtcbiAgaWYgKGlzRW1pdHRlcihlbGVtZW50KSkge1xuICAgIHJldHVybiBuZXcgU3RyZWFtPFQ+KG5ldyBOb2RlRXZlbnRQcm9kdWNlcihlbGVtZW50LCBldmVudE5hbWUpKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbTxUPihuZXcgRE9NRXZlbnRQcm9kdWNlcihlbGVtZW50LCBldmVudE5hbWUsIHVzZUNhcHR1cmUpIGFzIGFueSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnJvbUV2ZW50O1xuIiwiaW1wb3J0ICQkb2JzZXJ2YWJsZSBmcm9tICdzeW1ib2wtb2JzZXJ2YWJsZSc7XG5cbmNvbnN0IE5PID0ge307XG5mdW5jdGlvbiBub29wKCkge31cblxuZnVuY3Rpb24gY3A8VD4oYTogQXJyYXk8VD4pOiBBcnJheTxUPiB7XG4gIGNvbnN0IGwgPSBhLmxlbmd0aDtcbiAgY29uc3QgYiA9IEFycmF5KGwpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGw7ICsraSkgYltpXSA9IGFbaV07XG4gIHJldHVybiBiO1xufVxuXG5mdW5jdGlvbiBhbmQ8VD4oZjE6ICh0OiBUKSA9PiBib29sZWFuLCBmMjogKHQ6IFQpID0+IGJvb2xlYW4pOiAodDogVCkgPT4gYm9vbGVhbiB7XG4gIHJldHVybiBmdW5jdGlvbiBhbmRGbih0OiBUKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGYxKHQpICYmIGYyKHQpO1xuICB9O1xufVxuXG5pbnRlcmZhY2UgRkNvbnRhaW5lcjxULCBSPiB7XG4gIGYodDogVCk6IFI7XG59XG5cbmZ1bmN0aW9uIF90cnk8VCwgUj4oYzogRkNvbnRhaW5lcjxULCBSPiwgdDogVCwgdTogU3RyZWFtPGFueT4pOiBSIHwge30ge1xuICB0cnkge1xuICAgIHJldHVybiBjLmYodCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB1Ll9lKGUpO1xuICAgIHJldHVybiBOTztcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEludGVybmFsTGlzdGVuZXI8VD4ge1xuICBfbjogKHY6IFQpID0+IHZvaWQ7XG4gIF9lOiAoZXJyOiBhbnkpID0+IHZvaWQ7XG4gIF9jOiAoKSA9PiB2b2lkO1xufVxuXG5jb25zdCBOT19JTDogSW50ZXJuYWxMaXN0ZW5lcjxhbnk+ID0ge1xuICBfbjogbm9vcCxcbiAgX2U6IG5vb3AsXG4gIF9jOiBub29wLFxufTtcblxuZXhwb3J0IGludGVyZmFjZSBJbnRlcm5hbFByb2R1Y2VyPFQ+IHtcbiAgX3N0YXJ0KGxpc3RlbmVyOiBJbnRlcm5hbExpc3RlbmVyPFQ+KTogdm9pZDtcbiAgX3N0b3A6ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3V0U2VuZGVyPFQ+IHtcbiAgb3V0OiBTdHJlYW08VD47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3BlcmF0b3I8VCwgUj4gZXh0ZW5kcyBJbnRlcm5hbFByb2R1Y2VyPFI+LCBJbnRlcm5hbExpc3RlbmVyPFQ+LCBPdXRTZW5kZXI8Uj4ge1xuICB0eXBlOiBzdHJpbmc7XG4gIGluczogU3RyZWFtPFQ+O1xuICBfc3RhcnQob3V0OiBTdHJlYW08Uj4pOiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFnZ3JlZ2F0b3I8VCwgVT4gZXh0ZW5kcyBJbnRlcm5hbFByb2R1Y2VyPFU+LCBPdXRTZW5kZXI8VT4ge1xuICB0eXBlOiBzdHJpbmc7XG4gIGluc0FycjogQXJyYXk8U3RyZWFtPFQ+PjtcbiAgX3N0YXJ0KG91dDogU3RyZWFtPFU+KTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQcm9kdWNlcjxUPiB7XG4gIHN0YXJ0OiAobGlzdGVuZXI6IExpc3RlbmVyPFQ+KSA9PiB2b2lkO1xuICBzdG9wOiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIExpc3RlbmVyPFQ+IHtcbiAgbmV4dDogKHg6IFQpID0+IHZvaWQ7XG4gIGVycm9yOiAoZXJyOiBhbnkpID0+IHZvaWQ7XG4gIGNvbXBsZXRlOiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN1YnNjcmlwdGlvbiB7XG4gIHVuc3Vic2NyaWJlKCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT2JzZXJ2YWJsZTxUPiB7XG4gIHN1YnNjcmliZShsaXN0ZW5lcjogTGlzdGVuZXI8VD4pOiBTdWJzY3JpcHRpb247XG59XG5cbi8vIG11dGF0ZXMgdGhlIGlucHV0XG5mdW5jdGlvbiBpbnRlcm5hbGl6ZVByb2R1Y2VyPFQ+KHByb2R1Y2VyOiBQcm9kdWNlcjxUPiAmIFBhcnRpYWw8SW50ZXJuYWxQcm9kdWNlcjxUPj4pIHtcbiAgcHJvZHVjZXIuX3N0YXJ0ID0gZnVuY3Rpb24gX3N0YXJ0KGlsOiBJbnRlcm5hbExpc3RlbmVyPFQ+ICYgUGFydGlhbDxMaXN0ZW5lcjxUPj4pIHtcbiAgICBpbC5uZXh0ID0gaWwuX247XG4gICAgaWwuZXJyb3IgPSBpbC5fZTtcbiAgICBpbC5jb21wbGV0ZSA9IGlsLl9jO1xuICAgIHRoaXMuc3RhcnQoaWwpO1xuICB9O1xuICBwcm9kdWNlci5fc3RvcCA9IHByb2R1Y2VyLnN0b3A7XG59XG5cbmNsYXNzIFN0cmVhbVN1YjxUPiBpbXBsZW1lbnRzIFN1YnNjcmlwdGlvbiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX3N0cmVhbTogU3RyZWFtPFQ+LCBwcml2YXRlIF9saXN0ZW5lcjogSW50ZXJuYWxMaXN0ZW5lcjxUPikge31cblxuICB1bnN1YnNjcmliZSgpOiB2b2lkIHtcbiAgICB0aGlzLl9zdHJlYW0uX3JlbW92ZSh0aGlzLl9saXN0ZW5lcik7XG4gIH1cbn1cblxuY2xhc3MgT2JzZXJ2ZXI8VD4gaW1wbGVtZW50cyBMaXN0ZW5lcjxUPiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX2xpc3RlbmVyOiBJbnRlcm5hbExpc3RlbmVyPFQ+KSB7fVxuXG4gIG5leHQodmFsdWU6IFQpIHtcbiAgICB0aGlzLl9saXN0ZW5lci5fbih2YWx1ZSk7XG4gIH1cblxuICBlcnJvcihlcnI6IGFueSkge1xuICAgIHRoaXMuX2xpc3RlbmVyLl9lKGVycik7XG4gIH1cblxuICBjb21wbGV0ZSgpIHtcbiAgICB0aGlzLl9saXN0ZW5lci5fYygpO1xuICB9XG59XG5cbmNsYXNzIEZyb21PYnNlcnZhYmxlPFQ+IGltcGxlbWVudHMgSW50ZXJuYWxQcm9kdWNlcjxUPiB7XG4gIHB1YmxpYyB0eXBlID0gJ2Zyb21PYnNlcnZhYmxlJztcbiAgcHVibGljIGluczogT2JzZXJ2YWJsZTxUPjtcbiAgcHVibGljIG91dDogU3RyZWFtPFQ+O1xuICBwcml2YXRlIGFjdGl2ZTogYm9vbGVhbjtcbiAgcHJpdmF0ZSBfc3ViOiBTdWJzY3JpcHRpb24gfCB1bmRlZmluZWQ7XG5cbiAgY29uc3RydWN0b3Iob2JzZXJ2YWJsZTogT2JzZXJ2YWJsZTxUPikge1xuICAgIHRoaXMuaW5zID0gb2JzZXJ2YWJsZTtcbiAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuICB9XG5cbiAgX3N0YXJ0KG91dDogU3RyZWFtPFQ+KSB7XG4gICAgdGhpcy5vdXQgPSBvdXQ7XG4gICAgdGhpcy5hY3RpdmUgPSB0cnVlO1xuICAgIHRoaXMuX3N1YiA9IHRoaXMuaW5zLnN1YnNjcmliZShuZXcgT2JzZXJ2ZXIob3V0KSk7XG4gICAgaWYgKCF0aGlzLmFjdGl2ZSkgdGhpcy5fc3ViLnVuc3Vic2NyaWJlKCk7XG4gIH1cblxuICBfc3RvcCgpIHtcbiAgICBpZiAodGhpcy5fc3ViKSB0aGlzLl9zdWIudW5zdWJzY3JpYmUoKTtcbiAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVyZ2VTaWduYXR1cmUge1xuICAoKTogU3RyZWFtPGFueT47XG4gIDxUMT4oczE6IFN0cmVhbTxUMT4pOiBTdHJlYW08VDE+O1xuICA8VDEsIFQyPihcbiAgICBzMTogU3RyZWFtPFQxPixcbiAgICBzMjogU3RyZWFtPFQyPik6IFN0cmVhbTxUMSB8IFQyPjtcbiAgPFQxLCBUMiwgVDM+KFxuICAgIHMxOiBTdHJlYW08VDE+LFxuICAgIHMyOiBTdHJlYW08VDI+LFxuICAgIHMzOiBTdHJlYW08VDM+KTogU3RyZWFtPFQxIHwgVDIgfCBUMz47XG4gIDxUMSwgVDIsIFQzLCBUND4oXG4gICAgczE6IFN0cmVhbTxUMT4sXG4gICAgczI6IFN0cmVhbTxUMj4sXG4gICAgczM6IFN0cmVhbTxUMz4sXG4gICAgczQ6IFN0cmVhbTxUND4pOiBTdHJlYW08VDEgfCBUMiB8IFQzIHwgVDQ+O1xuICA8VDEsIFQyLCBUMywgVDQsIFQ1PihcbiAgICBzMTogU3RyZWFtPFQxPixcbiAgICBzMjogU3RyZWFtPFQyPixcbiAgICBzMzogU3RyZWFtPFQzPixcbiAgICBzNDogU3RyZWFtPFQ0PixcbiAgICBzNTogU3RyZWFtPFQ1Pik6IFN0cmVhbTxUMSB8IFQyIHwgVDMgfCBUNCB8IFQ1PjtcbiAgPFQxLCBUMiwgVDMsIFQ0LCBUNSwgVDY+KFxuICAgIHMxOiBTdHJlYW08VDE+LFxuICAgIHMyOiBTdHJlYW08VDI+LFxuICAgIHMzOiBTdHJlYW08VDM+LFxuICAgIHM0OiBTdHJlYW08VDQ+LFxuICAgIHM1OiBTdHJlYW08VDU+LFxuICAgIHM2OiBTdHJlYW08VDY+KTogU3RyZWFtPFQxIHwgVDIgfCBUMyB8IFQ0IHwgVDUgfCBUNj47XG4gIDxUMSwgVDIsIFQzLCBUNCwgVDUsIFQ2LCBUNz4oXG4gICAgczE6IFN0cmVhbTxUMT4sXG4gICAgczI6IFN0cmVhbTxUMj4sXG4gICAgczM6IFN0cmVhbTxUMz4sXG4gICAgczQ6IFN0cmVhbTxUND4sXG4gICAgczU6IFN0cmVhbTxUNT4sXG4gICAgczY6IFN0cmVhbTxUNj4sXG4gICAgczc6IFN0cmVhbTxUNz4pOiBTdHJlYW08VDEgfCBUMiB8IFQzIHwgVDQgfCBUNSB8IFQ2IHwgVDc+O1xuICA8VDEsIFQyLCBUMywgVDQsIFQ1LCBUNiwgVDcsIFQ4PihcbiAgICBzMTogU3RyZWFtPFQxPixcbiAgICBzMjogU3RyZWFtPFQyPixcbiAgICBzMzogU3RyZWFtPFQzPixcbiAgICBzNDogU3RyZWFtPFQ0PixcbiAgICBzNTogU3RyZWFtPFQ1PixcbiAgICBzNjogU3RyZWFtPFQ2PixcbiAgICBzNzogU3RyZWFtPFQ3PixcbiAgICBzODogU3RyZWFtPFQ4Pik6IFN0cmVhbTxUMSB8IFQyIHwgVDMgfCBUNCB8IFQ1IHwgVDYgfCBUNyB8IFQ4PjtcbiAgPFQxLCBUMiwgVDMsIFQ0LCBUNSwgVDYsIFQ3LCBUOCwgVDk+KFxuICAgIHMxOiBTdHJlYW08VDE+LFxuICAgIHMyOiBTdHJlYW08VDI+LFxuICAgIHMzOiBTdHJlYW08VDM+LFxuICAgIHM0OiBTdHJlYW08VDQ+LFxuICAgIHM1OiBTdHJlYW08VDU+LFxuICAgIHM2OiBTdHJlYW08VDY+LFxuICAgIHM3OiBTdHJlYW08VDc+LFxuICAgIHM4OiBTdHJlYW08VDg+LFxuICAgIHM5OiBTdHJlYW08VDk+KTogU3RyZWFtPFQxIHwgVDIgfCBUMyB8IFQ0IHwgVDUgfCBUNiB8IFQ3IHwgVDggfCBUOT47XG4gIDxUMSwgVDIsIFQzLCBUNCwgVDUsIFQ2LCBUNywgVDgsIFQ5LCBUMTA+KFxuICAgIHMxOiBTdHJlYW08VDE+LFxuICAgIHMyOiBTdHJlYW08VDI+LFxuICAgIHMzOiBTdHJlYW08VDM+LFxuICAgIHM0OiBTdHJlYW08VDQ+LFxuICAgIHM1OiBTdHJlYW08VDU+LFxuICAgIHM2OiBTdHJlYW08VDY+LFxuICAgIHM3OiBTdHJlYW08VDc+LFxuICAgIHM4OiBTdHJlYW08VDg+LFxuICAgIHM5OiBTdHJlYW08VDk+LFxuICAgIHMxMDogU3RyZWFtPFQxMD4pOiBTdHJlYW08VDEgfCBUMiB8IFQzIHwgVDQgfCBUNSB8IFQ2IHwgVDcgfCBUOCB8IFQ5IHwgVDEwPjtcbiAgPFQ+KC4uLnN0cmVhbTogQXJyYXk8U3RyZWFtPFQ+Pik6IFN0cmVhbTxUPjtcbn1cblxuY2xhc3MgTWVyZ2U8VD4gaW1wbGVtZW50cyBBZ2dyZWdhdG9yPFQsIFQ+LCBJbnRlcm5hbExpc3RlbmVyPFQ+IHtcbiAgcHVibGljIHR5cGUgPSAnbWVyZ2UnO1xuICBwdWJsaWMgaW5zQXJyOiBBcnJheTxTdHJlYW08VD4+O1xuICBwdWJsaWMgb3V0OiBTdHJlYW08VD47XG4gIHByaXZhdGUgYWM6IG51bWJlcjsgLy8gYWMgaXMgYWN0aXZlQ291bnRcblxuICBjb25zdHJ1Y3RvcihpbnNBcnI6IEFycmF5PFN0cmVhbTxUPj4pIHtcbiAgICB0aGlzLmluc0FyciA9IGluc0FycjtcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxUPjtcbiAgICB0aGlzLmFjID0gMDtcbiAgfVxuXG4gIF9zdGFydChvdXQ6IFN0cmVhbTxUPik6IHZvaWQge1xuICAgIHRoaXMub3V0ID0gb3V0O1xuICAgIGNvbnN0IHMgPSB0aGlzLmluc0FycjtcbiAgICBjb25zdCBMID0gcy5sZW5ndGg7XG4gICAgdGhpcy5hYyA9IEw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBMOyBpKyspIHNbaV0uX2FkZCh0aGlzKTtcbiAgfVxuXG4gIF9zdG9wKCk6IHZvaWQge1xuICAgIGNvbnN0IHMgPSB0aGlzLmluc0FycjtcbiAgICBjb25zdCBMID0gcy5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBMOyBpKyspIHNbaV0uX3JlbW92ZSh0aGlzKTtcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxUPjtcbiAgfVxuXG4gIF9uKHQ6IFQpIHtcbiAgICBjb25zdCB1ID0gdGhpcy5vdXQ7XG4gICAgaWYgKHUgPT09IE5PKSByZXR1cm47XG4gICAgdS5fbih0KTtcbiAgfVxuXG4gIF9lKGVycjogYW55KSB7XG4gICAgY29uc3QgdSA9IHRoaXMub3V0O1xuICAgIGlmICh1ID09PSBOTykgcmV0dXJuO1xuICAgIHUuX2UoZXJyKTtcbiAgfVxuXG4gIF9jKCkge1xuICAgIGlmICgtLXRoaXMuYWMgPD0gMCkge1xuICAgICAgY29uc3QgdSA9IHRoaXMub3V0O1xuICAgICAgaWYgKHUgPT09IE5PKSByZXR1cm47XG4gICAgICB1Ll9jKCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tYmluZVNpZ25hdHVyZSB7XG4gICgpOiBTdHJlYW08QXJyYXk8YW55Pj47XG4gIDxUMT4oczE6IFN0cmVhbTxUMT4pOiBTdHJlYW08W1QxXT47XG4gIDxUMSwgVDI+KFxuICAgIHMxOiBTdHJlYW08VDE+LFxuICAgIHMyOiBTdHJlYW08VDI+KTogU3RyZWFtPFtUMSwgVDJdPjtcbiAgPFQxLCBUMiwgVDM+KFxuICAgIHMxOiBTdHJlYW08VDE+LFxuICAgIHMyOiBTdHJlYW08VDI+LFxuICAgIHMzOiBTdHJlYW08VDM+KTogU3RyZWFtPFtUMSwgVDIsIFQzXT47XG4gIDxUMSwgVDIsIFQzLCBUND4oXG4gICAgczE6IFN0cmVhbTxUMT4sXG4gICAgczI6IFN0cmVhbTxUMj4sXG4gICAgczM6IFN0cmVhbTxUMz4sXG4gICAgczQ6IFN0cmVhbTxUND4pOiBTdHJlYW08W1QxLCBUMiwgVDMsIFQ0XT47XG4gIDxUMSwgVDIsIFQzLCBUNCwgVDU+KFxuICAgIHMxOiBTdHJlYW08VDE+LFxuICAgIHMyOiBTdHJlYW08VDI+LFxuICAgIHMzOiBTdHJlYW08VDM+LFxuICAgIHM0OiBTdHJlYW08VDQ+LFxuICAgIHM1OiBTdHJlYW08VDU+KTogU3RyZWFtPFtUMSwgVDIsIFQzLCBUNCwgVDVdPjtcbiAgPFQxLCBUMiwgVDMsIFQ0LCBUNSwgVDY+KFxuICAgIHMxOiBTdHJlYW08VDE+LFxuICAgIHMyOiBTdHJlYW08VDI+LFxuICAgIHMzOiBTdHJlYW08VDM+LFxuICAgIHM0OiBTdHJlYW08VDQ+LFxuICAgIHM1OiBTdHJlYW08VDU+LFxuICAgIHM2OiBTdHJlYW08VDY+KTogU3RyZWFtPFtUMSwgVDIsIFQzLCBUNCwgVDUsIFQ2XT47XG4gIDxUMSwgVDIsIFQzLCBUNCwgVDUsIFQ2LCBUNz4oXG4gICAgczE6IFN0cmVhbTxUMT4sXG4gICAgczI6IFN0cmVhbTxUMj4sXG4gICAgczM6IFN0cmVhbTxUMz4sXG4gICAgczQ6IFN0cmVhbTxUND4sXG4gICAgczU6IFN0cmVhbTxUNT4sXG4gICAgczY6IFN0cmVhbTxUNj4sXG4gICAgczc6IFN0cmVhbTxUNz4pOiBTdHJlYW08W1QxLCBUMiwgVDMsIFQ0LCBUNSwgVDYsIFQ3XT47XG4gIDxUMSwgVDIsIFQzLCBUNCwgVDUsIFQ2LCBUNywgVDg+KFxuICAgIHMxOiBTdHJlYW08VDE+LFxuICAgIHMyOiBTdHJlYW08VDI+LFxuICAgIHMzOiBTdHJlYW08VDM+LFxuICAgIHM0OiBTdHJlYW08VDQ+LFxuICAgIHM1OiBTdHJlYW08VDU+LFxuICAgIHM2OiBTdHJlYW08VDY+LFxuICAgIHM3OiBTdHJlYW08VDc+LFxuICAgIHM4OiBTdHJlYW08VDg+KTogU3RyZWFtPFtUMSwgVDIsIFQzLCBUNCwgVDUsIFQ2LCBUNywgVDhdPjtcbiAgPFQxLCBUMiwgVDMsIFQ0LCBUNSwgVDYsIFQ3LCBUOCwgVDk+KFxuICAgIHMxOiBTdHJlYW08VDE+LFxuICAgIHMyOiBTdHJlYW08VDI+LFxuICAgIHMzOiBTdHJlYW08VDM+LFxuICAgIHM0OiBTdHJlYW08VDQ+LFxuICAgIHM1OiBTdHJlYW08VDU+LFxuICAgIHM2OiBTdHJlYW08VDY+LFxuICAgIHM3OiBTdHJlYW08VDc+LFxuICAgIHM4OiBTdHJlYW08VDg+LFxuICAgIHM5OiBTdHJlYW08VDk+KTogU3RyZWFtPFtUMSwgVDIsIFQzLCBUNCwgVDUsIFQ2LCBUNywgVDgsIFQ5XT47XG4gIDxUMSwgVDIsIFQzLCBUNCwgVDUsIFQ2LCBUNywgVDgsIFQ5LCBUMTA+KFxuICAgIHMxOiBTdHJlYW08VDE+LFxuICAgIHMyOiBTdHJlYW08VDI+LFxuICAgIHMzOiBTdHJlYW08VDM+LFxuICAgIHM0OiBTdHJlYW08VDQ+LFxuICAgIHM1OiBTdHJlYW08VDU+LFxuICAgIHM2OiBTdHJlYW08VDY+LFxuICAgIHM3OiBTdHJlYW08VDc+LFxuICAgIHM4OiBTdHJlYW08VDg+LFxuICAgIHM5OiBTdHJlYW08VDk+LFxuICAgIHMxMDogU3RyZWFtPFQxMD4pOiBTdHJlYW08W1QxLCBUMiwgVDMsIFQ0LCBUNSwgVDYsIFQ3LCBUOCwgVDksIFQxMF0+O1xuICAoLi4uc3RyZWFtOiBBcnJheTxTdHJlYW08YW55Pj4pOiBTdHJlYW08QXJyYXk8YW55Pj47XG59XG5cbmNsYXNzIENvbWJpbmVMaXN0ZW5lcjxUPiBpbXBsZW1lbnRzIEludGVybmFsTGlzdGVuZXI8VD4sIE91dFNlbmRlcjxBcnJheTxUPj4ge1xuICBwcml2YXRlIGk6IG51bWJlcjtcbiAgcHVibGljIG91dDogU3RyZWFtPEFycmF5PFQ+PjtcbiAgcHJpdmF0ZSBwOiBDb21iaW5lPFQ+O1xuXG4gIGNvbnN0cnVjdG9yKGk6IG51bWJlciwgb3V0OiBTdHJlYW08QXJyYXk8VD4+LCBwOiBDb21iaW5lPFQ+KSB7XG4gICAgdGhpcy5pID0gaTtcbiAgICB0aGlzLm91dCA9IG91dDtcbiAgICB0aGlzLnAgPSBwO1xuICAgIHAuaWxzLnB1c2godGhpcyk7XG4gIH1cblxuICBfbih0OiBUKTogdm9pZCB7XG4gICAgY29uc3QgcCA9IHRoaXMucCwgb3V0ID0gdGhpcy5vdXQ7XG4gICAgaWYgKG91dCA9PT0gTk8pIHJldHVybjtcbiAgICBpZiAocC51cCh0LCB0aGlzLmkpKSB7XG4gICAgICBjb25zdCBhID0gcC52YWxzO1xuICAgICAgY29uc3QgbCA9IGEubGVuZ3RoO1xuICAgICAgY29uc3QgYiA9IEFycmF5KGwpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsOyArK2kpIGJbaV0gPSBhW2ldO1xuICAgICAgb3V0Ll9uKGIpO1xuICAgIH1cbiAgfVxuXG4gIF9lKGVycjogYW55KTogdm9pZCB7XG4gICAgY29uc3Qgb3V0ID0gdGhpcy5vdXQ7XG4gICAgaWYgKG91dCA9PT0gTk8pIHJldHVybjtcbiAgICBvdXQuX2UoZXJyKTtcbiAgfVxuXG4gIF9jKCk6IHZvaWQge1xuICAgIGNvbnN0IHAgPSB0aGlzLnA7XG4gICAgaWYgKHAub3V0ID09PSBOTykgcmV0dXJuO1xuICAgIGlmICgtLXAuTmMgPT09IDApIHAub3V0Ll9jKCk7XG4gIH1cbn1cblxuY2xhc3MgQ29tYmluZTxSPiBpbXBsZW1lbnRzIEFnZ3JlZ2F0b3I8YW55LCBBcnJheTxSPj4ge1xuICBwdWJsaWMgdHlwZSA9ICdjb21iaW5lJztcbiAgcHVibGljIGluc0FycjogQXJyYXk8U3RyZWFtPGFueT4+O1xuICBwdWJsaWMgb3V0OiBTdHJlYW08QXJyYXk8Uj4+O1xuICBwdWJsaWMgaWxzOiBBcnJheTxDb21iaW5lTGlzdGVuZXI8YW55Pj47XG4gIHB1YmxpYyBOYzogbnVtYmVyOyAvLyAqTip1bWJlciBvZiBzdHJlYW1zIHN0aWxsIHRvIHNlbmQgKmMqb21wbGV0ZVxuICBwdWJsaWMgTm46IG51bWJlcjsgLy8gKk4qdW1iZXIgb2Ygc3RyZWFtcyBzdGlsbCB0byBzZW5kICpuKmV4dFxuICBwdWJsaWMgdmFsczogQXJyYXk8Uj47XG5cbiAgY29uc3RydWN0b3IoaW5zQXJyOiBBcnJheTxTdHJlYW08YW55Pj4pIHtcbiAgICB0aGlzLmluc0FyciA9IGluc0FycjtcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxBcnJheTxSPj47XG4gICAgdGhpcy5pbHMgPSBbXTtcbiAgICB0aGlzLk5jID0gdGhpcy5ObiA9IDA7XG4gICAgdGhpcy52YWxzID0gW107XG4gIH1cblxuICB1cCh0OiBhbnksIGk6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHYgPSB0aGlzLnZhbHNbaV07XG4gICAgY29uc3QgTm4gPSAhdGhpcy5ObiA/IDAgOiB2ID09PSBOTyA/IC0tdGhpcy5ObiA6IHRoaXMuTm47XG4gICAgdGhpcy52YWxzW2ldID0gdDtcbiAgICByZXR1cm4gTm4gPT09IDA7XG4gIH1cblxuICBfc3RhcnQob3V0OiBTdHJlYW08QXJyYXk8Uj4+KTogdm9pZCB7XG4gICAgdGhpcy5vdXQgPSBvdXQ7XG4gICAgY29uc3QgcyA9IHRoaXMuaW5zQXJyO1xuICAgIGNvbnN0IG4gPSB0aGlzLk5jID0gdGhpcy5ObiA9IHMubGVuZ3RoO1xuICAgIGNvbnN0IHZhbHMgPSB0aGlzLnZhbHMgPSBuZXcgQXJyYXkobik7XG4gICAgaWYgKG4gPT09IDApIHtcbiAgICAgIG91dC5fbihbXSk7XG4gICAgICBvdXQuX2MoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuOyBpKyspIHtcbiAgICAgICAgdmFsc1tpXSA9IE5PO1xuICAgICAgICBzW2ldLl9hZGQobmV3IENvbWJpbmVMaXN0ZW5lcihpLCBvdXQsIHRoaXMpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBfc3RvcCgpOiB2b2lkIHtcbiAgICBjb25zdCBzID0gdGhpcy5pbnNBcnI7XG4gICAgY29uc3QgbiA9IHMubGVuZ3RoO1xuICAgIGNvbnN0IGlscyA9IHRoaXMuaWxzO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbjsgaSsrKSBzW2ldLl9yZW1vdmUoaWxzW2ldKTtcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxBcnJheTxSPj47XG4gICAgdGhpcy5pbHMgPSBbXTtcbiAgICB0aGlzLnZhbHMgPSBbXTtcbiAgfVxufVxuXG5jbGFzcyBGcm9tQXJyYXk8VD4gaW1wbGVtZW50cyBJbnRlcm5hbFByb2R1Y2VyPFQ+IHtcbiAgcHVibGljIHR5cGUgPSAnZnJvbUFycmF5JztcbiAgcHVibGljIGE6IEFycmF5PFQ+O1xuXG4gIGNvbnN0cnVjdG9yKGE6IEFycmF5PFQ+KSB7XG4gICAgdGhpcy5hID0gYTtcbiAgfVxuXG4gIF9zdGFydChvdXQ6IEludGVybmFsTGlzdGVuZXI8VD4pOiB2b2lkIHtcbiAgICBjb25zdCBhID0gdGhpcy5hO1xuICAgIGZvciAobGV0IGkgPSAwLCBuID0gYS5sZW5ndGg7IGkgPCBuOyBpKyspIG91dC5fbihhW2ldKTtcbiAgICBvdXQuX2MoKTtcbiAgfVxuXG4gIF9zdG9wKCk6IHZvaWQge1xuICB9XG59XG5cbmNsYXNzIEZyb21Qcm9taXNlPFQ+IGltcGxlbWVudHMgSW50ZXJuYWxQcm9kdWNlcjxUPiB7XG4gIHB1YmxpYyB0eXBlID0gJ2Zyb21Qcm9taXNlJztcbiAgcHVibGljIG9uOiBib29sZWFuO1xuICBwdWJsaWMgcDogUHJvbWlzZUxpa2U8VD47XG5cbiAgY29uc3RydWN0b3IocDogUHJvbWlzZUxpa2U8VD4pIHtcbiAgICB0aGlzLm9uID0gZmFsc2U7XG4gICAgdGhpcy5wID0gcDtcbiAgfVxuXG4gIF9zdGFydChvdXQ6IEludGVybmFsTGlzdGVuZXI8VD4pOiB2b2lkIHtcbiAgICBjb25zdCBwcm9kID0gdGhpcztcbiAgICB0aGlzLm9uID0gdHJ1ZTtcbiAgICB0aGlzLnAudGhlbihcbiAgICAgICh2OiBUKSA9PiB7XG4gICAgICAgIGlmIChwcm9kLm9uKSB7XG4gICAgICAgICAgb3V0Ll9uKHYpO1xuICAgICAgICAgIG91dC5fYygpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgKGU6IGFueSkgPT4ge1xuICAgICAgICBvdXQuX2UoZSk7XG4gICAgICB9LFxuICAgICkudGhlbihub29wLCAoZXJyOiBhbnkpID0+IHtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4geyB0aHJvdyBlcnI7IH0pO1xuICAgIH0pO1xuICB9XG5cbiAgX3N0b3AoKTogdm9pZCB7XG4gICAgdGhpcy5vbiA9IGZhbHNlO1xuICB9XG59XG5cbmNsYXNzIFBlcmlvZGljIGltcGxlbWVudHMgSW50ZXJuYWxQcm9kdWNlcjxudW1iZXI+IHtcbiAgcHVibGljIHR5cGUgPSAncGVyaW9kaWMnO1xuICBwdWJsaWMgcGVyaW9kOiBudW1iZXI7XG4gIHByaXZhdGUgaW50ZXJ2YWxJRDogYW55O1xuICBwcml2YXRlIGk6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihwZXJpb2Q6IG51bWJlcikge1xuICAgIHRoaXMucGVyaW9kID0gcGVyaW9kO1xuICAgIHRoaXMuaW50ZXJ2YWxJRCA9IC0xO1xuICAgIHRoaXMuaSA9IDA7XG4gIH1cblxuICBfc3RhcnQob3V0OiBJbnRlcm5hbExpc3RlbmVyPG51bWJlcj4pOiB2b2lkIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBmdW5jdGlvbiBpbnRlcnZhbEhhbmRsZXIoKSB7IG91dC5fbihzZWxmLmkrKyk7IH1cbiAgICB0aGlzLmludGVydmFsSUQgPSBzZXRJbnRlcnZhbChpbnRlcnZhbEhhbmRsZXIsIHRoaXMucGVyaW9kKTtcbiAgfVxuXG4gIF9zdG9wKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmludGVydmFsSUQgIT09IC0xKSBjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWxJRCk7XG4gICAgdGhpcy5pbnRlcnZhbElEID0gLTE7XG4gICAgdGhpcy5pID0gMDtcbiAgfVxufVxuXG5jbGFzcyBEZWJ1ZzxUPiBpbXBsZW1lbnRzIE9wZXJhdG9yPFQsIFQ+IHtcbiAgcHVibGljIHR5cGUgPSAnZGVidWcnO1xuICBwdWJsaWMgaW5zOiBTdHJlYW08VD47XG4gIHB1YmxpYyBvdXQ6IFN0cmVhbTxUPjtcbiAgcHJpdmF0ZSBzOiAodDogVCkgPT4gYW55OyAvLyBzcHlcbiAgcHJpdmF0ZSBsOiBzdHJpbmc7IC8vIGxhYmVsXG5cbiAgY29uc3RydWN0b3IoaW5zOiBTdHJlYW08VD4pO1xuICBjb25zdHJ1Y3RvcihpbnM6IFN0cmVhbTxUPiwgYXJnPzogc3RyaW5nKTtcbiAgY29uc3RydWN0b3IoaW5zOiBTdHJlYW08VD4sIGFyZz86ICh0OiBUKSA9PiBhbnkpO1xuICBjb25zdHJ1Y3RvcihpbnM6IFN0cmVhbTxUPiwgYXJnPzogc3RyaW5nIHwgKCh0OiBUKSA9PiBhbnkpKTtcbiAgY29uc3RydWN0b3IoaW5zOiBTdHJlYW08VD4sIGFyZz86IHN0cmluZyB8ICgodDogVCkgPT4gYW55KSB8IHVuZGVmaW5lZCkge1xuICAgIHRoaXMuaW5zID0gaW5zO1xuICAgIHRoaXMub3V0ID0gTk8gYXMgU3RyZWFtPFQ+O1xuICAgIHRoaXMucyA9IG5vb3A7XG4gICAgdGhpcy5sID0gJyc7XG4gICAgaWYgKHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnKSB0aGlzLmwgPSBhcmc7IGVsc2UgaWYgKHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbicpIHRoaXMucyA9IGFyZztcbiAgfVxuXG4gIF9zdGFydChvdXQ6IFN0cmVhbTxUPik6IHZvaWQge1xuICAgIHRoaXMub3V0ID0gb3V0O1xuICAgIHRoaXMuaW5zLl9hZGQodGhpcyk7XG4gIH1cblxuICBfc3RvcCgpOiB2b2lkIHtcbiAgICB0aGlzLmlucy5fcmVtb3ZlKHRoaXMpO1xuICAgIHRoaXMub3V0ID0gTk8gYXMgU3RyZWFtPFQ+O1xuICB9XG5cbiAgX24odDogVCkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICBjb25zdCBzID0gdGhpcy5zLCBsID0gdGhpcy5sO1xuICAgIGlmIChzICE9PSBub29wKSB7XG4gICAgICB0cnkge1xuICAgICAgICBzKHQpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB1Ll9lKGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobCkgY29uc29sZS5sb2cobCArICc6JywgdCk7IGVsc2UgY29uc29sZS5sb2codCk7XG4gICAgdS5fbih0KTtcbiAgfVxuXG4gIF9lKGVycjogYW55KSB7XG4gICAgY29uc3QgdSA9IHRoaXMub3V0O1xuICAgIGlmICh1ID09PSBOTykgcmV0dXJuO1xuICAgIHUuX2UoZXJyKTtcbiAgfVxuXG4gIF9jKCkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICB1Ll9jKCk7XG4gIH1cbn1cblxuY2xhc3MgRHJvcDxUPiBpbXBsZW1lbnRzIE9wZXJhdG9yPFQsIFQ+IHtcbiAgcHVibGljIHR5cGUgPSAnZHJvcCc7XG4gIHB1YmxpYyBpbnM6IFN0cmVhbTxUPjtcbiAgcHVibGljIG91dDogU3RyZWFtPFQ+O1xuICBwdWJsaWMgbWF4OiBudW1iZXI7XG4gIHByaXZhdGUgZHJvcHBlZDogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKG1heDogbnVtYmVyLCBpbnM6IFN0cmVhbTxUPikge1xuICAgIHRoaXMuaW5zID0gaW5zO1xuICAgIHRoaXMub3V0ID0gTk8gYXMgU3RyZWFtPFQ+O1xuICAgIHRoaXMubWF4ID0gbWF4O1xuICAgIHRoaXMuZHJvcHBlZCA9IDA7XG4gIH1cblxuICBfc3RhcnQob3V0OiBTdHJlYW08VD4pOiB2b2lkIHtcbiAgICB0aGlzLm91dCA9IG91dDtcbiAgICB0aGlzLmRyb3BwZWQgPSAwO1xuICAgIHRoaXMuaW5zLl9hZGQodGhpcyk7XG4gIH1cblxuICBfc3RvcCgpOiB2b2lkIHtcbiAgICB0aGlzLmlucy5fcmVtb3ZlKHRoaXMpO1xuICAgIHRoaXMub3V0ID0gTk8gYXMgU3RyZWFtPFQ+O1xuICB9XG5cbiAgX24odDogVCkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICBpZiAodGhpcy5kcm9wcGVkKysgPj0gdGhpcy5tYXgpIHUuX24odCk7XG4gIH1cblxuICBfZShlcnI6IGFueSkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICB1Ll9lKGVycik7XG4gIH1cblxuICBfYygpIHtcbiAgICBjb25zdCB1ID0gdGhpcy5vdXQ7XG4gICAgaWYgKHUgPT09IE5PKSByZXR1cm47XG4gICAgdS5fYygpO1xuICB9XG59XG5cbmNsYXNzIEVuZFdoZW5MaXN0ZW5lcjxUPiBpbXBsZW1lbnRzIEludGVybmFsTGlzdGVuZXI8YW55PiB7XG4gIHByaXZhdGUgb3V0OiBTdHJlYW08VD47XG4gIHByaXZhdGUgb3A6IEVuZFdoZW48VD47XG5cbiAgY29uc3RydWN0b3Iob3V0OiBTdHJlYW08VD4sIG9wOiBFbmRXaGVuPFQ+KSB7XG4gICAgdGhpcy5vdXQgPSBvdXQ7XG4gICAgdGhpcy5vcCA9IG9wO1xuICB9XG5cbiAgX24oKSB7XG4gICAgdGhpcy5vcC5lbmQoKTtcbiAgfVxuXG4gIF9lKGVycjogYW55KSB7XG4gICAgdGhpcy5vdXQuX2UoZXJyKTtcbiAgfVxuXG4gIF9jKCkge1xuICAgIHRoaXMub3AuZW5kKCk7XG4gIH1cbn1cblxuY2xhc3MgRW5kV2hlbjxUPiBpbXBsZW1lbnRzIE9wZXJhdG9yPFQsIFQ+IHtcbiAgcHVibGljIHR5cGUgPSAnZW5kV2hlbic7XG4gIHB1YmxpYyBpbnM6IFN0cmVhbTxUPjtcbiAgcHVibGljIG91dDogU3RyZWFtPFQ+O1xuICBwdWJsaWMgbzogU3RyZWFtPGFueT47IC8vIG8gPSBvdGhlclxuICBwcml2YXRlIG9pbDogSW50ZXJuYWxMaXN0ZW5lcjxhbnk+OyAvLyBvaWwgPSBvdGhlciBJbnRlcm5hbExpc3RlbmVyXG5cbiAgY29uc3RydWN0b3IobzogU3RyZWFtPGFueT4sIGluczogU3RyZWFtPFQ+KSB7XG4gICAgdGhpcy5pbnMgPSBpbnM7XG4gICAgdGhpcy5vdXQgPSBOTyBhcyBTdHJlYW08VD47XG4gICAgdGhpcy5vID0gbztcbiAgICB0aGlzLm9pbCA9IE5PX0lMO1xuICB9XG5cbiAgX3N0YXJ0KG91dDogU3RyZWFtPFQ+KTogdm9pZCB7XG4gICAgdGhpcy5vdXQgPSBvdXQ7XG4gICAgdGhpcy5vLl9hZGQodGhpcy5vaWwgPSBuZXcgRW5kV2hlbkxpc3RlbmVyKG91dCwgdGhpcykpO1xuICAgIHRoaXMuaW5zLl9hZGQodGhpcyk7XG4gIH1cblxuICBfc3RvcCgpOiB2b2lkIHtcbiAgICB0aGlzLmlucy5fcmVtb3ZlKHRoaXMpO1xuICAgIHRoaXMuby5fcmVtb3ZlKHRoaXMub2lsKTtcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxUPjtcbiAgICB0aGlzLm9pbCA9IE5PX0lMO1xuICB9XG5cbiAgZW5kKCk6IHZvaWQge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICB1Ll9jKCk7XG4gIH1cblxuICBfbih0OiBUKSB7XG4gICAgY29uc3QgdSA9IHRoaXMub3V0O1xuICAgIGlmICh1ID09PSBOTykgcmV0dXJuO1xuICAgIHUuX24odCk7XG4gIH1cblxuICBfZShlcnI6IGFueSkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICB1Ll9lKGVycik7XG4gIH1cblxuICBfYygpIHtcbiAgICB0aGlzLmVuZCgpO1xuICB9XG59XG5cbmNsYXNzIEZpbHRlcjxUPiBpbXBsZW1lbnRzIE9wZXJhdG9yPFQsIFQ+IHtcbiAgcHVibGljIHR5cGUgPSAnZmlsdGVyJztcbiAgcHVibGljIGluczogU3RyZWFtPFQ+O1xuICBwdWJsaWMgb3V0OiBTdHJlYW08VD47XG4gIHB1YmxpYyBmOiAodDogVCkgPT4gYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihwYXNzZXM6ICh0OiBUKSA9PiBib29sZWFuLCBpbnM6IFN0cmVhbTxUPikge1xuICAgIHRoaXMuaW5zID0gaW5zO1xuICAgIHRoaXMub3V0ID0gTk8gYXMgU3RyZWFtPFQ+O1xuICAgIHRoaXMuZiA9IHBhc3NlcztcbiAgfVxuXG4gIF9zdGFydChvdXQ6IFN0cmVhbTxUPik6IHZvaWQge1xuICAgIHRoaXMub3V0ID0gb3V0O1xuICAgIHRoaXMuaW5zLl9hZGQodGhpcyk7XG4gIH1cblxuICBfc3RvcCgpOiB2b2lkIHtcbiAgICB0aGlzLmlucy5fcmVtb3ZlKHRoaXMpO1xuICAgIHRoaXMub3V0ID0gTk8gYXMgU3RyZWFtPFQ+O1xuICB9XG5cbiAgX24odDogVCkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICBjb25zdCByID0gX3RyeSh0aGlzLCB0LCB1KTtcbiAgICBpZiAociA9PT0gTk8gfHwgIXIpIHJldHVybjtcbiAgICB1Ll9uKHQpO1xuICB9XG5cbiAgX2UoZXJyOiBhbnkpIHtcbiAgICBjb25zdCB1ID0gdGhpcy5vdXQ7XG4gICAgaWYgKHUgPT09IE5PKSByZXR1cm47XG4gICAgdS5fZShlcnIpO1xuICB9XG5cbiAgX2MoKSB7XG4gICAgY29uc3QgdSA9IHRoaXMub3V0O1xuICAgIGlmICh1ID09PSBOTykgcmV0dXJuO1xuICAgIHUuX2MoKTtcbiAgfVxufVxuXG5jbGFzcyBGbGF0dGVuTGlzdGVuZXI8VD4gaW1wbGVtZW50cyBJbnRlcm5hbExpc3RlbmVyPFQ+IHtcbiAgcHJpdmF0ZSBvdXQ6IFN0cmVhbTxUPjtcbiAgcHJpdmF0ZSBvcDogRmxhdHRlbjxUPjtcblxuICBjb25zdHJ1Y3RvcihvdXQ6IFN0cmVhbTxUPiwgb3A6IEZsYXR0ZW48VD4pIHtcbiAgICB0aGlzLm91dCA9IG91dDtcbiAgICB0aGlzLm9wID0gb3A7XG4gIH1cblxuICBfbih0OiBUKSB7XG4gICAgdGhpcy5vdXQuX24odCk7XG4gIH1cblxuICBfZShlcnI6IGFueSkge1xuICAgIHRoaXMub3V0Ll9lKGVycik7XG4gIH1cblxuICBfYygpIHtcbiAgICB0aGlzLm9wLmlubmVyID0gTk8gYXMgU3RyZWFtPFQ+O1xuICAgIHRoaXMub3AubGVzcygpO1xuICB9XG59XG5cbmNsYXNzIEZsYXR0ZW48VD4gaW1wbGVtZW50cyBPcGVyYXRvcjxTdHJlYW08VD4sIFQ+IHtcbiAgcHVibGljIHR5cGUgPSAnZmxhdHRlbic7XG4gIHB1YmxpYyBpbnM6IFN0cmVhbTxTdHJlYW08VD4+O1xuICBwdWJsaWMgb3V0OiBTdHJlYW08VD47XG4gIHByaXZhdGUgb3BlbjogYm9vbGVhbjtcbiAgcHVibGljIGlubmVyOiBTdHJlYW08VD47IC8vIEN1cnJlbnQgaW5uZXIgU3RyZWFtXG4gIHByaXZhdGUgaWw6IEludGVybmFsTGlzdGVuZXI8VD47IC8vIEN1cnJlbnQgaW5uZXIgSW50ZXJuYWxMaXN0ZW5lclxuXG4gIGNvbnN0cnVjdG9yKGluczogU3RyZWFtPFN0cmVhbTxUPj4pIHtcbiAgICB0aGlzLmlucyA9IGlucztcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxUPjtcbiAgICB0aGlzLm9wZW4gPSB0cnVlO1xuICAgIHRoaXMuaW5uZXIgPSBOTyBhcyBTdHJlYW08VD47XG4gICAgdGhpcy5pbCA9IE5PX0lMO1xuICB9XG5cbiAgX3N0YXJ0KG91dDogU3RyZWFtPFQ+KTogdm9pZCB7XG4gICAgdGhpcy5vdXQgPSBvdXQ7XG4gICAgdGhpcy5vcGVuID0gdHJ1ZTtcbiAgICB0aGlzLmlubmVyID0gTk8gYXMgU3RyZWFtPFQ+O1xuICAgIHRoaXMuaWwgPSBOT19JTDtcbiAgICB0aGlzLmlucy5fYWRkKHRoaXMpO1xuICB9XG5cbiAgX3N0b3AoKTogdm9pZCB7XG4gICAgdGhpcy5pbnMuX3JlbW92ZSh0aGlzKTtcbiAgICBpZiAodGhpcy5pbm5lciAhPT0gTk8pIHRoaXMuaW5uZXIuX3JlbW92ZSh0aGlzLmlsKTtcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxUPjtcbiAgICB0aGlzLm9wZW4gPSB0cnVlO1xuICAgIHRoaXMuaW5uZXIgPSBOTyBhcyBTdHJlYW08VD47XG4gICAgdGhpcy5pbCA9IE5PX0lMO1xuICB9XG5cbiAgbGVzcygpOiB2b2lkIHtcbiAgICBjb25zdCB1ID0gdGhpcy5vdXQ7XG4gICAgaWYgKHUgPT09IE5PKSByZXR1cm47XG4gICAgaWYgKCF0aGlzLm9wZW4gJiYgdGhpcy5pbm5lciA9PT0gTk8pIHUuX2MoKTtcbiAgfVxuXG4gIF9uKHM6IFN0cmVhbTxUPikge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICBjb25zdCB7aW5uZXIsIGlsfSA9IHRoaXM7XG4gICAgaWYgKGlubmVyICE9PSBOTyAmJiBpbCAhPT0gTk9fSUwpIGlubmVyLl9yZW1vdmUoaWwpO1xuICAgICh0aGlzLmlubmVyID0gcykuX2FkZCh0aGlzLmlsID0gbmV3IEZsYXR0ZW5MaXN0ZW5lcih1LCB0aGlzKSk7XG4gIH1cblxuICBfZShlcnI6IGFueSkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICB1Ll9lKGVycik7XG4gIH1cblxuICBfYygpIHtcbiAgICB0aGlzLm9wZW4gPSBmYWxzZTtcbiAgICB0aGlzLmxlc3MoKTtcbiAgfVxufVxuXG5jbGFzcyBGb2xkPFQsIFI+IGltcGxlbWVudHMgT3BlcmF0b3I8VCwgUj4ge1xuICBwdWJsaWMgdHlwZSA9ICdmb2xkJztcbiAgcHVibGljIGluczogU3RyZWFtPFQ+O1xuICBwdWJsaWMgb3V0OiBTdHJlYW08Uj47XG4gIHB1YmxpYyBmOiAodDogVCkgPT4gUjtcbiAgcHVibGljIHNlZWQ6IFI7XG4gIHByaXZhdGUgYWNjOiBSOyAvLyBpbml0aWFsaXplZCBhcyBzZWVkXG5cbiAgY29uc3RydWN0b3IoZjogKGFjYzogUiwgdDogVCkgPT4gUiwgc2VlZDogUiwgaW5zOiBTdHJlYW08VD4pIHtcbiAgICB0aGlzLmlucyA9IGlucztcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxSPjtcbiAgICB0aGlzLmYgPSAodDogVCkgPT4gZih0aGlzLmFjYywgdCk7XG4gICAgdGhpcy5hY2MgPSB0aGlzLnNlZWQgPSBzZWVkO1xuICB9XG5cbiAgX3N0YXJ0KG91dDogU3RyZWFtPFI+KTogdm9pZCB7XG4gICAgdGhpcy5vdXQgPSBvdXQ7XG4gICAgdGhpcy5hY2MgPSB0aGlzLnNlZWQ7XG4gICAgb3V0Ll9uKHRoaXMuYWNjKTtcbiAgICB0aGlzLmlucy5fYWRkKHRoaXMpO1xuICB9XG5cbiAgX3N0b3AoKTogdm9pZCB7XG4gICAgdGhpcy5pbnMuX3JlbW92ZSh0aGlzKTtcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxSPjtcbiAgICB0aGlzLmFjYyA9IHRoaXMuc2VlZDtcbiAgfVxuXG4gIF9uKHQ6IFQpIHtcbiAgICBjb25zdCB1ID0gdGhpcy5vdXQ7XG4gICAgaWYgKHUgPT09IE5PKSByZXR1cm47XG4gICAgY29uc3QgciA9IF90cnkodGhpcywgdCwgdSk7XG4gICAgaWYgKHIgPT09IE5PKSByZXR1cm47XG4gICAgdS5fbih0aGlzLmFjYyA9IHIgYXMgUik7XG4gIH1cblxuICBfZShlcnI6IGFueSkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICB1Ll9lKGVycik7XG4gIH1cblxuICBfYygpIHtcbiAgICBjb25zdCB1ID0gdGhpcy5vdXQ7XG4gICAgaWYgKHUgPT09IE5PKSByZXR1cm47XG4gICAgdS5fYygpO1xuICB9XG59XG5cbmNsYXNzIExhc3Q8VD4gaW1wbGVtZW50cyBPcGVyYXRvcjxULCBUPiB7XG4gIHB1YmxpYyB0eXBlID0gJ2xhc3QnO1xuICBwdWJsaWMgaW5zOiBTdHJlYW08VD47XG4gIHB1YmxpYyBvdXQ6IFN0cmVhbTxUPjtcbiAgcHJpdmF0ZSBoYXM6IGJvb2xlYW47XG4gIHByaXZhdGUgdmFsOiBUO1xuXG4gIGNvbnN0cnVjdG9yKGluczogU3RyZWFtPFQ+KSB7XG4gICAgdGhpcy5pbnMgPSBpbnM7XG4gICAgdGhpcy5vdXQgPSBOTyBhcyBTdHJlYW08VD47XG4gICAgdGhpcy5oYXMgPSBmYWxzZTtcbiAgICB0aGlzLnZhbCA9IE5PIGFzIFQ7XG4gIH1cblxuICBfc3RhcnQob3V0OiBTdHJlYW08VD4pOiB2b2lkIHtcbiAgICB0aGlzLm91dCA9IG91dDtcbiAgICB0aGlzLmhhcyA9IGZhbHNlO1xuICAgIHRoaXMuaW5zLl9hZGQodGhpcyk7XG4gIH1cblxuICBfc3RvcCgpOiB2b2lkIHtcbiAgICB0aGlzLmlucy5fcmVtb3ZlKHRoaXMpO1xuICAgIHRoaXMub3V0ID0gTk8gYXMgU3RyZWFtPFQ+O1xuICAgIHRoaXMudmFsID0gTk8gYXMgVDtcbiAgfVxuXG4gIF9uKHQ6IFQpIHtcbiAgICB0aGlzLmhhcyA9IHRydWU7XG4gICAgdGhpcy52YWwgPSB0O1xuICB9XG5cbiAgX2UoZXJyOiBhbnkpIHtcbiAgICBjb25zdCB1ID0gdGhpcy5vdXQ7XG4gICAgaWYgKHUgPT09IE5PKSByZXR1cm47XG4gICAgdS5fZShlcnIpO1xuICB9XG5cbiAgX2MoKSB7XG4gICAgY29uc3QgdSA9IHRoaXMub3V0O1xuICAgIGlmICh1ID09PSBOTykgcmV0dXJuO1xuICAgIGlmICh0aGlzLmhhcykge1xuICAgICAgdS5fbih0aGlzLnZhbCk7XG4gICAgICB1Ll9jKCk7XG4gICAgfSBlbHNlIHUuX2UobmV3IEVycm9yKCdsYXN0KCkgZmFpbGVkIGJlY2F1c2UgaW5wdXQgc3RyZWFtIGNvbXBsZXRlZCcpKTtcbiAgfVxufVxuXG5jbGFzcyBNYXBPcDxULCBSPiBpbXBsZW1lbnRzIE9wZXJhdG9yPFQsIFI+IHtcbiAgcHVibGljIHR5cGUgPSAnbWFwJztcbiAgcHVibGljIGluczogU3RyZWFtPFQ+O1xuICBwdWJsaWMgb3V0OiBTdHJlYW08Uj47XG4gIHB1YmxpYyBmOiAodDogVCkgPT4gUjtcblxuICBjb25zdHJ1Y3Rvcihwcm9qZWN0OiAodDogVCkgPT4gUiwgaW5zOiBTdHJlYW08VD4pIHtcbiAgICB0aGlzLmlucyA9IGlucztcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxSPjtcbiAgICB0aGlzLmYgPSBwcm9qZWN0O1xuICB9XG5cbiAgX3N0YXJ0KG91dDogU3RyZWFtPFI+KTogdm9pZCB7XG4gICAgdGhpcy5vdXQgPSBvdXQ7XG4gICAgdGhpcy5pbnMuX2FkZCh0aGlzKTtcbiAgfVxuXG4gIF9zdG9wKCk6IHZvaWQge1xuICAgIHRoaXMuaW5zLl9yZW1vdmUodGhpcyk7XG4gICAgdGhpcy5vdXQgPSBOTyBhcyBTdHJlYW08Uj47XG4gIH1cblxuICBfbih0OiBUKSB7XG4gICAgY29uc3QgdSA9IHRoaXMub3V0O1xuICAgIGlmICh1ID09PSBOTykgcmV0dXJuO1xuICAgIGNvbnN0IHIgPSBfdHJ5KHRoaXMsIHQsIHUpO1xuICAgIGlmIChyID09PSBOTykgcmV0dXJuO1xuICAgIHUuX24ociBhcyBSKTtcbiAgfVxuXG4gIF9lKGVycjogYW55KSB7XG4gICAgY29uc3QgdSA9IHRoaXMub3V0O1xuICAgIGlmICh1ID09PSBOTykgcmV0dXJuO1xuICAgIHUuX2UoZXJyKTtcbiAgfVxuXG4gIF9jKCkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICB1Ll9jKCk7XG4gIH1cbn1cblxuY2xhc3MgUmVtZW1iZXI8VD4gaW1wbGVtZW50cyBJbnRlcm5hbFByb2R1Y2VyPFQ+IHtcbiAgcHVibGljIHR5cGUgPSAncmVtZW1iZXInO1xuICBwdWJsaWMgaW5zOiBTdHJlYW08VD47XG4gIHB1YmxpYyBvdXQ6IFN0cmVhbTxUPjtcblxuICBjb25zdHJ1Y3RvcihpbnM6IFN0cmVhbTxUPikge1xuICAgIHRoaXMuaW5zID0gaW5zO1xuICAgIHRoaXMub3V0ID0gTk8gYXMgU3RyZWFtPFQ+O1xuICB9XG5cbiAgX3N0YXJ0KG91dDogU3RyZWFtPFQ+KTogdm9pZCB7XG4gICAgdGhpcy5vdXQgPSBvdXQ7XG4gICAgdGhpcy5pbnMuX2FkZChvdXQpO1xuICB9XG5cbiAgX3N0b3AoKTogdm9pZCB7XG4gICAgdGhpcy5pbnMuX3JlbW92ZSh0aGlzLm91dCk7XG4gICAgdGhpcy5vdXQgPSBOTyBhcyBTdHJlYW08VD47XG4gIH1cbn1cblxuY2xhc3MgUmVwbGFjZUVycm9yPFQ+IGltcGxlbWVudHMgT3BlcmF0b3I8VCwgVD4ge1xuICBwdWJsaWMgdHlwZSA9ICdyZXBsYWNlRXJyb3InO1xuICBwdWJsaWMgaW5zOiBTdHJlYW08VD47XG4gIHB1YmxpYyBvdXQ6IFN0cmVhbTxUPjtcbiAgcHVibGljIGY6IChlcnI6IGFueSkgPT4gU3RyZWFtPFQ+O1xuXG4gIGNvbnN0cnVjdG9yKHJlcGxhY2VyOiAoZXJyOiBhbnkpID0+IFN0cmVhbTxUPiwgaW5zOiBTdHJlYW08VD4pIHtcbiAgICB0aGlzLmlucyA9IGlucztcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxUPjtcbiAgICB0aGlzLmYgPSByZXBsYWNlcjtcbiAgfVxuXG4gIF9zdGFydChvdXQ6IFN0cmVhbTxUPik6IHZvaWQge1xuICAgIHRoaXMub3V0ID0gb3V0O1xuICAgIHRoaXMuaW5zLl9hZGQodGhpcyk7XG4gIH1cblxuICBfc3RvcCgpOiB2b2lkIHtcbiAgICB0aGlzLmlucy5fcmVtb3ZlKHRoaXMpO1xuICAgIHRoaXMub3V0ID0gTk8gYXMgU3RyZWFtPFQ+O1xuICB9XG5cbiAgX24odDogVCkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICB1Ll9uKHQpO1xuICB9XG5cbiAgX2UoZXJyOiBhbnkpIHtcbiAgICBjb25zdCB1ID0gdGhpcy5vdXQ7XG4gICAgaWYgKHUgPT09IE5PKSByZXR1cm47XG4gICAgdHJ5IHtcbiAgICAgIHRoaXMuaW5zLl9yZW1vdmUodGhpcyk7XG4gICAgICAodGhpcy5pbnMgPSB0aGlzLmYoZXJyKSkuX2FkZCh0aGlzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB1Ll9lKGUpO1xuICAgIH1cbiAgfVxuXG4gIF9jKCkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICB1Ll9jKCk7XG4gIH1cbn1cblxuY2xhc3MgU3RhcnRXaXRoPFQ+IGltcGxlbWVudHMgSW50ZXJuYWxQcm9kdWNlcjxUPiB7XG4gIHB1YmxpYyB0eXBlID0gJ3N0YXJ0V2l0aCc7XG4gIHB1YmxpYyBpbnM6IFN0cmVhbTxUPjtcbiAgcHVibGljIG91dDogU3RyZWFtPFQ+O1xuICBwdWJsaWMgdmFsOiBUO1xuXG4gIGNvbnN0cnVjdG9yKGluczogU3RyZWFtPFQ+LCB2YWw6IFQpIHtcbiAgICB0aGlzLmlucyA9IGlucztcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxUPjtcbiAgICB0aGlzLnZhbCA9IHZhbDtcbiAgfVxuXG4gIF9zdGFydChvdXQ6IFN0cmVhbTxUPik6IHZvaWQge1xuICAgIHRoaXMub3V0ID0gb3V0O1xuICAgIHRoaXMub3V0Ll9uKHRoaXMudmFsKTtcbiAgICB0aGlzLmlucy5fYWRkKG91dCk7XG4gIH1cblxuICBfc3RvcCgpOiB2b2lkIHtcbiAgICB0aGlzLmlucy5fcmVtb3ZlKHRoaXMub3V0KTtcbiAgICB0aGlzLm91dCA9IE5PIGFzIFN0cmVhbTxUPjtcbiAgfVxufVxuXG5jbGFzcyBUYWtlPFQ+IGltcGxlbWVudHMgT3BlcmF0b3I8VCwgVD4ge1xuICBwdWJsaWMgdHlwZSA9ICd0YWtlJztcbiAgcHVibGljIGluczogU3RyZWFtPFQ+O1xuICBwdWJsaWMgb3V0OiBTdHJlYW08VD47XG4gIHB1YmxpYyBtYXg6IG51bWJlcjtcbiAgcHJpdmF0ZSB0YWtlbjogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKG1heDogbnVtYmVyLCBpbnM6IFN0cmVhbTxUPikge1xuICAgIHRoaXMuaW5zID0gaW5zO1xuICAgIHRoaXMub3V0ID0gTk8gYXMgU3RyZWFtPFQ+O1xuICAgIHRoaXMubWF4ID0gbWF4O1xuICAgIHRoaXMudGFrZW4gPSAwO1xuICB9XG5cbiAgX3N0YXJ0KG91dDogU3RyZWFtPFQ+KTogdm9pZCB7XG4gICAgdGhpcy5vdXQgPSBvdXQ7XG4gICAgdGhpcy50YWtlbiA9IDA7XG4gICAgaWYgKHRoaXMubWF4IDw9IDApIG91dC5fYygpOyBlbHNlIHRoaXMuaW5zLl9hZGQodGhpcyk7XG4gIH1cblxuICBfc3RvcCgpOiB2b2lkIHtcbiAgICB0aGlzLmlucy5fcmVtb3ZlKHRoaXMpO1xuICAgIHRoaXMub3V0ID0gTk8gYXMgU3RyZWFtPFQ+O1xuICB9XG5cbiAgX24odDogVCkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICBjb25zdCBtID0gKyt0aGlzLnRha2VuO1xuICAgIGlmIChtIDwgdGhpcy5tYXgpIHUuX24odCk7IGVsc2UgaWYgKG0gPT09IHRoaXMubWF4KSB7XG4gICAgICB1Ll9uKHQpO1xuICAgICAgdS5fYygpO1xuICAgIH1cbiAgfVxuXG4gIF9lKGVycjogYW55KSB7XG4gICAgY29uc3QgdSA9IHRoaXMub3V0O1xuICAgIGlmICh1ID09PSBOTykgcmV0dXJuO1xuICAgIHUuX2UoZXJyKTtcbiAgfVxuXG4gIF9jKCkge1xuICAgIGNvbnN0IHUgPSB0aGlzLm91dDtcbiAgICBpZiAodSA9PT0gTk8pIHJldHVybjtcbiAgICB1Ll9jKCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0cmVhbTxUPiBpbXBsZW1lbnRzIEludGVybmFsTGlzdGVuZXI8VD4ge1xuICBwdWJsaWMgX3Byb2Q6IEludGVybmFsUHJvZHVjZXI8VD47XG4gIHByb3RlY3RlZCBfaWxzOiBBcnJheTxJbnRlcm5hbExpc3RlbmVyPFQ+PjsgLy8gJ2lscycgPSBJbnRlcm5hbCBsaXN0ZW5lcnNcbiAgcHJvdGVjdGVkIF9zdG9wSUQ6IGFueTtcbiAgcHJvdGVjdGVkIF9kbDogSW50ZXJuYWxMaXN0ZW5lcjxUPjsgLy8gdGhlIGRlYnVnIGxpc3RlbmVyXG4gIHByb3RlY3RlZCBfZDogYm9vbGVhbjsgLy8gZmxhZyBpbmRpY2F0aW5nIHRoZSBleGlzdGVuY2Ugb2YgdGhlIGRlYnVnIGxpc3RlbmVyXG4gIHByb3RlY3RlZCBfdGFyZ2V0OiBTdHJlYW08VD47IC8vIGltaXRhdGlvbiB0YXJnZXQgaWYgdGhpcyBTdHJlYW0gd2lsbCBpbWl0YXRlXG4gIHByb3RlY3RlZCBfZXJyOiBhbnk7XG5cbiAgY29uc3RydWN0b3IocHJvZHVjZXI/OiBJbnRlcm5hbFByb2R1Y2VyPFQ+KSB7XG4gICAgdGhpcy5fcHJvZCA9IHByb2R1Y2VyIHx8IE5PIGFzIEludGVybmFsUHJvZHVjZXI8VD47XG4gICAgdGhpcy5faWxzID0gW107XG4gICAgdGhpcy5fc3RvcElEID0gTk87XG4gICAgdGhpcy5fZGwgPSBOTyBhcyBJbnRlcm5hbExpc3RlbmVyPFQ+O1xuICAgIHRoaXMuX2QgPSBmYWxzZTtcbiAgICB0aGlzLl90YXJnZXQgPSBOTyBhcyBTdHJlYW08VD47XG4gICAgdGhpcy5fZXJyID0gTk87XG4gIH1cblxuICBfbih0OiBUKTogdm9pZCB7XG4gICAgY29uc3QgYSA9IHRoaXMuX2lscztcbiAgICBjb25zdCBMID0gYS5sZW5ndGg7XG4gICAgaWYgKHRoaXMuX2QpIHRoaXMuX2RsLl9uKHQpO1xuICAgIGlmIChMID09IDEpIGFbMF0uX24odCk7IGVsc2UgaWYgKEwgPT0gMCkgcmV0dXJuOyBlbHNlIHtcbiAgICAgIGNvbnN0IGIgPSBjcChhKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgTDsgaSsrKSBiW2ldLl9uKHQpO1xuICAgIH1cbiAgfVxuXG4gIF9lKGVycjogYW55KTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2VyciAhPT0gTk8pIHJldHVybjtcbiAgICB0aGlzLl9lcnIgPSBlcnI7XG4gICAgY29uc3QgYSA9IHRoaXMuX2lscztcbiAgICBjb25zdCBMID0gYS5sZW5ndGg7XG4gICAgdGhpcy5feCgpO1xuICAgIGlmICh0aGlzLl9kKSB0aGlzLl9kbC5fZShlcnIpO1xuICAgIGlmIChMID09IDEpIGFbMF0uX2UoZXJyKTsgZWxzZSBpZiAoTCA9PSAwKSByZXR1cm47IGVsc2Uge1xuICAgICAgY29uc3QgYiA9IGNwKGEpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBMOyBpKyspIGJbaV0uX2UoZXJyKTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLl9kICYmIEwgPT0gMCkgdGhyb3cgdGhpcy5fZXJyO1xuICB9XG5cbiAgX2MoKTogdm9pZCB7XG4gICAgY29uc3QgYSA9IHRoaXMuX2lscztcbiAgICBjb25zdCBMID0gYS5sZW5ndGg7XG4gICAgdGhpcy5feCgpO1xuICAgIGlmICh0aGlzLl9kKSB0aGlzLl9kbC5fYygpO1xuICAgIGlmIChMID09IDEpIGFbMF0uX2MoKTsgZWxzZSBpZiAoTCA9PSAwKSByZXR1cm47IGVsc2Uge1xuICAgICAgY29uc3QgYiA9IGNwKGEpO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBMOyBpKyspIGJbaV0uX2MoKTtcbiAgICB9XG4gIH1cblxuICBfeCgpOiB2b2lkIHsgLy8gdGVhciBkb3duIGxvZ2ljLCBhZnRlciBlcnJvciBvciBjb21wbGV0ZVxuICAgIGlmICh0aGlzLl9pbHMubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgaWYgKHRoaXMuX3Byb2QgIT09IE5PKSB0aGlzLl9wcm9kLl9zdG9wKCk7XG4gICAgdGhpcy5fZXJyID0gTk87XG4gICAgdGhpcy5faWxzID0gW107XG4gIH1cblxuICBfc3RvcE5vdygpIHtcbiAgICAvLyBXQVJOSU5HOiBjb2RlIHRoYXQgY2FsbHMgdGhpcyBtZXRob2Qgc2hvdWxkXG4gICAgLy8gZmlyc3QgY2hlY2sgaWYgdGhpcy5fcHJvZCBpcyB2YWxpZCAobm90IGBOT2ApXG4gICAgdGhpcy5fcHJvZC5fc3RvcCgpO1xuICAgIHRoaXMuX2VyciA9IE5PO1xuICAgIHRoaXMuX3N0b3BJRCA9IE5PO1xuICB9XG5cbiAgX2FkZChpbDogSW50ZXJuYWxMaXN0ZW5lcjxUPik6IHZvaWQge1xuICAgIGNvbnN0IHRhID0gdGhpcy5fdGFyZ2V0O1xuICAgIGlmICh0YSAhPT0gTk8pIHJldHVybiB0YS5fYWRkKGlsKTtcbiAgICBjb25zdCBhID0gdGhpcy5faWxzO1xuICAgIGEucHVzaChpbCk7XG4gICAgaWYgKGEubGVuZ3RoID4gMSkgcmV0dXJuO1xuICAgIGlmICh0aGlzLl9zdG9wSUQgIT09IE5PKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fc3RvcElEKTtcbiAgICAgIHRoaXMuX3N0b3BJRCA9IE5PO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBwID0gdGhpcy5fcHJvZDtcbiAgICAgIGlmIChwICE9PSBOTykgcC5fc3RhcnQodGhpcyk7XG4gICAgfVxuICB9XG5cbiAgX3JlbW92ZShpbDogSW50ZXJuYWxMaXN0ZW5lcjxUPik6IHZvaWQge1xuICAgIGNvbnN0IHRhID0gdGhpcy5fdGFyZ2V0O1xuICAgIGlmICh0YSAhPT0gTk8pIHJldHVybiB0YS5fcmVtb3ZlKGlsKTtcbiAgICBjb25zdCBhID0gdGhpcy5faWxzO1xuICAgIGNvbnN0IGkgPSBhLmluZGV4T2YoaWwpO1xuICAgIGlmIChpID4gLTEpIHtcbiAgICAgIGEuc3BsaWNlKGksIDEpO1xuICAgICAgaWYgKHRoaXMuX3Byb2QgIT09IE5PICYmIGEubGVuZ3RoIDw9IDApIHtcbiAgICAgICAgdGhpcy5fZXJyID0gTk87XG4gICAgICAgIHRoaXMuX3N0b3BJRCA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fc3RvcE5vdygpKTtcbiAgICAgIH0gZWxzZSBpZiAoYS5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgdGhpcy5fcHJ1bmVDeWNsZXMoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBJZiBhbGwgcGF0aHMgc3RlbW1pbmcgZnJvbSBgdGhpc2Agc3RyZWFtIGV2ZW50dWFsbHkgZW5kIGF0IGB0aGlzYFxuICAvLyBzdHJlYW0sIHRoZW4gd2UgcmVtb3ZlIHRoZSBzaW5nbGUgbGlzdGVuZXIgb2YgYHRoaXNgIHN0cmVhbSwgdG9cbiAgLy8gZm9yY2UgaXQgdG8gZW5kIGl0cyBleGVjdXRpb24gYW5kIGRpc3Bvc2UgcmVzb3VyY2VzLiBUaGlzIG1ldGhvZFxuICAvLyBhc3N1bWVzIGFzIGEgcHJlY29uZGl0aW9uIHRoYXQgdGhpcy5faWxzIGhhcyBqdXN0IG9uZSBsaXN0ZW5lci5cbiAgX3BydW5lQ3ljbGVzKCkge1xuICAgIGlmICh0aGlzLl9oYXNOb1NpbmtzKHRoaXMsIFtdKSkgdGhpcy5fcmVtb3ZlKHRoaXMuX2lsc1swXSk7XG4gIH1cblxuICAvLyBDaGVja3Mgd2hldGhlciAqdGhlcmUgaXMgbm8qIHBhdGggc3RhcnRpbmcgZnJvbSBgeGAgdGhhdCBsZWFkcyB0byBhbiBlbmRcbiAgLy8gbGlzdGVuZXIgKHNpbmspIGluIHRoZSBzdHJlYW0gZ3JhcGgsIGZvbGxvd2luZyBlZGdlcyBBLT5CIHdoZXJlIEIgaXMgYVxuICAvLyBsaXN0ZW5lciBvZiBBLiBUaGlzIG1lYW5zIHRoZXNlIHBhdGhzIGNvbnN0aXR1dGUgYSBjeWNsZSBzb21laG93LiBJcyBnaXZlblxuICAvLyBhIHRyYWNlIG9mIGFsbCB2aXNpdGVkIG5vZGVzIHNvIGZhci5cbiAgX2hhc05vU2lua3MoeDogSW50ZXJuYWxMaXN0ZW5lcjxhbnk+LCB0cmFjZTogQXJyYXk8YW55Pik6IGJvb2xlYW4ge1xuICAgIGlmICh0cmFjZS5pbmRleE9mKHgpICE9PSAtMSlcbiAgICAgIHJldHVybiB0cnVlOyBlbHNlXG4gICAgaWYgKCh4IGFzIGFueSBhcyBPdXRTZW5kZXI8YW55Pikub3V0ID09PSB0aGlzKVxuICAgICAgcmV0dXJuIHRydWU7IGVsc2VcbiAgICBpZiAoKHggYXMgYW55IGFzIE91dFNlbmRlcjxhbnk+KS5vdXQgJiYgKHggYXMgYW55IGFzIE91dFNlbmRlcjxhbnk+KS5vdXQgIT09IE5PKVxuICAgICAgcmV0dXJuIHRoaXMuX2hhc05vU2lua3MoKHggYXMgYW55IGFzIE91dFNlbmRlcjxhbnk+KS5vdXQsIHRyYWNlLmNvbmNhdCh4KSk7IGVsc2VcbiAgICBpZiAoKHggYXMgU3RyZWFtPGFueT4pLl9pbHMpIHtcbiAgICAgIGZvciAobGV0IGkgPSAwLCBOID0gKHggYXMgU3RyZWFtPGFueT4pLl9pbHMubGVuZ3RoOyBpIDwgTjsgaSsrKVxuICAgICAgICBpZiAoIXRoaXMuX2hhc05vU2lua3MoKHggYXMgU3RyZWFtPGFueT4pLl9pbHNbaV0sIHRyYWNlLmNvbmNhdCh4KSkpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgY3RvcigpOiB0eXBlb2YgU3RyZWFtIHtcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIE1lbW9yeVN0cmVhbSA/IE1lbW9yeVN0cmVhbSA6IFN0cmVhbTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgTGlzdGVuZXIgdG8gdGhlIFN0cmVhbS5cbiAgICpcbiAgICogQHBhcmFtIHtMaXN0ZW5lcn0gbGlzdGVuZXJcbiAgICovXG4gIGFkZExpc3RlbmVyKGxpc3RlbmVyOiBQYXJ0aWFsPExpc3RlbmVyPFQ+Pik6IHZvaWQge1xuICAgIChsaXN0ZW5lciBhcyBJbnRlcm5hbExpc3RlbmVyPFQ+KS5fbiA9IGxpc3RlbmVyLm5leHQgfHwgbm9vcDtcbiAgICAobGlzdGVuZXIgYXMgSW50ZXJuYWxMaXN0ZW5lcjxUPikuX2UgPSBsaXN0ZW5lci5lcnJvciB8fCBub29wO1xuICAgIChsaXN0ZW5lciBhcyBJbnRlcm5hbExpc3RlbmVyPFQ+KS5fYyA9IGxpc3RlbmVyLmNvbXBsZXRlIHx8IG5vb3A7XG4gICAgdGhpcy5fYWRkKGxpc3RlbmVyIGFzIEludGVybmFsTGlzdGVuZXI8VD4pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYSBMaXN0ZW5lciBmcm9tIHRoZSBTdHJlYW0sIGFzc3VtaW5nIHRoZSBMaXN0ZW5lciB3YXMgYWRkZWQgdG8gaXQuXG4gICAqXG4gICAqIEBwYXJhbSB7TGlzdGVuZXI8VD59IGxpc3RlbmVyXG4gICAqL1xuICByZW1vdmVMaXN0ZW5lcihsaXN0ZW5lcjogUGFydGlhbDxMaXN0ZW5lcjxUPj4pOiB2b2lkIHtcbiAgICB0aGlzLl9yZW1vdmUobGlzdGVuZXIgYXMgSW50ZXJuYWxMaXN0ZW5lcjxUPik7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIExpc3RlbmVyIHRvIHRoZSBTdHJlYW0gcmV0dXJuaW5nIGEgU3Vic2NyaXB0aW9uIHRvIHJlbW92ZSB0aGF0XG4gICAqIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAcGFyYW0ge0xpc3RlbmVyfSBsaXN0ZW5lclxuICAgKiBAcmV0dXJucyB7U3Vic2NyaXB0aW9ufVxuICAgKi9cbiAgc3Vic2NyaWJlKGxpc3RlbmVyOiBQYXJ0aWFsPExpc3RlbmVyPFQ+Pik6IFN1YnNjcmlwdGlvbiB7XG4gICAgdGhpcy5hZGRMaXN0ZW5lcihsaXN0ZW5lcik7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW1TdWI8VD4odGhpcywgbGlzdGVuZXIgYXMgSW50ZXJuYWxMaXN0ZW5lcjxUPik7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGludGVyb3AgYmV0d2VlbiBtb3N0LmpzIGFuZCBSeEpTIDVcbiAgICpcbiAgICogQHJldHVybnMge1N0cmVhbX1cbiAgICovXG4gIFskJG9ic2VydmFibGVdKCk6IFN0cmVhbTxUPiB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBTdHJlYW0gZ2l2ZW4gYSBQcm9kdWNlci5cbiAgICpcbiAgICogQGZhY3RvcnkgdHJ1ZVxuICAgKiBAcGFyYW0ge1Byb2R1Y2VyfSBwcm9kdWNlciBBbiBvcHRpb25hbCBQcm9kdWNlciB0aGF0IGRpY3RhdGVzIGhvdyB0b1xuICAgKiBzdGFydCwgZ2VuZXJhdGUgZXZlbnRzLCBhbmQgc3RvcCB0aGUgU3RyZWFtLlxuICAgKiBAcmV0dXJuIHtTdHJlYW19XG4gICAqL1xuICBzdGF0aWMgY3JlYXRlPFQ+KHByb2R1Y2VyPzogUHJvZHVjZXI8VD4pOiBTdHJlYW08VD4ge1xuICAgIGlmIChwcm9kdWNlcikge1xuICAgICAgaWYgKHR5cGVvZiBwcm9kdWNlci5zdGFydCAhPT0gJ2Z1bmN0aW9uJ1xuICAgICAgfHwgdHlwZW9mIHByb2R1Y2VyLnN0b3AgIT09ICdmdW5jdGlvbicpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcigncHJvZHVjZXIgcmVxdWlyZXMgYm90aCBzdGFydCBhbmQgc3RvcCBmdW5jdGlvbnMnKTtcbiAgICAgIGludGVybmFsaXplUHJvZHVjZXIocHJvZHVjZXIpOyAvLyBtdXRhdGVzIHRoZSBpbnB1dFxuICAgIH1cbiAgICByZXR1cm4gbmV3IFN0cmVhbShwcm9kdWNlciBhcyBJbnRlcm5hbFByb2R1Y2VyPFQ+ICYgUHJvZHVjZXI8VD4pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgTWVtb3J5U3RyZWFtIGdpdmVuIGEgUHJvZHVjZXIuXG4gICAqXG4gICAqIEBmYWN0b3J5IHRydWVcbiAgICogQHBhcmFtIHtQcm9kdWNlcn0gcHJvZHVjZXIgQW4gb3B0aW9uYWwgUHJvZHVjZXIgdGhhdCBkaWN0YXRlcyBob3cgdG9cbiAgICogc3RhcnQsIGdlbmVyYXRlIGV2ZW50cywgYW5kIHN0b3AgdGhlIFN0cmVhbS5cbiAgICogQHJldHVybiB7TWVtb3J5U3RyZWFtfVxuICAgKi9cbiAgc3RhdGljIGNyZWF0ZVdpdGhNZW1vcnk8VD4ocHJvZHVjZXI/OiBQcm9kdWNlcjxUPik6IE1lbW9yeVN0cmVhbTxUPiB7XG4gICAgaWYgKHByb2R1Y2VyKSBpbnRlcm5hbGl6ZVByb2R1Y2VyKHByb2R1Y2VyKTsgLy8gbXV0YXRlcyB0aGUgaW5wdXRcbiAgICByZXR1cm4gbmV3IE1lbW9yeVN0cmVhbTxUPihwcm9kdWNlciBhcyBJbnRlcm5hbFByb2R1Y2VyPFQ+ICYgUHJvZHVjZXI8VD4pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBTdHJlYW0gdGhhdCBkb2VzIG5vdGhpbmcgd2hlbiBzdGFydGVkLiBJdCBuZXZlciBlbWl0cyBhbnkgZXZlbnQuXG4gICAqXG4gICAqIE1hcmJsZSBkaWFncmFtOlxuICAgKlxuICAgKiBgYGB0ZXh0XG4gICAqICAgICAgICAgIG5ldmVyXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIGBgYFxuICAgKlxuICAgKiBAZmFjdG9yeSB0cnVlXG4gICAqIEByZXR1cm4ge1N0cmVhbX1cbiAgICovXG4gIHN0YXRpYyBuZXZlcigpOiBTdHJlYW08YW55PiB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW08YW55Pih7X3N0YXJ0OiBub29wLCBfc3RvcDogbm9vcH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBTdHJlYW0gdGhhdCBpbW1lZGlhdGVseSBlbWl0cyB0aGUgXCJjb21wbGV0ZVwiIG5vdGlmaWNhdGlvbiB3aGVuXG4gICAqIHN0YXJ0ZWQsIGFuZCB0aGF0J3MgaXQuXG4gICAqXG4gICAqIE1hcmJsZSBkaWFncmFtOlxuICAgKlxuICAgKiBgYGB0ZXh0XG4gICAqIGVtcHR5XG4gICAqIC18XG4gICAqIGBgYFxuICAgKlxuICAgKiBAZmFjdG9yeSB0cnVlXG4gICAqIEByZXR1cm4ge1N0cmVhbX1cbiAgICovXG4gIHN0YXRpYyBlbXB0eSgpOiBTdHJlYW08YW55PiB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW08YW55Pih7XG4gICAgICBfc3RhcnQoaWw6IEludGVybmFsTGlzdGVuZXI8YW55PikgeyBpbC5fYygpOyB9LFxuICAgICAgX3N0b3A6IG5vb3AsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIFN0cmVhbSB0aGF0IGltbWVkaWF0ZWx5IGVtaXRzIGFuIFwiZXJyb3JcIiBub3RpZmljYXRpb24gd2l0aCB0aGVcbiAgICogdmFsdWUgeW91IHBhc3NlZCBhcyB0aGUgYGVycm9yYCBhcmd1bWVudCB3aGVuIHRoZSBzdHJlYW0gc3RhcnRzLCBhbmQgdGhhdCdzXG4gICAqIGl0LlxuICAgKlxuICAgKiBNYXJibGUgZGlhZ3JhbTpcbiAgICpcbiAgICogYGBgdGV4dFxuICAgKiB0aHJvdyhYKVxuICAgKiAtWFxuICAgKiBgYGBcbiAgICpcbiAgICogQGZhY3RvcnkgdHJ1ZVxuICAgKiBAcGFyYW0gZXJyb3IgVGhlIGVycm9yIGV2ZW50IHRvIGVtaXQgb24gdGhlIGNyZWF0ZWQgc3RyZWFtLlxuICAgKiBAcmV0dXJuIHtTdHJlYW19XG4gICAqL1xuICBzdGF0aWMgdGhyb3coZXJyb3I6IGFueSk6IFN0cmVhbTxhbnk+IHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbTxhbnk+KHtcbiAgICAgIF9zdGFydChpbDogSW50ZXJuYWxMaXN0ZW5lcjxhbnk+KSB7IGlsLl9lKGVycm9yKTsgfSxcbiAgICAgIF9zdG9wOiBub29wLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBzdHJlYW0gZnJvbSBhbiBBcnJheSwgUHJvbWlzZSwgb3IgYW4gT2JzZXJ2YWJsZS5cbiAgICpcbiAgICogQGZhY3RvcnkgdHJ1ZVxuICAgKiBAcGFyYW0ge0FycmF5fFByb21pc2VMaWtlfE9ic2VydmFibGV9IGlucHV0IFRoZSBpbnB1dCB0byBtYWtlIGEgc3RyZWFtIGZyb20uXG4gICAqIEByZXR1cm4ge1N0cmVhbX1cbiAgICovXG4gIHN0YXRpYyBmcm9tPFQ+KGlucHV0OiBQcm9taXNlTGlrZTxUPiB8IFN0cmVhbTxUPiB8IEFycmF5PFQ+IHwgT2JzZXJ2YWJsZTxUPik6IFN0cmVhbTxUPiB7XG4gICAgaWYgKHR5cGVvZiBpbnB1dFskJG9ic2VydmFibGVdID09PSAnZnVuY3Rpb24nKVxuICAgICAgcmV0dXJuIFN0cmVhbS5mcm9tT2JzZXJ2YWJsZTxUPihpbnB1dCBhcyBPYnNlcnZhYmxlPFQ+KTsgZWxzZVxuICAgIGlmICh0eXBlb2YgKGlucHV0IGFzIFByb21pc2VMaWtlPFQ+KS50aGVuID09PSAnZnVuY3Rpb24nKVxuICAgICAgcmV0dXJuIFN0cmVhbS5mcm9tUHJvbWlzZTxUPihpbnB1dCBhcyBQcm9taXNlTGlrZTxUPik7IGVsc2VcbiAgICBpZiAoQXJyYXkuaXNBcnJheShpbnB1dCkpXG4gICAgICByZXR1cm4gU3RyZWFtLmZyb21BcnJheTxUPihpbnB1dCk7XG5cbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBUeXBlIG9mIGlucHV0IHRvIGZyb20oKSBtdXN0IGJlIGFuIEFycmF5LCBQcm9taXNlLCBvciBPYnNlcnZhYmxlYCk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIFN0cmVhbSB0aGF0IGltbWVkaWF0ZWx5IGVtaXRzIHRoZSBhcmd1bWVudHMgdGhhdCB5b3UgZ2l2ZSB0b1xuICAgKiAqb2YqLCB0aGVuIGNvbXBsZXRlcy5cbiAgICpcbiAgICogTWFyYmxlIGRpYWdyYW06XG4gICAqXG4gICAqIGBgYHRleHRcbiAgICogb2YoMSwyLDMpXG4gICAqIDEyM3xcbiAgICogYGBgXG4gICAqXG4gICAqIEBmYWN0b3J5IHRydWVcbiAgICogQHBhcmFtIGEgVGhlIGZpcnN0IHZhbHVlIHlvdSB3YW50IHRvIGVtaXQgYXMgYW4gZXZlbnQgb24gdGhlIHN0cmVhbS5cbiAgICogQHBhcmFtIGIgVGhlIHNlY29uZCB2YWx1ZSB5b3Ugd2FudCB0byBlbWl0IGFzIGFuIGV2ZW50IG9uIHRoZSBzdHJlYW0uIE9uZVxuICAgKiBvciBtb3JlIG9mIHRoZXNlIHZhbHVlcyBtYXkgYmUgZ2l2ZW4gYXMgYXJndW1lbnRzLlxuICAgKiBAcmV0dXJuIHtTdHJlYW19XG4gICAqL1xuICBzdGF0aWMgb2Y8VD4oLi4uaXRlbXM6IEFycmF5PFQ+KTogU3RyZWFtPFQ+IHtcbiAgICByZXR1cm4gU3RyZWFtLmZyb21BcnJheTxUPihpdGVtcyk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgYW4gYXJyYXkgdG8gYSBzdHJlYW0uIFRoZSByZXR1cm5lZCBzdHJlYW0gd2lsbCBlbWl0IHN5bmNocm9ub3VzbHlcbiAgICogYWxsIHRoZSBpdGVtcyBpbiB0aGUgYXJyYXksIGFuZCB0aGVuIGNvbXBsZXRlLlxuICAgKlxuICAgKiBNYXJibGUgZGlhZ3JhbTpcbiAgICpcbiAgICogYGBgdGV4dFxuICAgKiBmcm9tQXJyYXkoWzEsMiwzXSlcbiAgICogMTIzfFxuICAgKiBgYGBcbiAgICpcbiAgICogQGZhY3RvcnkgdHJ1ZVxuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gYmUgY29udmVydGVkIGFzIGEgc3RyZWFtLlxuICAgKiBAcmV0dXJuIHtTdHJlYW19XG4gICAqL1xuICBzdGF0aWMgZnJvbUFycmF5PFQ+KGFycmF5OiBBcnJheTxUPik6IFN0cmVhbTxUPiB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW08VD4obmV3IEZyb21BcnJheTxUPihhcnJheSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIGEgcHJvbWlzZSB0byBhIHN0cmVhbS4gVGhlIHJldHVybmVkIHN0cmVhbSB3aWxsIGVtaXQgdGhlIHJlc29sdmVkXG4gICAqIHZhbHVlIG9mIHRoZSBwcm9taXNlLCBhbmQgdGhlbiBjb21wbGV0ZS4gSG93ZXZlciwgaWYgdGhlIHByb21pc2UgaXNcbiAgICogcmVqZWN0ZWQsIHRoZSBzdHJlYW0gd2lsbCBlbWl0IHRoZSBjb3JyZXNwb25kaW5nIGVycm9yLlxuICAgKlxuICAgKiBNYXJibGUgZGlhZ3JhbTpcbiAgICpcbiAgICogYGBgdGV4dFxuICAgKiBmcm9tUHJvbWlzZSggLS0tLTQyIClcbiAgICogLS0tLS0tLS0tLS0tLS0tLS00MnxcbiAgICogYGBgXG4gICAqXG4gICAqIEBmYWN0b3J5IHRydWVcbiAgICogQHBhcmFtIHtQcm9taXNlTGlrZX0gcHJvbWlzZSBUaGUgcHJvbWlzZSB0byBiZSBjb252ZXJ0ZWQgYXMgYSBzdHJlYW0uXG4gICAqIEByZXR1cm4ge1N0cmVhbX1cbiAgICovXG4gIHN0YXRpYyBmcm9tUHJvbWlzZTxUPihwcm9taXNlOiBQcm9taXNlTGlrZTxUPik6IFN0cmVhbTxUPiB7XG4gICAgcmV0dXJuIG5ldyBTdHJlYW08VD4obmV3IEZyb21Qcm9taXNlPFQ+KHByb21pc2UpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyBhbiBPYnNlcnZhYmxlIGludG8gYSBTdHJlYW0uXG4gICAqXG4gICAqIEBmYWN0b3J5IHRydWVcbiAgICogQHBhcmFtIHthbnl9IG9ic2VydmFibGUgVGhlIG9ic2VydmFibGUgdG8gYmUgY29udmVydGVkIGFzIGEgc3RyZWFtLlxuICAgKiBAcmV0dXJuIHtTdHJlYW19XG4gICAqL1xuICBzdGF0aWMgZnJvbU9ic2VydmFibGU8VD4ob2JzOiB7c3Vic2NyaWJlOiBhbnl9KTogU3RyZWFtPFQ+IHtcbiAgICBpZiAoKG9icyBhcyBTdHJlYW08VD4pLmVuZFdoZW4pIHJldHVybiBvYnMgYXMgU3RyZWFtPFQ+O1xuICAgIGNvbnN0IG8gPSB0eXBlb2Ygb2JzWyQkb2JzZXJ2YWJsZV0gPT09ICdmdW5jdGlvbicgPyBvYnNbJCRvYnNlcnZhYmxlXSgpIDogb2JzO1xuICAgIHJldHVybiBuZXcgU3RyZWFtPFQ+KG5ldyBGcm9tT2JzZXJ2YWJsZShvKSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIHN0cmVhbSB0aGF0IHBlcmlvZGljYWxseSBlbWl0cyBpbmNyZW1lbnRhbCBudW1iZXJzLCBldmVyeVxuICAgKiBgcGVyaW9kYCBtaWxsaXNlY29uZHMuXG4gICAqXG4gICAqIE1hcmJsZSBkaWFncmFtOlxuICAgKlxuICAgKiBgYGB0ZXh0XG4gICAqICAgICBwZXJpb2RpYygxMDAwKVxuICAgKiAtLS0wLS0tMS0tLTItLS0zLS0tNC0tLS4uLlxuICAgKiBgYGBcbiAgICpcbiAgICogQGZhY3RvcnkgdHJ1ZVxuICAgKiBAcGFyYW0ge251bWJlcn0gcGVyaW9kIFRoZSBpbnRlcnZhbCBpbiBtaWxsaXNlY29uZHMgdG8gdXNlIGFzIGEgcmF0ZSBvZlxuICAgKiBlbWlzc2lvbi5cbiAgICogQHJldHVybiB7U3RyZWFtfVxuICAgKi9cbiAgc3RhdGljIHBlcmlvZGljKHBlcmlvZDogbnVtYmVyKTogU3RyZWFtPG51bWJlcj4ge1xuICAgIHJldHVybiBuZXcgU3RyZWFtPG51bWJlcj4obmV3IFBlcmlvZGljKHBlcmlvZCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJsZW5kcyBtdWx0aXBsZSBzdHJlYW1zIHRvZ2V0aGVyLCBlbWl0dGluZyBldmVudHMgZnJvbSBhbGwgb2YgdGhlbVxuICAgKiBjb25jdXJyZW50bHkuXG4gICAqXG4gICAqICptZXJnZSogdGFrZXMgbXVsdGlwbGUgc3RyZWFtcyBhcyBhcmd1bWVudHMsIGFuZCBjcmVhdGVzIGEgc3RyZWFtIHRoYXRcbiAgICogYmVoYXZlcyBsaWtlIGVhY2ggb2YgdGhlIGFyZ3VtZW50IHN0cmVhbXMsIGluIHBhcmFsbGVsLlxuICAgKlxuICAgKiBNYXJibGUgZGlhZ3JhbTpcbiAgICpcbiAgICogYGBgdGV4dFxuICAgKiAtLTEtLS0tMi0tLS0tMy0tLS0tLS0tNC0tLVxuICAgKiAtLS0tYS0tLS0tYi0tLS1jLS0tZC0tLS0tLVxuICAgKiAgICAgICAgICAgIG1lcmdlXG4gICAqIC0tMS1hLS0yLS1iLS0zLWMtLS1kLS00LS0tXG4gICAqIGBgYFxuICAgKlxuICAgKiBAZmFjdG9yeSB0cnVlXG4gICAqIEBwYXJhbSB7U3RyZWFtfSBzdHJlYW0xIEEgc3RyZWFtIHRvIG1lcmdlIHRvZ2V0aGVyIHdpdGggb3RoZXIgc3RyZWFtcy5cbiAgICogQHBhcmFtIHtTdHJlYW19IHN0cmVhbTIgQSBzdHJlYW0gdG8gbWVyZ2UgdG9nZXRoZXIgd2l0aCBvdGhlciBzdHJlYW1zLiBUd29cbiAgICogb3IgbW9yZSBzdHJlYW1zIG1heSBiZSBnaXZlbiBhcyBhcmd1bWVudHMuXG4gICAqIEByZXR1cm4ge1N0cmVhbX1cbiAgICovXG4gIHN0YXRpYyBtZXJnZTogTWVyZ2VTaWduYXR1cmUgPSBmdW5jdGlvbiBtZXJnZSguLi5zdHJlYW1zOiBBcnJheTxTdHJlYW08YW55Pj4pIHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbTxhbnk+KG5ldyBNZXJnZShzdHJlYW1zKSk7XG4gIH0gYXMgTWVyZ2VTaWduYXR1cmU7XG5cbiAgLyoqXG4gICAqIENvbWJpbmVzIG11bHRpcGxlIGlucHV0IHN0cmVhbXMgdG9nZXRoZXIgdG8gcmV0dXJuIGEgc3RyZWFtIHdob3NlIGV2ZW50c1xuICAgKiBhcmUgYXJyYXlzIHRoYXQgY29sbGVjdCB0aGUgbGF0ZXN0IGV2ZW50cyBmcm9tIGVhY2ggaW5wdXQgc3RyZWFtLlxuICAgKlxuICAgKiAqY29tYmluZSogaW50ZXJuYWxseSByZW1lbWJlcnMgdGhlIG1vc3QgcmVjZW50IGV2ZW50IGZyb20gZWFjaCBvZiB0aGUgaW5wdXRcbiAgICogc3RyZWFtcy4gV2hlbiBhbnkgb2YgdGhlIGlucHV0IHN0cmVhbXMgZW1pdHMgYW4gZXZlbnQsIHRoYXQgZXZlbnQgdG9nZXRoZXJcbiAgICogd2l0aCBhbGwgdGhlIG90aGVyIHNhdmVkIGV2ZW50cyBhcmUgY29tYmluZWQgaW50byBhbiBhcnJheS4gVGhhdCBhcnJheSB3aWxsXG4gICAqIGJlIGVtaXR0ZWQgb24gdGhlIG91dHB1dCBzdHJlYW0uIEl0J3MgZXNzZW50aWFsbHkgYSB3YXkgb2Ygam9pbmluZyB0b2dldGhlclxuICAgKiB0aGUgZXZlbnRzIGZyb20gbXVsdGlwbGUgc3RyZWFtcy5cbiAgICpcbiAgICogTWFyYmxlIGRpYWdyYW06XG4gICAqXG4gICAqIGBgYHRleHRcbiAgICogLS0xLS0tLTItLS0tLTMtLS0tLS0tLTQtLS1cbiAgICogLS0tLWEtLS0tLWItLS0tLWMtLWQtLS0tLS1cbiAgICogICAgICAgICAgY29tYmluZVxuICAgKiAtLS0tMWEtMmEtMmItM2ItM2MtM2QtNGQtLVxuICAgKiBgYGBcbiAgICpcbiAgICogQGZhY3RvcnkgdHJ1ZVxuICAgKiBAcGFyYW0ge1N0cmVhbX0gc3RyZWFtMSBBIHN0cmVhbSB0byBjb21iaW5lIHRvZ2V0aGVyIHdpdGggb3RoZXIgc3RyZWFtcy5cbiAgICogQHBhcmFtIHtTdHJlYW19IHN0cmVhbTIgQSBzdHJlYW0gdG8gY29tYmluZSB0b2dldGhlciB3aXRoIG90aGVyIHN0cmVhbXMuXG4gICAqIE11bHRpcGxlIHN0cmVhbXMsIG5vdCBqdXN0IHR3bywgbWF5IGJlIGdpdmVuIGFzIGFyZ3VtZW50cy5cbiAgICogQHJldHVybiB7U3RyZWFtfVxuICAgKi9cbiAgc3RhdGljIGNvbWJpbmU6IENvbWJpbmVTaWduYXR1cmUgPSBmdW5jdGlvbiBjb21iaW5lKC4uLnN0cmVhbXM6IEFycmF5PFN0cmVhbTxhbnk+Pikge1xuICAgIHJldHVybiBuZXcgU3RyZWFtPEFycmF5PGFueT4+KG5ldyBDb21iaW5lPGFueT4oc3RyZWFtcykpO1xuICB9IGFzIENvbWJpbmVTaWduYXR1cmU7XG5cbiAgcHJvdGVjdGVkIF9tYXA8VT4ocHJvamVjdDogKHQ6IFQpID0+IFUpOiBTdHJlYW08VT4gfCBNZW1vcnlTdHJlYW08VT4ge1xuICAgIHJldHVybiBuZXcgKHRoaXMuY3RvcigpKTxVPihuZXcgTWFwT3A8VCwgVT4ocHJvamVjdCwgdGhpcykpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyYW5zZm9ybXMgZWFjaCBldmVudCBmcm9tIHRoZSBpbnB1dCBTdHJlYW0gdGhyb3VnaCBhIGBwcm9qZWN0YCBmdW5jdGlvbixcbiAgICogdG8gZ2V0IGEgU3RyZWFtIHRoYXQgZW1pdHMgdGhvc2UgdHJhbnNmb3JtZWQgZXZlbnRzLlxuICAgKlxuICAgKiBNYXJibGUgZGlhZ3JhbTpcbiAgICpcbiAgICogYGBgdGV4dFxuICAgKiAtLTEtLS0zLS01LS0tLS03LS0tLS0tXG4gICAqICAgIG1hcChpID0+IGkgKiAxMClcbiAgICogLS0xMC0tMzAtNTAtLS0tNzAtLS0tLVxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gcHJvamVjdCBBIGZ1bmN0aW9uIG9mIHR5cGUgYCh0OiBUKSA9PiBVYCB0aGF0IHRha2VzIGV2ZW50XG4gICAqIGB0YCBvZiB0eXBlIGBUYCBmcm9tIHRoZSBpbnB1dCBTdHJlYW0gYW5kIHByb2R1Y2VzIGFuIGV2ZW50IG9mIHR5cGUgYFVgLCB0b1xuICAgKiBiZSBlbWl0dGVkIG9uIHRoZSBvdXRwdXQgU3RyZWFtLlxuICAgKiBAcmV0dXJuIHtTdHJlYW19XG4gICAqL1xuICBtYXA8VT4ocHJvamVjdDogKHQ6IFQpID0+IFUpOiBTdHJlYW08VT4ge1xuICAgIHJldHVybiB0aGlzLl9tYXAocHJvamVjdCk7XG4gIH1cblxuICAvKipcbiAgICogSXQncyBsaWtlIGBtYXBgLCBidXQgdHJhbnNmb3JtcyBlYWNoIGlucHV0IGV2ZW50IHRvIGFsd2F5cyB0aGUgc2FtZVxuICAgKiBjb25zdGFudCB2YWx1ZSBvbiB0aGUgb3V0cHV0IFN0cmVhbS5cbiAgICpcbiAgICogTWFyYmxlIGRpYWdyYW06XG4gICAqXG4gICAqIGBgYHRleHRcbiAgICogLS0xLS0tMy0tNS0tLS0tNy0tLS0tXG4gICAqICAgICAgIG1hcFRvKDEwKVxuICAgKiAtLTEwLS0xMC0xMC0tLS0xMC0tLS1cbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSBwcm9qZWN0ZWRWYWx1ZSBBIHZhbHVlIHRvIGVtaXQgb24gdGhlIG91dHB1dCBTdHJlYW0gd2hlbmV2ZXIgdGhlXG4gICAqIGlucHV0IFN0cmVhbSBlbWl0cyBhbnkgdmFsdWUuXG4gICAqIEByZXR1cm4ge1N0cmVhbX1cbiAgICovXG4gIG1hcFRvPFU+KHByb2plY3RlZFZhbHVlOiBVKTogU3RyZWFtPFU+IHtcbiAgICBjb25zdCBzID0gdGhpcy5tYXAoKCkgPT4gcHJvamVjdGVkVmFsdWUpO1xuICAgIGNvbnN0IG9wOiBPcGVyYXRvcjxULCBVPiA9IHMuX3Byb2QgYXMgT3BlcmF0b3I8VCwgVT47XG4gICAgb3AudHlwZSA9ICdtYXBUbyc7XG4gICAgcmV0dXJuIHM7XG4gIH1cblxuICBmaWx0ZXI8UyBleHRlbmRzIFQ+KHBhc3NlczogKHQ6IFQpID0+IHQgaXMgUyk6IFN0cmVhbTxTPjtcbiAgZmlsdGVyKHBhc3NlczogKHQ6IFQpID0+IGJvb2xlYW4pOiBTdHJlYW08VD47XG4gIC8qKlxuICAgKiBPbmx5IGFsbG93cyBldmVudHMgdGhhdCBwYXNzIHRoZSB0ZXN0IGdpdmVuIGJ5IHRoZSBgcGFzc2VzYCBhcmd1bWVudC5cbiAgICpcbiAgICogRWFjaCBldmVudCBmcm9tIHRoZSBpbnB1dCBzdHJlYW0gaXMgZ2l2ZW4gdG8gdGhlIGBwYXNzZXNgIGZ1bmN0aW9uLiBJZiB0aGVcbiAgICogZnVuY3Rpb24gcmV0dXJucyBgdHJ1ZWAsIHRoZSBldmVudCBpcyBmb3J3YXJkZWQgdG8gdGhlIG91dHB1dCBzdHJlYW0sXG4gICAqIG90aGVyd2lzZSBpdCBpcyBpZ25vcmVkIGFuZCBub3QgZm9yd2FyZGVkLlxuICAgKlxuICAgKiBNYXJibGUgZGlhZ3JhbTpcbiAgICpcbiAgICogYGBgdGV4dFxuICAgKiAtLTEtLS0yLS0zLS0tLS00LS0tLS01LS0tNi0tNy04LS1cbiAgICogICAgIGZpbHRlcihpID0+IGkgJSAyID09PSAwKVxuICAgKiAtLS0tLS0yLS0tLS0tLS00LS0tLS0tLS0tNi0tLS04LS1cbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IHBhc3NlcyBBIGZ1bmN0aW9uIG9mIHR5cGUgYCh0OiBUKSA9PiBib29sZWFuYCB0aGF0IHRha2VzXG4gICAqIGFuIGV2ZW50IGZyb20gdGhlIGlucHV0IHN0cmVhbSBhbmQgY2hlY2tzIGlmIGl0IHBhc3NlcywgYnkgcmV0dXJuaW5nIGFcbiAgICogYm9vbGVhbi5cbiAgICogQHJldHVybiB7U3RyZWFtfVxuICAgKi9cbiAgZmlsdGVyKHBhc3NlczogKHQ6IFQpID0+IGJvb2xlYW4pOiBTdHJlYW08VD4ge1xuICAgIGNvbnN0IHAgPSB0aGlzLl9wcm9kO1xuICAgIGlmIChwIGluc3RhbmNlb2YgRmlsdGVyKVxuICAgICAgcmV0dXJuIG5ldyBTdHJlYW08VD4obmV3IEZpbHRlcjxUPihcbiAgICAgICAgYW5kKChwIGFzIEZpbHRlcjxUPikuZiwgcGFzc2VzKSxcbiAgICAgICAgKHAgYXMgRmlsdGVyPFQ+KS5pbnNcbiAgICAgICkpO1xuICAgIHJldHVybiBuZXcgU3RyZWFtPFQ+KG5ldyBGaWx0ZXI8VD4ocGFzc2VzLCB0aGlzKSk7XG4gIH1cblxuICAvKipcbiAgICogTGV0cyB0aGUgZmlyc3QgYGFtb3VudGAgbWFueSBldmVudHMgZnJvbSB0aGUgaW5wdXQgc3RyZWFtIHBhc3MgdG8gdGhlXG4gICAqIG91dHB1dCBzdHJlYW0sIHRoZW4gbWFrZXMgdGhlIG91dHB1dCBzdHJlYW0gY29tcGxldGUuXG4gICAqXG4gICAqIE1hcmJsZSBkaWFncmFtOlxuICAgKlxuICAgKiBgYGB0ZXh0XG4gICAqIC0tYS0tLWItLWMtLS0tZC0tLWUtLVxuICAgKiAgICB0YWtlKDMpXG4gICAqIC0tYS0tLWItLWN8XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gYW1vdW50IEhvdyBtYW55IGV2ZW50cyB0byBhbGxvdyBmcm9tIHRoZSBpbnB1dCBzdHJlYW1cbiAgICogYmVmb3JlIGNvbXBsZXRpbmcgdGhlIG91dHB1dCBzdHJlYW0uXG4gICAqIEByZXR1cm4ge1N0cmVhbX1cbiAgICovXG4gIHRha2UoYW1vdW50OiBudW1iZXIpOiBTdHJlYW08VD4ge1xuICAgIHJldHVybiBuZXcgKHRoaXMuY3RvcigpKTxUPihuZXcgVGFrZTxUPihhbW91bnQsIHRoaXMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJZ25vcmVzIHRoZSBmaXJzdCBgYW1vdW50YCBtYW55IGV2ZW50cyBmcm9tIHRoZSBpbnB1dCBzdHJlYW0sIGFuZCB0aGVuXG4gICAqIGFmdGVyIHRoYXQgc3RhcnRzIGZvcndhcmRpbmcgZXZlbnRzIGZyb20gdGhlIGlucHV0IHN0cmVhbSB0byB0aGUgb3V0cHV0XG4gICAqIHN0cmVhbS5cbiAgICpcbiAgICogTWFyYmxlIGRpYWdyYW06XG4gICAqXG4gICAqIGBgYHRleHRcbiAgICogLS1hLS0tYi0tYy0tLS1kLS0tZS0tXG4gICAqICAgICAgIGRyb3AoMylcbiAgICogLS0tLS0tLS0tLS0tLS1kLS0tZS0tXG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0ge251bWJlcn0gYW1vdW50IEhvdyBtYW55IGV2ZW50cyB0byBpZ25vcmUgZnJvbSB0aGUgaW5wdXQgc3RyZWFtXG4gICAqIGJlZm9yZSBmb3J3YXJkaW5nIGFsbCBldmVudHMgZnJvbSB0aGUgaW5wdXQgc3RyZWFtIHRvIHRoZSBvdXRwdXQgc3RyZWFtLlxuICAgKiBAcmV0dXJuIHtTdHJlYW19XG4gICAqL1xuICBkcm9wKGFtb3VudDogbnVtYmVyKTogU3RyZWFtPFQ+IHtcbiAgICByZXR1cm4gbmV3IFN0cmVhbTxUPihuZXcgRHJvcDxUPihhbW91bnQsIHRoaXMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXaGVuIHRoZSBpbnB1dCBzdHJlYW0gY29tcGxldGVzLCB0aGUgb3V0cHV0IHN0cmVhbSB3aWxsIGVtaXQgdGhlIGxhc3QgZXZlbnRcbiAgICogZW1pdHRlZCBieSB0aGUgaW5wdXQgc3RyZWFtLCBhbmQgdGhlbiB3aWxsIGFsc28gY29tcGxldGUuXG4gICAqXG4gICAqIE1hcmJsZSBkaWFncmFtOlxuICAgKlxuICAgKiBgYGB0ZXh0XG4gICAqIC0tYS0tLWItLWMtLWQtLS0tfFxuICAgKiAgICAgICBsYXN0KClcbiAgICogLS0tLS0tLS0tLS0tLS0tLS1kfFxuICAgKiBgYGBcbiAgICpcbiAgICogQHJldHVybiB7U3RyZWFtfVxuICAgKi9cbiAgbGFzdCgpOiBTdHJlYW08VD4ge1xuICAgIHJldHVybiBuZXcgU3RyZWFtPFQ+KG5ldyBMYXN0PFQ+KHRoaXMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwZW5kcyB0aGUgZ2l2ZW4gYGluaXRpYWxgIHZhbHVlIHRvIHRoZSBzZXF1ZW5jZSBvZiBldmVudHMgZW1pdHRlZCBieSB0aGVcbiAgICogaW5wdXQgc3RyZWFtLiBUaGUgcmV0dXJuZWQgc3RyZWFtIGlzIGEgTWVtb3J5U3RyZWFtLCB3aGljaCBtZWFucyBpdCBpc1xuICAgKiBhbHJlYWR5IGByZW1lbWJlcigpYCdkLlxuICAgKlxuICAgKiBNYXJibGUgZGlhZ3JhbTpcbiAgICpcbiAgICogYGBgdGV4dFxuICAgKiAtLS0xLS0tMi0tLS0tMy0tLVxuICAgKiAgIHN0YXJ0V2l0aCgwKVxuICAgKiAwLS0xLS0tMi0tLS0tMy0tLVxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGluaXRpYWwgVGhlIHZhbHVlIG9yIGV2ZW50IHRvIHByZXBlbmQuXG4gICAqIEByZXR1cm4ge01lbW9yeVN0cmVhbX1cbiAgICovXG4gIHN0YXJ0V2l0aChpbml0aWFsOiBUKTogTWVtb3J5U3RyZWFtPFQ+IHtcbiAgICByZXR1cm4gbmV3IE1lbW9yeVN0cmVhbTxUPihuZXcgU3RhcnRXaXRoPFQ+KHRoaXMsIGluaXRpYWwpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVc2VzIGFub3RoZXIgc3RyZWFtIHRvIGRldGVybWluZSB3aGVuIHRvIGNvbXBsZXRlIHRoZSBjdXJyZW50IHN0cmVhbS5cbiAgICpcbiAgICogV2hlbiB0aGUgZ2l2ZW4gYG90aGVyYCBzdHJlYW0gZW1pdHMgYW4gZXZlbnQgb3IgY29tcGxldGVzLCB0aGUgb3V0cHV0XG4gICAqIHN0cmVhbSB3aWxsIGNvbXBsZXRlLiBCZWZvcmUgdGhhdCBoYXBwZW5zLCB0aGUgb3V0cHV0IHN0cmVhbSB3aWxsIGJlaGF2ZXNcbiAgICogbGlrZSB0aGUgaW5wdXQgc3RyZWFtLlxuICAgKlxuICAgKiBNYXJibGUgZGlhZ3JhbTpcbiAgICpcbiAgICogYGBgdGV4dFxuICAgKiAtLS0xLS0tMi0tLS0tMy0tNC0tLS01LS0tLTYtLS1cbiAgICogICBlbmRXaGVuKCAtLS0tLS0tLWEtLWItLXwgKVxuICAgKiAtLS0xLS0tMi0tLS0tMy0tNC0tfFxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIG90aGVyIFNvbWUgb3RoZXIgc3RyZWFtIHRoYXQgaXMgdXNlZCB0byBrbm93IHdoZW4gc2hvdWxkIHRoZSBvdXRwdXRcbiAgICogc3RyZWFtIG9mIHRoaXMgb3BlcmF0b3IgY29tcGxldGUuXG4gICAqIEByZXR1cm4ge1N0cmVhbX1cbiAgICovXG4gIGVuZFdoZW4ob3RoZXI6IFN0cmVhbTxhbnk+KTogU3RyZWFtPFQ+IHtcbiAgICByZXR1cm4gbmV3ICh0aGlzLmN0b3IoKSk8VD4obmV3IEVuZFdoZW48VD4ob3RoZXIsIHRoaXMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBcIkZvbGRzXCIgdGhlIHN0cmVhbSBvbnRvIGl0c2VsZi5cbiAgICpcbiAgICogQ29tYmluZXMgZXZlbnRzIGZyb20gdGhlIHBhc3QgdGhyb3VnaG91dFxuICAgKiB0aGUgZW50aXJlIGV4ZWN1dGlvbiBvZiB0aGUgaW5wdXQgc3RyZWFtLCBhbGxvd2luZyB5b3UgdG8gYWNjdW11bGF0ZSB0aGVtXG4gICAqIHRvZ2V0aGVyLiBJdCdzIGVzc2VudGlhbGx5IGxpa2UgYEFycmF5LnByb3RvdHlwZS5yZWR1Y2VgLiBUaGUgcmV0dXJuZWRcbiAgICogc3RyZWFtIGlzIGEgTWVtb3J5U3RyZWFtLCB3aGljaCBtZWFucyBpdCBpcyBhbHJlYWR5IGByZW1lbWJlcigpYCdkLlxuICAgKlxuICAgKiBUaGUgb3V0cHV0IHN0cmVhbSBzdGFydHMgYnkgZW1pdHRpbmcgdGhlIGBzZWVkYCB3aGljaCB5b3UgZ2l2ZSBhcyBhcmd1bWVudC5cbiAgICogVGhlbiwgd2hlbiBhbiBldmVudCBoYXBwZW5zIG9uIHRoZSBpbnB1dCBzdHJlYW0sIGl0IGlzIGNvbWJpbmVkIHdpdGggdGhhdFxuICAgKiBzZWVkIHZhbHVlIHRocm91Z2ggdGhlIGBhY2N1bXVsYXRlYCBmdW5jdGlvbiwgYW5kIHRoZSBvdXRwdXQgdmFsdWUgaXNcbiAgICogZW1pdHRlZCBvbiB0aGUgb3V0cHV0IHN0cmVhbS4gYGZvbGRgIHJlbWVtYmVycyB0aGF0IG91dHB1dCB2YWx1ZSBhcyBgYWNjYFxuICAgKiAoXCJhY2N1bXVsYXRvclwiKSwgYW5kIHRoZW4gd2hlbiBhIG5ldyBpbnB1dCBldmVudCBgdGAgaGFwcGVucywgYGFjY2Agd2lsbCBiZVxuICAgKiBjb21iaW5lZCB3aXRoIHRoYXQgdG8gcHJvZHVjZSB0aGUgbmV3IGBhY2NgIGFuZCBzbyBmb3J0aC5cbiAgICpcbiAgICogTWFyYmxlIGRpYWdyYW06XG4gICAqXG4gICAqIGBgYHRleHRcbiAgICogLS0tLS0tMS0tLS0tMS0tMi0tLS0xLS0tLTEtLS0tLS1cbiAgICogICBmb2xkKChhY2MsIHgpID0+IGFjYyArIHgsIDMpXG4gICAqIDMtLS0tLTQtLS0tLTUtLTctLS0tOC0tLS05LS0tLS0tXG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBhY2N1bXVsYXRlIEEgZnVuY3Rpb24gb2YgdHlwZSBgKGFjYzogUiwgdDogVCkgPT4gUmAgdGhhdFxuICAgKiB0YWtlcyB0aGUgcHJldmlvdXMgYWNjdW11bGF0ZWQgdmFsdWUgYGFjY2AgYW5kIHRoZSBpbmNvbWluZyBldmVudCBmcm9tIHRoZVxuICAgKiBpbnB1dCBzdHJlYW0gYW5kIHByb2R1Y2VzIHRoZSBuZXcgYWNjdW11bGF0ZWQgdmFsdWUuXG4gICAqIEBwYXJhbSBzZWVkIFRoZSBpbml0aWFsIGFjY3VtdWxhdGVkIHZhbHVlLCBvZiB0eXBlIGBSYC5cbiAgICogQHJldHVybiB7TWVtb3J5U3RyZWFtfVxuICAgKi9cbiAgZm9sZDxSPihhY2N1bXVsYXRlOiAoYWNjOiBSLCB0OiBUKSA9PiBSLCBzZWVkOiBSKTogTWVtb3J5U3RyZWFtPFI+IHtcbiAgICByZXR1cm4gbmV3IE1lbW9yeVN0cmVhbTxSPihuZXcgRm9sZDxULCBSPihhY2N1bXVsYXRlLCBzZWVkLCB0aGlzKSk7XG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZXMgYW4gZXJyb3Igd2l0aCBhbm90aGVyIHN0cmVhbS5cbiAgICpcbiAgICogV2hlbiAoYW5kIGlmKSBhbiBlcnJvciBoYXBwZW5zIG9uIHRoZSBpbnB1dCBzdHJlYW0sIGluc3RlYWQgb2YgZm9yd2FyZGluZ1xuICAgKiB0aGF0IGVycm9yIHRvIHRoZSBvdXRwdXQgc3RyZWFtLCAqcmVwbGFjZUVycm9yKiB3aWxsIGNhbGwgdGhlIGByZXBsYWNlYFxuICAgKiBmdW5jdGlvbiB3aGljaCByZXR1cm5zIHRoZSBzdHJlYW0gdGhhdCB0aGUgb3V0cHV0IHN0cmVhbSB3aWxsIHJlcGxpY2F0ZS5cbiAgICogQW5kLCBpbiBjYXNlIHRoYXQgbmV3IHN0cmVhbSBhbHNvIGVtaXRzIGFuIGVycm9yLCBgcmVwbGFjZWAgd2lsbCBiZSBjYWxsZWRcbiAgICogYWdhaW4gdG8gZ2V0IGFub3RoZXIgc3RyZWFtIHRvIHN0YXJ0IHJlcGxpY2F0aW5nLlxuICAgKlxuICAgKiBNYXJibGUgZGlhZ3JhbTpcbiAgICpcbiAgICogYGBgdGV4dFxuICAgKiAtLTEtLS0yLS0tLS0zLS00LS0tLS1YXG4gICAqICAgcmVwbGFjZUVycm9yKCAoKSA9PiAtLTEwLS18IClcbiAgICogLS0xLS0tMi0tLS0tMy0tNC0tLS0tLS0tMTAtLXxcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IHJlcGxhY2UgQSBmdW5jdGlvbiBvZiB0eXBlIGAoZXJyKSA9PiBTdHJlYW1gIHRoYXQgdGFrZXNcbiAgICogdGhlIGVycm9yIHRoYXQgb2NjdXJyZWQgb24gdGhlIGlucHV0IHN0cmVhbSBvciBvbiB0aGUgcHJldmlvdXMgcmVwbGFjZW1lbnRcbiAgICogc3RyZWFtIGFuZCByZXR1cm5zIGEgbmV3IHN0cmVhbS4gVGhlIG91dHB1dCBzdHJlYW0gd2lsbCBiZWhhdmUgbGlrZSB0aGVcbiAgICogc3RyZWFtIHRoYXQgdGhpcyBmdW5jdGlvbiByZXR1cm5zLlxuICAgKiBAcmV0dXJuIHtTdHJlYW19XG4gICAqL1xuICByZXBsYWNlRXJyb3IocmVwbGFjZTogKGVycjogYW55KSA9PiBTdHJlYW08VD4pOiBTdHJlYW08VD4ge1xuICAgIHJldHVybiBuZXcgKHRoaXMuY3RvcigpKTxUPihuZXcgUmVwbGFjZUVycm9yPFQ+KHJlcGxhY2UsIHRoaXMpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGbGF0dGVucyBhIFwic3RyZWFtIG9mIHN0cmVhbXNcIiwgaGFuZGxpbmcgb25seSBvbmUgbmVzdGVkIHN0cmVhbSBhdCBhIHRpbWVcbiAgICogKG5vIGNvbmN1cnJlbmN5KS5cbiAgICpcbiAgICogSWYgdGhlIGlucHV0IHN0cmVhbSBpcyBhIHN0cmVhbSB0aGF0IGVtaXRzIHN0cmVhbXMsIHRoZW4gdGhpcyBvcGVyYXRvciB3aWxsXG4gICAqIHJldHVybiBhbiBvdXRwdXQgc3RyZWFtIHdoaWNoIGlzIGEgZmxhdCBzdHJlYW06IGVtaXRzIHJlZ3VsYXIgZXZlbnRzLiBUaGVcbiAgICogZmxhdHRlbmluZyBoYXBwZW5zIHdpdGhvdXQgY29uY3VycmVuY3kuIEl0IHdvcmtzIGxpa2UgdGhpczogd2hlbiB0aGUgaW5wdXRcbiAgICogc3RyZWFtIGVtaXRzIGEgbmVzdGVkIHN0cmVhbSwgKmZsYXR0ZW4qIHdpbGwgc3RhcnQgaW1pdGF0aW5nIHRoYXQgbmVzdGVkXG4gICAqIG9uZS4gSG93ZXZlciwgYXMgc29vbiBhcyB0aGUgbmV4dCBuZXN0ZWQgc3RyZWFtIGlzIGVtaXR0ZWQgb24gdGhlIGlucHV0XG4gICAqIHN0cmVhbSwgKmZsYXR0ZW4qIHdpbGwgZm9yZ2V0IHRoZSBwcmV2aW91cyBuZXN0ZWQgb25lIGl0IHdhcyBpbWl0YXRpbmcsIGFuZFxuICAgKiB3aWxsIHN0YXJ0IGltaXRhdGluZyB0aGUgbmV3IG5lc3RlZCBvbmUuXG4gICAqXG4gICAqIE1hcmJsZSBkaWFncmFtOlxuICAgKlxuICAgKiBgYGB0ZXh0XG4gICAqIC0tKy0tLS0tLS0tKy0tLS0tLS0tLS0tLS0tLVxuICAgKiAgIFxcICAgICAgICBcXFxuICAgKiAgICBcXCAgICAgICAtLS0tMS0tLS0yLS0tMy0tXG4gICAqICAgIC0tYS0tYi0tLS1jLS0tLWQtLS0tLS0tLVxuICAgKiAgICAgICAgICAgZmxhdHRlblxuICAgKiAtLS0tLWEtLWItLS0tLS0xLS0tLTItLS0zLS1cbiAgICogYGBgXG4gICAqXG4gICAqIEByZXR1cm4ge1N0cmVhbX1cbiAgICovXG4gIGZsYXR0ZW48Uj4odGhpczogU3RyZWFtPFN0cmVhbTxSPj4pOiBUIHtcbiAgICBjb25zdCBwID0gdGhpcy5fcHJvZDtcbiAgICByZXR1cm4gbmV3IFN0cmVhbTxSPihuZXcgRmxhdHRlbih0aGlzKSkgYXMgVCAmIFN0cmVhbTxSPjtcbiAgfVxuXG4gIC8qKlxuICAgKiBQYXNzZXMgdGhlIGlucHV0IHN0cmVhbSB0byBhIGN1c3RvbSBvcGVyYXRvciwgdG8gcHJvZHVjZSBhbiBvdXRwdXQgc3RyZWFtLlxuICAgKlxuICAgKiAqY29tcG9zZSogaXMgYSBoYW5keSB3YXkgb2YgdXNpbmcgYW4gZXhpc3RpbmcgZnVuY3Rpb24gaW4gYSBjaGFpbmVkIHN0eWxlLlxuICAgKiBJbnN0ZWFkIG9mIHdyaXRpbmcgYG91dFN0cmVhbSA9IGYoaW5TdHJlYW0pYCB5b3UgY2FuIHdyaXRlXG4gICAqIGBvdXRTdHJlYW0gPSBpblN0cmVhbS5jb21wb3NlKGYpYC5cbiAgICpcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gb3BlcmF0b3IgQSBmdW5jdGlvbiB0aGF0IHRha2VzIGEgc3RyZWFtIGFzIGlucHV0IGFuZFxuICAgKiByZXR1cm5zIGEgc3RyZWFtIGFzIHdlbGwuXG4gICAqIEByZXR1cm4ge1N0cmVhbX1cbiAgICovXG4gIGNvbXBvc2U8VT4ob3BlcmF0b3I6IChzdHJlYW06IFN0cmVhbTxUPikgPT4gVSk6IFUge1xuICAgIHJldHVybiBvcGVyYXRvcih0aGlzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFuIG91dHB1dCBzdHJlYW0gdGhhdCBiZWhhdmVzIGxpa2UgdGhlIGlucHV0IHN0cmVhbSwgYnV0IGFsc29cbiAgICogcmVtZW1iZXJzIHRoZSBtb3N0IHJlY2VudCBldmVudCB0aGF0IGhhcHBlbnMgb24gdGhlIGlucHV0IHN0cmVhbSwgc28gdGhhdCBhXG4gICAqIG5ld2x5IGFkZGVkIGxpc3RlbmVyIHdpbGwgaW1tZWRpYXRlbHkgcmVjZWl2ZSB0aGF0IG1lbW9yaXNlZCBldmVudC5cbiAgICpcbiAgICogQHJldHVybiB7TWVtb3J5U3RyZWFtfVxuICAgKi9cbiAgcmVtZW1iZXIoKTogTWVtb3J5U3RyZWFtPFQ+IHtcbiAgICByZXR1cm4gbmV3IE1lbW9yeVN0cmVhbTxUPihuZXcgUmVtZW1iZXI8VD4odGhpcykpO1xuICB9XG5cbiAgZGVidWcoKTogU3RyZWFtPFQ+O1xuICBkZWJ1ZyhsYWJlbE9yU3B5OiBzdHJpbmcpOiBTdHJlYW08VD47XG4gIGRlYnVnKGxhYmVsT3JTcHk6ICh0OiBUKSA9PiBhbnkpOiBTdHJlYW08VD47XG4gIC8qKlxuICAgKiBSZXR1cm5zIGFuIG91dHB1dCBzdHJlYW0gdGhhdCBpZGVudGljYWxseSBiZWhhdmVzIGxpa2UgdGhlIGlucHV0IHN0cmVhbSxcbiAgICogYnV0IGFsc28gcnVucyBhIGBzcHlgIGZ1bmN0aW9uIGZvciBlYWNoIGV2ZW50LCB0byBoZWxwIHlvdSBkZWJ1ZyB5b3VyIGFwcC5cbiAgICpcbiAgICogKmRlYnVnKiB0YWtlcyBhIGBzcHlgIGZ1bmN0aW9uIGFzIGFyZ3VtZW50LCBhbmQgcnVucyB0aGF0IGZvciBlYWNoIGV2ZW50XG4gICAqIGhhcHBlbmluZyBvbiB0aGUgaW5wdXQgc3RyZWFtLiBJZiB5b3UgZG9uJ3QgcHJvdmlkZSB0aGUgYHNweWAgYXJndW1lbnQsXG4gICAqIHRoZW4gKmRlYnVnKiB3aWxsIGp1c3QgYGNvbnNvbGUubG9nYCBlYWNoIGV2ZW50LiBUaGlzIGhlbHBzIHlvdSB0b1xuICAgKiB1bmRlcnN0YW5kIHRoZSBmbG93IG9mIGV2ZW50cyB0aHJvdWdoIHNvbWUgb3BlcmF0b3IgY2hhaW4uXG4gICAqXG4gICAqIFBsZWFzZSBub3RlIHRoYXQgaWYgdGhlIG91dHB1dCBzdHJlYW0gaGFzIG5vIGxpc3RlbmVycywgdGhlbiBpdCB3aWxsIG5vdFxuICAgKiBzdGFydCwgd2hpY2ggbWVhbnMgYHNweWAgd2lsbCBuZXZlciBydW4gYmVjYXVzZSBubyBhY3R1YWwgZXZlbnQgaGFwcGVucyBpblxuICAgKiB0aGF0IGNhc2UuXG4gICAqXG4gICAqIE1hcmJsZSBkaWFncmFtOlxuICAgKlxuICAgKiBgYGB0ZXh0XG4gICAqIC0tMS0tLS0yLS0tLS0zLS0tLS00LS1cbiAgICogICAgICAgICBkZWJ1Z1xuICAgKiAtLTEtLS0tMi0tLS0tMy0tLS0tNC0tXG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsYWJlbE9yU3B5IEEgc3RyaW5nIHRvIHVzZSBhcyB0aGUgbGFiZWwgd2hlbiBwcmludGluZ1xuICAgKiBkZWJ1ZyBpbmZvcm1hdGlvbiBvbiB0aGUgY29uc29sZSwgb3IgYSAnc3B5JyBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIGV2ZW50XG4gICAqIGFzIGFyZ3VtZW50LCBhbmQgZG9lcyBub3QgbmVlZCB0byByZXR1cm4gYW55dGhpbmcuXG4gICAqIEByZXR1cm4ge1N0cmVhbX1cbiAgICovXG4gIGRlYnVnKGxhYmVsT3JTcHk/OiBzdHJpbmcgfCAoKHQ6IFQpID0+IGFueSkpOiBTdHJlYW08VD4ge1xuICAgIHJldHVybiBuZXcgKHRoaXMuY3RvcigpKTxUPihuZXcgRGVidWc8VD4odGhpcywgbGFiZWxPclNweSkpO1xuICB9XG5cbiAgLyoqXG4gICAqICppbWl0YXRlKiBjaGFuZ2VzIHRoaXMgY3VycmVudCBTdHJlYW0gdG8gZW1pdCB0aGUgc2FtZSBldmVudHMgdGhhdCB0aGVcbiAgICogYG90aGVyYCBnaXZlbiBTdHJlYW0gZG9lcy4gVGhpcyBtZXRob2QgcmV0dXJucyBub3RoaW5nLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBleGlzdHMgdG8gYWxsb3cgb25lIHRoaW5nOiAqKmNpcmN1bGFyIGRlcGVuZGVuY3kgb2Ygc3RyZWFtcyoqLlxuICAgKiBGb3IgaW5zdGFuY2UsIGxldCdzIGltYWdpbmUgdGhhdCBmb3Igc29tZSByZWFzb24geW91IG5lZWQgdG8gY3JlYXRlIGFcbiAgICogY2lyY3VsYXIgZGVwZW5kZW5jeSB3aGVyZSBzdHJlYW0gYGZpcnN0JGAgZGVwZW5kcyBvbiBzdHJlYW0gYHNlY29uZCRgXG4gICAqIHdoaWNoIGluIHR1cm4gZGVwZW5kcyBvbiBgZmlyc3QkYDpcbiAgICpcbiAgICogPCEtLSBza2lwLWV4YW1wbGUgLS0+XG4gICAqIGBgYGpzXG4gICAqIGltcG9ydCBkZWxheSBmcm9tICd4c3RyZWFtL2V4dHJhL2RlbGF5J1xuICAgKlxuICAgKiB2YXIgZmlyc3QkID0gc2Vjb25kJC5tYXAoeCA9PiB4ICogMTApLnRha2UoMyk7XG4gICAqIHZhciBzZWNvbmQkID0gZmlyc3QkLm1hcCh4ID0+IHggKyAxKS5zdGFydFdpdGgoMSkuY29tcG9zZShkZWxheSgxMDApKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEhvd2V2ZXIsIHRoYXQgaXMgaW52YWxpZCBKYXZhU2NyaXB0LCBiZWNhdXNlIGBzZWNvbmQkYCBpcyB1bmRlZmluZWRcbiAgICogb24gdGhlIGZpcnN0IGxpbmUuIFRoaXMgaXMgaG93ICppbWl0YXRlKiBjYW4gaGVscCBzb2x2ZSBpdDpcbiAgICpcbiAgICogYGBganNcbiAgICogaW1wb3J0IGRlbGF5IGZyb20gJ3hzdHJlYW0vZXh0cmEvZGVsYXknXG4gICAqXG4gICAqIHZhciBzZWNvbmRQcm94eSQgPSB4cy5jcmVhdGUoKTtcbiAgICogdmFyIGZpcnN0JCA9IHNlY29uZFByb3h5JC5tYXAoeCA9PiB4ICogMTApLnRha2UoMyk7XG4gICAqIHZhciBzZWNvbmQkID0gZmlyc3QkLm1hcCh4ID0+IHggKyAxKS5zdGFydFdpdGgoMSkuY29tcG9zZShkZWxheSgxMDApKTtcbiAgICogc2Vjb25kUHJveHkkLmltaXRhdGUoc2Vjb25kJCk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBXZSBjcmVhdGUgYHNlY29uZFByb3h5JGAgYmVmb3JlIHRoZSBvdGhlcnMsIHNvIGl0IGNhbiBiZSB1c2VkIGluIHRoZVxuICAgKiBkZWNsYXJhdGlvbiBvZiBgZmlyc3QkYC4gVGhlbiwgYWZ0ZXIgYm90aCBgZmlyc3QkYCBhbmQgYHNlY29uZCRgIGFyZVxuICAgKiBkZWZpbmVkLCB3ZSBob29rIGBzZWNvbmRQcm94eSRgIHdpdGggYHNlY29uZCRgIHdpdGggYGltaXRhdGUoKWAgdG8gdGVsbFxuICAgKiB0aGF0IHRoZXkgYXJlIFwidGhlIHNhbWVcIi4gYGltaXRhdGVgIHdpbGwgbm90IHRyaWdnZXIgdGhlIHN0YXJ0IG9mIGFueVxuICAgKiBzdHJlYW0sIGl0IGp1c3QgYmluZHMgYHNlY29uZFByb3h5JGAgYW5kIGBzZWNvbmQkYCB0b2dldGhlci5cbiAgICpcbiAgICogVGhlIGZvbGxvd2luZyBpcyBhbiBleGFtcGxlIHdoZXJlIGBpbWl0YXRlKClgIGlzIGltcG9ydGFudCBpbiBDeWNsZS5qc1xuICAgKiBhcHBsaWNhdGlvbnMuIEEgcGFyZW50IGNvbXBvbmVudCBjb250YWlucyBzb21lIGNoaWxkIGNvbXBvbmVudHMuIEEgY2hpbGRcbiAgICogaGFzIGFuIGFjdGlvbiBzdHJlYW0gd2hpY2ggaXMgZ2l2ZW4gdG8gdGhlIHBhcmVudCB0byBkZWZpbmUgaXRzIHN0YXRlOlxuICAgKlxuICAgKiA8IS0tIHNraXAtZXhhbXBsZSAtLT5cbiAgICogYGBganNcbiAgICogY29uc3QgY2hpbGRBY3Rpb25Qcm94eSQgPSB4cy5jcmVhdGUoKTtcbiAgICogY29uc3QgcGFyZW50ID0gUGFyZW50KHsuLi5zb3VyY2VzLCBjaGlsZEFjdGlvbiQ6IGNoaWxkQWN0aW9uUHJveHkkfSk7XG4gICAqIGNvbnN0IGNoaWxkQWN0aW9uJCA9IHBhcmVudC5zdGF0ZSQubWFwKHMgPT4gcy5jaGlsZC5hY3Rpb24kKS5mbGF0dGVuKCk7XG4gICAqIGNoaWxkQWN0aW9uUHJveHkkLmltaXRhdGUoY2hpbGRBY3Rpb24kKTtcbiAgICogYGBgXG4gICAqXG4gICAqIE5vdGUsIHRob3VnaCwgdGhhdCAqKmBpbWl0YXRlKClgIGRvZXMgbm90IHN1cHBvcnQgTWVtb3J5U3RyZWFtcyoqLiBJZiB3ZVxuICAgKiB3b3VsZCBhdHRlbXB0IHRvIGltaXRhdGUgYSBNZW1vcnlTdHJlYW0gaW4gYSBjaXJjdWxhciBkZXBlbmRlbmN5LCB3ZSB3b3VsZFxuICAgKiBlaXRoZXIgZ2V0IGEgcmFjZSBjb25kaXRpb24gKHdoZXJlIHRoZSBzeW1wdG9tIHdvdWxkIGJlIFwibm90aGluZyBoYXBwZW5zXCIpXG4gICAqIG9yIGFuIGluZmluaXRlIGN5Y2xpYyBlbWlzc2lvbiBvZiB2YWx1ZXMuIEl0J3MgdXNlZnVsIHRvIHRoaW5rIGFib3V0XG4gICAqIE1lbW9yeVN0cmVhbXMgYXMgY2VsbHMgaW4gYSBzcHJlYWRzaGVldC4gSXQgZG9lc24ndCBtYWtlIGFueSBzZW5zZSB0b1xuICAgKiBkZWZpbmUgYSBzcHJlYWRzaGVldCBjZWxsIGBBMWAgd2l0aCBhIGZvcm11bGEgdGhhdCBkZXBlbmRzIG9uIGBCMWAgYW5kXG4gICAqIGNlbGwgYEIxYCBkZWZpbmVkIHdpdGggYSBmb3JtdWxhIHRoYXQgZGVwZW5kcyBvbiBgQTFgLlxuICAgKlxuICAgKiBJZiB5b3UgZmluZCB5b3Vyc2VsZiB3YW50aW5nIHRvIHVzZSBgaW1pdGF0ZSgpYCB3aXRoIGFcbiAgICogTWVtb3J5U3RyZWFtLCB5b3Ugc2hvdWxkIHJld29yayB5b3VyIGNvZGUgYXJvdW5kIGBpbWl0YXRlKClgIHRvIHVzZSBhXG4gICAqIFN0cmVhbSBpbnN0ZWFkLiBMb29rIGZvciB0aGUgc3RyZWFtIGluIHRoZSBjaXJjdWxhciBkZXBlbmRlbmN5IHRoYXRcbiAgICogcmVwcmVzZW50cyBhbiBldmVudCBzdHJlYW0sIGFuZCB0aGF0IHdvdWxkIGJlIGEgY2FuZGlkYXRlIGZvciBjcmVhdGluZyBhXG4gICAqIHByb3h5IFN0cmVhbSB3aGljaCB0aGVuIGltaXRhdGVzIHRoZSB0YXJnZXQgU3RyZWFtLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmVhbX0gdGFyZ2V0IFRoZSBvdGhlciBzdHJlYW0gdG8gaW1pdGF0ZSBvbiB0aGUgY3VycmVudCBvbmUuIE11c3RcbiAgICogbm90IGJlIGEgTWVtb3J5U3RyZWFtLlxuICAgKi9cbiAgaW1pdGF0ZSh0YXJnZXQ6IFN0cmVhbTxUPik6IHZvaWQge1xuICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBNZW1vcnlTdHJlYW0pXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0EgTWVtb3J5U3RyZWFtIHdhcyBnaXZlbiB0byBpbWl0YXRlKCksIGJ1dCBpdCBvbmx5ICcgK1xuICAgICAgJ3N1cHBvcnRzIGEgU3RyZWFtLiBSZWFkIG1vcmUgYWJvdXQgdGhpcyByZXN0cmljdGlvbiBoZXJlOiAnICtcbiAgICAgICdodHRwczovL2dpdGh1Yi5jb20vc3RhbHR6L3hzdHJlYW0jZmFxJyk7XG4gICAgdGhpcy5fdGFyZ2V0ID0gdGFyZ2V0O1xuICAgIGZvciAobGV0IGlscyA9IHRoaXMuX2lscywgTiA9IGlscy5sZW5ndGgsIGkgPSAwOyBpIDwgTjsgaSsrKSB0YXJnZXQuX2FkZChpbHNbaV0pO1xuICAgIHRoaXMuX2lscyA9IFtdO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcmNlcyB0aGUgU3RyZWFtIHRvIGVtaXQgdGhlIGdpdmVuIHZhbHVlIHRvIGl0cyBsaXN0ZW5lcnMuXG4gICAqXG4gICAqIEFzIHRoZSBuYW1lIGluZGljYXRlcywgaWYgeW91IHVzZSB0aGlzLCB5b3UgYXJlIG1vc3QgbGlrZWx5IGRvaW5nIHNvbWV0aGluZ1xuICAgKiBUaGUgV3JvbmcgV2F5LiBQbGVhc2UgdHJ5IHRvIHVuZGVyc3RhbmQgdGhlIHJlYWN0aXZlIHdheSBiZWZvcmUgdXNpbmcgdGhpc1xuICAgKiBtZXRob2QuIFVzZSBpdCBvbmx5IHdoZW4geW91IGtub3cgd2hhdCB5b3UgYXJlIGRvaW5nLlxuICAgKlxuICAgKiBAcGFyYW0gdmFsdWUgVGhlIFwibmV4dFwiIHZhbHVlIHlvdSB3YW50IHRvIGJyb2FkY2FzdCB0byBhbGwgbGlzdGVuZXJzIG9mXG4gICAqIHRoaXMgU3RyZWFtLlxuICAgKi9cbiAgc2hhbWVmdWxseVNlbmROZXh0KHZhbHVlOiBUKSB7XG4gICAgdGhpcy5fbih2YWx1ZSk7XG4gIH1cblxuICAvKipcbiAgICogRm9yY2VzIHRoZSBTdHJlYW0gdG8gZW1pdCB0aGUgZ2l2ZW4gZXJyb3IgdG8gaXRzIGxpc3RlbmVycy5cbiAgICpcbiAgICogQXMgdGhlIG5hbWUgaW5kaWNhdGVzLCBpZiB5b3UgdXNlIHRoaXMsIHlvdSBhcmUgbW9zdCBsaWtlbHkgZG9pbmcgc29tZXRoaW5nXG4gICAqIFRoZSBXcm9uZyBXYXkuIFBsZWFzZSB0cnkgdG8gdW5kZXJzdGFuZCB0aGUgcmVhY3RpdmUgd2F5IGJlZm9yZSB1c2luZyB0aGlzXG4gICAqIG1ldGhvZC4gVXNlIGl0IG9ubHkgd2hlbiB5b3Uga25vdyB3aGF0IHlvdSBhcmUgZG9pbmcuXG4gICAqXG4gICAqIEBwYXJhbSB7YW55fSBlcnJvciBUaGUgZXJyb3IgeW91IHdhbnQgdG8gYnJvYWRjYXN0IHRvIGFsbCB0aGUgbGlzdGVuZXJzIG9mXG4gICAqIHRoaXMgU3RyZWFtLlxuICAgKi9cbiAgc2hhbWVmdWxseVNlbmRFcnJvcihlcnJvcjogYW55KSB7XG4gICAgdGhpcy5fZShlcnJvcik7XG4gIH1cblxuICAvKipcbiAgICogRm9yY2VzIHRoZSBTdHJlYW0gdG8gZW1pdCB0aGUgXCJjb21wbGV0ZWRcIiBldmVudCB0byBpdHMgbGlzdGVuZXJzLlxuICAgKlxuICAgKiBBcyB0aGUgbmFtZSBpbmRpY2F0ZXMsIGlmIHlvdSB1c2UgdGhpcywgeW91IGFyZSBtb3N0IGxpa2VseSBkb2luZyBzb21ldGhpbmdcbiAgICogVGhlIFdyb25nIFdheS4gUGxlYXNlIHRyeSB0byB1bmRlcnN0YW5kIHRoZSByZWFjdGl2ZSB3YXkgYmVmb3JlIHVzaW5nIHRoaXNcbiAgICogbWV0aG9kLiBVc2UgaXQgb25seSB3aGVuIHlvdSBrbm93IHdoYXQgeW91IGFyZSBkb2luZy5cbiAgICovXG4gIHNoYW1lZnVsbHlTZW5kQ29tcGxldGUoKSB7XG4gICAgdGhpcy5fYygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBcImRlYnVnXCIgbGlzdGVuZXIgdG8gdGhlIHN0cmVhbS4gVGhlcmUgY2FuIG9ubHkgYmUgb25lIGRlYnVnXG4gICAqIGxpc3RlbmVyLCB0aGF0J3Mgd2h5IHRoaXMgaXMgJ3NldERlYnVnTGlzdGVuZXInLiBUbyByZW1vdmUgdGhlIGRlYnVnXG4gICAqIGxpc3RlbmVyLCBqdXN0IGNhbGwgc2V0RGVidWdMaXN0ZW5lcihudWxsKS5cbiAgICpcbiAgICogQSBkZWJ1ZyBsaXN0ZW5lciBpcyBsaWtlIGFueSBvdGhlciBsaXN0ZW5lci4gVGhlIG9ubHkgZGlmZmVyZW5jZSBpcyB0aGF0IGFcbiAgICogZGVidWcgbGlzdGVuZXIgaXMgXCJzdGVhbHRoeVwiOiBpdHMgcHJlc2VuY2UvYWJzZW5jZSBkb2VzIG5vdCB0cmlnZ2VyIHRoZVxuICAgKiBzdGFydC9zdG9wIG9mIHRoZSBzdHJlYW0gKG9yIHRoZSBwcm9kdWNlciBpbnNpZGUgdGhlIHN0cmVhbSkuIFRoaXMgaXNcbiAgICogdXNlZnVsIHNvIHlvdSBjYW4gaW5zcGVjdCB3aGF0IGlzIGdvaW5nIG9uIHdpdGhvdXQgY2hhbmdpbmcgdGhlIGJlaGF2aW9yXG4gICAqIG9mIHRoZSBwcm9ncmFtLiBJZiB5b3UgaGF2ZSBhbiBpZGxlIHN0cmVhbSBhbmQgeW91IGFkZCBhIG5vcm1hbCBsaXN0ZW5lciB0b1xuICAgKiBpdCwgdGhlIHN0cmVhbSB3aWxsIHN0YXJ0IGV4ZWN1dGluZy4gQnV0IGlmIHlvdSBzZXQgYSBkZWJ1ZyBsaXN0ZW5lciBvbiBhblxuICAgKiBpZGxlIHN0cmVhbSwgaXQgd29uJ3Qgc3RhcnQgZXhlY3V0aW5nIChub3QgdW50aWwgdGhlIGZpcnN0IG5vcm1hbCBsaXN0ZW5lclxuICAgKiBpcyBhZGRlZCkuXG4gICAqXG4gICAqIEFzIHRoZSBuYW1lIGluZGljYXRlcywgd2UgZG9uJ3QgcmVjb21tZW5kIHVzaW5nIHRoaXMgbWV0aG9kIHRvIGJ1aWxkIGFwcFxuICAgKiBsb2dpYy4gSW4gZmFjdCwgaW4gbW9zdCBjYXNlcyB0aGUgZGVidWcgb3BlcmF0b3Igd29ya3MganVzdCBmaW5lLiBPbmx5IHVzZVxuICAgKiB0aGlzIG9uZSBpZiB5b3Uga25vdyB3aGF0IHlvdSdyZSBkb2luZy5cbiAgICpcbiAgICogQHBhcmFtIHtMaXN0ZW5lcjxUPn0gbGlzdGVuZXJcbiAgICovXG4gIHNldERlYnVnTGlzdGVuZXIobGlzdGVuZXI6IFBhcnRpYWw8TGlzdGVuZXI8VD4+IHwgbnVsbCB8IHVuZGVmaW5lZCkge1xuICAgIGlmICghbGlzdGVuZXIpIHtcbiAgICAgIHRoaXMuX2QgPSBmYWxzZTtcbiAgICAgIHRoaXMuX2RsID0gTk8gYXMgSW50ZXJuYWxMaXN0ZW5lcjxUPjtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fZCA9IHRydWU7XG4gICAgICAobGlzdGVuZXIgYXMgSW50ZXJuYWxMaXN0ZW5lcjxUPikuX24gPSBsaXN0ZW5lci5uZXh0IHx8IG5vb3A7XG4gICAgICAobGlzdGVuZXIgYXMgSW50ZXJuYWxMaXN0ZW5lcjxUPikuX2UgPSBsaXN0ZW5lci5lcnJvciB8fCBub29wO1xuICAgICAgKGxpc3RlbmVyIGFzIEludGVybmFsTGlzdGVuZXI8VD4pLl9jID0gbGlzdGVuZXIuY29tcGxldGUgfHwgbm9vcDtcbiAgICAgIHRoaXMuX2RsID0gbGlzdGVuZXIgYXMgSW50ZXJuYWxMaXN0ZW5lcjxUPjtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE1lbW9yeVN0cmVhbTxUPiBleHRlbmRzIFN0cmVhbTxUPiB7XG4gIHByaXZhdGUgX3Y6IFQ7XG4gIHByaXZhdGUgX2hhczogYm9vbGVhbiA9IGZhbHNlO1xuICBjb25zdHJ1Y3Rvcihwcm9kdWNlcjogSW50ZXJuYWxQcm9kdWNlcjxUPikge1xuICAgIHN1cGVyKHByb2R1Y2VyKTtcbiAgfVxuXG4gIF9uKHg6IFQpIHtcbiAgICB0aGlzLl92ID0geDtcbiAgICB0aGlzLl9oYXMgPSB0cnVlO1xuICAgIHN1cGVyLl9uKHgpO1xuICB9XG5cbiAgX2FkZChpbDogSW50ZXJuYWxMaXN0ZW5lcjxUPik6IHZvaWQge1xuICAgIGNvbnN0IHRhID0gdGhpcy5fdGFyZ2V0O1xuICAgIGlmICh0YSAhPT0gTk8pIHJldHVybiB0YS5fYWRkKGlsKTtcbiAgICBjb25zdCBhID0gdGhpcy5faWxzO1xuICAgIGEucHVzaChpbCk7XG4gICAgaWYgKGEubGVuZ3RoID4gMSkge1xuICAgICAgaWYgKHRoaXMuX2hhcykgaWwuX24odGhpcy5fdik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh0aGlzLl9zdG9wSUQgIT09IE5PKSB7XG4gICAgICBpZiAodGhpcy5faGFzKSBpbC5fbih0aGlzLl92KTtcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9zdG9wSUQpO1xuICAgICAgdGhpcy5fc3RvcElEID0gTk87XG4gICAgfSBlbHNlIGlmICh0aGlzLl9oYXMpIGlsLl9uKHRoaXMuX3YpOyBlbHNlIHtcbiAgICAgIGNvbnN0IHAgPSB0aGlzLl9wcm9kO1xuICAgICAgaWYgKHAgIT09IE5PKSBwLl9zdGFydCh0aGlzKTtcbiAgICB9XG4gIH1cblxuICBfc3RvcE5vdygpIHtcbiAgICB0aGlzLl9oYXMgPSBmYWxzZTtcbiAgICBzdXBlci5fc3RvcE5vdygpO1xuICB9XG5cbiAgX3goKTogdm9pZCB7XG4gICAgdGhpcy5faGFzID0gZmFsc2U7XG4gICAgc3VwZXIuX3goKTtcbiAgfVxuXG4gIG1hcDxVPihwcm9qZWN0OiAodDogVCkgPT4gVSk6IE1lbW9yeVN0cmVhbTxVPiB7XG4gICAgcmV0dXJuIHRoaXMuX21hcChwcm9qZWN0KSBhcyBNZW1vcnlTdHJlYW08VT47XG4gIH1cblxuICBtYXBUbzxVPihwcm9qZWN0ZWRWYWx1ZTogVSk6IE1lbW9yeVN0cmVhbTxVPiB7XG4gICAgcmV0dXJuIHN1cGVyLm1hcFRvKHByb2plY3RlZFZhbHVlKSBhcyBNZW1vcnlTdHJlYW08VT47XG4gIH1cblxuICB0YWtlKGFtb3VudDogbnVtYmVyKTogTWVtb3J5U3RyZWFtPFQ+IHtcbiAgICByZXR1cm4gc3VwZXIudGFrZShhbW91bnQpIGFzIE1lbW9yeVN0cmVhbTxUPjtcbiAgfVxuXG4gIGVuZFdoZW4ob3RoZXI6IFN0cmVhbTxhbnk+KTogTWVtb3J5U3RyZWFtPFQ+IHtcbiAgICByZXR1cm4gc3VwZXIuZW5kV2hlbihvdGhlcikgYXMgTWVtb3J5U3RyZWFtPFQ+O1xuICB9XG5cbiAgcmVwbGFjZUVycm9yKHJlcGxhY2U6IChlcnI6IGFueSkgPT4gU3RyZWFtPFQ+KTogTWVtb3J5U3RyZWFtPFQ+IHtcbiAgICByZXR1cm4gc3VwZXIucmVwbGFjZUVycm9yKHJlcGxhY2UpIGFzIE1lbW9yeVN0cmVhbTxUPjtcbiAgfVxuXG4gIHJlbWVtYmVyKCk6IE1lbW9yeVN0cmVhbTxUPiB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBkZWJ1ZygpOiBNZW1vcnlTdHJlYW08VD47XG4gIGRlYnVnKGxhYmVsT3JTcHk6IHN0cmluZyk6IE1lbW9yeVN0cmVhbTxUPjtcbiAgZGVidWcobGFiZWxPclNweTogKHQ6IFQpID0+IGFueSk6IE1lbW9yeVN0cmVhbTxUPjtcbiAgZGVidWcobGFiZWxPclNweT86IHN0cmluZyB8ICgodDogVCkgPT4gYW55KSB8IHVuZGVmaW5lZCk6IE1lbW9yeVN0cmVhbTxUPiB7XG4gICAgcmV0dXJuIHN1cGVyLmRlYnVnKGxhYmVsT3JTcHkgYXMgYW55KSBhcyBNZW1vcnlTdHJlYW08VD47XG4gIH1cbn1cblxuZXhwb3J0IHtOTywgTk9fSUx9O1xuY29uc3QgeHMgPSBTdHJlYW07XG50eXBlIHhzPFQ+ID0gU3RyZWFtPFQ+O1xuZXhwb3J0IGRlZmF1bHQgeHM7XG4iLCJpbXBvcnQge3J1bn0gZnJvbSAnQGN5Y2xlL3J1bic7XG5pbXBvcnQgeHMgZnJvbSAneHN0cmVhbSc7XG5pbXBvcnQge21ha2VST1NEcml2ZXJ9IGZyb20gJy4vbWFrZVJPU0RyaXZlcic7XG5cbmZ1bmN0aW9uIG1haW4oc291cmNlcykge1xuICAvLyBhZGFwdGVkIGZyb20gZnJvbVxuICAvLyAgIGh0dHBzOi8vZ2l0aHViLmNvbS9Sb2JvdFdlYlRvb2xzL3Jvc2xpYmpzL2Jsb2IvbWFzdGVyL2V4YW1wbGVzL3NpbXBsZS5odG1sXG5cbiAgLy8gUHVibGlzaGluZyBhIFRvcGljXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJ1biBgcm9zdG9waWMgZWNobyAvY21kX3ZlbGAgb24gdGhlIG1hY2hpbmUgcnVubmluZyBST1MgdG8gc2VlIHB1Ymxpc2hlZFxuICAvLyAgIG1lc3NhZ2VzLlxuICBjb25zdCB0b3BpYyQgPSB4cy5vZih7XG4gICAgdHlwZTogJ3RvcGljJyxcbiAgICB2YWx1ZToge1xuICAgICAgbmFtZTogJy9jbWRfdmVsJyxcbiAgICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgbGluZWFyIDoge1xuICAgICAgICAgIHggOiAwLjEsXG4gICAgICAgICAgeSA6IDAuMixcbiAgICAgICAgICB6IDogMC4zLFxuICAgICAgICB9LFxuICAgICAgICBhbmd1bGFyIDoge1xuICAgICAgICAgIHggOiAtMC4xLFxuICAgICAgICAgIHkgOiAtMC4yLFxuICAgICAgICAgIHogOiAtMC4zLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcblxuICAvL1N1YnNjcmliaW5nIHRvIGEgVG9waWNcbiAgLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gUnVuIGByb3N0b3BpYyBwdWIgL2xpc3RlbmVyIHN0ZF9tc2dzL1N0cmluZyBcImRhdGE6ICdIZWxsbyB3b3JsZCchXCJgIG9uIHRoZVxuICAvLyAgIG1hY2hpbmUgcnVubmluZyBST1MgdG8gcHVibGlzaCBtZXNzYWdlcyBhbmQgY2hlY2sgdGhlIGNvbnNvbGUgZm9yXG4gIC8vICAgcmVjZWl2ZWQgbWVzc2FnZXMuXG4gIHNvdXJjZXMuUk9TXG4gICAgLmZpbHRlcih2YWx1ZSA9PiB2YWx1ZS50eXBlID09PSAndG9waWMnICYmIHZhbHVlLnZhbHVlLm5hbWUgPT09ICcvbGlzdGVuZXInKVxuICAgIC5hZGRMaXN0ZW5lcih7XG4gICAgICBuZXh0OiB2YWx1ZSA9PiB7XG4gICAgICAgIGNvbnN0IHRvcGljID0gdmFsdWUudmFsdWU7XG4gICAgICAgIGNvbnNvbGUubG9nKCdSZWNlaXZlZCBtZXNzYWdlIG9uICcgKyB0b3BpYy5uYW1lICsgJzogJyArIHRvcGljLm1lc3NhZ2UuZGF0YSk7XG4gICAgICB9LFxuICAgIH0pO1xuXG4gIC8vIENhbGxpbmcgYSBzZXJ2aWNlXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gUnVuIGByb3NydW4gcm9zcHlfdHV0b3JpYWxzIGFkZF90d29faW50c19zZXJ2ZXJgIHRvIHN0YXJ0IHRoZSBzZXJ2aWNlIHNlcnZlclxuICBjb25zdCBzZXJ2aWNlJCA9IHhzLm9mKHtcbiAgICB0eXBlOiAnc2VydmljZScsXG4gICAgdmFsdWU6IHtcbiAgICAgIG5hbWU6ICcvYWRkX3R3b19pbnRzJyxcbiAgICAgIHJlcXVlc3Q6IHtcbiAgICAgICAgYTogMSxcbiAgICAgICAgYjogMixcbiAgICAgIH0sXG4gICAgfVxuICB9KTtcblxuICBzb3VyY2VzLlJPU1xuICAgIC5maWx0ZXIodmFsdWUgPT4gdmFsdWUudHlwZSA9PT0gJ3NlcnZpY2UnICYmIHZhbHVlLnZhbHVlLm5hbWUgPT09ICcvYWRkX3R3b19pbnRzJylcbiAgICAubWFwKHZhbHVlID0+IHZhbHVlLnZhbHVlLnJlc3BvbnNlJCkuZmxhdHRlbigpLmFkZExpc3RlbmVyKHtcbiAgICAgIG5leHQ6IHJlc3VsdCA9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdSZXN1bHQgZm9yIHNlcnZpY2UgY2FsbDogJyArIHJlc3VsdC5zdW0pO1xuICAgICAgfSxcbiAgICAgIGVycm9yOiBlcnIgPT4gY29uc29sZS5lcnJvcihlcnIpLFxuICAgIH0pO1xuXG4gIC8vIGFkYXB0ZWQgZnJvbSBmcm9tXG4gIC8vICAgaHR0cHM6Ly9naXRodWIuY29tL1JvYm90V2ViVG9vbHMvcm9zbGlianMvYmxvYi9tYXN0ZXIvZXhhbXBsZXMvZmlib25hY2NpLmh0bWxcblxuICAvLyBUaGUgQWN0aW9uQ2xpZW50XG4gIC8vIC0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBSdW4gYHJvc3J1biBhY3Rpb25saWJfdHV0b3JpYWxzIGZpYm9uYWNjaV9zZXJ2ZXJgIHRvIHN0YXJ0IHRoZSBhY3Rpb24gc2VydmVyXG4gIGNvbnN0IGFjdGlvbiQgPSB4cy5wZXJpb2RpYygzMDAwKS5tYXBUbyh7XG4gICAgdHlwZTogJ2FjdGlvbicsXG4gICAgdmFsdWU6IHtcbiAgICAgIG5hbWU6ICcvZmlib25hY2NpJyxcbiAgICAgIGdvYWxNZXNzYWdlOiB7XG4gICAgICAgIG9yZGVyOiAxXG4gICAgICB9LFxuICAgIH1cbiAgfSk7XG5cbiAgY29uc3QgZmlib25hY2NpQ2xpZW50ID0gc291cmNlcy5ST1NcbiAgICAuZmlsdGVyKHZhbHVlID0+IHZhbHVlLnR5cGUgPT09ICdhY3Rpb24nICYmIHZhbHVlLnZhbHVlLm5hbWUgPT09ICcvZmlib25hY2NpJyk7XG4gIGZpYm9uYWNjaUNsaWVudFxuICAgIC5tYXAodmFsdWUgPT4gdmFsdWUudmFsdWUuZmVlZGJhY2skKS5mbGF0dGVuKCkuYWRkTGlzdGVuZXIoe1xuICAgICAgbmV4dDogZmVlZGJhY2sgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnRmVlZGJhY2s6ICcgKyBmZWVkYmFjay5zZXF1ZW5jZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgZmlib25hY2NpQ2xpZW50XG4gICAgLm1hcCh2YWx1ZSA9PiB2YWx1ZS52YWx1ZS5yZXN1bHQkKS5mbGF0dGVuKCkuYWRkTGlzdGVuZXIoe1xuICAgICAgbmV4dDogcmVzdWx0ID0+IHtcbiAgICAgICAgY29uc29sZS5sb2coJ0ZpbmFsIFJlc3VsdDogJyArIHJlc3VsdC5zZXF1ZW5jZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgY29uc3Qgcm9zJCA9IHhzLm1lcmdlKHRvcGljJCwgc2VydmljZSQsIGFjdGlvbiQpO1xuICByZXR1cm4ge1xuICAgIFJPUzogcm9zJCxcbiAgfTtcbn1cblxucnVuKG1haW4sIHtcbiAgUk9TOiBtYWtlUk9TRHJpdmVyKHtcbiAgICByb3NsaWI6IHt1cmw6ICd3czovL2xvY2FsaG9zdDo5MDkwJ30sXG4gICAgdG9waWNzOiBbe1xuICAgICAgbmFtZTogJy9jbWRfdmVsJyxcbiAgICAgIG1lc3NhZ2VUeXBlOiAnZ2VvbWV0cnlfbXNncy9Ud2lzdCcsXG4gICAgfSwge1xuICAgICAgbmFtZTogJy9saXN0ZW5lcicsXG4gICAgICBtZXNzYWdlVHlwZTogJ3N0ZF9tc2dzL1N0cmluZycsXG4gICAgfV0sXG4gICAgc2VydmljZXM6IFt7XG4gICAgICBuYW1lIDogJy9hZGRfdHdvX2ludHMnLFxuICAgICAgc2VydmljZVR5cGUgOiAncm9zcHlfdHV0b3JpYWxzL0FkZFR3b0ludHMnLFxuICAgIH1dLFxuICAgIGFjdGlvbnM6IFt7XG4gICAgICBzZXJ2ZXJOYW1lIDogJy9maWJvbmFjY2knLFxuICAgICAgYWN0aW9uTmFtZSA6ICdhY3Rpb25saWJfdHV0b3JpYWxzL0ZpYm9uYWNjaUFjdGlvbicsXG4gICAgfV1cbiAgfSksXG59KTtcbiIsImltcG9ydCBST1NMSUIgZnJvbSAncm9zbGliJztcbmltcG9ydCB4cyBmcm9tICd4c3RyZWFtJztcbmltcG9ydCBmcm9tRXZlbnQgZnJvbSAneHN0cmVhbS9leHRyYS9mcm9tRXZlbnQnO1xuXG5leHBvcnQgZnVuY3Rpb24gbWFrZVJPU0RyaXZlcihvcHRpb25zKSB7XG4gIGlmICghb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSB7fTtcbiAgfVxuICBpZiAoIW9wdGlvbnMudG9waWNzKSB7XG4gICAgb3B0aW9ucy50b3BpY3MgPSBbXTtcbiAgfVxuICBpZiAoIW9wdGlvbnMuc2VydmljZXMpIHtcbiAgICBvcHRpb25zLnNlcnZpY2VzID0gW107XG4gIH1cbiAgaWYgKCFvcHRpb25zLmFjdGlvbnMpIHtcbiAgICBvcHRpb25zLmFjdGlvbnMgPSBbXTtcbiAgfVxuXG4gIC8vIEZvciBvcHRpb25zLnJvc2xpYiwgc2VlXG4gIC8vICAgaHR0cHM6Ly9naXRodWIuY29tL1JvYm90V2ViVG9vbHMvcm9zbGlianMvYmxvYi9tYXN0ZXIvc3JjL2NvcmUvUm9zLmpzI0wyNi1MMzBcbiAgY29uc3Qgcm9zID0gbmV3IFJPU0xJQi5Sb3Mob3B0aW9ucy5yb3NsaWIpO1xuICBjb25zdCB0b3BpY3MgPSB7fTtcbiAgb3B0aW9ucy50b3BpY3MubWFwKHRvcGljT3B0aW9ucyA9PiB7XG4gICAgLy8gRm9yIHRvcGljT3B0aW9ucywgc2VlXG4gICAgLy8gICBodHRwczovL2dpdGh1Yi5jb20vUm9ib3RXZWJUb29scy9yb3NsaWJqcy9ibG9iL21hc3Rlci9zcmMvY29yZS9Ub3BpYy5qcyNMMTctTDI2XG4gICAgdG9waWNzW3RvcGljT3B0aW9ucy5uYW1lXSA9IG5ldyBST1NMSUIuVG9waWMoe1xuICAgICAgLi4udG9waWNPcHRpb25zLFxuICAgICAgcm9zLFxuICAgIH0pO1xuICB9KTtcbiAgY29uc3Qgc2VydmljZXMgPSB7fTtcbiAgb3B0aW9ucy5zZXJ2aWNlcy5tYXAoc2VydmljZU9wdGlvbnMgPT4ge1xuICAgIC8vIEZvciB0b3BpY09wdGlvbnMsIHNlZVxuICAgIC8vICAgaHR0cHM6Ly9naXRodWIuY29tL1JvYm90V2ViVG9vbHMvcm9zbGlianMvYmxvYi9tYXN0ZXIvc3JjL2NvcmUvU2VydmljZS5qcyNMMTQtTDE3XG4gICAgc2VydmljZXNbc2VydmljZU9wdGlvbnMubmFtZV0gPSBuZXcgUk9TTElCLlNlcnZpY2Uoe1xuICAgICAgLi4uc2VydmljZU9wdGlvbnMsXG4gICAgICByb3MsXG4gICAgfSk7XG4gIH0pO1xuICBjb25zdCBzZXJ2aWNlQ2xpZW50JCA9IHhzLmNyZWF0ZSgpO1xuICBjb25zdCBhY3Rpb25zID0ge307XG4gIG9wdGlvbnMuYWN0aW9ucy5tYXAoYWN0aW9uT3B0aW9ucyA9PiB7XG4gICAgLy8gRm9yIHRvcGljT3B0aW9ucywgc2VlXG4gICAgLy8gICBodHRwczovL2dpdGh1Yi5jb20vUm9ib3RXZWJUb29scy9yb3NsaWJqcy9ibG9iL21hc3Rlci9zcmMvYWN0aW9ubGliL0FjdGlvbkNsaWVudC5qcyNMMjAtTDI0XG4gICAgYWN0aW9uc1thY3Rpb25PcHRpb25zLnNlcnZlck5hbWVdID0gbmV3IFJPU0xJQi5BY3Rpb25DbGllbnQoe1xuICAgICAgLi4uYWN0aW9uT3B0aW9ucyxcbiAgICAgIHJvcyxcbiAgICB9KTtcbiAgfSk7XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9Sb2JvdFdlYlRvb2xzL3Jvc2xpYmpzL2Jsb2IvbWFzdGVyL3NyYy9hY3Rpb25saWIvQWN0aW9uQ2xpZW50LmpzI0wxNC1MMTdcbiAgY29uc3QgYWN0aW9uQ2xpZW50JCA9IHhzLmNyZWF0ZSgpO1xuXG4gIHJldHVybiBmdW5jdGlvbihvdXRnb2luZyQpIHtcblxuICAgIG91dGdvaW5nJC5hZGRMaXN0ZW5lcih7XG4gICAgICBuZXh0OiBvdXRnb2luZyA9PiB7XG4gICAgICAgIHN3aXRjaCAob3V0Z29pbmcudHlwZSkge1xuICAgICAgICAgIGNhc2UgJ3RvcGljJzpcbiAgICAgICAgICAgIC8vIC8vIEV4YW1wbGUgb3V0Z29pbmcgXCJ0b3BpY1wiIHZhbHVlXG4gICAgICAgICAgICAvLyBvdXRnb2luZyA9IHtcbiAgICAgICAgICAgIC8vICAgdHlwZTogJ3RvcGljJyxcbiAgICAgICAgICAgIC8vICAgdmFsdWU6IHtcbiAgICAgICAgICAgIC8vICAgICBuYW1lOiAnL2NtZF92ZWwnLFxuICAgICAgICAgICAgLy8gICAgIG1lc3NhZ2U6IHtcbiAgICAgICAgICAgIC8vICAgICAgIGxpbmVhciA6IHtcbiAgICAgICAgICAgIC8vICAgICAgICAgeCA6IDAuMSxcbiAgICAgICAgICAgIC8vICAgICAgICAgeSA6IDAuMixcbiAgICAgICAgICAgIC8vICAgICAgICAgeiA6IDAuMyxcbiAgICAgICAgICAgIC8vICAgICAgIH0sXG4gICAgICAgICAgICAvLyAgICAgICBhbmd1bGFyIDoge1xuICAgICAgICAgICAgLy8gICAgICAgICB4IDogLTAuMSxcbiAgICAgICAgICAgIC8vICAgICAgICAgeSA6IC0wLjIsXG4gICAgICAgICAgICAvLyAgICAgICAgIHogOiAtMC4zLFxuICAgICAgICAgICAgLy8gICAgICAgfSxcbiAgICAgICAgICAgIC8vICAgICB9LFxuICAgICAgICAgICAgLy8gICB9LFxuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgdG9waWNzW291dGdvaW5nLnZhbHVlLm5hbWVdLnB1Ymxpc2gob3V0Z29pbmcudmFsdWUubWVzc2FnZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdzZXJ2aWNlJzpcbiAgICAgICAgICAgIC8vIC8vIEV4YW1wbGUgb3V0Z29pbmcgXCJzZXJ2aWNlXCIgdmFsdWVcbiAgICAgICAgICAgIC8vIGluY29taW5nID0ge1xuICAgICAgICAgICAgLy8gICB0eXBlOiAnc2VydmljZScsXG4gICAgICAgICAgICAvLyAgIHZhbHVlOiB7XG4gICAgICAgICAgICAvLyAgICAgbmFtZTogJy9hZGRfdHdvX2ludHMnLFxuICAgICAgICAgICAgLy8gICAgIHJlcXVlc3Q6IHtcbiAgICAgICAgICAgIC8vICAgICAgIGE6IDEsXG4gICAgICAgICAgICAvLyAgICAgICBiOiAyLFxuICAgICAgICAgICAgLy8gICAgIH0sXG4gICAgICAgICAgICAvLyAgIH0sXG4gICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICBzZXJ2aWNlQ2xpZW50JC5zaGFtZWZ1bGx5U2VuZE5leHQoe1xuICAgICAgICAgICAgICBuYW1lOiBvdXRnb2luZy52YWx1ZS5uYW1lLFxuICAgICAgICAgICAgICByZXNwb25zZSQ6IHhzLmNyZWF0ZSh7XG4gICAgICAgICAgICAgICAgc3RhcnQ6IGxpc3RlbmVyID0+IHtcbiAgICAgICAgICAgICAgICAgIHNlcnZpY2VzW291dGdvaW5nLnZhbHVlLm5hbWVdLmNhbGxTZXJ2aWNlKFxuICAgICAgICAgICAgICAgICAgICBuZXcgUk9TTElCLlNlcnZpY2VSZXF1ZXN0KG91dGdvaW5nLnZhbHVlLnJlcXVlc3QpLFxuICAgICAgICAgICAgICAgICAgICAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lci5uZXh0KHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lci5jb21wbGV0ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lci5lcnJvci5iaW5kKGxpc3RlbmVyKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBzdG9wOiAoKSA9PiB7fSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICB9KTsgXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdhY3Rpb24nOlxuICAgICAgICAgICAgLy8gLy8gRXhhbXBsZSBvdXRnb2luZyBcImFjdGlvblwiIHZhbHVlXG4gICAgICAgICAgICAvLyBpbmNvbWluZyA9IHtcbiAgICAgICAgICAgIC8vICAgdHlwZTogJ2FjdGlvbicsXG4gICAgICAgICAgICAvLyAgIHZhbHVlOiB7XG4gICAgICAgICAgICAvLyAgICAgbmFtZTogJy9maWJvbmFjY2knLFxuICAgICAgICAgICAgLy8gICAgIGdvYWxNZXNzYWdlOiB7XG4gICAgICAgICAgICAvLyAgICAgICBvcmRlcjogNyxcbiAgICAgICAgICAgIC8vICAgICB9LFxuICAgICAgICAgICAgLy8gICB9LFxuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgY29uc3QgZ29hbCA9IG5ldyBST1NMSUIuR29hbCh7XG4gICAgICAgICAgICAgIGFjdGlvbkNsaWVudCA6IGFjdGlvbnNbb3V0Z29pbmcudmFsdWUubmFtZV0sXG4gICAgICAgICAgICAgIGdvYWxNZXNzYWdlIDogb3V0Z29pbmcudmFsdWUuZ29hbE1lc3NhZ2UsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGFjdGlvbkNsaWVudCQuc2hhbWVmdWxseVNlbmROZXh0KHtcbiAgICAgICAgICAgICAgbmFtZTogb3V0Z29pbmcudmFsdWUubmFtZSxcbiAgICAgICAgICAgICAgdGltZW91dCQ6IGZyb21FdmVudChnb2FsLCAndGltZW91dCcpLFxuICAgICAgICAgICAgICBzdGF0dXMkOiBmcm9tRXZlbnQoZ29hbCwgJ3N0YXR1cycpLFxuICAgICAgICAgICAgICBmZWVkYmFjayQ6IGZyb21FdmVudChnb2FsLCAnZmVlZGJhY2snKSxcbiAgICAgICAgICAgICAgcmVzdWx0JDogZnJvbUV2ZW50KGdvYWwsICdyZXN1bHQnKSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZ29hbC5zZW5kKCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgY29uc29sZS53YXJuKCdVbmtub3duIG91dGdvaW5nLnR5cGUnLCBvdXRnb2luZy50eXBlKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGVycm9yOiAoKSA9PiB7fSxcbiAgICAgIGNvbXBsZXRlOiAoKSA9PiB7fSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGluY29taW5nJCA9IHhzLmNyZWF0ZSh7XG4gICAgICBzdGFydDogbGlzdGVuZXIgPT4ge1xuICAgICAgICBPYmplY3Qua2V5cyh0b3BpY3MpLm1hcCh0b3BpYyA9PiB7XG4gICAgICAgICAgdG9waWNzW3RvcGljXS5zdWJzY3JpYmUoZnVuY3Rpb24obWVzc2FnZSkge1xuICAgICAgICAgICAgLy8gLy8gRXhhbXBsZSBpbmNvbWluZyBcInRvcGljXCIgdmFsdWVcbiAgICAgICAgICAgIC8vIGluY29taW5nID0ge1xuICAgICAgICAgICAgLy8gICB0eXBlOiAndG9waWMnLFxuICAgICAgICAgICAgLy8gICB2YWx1ZToge1xuICAgICAgICAgICAgLy8gICAgIG5hbWU6ICcvY21kX3ZlbCcsXG4gICAgICAgICAgICAvLyAgICAgbWVzc2FnZToge1xuICAgICAgICAgICAgLy8gICAgICAgbGluZWFyIDoge1xuICAgICAgICAgICAgLy8gICAgICAgICB4IDogMC4xLFxuICAgICAgICAgICAgLy8gICAgICAgICB5IDogMC4yLFxuICAgICAgICAgICAgLy8gICAgICAgICB6IDogMC4zLFxuICAgICAgICAgICAgLy8gICAgICAgfSxcbiAgICAgICAgICAgIC8vICAgICAgIGFuZ3VsYXIgOiB7XG4gICAgICAgICAgICAvLyAgICAgICAgIHggOiAtMC4xLFxuICAgICAgICAgICAgLy8gICAgICAgICB5IDogLTAuMixcbiAgICAgICAgICAgIC8vICAgICAgICAgeiA6IC0wLjMsXG4gICAgICAgICAgICAvLyAgICAgICB9LFxuICAgICAgICAgICAgLy8gICAgIH0sXG4gICAgICAgICAgICAvLyAgIH0sXG4gICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICBsaXN0ZW5lci5uZXh0KHt0eXBlOiAndG9waWMnLCB2YWx1ZToge25hbWU6IHRvcGljLCBtZXNzYWdlfX0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBzZXJ2aWNlQ2xpZW50JC5hZGRMaXN0ZW5lcih7XG4gICAgICAgICAgbmV4dDogc2VydmljZUNsaWVudCA9PiB7XG4gICAgICAgICAgICAvLyAvLyBFeGFtcGxlIGluY29taW5nIFwic2VydmljZVwiIHZhbHVlXG4gICAgICAgICAgICAvLyBpbmNvbWluZyA9IHtcbiAgICAgICAgICAgIC8vICAgdHlwZTogJ3NlcnZpY2UnLFxuICAgICAgICAgICAgLy8gICB2YWx1ZToge1xuICAgICAgICAgICAgLy8gICAgIG5hbWU6ICcvYWRkX3R3b19pbnRzJyxcbiAgICAgICAgICAgIC8vICAgICByZXNwb25zZSQ6IC8vIGFuIHhzdHJlYW0gdGhhdCBlbWl0cyBhIHJlc3BvbnNlIG9iamVjdFxuICAgICAgICAgICAgLy8gICB9LFxuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgbGlzdGVuZXIubmV4dCh7dHlwZTogJ3NlcnZpY2UnLCB2YWx1ZTogc2VydmljZUNsaWVudH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgYWN0aW9uQ2xpZW50JC5hZGRMaXN0ZW5lcih7XG4gICAgICAgICAgbmV4dDogYWN0aW9uQ2xpZW50ID0+IHtcbiAgICAgICAgICAgIC8vIC8vIEV4YW1wbGUgaW5jb21pbmcgXCJhY3Rpb25cIiB2YWx1ZVxuICAgICAgICAgICAgLy8gaW5jb21pbmcgPSB7XG4gICAgICAgICAgICAvLyAgIHR5cGU6ICdhY3Rpb24nLFxuICAgICAgICAgICAgLy8gICB2YWx1ZToge1xuICAgICAgICAgICAgLy8gICAgIG5hbWU6ICcvZmlib25hY2NpJyxcbiAgICAgICAgICAgIC8vICAgICByZXNwb25zZSQ6IC8vIGFuIHhzdHJlYW0gdGhhdCBlbWl0cyB0aW1lb3V0XG4gICAgICAgICAgICAvLyAgICAgc3RhdHVzJDogLy8gYW4geHN0cmVhbSB0aGF0IGVtaXRzIHN0YXR1c1xuICAgICAgICAgICAgLy8gICAgIGZlZWRiYWNrJDogLy8gYW4geHN0cmVhbSB0aGF0IGVtaXRzIGZlZWRiYWNrXG4gICAgICAgICAgICAvLyAgICAgcmVzdWx0JDogLy8gYW4geHN0cmVhbSB0aGF0IGVtaXRzIHJlc3VsdHNcbiAgICAgICAgICAgIC8vICAgfSxcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgIGxpc3RlbmVyLm5leHQoe3R5cGU6ICdhY3Rpb24nLCB2YWx1ZTogYWN0aW9uQ2xpZW50fSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICB9LFxuICAgICAgc3RvcDogKCkgPT4ge1xuICAgICAgICBPYmplY3Qua2V5cyh0b3BpY3MpLm1hcCh0b3BpYyA9PiB7XG4gICAgICAgICAgdG9waWNzW3RvcGljXS51bnN1YnNjcmliZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIFxuICAgIHJldHVybiBpbmNvbWluZyQ7XG4gIH1cbn0iXX0=
