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
var maybeGreet = bridge.defineFunction(
  [greet],
  function(greet) {
    if (Math.random() < 0.5) { greet() }
  }
)

var flakyButton = element("button", "Hi there?", {
  onclick: maybeGreet.withArgs("Tam?").evalable()
})
```

And now you have a button that's randomly broken half the time. :)

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

bridge.domready(function() {
  document.querySelector(".whatever")
  // work with page elements here
})
```

## Why

* you only send down the javascript that you actually need on a specific page, for faster first visit load times

* no extra asset build step

* client and server code that is tightly coupled can live side by side.

* data is pre-bound on the server, no client boot process needed

* the entire process of building a page is accessible in a single thread, accessible in the debugger

* onclick handlers can be seen in DOM attributes, inspected and understood

See also: [bridge-module](https://github.com/erikpukinskis/bridge-module) lets you define modules with dependencies that can be used just like these bridge functions.
