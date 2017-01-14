var library = require("module-library")(require)

module.exports = library.export(
  "partial-bridge",
  function() {

    // Partial

    function PartialBridge(base) {
      this.base = base
      base.partials.push(this)
      this.head = ""
      this.__isNrtvBrowserBridge = true
    }

    PartialBridge.prototype.send = function(content) {
      this.content = content
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
      this.base.defineFunction.apply(this.base, arguments)
    }

    var interface = ["collective", "copy", "partial", "sendPage", "requestHandler", "toHtml", "script", "asap", "defineSingleton", "forResponse", "changePath", "handle", "copy", "partial", "remember", "see"]


    interface.forEach(function(method) {
      PartialBridge.prototype[method] = notWrittenYet.bind(null, method)
    })

    function notWrittenYet(method) {
      throw new Error("Partial bridges don't support the "+method+" bridge method yet.")
    }

    return PartialBridge

  }
)