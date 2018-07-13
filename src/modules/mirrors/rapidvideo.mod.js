// @ts-check
const {register} = require("anv");

// Getting .mp4 link
const videoRegEx = /https:\/\/www\d+.playercdn\.net\/\d+\/\d+\/+[a-zA-Z\d_-]+\/\d+\/\d+\/+[a-zA-Z\d]+\.mp4/;

register("mirror", {
  name: "rapidvideo",
  displayName: "RapidVideo",
  description: "ANV RapidVideo Mirror",
  weight: 0,
  cache: false,
  delay: 1000,
  maxConnections: 3,
  resolver: "basic",
  streamResolver: "basic",
  hosts: [
    "www.rapidvideo.com",
    "rapidvideo.com",
  ],
  validUrl(url) {
    // https://www.rapidvideo.com/e/FOUISZTVKZ&q=720p
    // https://www.rapidvideo.com/e/FQI4PJ2XUJ?autostart=true
    return /^https?:\/\/(www\.)?rapidvideo\.com\/+e\/+[a-zA-Z\d&]+(\?[a-z]+)?=(\d+p|(true|false))$/.test(url);
  },
  media(data, tier, url) {
    const match = data.match(videoRegEx);
    
    if (!match) {
      // It didn't match, video probably deleted or server error, etc
      // return `null` so ANV can skip this bad source
      return null;
    }

    return {
      // Return full matched url
      url: match[0]
    };
  }
});
