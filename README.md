Historically, we write client and server-side javascript separately, and have an elaborate build system to package client side javascript into assets.

The browser bridge lets you achieve the same ends more directly. You define functions in Node that you want to be on the client:

```javascript
var BrowserBridge = require("browser-bridge")
var site = require("web-site")
var element = require("web-element")

var bridge = new BrowserBridge()

var greet = bridge.defineFunction(
  function greet(name) {
    alert("hi, "+name)
  }
)

var button = element(
  "button",
  "Hi there", 
  {onclick: greet.withArgs("Tam").evalable()}
)

bridge.asap(function() {
  console.log("Everything is awesome")
})

site.addRoute(
  "get",
  "/",
  bridge.sendPage(button)
)

site.start(2090)
```

That bridge.sendPage(button) call returns a handler that will send a page with all of those functions glued up, something like:

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
var maybeGreet = bridge.defineFunction(
  [greet],
  function(greet) {
    if (Math.random() < 0.5) {
      greet()
    }
  }
)
```

You can then pass maybeGreet.evalable() down to the browser, and the button will be broken half the time. :)

## Why

* you only send down the javascript that you actually need on a specific page, for faster first visit load times

* no extra asset build step

* client and server code that is tightly coupled can live side by side.

* data is pre-bound on the server, no client boot process needed

* the entire process of building a page is accessible in a single thread, accessible in the debugger

* onclick handlers can be seen in DOM attributes, inspected and understood

See also: [bridge-module](https://github.com/erikpukinskis/bridge-module) lets you define modules with dependencies that can be used just like these bridge functions.
