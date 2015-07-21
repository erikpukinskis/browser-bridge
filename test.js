var library = require("nrtv-library")(require)


library.test(
  "sending an element",

  ["nrtv-element", "sinon", "./server-browser-bridge"],

  function(expect, done, element, sinon, ServerBrowserBridge) {

    var bridge = new ServerBrowserBridge()

    var el = element("body", "Hello, world!")

    var middleware = bridge.sendPage(el)

    var response = {
      send: function(html) {
        console.log(html)
        expect(html).to.contain("<body>")
        expect(html).to.contain("<html>")
        expect(html).to.contain("Hello, world!")
        done()
      }
    }

    sinon.spy(response, "send")

    middleware(null, response)

    expect(response.send).to.have
      .been.called
  }
)
