// @ts-check
const {register, genericResolver} = require("anv");
const {parse} = require("url");
const {jSh} = require("jshorts");
const {JSDOM} = require("jsdom");

const unboundjSh = jSh;

// @ts-ignore
register("provider", {
  name: "9anime",
  displayName: "9anime",
  description: "ANV 9anime provider",
  weight: 0,
  delay: 1250,
  resolvers: {
    mediaList: "cfdom",
    mediaSource: "cloudflare",
  },
  hosts: [
    /^www\d+\.9anime\.is$/,
  ],
  validUrl(url, list) {
    if (list) {
      // https://www7.9anime.is/watch/those-who-hunt-elves.5760/6yvnxz
      return /^https?:\/\/www\d+\.9anime\.is\/+watch\/+[a-zA-Z\d-]+\.[\da-zA-Z]+(\/+([a-zA-Z\d]+)?)?$/.test(url);
    } else {
      return /^https?:\/\/www\d+\.9anime\.is\/+ajax\/+episode\/+info\?.+$/.test(url);
    }
  },
  tiers: [
    ["streamango", "Streamango"],
    ["openload", "Openload"],
    ["rapidvideo", "RapidVideo"],
  ],
  mediaList(jSh) {
    const title = jSh("h2.title")[0].textContent.trim();
    const cover = jSh(".widget-body .thumb img")[0].src;
    const host = parse(jSh.url).host;
    const ts = jSh("html")[0].getAttribute("data-ts");
    const underscore = 777; // FIXME: Wha? Why?
    let done = null;

    const metadata = {
      title,
      cover,
      sources: [],
    };

    const serverContainer = jSh("#servers-container");
    const reqId = serverContainer.getAttribute("data-id");
    const reqEpId = serverContainer.getAttribute("data-epid");
    const reqUrl = `https://${ host }/ajax/film/servers/${ reqId }?episode=${ reqEpId }&ts=${ ts }&_=${ underscore }`;

    genericResolver("cloudflare", reqUrl, (err, data) => {
      if (!err) {
        const jSh = unboundjSh.bind((new JSDOM(JSON.parse(data).html)).window.document);

        const serverMap = {};
        const episodes = {};

        // Get servers
        for (const server of jSh(".widget.servers .tabs .tab")) {
          const name = server.textContent.trim().toLowerCase();

          if (/^(streamango|openload|rapidvideo)$/.test(name)) {
            serverMap[server.getAttribute("data-name")] = name;
          }
        }

        // Get episodes
        for (const range of jSh(".servers > .widget-body > .server")) {
          const serverId = range.getAttribute("data-id");
          const serverName = serverMap[serverId];

          if (serverName) {
            for (const src of range.jSh("a")) {
              const number = src.getAttribute("data-base");
              const epid = src.getAttribute("data-id");

              (episodes[number] || (episodes[number] = {
                type: "media",
                sources: [],
                number,
                fileExtension: "mp4",
              })).sources.push({
                type: "mediasource",
                url: `https://${ host }/ajax/episode/info?ts=${ ts }&_=${ underscore }&id=${ epid }&server=${ serverId }`,
                tiers: [serverName],
              });
            }
          }
        }

        for (const key of Object.keys(episodes)) {
          metadata.sources.push(episodes[key]);
        }

        done(metadata);
      }
    });

    // @ts-ignore
    return new Promise((resolve) => {
      done = resolve;
    });
  },
  mediaSource(rawData, direct) {
    const data = jSh.parseJSON(rawData);

    if (data.error) {
      return null;
    }

    return [{
      type: "mirror",
      url: data.target,
    }];
  }
});
