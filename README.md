Historically, we write client and server-side javascript separately, and have an elaborate build system to package client side javascript into assets.

The browser bridge lets you achieve the same ends more directly. You define functions in Node that you want to be on the client:

```javascript
var BrowserBridge = require("nrtv-browser-bridge")
var server = require("nrtv-server")
var element = require("nrtv-element")

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

server.addRoute(
  "get",
  "/",
  bridge.sendPage(button)
)

server.start(2090)
```

That bridge.sendPage(button) call returns a handler that will send a page with all of those functions glued up:

```html
<!DOCTYPE html>
<html>    
  <head>
    <script>
      function greet(name) {
        alert("hi, "+name)
      }
            
      // Stuff to run on page load:
      
      function () {
        console.log("Everything is awesome.")
      }
      </script>
  </head>

  <body>
      <button onclick="greet(&quot;Tam&quot;)">Hi there</button>
  </body>

</html>
```

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

* client and server code that is tightly coupled can live side by side
