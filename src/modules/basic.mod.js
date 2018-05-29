// @ts-check
const {register, genericResolver} = require("anv");
const request = require("request");
const {JSDOM} = require("jsdom");
const {jSh} = require("jshorts");

register("genericresolver", {
  name: "basic",
  description: "Basic ANV generic request resolver",
  weight: 0,
  resolve(url, done) {
    request(url, (err, res, body) => {
      if (!err) {
        done(body);
      } else {
        throw new Error(err);
      }
    });
  }
});

register("genericresolver", {
  name: "basicdom",
  description: "Basic ANV dom",
  weight: 0,
  resolve(url, done) {
    genericResolver("basic", url, data => {
      // @ts-ignore
      const dom = JSDOM(data);
      const boundjSh = jSh.bind(dom.window.document);
      boundjSh.dom = dom;

      done(boundjSh);
    });
  }
});

register("streamresolver", {
  name: "basic",
  description: "Basic ANV generic request stream resolver",
  weight: 0,
  resolve(url, bytes, out) {
    const req = request({
      url,
      headers: {
        "Byte-Range": `bytes=${ bytes }-`,
      }
    // @ts-ignore
    }).pipe(out);

    return {
      stop() {
        req.abort();
      }
    }
  }
});
