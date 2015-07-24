var library = require("nrtv-library")(require)


library.test(
  "sending an element",

  ["nrtv-element", "sinon", "./browser-bridge"],

  function(expect, done, element, sinon, BrowserBridge) {

    var bridge = new BrowserBridge()

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

library.test(
  "has a collective",
  ["./browser-bridge"],
  function(expect, done, BrowserBridge) {
    var bridge = BrowserBridge.collective()

    expect(bridge.sendPage).to.be.a("function")
    done()
  }
)

library.test(
  "getting evalable javascript references",
  ["./browser-bridge"],
  function(expect, done, BrowserBridge) {
    var bridge = new BrowserBridge()

    function greet(name) {
      alert("hi, "+name)
    }

    var boundFunction = bridge.defineOnClient(greet)

    var greetErik = boundFunction.withArgs("Erik")

    expect(greetErik.evalable()).to.match(/\["Erik"\]/)

    expect(bridge.script()).to.contain(greetErik.binding.key)

    expect(bridge.script()).to.contain("function greet(name)")

    done()
  }
)

library.test(
  "client functions can use other client functions",
  ["nrtv-element", "./browser-bridge", "nrtv-server", "nrtv-browse"],
  function(expect, done, element, BrowserBridge, Server, browse) {

    var bridge = new BrowserBridge()

    var foo = bridge.defineOnClient(
      function(number) {
        return "foo "+number
      }
    )

    var bar = bridge.defineOnClient(
      [foo],
      function(foo, baz) {
        document.querySelectorAll(".out")[0].innerHTML = foo(3)+" "+baz
      }
    )

    var button = element("button", {onclick: bar.withArgs("rabbit").evalable()}, "Press me.")

    var server = new Server()

    server.get(
      "/",
      bridge.sendPage(
        element([button, ".out"])
      )
    )

    server.start(6676)

    var browser = browse(6676)

    browser.visit("/", function() {
      browser.pressButton(
        "button",
        function() {
          server.stop()
          browser.assert.text(".out", "foo 3 rabbit")
          done()
        }
      )
    })
  }
)

