// @ts-check
const {register} = require("anv");

register("mirror", {
  name: "vidstreaming",
  displayName: "VidStreaming",
  description: "ANV VidStreaming Mirror",
  weight: 0,
  cache: false,
  delay: 500,
  maxConnections: 3,
  resolver: "cloudflare",
  streamResolver: "basic",
  hosts: [
    "vidstreaming.io",
  ],
  validUrl(url) {
    // https://vidstreaming.io/streaming.php?id=MTA0ODAz&title=Sword+Art+Online+Alternative%3A+Gun+Gale+Online+Episode+1
    return /^https?:\/\/vidstreaming\.io\/+streaming\.php\?.+$/.test(url);
  },
  media(data, tier, url) {
    const match = data.match(/file\s*:\s*'([^']+)'\s*,/);

    if (match) {
      const url = match[1];

      if (/\.m3u8$/.test(url.trim())) {
        return {
          type: "mirror",
          url,
        };
      } else {
        return {
          url,
          options: {
            noCheckCertificate: true,
          }
        };
      }
    } else {
      return null;
    }
  }
});

// For the *.m3u8 sources
register("mirror", {
  name: "vidstreaming-vidcdn",
  displayName: "VidStreaming VidCDN",
  description: "ANV VidStreaming VidCDN Resolution Mirror",
  weight: 0,
  cache: false,
  delay: 500,
  maxConnections: 3,
  resolver: "basic",
  resolverOptions: {
    noCheckCertificate: true,
  },
  streamResolver: "m3u8",
  hosts: [
    /^cdn\d+\.vidcdn\.pro$/,
  ],
  validUrl(url) {
    // https://cdn5.vidcdn.pro/hls/48719e947ba2152ea97d6b656e00cbeb/sub.2.m3u8
    return /^https?:\/\/cdn5\.vidcdn\.pro\/+hls\/+[a-zA-Z\d]+\/+.+\.m3u8$/.test(url);
  },
  media(data, tier, url) {
    const match = data.trim().split(/\n/g);
    const baseUrl = url.substr(0, url.lastIndexOf("/") + 1);
    const bandwidth = data.match(/BANDWIDTH=(\d+),/)[1];

    return {
      url: baseUrl + match.pop(),
      options: {
        noCheckCertificate: true,
        extBandwidth: +bandwidth,

        // For initial generic request
        generic: {
          noCheckCertificate: true,
        }
      }
    };
  }
});
