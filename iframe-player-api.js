var calledFirst = true
function createIframePlayerAPI(iframe){
  var activeEvents = new Map()
  function subscribe(eventNames, listener){
    eventNames.split(' ').forEach(eventName=>{
      if(!activeEvents.has(eventName)){
        var {port1, port2} = new MessageChannel()
        activeEvents.set(eventName, {port: port1, listeners:[]})
        iframe.contentWindow.postMessage(
          {type:"subscribeEvent", eventName},
          iframe.src,
          [port2]
        )
        port1.onmessage = event=>{
          activeEvents.get(eventName).listeners.forEach(listener=>listener(event.data))
        }
      }
      activeEvents.get(eventName).listeners.push(listener)
    })
  }

  function reRegisterEvents(){
    activeEvents.forEach((event, eventName)=>{
      var {port1, port2} = new MessageChannel()
      event.port = port1
      iframe.contentWindow.postMessage(
        {type:"subscribeEvent", eventName},
        iframe.src,
        [port2]
      )
      port1.onmessage = event=>{
        activeEvents.get(eventName).listeners.forEach(listener=>listener(event.data))
      }
    })
  }

  function unsubscribe(eventNames, listener){
    eventNames.split(' ').forEach(eventName=>{
      var event = activeEvents.get(eventName)
      event.listeners = event.listeners.filter(lstnr=>lstnr==listener)
      if(event.listeners.length==0){
        iframe.contentWindow.postMessage(
          {type:"unsubscribeEvent", eventName},
          iframe.src
        )
        event.port.close()
        activeEvents.delete(eventName)
      }
    })
  }

  function createCommand(commandName){
    var inChannel
    var outChannel
    return function(...params){
      if(!inChannel || !outChannel){
        var {port1, port2} = new MessageChannel()
        inChannel = port1
        outChannel = port2
        iframe.contentWindow.postMessage(
          {type:"registerCommand", commandName},
          iframe.src,
          [outChannel]
        )
      }
      return new Promise((resolve,reject)=>{
        inChannel.postMessage({params})
        inChannel.onmessage = ({data})=>resolve(data)
        inChannel.onmessageerror = ({data})=>reject(data)
      })
    }
  }

  var commands = {
    //main
    play: null,
    pause: null,
    getCurrentTime: null,
    setCurrentTime: null, //time
    getStartDate: null,
    getBuffered: null,
    getPlayed: null,
    getSeekable: null,
    getDuration: null,
    getPlayerState: null,
    //controls
    showControls: null,
    hideControls: null,
    //playlist
    next: null,
    prev: null,
    playAt: null, //index
    getPlaylist: null,
    getPlaylistIndex: null,
    reload: null,
    //volume
    mute: null,
    unmute: null,
    isMuted: null,
    getVolume: null,
    setVolume: null, //volume
    //quality
    getPlaybackQuality: null,
    setPlaybackQuality: null,
    getAvailableQualityLevels: null,
  }

  return new Promise((resolve, reject)=>{
    window.addEventListener("message", event=>{
      if(event.data == "onPlayerReady" && RegExp('^'+event.origin+'*').test(iframe.src)){
        Object.keys(commands).forEach(commandName=>commands[commandName]=createCommand(commandName))
        if(calledFirst){
          calledFirst = false
          resolve(Object.assign(commands, {subscribe, unsubscribe}))
        }
        else{
          reRegisterEvents()
          iframe.dispatchEvent(new CustomEvent("iframeApiUpdated"))
        } 
      }
    })
  })

}
export {createIframePlayerAPI}