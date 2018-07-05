// @ts-check
const {register} = require("anv");

function decode(rawInput, h) {
  var result = "";
  var inputFiltered = rawInput.replace(/[^A-Za-z0-9\+\/=]/g, "");
  var charRange = "=/+9876543210zyxwvutsrqponmlkjihgfedcbaZYXWVUTSRQPONMLKJIHGFEDCBA";

  for (var i = 0; i < inputFiltered.length;) {
    var r = charRange.indexOf(inputFiltered.charAt(i++));
    var wc = charRange.indexOf(inputFiltered.charAt(i++));
    var f = charRange.indexOf(inputFiltered.charAt(i++));
    var g = charRange.indexOf(inputFiltered.charAt(i++));

    r = r << 2 | wc >> 4;
    wc = (wc & 15) << 4 | f >> 2;
    var ord = (f & 3) << 6 | g;
    r = r ^ h;

    result += String.fromCharCode(r);

    if (f != 64) {
      result += String.fromCharCode(wc);
    }

    if (g != 64) {
      result += String.fromCharCode(ord);
    }
  }

  return result;
};

const urlKeyRegex = /src\s*:\s*d\('([^']+)'\s*,\s*(\d+)\)/;

register("mirror", {
  name: "streamango",
  displayName: "Streamango",
  description: "ANV StreamMango Mirror",
  weight: 0,
  cache: false,
  delay: 550,
  resolver: "cloudflare",
  streamResolver: "basic",
  maxConnections: 3,
  hosts: [
    "streamango.com",
    "www.streamango.com",
  ],
  validUrl(url) {
    // https://streamango.com/embed/tqslkbkdkkqqmrqk
    return /^https?:\/\/(www\.)?streamango\.com\/+embed\/+[a-zA-Z\d]+$/.test(url);
  },
  media(data, tier, url) {
    const encodedUrl = data.match(urlKeyRegex);

    if (!encodedUrl) {
      // 404 or smth
      return null;
    }

    return {
      url: "https:" + decode(encodedUrl[1], +encodedUrl[2])
    };
  }
});
