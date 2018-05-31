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
  hosts: [
    "www.yourupload.com",
  ],
  validUrl(url) {
    return /^https?:\/\/www\.yourupload\.com\/+embed\/+[a-zA-Z\d]+\?&?width=\d+&height=\d+$/.test(url)
           || /^https?:\/\/embed\.yourupload\.com\/+[a-zA-Z\d]+\?&?width=\d+&height=\d+$/.test(url);
  },
  media(data, tier, url) {
    return {
      url: data.match(/file\s*:\s*'([^']+)'/)[1],
      options: {
        headers: {
          Referer: url,
        }
      }
    };
  }
});
