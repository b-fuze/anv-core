// @ts-check
const {register} = require("anv");

register("mirror", {
  name: "yourupload",
  displayName: "YourUpload",
  description: "ANV YourUpload Mirror",
  weight: 0,
  cache: false,
  delay: 200,
  resolver: "cloudflare",
  streamResolver: "basic",
  hosts: [
    "www.yourupload.com",
    "embed.yourupload.com",
  ],
  validUrl(url) {
    return /^https?:\/\/www\.yourupload\.com\/+embed\/+[a-zA-Z\d]+\?&?width=\d+&height=\d+$/.test(url)
           || /^https?:\/\/embed\.yourupload\.com\/+[a-zA-Z\d]+\?&?width=\d+&height=\d+$/.test(url);
  },
  media(data, tier, url) {
    const match = data.match(/jwplayerOptions\s*=\s*{\s*file\s*:\s*'([^']+)'/);
    return match ? {
      url: match[1],
      options: {
        headers: {
          Referer: url,
        }
      }
    } : null;
  }
});
