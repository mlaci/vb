if(/https:\/\/mlaci.github.io\/vb/.test(location.href)){
  var res = /https?:\/\/mlaci.github.io\/vb\/(#[0-9]+p)/.exec(location.href)
  var quality = res && res[1] || ""
  fetch("https://api.github.com/repos/mlaci/vb/commits").then(res=>res.json())
  .then(([last])=>location.href = "http://gitcdn.xyz/cdn/mlaci/vb/" + last.sha + "/index.html" + quality)
}