// @ts-check
const {register} = require("anv");

register("provider", {
  name: "animerush",
  displayName: "Anime Rush",
  description: "ANV Anime Rush provider",
  weight: 0,
  delay: 250,
  resolvers: {
    mediaList: "basicdom",
    mediaSource: "basicdom",
  },
  hosts: [
    "animerush.tv",
  ],
  validUrl(url, list) {
    if (list) {
      return /^https?:\/\/www\.animerush\.tv\/+anime\/+[a-zA-Z\d-]+\/*$/.test(url);
    } else {
      return /^https?:\/\/www\.animerush\.tv\/+[a-zA-Z\d-]+-episode(-\d+(\.\d+)?){1,2}\/*$/.test(url);
    }
  },
  tiers: {
    "mp4upload-hd": "MP4Upload HD",
    "mp4upload": "MP4Upload",
    "yourupload-hd": "Your Upload HD",
    "yourupload": "Your Upload",
  },
  mediaList(jSh) {
    return [];
  },
  mediaSource(jSh, direct) {
    return [];
  }
});
