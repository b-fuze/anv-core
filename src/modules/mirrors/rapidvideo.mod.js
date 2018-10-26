// @ts-check
const {register, genericResolver} = require("anv");
const cflare = require("cloudscraper");

// Getting .mp4 link
const videoRegEx = /source\s+src="([^"]+\.mp4)"/;
// source src="https://ca-translate.playercdn.net/186/1/h93vAiFP4tBfXSwiLP1OBQ/1539991476/180807/GYTGVV0SzieQsLv.mp4"

// FIXME: This was used to bypass RapidVideo, it's a bad hack
// cflare.jar.setCookie("PHPSESSID=92aflf8f42j0q0a37egr8uo9a7", "https://www.rapidvideo.com/");

register("mirror", {
  name: "rapidvideo",
  displayName: "RapidVideo",
  description: "ANV RapidVideo Mirror",
  weight: 0,
  cache: false,
  delay: 8000,
  streamDelay: 8000,
  maxConnections: 3,
  backtrack: (res) => res.statusCode === 403,
  resolver: "cloudflare",
  streamResolver: "basic",
  // @ts-ignore
  // resolverOptions: {
  //   headers: {
  //     "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:63.0) Gecko/20100101 Firefox/63.0",
  //     "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  //     "Connection": "keep-alive",
  //   },
  //   cookies: [
  //     "__cfduid=d729576e0a7f0d34c645cffaf10abdb701539931727",
  //     "PHPSESSID=icdpn619shf4p9np7sfls0b5c1",
  //   ]
  // },
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
    function getCrap(data) {
      const match = data.match(videoRegEx);

      if (!match) {
        // It didn't match, video probably deleted or server error, or captcha,
        // etc. return `null` so ANV can skip this bad source
        return null;
      }

      return {
        // Return full matched url
        url: match[1],
        options: {
          backtrack(res) {
            return res.statusCode === 403;
          }
        }
      };
    }

    const re = /top\.location\.href\s*=/;
    function determine(data, rslv) {
      if (re.test(data)) {
        let resolve = rslv;

        genericResolver("cloudflare", url, (err, data) => {
          if (re.test(data)) {
            determine(data, resolve);
          } else {
            resolve(getCrap(data));
          }
        }, {
          headers: {
            "Referer": url,
          }
        });

        // @ts-ignore
        return rslv ? null : new Promise((res) => {
          resolve = res;
        });
      } else {
        return getCrap(data);
      }
    }

    return determine(data);
  }
});
