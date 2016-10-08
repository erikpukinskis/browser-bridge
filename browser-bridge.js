var library = require("nrtv-library")(require)

module.exports = library.export(
  "browser-bridge",
  [library.collective({}), "web-element", "html", "function-call"],
  function(collective, element, html, functionCall) {

    function BrowserBridge(instance) {
      this.instance = instance
      this.id = Math.random().toString(36).substr(2,4)
      this.bindings = {}
      this.identifiers = {}
      this.asapSource = ""
      this.head = ""
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
      function(content) {
        var html = this.getPage(content)

        return function(x, response) {
          response.send(html)
        }
      }

    BrowserBridge.prototype.addToHead =
      function(html) {
        this.head = this.head+html
      }

    BrowserBridge.prototype.getPage =
      function(content) {

        var bindings = element(
          "script",
          this.script()
        )

        
        var hidden = element.style(
          ".hidden", {
            "display": "none"
          })

        var headSource = '<meta name="viewport" content="width=device-width, initial-scale=1">\n'+element.stylesheet(hidden).html() + this.head

        var head = element("head", 
          element.raw(headSource)
        )


        var needsBody = content && typeof(content) != "string" && !hasBody(content, 2)

        if (!content) {
          content = element("body")
        } else if (needsBody) {
          content = element("body", content)
        }

        if (Array.isArray(content)) {
          content.push(bindings)
        } else {
          content.addChild(bindings)
        }

        var page = element("html", [head, content])

        var source = "<!DOCTYPE html>\n" + page.html()

        return html.prettyPrint(source)
      }

    function hasBody(content, depth) {
      if (depth < 1) { return false }

      if (content.tagName == "body") {
        return true
      }

      var children = content.children || content

      if (!Array.isArray(children)) {
        return false
      }

      for(var i=0; i<children.length; i++) {

        if (hasBody(children[i], depth-1)) {
          return true
        }
      }

      return false
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

        var binding = buildBinding(arguments, this.identifiers)

        binding.isGenerator = true

        this.asap(binding.source())

        return binding
      }

    BrowserBridge.prototype.defineFunction =
      function() {
        var binding = buildBinding(arguments, this.identifiers)

        var identifier = binding.binding.identifier

        this.bindings[identifier] = binding

        return binding
      }

    function buildBinding(args, identifiers) {
      for (var i=0; i<args.length; i++) {

        if (typeof args[i] == "string") {
          var name = args[i]
        } else if (typeof args[i] == "function") {
          var func = args[i]
        } else if (Array.isArray(args[i])) {

          // The dependencies and the withArgs are a little redundant here. #todo Remove dependencies.

          var dependencies = args[i]
        }
      }

      if (!func) {
        throw new Error("You need to pass a function to bridge.defineFunction, but you passed "+JSON.stringify(args)+".")
      }

      preventUndefinedDeps(dependencies, func)

      var identifier = original = name || func.name || "f"

      while(identifier in identifiers) {

        identifier = original+"_"+Math.random().toString(36).split(".")[1].substr(0,4)
      }

      identifiers[identifier] = true

      var binding = functionCall(func, identifier, dependencies)

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