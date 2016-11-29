var library = require("nrtv-library")(require)

module.exports = library.export(
  "browser-bridge",
  [library.collective({}), "web-element", "html", "function-call"],
  function(collective, element, html, functionCall) {

    function BrowserBridge(instance) {
      this.instance = instance
      this.id = Math.random().toString(36).substr(2,4)
      this.previousBindingStacks = {}
      this.identifiers = {}
      this.asapSource = ""
      this.bindingSource = ""
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
        var source = this.bindingSource

        if (this.asapSource.length) {
          source += "\n\n// Stuff to do ASAP:\n"

          source += this.asapSource
        }

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

        var source = ""
        var isCall = !!binding.__isFunctionCallBinding
        var isSource = typeof(binding) == "string" && typeof(arguments[1]) == "undefined"

        if (isCall) {
          source += definitionComment() + "\n"
          source += binding.evalable ? binding.evalable({expand: true}): binding

        } else if (isSource) {
          source = binding

        } else {
          var binding = buildBinding(arguments, this)
          binding.definitionComment = definitionComment()
          source += bindingSource(binding, {callNow: true})
        }

        this.asapSource += source + "\n\n"
      }

    BrowserBridge.prototype.defineSingleton =
      function() {

        var binding = buildBinding(arguments, this)

        var deps = binding.dependencies

        binding = binding.singleton()
        binding.dependencies = deps
        binding.definitionComment = definitionComment()

        this.bindingSource += bindingSource(binding)

        return binding
      }

    BrowserBridge.prototype.defineFunction =
      function() {
        var binding = buildBinding(arguments, this)

        binding.definitionComment = definitionComment()

        this.bindingSource += bindingSource(binding)

        return binding
      }

    function deIndent(string) {
      var lines = string.split("\n")
      var shave = 100
      for(var i=1; i<lines.length; i++) {
        var line = lines[i]
        var leading = line.match(/^ */)[0].length
        if (leading == line.length) {
          continue
        }
        if (leading < shave) {
          shave = leading
        }
      }

      if (shave < 1) {
        return string
      }

      var shaved = lines[0].trim()

      for(var i=1; i<lines.length; i++) {
        shaved += "\n"+lines[i].substr(shave)
      }

      return shaved
    }


    function bindingSource(binding, options) {

      var funcSource = deIndent(binding.binding.func.toString())

      var dependencies = binding.dependencies
      var hasDependencies = dependencies.length > 0
      var callNow = options && !!options.callNow
      var isPlainFunction = !binding.isGenerator && !hasDependencies && !callNow

      if (isPlainFunction) {
        var source = funcSource.replace(
          /^function[^(]*\(/,
          "function "+binding.binding.identifier+"("
        )
      } else {
        if (dependencies[0] &&dependencies[0].__dependencyType == "browser collective") {
          var collective = dependencies[0]
        }

        if (collective) {
          var deps = "null, "+JSON.stringify(collective.attributes)
          if (dependencies.length > 1) {
            deps += functionCall.argumentString(dependencies.slice(1))
          }
        } else if (hasDependencies) {
          var deps = "null, "+
          functionCall.argumentString(dependencies)
        } else {
          var deps = ""
        }

        var callOrBind = (binding.isGenerator || callNow) ? "call" : "bind"

        if (callNow) {
          var source = ""
        } else {
          var source = "var "+binding.binding.identifier+" = "
        }

        source += "("+funcSource+")."+callOrBind+"("+deps+")"
      }

      return "\n"+binding.definitionComment+"\n"+source+"\n"
    }

    function buildBinding(args, bridge) {
      for (var i=0; i<args.length; i++) {
        var arg = args[i]

        if (typeof arg == "string") {
          var name = arg
        } else if (typeof arg == "function") {
          var func = arg
        } else if (Array.isArray(arg)) {

          // The dependencies and the withArgs are a little redundant here. #todo Remove dependencies.

          var dependencies = args[i]
        }
      }

      dependencies = dependencies || []

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

      var binding = functionCall(func, identifier)

      binding.dependencies = dependencies

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