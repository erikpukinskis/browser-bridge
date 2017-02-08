var library = require("module-library")(require)

module.exports = library.export(
  "partial-bridge",
  ["web-element"],
  function(element) {

    // Partial

    function PartialBridge(base) {
      this.id = "partial-"+Math.random().toString(36).substr(2,4)+"-on-"+base.id
      this.base = base
      base.partials.push(this)
      this.head = ""
      this.__isNrtvBrowserBridge = true
    }

    PartialBridge.prototype.send = function(content) {
      this.content = content
    }

    PartialBridge.prototype.partial = function() {
      return this.base.partial()
    }

    PartialBridge.prototype.forResponse = function(response) {
      return this.base.forResponse(response)
    }

    PartialBridge.prototype.changePath = function(path) {
      this.__changedPath = path
    }

    // This is so this can be embedded as an element
    PartialBridge.prototype.html = function() {
      if (this.content.html) {
        return this.content.html()
      } else {
        return element(this.content).html()
      }
    }

    PartialBridge.prototype.addToHead = function(content) {
      if (typeof content.html == "function") {
        content = content.html()
      }
      this.head += content
    }

    PartialBridge.prototype.defineFunction = function() {
      return this.base.defineFunction.apply(this.base, arguments)
    }

    PartialBridge.prototype.remember = function() {
      return this.base.remember.apply(this.base, arguments)
    }

    PartialBridge.prototype.claimIdentifier = function(name) {
      this.base.claimIdentifier(name)
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

    var interface = ["defineFunction", "remember", "see", "defineSingleton", "asap", "collective", "partial", "requestHandler", "toHtml", "script", "forResponse", "changePath", "handle", "copy", "partial", "claimIdentifier"]


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
)