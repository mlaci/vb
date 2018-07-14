if(/https:\/\/mlaci.github.io\/vb/.test(location.href)){
  var res = /https?:\/\/mlaci.github.io\/vb\/(#[0-9]+p)/.exec(location.href)
  var quality = res && res[1] || ""
  fetch("https://gitcdn.xyz/repo/mlaci/vb/master/index.html")
  .then(res=>location.href = "http" + res.url.slice(5) + quality)
}