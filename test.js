var runTest = require("run-test")(require)

// runTest.only(
//   "hot reloading")


runTest(
  "hot reloading",
  ["./", "web-site", "browser-task", "fs"],
  function(expect, done, BrowserBridge, WebSite, browserTask, fs) {

    done.failAfter(5000)

    var loadCount = 0
    var site = new WebSite()

    var baseBridge = new BrowserBridge()

    BrowserBridge.enableReload(site)

    site.addRoute(
      "get",
      "/",
      function(request, response) {
        loadCount++
        var bridge = baseBridge.forResponse(response)

        bridge.reloadOnFileSave(
          __dirname, "date.TEST")

        bridge.send(
          "Loaded "+loadCount+" times")})

    site.start(8008)

    BrowserBridge.onLoad(
      function() {
        var timestamp = new Date()
        .valueOf()

        BrowserBridge.onLoad(
          expectTwoLoads)

        fs.writeFile(
          "date.TEST",
          timestamp,
          function() {})})

    var waitingForReload = false

    var browser = browserTask(
      "http://localhost:8008",
      function() {})

    function expectTwoLoads() {
      expect(loadCount).to.equal(2)
      browser.done()
      site.stop()
      done()}
  })


  function sequence() {
    var handlers = arguments
    var begin = function beginSequence(done){
      if (typeof done != "function") {
        return }
      tryToBeDone(
        handlers,
        0,
        done)}
    return begin}
    
  function tryToBeDone(handlers, doneCount, done) {
    var handler = handlers[
      doneCount]
    if (!handler) {
      done()
      return}
    var tryAgain = tryToBeDone.bind(
      handlers,
      doneCount + 1,
      done)
    handler(
      tryAgain)}

runTest(
  "defining functions with strings",
  ["./", "web-element"],
  function(expect, done, BrowserBridge, element) {

    var bridge = new BrowserBridge()

    var func = bridge.defineFunction("hi", 
      bridge.rawSource("function() { return true }"))

    expect(bridge.script()).to.contain("function hi")
    done()
  }
)



runTest(
  "partials have everything bridges do",
  ["."],
  function(expect, done, BrowserBridge) {
    var keys = Object.keys(BrowserBridge.prototype)
    var partial = new BrowserBridge().partial()

    keys.forEach(function(key) {
      if (typeof partial[key] == "undefined") {
        throw new Error("Partial bridge doesn't have "+key)
      }
    })

    var one = partial.defineFunction(function one() {})

    var two = partial.defineFunction(
      [one],
      function two() {}
    )

    expect(two.withArgs(partial.event).evalable()).to.equal("two(event)")

    done()
  }
)


runTest(
  "sending an element",

  ["web-element", "sinon", "./"],

  function(expect, done, element, sinon, BrowserBridge) {

    var bridge = new BrowserBridge()

    var el = element("body", "Hello, world!")

    var middleware = bridge.requestHandler(el)

    var response = {
      send: function(html) {
        expect(html).to.contain("<body")
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


runTest(
  "getting evalable javascript references",

  ["./"],
  function(expect, done, BrowserBridge) {
    var bridge = new BrowserBridge()

    var boundFunction = bridge.defineFunction(greet)

    var greetErik = boundFunction.withArgs("Erik")

    expect(greetErik.evalable()).to.match(/"Erik"/)

    expect(bridge.script()).to.match(/function greet\(name\)/)
    done()
  }
)


runTest(
  "arguments can be functions",

  ["./"],
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


runTest(
  "arguments can be objects",

  ["./"],
  function(expect, done, BrowserBridge) {
    var bridge = new BrowserBridge()

    var boundFunction = bridge.defineFunction(function() {})

    var source = boundFunction.withArgs({a: 2, b: "hello", c: [1,"hi"]}).evalable()

    expect(source).to.contain("\"a\": 2")

    done()
  }
)


runTest(
  "arguments can be undefined",

  ["./"],
  function(expect, done, BrowserBridge) {
    var bridge = new BrowserBridge()

    var boundFunction = bridge.defineFunction(greet)

    var source = boundFunction.withArgs(undefined, {}).evalable()

    expect(source).to.contain("undefined, {}")

    done()
  }
)


runTest(
  "partials can be loaded via POST",
  ["web-element", "./", "web-site", "browser-task"],
  function(expect, done, element, BrowserBridge, WebSite, browserTask) {

    var baseBridge = new BrowserBridge()

    var loadMore = baseBridge.defineFunction([
      baseBridge.loadPartial.asCall()],
      function(loadPartial) {
        loadPartial({
          "method": "post",
          "path": "/floobies",
          "data": {
            "name": "Tarl"}},
          ".feed")
      })

    baseBridge.asap(loadMore)

    var site = new WebSite()

    baseBridge.cache()

    site.addRoute(
      "get",
      "/",
      baseBridge.requestHandler("ok!"))

    site.addRoute(
      "post",
      "/floobies",
      function(request, response) {

        var bridge = BrowserBridge.fromRequest(request).forResponse(response)

        var name = request.body.name

        bridge.sendPartial(element(".hi", "Your name is "+name))
      })

    site.start(1919)

    var browser = browserTask(
      "http://localhost:1919",
      checkForTarl)

    function checkForTarl() {
      debugger
      browser.assertText(
        ".hi",
        "Your name is Tarl",
        site.stop,
        browser.done,
        done)}
  })





runTest(
  "partial bridges can be added to an existing page",
  ["web-element", "./", "web-site", "browser-task"],
  function(expect, done, element, BrowserBridge, WebSite, browserTask) {

    var baseBridge = new BrowserBridge()

    var foo = baseBridge.defineFunction(
      function(number) {
        return "foo "+number
      }
    )

    var loadMore = baseBridge.defineFunction([
      baseBridge.loadPartial.asCall()],
      function(loadPartial) {
        loadPartial(
          "/more",
          ".partial-target")})

    var button = element("button", {onclick: loadMore.evalable()}, "More")

    var site = new WebSite()

    baseBridge.cache()

    site.addRoute("get", "/",
      baseBridge.requestHandler(
        element([button, ".partial-target"])
      )
    )

    site.addRoute("get", "/more",
      function(request, response) {
        var partial = BrowserBridge.fromRequest(request).forResponse(response)

        var more = element([
          "partial content",
          ".script-target"])

        partial.asap(
          function() {
            document.querySelector(".script-target").innerText = "asap text"
          })

        partial.sendPartial(more)
      })

    site.start(5111)

    var browser = browserTask("http://localhost:5111", function() {
      browser.pressButton("button", checkPartialText)
    })

    function checkPartialText() {
      browser.assertText(".partial-target", "partial content", checkScriptText)
    }

    function checkScriptText() {
      browser.assertText(".script-target", "asap text", site.stop, browser.done, done)
    }

  }
)





runTest(
  "client functions can use other client functions",

  ["web-element", "./", "web-site", "browser-task"],
  function(expect, done, element, BrowserBridge, WebSite, browserTask) {

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

    var site = new WebSite()

    site.addRoute("get", "/",
      bridge.requestHandler(
        element([button, ".out"])
      )
    )

    site.start(6676)

    var browser = browserTask("http://localhost:6676", function() {
      browser.pressButton("button", checkText)
    })

    function checkText() {
      browser.assertText(".out", "foo 3 rabbit", site.stop, browser.done, done)
    }

  }
)





runTest(
  "bridge.requestHandler passes along javascript",

  ["./"],
  function(expect, done, BrowserBridge) {

    var bridge = new BrowserBridge()

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

    bridge.requestHandler()(null, response)
  }
)


runTest(
  "singleton source",
  ["./", "browser-bridge"],
  function(expect, done, bridgeModule, BrowserBridge) {

    var bridge = new BrowserBridge()

    binding = bridge.defineSingleton(
      "program", function () {
      return true
    })

    expect(bridge.script()).to.contain("var program = (function () {\n  return true\n}).call()")
    done()
  }
)



runTest(
  "send a body",

  ["./", "web-element"],
  function(expect, done, BrowserBridge, element) {

    var bridge = new BrowserBridge()

    var handler = bridge.requestHandler(
      element("body", {up: "down"})
    )

    var response = {
      send: function(content) {
        expect(content).to.not.match(/<body>/)
        done()
      }
    }

    handler(null, response)
  }
)

runTest(
  "adding styles",
  ["./", "web-element"],
  function(expect, done, BrowserBridge, element) {

    var bridge = new BrowserBridge()

    var bright = element.style(
      ".bright",
      {color: "cyan"}
    )

    bridge.addToHead(element.stylesheet(bright).html())

    var html = bridge.toHtml().replace(/\r?\n|\r/gm, "")

    expect(html).to.match(/<head>.*\.bright {.*\<\/head>/)

    done()
  }
)

runTest(
  "detecting duplicate definitions",

  ["./"],

  function(expect, done, BrowserBridge) {
    var bridge = new BrowserBridge()

    function splendid() {
      log("I love being bathed in the sink!")
    }

    bridge.defineFunction(splendid)

    try {
      bridge.defineFunction(splendid)
    } catch (e) {
      done()
      return
    }

    throw new Error("Was able to define a function twice")
  }
)


function BODY(func) {
  var lines = func.toString().split("\n")
  return lines.slice(1, lines.length - 1 ).join("\n").trim()
}

runTest(
  "dependencies get pre-bound",
  ["./"],
  function(expect, done, BrowserBridge) {

    var bridge = new BrowserBridge()

    var noDeps = bridge.defineFunction(function noDeps(x) {

    })

    expect(bridge.script()).to.contain("\nfunction noDeps(x) {\n\n}")


    bridge.defineFunction([noDeps], function hasDeps(x) {
      x()
    })

    expect(bridge.script()).to.contain("var hasDeps = (function hasDeps(x) {\n  x()\n}).bind(null, noDeps)")

    var argless = bridge.defineSingleton("arglessSingleton", function() {
        return 1
      })


    expect(bridge.script()).to.contain("var arglessSingleton = (function() {\n  return 1\n}).call()")

    bridge.defineSingleton("singleton",
      [argless],
      function(argless) {
        return 2
      }
    )
    console.log("\n\n\n--------------\nSAMPLE SOURCE:\n"+bridge.script()+"\n--------------\n\n\n")

    expect(bridge.script()).to.contain("var singleton = (function(argless) {\n  return 2\n}).call(null, arglessSingleton)")

    done()
  }
)


runTest(
  "copy a bridge",
  ["./"],
  function(expect, done, BrowserBridge) {
    var base = new BrowserBridge()
    var hi = base.defineFunction(
      function hi() {
        return "hello"
      }
    )

    var copy = base.copy()
    copy.defineFunction(
      [hi],
      function(hi) {
        return hi+", human"
      }
    )

    expect(copy.script()).to.contain("hello")

    expect(base.script()).not.to.contain("human")

    done()
  }
)



runTest(
  "pre-bind response",
  ["./", "sinon"],
  function(expect, done, BrowserBridge, sinon) {
    var response = {
      send: sinon.spy()
    }

    var bridge = new BrowserBridge().forResponse(response)

    bridge.send()

    expect(response.send).to.have.been.called

    done()
  }
)


runTest("domReady")



// Browser tests:


runTest(
  "remember bindings in the browser")
//   ["./", "browser-task", "web-site"],
//   function(expect, done, BrowserBridge, browserTask, WebSite) {

//     var site = new WebSite()

//     var bridge = new BrowserBridge()

//     var names = bridge.defineFunction(function names() { return ["Old Scratch", "Prince of Darkness", "Beelzebub"] })

//     bridge.see("some-names", names)

//     bridge.asap(
//       [bridge.asCall()],
//       function(bridge) {
//         var memory = bridge.remember("some-names")
//         var name = eval(memory.evalable())[1]
//         document.write(name)
//       }
//     )

//     site.addRoute("get", "/", bridge.requestHandler())

//     site.start(9881)

//     browserTask(
//       "http://localhost:9881",
//       function(browser) {
//         browser.assertText("body", "Prince", site.stop, browser.done, done)
//       }
//     )

//   }
// )


runTest(
  "do something on page load",

  ["./", "web-site", "browser-task"],
  function(expect, done, BrowserBridge, WebSite, browserTask) {

    var site = new WebSite()
    var bridge = new BrowserBridge()

    bridge.domReady(function hello() {
      document.getElementsByTagName("body")[0].innerHTML = "hola"
    })

    site.addRoute("get", "/", bridge.requestHandler())

    site.start(9876)

    browserTask("http://localhost:9876",
      function(browser) {
        browser.assertText("body", "hola", site.stop, browser.done, done)
      }
    )
  }
)


runTest(
  "bridge handles bindings sent in AJAX responses",

  ["./", "web-element", "web-site", "browser-task", "make-request"],
  function(expect, done, BrowserBridge,   element, WebSite, browserTask, makeRequest) {

    var bridge = new BrowserBridge()

    var writeName = bridge.defineFunction(
      function write(name) {
        document.write(name)
      }
    )

    var site = new WebSite()

    site.addRoute("get", "/whatever",
      function(x, response) {
        response.send(
          writeName
          .withArgs("ted")
          .ajaxResponse()
        )
      }
    )

    var getCommand = makeRequest
    .defineOn(bridge)
    .withArgs(
      "get", "/whatever",
      bridge.handle()
    )

    var button = element(
      "button",
      "Buttoon", {
      onclick: getCommand.evalable()
    })

    site.addRoute("get", "/",
      bridge.requestHandler(button)
    )

    site.start(10101)

    // throw new Error("there's a race condition here. sometimes we still see Buttoon by the time we do our assertion")

    var browser = browserTask("http://localhost:10101", pressIt)

    function pressIt() {
      browser.pressButton("button", checkForTed)
    }

    function checkForTed() {
      browser.assertText(
        "body", "ted",
        site.stop,
        browser.done,
        done
      )
    }

  }
)


runTest(
  "other functions can be passed as arguments",

  ["./", "web-element", "web-site", "browser-task"],

  function(expect, done, BrowserBridge,   element, WebSite, browserTask) {

    var bridge = new BrowserBridge()

    var overwrite = bridge.defineFunction(
      function overwrite(getWords) {
        document.write(getWords() + " are words")
      }
    )

    var getWords = bridge.defineFunction(
      function getWords() {
        return "bird, cat, and fish"
      }
    )

    var button = element(
      "button",
      "Write stuff!", {
      onclick: overwrite.withArgs(getWords).evalable()
    })

    var site = new WebSite()

    site.addRoute("get", "/",
      bridge.requestHandler(button)
    )

    site.start(7662)

    browserTask("http://localhost:7662",
      function(browser) {

        browser.pressButton(
          "button",
          function() {
            browser.assertText(
              "body", "bird, cat, and fish are words", site.stop, browser.done, done
            )
          }
        )

      }
    )
  }
)


runTest(
  "headers",
  ["./"],
  function(expect, done, BrowserBridge) {

    var baseBridge = new BrowserBridge()

    var ok
    bridge = baseBridge.forResponse({
      set: function() {
        ok = "yes" },
      send: function() {}})

    bridge.addHeaders({"Foo": "bar"})

    bridge.send("great")

    expect(ok).to.equal("yes")
    done()
  }
)



runTest(
  "define a singleton generator",

  ["./", "web-site", "browser-task"],
  function(expect, done, BrowserBridge, WebSite, browserTask) {

    var site = new WebSite()
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

    site.addRoute("get", "/", bridge.requestHandler())
    site.start(7000)

    browserTask("http://localhost:7000",
      function(browser) {
        site.stop()
        browser.done()
        done()
      }
    )
  }
)


