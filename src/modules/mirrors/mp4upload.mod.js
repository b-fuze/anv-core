// @ts-check
const {register} = require("anv");

var regex  = /<script[^>]*>eval\(function\(p,a,c,k,e,d\)\{.+return\s+p\}\('((?:.(?!(?:[^\\]')))+..)',(\d+),(\d+),'((?:.(?!(?:[^\\]')))+..)'\.split\('\|'\)\)\)\s*;?\s*<\/script>/;
var regex2 = /"file":\s*"([^"]+\.mp4)"/;
function unpack(p, a, c, k, e, d) {
  while (c--)
    if (k[c]) p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c]);
  return p;
}

function stripSlashes(str) {
  return str.replace(/\\'/g, "'");
}

register("mirror", {
  name: "mp4upload",
  displayName: "MP4Upload",
  description: "ANV MP4Upload Mirror",
  weight: 0,
  cache: false,
  delay: 200,
  resolver: "basic",
  hosts: [
    "mp4upload.com",
  ],
  validUrl(url) {
    return /^https?:\/\/mp4upload\.com\/+embed-[a-zA-Z\d]+-\d+x\d+\.html$/.test(url);
  },
  media(data, tier, url) {
    var match = data.match(regex);
    var video = unpack(stripSlashes(match[1]), parseInt(match[2]), parseInt(match[3]), stripSlashes(match[4]).split("|")).match(regex2);

    return video[1];
  }
});
