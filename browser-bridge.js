var library = require("nrtv-library")(require)

module.exports = library.export(
  "nrtv-browser-bridge",
  [library.collective({}), "nrtv-element", "object-hash", "html"],
  function(collective, element, hash, html) {

    function BrowserBridge(instance) {
      this.instance = instance
      this.id = Math.random().toString(36).substr(2,4)
      this.bindings = {}
      this.asapBindings = []
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
        for (key in this.bindings) {
          var source = this.bindings[key].source()

          lines.push("      "+source)
        }

        funcsSource = "\n"
          + lines.join("\n\n")
          + "\n"

        var lines = client.toString().replace("FUNCS", funcsSource).split("\n")

        var source = lines.slice(1,lines.length-1).join("\n")

        source += "\n\n// Stuff to run on page load:\n\n"

        source += this.asapBindings.map(
          function(binding) {
            return binding.evalable()
          }
        ).join("\n")

        return source
      }

    BrowserBridge.prototype.asap =
      function(binding) {

        if (!binding.evalable) {
          throw new Error("You tried to do bridge.asap("+JSON.stringify(binding)+") but asap only knows what to do if you pass it a binding that came from, like, bridge.define or something that does bridge.define for you. It should be something with an .evalable() method.")
        }

         this.asapBindings.push(binding)
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

        var key = (func.name.length ? func.name : 'f')+"_"+hash(func).substr(0,4)

        if (!this.bindings[key]) {
          var binding = new BoundFunc(func, key, dependencies)

          this.bindings[key] = binding
        }

        return this.bindings[key]
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
    function BoundFunc(func, key, dependencies, args) {
      this.binding = {
        __BrowserBridgeBinding: true,
        func: func,
        key: key,
        dependencies: dependencies || [],
        args: args || [],
      }
    }

    BoundFunc.prototype.withArgs =
      function() {
        var args = Array.prototype.slice.call(arguments)

        return new BoundFunc(
          this.binding.func,
          this.binding.key,
          this.binding.dependencies,
          [].concat(this.binding.args, args)
        )
      }

    BoundFunc.prototype.source =
      function() {
        var source = this.binding.func.toString()

        var source = source.replace(
          /^function[^(]*\(/,
          "function "+this.binding.key+"("
        )

        if (this.isGenerator) {

          if (this.binding.dependencies.length > 0) {

            var callArgs = "null, "+this.argumentString()

          } else {
            var callArgs = ""
          }

          source = "var "+this.binding.key+" = ("+source+").call("+callArgs+")"
        }

        return source
      }

    // Gives you a string that when evaled on the client, would cause the function to be called with the args:

    BoundFunc.prototype.callable =
      function() {
        if (this.isGenerator) {
          return this.binding.key
        }

        var arguments = this.argumentString()

        if (arguments.length < 1) {
          return this.binding.key
        }

        return this.binding.key+".bind(bridge,"+arguments+")"
      }

    BoundFunc.prototype.argumentString = function() {

        var deps = []

        for(var i=0; i<this.binding.dependencies.length; i++) {

          var dep = this.binding.dependencies[i]

          if (typeof dep.callable != "function") {
            throw new Error("You passed "+JSON.stringify(dep)+" as a dependency to "+this.key+" but it needs to either be a collective or have a .callable() method.")
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
        return this.binding.key+"("+this.argumentString()+")"
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
            var func = window[binding.key]

            if (!func) {
              throw new Error("Tried to call "+binding.key+"in the browser, but it isn't defined. Did you try to call defineFunction in an ajax response? You need to define all client functions before you send the initial page to the browser.")
            }
            window[binding.key].apply(bridge, binding.args)
          }
        }
      }
    }

    return BrowserBridge
  }
)