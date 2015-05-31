requirejs = require("requirejs")

requirejs(
  ["nrtv-component", "bridge-tie", "nrtv-element", "chai", "sinon", "sinon-chai"],
  function(component, BridgeTie, element, chai, sinon, sinonChai) {
    var expect = chai.expect
    chai.use(sinonChai)

    var Hello = component(BridgeTie)

    var el = element("body", "Hello, world!")

    var middleware = Hello.bridge().sendPage(el)

    var response = {
      send: function(html) {
        console.log(html)
        expect(html).to.contain("<body>")
        expect(html).to.contain("<html>")
        expect(html).to.contain("Hello, world!")
      }
    }

    sinon.spy(response, "send")

    middleware(null, response)

    expect(response.send).to.have
      .been.called
  })