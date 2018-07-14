import {iframe, audio} from "./common.js"
import {userEvents, userDelay, info} from "./controls.js"
import * as radio from "./radio.js"
import * as tv from "./tv.js"

async function sync(diff){
  audio.pause()
  await iframeApi.pause()
  var [videoBufferEnd, videoPlayedStart] = await Promise.all([
    iframeApi.getSeekable().then(Seekable=>Seekable[Seekable.length-1].end),
    iframeApi.getPlayed().then(played=>played[0].start)
  ])
  var videoMax = videoBufferEnd*1000
  var audioMax = audio.buffered.end(0)*1000
  var videoEnd = iframe.startDate + videoMax
  var audioEnd = audio.startDate + audioMax
  diff = diff*1000 + (videoEnd-audioEnd)
  if(diff>0){
    var videoTime = (videoMax - diff)/1000
    var audioTime = (audioMax)/1000
  }
  else{
    var videoTime = (videoMax)/1000
    var audioTime = (audioMax + diff)/1000
  }
  return new Promise((resolve, reject) => {
    if(videoTime>videoPlayedStart && audioTime>audio.played.start(0)){
      iframeApi.setCurrentTime(videoTime)
      audio.currentTime = audioTime
      iframeApi.play()
      .then(()=>{
        audio.play()
        resolve()
      })
    }
    else{
      iframeApi.play()
      .then(()=>{
        audio.play()
        reject()
      })
    }
  })
}

var delay
var syncPending = false
var resolves = []
function synchronize(diff){
  return new Promise(resolve=>{
    delay = diff
    resolves.push(resolve)
    if(!syncPending){
      iframeApi
      syncPending = true
      sync(delay)
      .then(()=>{
        resolves.forEach(rslv=>rslv(delay))
        resolves = []
        syncPending = false
      })
      .catch(()=>{
        syncPending = false
        setTimeout(()=>synchronize(delay), 1000)
      })
    }
  })
}

const delayUrl = "https://api.github.com/repos/mlaci/time-sync/contents/delay.json"
var delayETag
var delay = null

userEvents.addEventListener("set-user-delay", event => {
  event.detail.delay = Number((Number(userDelay.value) + event.detail.delay).toFixed(2))
  synchronize(event.detail.delay)
  .then(dly => userDelay.value = dly)
})

userEvents.addEventListener("reset-user-delay", event => {
  synchronize(serverDelay)
  .then(dly => userDelay.value = dly)
})

var serverDelay = null
function getDelay(){
  return fetch(delayUrl, {headers:{"If-None-Match": delayETag}})
  .then(res => {
    if(res.status==200){
      delayETag = res.headers.get("ETag")
      return res.json().then(({download_url}) =>
        fetch(download_url).then(res=>res.json())
      )
    }
    else if(res.status==304){
      return serverDelay
    }
    else{
      return new Error(res.statusText)
    }
  })
}

function playerState(media){
  var state = "idle"
  if(media.readyState>0){
    state = "loadedmetadata"
  }
  if(media.readyState>1){
    state = "waiting"
  }
  if(media.readyState>2){
    if(media.ended){
      state = "ended"
    }
    else{
      if(media.paused){
        state = "paused"
      }
      else{
        state = "playing"
      }
    }
  }
  return state
}


var iframeApi
tv.getApi().then(api=>{
  info.classList.add("hidden")

  iframeApi = api

  tv.start()
  radio.start()
  
})
.then(()=>{
  
  setInterval(() => {
    return getDelay()
    .then(newDelay => {
      if(newDelay != serverDelay){
        serverDelay = newDelay
        if(userDelay.disabled){
          synchronize(newDelay)
          userDelay.value = newDelay
        }
      }
    })
    .catch(err=>
      console.log("getDelay: "+err)
    )
  },5000)

})
.then(()=>{

  /*iframeApi.subscribe("waiting", ()=>{
    if(playerState(audio)!="waiting"){
      audio.pause()
    }
  })
  
  iframeApi.subscribe("playing", ()=>{
    if(audio.paused){
      audio.play()
    }
    else if(playerState(audio)=="waiting"){
      iframeApi.pause()
    }
  })

  audio.addEventListener("waiting", ()=>{
    iframeApi.getPlayerState()
    .then(state=>{
      if(state!="waiting"){
        iframeApi.play()
      }
    })
  })
  
  audio.addEventListener("playing", ()=>{
    iframeApi.getPlayerState()
    .then(state=>{
      if(state=="paused"){
        iframeApi.play()
      }
      else if(state=="waiting"){
        audio.pause()
      }
    })
  })*/

})
.then(()=>{

  setInterval(()=>{
    iframeApi.getCurrentTime()
    .then(videoCurrentTime=>{
      var audioNow = audio.startDate+audio.currentTime*1000
      var videoNow = iframe.startDate+videoCurrentTime*1000
      var delayNow = Math.round(audioNow-videoNow)
      if(Math.abs(delayNow-delay*1000)>2000){
        synchronize(delay)
        console.log("resync from "+delayNow+" to "+delay*1000)
      }
    })
  },5000)

})
.then(()=>{

  function qualityHash(){
    if(/#([0-9]*p|auto)/.test(location.hash)){
      iframeApi.setPlaybackQuality(location.hash.match(/#([0-9]*p|auto)/)[1])
    }
  } 
  iframeApi.subscribe("loadedmetadata", function initQuality(){
    qualityHash()
    iframeApi.unsubscribe("loadedmetadata", initQuality)
  })
  window.addEventListener("hashchange", qualityHash)
  
})