Historically, we write client and server-side javascript separately, and have an elaborate build system to package client side javascript into assets.

The **browser bridge** lets you achieve the same ends more directly. You define functions in Node that you want to be on the client:

```javascript
var BrowserBridge = require("browser-bridge")
var element = require("web-element")
var app = require("express")()

var bridge = new BrowserBridge()

var greet = bridge.defineFunction(
  function greet(name) {
    alert("hi, "+name)
  }
)

var button = element("button", "Hi there", {
  onclick: greet.withArgs("Tam").evalable()
})

bridge.asap(
  function() {
    console.log("Everything is awesome")
  }
)

app.get("/", bridge.requestHandler(button))

app.start(2090)
```

bridge.requestHandler returns a handler that will send a page with all of those functions glued up, something like:

```html
<!DOCTYPE html>
<html>
  <body>

    <button onclick='greet("Tam")'>Hi there</button>

    <script>
      function greet(name) {
        alert("hi, "+name)
      }

      (function () {
        console.log("Everything is awesome")
      }).call()
    </script>
  </body>
</html>
```

See [demo.js](demo.js).

You can also pass data between functions on the client by passing references on the server:

```javascript
var endearment = bridge.defineFunction(
  [greet],
  function(greet, name) {
    var termOfEnearment = name+"ino"
    greet(termOfEndearment)
  }
)

var friendlyButton = element("button", "Hi there?", {
  onclick: endearment.withArgs("Tam").evalable()
})
```

And now the greeting is a touch friendlier.


## Why

* you only send down the javascript that you actually need on a specific page, for faster first visit load times

* no extra asset build step

* client and server code that is tightly coupled can live side by side.

* data is pre-bound on the server, no client boot process needed

* the entire process of building a page is accessible in a single thread, accessible in the debugger

* onclick handlers can be seen in DOM attributes, inspected and understood

## Documentation

* [Javascript events](#javascript-events)
* [Persisting data across calls](#persisting-data-across-calls)
* [Re-using a bridge](#re-using-a-bridge)
* [Page lifecycle](#page-lifecycle)
* [Generating new evalable strings from the browser](#generating-new-evalable-strings-from-the-browser)
* [Loading more bridge-aware content after page load](#loading-more-bridge-aware-content-after-page-load)
* [Recursive functions](#recursive-functions)
* [Using `bind` with bridge functions](#using-bind-with-bridge-functions)
* [Using modules as dependencies](#using-modules-as-dependencies)
* [Road to 1.0](#road-to-)

## Javascript events

```javascript
var plot = bridge.defineFunction(
  function(event) {
    console.log("Mouse is at", event.offsetX+", "+event.offsetY)
  }
)

body.addAttributes({
  onclick: plot.withArgs(bridge.event).evalable()
})
```

## Persisting data across calls

It's common to want to track data across multiple calls to bridge functions. For this you can define a singleton:

```javascript
var counters = bridge.defineSingleton("counters", function() {
  return {call: 0}
})

var increment = bridge.defineFunction(
  [counters],
  function(counters) {
    counters.call++
    console.log("Called "+counters.call+" times")
  }
)
```

## Re-using a bridge

If you want to get a page mostly assembled and then add different details, you can copy a bridge:

```javascript
var app = require("express")()

var baseBridge = new BrowserBridge()

baseBridge.addToHead("<style>body { font-family: sans-serif; }</style>")

var hello = baseBridge.copy()
hello.asap(function() {
  alert("hi!")
})
app.get("/", hello.requestHandler())

var goodbye = baseBridge.copy()
goodbye.asap(function() {
  alert("bye!")
})
app.get("/logout", goodbye.requestHandler())
```

Although if the only difference is the page content, you can just re-use the original bridge:

```javascript
var bridge = new BrowserBridge()

bridge.defineFunction(...)

app.get("/item/:name", function(request, response) {
  var name = request.params.name
  var handler = bridge.requestHandler("<body>Hello, "+name+"</body>")
  handler(request, response)
})
```

If need to copy a bridge for each request, you can use bridge.forResponse. That will give you a copied bridge that is pre-bound to a response, so you can just call bridge.send() without worrying about the response object. That allows you to pass the bridge on to a renderer while keeping all of the code that deals with the response object in the route handler:

```javascript
var baseBridge = new BrowserBridge()

baseBridge.addToHead(...)

app.get("/item/:id", function(request, response) {
  var bridge = baseBridge.forResponse(response)
  var item = findItem(request.params.id)
  renderItem(item, bridge)
})

function renderItem(item, bridge) {
  bridge.defineFunction(function saveItem() {
    ...
  })
  var el = element(".item", item.name)
  bridge.send(el)
}
```

It's just good separation of concerns to keep all of the HTTP-related stuff in the route so the renderer can just focus on the domain object and the browser.

## Page lifecycle

```javascript
bridge.asap(function() {
  // runs before page elements are available
})

bridge.domReady(function() {
  document.querySelector(".whatever")
  // work with page elements here
})
```

## Generating new evalable strings from the browser

Sometimes you may want to add new elements on the browser. If those have events that need to call your bridge functions, you can pass a function or singleton declaration down to the browser in its raw [function-call](https://github.com/erikpukinskis/function-call) form, rather than as an actual reference to the client function:

```javascript
var addPerson = bridge.defineFunction(
  [greet.asCall()],
  function(greetBinding, name) {
    var button = "<button onclick=\""+greet.withArgs(name).evalable()+"\">Greet "+name+"</button>"
    document.write(button)
  }
)
```

## Loading more bridge-aware content after page load

If you want to add additional content after the page has already loaded, you can copy a base bridge, and send it as a partial:

```javascript
var baseBridge = new BrowserBridge()
var site = new WebSite()

// ... build up base bridge here

var loadMore = baseBridge.defineFunction([
  baseBridge.loadPartial.asCall()],
  function(loadPartial) {
    loadPartial(
      "/more",
      ".target")})

var button = element("button", {onclick: loadMore.evalable()}, "More")

site.addRoute("get", "/",
  baseBridge.requestHandler([
    button,
    ".target"]))

site.addRoute("get", "/more",
  function(request, response) {
    var partial = baseBridge.copy().forResponse(response)

    var more = element(
      "new content")

    partial.asap(
      function() {
        console.log(
          "more code running in the browser")})

    partial.sendPartial(
      more)})
```

The `requestPartial` function will make an AJAX request to `/more`, which forks the bridge and sends the fork as a partial.

This means scripts and content added to the fork can reference functions that are already in the browser because they're on the base bridge, so the partial doesn't have to send the functions again.

And, the partial can add any new functions it likes.


## Recursive functions

You may want to call a function from itself:

```javascript
var sort = bridge.defineFunction(
  function sort(array) {
    var biggest = 0
    for(var i=0; i<array.length; i++) {
      if (array[i] < array[biggest]) {
        return array.prototype.slice(0, biggest).concat(
          HOW_DO_WE_REFERENCE_SORT_HERE(array.slice(biggest))
      } else {
        biggest = i
      }
    }
    return array
  })
```

But since the browser bridge requires you to have a reference to every function you intend to use in the function, and the `sort` variable only exists on the server, there's no way to reference it on the client.

The solution is to use a singleton to generate the function:

```javascript
var sort = bridge.defineSingeton(
  function() {
    function sort(array) {
      var biggest = 0
      for(var i=0; i<array.length; i++) {
        if (array[i] < array[biggest]) {
          return array.prototype.slice(0, biggest).concat(
          sort(array.slice(biggest))
        } else {
          biggest = i
        }
      }
      return array
    }
    return sort
  })
```

## Using `bind` with bridge functions

The same solution is useful if you want to be able to bind bridge functions with dependencies in your code. If you wanted to do something like this:

```javascript
var showError = bridge.defineFunction([
  bridgeModule(lib, "add-html", bridge),
  bridgeModule(lib, "web-element", bridge),
  function showError(addHtml, element, message) {
    addHtml(
      element(".error",
        element(".inner", 
          "There was an error: "+message)))
  })

bridge.asap([
  showError],
  function(showError) {
    setTimeout(
      showError.bind(null, "Crash won best picture in 2004"),
      1000)
  })
```

You'll get an error, since `showError` was pre-bound to add-html and web-element, when you call `showError.bind`, `addHtml` will now refer to your message.

The way to fix this is to define it as a singleton instead of a function:

```javascript
var showError = bridge.defineSingleton([
  bridgeModule(lib, "add-html", bridge),
  bridgeModule(lib, "web-element", bridge),
  function (addHtml, element) {

    function showError(error) {
      addHtml(
        element(".error",
          element(".inner", 
            "There was an error: "+message)))}

    return showError
  })
```
## Using modules as dependencies

If you are using [module-library](https://github.com/erikpukinskis/module-library), then you can use [bridge-module](https://github.com/erikpukinskis/bridge-module) to add use modules as dependencies in bridge functions:

```js
var setName = bridge.defineFunction([
  bridgeModule(lib, "add-html", bridge)],
  function(addHtml, name) {
    addHtml.inside(
      "#account-menu .name",
      name)})
```

However, how this will be done in the future is a bit unsettled...

As of January 2021, you can also access this behavior more directly by passing a [module-library](https://www.npmjs.com/package/module-library) reference as a dependency:

```js
var setName = bridge.defineFunction([
  lib.module("add-html"),
  function(addHtml, name) {
    ...
```

This may or may not make it to 1.0 since it makes browser-bridge dependent on [bridge-module](https://github.com/erikpukinskis/bridge-module). And dependencies like that are a code smell.

The reasons we would keep this feature, are A) it makes adding bridge modules way simpler, and B) it makes it possible for modules to export code that controls how that same is used on a bridge. The hope is that this may make it easier to transition a module between the "defines some bridge functions"-style setup (which doesn't require any dependencies) to the "provides a module that you can use on the client"-style setup (without adding any depedencies). Because you can mix and match those styles in the same module.

As a simple example, this module exports an `defineOn` function that creates a singleton that's idempotent on a per-bridge-basis:

```js
// New method for bridge safe modules:
var library = require("module-library")(require)

library.define(
  "stuff",[
  library.ref()],
  function(lib) {
    function Stuff(){}

    Stuff.prototype.set = function(text) {
      this.text = text}

    Stuff.prototype.defineOn = function(bridge) {
      var binding = bridge.remember("stuff singleton")
      if (binding) return binding
      binding = bridge.defineSingleton([
        lib.module("stuff")],
        function(Stuff) {
          return new Stuff()})
      bridge.see("stuff singleton", binding)
      return binding}

    return Stuff})

library.using([
  "browser-bridge",
  "stuff"],
  function(BrowserBridge, Stuff),
    var bridge = new BrowserBridge()
    var stuff = new Stuff()

    bridge.asap([
      stuff.defineOn(bridge)],
      function(stuff) {
        stuff.set(
          "blerbl")}))
```

Without this special `lib.module` support in browser-bridge, you'd have to have a `stuff` module with no dependencies and a separate `put-stuff-on-bridge` module that set up the singleton and had the bridge-module dependency.

That's not necessarily the end of the world... using [module-library](https://github.com/erikpukinskis/module-library), it's not hard to define a module-with-a-module that is bridge safe:

```js
// Original method for bridge-safe modules:
library.define(
  "stuff/bridge-safe",
  function() {
    function Stuff(){}

    Stuff.prototype.set = ...

    return Stuff
  })

module.exports = library.export(
  "stuff",[
  library.ref(),
  "bridge-module",
  "stuff/bridge-safe"],
  function(bridgeModule, Stuff) {

    Stuff.defineOn = function(bridge) {
      var binding = bridge.remember("stuff singleton")
      if (binding) return binding

      binding = bridge.defineSingleton([
        bridgeModule(
          lib,
          "stuff/bridge-safe",
          bridge)],
        function(Stuff) {
          return new Stuff()})

      bridge.see("stuff singleton", binding)

      return binding
    }

    return Stuff
  })
```

So, that's possible. It's just more code, and there are different names for the modules that you'd import on node and the one you'd see on the bridge. And "your-package" has to have a dependency on bridge-module, whether or not the consumer needs it.

With the new method, of exposing `lib.module("some path")`, "your-package" can just have on dependency on [module-library](https://github.com/erikpukinskis/module-library), and [bridge-module](https://github.com/erikpukinskis/bridge-module) won't be pulled in unless the _consumer_ of "your-package" creates a [browser-bridge](https://github.com/erikpukinskis/browser-bridge).

The major sacrifice of this new approach, is that browser-bridge depends on bridge-module. But it is essentially "taking one for the team," allowing every other module to be free of that dependency.

The jury is out about whether that's a good move or a bad move. But it will have to be decided before 1.0.

## Road to 1.0

The basic API of browser-bridge is frozen, but there are a few things that need to be finalized before we can do a 1.0 release:

* PartialBridge instances share the same API as BrowserBridge instances, and they're mostly identical except they passthrough MOST functions to the parent bridge. The class maybe should be generated from a schema, or just folded into the BrowserBridge methods, enabled by a flag. Or maybe it's fine as it is, it's just a bunch of simple passthrough functions which are self explanatory, and it's probably worth thinking through partial bridges every time I add new bridge API.

* Client bridge needs to get working again, and some cruft removed... prependBridgeData is deprecated but that doesn't exactly make sense. (Though it is intriguing I've gotten this far without fixing it. Says something about the importance of bridges being able to exist on the client. I guess it's easy enough to put a module on the client and bind data into it that you don't really need a bridge abstraction. I guess the time when we'd really need it is if we are loading whole new sites in the browser and we want to boot a new component that adds things to the bridge. But even in that case... why not just load a new HTML page from the server, and iframe it or even just append it as a partial.)

* Possibly withChildren and rawSource can be private?

* One header in the documentation for each frozen API

* Need to resolve the question of whether the native bridge-module support is the right separation (inclusion?) of concerns.

