// @ts-check
const {register} = require("anv");

const mirrors = {
  "mp4upload": 1,
  "yourupload": 1,
};

// @ts-ignore
register("provider", {
  name: "animerush",
  displayName: "Anime Rush",
  description: "ANV Anime Rush provider",
  weight: 0,
  delay: 650,
  resolvers: {
    mediaList: "basicdom",
    mediaSource: "basicdom",
  },
  hosts: [
    "animerush.tv",
    "www.animerush.tv",
  ],
  validUrl(url, list) {
    if (list) {
      return /^https?:\/\/www\.animerush\.tv\/+anime\/+[a-zA-Z\d-]+\/*$/.test(url);
    } else {
      // http://www.animerush.tv/Ooyasan-wa-Shishunki-episode-12/mirror-317345/
      return /^https?:\/\/www\.animerush\.tv\/+[a-zA-Z\d-]+-episode(-\d+(\.\d+)?){1,2}(\/*|\/+mirror-\d+\/*)$/.test(url);
    }
  },
  tiers: [
    ["yourupload", "Your Upload"],
    ["mp4upload-hd", "MP4Upload HD"],
    ["mp4upload", "MP4Upload"],
    ["yourupload-hd", "Your Upload HD"],
    ["raw", "Raw Unsubbed"],
  ],
  mediaList(jSh) {
    const title = jSh("h1")[0].textContent;
    const cover = jSh(".cat_image > object")[0];

    const metadata = {
      title,
      sources: [],
    };

    if (cover && cover.getAttribute("data")) {
      metadata.cover = cover.getAttribute("data");
    }

    for (const episode of jSh(".episode_list > a").reverse()) {
      const number = episode.childNodes[0].wholeText.trim().match(/Episode\s+(\d+(?:.\d+)?(?:-\d+(?:.\d+)?)?)$/i)[1];

      if (!episode.jSh(0).getAttribute("style").match(/grey/i)) {
        metadata.sources.push({
          type: "mediasource",
          number,
          url: episode.href,
          fileExtension: "mp4",
        });
      }
    }

    return metadata;
  },
  mediaSource(jSh, direct) {
    const sources = [];

    if (direct) {
      const mirror = jSh("#episodes .episode_on")[0];
      const supported = mirror.jSh("h3")[0].jSh(0).textContent.toLowerCase().match(/mp4upload|yourupload/);
      const hd = mirror.jSh(".hdlogo")[0] ? "-hd" : "";

      return [{
        type: "mirror",
        url: jSh("#embed_holder iframe")[0].src,
        tiers: [supported + hd],
      }];
    }

    // @ts-ignore
    for (const mirrorDiv of Array.from(jSh("#episodes").childNodes)) {
      if (mirrorDiv.tagName === "DIV") {
        const mirror = jSh(mirrorDiv);
        const supported = mirror.jSh("h3")[0].jSh(0).textContent.toLowerCase().match(/mp4upload|yourupload/);

        if (supported) {
          const hd = mirror.jSh(".hdlogo")[0] ? "-hd" : "";
          let source;

          if (mirror.jSh(0).className === "episode_on") {
            source = {
              type: "mirror",
              url: jSh("#embed_holder iframe")[0].src,
              tiers: [],
            };
          } else {
            source = {
              type: "mediasource",
              url: mirror.jSh("a")[0].href,
              tiers: [],
            };
          }

          source.tiers = [supported + hd];
          sources.push(source);
        }
      }
    }

    return sources;
  }
});
