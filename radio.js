import {audio, timecodeServer} from "./common.js"
import mp4 from "./mp3-in-mp4.js"
import mpeg from "./mpeg-audio.js"

const mp3Mime = 'audio/mpeg'
const mp4Mime = 'audio/mp4;codec="mp3"'

var mpegInfo = {}

var mpegData = {}
mpegData.init = () => {
  mpegData.startDate = undefined
  mpegData.count = 0,
  mpegData.hashes =  undefined, 
  mpegData.maxSize = 500
}

const toHex = typedArray => Array.from(typedArray).map(x=>x.toString(16).padStart(2, '0')).join('')

var timeoutTest = () => new TransformStream({
  start(controller) {
    this.timeoutId
    this.timeout = ()=>{
      controller.error("timeout")
    }
  },
  transform(chunk, controller){
    clearTimeout(this.timeoutId)
    this.timeoutId = setTimeout(this.timeout, 5000)
    controller.enqueue(chunk)
  }
})

var toMp3Blocks = () => new TransformStream({
  start(controller) {
    this.buffer = new Uint8Array(0)
    this.beforeFirst = true
  },
  transform(chunk, controller){
    var oldBuffer = this.buffer
    this.buffer = new Uint8Array(oldBuffer.length + chunk.length)
    this.buffer.set(oldBuffer)
    this.buffer.set(chunk, oldBuffer.length)

    var offset
    if(this.beforeFirst){
      this.buffer.some((element, index)=>{
        if(mpeg.test(this.buffer, index)){
          var {version, layer, frame_length, padding, duration} = mpeg.parse(this.buffer, index)
          if(version == "1" && layer == "III"){
            offset = index
            mpegInfo.frameLength = frame_length - padding
            mpegInfo.duration = duration
            return true
          }
        }
      })
    }
    else{
      offset = 0
    }

    if(offset !== undefined){
      this.beforeFirst = false

      var frame_length = mpeg.parse(this.buffer, offset).frame_length
      while(offset + frame_length <= this.buffer.length){
        controller.enqueue(this.buffer.slice(offset, offset + frame_length))
        offset = offset + frame_length
        if(offset + 4 <= this.buffer.length){
          frame_length = mpeg.parse(this.buffer, offset).frame_length
        }
        else{
          frame_length = 4
        }
      }

      oldBuffer = this.buffer
      this.buffer = new Uint8Array(oldBuffer.length - offset)
      this.buffer.set(oldBuffer.subarray(offset, oldBuffer.length))
    }
  }
})

var toMp3Blocks = () => new TransformStream({
  start(controller) {
    this.buffer = new Uint8Array(0)
    this.beforeFirst = true
  },
  transform(chunk, controller){
    var oldBuffer = this.buffer
    this.buffer = new Uint8Array(oldBuffer.length + chunk.length)
    this.buffer.set(oldBuffer)
    this.buffer.set(chunk, oldBuffer.length)

    var offset
    if(this.beforeFirst){
      this.buffer.some((element, index)=>{
        if(mpeg.test(this.buffer, index)){
          var {version, layer, frame_length, padding, duration} = mpeg.parse(this.buffer, index)
          if(version == "1" && layer == "III"){
            offset = index
            mpegInfo.frameLength = frame_length - padding
            mpegInfo.duration = duration
            return true
          }
        }
      })
    }
    else{
      offset = 0
    }

    if(offset !== undefined){
      this.beforeFirst = false

      var frame_length = mpeg.parse(this.buffer, offset).frame_length
      while(offset + frame_length <= this.buffer.length){
        controller.enqueue(this.buffer.slice(offset, offset + frame_length))
        offset = offset + frame_length
        if(offset + 4 <= this.buffer.length){
          frame_length = mpeg.parse(this.buffer, offset).frame_length
        }
        else{
          frame_length = 4
        }
      }

      oldBuffer = this.buffer
      this.buffer = new Uint8Array(oldBuffer.length - offset)
      this.buffer.set(oldBuffer.subarray(offset, oldBuffer.length))
    }
  }
})

var collectFrames = (length) => new TransformStream({
  start(controller) {
    this.buffer = []
    this.mp3Supported = MediaSource.isTypeSupported(mp3Mime)
    this.beforeFirst = true
    this.fragmentCount = 1
  },
  transform(chunk, controller){
    if(!mpegData.startDate){
      mpegData.count++
      mpegData.hashes = mpegData.hashes || []
      if(mpegData.hashes.length>=mpegData.maxSize){
        mpegData.hashes.shift()
      }
      crypto.subtle.digest('SHA-256', chunk).then(hash=>{
        mpegData.hashes.push([toHex(new Uint8Array(hash)).slice(0,10), mpegData.count-1])
      })
    }

    if(this.buffer.length >= length){
      if(this.mp3Supported){
        var size = this.buffer.reduce((size,chunk)=>size+chunk.length,0)
        var block = new Uint8Array(size)
        this.buffer.reduce((size,chunk)=>{
          block.set(chunk, size)
          return size+chunk.length
        },0)
        controller.enqueue(block)
      }
      else{
        var block = mp4.getFragment(this.fragmentCount, this.buffer, length*(this.fragmentCount-1)*this.info.samples_per_frame)
        this.fragmentCount++
        controller.enqueue(block)
      }
      this.buffer = []
    }

    if(!this.mp3Supported && this.beforeFirst){
      this.info = mpeg.parse(chunk, 0)
      var frameLengthWithPadding = this.info.padding && this.info.frame_length || this.info.frame_length + this.info.bytes_in_slot
      var head = mp4.getHeader(this.info.sampling_rate, this.info.samples_per_frame, frameLengthWithPadding, this.info.bitrate, this.info.bitrate)
      controller.enqueue(head)
      this.beforeFirst = false
    }
    this.buffer.push(chunk)

  }
})

function createMedia(){
  var mediaSource = new MediaSource()
  URL.revokeObjectURL(audio.src)
  audio.src = URL.createObjectURL(mediaSource)
  return new Promise(resolve=>{
    mediaSource.addEventListener("sourceopen", ()=>{
      var mime = MediaSource.isTypeSupported(mp3Mime) && mp3Mime || mp4Mime
      audio.sourceBuffer = mediaSource.addSourceBuffer(mime)
      resolve(audio.sourceBuffer)
    })
  })
}

function startStream(sourceBuffer){
  return fetchStream(audio.attributes.url.value, {credentials: 'omit'})
  .then(res => {
    if(!res.ok){
      return new Error(res.statusText)
    }
    else{
      return res.body
      .pipeThrough(timeoutTest())
      .pipeThrough(toMp3Blocks())
      .pipeThrough(collectFrames(50))
      .pipeTo(new WritableStream({
        start(controller){
          this.chunks = []
          sourceBuffer.addEventListener('update', () => {
            if(this.chunks.length != 0){
              var chunk = this.chunks.shift()
              sourceBuffer.appendBuffer(chunk)
            }
          })
        },
        write(chunk, controller){
          if(this.chunks.length == 0 && !sourceBuffer.updating){
            sourceBuffer.appendBuffer(chunk)
          }
          else{
            this.chunks.push(chunk)
          }
        }
      }))
    }
  })
}

audio.addEventListener("loadedmetadata", () => {
  setStartDate()
  .catch(err=>{
    console.log("getTimecode: "+err)
    setTimeout(setStartDate, 5000)
  })
})
audio.addEventListener("loadeddata", () => {
  audio.play()
  .catch(err=>{
    console.log("play: "+err)
  })
})


function start(){
  mpegData.init()

  createMedia()
  .then(sourceBuffer=>startStream(sourceBuffer))
  .catch(err => {
    console.log("stream: "+err)
    setTimeout(start, 5000)
  })
}

function getTimecode(){
  return fetch(timecodeServer)
  .then(res =>{
    return res.json()
  })
}

function setStartDate(){
  return getTimecode()
  .then(serverData=>{
    mpegData.hashes.some(([hash, count])=>{
      var finded = serverData.hashes.find(([serverHash])=>serverHash==hash)
      if(finded){
        var servercount = finded[1]
        mpegData.startDate = serverData.startDate + (servercount-count)*mpegInfo.duration*1000
        audio.startDate = mpegData.startDate
        return true
      }
      else{
        return false
      }
    })
    if(!mpegData.startDate){
      throw "not matched"
    }
    else{
      return mpegData.startDate
    }
  })
}

function keepAlive(){
  return fetch(timecodeServer+"keepalive")
  .then(res => {
    if(!res.ok){
      return new Error(res.statusText)
    }
    else{
      setTimeout(keepAlive, 1000*60*25)
    }
  })
  .catch(err => {
    console.log("keepAlive: "+err)
  })
}
keepAlive()


export {start}