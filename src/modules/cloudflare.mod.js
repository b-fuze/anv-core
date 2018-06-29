// @ts-check
const cflare = require("cloudscraper");
const {register, genericResolver} = require("anv");
const {JSDOM} = require("jsdom");
const {jSh} = require("jshorts");

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

register("genericresolver", {
  name: "cfdom",
  description: "ANV Cloudflare request resolver",
  weight: 0,
  resolve(url, done) {
    genericResolver("cloudflare", url, (err, data) => {
      // @ts-ignore
      const dom = new JSDOM(data);
      const boundjSh = jSh.bind(dom.window.document);
      boundjSh.dom = dom;
      boundjSh.html = data;
      boundjSh.url = url;

      done(null, boundjSh);
    });
  }
});
