var library = require("nrtv-library")(require)

module.exports = library.export(
  "nrtv-browser-bridge",
  [library.collective({}), "nrtv-element", "object-hash", "html"],
  function(collective, element, hash, html) {

    function BrowserBridge(instance) {
      this.instance = instance
      this.id = Math.random().toString(36).substr(2,4)
      this.bindings = {}
      this.identifiers = {}
      this.asapSource = ""
    }

    BrowserBridge.collective =
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
        for (sourceHash in this.bindings) {
          var source = this.bindings[sourceHash].source()

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

        var sourceHash = hash(func)

        var identifier = original = name || func.name || "f"

        var binding = this.bindings[sourceHash]

        if (binding) { return binding }

        while(identifier in this.identifiers) {

          identifier = original+"_"+Math.random().toString(36).split(".")[1].substr(0,4)
        }

        this.identifiers[identifier] = true

        binding = new BoundFunc(func, identifier, dependencies)

        this.bindings[sourceHash] = binding

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

    // rename ClientDefinition?
    function BoundFunc(func, identifier, dependencies, args) {
      this.binding = {
        __BrowserBridgeBinding: true,
        func: func,
        identifier: identifier,
        dependencies: dependencies || [],
        args: args || [],
      }
    }

    BoundFunc.prototype.withArgs =
      function() {
        var args = Array.prototype.slice.call(arguments)

        return new BoundFunc(
          this.binding.func,
          this.binding.identifier,
          this.binding.dependencies,
          [].concat(this.binding.args, args)
        )
      }

    BoundFunc.prototype.source =
      function() {
        var source = this.binding.func.toString()

        if (this.isGenerator) {

          if (this.binding.dependencies.length > 0) {

            var callArgs = "null, "+this.argumentString()

          } else {
            var callArgs = ""
          }

          source = "var "+this.binding.identifier+" = ("+source+").call("+callArgs+")"
        } else {
          source = source.replace(
            /^function[^(]*\(/,
            "function "+this.binding.identifier+"("
          )

          var firstDependency = this.binding.dependencies[0]

          var hasCollective = firstDependency &&firstDependency.__dependencyType == "browser collective"

          if (hasCollective) {
            source = "var "+this.binding.identifier+" = ("+source+").bind(null,"+JSON.stringify(firstDependency.attributes)+")"
          }
        }

        return source
      }

    // Gives you a string that when evaled on the client, would cause the function to be called with the args:

    BoundFunc.prototype.callable =
      function() {
        if (this.isGenerator) {
          return this.binding.identifier
        }

        var arguments = this.argumentString()

        if (arguments.length < 1) {
          return this.binding.identifier
        }

        return this.binding.identifier+".bind(null,"+arguments+")"
      }

    BoundFunc.prototype.argumentString = function() {

        var deps = []

        for(var i=0; i<this.binding.dependencies.length; i++) {

          var dep = this.binding.dependencies[i]

          var isCollective = dep.__dependencyType == "browser collective"

          if (isCollective) {
            if (i>0) {
              throw new Error("You can only use a collective as the first dependency of a browser function. (I know, annoying.) You have library.collective("+JSON.stringify(dep.attributes)+") as the "+i+ "th argument to "+this.binding.key)
            }
          } else {
            if (typeof dep.callable != "function") {
              throw new Error("You passed "+JSON.stringify(dep)+" as a dependency to "+this.key+" but it needs to either be a collective or a function or have a .callable() method.")
            }

            deps.push(dep.callable())
          }
        }

        for(var i=0; i<this.binding.args.length; i++) {

          var arg = this.binding.args[i]

          var isBinding = arg && arg.binding && arg.binding.__BrowserBridgeBinding

          var isFunction = typeof arg == "function"

          if (typeof arg == "undefined") {
            var source = "undefined"
          } else if (arg === null) {
            source = "null"
          } else if (isBinding) {
            source = arg.callable()
          } else if (isFunction) {
            source = arg.toString()
          } else {
            source = JSON.stringify(arg)
          }

          deps.push(source)
        }

        return deps.length ? deps.join(",") : ""
    }

    BoundFunc.prototype.evalable =
      function() {
        return this.binding.identifier+"("+this.argumentString()+")"
      }

    // Gives you a JSON object that, if sent to the client, causes the function to be called with the args:

    // Rename to ajaxResponse? #todo

    BoundFunc.prototype.ajaxResponse =
        function() {
          return {
            evalable: this.evalable()
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