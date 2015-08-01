var library = require("nrtv-library")(require)

module.exports = library.export(
  "nrtv-browser-bridge",
  [library.collective({}), "nrtv-element", "object-hash", "html"],
  function(collective, element, hash, html) {
 
    function BrowserBridge(instance) {
      this.instance = instance
      this.id = Math.random().toString(36).substr(2,4)
      this.clientFuncs = {}
    }

    BrowserBridge.collective =
      function() {
        if (!collective.bridge) {
          collective.bridge = new BrowserBridge()
        }

        return collective.bridge
      }

    BrowserBridge.prototype.sendPage =
      function(body) {
        var html = this.getPage(body)

        return function(x, response) {
          response.send(html)
        }

      }

    BrowserBridge.prototype.getPage =
      function(body) {
        var jquery = element("script", {src: "https://code.jquery.com/jquery-2.1.4.min.js"})

        var bindings = element(
          "script",
          this.script()
        )

        var styles = element("style", " .hidden { display: none }")

        var el = element("html", [
          element("head", [
            jquery,
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
        for (key in this.clientFuncs) {
          var source = this.clientFuncs[key].toString()

          var source = source.replace(
            /^function[^(]*\(/,
            "function "+key+"("
          )

          lines.push(source)
        }

        funcsSource = "\n"
          + lines.join("\n      ")
          + "\n"

        var lines = client.toString().replace("FUNCS", funcsSource).split("\n")

        return lines.slice(1,lines.length-1).join("\n")

      }

    BrowserBridge.prototype.defineOnClient =
      function(one, two) {

        if (two) {
          var func = two
          var dependencies = one
        } else {
          var func = one
          var dependencies = []
        }


        var key = (func.name.length ? func.name : 'f')+"_"+hash(func).substr(0,4)

        if (!this.clientFuncs[key]) {

          // We keep the functions so when someone asks for a page we can send them down with the HTML

          this.clientFuncs[key] = func
        }

        return new BoundFunc(key, dependencies)
      }

    // rename ClientDefinition?
    function BoundFunc(key, dependencies, args) {
      this.binding = {
        key: key,
        dependencies: dependencies || [],
        args: args || [],
      }
    }

    BoundFunc.prototype.withArgs =
      function() {
        var args = Array.prototype.slice.call(arguments)

        return new BoundFunc(
          this.binding.key,
          this.binding.dependencies,
          [].concat(this.binding.args, args)
        )
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

          deps.push(this.binding.dependencies[i].callable())
        }

        for(var i=0; i<this.binding.args.length; i++) {

          deps.push(JSON.stringify(this.binding.args[i]))
        }

        return deps.length ? deps.join(",") : ""
    }

    BoundFunc.prototype.evalable =
      function() {
        return this.binding.key+"("+this.argumentString()+")"
      }

    // gives you a JSON object that, if sent to the client, causes the function to be called with the args

    BoundFunc.prototype.evalResponse =
        function() {
          return this.binding
        }

    // And here is the client we run in the browser to facilitate those two things. The funcs are swapped in when we write the HTML page. 

    function client() {
      FUNCS
      var bridge = {
        handle: function(binding) {
          funcs[binding.key].apply(bridge, binding.args)
        }
      }
    }

    return BrowserBridge
  }
)