if (typeof define !== 'function') {
  var define = require('amdefine')(
    module)}

// Bridge Tie

define(
  ["nrtv-element", "object-hash"],
  function(element, hash) {
    function BridgeTie(instance) {
      this.instance = instance
      this.clientFuncs = {}
    }

    BridgeTie.prototype.sendPage =
      function(body) {

        var jquery = element("script", {src: "https://code.jquery.com/jquery-2.1.4.min.js"})

        var bindings = element(
          "script",
          this.script()
        )

        var styles = element("style", " .hidden { display: none }")

        var html = element("html", [
          element("head", [
            jquery,
            bindings,
            styles
          ]),
          element("body", body.html())
        ]).html()

        return function(x, response) {
          response.send(html)
        }

      }

    BridgeTie.prototype.script =
      function() {
        var lines = []
        for (key in this.clientFuncs) {
          lines.push(
            "'"
            + key
            + "': "
            + funcSource(this.clientFuncs[key])
          )
        }

        funcsSource = "{\n"
          + lines.join(",\n  ")
          + "\n}"

        var lines = client.toString().replace("FUNCS", funcsSource).split("\n")

        return lines.slice(1,lines.length-1).join("\n")

      }

    function funcSource(func) {
      return func
        .toString()
        // .replace(
        //   /function [a-zA-Z0-9_]+ ?\(/,
        //   "function("
        // )
    }

    BridgeTie.prototype.defineOnClient =
      function(func) {
        var key = hash(func)

        if (!this.clientFuncs[key]) {

          // We keep the functions so when someone asks for a page we can send them down with the HTML

          this.clientFuncs[key] = func
        }

        return function() {
          var args = Array.prototype.slice.call(arguments)

          return new BoundFunc(key, args)
        }
      }

    function BoundFunc(key, args) {
      this.binding = {
        key: key,
        args: args
      }
    }

    // gives you a string that when evaled on the client, would cause the function to be called with the args

    BoundFunc.prototype.evalable =
      function() {
        return "funcs[\""
          + this.binding.key
          + "\"].apply(bridge,"
          + JSON.stringify(this.binding.args)
          + ")"
      }

    // gives you a JSON object that, if sent to the client, causes the function to be called with the args

    BoundFunc.prototype.evalResponse =
        function() {
          return this.binding
        }

    // And here is the client we run in the browser to facilitate those two things. The funcs are swapped in when we write the HTML page. 

    function client() {
      var funcs = FUNCS
      var bridge = {
        handle: function(binding) {
          funcs[binding.key].apply(bridge, binding.args)
        }
      }
    }

    return function(component) {
      component.addTypeOfTie("bridge", BridgeTie)
    }
  }
)