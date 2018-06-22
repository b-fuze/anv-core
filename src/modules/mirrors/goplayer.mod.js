// @ts-check
const {register} = require("anv");

register("mirror", {
  name: "goplayer",
  displayName: "GoPlayer",
  description: "ANV GoPlayer Mirror",
  weight: 0,
  cache: false,
  delay: 1000,
  maxConnections: 3,
  resolver: "cloudflare",
  streamResolver: "basic",
  hosts: [
    "www.video44.net",
  ],
  validUrl(url) {
    // http://www.video44.net/gogo/new/?w=657&h=379&vid=shakugannoshana03.flv
    return /^https?:\/\/www\.video44\.net\/+gogo\/+new\/+\?w=\d+&h=\d+&vid=.+$/.test(url);
  },
  media(data, tier, url) {
    var video = data.match(/file:\s+"([^"]+)",/);

    return video && {
      url: video[1],
      options: {
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:61.0)"
        }
      }
    };
  }
});
