import {iframe, tv, wall} from "./common.js"
import {createIframePlayerAPI} from "./iframe-player-api.js"

var apiPromise = createIframePlayerAPI(iframe)
function getApi(){
  return apiPromise
}

function reload(api){
  tv.removeChild(iframe)
  iframe.src = iframe.src
  tv.insertBefore(iframe, wall)
  return Promise.race([
    new Promise(resolve=>iframe.addEventListener("iframeApiUpdated", resolve)),
    new Promise((_,reject)=>setTimeout(reject, 5000))
  ])
  .then(()=>{
    api.playAt(1)
    .then(api.getStartDate)
    .then(date=>iframe.startDate=date)
  })
  .catch(err=>{
    reload(api)
  })
}

function start(){
  return getApi()
  .then(api=>{
     return api.playAt(1)
    .then(api.getStartDate)
    .then(date=>iframe.startDate=date)
    .then(()=>api)
    //.then(()=>api.subscribe("abort", ()=>reload(api)))
  })
}

export {start, getApi}