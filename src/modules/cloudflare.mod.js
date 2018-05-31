// @ts-check
const cflare = require("cloudscraper");
const {register} = require("anv");

register("genericresolver", {
  name: "cloudflare",
  description: "ANV Cloudflare request resolver",
  weight: 0,
  resolve(url, done) {
    cflare.get(url, function(err, res, body) {
      if (err) {
        done(err, null);
      } else {
        done(null, body);
      }
    })
  }
});
