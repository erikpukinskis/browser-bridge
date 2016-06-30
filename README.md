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

If you then call bridge.getPage() you'll get a page with that function available:

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

Then when you want to render, say, a button that calls that function, you can bind an argument on the server and get an evalable piece of javascript.

```javascript
plusOne.withArgs("ten").evalable()
```

will return:

```javascript
tackOneOn_408d("ten")
```

If you put that code in a click handler, it will return "ten plus one".

You can also pass data between functions on the client by passing references on the server:

```javascript
var refund = bridge.defineOnClient(
  [plusOne],
  function(plusOne) {
    alert(plusOne("minus one"))
  }
)
```

You can then pass refund.evalable() down to the browser, and it will pop up a "minus one plus one" alert.

## Why

* you only send down the javascript that you actually need on a specific page, for faster first visit load times

* no extra asset build step

* client and server code that is tightly coupled can live side by side
