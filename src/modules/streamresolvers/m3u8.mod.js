// @ts-check
const {register, genericResolver} = require("anv");
const request = require("request");

// FIXME: This doesn't work for absolute URLs (as m3u8 playlist items) yet
register("streamresolver", {
  name: "m3u8",
  description: "ANV m3u8 generic request stream resolver",
  weight: 0,
  streamData: {
    chunkIndex: 0,
    bytes: 0,
  },
  resolve(url, bytes, out, info, optionsObj) {
    const options = optionsObj || {};
    let curReq = null;
    let aborted = false;

    genericResolver("basic", url, (err, data) => {
      if (err) {
        console.log("ANV m3u8 Error:", err);
        // FIXME: ERORR
      } else {
        let duration = 0; // Seconds
        let chunkIndex = 0;
        const chunks = [];
        const baseUrl = url.slice(0, url.lastIndexOf("/") + 1);

        const start = data.indexOf("#EXTINF:");
        const lines = data.slice(start).trim().split(/\n/g);
        lines.pop();

        for (let i=0; i<lines.length; i += 2) {
          const dur = parseFloat(lines[i].slice("#EXTINF:".length, -1));
          const chunkFile = lines[i + 1];

          duration += dur;
          chunks.push(chunkFile);
        }

        const bandwidth = options.extBandwidth || 0;
        const size = (bandwidth * duration) / 8;

        if (size) {
          out.setSize(size);
        }

        function dlNextChunk() {
          if (aborted) {
            // FIXME: Maybe do something here
            return;
          }

          const chunk = chunks[chunkIndex];
          const chunkUrl = baseUrl + chunk;
          chunkIndex++;

          curReq = request({
            url: chunkUrl,
            // @ts-ignore
            headers: Object.assign({
              "Byte-Range": `bytes=${ bytes }-`,
            }, options.headers ? options.headers : {}),
            agentOptions: {
              rejectUnauthorized: options.hasOwnProperty("noCheckCertificate") ? !options.noCheckCertificate : true,
            }
          })
          .on("error", err => {
            out.error(err);
          })
          .on("response", res => {
            if (!(res.statusCode >= 200 && res.statusCode < 300)) {
              out.error("Status code: " + res.statusCode);
            }
          })
          .on("end", arg => {
            if (chunkIndex === chunks.length) {
              setTimeout(() => {
                out.end();
              }, 0);
            } else {
              dlNextChunk();
            }
          })
          // @ts-ignore
          .pipe(out, {end: false});
        }

        dlNextChunk();
      }
    }, {
      noCheckCertificate: options.generic && options.generic.hasOwnProperty("noCheckCertificate") ? options.generic.noCheckCertificate : false,
    });

    return {
      stop() {
        // @ts-ignore
        aborted = true;

        if (curReq) {
          curReq.end();
          curReq = null;
        }
      }
    }
  }
});
