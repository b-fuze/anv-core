// @ts-check
const {register, genericResolver} = require("anv");
const parseUrl = require("url");

const mirrors = {
  "mp4upload": 1,
  "yourupload": 1,
};

// @ts-ignore
register("provider", {
  name: "gogoanime",
  displayName: "GOGO Anime",
  description: "ANV GOGO Anime provider",
  weight: 0,
  delay: 650,
  resolvers: {
    mediaList: "cfdom",
    mediaSource: "cfdom",
  },
  hosts: [
    /^www\d*\.gogoanime\.se$/,
    /^gogoanime\.sh$/,
  ],
  validUrl(url, list) {
    if (list) {
      // https://www2.gogoanime.se/category/boku-no-hero-academia
      return /^https?:\/\/(www\d*\.gogoanime\.se|gogoanime\.sh)\/+category\/+[a-zA-Z\d-]+\/*$/.test(url);
    } else {
      // Don't match
      // https://www3.gogoanime.se/anime-list.html
      // https://www3.gogoanime.se/new-season.html
      // Etc...

      // https://www2.gogoanime.se/boku-no-hero-academia-episode-1
      return /^https?:\/\/(www\d*\.gogoanime\.se|gogoanime\.sh)\/+(?!category\/+|(anime-list|new-season|anime-movies|popular|login|register|search)\.html)[a-zA-Z\d-]+$/.test(url);
    }
  },
  tiers: [
    ["vidstreaming", "VidStreaming"],
    ["streamango", "Streamango"],
    ["openload", "Openload"],
    ["yourupload", "YourUpload"],
    ["mp4upload", "MP4Upload"],
    ["estream", "EStream"],
  ],
  mediaList(jSh) {
    const title = jSh(".anime_info_body_bg h1")[0].textContent;
    const cover = jSh(".anime_info_body_bg img")[0].src;
    const episodeRanges = jSh("#episode_page").children;

    const animeId = jSh("#movie_id").value;
    const defaultEpisode = jSh("#default_ep").value;

    const ranges = [];
    let rangeIndex = 0;
    const media = [];

    for (const wrap of episodeRanges) {
      const elm = wrap.children[0];
      ranges.push([+elm.getAttribute("ep_start"), +elm.getAttribute("ep_end")]);
    }

    const rangeDelay = 1000;
    void function getNextRange() {
      const interval = setTimeout(function() {
        const range = ranges[rangeIndex];
        const urlBase = "https://" + parseUrl.parse(jSh.url).host;
        const url = urlBase + "/load-list-episode?"
                    + `ep_start=${ range[0] }&`
                    + `ep_end=${ range[1] }&`
                    + `id=${ animeId }&`
                    + `default_ep=${ defaultEpisode }`;

        genericResolver("cfdom", url, (err, jSh) => {
          if (!err) {
            const episodes = jSh("a").reverse();

            for (const episode of episodes) {
              media.push({
                type: "mediasource",
                url: urlBase + episode.href.trim(),
                number: episode.children[0].textContent.match(/\d+/)[0],
                fileExtension: "mp4",
              });
            }

            // Go to next range (if any)
            rangeIndex++;

            if (rangeIndex === ranges.length) {
              // Call done()
              done({
                title,
                cover,
                sources: media
              });
            } else {
              getNextRange();
            }
          }
        });
      }, rangeDelay);
    }();

    let done;

    // @ts-ignore
    return new Promise((resolve, reject) => {
      done = resolve;
    });
  },
  mediaSource(jSh, direct) {
    const mirrors = jSh(".anime_muti_link li > a");
    const sources = [];

    for (const mirror of mirrors) {
      let name = mirror.childNodes[0].wholeText.trim().toLowerCase();

      if (/^(vidstreaming|mp4upload|openupload|streamango|yourupload|estream)$/.test(name)) {
        name === "openupload" && (name = "openload");

        sources.push({
          type: "mirror",
          url: (name[0] === "v" ? "https:" : "") + mirror.getAttribute("data-video"),
          tiers: [name],
        });
      }
    }

    return sources;
  }
});
