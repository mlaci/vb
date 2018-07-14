import {iframe, audio, tv} from "/common.js"
import {getApi} from "/tv.js"

const controls = document.querySelector("div.controls")

function fullscreen(){
  if(tv.webkitRequestFullscreen){
    tv.webkitRequestFullscreen()
  }
  else if(tv.mozRequestFullScreen){
    tv.mozRequestFullScreen()
  }
  else if(tv.msRequestFullscreen){
    tv.msRequestFullscreen()
  }
  else if(tv.requestFullscreen){
    tv.requestFullscreen()
  }
}
const fullscreenButton = controls.querySelector(".fullscreen button")
fullscreenButton.onclick = fullscreen

function volume(value){
  const radioScaleDown = 0.5
  var scale = value<0.5 && 1/(1-value) || 1/value
  audio.volume = (1-value)*scale*radioScaleDown
  getApi().then(api=>api.setVolume(value*scale)) 
}
const volumeSlider = controls.querySelector(".volume input")
volumeSlider.oninput = function(){volume(this.value)}
volumeSlider.oninput()

setInterval(()=>{
  getApi().then(api=>api.getCurrentTime())
  .then(videoCurrentTime=>{
    var audioNow = audio.startDate+audio.currentTime*1000
    var videoNow = iframe.startDate+videoCurrentTime*1000
    delayNow.innerHTML = Math.round(audioNow-videoNow)/1000
  })
},500)

var userEvents = new EventTarget()

function userSync(delay){
  userDelay.disabled = false
  userEvents.dispatchEvent(new CustomEvent("set-user-delay", {detail: {delay}}))
}

const syncControl = controls.querySelector("div.sync")
const userDelay = syncControl.querySelector("input")
const steps = [-1, -0.1, -0.05, 0.05, 0.1, 1]
var stepButtons = Array.from(syncControl.querySelectorAll("button"))
var resetButton = stepButtons.shift()
stepButtons.forEach((elem,index)=>elem.onclick=()=>userSync(steps[index]))

resetButton.onclick = () => {
  userDelay.disabled = true
  userEvents.dispatchEvent(new CustomEvent("reset-user-delay"))
}

var delayNow = syncControl.querySelector(".delay-now")

const controlPanel = controls.querySelector("div.panel")
const syncToggle = controlPanel.querySelector("button.sync")
syncToggle.onclick = ()=>syncControl.classList.toggle("hidden")

window.onresize = () => {
  var {width, height} = document.body.getBoundingClientRect()
  var {height: controlHeight} = controls.getBoundingClientRect()
  height = height - controlHeight
  document.styleSheets[0].deleteRule(0)
  
  var rule 
  if(width/height<=16/9){
    rule = `:root { --width:${width}px; --height:${width*(9/16)}px }`
  }
  else{
    rule = `:root { --width:${height*(16/9)}px; --height:${height}px }`
  }
  document.styleSheets[0].insertRule(rule, 0)
}
window.onresize()

const info = document.querySelector(".info-modal")
const exitButton = info.querySelector(".exit a")
exitButton.onclick = () => info.classList.add("hidden")
const infoButton = controlPanel.querySelector(".info")
infoButton.onclick = () => info.classList.remove("hidden")

export {userEvents, userDelay, info}