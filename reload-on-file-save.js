var library = require("module-library")(require)

module.exports = library.export(
  "browser-bridge/reloadOnFileSave",[
   "fs", "path", "get-socket"],
  function(fs, path, getSocket) {

    var socketsByBridgeId = {}
    var bridgesToNotifyByFilename = {}
    var bridgeIdsWaitingForReload = {}

    return function configureReloadOnFileSave(BrowserBridge) {
      BrowserBridge.prototype.reloadOnFileSave = reloadOnFileSave
      BrowserBridge.prototype.onLoad = onLoad
    }

    function reloadOnFileSave(dirname, pathToFile, site) {
          var bridge = this
          var filename = path.join(dirname, pathToFile)
          console.log("setting up bridge "+this.id+" and site "+site.id, secs())
          setUpFileWatchers(filename, bridge.id)
          setUpBridgeReloaders(bridge)
          setUpSiteReloaders(site)}

      function setUpBridgeReloaders(bridge) {
        if (bridge.remember(
          "browser-bridge/listeningForReload")) {
            return}

        bridge.asap([
          getSocket.defineOn(bridge),
          bridge.id],
          function(getSocket, bridgeId) {
            console.log("ok getting started on the client!", secs())
            var socket = getSocket(
              function(socket) {
                console.log("connected", secs())
                socket.listen(
                  handleIt)
                socket.send(bridgeId)
              })

            function secs() {
              var now = new Date()
              return "(( "+now.getSeconds()+""+parseInt(now.getMilliseconds()/100)+" ))"}

            function handleIt(filename) {
              console.log("got a message:"+filename, secs())
              location.reload()}
          })

        bridge.see(
          "browser-bridge/listeningForReload",
          true)}


      function secs() {
        var now = new Date()
        return "(( "+now.getSeconds()+""+parseInt(now.getMilliseconds()/100)+" ))"}

      function setUpSiteReloaders(site) {
        if (site.remember(
          "browser-bridge/notifyReloadListeners")) {
            return}
            
        getSocket.handleConnections(
          site,
          function(socket) {
            console.log("a wild connection appeared", secs())

            socket.listen(
              function(bridgeId) {
                console.log("a message from the browser? "+bridgeId, secs())
                socketsByBridgeId[
                  bridgeId] = socket

                console.log("somehow at this point tell the test to retry.")

                aWildBrowserAppeared(bridgeId)

                socket.onClose(
                  function(){

                    console.log("someone ded", secs())
                    delete socketsByBridgeId[
                      bridgeId]})
              })

          })}

      function setUpFileWatchers(filename, bridgeId) {
          var bridgeIds = bridgesToNotifyByFilename[filename]

          if (!bridgeIds) {
            bridgeIds = bridgesToNotifyByFilename[filename] = {}
            fs.watchFile(
              filename,
              handleFileChange.bind(
                null,
                filename))}

          bridgeIds[bridgeId] = true}


      function onLoad(callback) {
        var bridge = this
        var callbacks = bridgeIdsWaitingForReload[bridge.id]

        if (!callbacks) {
          callbacks = bridgeIdsWaitingForReload[bridge.id] = []
        }

        callbacks.push(
          callback)
        console.log("now there are "+callbacks.length+" callbacks waiting on "+bridge.id, "added one?", !!callback, secs())
      }

      function aWildBrowserAppeared(bridgeId) {
        var callbacks = bridgeIdsWaitingForReload[bridgeId]

        console.log("A wild browser appeared!", bridgeId, "Calling", (callbacks ? callbacks.length : 0), "callbacks", secs())
        if (!callbacks) {
          return }
        bridgeIdsWaitingForReload[
          bridgeId] = []
        callbacks.forEach(call)}

      function call(x) {
        x()}

      function handleFileChange(filename) {
        console.log("a wild file change appeared! in "+filename, secs())


        var bridgeIds = bridgesToNotifyByFilename[filename]

        for(var bridgeId in bridgeIds) {
          console.log("maybe bridge", bridgeId, "wants it?", secs())
          var socket = socketsByBridgeId[bridgeId]

          // If socket is closed, stop looking for it when this file changes
          if (!socket) {
            console.log("that bird is no more")
            delete bridgeIds[bridgeId]
            return}

          console.log("ya lezdoit")

          socket.send(
            "yo file changed")}}

    return reloadOnFileSave
  }
)