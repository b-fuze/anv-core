// @ts-check
const {register} = require("anv");

register("mirror", {
  name: "estream",
  displayName: "Estream",
  description: "ANV Estream Mirror",
  weight: 0,
  cache: false,
  delay: 450,
  maxConnections: 3,
  resolver: "basic",
  streamResolver: "basic",
  hosts: [
    "estream.to",
    "estream.xyz",
  ],
  validUrl(url) {
    // https://estream.to/embed-4qskpywsmr3g.html
    return /^https?:\/\/estream\.(to|xyz)\/+[a-zA-Z\d]+\.html$/.test(url);
  },
  media(data, tier, url) {
    var video = data.match(/<source\s+src="([^"]+)"\s+type='video\/mp4'/);

    if (!video) {
      return null;
    }

    return video && {
      url: video[1],
    };
  }
});
