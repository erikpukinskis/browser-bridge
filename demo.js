var BrowserBridge = require("./")
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
  bridge.requestHandler(button)
)

site.start(2090)