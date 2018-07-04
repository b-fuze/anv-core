// @ts-check
const {register, genericResolver} = require("anv");

function decode(inputBuf, lkey1, lkey2, lkey3, lkey4, bkey1, bkey2) {
  var output = ""; // string
  var rawHeader = inputBuf.slice(0, 72);
  var decodedHeader = [];

  lkey1 = lkey1 + "";
  bkey1 = bkey1 + "";

  for (var i=0; i < rawHeader.length; i += 8) {
    var chunk = rawHeader.slice(i, i + 8);
    var chunkInt = parseInt(chunk, 16);

    decodedHeader.push(chunkInt);
  }

  var content = inputBuf.slice(72);
  var headerKeyIndex = 0;

  for (var i = 0; i < content.length;) {
    var encodedBytes = 0;
    var bitOffset = 0;

    do {
      var byteHex = content.slice(i, i + 2);
      var u8int = parseInt(byteHex, 16);
      var _6int = u8int & 63;

      encodedBytes += _6int << bitOffset;
      bitOffset += 6;
      i += 2;
    } while (u8int >= 64);

    var baseKey = parseInt(bkey1, 8) - bkey2;
    var decodedBytes = encodedBytes ^ decodedHeader[headerKeyIndex % 9];
    var byteArray4 = decodedBytes ^ ((parseInt(lkey1, 8) - lkey2 + 4 - lkey3) / (lkey4 - 8)) ^ baseKey;

    var byteMask = 128 + 127;
    for (var bytePos = 0; bytePos < 4; bytePos++) {
      var code = (byteArray4 & byteMask) >> 8 * bytePos;
      byteMask = byteMask << 8;

      var char = String.fromCharCode(code - 1);
      if (char != "$") {
        output += char;
      }
    }

    headerKeyIndex += 1; // number
  }

  console.log({
    // @ts-ignore
    args: Array.from(arguments),
    output: output,
  });

  return output;
}

const dataRegex = /none;">\s*<p[^>]+>((?:.(?!<\/p>))+.)/i;
const literalKeyRegex = /\(\s*_0x30725e\s*,\s*\(\s*parseInt\(\s*'(\d+)'\s*,\s*\d+\s*\)\s*-\s*(\d+)\s*\+\s*0x\d+\s*-\s*(\d+)\s*\)\s*\/\s*\(\s*(\d+)\s*-\s*0x\d+\s*\)\s*\)/;
// Example:
// (
//     _0x30725e,
//     (
//         parseInt(
//             '155163761757', // lkey1
//             8
//         ) -
//         16 + // lkey2
//         0x4 -
//         4 // lkey3
//     ) /
//     (
//         23 - // lkey4
//         0x8
//     )
// )

const baseKeyRegex = /var\s+_1x4bfb36\s*=\s*parseInt\(\s*'(\d+)'\s*,\s*\d+\s*\)\s*-\s*(\d+)\s*;/;
// Example:
// var
// _1x4bfb36 =
// parseInt(
//     '10674246140', // bkey1
//     8
// ) -
// 34; // bkey2

register("mirror", {
  name: "openload",
  displayName: "Openload",
  description: "ANV Openload Mirror",
  weight: 0,
  cache: false,
  delay: 350,
  resolver: "cloudflare",
  streamResolver: "basic",
  forceReresolveParent: true,
  maxConnections: 3,
  hosts: [
    "openload.co",
    "www.openload.co",
  ],
  validUrl(url) {
    // https://openload.co/embed/y_C_MJz38xI
    return /^https?:\/\/(www\.)?openload\.co\/+embed\/+[a-zA-Z\d_]+$/.test(url);
  },
  media(data, tier, url) {
    const encodedData = data.match(dataRegex);
    const bKeyVal = data.match(baseKeyRegex);
    const lKeyVal = data.match(literalKeyRegex);

    if (encodedData === null) {
      // 404 not found or smth
      return null;
    }

    const stream = decode(encodedData[1], lKeyVal[1], +lKeyVal[2], +lKeyVal[3], +lKeyVal[4], bKeyVal[1], +bKeyVal[2]);
    const streamUrl = "https" + "://openload.co/stream/" + stream + "?mime=true";

    console.log("OPENLOAD", streamUrl);
    return {
      // Example: https://openload.co/stream/y_C_MJz38xI~1530743203~99.62.0.0~TPNcvEA_?mime=true
      url: streamUrl,
      options: {
        headers: {
          Referer: url,
        }
      }
    };
  }
});
