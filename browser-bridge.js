var library = require("nrtv-library")(require)

module.exports = library.export(
  "nrtv-browser-bridge",
  [library.collective({}), "nrtv-element", "object-hash", "html"],
  function(collective, element, hash, html) {

    function BrowserBridge(instance) {
      this.instance = instance
      this.id = Math.random().toString(36).substr(2,4)
      this.bindings = {}
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

    BrowserBridge.sendPage =
      function(body) {
        return getCollective().sendPage(body)
      }

    BrowserBridge.prototype.getPage =
      function(body) {

        var bindings = element(
          "script",
          this.script()
        )

        var styles = element("style", " .hidden { display: none }")

        var el = element("html", [
          element("head", [
            bindings,
            styles
          ]),
          body || ""
        ])

        var source = "<!DOCTYPE html>\n" + el.html()

        return html.prettyPrint(source)
      }

    BrowserBridge.prototype.script =
      function() {
        var lines = []
        for (key in this.bindings) {
          var source = this.bindings[key].source()

          lines.push(source)
        }

        funcsSource = "\n"
          + lines.join("\n      ")
          + "\n"

        var lines = client.toString().replace("FUNCS", funcsSource).split("\n")

        return lines.slice(1,lines.length-1).join("\n")

      }

    // The dependencies and the withArgs are a little redundant here. #todo Remove dependencies.

    BrowserBridge.prototype.defineOnClient =
      function(one, two) {

        if (two) {
          var func = two
          var dependencies = one
        } else if (one) {
          var func = one
          var dependencies = []
        } else {
          throw new Error("You need to pass a function to BrowserBridge.defineOnClient, but you passed "+JSON.stringify(one)+".")
        }

        var key = (func.name.length ? func.name : 'f')+"_"+hash(func).substr(0,4)

        if (!this.bindings[key]) {
          var binding = new BoundFunc(func, key, dependencies)

          this.bindings[key] = binding
        }

        return this.bindings[key]
      }

    BrowserBridge.defineOnClient =
      function(one, two) {
        return getCollective().defineOnClient(one, two)
      }

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
          "function "+key+"("
        )

        var firstDependency = this.binding.dependencies[0]

        var hasCollective = firstDependency &&firstDependency.__dependencyType == "browser collective"

        if (hasCollective) {
          source = "var "+key+" = ("+source+").bind(null,"+JSON.stringify(firstDependency.attributes)+")"
        }

        return source
      }

    // gives you a string that when evaled on the client, would cause the function to be called with the args


    BoundFunc.prototype.callable =
      function() {
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

          var isCollective = dep.__dependencyType == "browser collective"

          if (isCollective && i>0) {
            throw new Error("You can only use a collective as the first dependency of a browser function. (I know, annoying.) You have library.collective("+JSON.stringify(dep.attributes)+") as the "+i+ "th argument to "+this.binding.key)
          }
          if (!isCollective) {
            deps.push(dep.callable())
          }
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

    // gives you a JSON object that, if sent to the client, causes the function to be called with the args

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
              throw new Error("Tried to call "+binding.key+"in the browser, but it isn't defined. Did you try to call defineOnClient in an ajax response? You need to define all client functions before you send the initial page to the browser.")
            }
            window[binding.key].apply(bridge, binding.args)
          }
        }
      }
    }

    return BrowserBridge
  }
)