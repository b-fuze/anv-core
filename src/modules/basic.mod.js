// @ts-check
const {register, genericResolver} = require("anv");
const request = require("request");
const {JSDOM} = require("jsdom");
const {jSh} = require("jshorts");

register("genericresolver", {
  name: "basic",
  description: "Basic ANV generic request resolver",
  weight: 0,
  resolve(url, done, optionsObj) {
    let options = optionsObj || {};
    let jar;

    if (options.cookies) {
      jar = request.jar();

      for (const cookieStr of options.cookies) {
        jar.setCookie(cookieStr, url);
      }
    }

    request({
      url,
      // @ts-ignore
      headers: options.headers ? options.headers : {},
      agentOptions: {
        rejectUnauthorized: options.hasOwnProperty("noCheckCertificate") ? !options.noCheckCertificate : true,
      },
      jar,
    }, (err, res, body) => {
      if (!err) {
        done(null, body);
      } else {
        done(err);
      }
    });
  }
});

register("genericresolver", {
  name: "basicdom",
  description: "Basic ANV dom",
  weight: 0,
  resolve(url, done) {
    genericResolver("basic", url, (err, data) => {
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

register("genericresolver", {
  name: "basicurl",
  description: "Basic ANV url",
  weight: 0,
  resolve(url, done) {
    setTimeout(() => {
      done(null, url);
    }, 0);
  }
});

register("streamresolver", {
  name: "basic",
  description: "Basic ANV generic request stream resolver",
  weight: 0,
  resolve(url, bytes, out, info, optionsObj) {
    const options = optionsObj || {};

    const req = request({
      url,
      // @ts-ignore
      headers: Object.assign({
        "Range": `bytes=${ bytes }-`,
      }, options.headers ? options.headers : {}),
      agentOptions: {
        rejectUnauthorized: options.hasOwnProperty("noCheckCertificate") ? !options.noCheckCertificate : true,
      }
    })
    .on("error", err => {
      out.error(err);
    })
    .on("response", res => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Success
        let size;

        if (size = res.headers["content-length"]) {
          out.setSize(+size);
        }
      } else {
        if (out.shouldBacktrack(res)) {
          out.backtrack();
        } else {
          out.error("Status code: " + res.statusCode);
        }
      }
    })
    .on("end", arg => {
      out.end();
    })
    // @ts-ignore
    .pipe(out);

    return {
      stop() {
        req.end();
      }
    }
  }
});
