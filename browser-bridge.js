var library = require("module-library")(require)

module.exports = library.export(
  "browser-bridge",
  ["web-element", "function-call", "./partial-bridge", "global-wait"],
  generator
)


function generator(element, functionCall, PartialBridge, globalWait) {

  function BrowserBridge() {
    this.id = "brg"+Math.random().toString(36).substr(2,4)
    this.previousBindingStacks = {}

    // Reserved identifiers:
    this.identifiers = {
      functionCall: true,
      Library: true,
      library: true,
      Tree: true,
      BRIDGE_DATA: true,
      onDomReady: true,
    }

    this.partials = []
    this.head = ""
    this.children = []
    this.memories = []
    this.__isNrtvBrowserBridge = true

    this.scriptSource = ""
    functionCall && functionCall.defineOn(this)
    addSource(this, "\n// Bridge data: ### BRIDGE DATA GOES HERE ###\n\n")
    this.domReadySource = ""
  }

  function getValue(bridge, attribute, key) {
    var object = bridge[attribute]
    if (bridge.DTRACE_NET_SERVER_CONNECTION) {
      throw new Error("bridge is not a bridge")
    }
    var value = object[key]
    if (!value && bridge.base) {
      value = getValue(bridge.base, attribute, key)
    }
    return value
  }

  function getFullString(bridge, attribute) {
    if (bridge.base) {
      var string = getFullString(bridge.base, attribute)
    } else {
      string = ""
    }

    string += bridge[attribute]

    bridge.partials.forEach(function(partial) {
      if (partial[attribute]) {
        string += partial[attribute]
      }
    })

    return string
  }

  BrowserBridge.prototype.claimIdentifier = function(identifier) {

    this.identifiers[identifier] = null

    if (this.base) {
      this.base.claimIdentifier(identifier)
    }
  }

  BrowserBridge.prototype.remember = function(key) {
    return this.memories[key] || this.base && this.base.remember(key)
  }

  BrowserBridge.prototype.see = function(key, object) {
    this.memories[key] = object
  }

  BrowserBridge.prototype.copy = function() {
      var copy = new BrowserBridge()
      copy.base = this
      copy.id = "copy-"+Math.random().toString(36).substr(2,4)+"-of-"+this.id
      return copy
    }


  BrowserBridge.prototype.partial = function() {
    return new PartialBridge(this)
  }


  // Rename sendPageHandler? #todo

  BrowserBridge.prototype.addToBody = function(content) {
    this.children.push(content)
  }

  BrowserBridge.prototype.requestHandler = function(content) {
      var html = this.toHtml(content)

      return function(x, response) {
        response.send(html)
      }
    }

  BrowserBridge.prototype.addToHead =
    function(stuff) {
      if (typeof stuff.html == "function") {
        stuff = stuff.html()
      }
      this.head = this.head+stuff
    }

  BrowserBridge.rawSource =
  BrowserBridge.prototype.rawSource = 
  PartialBridge.prototype.rawSource = function(source) {
    if (!source) {
      throw new Error("Raw source is empty")
    }
    return {
      __isNrtvSource: true,
      source: source
    }
  }

  BrowserBridge.prototype.withChildren = function(content) {
      if (content && this.children.length) {
        if (typeof content != "array") {
          content = [content]
        }

        content = this.children.concat(content)
      } else if (this.children.length) {
        content = this.children
      }

      if (this.base) {
        content = this.base.withChildren(content)
      }

      return content
    }

  BrowserBridge.prototype.toHtml =
    function(content, isPartial) {

      content = this.withChildren(content)

      var bindings = element(
        "script",
        "<!--\n"+this.script()+"\n-->"
      )

      var hidden = element.style(
        ".hidden", {
          "display": "none"
        })

      var isString = typeof(content) == "string"

      var needsBody = isString || !hasBody(content, 2)

      var needsDomReady = !!getFullString(this, "domReadySource")

      if (!isPartial) {
        if (needsBody) {
          content = element("body", content||"")
        }

        if (needsDomReady) {
          content.addAttribute("onload", "onDomReady()")
        }
      }
      
      var headSource = '<meta name="viewport" content="width=device-width, initial-scale=1">\n'+element.stylesheet(hidden).html()+bindings.html()+getFullString(this, "head")

      if (isPartial) {
        if (content.html) {
          content = content.html()
        }
        var source = "\n<!-- HEAD -->\n\n"+headSource+"\n\n\n<!-- BODY -->\n\n"+content+"\n"
      } else {
        var page = element("html", [
          element("head", element.raw(headSource)),
          content
        ])
        var source = "<!DOCTYPE html>\n" + page.html()
      }


      if (this.needsBridgeData) {
        source = prependBridgeData(this, source)
      }

      return source
    }

  function prependBridgeData(bridge, content) {

    bridge.claimIdentifier("BRIDGE_DATA")

    var binding = buildBinding([
      "BRIDGE_DATA",
      ["### BRIDGE DATA ###"],
      function(data) {
        return data
      }
    ], bridge)

    binding.definitionComment = definitionComment(1)
    binding.isGenerator = true

    var source = bindingSource(binding)

    source = source.replace("\"### BRIDGE DATA ###\"", bridgeDataSource(bridge))

    return content.replace("// Bridge data: ### BRIDGE DATA GOES HERE ###", "// Bridge data:\n\n"+source)
  }

  function hasBody(content, depth) {
    if (!content) {
      return false
    } else if (typeof content == "string") {
      return !!content.match(/<body/g)
    }

    if (depth < 1) { return false }

    if (content.tagName == "body") {
      return true
    }

    var children = content.children || content

    if (!Array.isArray(children)) {
      return false
    }

    for(var i=0; i<children.length; i++) {

      if (typeof children[i] == "undefined") {
        throw new Error(i+"th child you passed to browser-bridge as the page content is undefined")
      }
      if (hasBody(children[i], depth-1)) {
        return true
      }
    }

    return false
  }

  BrowserBridge.prototype.asBinding = function() {
    console.log(" ⚡⚡⚡ WARNING ⚡⚡⚡ calling asBinding() on a browser-bridge function definition is deprecated. Try yourBridgeFunction.asFunctionCall()")
  }

  BrowserBridge.prototype.asFunctionCall = function() {

    var clientBridge = this.remember("browser-bridge/clientBridge")

    if (clientBridge) { return clientBridge }

    var BrowserBridgeBinding = this.defineSingleton(
      "BrowserBridge",
      [{}, function() {}, functionCall.defineOn(this), PartialBridge.defineOn(this)],
      generator
    )

    var clientBridge = this.defineSingleton(
      "localBridge",
      [BrowserBridgeBinding, this.data()],
      function(BrowserBridge, data) {
        return BrowserBridge.fromData(data)
      }
    )

    this.see("browser-bridge/clientBridge", clientBridge)

    return clientBridge
  }

  BrowserBridge.prototype.data = function() {
    this.needsBridgeData = true
    return functionCall("BRIDGE_DATA")
  }

  function bridgeDataSource(bridge) {

    var data = {
      identifiers: bridge.identifiers,
      memories: "XXXXX"
    }

    var memoriesJSON = "{\n"

    for(key in bridge.memories) {
      var binding = bridge.memories[key]
      if (!binding.__isFunctionCallBinding) {
        continue
        // throw new Error("Remembered in "+key+" a memory that's not a function call?")
      }

      memoriesJSON += "    "+"\""+key+"\""+": "+binding.asCall().callable()+",\n"
    }

    memoriesJSON += "  },"

    var dataJSON = JSON.stringify(data, null, 2)

    dataJSON = dataJSON.replace("\"memories\": \"XXXXX\"", "\"memories\": "+memoriesJSON)

    return dataJSON
  }


  BrowserBridge.fromData = function(data) {
    var bridge = new BrowserBridge()
    bridge.identifiers = data.identifiers
    bridge.memories = data.memories
    return bridge
  }

  function memoryToBinding(memory) {
    return memory.asBinding()
  }

  BrowserBridge.prototype.script =
    function() {
      var domReadySource = getFullString(this, "domReadySource")

      if (domReadySource) {
        var wait = globalWait.defineOn(this)
      }

      var script = getFullString(this, "scriptSource")

      if (domReadySource) {

        var domReadyTicket = buildBinding([
          "domReadyTicket",
          [wait],
          function(wait) {
            return wait.start("dom ready")}
          ],
          this)

        domReadyTicket.isGenerator = true

        domReadyTicket.definitionComment = definitionComment()

        script += "\n\n// The mind is willing but the body is not ready:"

        script += "\n"
        script += bindingSource(domReadyTicket)

        domReadyTicket = functionCall(domReadyTicket.identifier).singleton()

        var finish = wait.methodCall("finish").withArgs(domReadyTicket)

        script += "\n\nfunction onDomReady() { setTimeout(function giveItASec() {\n"+domReadySource+"\n\n"+finish.evalable()+"\n}, 0) }\n"
      }

      return script
    }

  function definitionComment(depth) {
    depth = (depth||0)+3

    try {
      throw new Error("browser-bridge induced this error for introspection purposes")
    } catch (e) {
      var stack = e.stack.split("\n")

      var origin = stack[depth].substr(7)

      return "// defined at "+origin
    }
  }

  BrowserBridge.prototype.asap =
    function() {
      var source = argumentsToSource.apply(this, arguments)

      addSource(this, source)
    }

  function addSource(bridge, source) {
    bridge.scriptSource += source
  }

  BrowserBridge.prototype.domReady =
    function() {
      this.domReadySource += argumentsToSource.apply(this, arguments)
    }

  function argumentsToSource(whatnot, etc) {
    var isCall = !!whatnot.__isFunctionCallBinding
    var isSource = typeof(whatnot) == "string" && typeof(etc) == "undefined"
    var source = ""

    if (isCall) {
      var binding = whatnot
      source += definitionComment(1) + "\n"
      source += binding.evalable ? binding.evalable({expand: true}): binding

    } else if (isSource) {
      source = whatnot

    } else {
      var binding = buildBinding(arguments, this)
      binding.definitionComment = definitionComment(1)
      source += ";"+bindingSource(binding, {callNow: true})
    }

    return "\n"+source+"\n"
  }

  BrowserBridge.prototype.defineSingleton =
    function() {

      var binding = buildBinding(arguments, this)

      binding.definitionComment = definitionComment()
      binding.isGenerator = true

      addSource(this, bindingSource(binding))

      return functionCall(binding.identifier).singleton()
    }

  BrowserBridge.event = BrowserBridge.prototype.event = functionCall.raw("event")

  BrowserBridge.prototype.defineFunction =
    function() {
      var binding = buildBinding(arguments, this)

      binding.definitionComment = definitionComment()

      addSource(this, bindingSource(binding))

      return functionCall(binding.identifier)
    }

  BrowserBridge.prototype.forResponse = function(response) {
    var copy = this.copy()
    copy.response = response
    return copy
  }

  BrowserBridge.prototype.send = function(content) {
      if (!this.response) {
        throw new Error("You can not call bridge.send() on an original browser bridge. Try:\n        var newBridge = bridge.forResponse(response)\n        newBridge.send(content)\nor use bridge.requestHandler(content)")
      }

      this.requestHandler(content)(null, this.response)
    }

  BrowserBridge.prototype.changePath = function(path) {
    if (this.__changedPath) {
      throw new Error("Already set path on bridge "+this.id+" to "+this.__changedPath)
    }
    this.__changedPath = path
    this.asap([path], function(path) {
      history.pushState(null, null, path)
    })
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

    var funcSource = deIndent(functionToString(binding.func))

    var dependencies = binding.dependencies
    var hasDependencies = dependencies.length > 0
    var callNow = options && !!options.callNow
    var isPlainFunction = !binding.isGenerator && !hasDependencies && !callNow

    if (isPlainFunction) {
      var source = funcSource.replace(
        /^function[^(]*\(/,
        "function "+binding.identifier+"("
      )
    } else {

      if (hasDependencies) {
        var deps = "null, "+
        functionCall.argumentString(dependencies, {expand: true})
      } else {
        var deps = ""
      }

      var callOrBind = (binding.isGenerator || callNow) ? "call" : "bind"

      if (callNow) {
        var source = ""
      } else {
        var source = "var "+binding.identifier+" = "
      }

      source += "("+funcSource+")."+callOrBind+"("+deps+")"
    }

    return "\n"+binding.definitionComment+"\n"+source+"\n"
  }

  function functionToString(value) {
    if (typeof value == "string") {
      return value
    } else {
      return value.toString()
    }
  }

  function buildBinding(args, bridge) {
    for (var i=0; i<args.length; i++) {
      var arg = args[i]

      if (arg.__isNrtvSource == true) {
        func = arg.source
      } else if (typeof arg == "string") {
        var name = arg
      } else if (typeof arg == "function") {
        var func = arg
      } else if (Array.isArray(arg)) {

        // The dependencies and the withArgs are a little redundant here. #todo Remove dependencies.

        var dependencies = args[i]
      }
    }

    dependencies = dependencies || []

    dependencies.forEach(function(dep, i) {
      if (!dep) {
        throw new Error("Dependency "+i+" you passed to the bridge is undefined") 
      }
    })
    
    if (!func) {
      throw new Error("You need to pass a function to bridge.defineFunction, but you passed "+JSON.stringify(args)+".")
    }

    var functionHash = hash(functionToString(func))

    var stack = getValue(bridge, "previousBindingStacks", functionHash)

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
    
    preventBadDeps(dependencies, func)

    var identifier = original = name || func.name || "f"


    while(getValue(bridge, "identifiers", identifier)) {

      identifier = original+"_"+Math.random().toString(36).split(".")[1].substr(0,4)
    }

    bridge.identifiers[identifier] = true


    var binding = {
      dependencies: dependencies,
      func: func,
      identifier: identifier,
    }

    return binding
  }

  function find(array, test) {
    for(var i=0; i<array.length; i++) {
      var item = array[i]
      if (test(item)) {
        return item
      }
    }
  }

  function preventBadDeps(dependencies, func) {

    if (!dependencies) { return }

    for(var i=0; i<dependencies.length; i++) {

      var mod = dependencies[i].__nrtvModule
      if (mod) {

        var description = (func.name || functionToString(func).substr(0,60)+"...").replace(/(\n| )+/g, " ")

        throw new Error("The "+i+"th dependency you passed for "+description+" was a module-library module called "+mod.name+". You probably meant to do bridgeModule(lib, \""+mod.name+"\", bridge) and you just passed the singleton.")
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

  return BrowserBridge
}
