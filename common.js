const timecodeServer = "https://timecode.herokuapp.com/"
const media = document.querySelector('.media')
const tv = media.querySelector('div.tv')
const wall = tv.querySelector("div.wall")
const iframe = tv.querySelector("iframe")
const audio = media.querySelector('audio')

iframe.safeSeek = 2000+10000
audio.safeSeek = 2000+1300

export {timecodeServer, media, audio, iframe, tv, wall}