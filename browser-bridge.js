var library = require("nrtv-library")(require)

module.exports = library.export(
  "nrtv-browser-bridge",
  [library.collective({}), "nrtv-element", "html", "nrtv-function-call"],
  function(collective, element, html, functionCall) {

    function BrowserBridge(instance) {
      this.instance = instance
      this.id = Math.random().toString(36).substr(2,4)
      this.bindings = {}
      this.identifiers = {}
      this.asapSource = ""
      this.__isNrtvBrowserBridge = true
    }

    BrowserBridge.isBridge = function(thing) {
      return !!thing.__isNrtvBrowserBridge
    }

    BrowserBridge.collective =
    BrowserBridge.prototype.collective =
      function(attributes) {
        return {
          __dependencyType: "browser collective",
          attributes: attributes
        }
      }

    // Rename sendPageHandler? #todo

    BrowserBridge.prototype.sendPage =
      function(body) {
        var html = this.getPage(body)

        return function(x, response) {
          response.send(html)
        }
      }

    BrowserBridge.prototype.getPage =
      function(body) {

        var bindings = element(
          "script",
          this.script()
        )

        var styles = element("style", " .hidden { display: none }")

        if (!body || body.tagName != "body") {
          body = element("body", body || "")
        }

        var el = element("html", [
          body,
          element("head", [
            bindings,
            styles
          ])
        ])

        var source = "<!DOCTYPE html>\n" + el.html()

        return html.prettyPrint(source)
      }

    BrowserBridge.prototype.script =
      function() {
        var lines = []
        for (identifier in this.bindings) {
          var source = this.bindings[identifier].source()

          lines.push("      "+source)
        }

        var source = "\n"
          + lines.join("\n\n")
          + "\n"

        source += "\n\n// Stuff to run on page load:\n\n"

        source += this.asapSource

        return source
      }

    BrowserBridge.prototype.asap =
      function(binding) {

        var source = binding.evalable ? binding.evalable(): binding

        this.asapSource += source + "\n\n"
      }

    BrowserBridge.prototype.defineSingleton =
      function() {
        var boundFunc = this.defineFunction.apply(this, arguments)

        boundFunc.isGenerator = true

        return boundFunc
      }

    // The dependencies and the withArgs are a little redundant here. #todo Remove dependencies.

    BrowserBridge.prototype.defineFunction =
      function() {
        for (var i=0; i<arguments.length; i++) {

          if (typeof arguments[i] == "string") {
            var name = arguments[i]
          } else if (typeof arguments[i] == "function") {
            var func = arguments[i]
          } else if (Array.isArray(arguments[i])) {
            var dependencies = arguments[i]
          }
        }

        if (!func) {
          throw new Error("You need to pass a function to bridge.defineFunction, but you passed "+JSON.stringify(arguments)+".")
        }

        preventUndefinedDeps(dependencies, func)

        var identifier = original = name || func.name || "f"

        while(identifier in this.identifiers) {

          identifier = original+"_"+Math.random().toString(36).split(".")[1].substr(0,4)
        }

        this.identifiers[identifier] = true

        var binding = functionCall(func, identifier, dependencies)

        this.bindings[identifier] = binding

        return binding
      }

    function preventUndefinedDeps(dependencies, func) {

      if (!dependencies) { return }

      for(var i=0; i<dependencies.length; i++) {

        if (typeof dependencies[i] == "undefined") {

          var description = (func.name || func.toString().substr(0,60)+"...").replace(/(\n| )+/g, " ")

          throw new Error("The "+i+"th dependency you passed for "+description+" was undefined. We're currently prohibiting that because it seems sketchy.")
        }
      }

    }

    BrowserBridge.prototype.handle =
      function() {
        return this.defineFunction(handleBindingResponse)
      }

    function handleBindingResponse(binding) {
      if (typeof binding == "string") {
        binding = JSON.parse(binding)
      }

      eval(binding.evalable)
    }

    library.collectivize(
      BrowserBridge,
      collective,
      function() {
        return new BrowserBridge()
      },
      ["sendPage", "asap", "defineFunction", "defineSingleton", "handle"]      
    )

    return BrowserBridge
  }
)