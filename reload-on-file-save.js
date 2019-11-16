var library = require("module-library")(require)

module.exports = library.export(
  "browser-bridge/reloadOnFileSave",[
   "fs", "path", "get-socket"],
  function(fs, path, getSocket) {


    // OK, this is sort of working, but really we shouldn't be tracking reloaders by bridgeId, we should be tracking them by connection. Waugh waugh.

    // But the onLoad I think can be by bridgeId since we're really just using that for this little test check.

    var socketsByBridgeId = {}
    var bridgesToNotifyByFilename = {}
    var watchersByFilename = {}

    function configureReloadOnFileSave(BrowserBridge) {
      BrowserBridge.enableReload = setUpSiteReloaders
      BrowserBridge.prototype.reloadOnFileSave = reloadOnFileSave
      BrowserBridge.onLoad = onLoad
    }

    function setUpSiteReloaders(site) {
      if (site.remember(
        "browser-bridge/notifyReloadListeners")) {
          return}
          
      getSocket.handleConnections(
        site,
        function(socket) {
          console.log("👀 A wild connection appeared", secs())

          socket.listen(
            function(bridgeId) {
              socketsByBridgeId[
                bridgeId] = socket

              aWildBrowserAppeared(bridgeId)

              socket.onClose(
                stopWatching.bind(
                  null,
                  bridgeId))})

        })}

    function reloadOnFileSave(dirname, pathToFile) {
          var bridge = this

          if (!bridge.response) {
            throw new Error("Trying to reload bridge "+bridge.id+" on "+pathToFile+" save, but it's a root bridge. That's probably not what you want... this bridge could be used for many requests, and we won't be able to track which ones are still waiting and which ones have moved on. Try...\n\n   var bridge = baseBridge.forResponse(response)\n    bridge.reloadOnFileSave(__dirname, \"/path/to/your/file\")\n")}

          var filename = path.join(dirname, pathToFile)
          setUpFileWatchers(filename, bridge.id)
          setUpBridgeReloaders(bridge)}

      function setUpBridgeReloaders(bridge) {
        if (bridge.remember(
          "browser-bridge/listeningForReload")) {
            return}

        bridge.asap([
          getSocket.defineOn(bridge),
          bridge.id],
          function(getSocket, bridgeId) {
            var socket = getSocket(
              function(socket) {
                socket.listen(
                  handleIt)
                socket.send(bridgeId)
              })

            function secs() {
              var now = new Date()
              return "(( "+now.getSeconds()+""+parseInt(now.getMilliseconds()/100)+" ))"}

            function handleIt(message) {
              if (message != "yo file changed"){
                throw new Error("We are listening for a notification that some file changed and we should reload, but got message: "+message)
              }
              location.reload()}
          })

        bridge.see(
          "browser-bridge/listeningForReload",
          true)}


      function secs() {
        return ""
        var now = new Date()
        return "(( "+now.getSeconds()+""+parseInt(now.getMilliseconds()/100)+" ))"}

      function stopWatching(bridgeId){
        console.log("👀 Websocket connection is done", secs())
        tearDownFileWatchers(
          bridgeId)
        delete socketsByBridgeId[
          bridgeId]}

      function setUpFileWatchers(filename, bridgeId) {
        console.log("👀 Adding "+bridgeId+" to the list of watchers watching "+filename, secs())
        var bridgeIds = bridgesToNotifyByFilename[filename]

        if (!bridgeIds) {
          bridgeIds = bridgesToNotifyByFilename[filename] = {}
          var watcher = fs.watch(
            filename,
            handleFileChange.bind(
              null,
              filename))
          console.log("👀 Starting up watcher for "+filename, !!watcher, secs())
          watchersByFilename[filename] = watcher}

        bridgeIds[bridgeId] = true}

      function tearDownFileWatchers(bridgeId) {
        console.log("👀 Tearing down all watchers dependant on "+bridgeId, secs())
        for(var filename in bridgesToNotifyByFilename) {
          var bridgeIds = bridgesToNotifyByFilename[filename]
          var thisBridgeIsWatching = !!bridgeIds[bridgeId]
          if (!thisBridgeIsWatching) {
            return }

          delete(bridgeIds[bridgeId])
          console.log("👀 Removing bridge "+bridgeId+" from watching "+filename, "\n ... there are "+Object.keys(bridgeIds).length+" watchers left", secs())
          var moreBridgesWatching = Object.keys(bridgeIds).length > 0
          if (moreBridgesWatching) {
            return }

          console.log("👀 No one left watching "+filename, secs())
          delete bridgesToNotifyByFilename[filename]
          var watcher = watchersByFilename[filename]
          if (!watcher) {
            throw new Error("No watcher for "+filename+"? weird.")}

          watcher.close()}}

      var waitingForLoad = []

      function onLoad(callback) {
        if (typeof callback != "function") {
          throw new Error("Callback is not a callback")}
        waitingForLoad.push(callback)
        console.log("👀 "+waitingForLoad.length+" callbacks waiting for a load", secs())
      }

      function aWildBrowserAppeared(bridgeId) {
        var callbacks = waitingForLoad
        console.log("👀 A wild browser appeared!", bridgeId, "Calling", (callbacks ? callbacks.length : 0), "callbacks", secs())

        waitingForLoad = []
        callbacks.forEach(call)}

      function call(x) {
        x()}

      function handleFileChange(filename) {
        var bridgeIds = bridgesToNotifyByFilename[filename]

        console.log("👀 A wild file change appeared! in "+filename, secs())
        console.log(" ... there are "+Object.keys(bridgeIds).length+" bridges to notify", secs())

        for(var bridgeId in bridgeIds) {
          console.log("👀 Maybe bridge", bridgeId, "wants it?", secs())
          var socket = socketsByBridgeId[bridgeId]

          // If socket is closed, stop looking for it when this file changes
          if (!socket) {
            console.log("👀 That bridge is no longer connected. Weird.")
            delete bridgeIds[bridgeId]
            return}

          console.log("👀 Telling "+bridgeId+" to reload...")

          socket.send(
            "yo file changed")}}

    return configureReloadOnFileSave
  }
)