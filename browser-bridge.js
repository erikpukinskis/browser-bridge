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

    function getCollective() {
      if (!collective.bridge) {
        collective.bridge = new BrowserBridge()
      }

      return collective.bridge
    }

    // Rename sendPageHandler? #todo

    BrowserBridge.prototype.sendPage =
      function(body) {
        var html = this.getPage(body)

        return function(x, response) {
          response.send(html)
        }
      }

    // make this private: #todo

    BrowserBridge.prototype.getPage =
      function getPage(body) {

        var bindings = element(
          "script",
          this.script()
        )

        var styles = element("style", " .hidden { display: none }")

        var el = element("html", [
          element("body", body || ""),
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

        funcsSource = "\n"
          + lines.join("\n\n")
          + "\n"

        var lines = client.toString().replace("FUNCS", funcsSource).split("\n")

        var source = lines.slice(1,lines.length-1).join("\n")

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

    library.collectivize(
      BrowserBridge,
      collective,
      function() {
        return new BrowserBridge()
      },
      ["sendPage", "asap", "defineFunction", "defineSingleton"]      
    )

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

        return this.binding.identifier+".bind(bridge,"+arguments+")"
      }

    BoundFunc.prototype.argumentString = function() {

        var deps = []

        for(var i=0; i<this.binding.dependencies.length; i++) {

          var dep = this.binding.dependencies[i]

          if (typeof dep.callable != "function") {
            throw new Error("You passed "+JSON.stringify(dep)+" as a dependency to "+this.binding.identifier+" but it needs to either be a collective or have a .callable() method.")
          }

          deps.push(dep.callable())
        }

        for(var i=0; i<this.binding.args.length; i++) {

          var arg = this.binding.args[i]

          var isClientFunction = arg && arg.binding && arg.binding.__BrowserBridgeBinding

          if (typeof arg == "undefined") {
            var source = "undefined"
          } else if (arg === null) {
            source = "null"
          } else if (isClientFunction) {
            source = arg.callable()
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
          return this.binding
        }

    // And here is the client we run in the browser to facilitate those two things. The funcs are swapped in when we write the HTML page.

    function client() {
      FUNCS
      var bridge = {
        handle: function(binding) {
          if (binding.__BrowserBridgeBinding) {
            var func = window[binding.identifier]

            if (!func) {
              throw new Error("Tried to call "+binding.identifier+"in the browser, but it isn't defined. Did you try to call defineFunction in an ajax response? You need to define all client functions before you send the initial page to the browser.")
            }
            window[binding.identifier].apply(bridge, binding.args)
          }
        }
      }
    }

    return BrowserBridge
  }
)