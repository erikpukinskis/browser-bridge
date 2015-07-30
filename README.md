Historically, we write client and server-side javascript separately, and have an elaborate build system to package client side javascript into assets.

The browser bridge lets you achieve the same ends more directly. You just define functions in Node that you want to be on the client:

```javascript
var BrowserBridge = require("nrtv-browser-bridge")

var bridge = new BrowserBridge()

var plusOne = bridge.defineOnClient(
  function(plusOne) {
    return number+" plus one"
  }
)
```

If you then call bridge.getPage() you'll get a page with that function available:

```html
<html>

<head>
    <script src="https://code.jquery.com/jquery-2.1.4.min.js"></script>
    <script>
        var funcs = {
    '7ac697f71ce0d89b02abaa34025c87d9c2d54ae6': function (plusOne) {
            return number+" plus one"
          }
    }
          var bridge = {
            handle: function(binding) {
              funcs[binding.key].apply(bridge, binding.args)
            }
          }
    </script>
    <style>
        .hidden { display: none }
    </style>
</head>
<div></div>

</html>
```

Then when you want to render, say, a button that calls that function, you can bind an argument on the server and get an evalable piece of javascript.

```javascript
plusOne.withArgs("ten").evalable()
```

will return:

```javascript
funcs["7ac697f71ce0d89b02abaa34025c87d9c2d54ae6"].apply(bridge,["ten"])
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

##Why

* you only send down the javascript that you actually need on a specific page, for faster first visit load times

* no extra asset build step

* client and server code that is tightly coupled can live side by side
