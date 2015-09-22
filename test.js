var library = require("nrtv-library")(require)

// library.test.only("getting evalable javascript references")

library.test(
  "sending an element",

  ["nrtv-element", "sinon", "./browser-bridge"],

  function(expect, done, element, sinon, BrowserBridge) {

    done.failAfter(3000)
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


function greet(name) {
  alert("hi, "+name)
}


library.test(
  "getting evalable javascript references",

  ["./browser-bridge"],
  function(expect, done, BrowserBridge) {
    var bridge = new BrowserBridge()

    var boundFunction = bridge.defineOnClient(greet)

    var greetErik = boundFunction.withArgs("Erik")

    expect(greetErik.evalable()).to.match(/"Erik"/)

    expect(bridge.script()).to.contain(greetErik.binding.key)

    expect(bridge.script()).to.match(/function .*(name)/)

    done()
  }
)


library.test(
  "arguments can be undefined",

  ["./browser-bridge"],
  function(expect, done, BrowserBridge) {
    var bridge = new BrowserBridge()

    var boundFunction = bridge.defineOnClient(greet)

    var source = boundFunction.withArgs(undefined, {}).evalable()

    expect(source).to.contain("undefined,{}")

    done()
  }
)


library.test(
  "client functions can use other client functions",

  ["nrtv-element", "./browser-bridge", "nrtv-server", "nrtv-browse"],
  function(expect, done, element, BrowserBridge, Server, browse) {

    done.failAfter(4000)

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

    browse("http://localhost:6676", function(browser) {

        browser.pressButton(
          "button",
          function() {
            server.stop()
            browser.assert.text(".out", "foo 3 rabbit")
            done()
          }
        )

      }
    )
  }
)



library.test(
  "Use static methods to do stuff with the collective bridge",

  ["./browser-bridge"],
  function(expect, done, BrowserBridge) {

    BrowserBridge.defineOnClient(function brussels() {}
    )

    BrowserBridge.defineOnClient(
      function sprouts() {}
    )

    var response = {
      send: function(html) {
        expect(html).to.contain("brussels")
        expect(html).to.contain("sprouts")
        done()
      }
    }

    BrowserBridge.sendPage()(null, response)
  }
)




library.test(
  "sending responses to the client bridge evaluates them",

  ["./browser-bridge", "nrtv-element", "nrtv-server", "nrtv-browse"],
  function(expect, done, BrowserBridge,   element, Server, browse) {
    var bridge = new BrowserBridge()

    var whatever = bridge.defineOnClient(
      function(name) {
        document.write(name)
      }
    )

    var applyBinding = bridge.defineOnClient(
      function(binding) {
        bridge.handle(binding)
      }
    )

    var binding = whatever.withArgs("ted").ajaxResponse()

    var button = element(
      "button",
      "Buttoon", {
      onclick: applyBinding.withArgs(binding).evalable()
    })

    var server = new Server()

    server.get(
      "/",
      bridge.sendPage(button)
    )

    server.start(10101)

    browse("http://localhost:10101",
      function(browser) {

        browser.pressButton(
          "button", 
          function() {
            server.stop()
            browser.assert.text(
              "body", "ted"
            )
            done()
          }
        )

      }
    )
  }
)


library.test(
  "other functions can be passed as arguments",

  ["./browser-bridge", "nrtv-element", "nrtv-server", "nrtv-browse"],

  function(expect, done, BrowserBridge,   element, Server, browse) {

    var bridge = new BrowserBridge()

    var overwrite = bridge.defineOnClient(
      function(getWords) {
        document.write(getWords() + " are words")
      }
    )

    var someWords = bridge.defineOnClient(
      function() {
        return "bird, cat, and fish"
      }
    )

    var button = element(
      "button",
      "Write stuff!", {
      onclick: overwrite.withArgs(someWords).evalable()
    })

    var server = new Server()

    server.get(
      "/",
      bridge.sendPage(button)
    )

    server.start(7662)

    browse("http://localhost:7662",
      function(browser) {

        browser.pressButton(
          "button",
          function() {
            server.stop()
            browser.assert.text(
              "body", "bird, cat, and fish are words"
            )
            done()
          }
        )

      }
    )
  }
)


library.test(
  "client functions can have collectives",

  ["./browser-bridge", "nrtv-server", "nrtv-browse", "nrtv-element"],
  function(expect, done, BrowserBridge, Server, browse, element) {

    var increment = BrowserBridge.defineOnClient(

      [BrowserBridge.collective({count: 0})],

      function inc(collective) {
        collective.count++

        document.getElementsByClassName("counter")[0].innerHTML =collective.count
      }
    )

    var button = element("button", {
      onclick: increment.evalable()
    })

    var counter = element(".counter")

    Server.get("/", BrowserBridge.sendPage([button, counter]))

    Server.start(4488)

    browse("http://localhost:4488",function(browser) {

      browser.pressButton("button",function() {

        browser.pressButton("button", function() {

          browser.assert.text(".counter", "2")

          Server.stop()
          done()
        })
      })
    })

  }
)


library.test(
  "do something on page load",

  ["./browser-bridge", library.reset("nrtv-server"), "nrtv-browse"],
  function(expect, done, BrowserBridge, Server, browse) {

    var bridge = new BrowserBridge()

    var hello = bridge.defineOnClient(
      function() {
        document.getElementsByTagName("body")[0].innerHTML = "hola"
      }
    )

    bridge.asap(hello)

    Server.get("/", bridge.sendPage())

    Server.start(9876)

    browse("http://localhost:9876",
      function(browser) {
        browser.assert.text("body", "hola")
        Server.stop()
        done()
      }
    )
  }
)

