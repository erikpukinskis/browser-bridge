var library = require("module-library")(require)

module.exports = library.export(
  "partial-bridge",
  ["web-element", "function-call"],
  generator
)

function generator(element, functionCall) {

  // Partial

  function PartialBridge(base) {
    this.id = "partial-"+Math.random().toString(36).substr(2,4)+"-on-"+base.id
    this.base = base
    base.partials.push(this)
    this.headSource = ""
    this.__isNrtvBrowserBridge = true

    try {
      throw new Error("The partial was created here:")
    } catch(e) {
      this.initializeStack = e.stack
    }
  }

  PartialBridge.defineOn = function(bridge) {
    var binding = bridge.remember("browser-bridge/PartialBridge")
    if (binding) { return binding }
    binding = bridge.defineSingleton("PartialBridge", generator)
    bridge.see("browser-bridge/PartialBridge", binding)
    return binding
  }

  PartialBridge.prototype.addToBody = function() {
    throw new Error("Can't add to partial bridge body. Try just doing partial.send(yourContent) or grabbing another partial with partial.partial() and doing .send(yourContent) on that")
  }

  PartialBridge.prototype.loadPartial = function() {
    throw new Error("Partial bridges can't load partials. You need to do bridge.copy().loadPartial.asCall() to get a loadPartial function on the bridge. I know, it's confusing. Sorry.")
  }

  PartialBridge.prototype.sendPartial = function() {
    throw new Error("Partial bridges can't send as a partial. I know, it's confusing. Sorry. Do bridge.copy().forResponse(response).sendPartial(partialBody)")
  }

  PartialBridge.prototype.cache = function() {
    throw new Error("Partial bridges can't be cached. Use a copy")
  }

  PartialBridge.prototype.claimIdentifier = no("claimIdentifier")

  PartialBridge.prototype.withChildren = no("withChildren")

  PartialBridge.prototype.data = no("data")

  PartialBridge.prototype.data = no("data")

  PartialBridge.prototype.data = no("data")

  PartialBridge.prototype.event = functionCall.raw("event")

  function no(method) {
    return function() {
      throw new Error("Partial bridge hasn't implemeneted "+method+" yet.")
    }
  }

  PartialBridge.prototype.send = function(content) {
    if (this.response) {
      throw new Error("Using partials to send HTTP responses is no longer supported. Try bridge.copy().forResponse(response).send() instead")
    } else {
      this.content = content
    }
  }

  PartialBridge.prototype.forResponse = function(response) {
    this.response = response
    return this
  }

  PartialBridge.prototype.asBinding = function() {
    return this.base.asBinding()
  }

  PartialBridge.prototype.asCall = function() {
    return this.base.asCall()
  }

  PartialBridge.prototype.partial = function() {
    return this.base.partial()
  }

  PartialBridge.prototype.claimIdentifier = function(name) {
    this.base.claimIdentifier(name)
  }

  PartialBridge.prototype.changePath = function(path) {
    this.__changedPath = path
  }

  PartialBridge.prototype.selector = function() {
    if (!this.partialClass) {
      this.partialClass = "partial-"+element().assignId()
    }
    return "."+this.partialClass
  }

  // This is so this can be embedded as an element
  PartialBridge.prototype.html = function() {

    if (!this.content) {
      console.log(this.initializeStack)
      throw new Error("Getting content of bridge partial, but you never called partial.send(someContent)")
    }

    if (this.content.html) {
      var el = this.content
    } else {
      var el = element(this.content)
    }

    if (this.partialClass) {
      el.addSelector(this.selector())
    }

    return el.html()
  }


  PartialBridge.prototype.addToHead = function(content) {
    if (typeof content.html == "function") {
      content = content.html()
    }
    this.headSource += content
  }

  PartialBridge.prototype.defineFunction = function() {
    return this.base.defineFunction.apply(this.base, arguments)
  }

  PartialBridge.prototype.remember = function() {
    return this.base.remember.apply(this.base, arguments)
  }

  PartialBridge.prototype.see = function() {
    return this.base.see.apply(this.base, arguments)
  }

  PartialBridge.prototype.defineSingleton = function() {
    return this.base.defineSingleton.apply(this.base, arguments)
  }

  PartialBridge.prototype.asap = function() {
    return this.base.asap.apply(this.base, arguments)
  }

  PartialBridge.prototype.noop = function() {
    return this.base.noop()
  }

  PartialBridge.prototype.getSite = function() {
    return this.base.getSite.apply(this.base, arguments)
  }

  PartialBridge.prototype.domReady = function() {
    return this.base.domReady.apply(this.base, arguments)
  }

  var interface = ["defineFunction", "remember", "see", "defineSingleton", "asap", "partial", "requestHandler", "toHtml", "script", "forResponse", "changePath", "handle", "copy", "partial", "claimIdentifier", "getSite", "domReady"]


  interface.forEach(function(method) {
    if (!PartialBridge.prototype[method]) {
      PartialBridge.prototype[method] = notWrittenYet.bind(null, method)
    }
  })

  function notWrittenYet(method) {
    throw new Error("Partial bridges don't support the "+method+" bridge method yet.")
  }

  return PartialBridge

}
