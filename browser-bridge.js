var library = require("nrtv-library")(require)

module.exports = library.export(
  "browser-bridge",
  [library.collective({}), "web-element", "html", "function-call"],
  function(collective, element, html, functionCall) {

    function BrowserBridge(instance) {
      this.instance = instance
      this.id = Math.random().toString(36).substr(2,4)
      this.bindings = {}
      this.previousBindingStacks = {}
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
        var html = this.toHtml(content)

        return function(x, response) {
          response.send(html)
        }
      }

    BrowserBridge.prototype.addToHead =
      function(html) {
        this.head = this.head+html
      }

    BrowserBridge.prototype.toHtml =
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
          var binding = this.bindings[identifier]
          var source = binding.definitionComment+"\n"+binding.source()

          lines.push("      "+source)
        }

        var source = "\n"
          + lines.join("\n\n")
          + "\n"

        source += "\n\n// Stuff to run on page load:\n\n"

        source += this.asapSource

        return source
      }

    function definitionComment() {
      try {
        throw new Error("browser-bridge induced this error for introspection purposes")
      } catch (e) {
        var stack = e.stack.split("\n")

        if (stack[3].match("callCollectiveMethod")) {
          var depth = 4
        } else {
          var depth = 3
        }

        var origin = stack[depth].substr(7)

        return "// defined at "+origin
      }
    }

    BrowserBridge.prototype.asap =
      function(binding) {

        if (!binding.__isFunctionCallBinding) {

          var args = Array.prototype.slice.call(arguments)

          binding = this.defineFunction.apply(this, args)
        }

        var source = definitionComment() + "\n"

        source += binding.evalable ? binding.evalable({expand: true}): binding

        this.asapSource += source + "\n\n"
      }

    BrowserBridge.prototype.defineSingleton =
      function() {

        var binding = buildBinding(arguments, this).singleton()

        binding.definitionComment = definitionComment()

        var source = definitionComment()+"\n" + binding.source()

        this.asapSource += source + "\n\n"

        return binding
      }

    BrowserBridge.prototype.defineFunction =
      function() {
        var binding = buildBinding(arguments, this)

        binding.definitionComment = definitionComment()

        var identifier = binding.binding.identifier

        this.bindings[identifier] = binding

        return binding
      }

    function buildBinding(args, bridge) {
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

      var functionHash = hash(func.toString())

      var stack = bridge.previousBindingStacks[functionHash]

      if (stack) {
        console.log("Duplicate function:\n", func)
        console.log("\nOriginal defined:\n", stack)

        throw new Error("You are trying to define the above function, but we already defined one that looks just like that on this bridge. That seems wrong, but if you think it's right, add support to browser-bridge for this.")
      } else {
        try {
          throw new Error()
        } catch(e) {
          bridge.previousBindingStacks[functionHash] = e.stack.split("\n").slice(3).join("\n")
        }
      }
      
      preventUndefinedDeps(dependencies, func)

      var identifier = original = name || func.name || "f"

      while(identifier in bridge.identifiers) {

        identifier = original+"_"+Math.random().toString(36).split(".")[1].substr(0,4)
      }

      bridge.identifiers[identifier] = true

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

    // fnv32a
    function hash(str)
    {
      // https://gist.github.com/vaiorabbit/5657561
      var FNV1_32A_INIT = 0x811c9dc5;
      var hval = FNV1_32A_INIT;
      for ( var i = 0; i < str.length; ++i )
      {
        hval ^= str.charCodeAt(i);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
      }
      return hval >>> 0;
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