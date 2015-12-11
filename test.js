var test = require("nrtv-test")(require)
var library = require("nrtv-library")(require)

test.failAfter(10000)

// test.only("bridge handles bindings sent in AJAX responses")

test.using(
  "sending an element",

  ["nrtv-element", "sinon", "./browser-bridge"],

  function(expect, done, element, sinon, BrowserBridge) {

    done.failAfter(3000)
    var bridge = new BrowserBridge()

    var el = element("body", "Hello, world!")

    var middleware = bridge.sendPage(el)

    var response = {
      send: function(html) {
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


test.using(
  "getting evalable javascript references",

  ["./browser-bridge"],
  function(expect, done, BrowserBridge) {
    var bridge = new BrowserBridge()

    var boundFunction = bridge.defineFunction(greet)

    var greetErik = boundFunction.withArgs("Erik")

    expect(greetErik.evalable()).to.match(/"Erik"/)

    expect(bridge.script()).to.contain(greetErik.binding.identifier)

    expect(bridge.script()).to.match(/function .*(name)/)

    done()
  }
)


test.using(
  "arguments can be functions",

  ["./browser-bridge"],
  function(expect, done, BrowserBridge) {
    var bridge = new BrowserBridge()

    var takesACallback = bridge.defineFunction(
        function callIt(callback) {
          callback()
        }
      )

    var wit = takesACallback
    .withArgs(function() {
      alert("shabooya")
    })

    expect(wit.evalable()).to.match(/shabooya/)

    done()
  }
)


test.using(
  "arguments can be objects",

  ["./browser-bridge"],
  function(expect, done, BrowserBridge) {
    var bridge = new BrowserBridge()

    var boundFunction = bridge.defineFunction(function() {})

    var source = boundFunction.withArgs({a: 2, b: "hello", c: [1,"hi"]}).evalable()

    expect(source).to.contain("\"a\":2")

    done()
  }
)


test.using(
  "arguments can be undefined",

  ["./browser-bridge"],
  function(expect, done, BrowserBridge) {
    var bridge = new BrowserBridge()

    var boundFunction = bridge.defineFunction(greet)

    var source = boundFunction.withArgs(undefined, {}).evalable()

    expect(source).to.contain("undefined,{}")

    done()
  }
)


test.using(
  "client functions can use other client functions",

  ["nrtv-element", "./browser-bridge", "nrtv-server", "nrtv-browse"],
  function(expect, done, element, BrowserBridge, Server, browse) {

    done.failAfter(4000)

    var bridge = new BrowserBridge()

    var foo = bridge.defineFunction(
      function(number) {
        return "foo "+number
      }
    )

    var bar = bridge.defineFunction(
      [foo],
      function(foo, baz) {
        document.querySelectorAll(".out")[0].innerHTML = foo(3)+" "+baz
      }
    )

    var button = element("button", {onclick: bar.withArgs("rabbit").evalable()}, "Press me.")

    var server = new Server()

    server.addRoute("get", "/",
      bridge.sendPage(
        element([button, ".out"])
      )
    )

    server.start(6676)

    browse("http://localhost:6676", function(browser) {

        browser.pressButton(
          "button",
          function() {
            browser.assertText(".out", "foo 3 rabbit", server.stop, browser.done, done)
          }
        )

      }
    )
  }
)



test.using(
  "use static methods to do stuff with the collective bridge",

  ["./browser-bridge"],
  function(expect, done, bridge) {

    bridge.defineFunction(function brussels() {}
    )

    bridge.defineFunction(
      function sprouts() {}
    )

    var response = {
      send: function(html) {
        expect(html).to.contain("brussels")
        expect(html).to.contain("sprouts")
        done()
      }
    }

    bridge.sendPage()(null, response)
  }
)




test.using(
  "bridge handles bindings sent in AJAX responses",

  [library.reset("./browser-bridge"), "nrtv-element", "nrtv-server", "nrtv-browse", "nrtv-make-request"],
  function(expect, done, bridge,   element, Server, browse, makeRequest) {

    var writeName = bridge.defineFunction(
      function write(name) {
        document.write(name)
      }
    )

    var server = new Server()

    server.addRoute("get", "/whatever",
      function(x, response) {
        response.send(
          writeName
          .withArgs("ted")
          .ajaxResponse()
        )
      }
    )

    var getCommand = makeRequest
    .defineInBrowser()
    .withArgs(
      "get", "/whatever",
      bridge.handle()
    )

    var button = element(
      "button",
      "Buttoon", {
      onclick: getCommand.evalable()
    })

    server.addRoute("get", "/",
      bridge.sendPage(button)
    )

    server.start(10101)

    browse("http://localhost:10101",
      function(browser) {

        browser.pressButton(
          "button", 
          function() {
            browser.assertText(
              "body", "ted",
              server.stop,
              browser.done,
              done
            )
          }
        )

      }
    )
  }
)


test.using(
  "other functions can be passed as arguments",

  ["./browser-bridge", "nrtv-element", "nrtv-server", "nrtv-browse"],

  function(expect, done, BrowserBridge,   element, Server, browse) {

    var bridge = new BrowserBridge()

    var overwrite = bridge.defineFunction(
      function(getWords) {
        document.write(getWords() + " are words")
      }
    )

    var someWords = bridge.defineFunction(
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

    server.addRoute("get", "/",
      bridge.sendPage(button)
    )

    server.start(7662)

    browse("http://localhost:7662",
      function(browser) {

        browser.pressButton(
          "button",
          function() {
            browser.assertText(
              "body", "bird, cat, and fish are words", server.stop, browser.done, done
            )
          }
        )

      }
    )
  }
)


test.using(
  "client functions can have collectives",

  ["./browser-bridge", "nrtv-server", "nrtv-browse", "nrtv-element"],
  function(expect, done, bridge, server, browse, element) {

    var increment = bridge.defineFunction(

      [bridge.collective({count: 0})],

      function inc(collective) {
        collective.count++

        document.getElementsByClassName("counter")[0].innerHTML =collective.count
      }
    )

    var button = element("button", {
      onclick: increment.evalable()
    })

    var counter = element(".counter")

    server.addRoute("get", "/",
      bridge.sendPage([
        button,
        counter
      ])
    )

    server.start(4488)

    browse("http://localhost:4488",function(browser) {

      browser.pressButton("button",function() {

        browser.pressButton("button", function() {

          browser.assertText(".counter", "2", server.stop, browser.done, done)
        })
      })
    })

  }
)


test.using(
  "do something on page load",

  ["./browser-bridge", "nrtv-server", "nrtv-browse"],
  function(expect, done, BrowserBridge, Server, browse) {

    var server = new Server()
    var bridge = new BrowserBridge()

    var hello = bridge.defineFunction(
      function() {
        document.getElementsByTagName("body")[0].innerHTML = "hola"
      }
    )

    bridge.asap(hello)

    server.addRoute("get", "/", bridge.sendPage())

    server.start(9876)

    browse("http://localhost:9876",
      function(browser) {
        browser.assertText("body", "hola", server.stop, browser.done, done)
      }
    )
  }
)


test.using(
  "define a singleton generator",

  ["./browser-bridge", "nrtv-server", "nrtv-browse"],
  function(expect, done, BrowserBridge, Server, browse) {

    var server = new Server()
    var bridge = new BrowserBridge()

    var jump = bridge.defineFunction(
      function jump() {
        return "so high!"
      }
    )

    var random = bridge.defineSingleton(
      "rando",
      [jump],
      function(jump) {
        jump()
        return "gonzo"
      }
    )

    var check = bridge.defineFunction(
      [random],
      function checkSingleton(random) {
        if (random != "gonzo") {
          throw new Error("expected rando to be gonzo")
        }
      }
    )

    bridge.asap(check)

    server.addRoute("get", "/", bridge.sendPage())
    server.start(7000)

    browse("http://localhost:7000",
      function(browser) {
        server.stop()
        browser.done()
        done()
      }
    )
  }
)

test.using(
  "send a body",

  ["./browser-bridge", "nrtv-element"],
  function(expect, done, BrowserBridge, element) {

    var bridge = new BrowserBridge()

    var handler = bridge.sendPage(
      element("body", {up: "down"})
    )

    var response = {
      send: function(content) {
        console.log(content)
        expect(content).to.not.match(/<body>/)
        done()
      }
    }

    handler(null, response)
  }
)
