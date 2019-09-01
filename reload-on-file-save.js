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
          console.log("a wild connection appeared", secs())

          socket.listen(
            function(bridgeId) {
              console.log("a message from the browser? "+bridgeId, secs())
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

      function stopWatching(bridgeId){
        console.log("someone ded", secs())
        tearDownFileWatchers(
          bridgeId)
        delete socketsByBridgeId[
          bridgeId]}

      function setUpFileWatchers(filename, bridgeId) {
        console.log("adding "+bridgeId+" to the list of watchers watching "+filename, secs())
        var bridgeIds = bridgesToNotifyByFilename[filename]

        if (!bridgeIds) {
          bridgeIds = bridgesToNotifyByFilename[filename] = {}
          var watcher = fs.watch(
            filename,
            handleFileChange.bind(
              null,
              filename))
          console.log("starting up watcher for "+filename, !!watcher, secs())
          watchersByFilename[filename] = watcher}

        bridgeIds[bridgeId] = true}

      function tearDownFileWatchers(bridgeId) {
        console.log("tearing down all watchers dependant on "+bridgeId, secs())
        for(var filename in bridgesToNotifyByFilename) {
          var bridgeIds = bridgesToNotifyByFilename[filename]
          var thisBridgeIsWatching = !!bridgeIds[bridgeId]
          if (!thisBridgeIsWatching) {
            return }

          delete(bridgeIds[bridgeId])
          console.log("Removing bridge "+bridgeId+" from watching "+filename, "there are "+Object.keys(bridgeIds)+"watchers left", secs())
          var moreBridgesWatching = Object.keys(bridgeIds).length > 0
          if (moreBridgesWatching) {
            return }

          console.log("No one left watching "+filename, secs())
          delete bridgesToNotifyByFilename[filename]
          var watcher = watchersByFilename[filename]
          if (!watcher) {
            console.log("No watcher for "+filename+"? weird.", secs())
            return }

          watcher.close()}}


      console.log("getting through the file", secs())
      var waitingForLoad = []

      function onLoad(callback) {
        waitingForLoad.push(callback)
        console.log("now there are "+waitingForLoad.length+" callbacks waiting for a load", !!callback, secs())
      }

      function aWildBrowserAppeared(bridgeId) {
        var callbacks = waitingForLoad
        console.log("A wild browser appeared!", bridgeId, "Calling", (callbacks ? callbacks.length : 0), "callbacks", secs())

        waitingForLoad = []
        callbacks.forEach(call)}

      function call(x) {
        x()}

      function handleFileChange(filename) {
        var bridgeIds = bridgesToNotifyByFilename[filename]

        console.log("\na wild file change appeared! in "+filename, secs())
        console.log(" - there are "+Object.keys(bridgeIds).length+" bridges to notify", secs(), "\n")

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

    return configureReloadOnFileSave
  }
)