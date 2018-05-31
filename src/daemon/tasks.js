"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const stream_1 = require("stream");
const utils_1 = require("./utils");
const lces_1 = require("lces");
const facets_1 = require("./facets");
const resolve_1 = require("./resolve");
const state_1 = require("./state");
const utils_2 = require("./utils");
const tasks = [];
exports.crud = class {
    static getTask(id) {
        return tasks[id] || null;
    }
    static getTasks() {
        return tasks.filter(task => !!task);
    }
    static hasTaskThen(id, then) {
        const task = this.getTask(id);
        if (task)
            then(task);
        return task;
    }
    static removeTask(id) {
        return this.hasTaskThen(id, task => {
            task.active = false;
            task.remove = true;
        });
    }
    static selectTaskMedia(id, list) {
        return this.hasTaskThen(id, task => {
            task.active = true;
        });
    }
    static startTask(id) {
        return this.hasTaskThen(id, task => {
            task.active = true;
        });
    }
    static stopTask(id) {
        return this.hasTaskThen(id, task => {
            task.active = false;
        });
    }
    static deleteTaskMedia(id, media) {
        return this.hasTaskThen(id, task => {
        });
    }
};
function getSimpleName(title) {
    return title.replace(/[^a-z\d\s\-,:'()@!]/ig, "").replace(/\s+/g, " ");
}
exports.getSimpleName = getSimpleName;
function getInitials(title) {
    title = title.toLowerCase().replace(/[^\sa-z\d]/ig, "");
    var words = title.split(" ").length;
    if (title.length < 5 || words === 1)
        return title.replace(/\s+/g, "").substr(0, 5).toUpperCase();
    else if (words === 2) {
        var split = title.split(" ");
        return (split[0].substr(0, 2) + split[1].substr(0, 2)).toUpperCase();
    }
    else if (words === 3) {
        return title.split(" ").map(s => s[0]).join("").toUpperCase();
    }
    else {
        var wordsFilter = title.split(" ").filter(s => s !== "no" && s !== "of" && s !== "the");
        if (wordsFilter.length < 4)
            return getInitials(wordsFilter.join(" "));
        else
            return wordsFilter.slice(0, 4).map(s => s[0]).join("").toUpperCase();
    }
}
exports.getInitials = getInitials;
class Task extends lces_1.Component {
    constructor(url, list, providerId, provider) {
        super();
        this.title = "";
        this.cover = "";
        this.active = false;
        this.remove = false; // Whether to remove this task on the next tick
        this.currentDl = 0;
        this.settings = utils_2.deepCopy(state_1.state.task);
        this.loaded = false;
        this.url = url;
        this.id = tasks.length;
        tasks.push(this);
        this.providerId = providerId;
        this.provider = provider;
        this.list = list;
        // Create event
        this.newEvent("load");
    }
}
exports.Task = Task;
exports.media = [];
var MediaStatus;
(function (MediaStatus) {
    MediaStatus["IDLE"] = "IDLE";
    MediaStatus["ACTIVE"] = "ACTIVE";
    MediaStatus["PAUSED"] = "PAUSED";
    MediaStatus["FINISHED"] = "FINISHED";
})(MediaStatus = exports.MediaStatus || (exports.MediaStatus = {}));
;
class Media {
    constructor(title, fileName, taskMediaList, taskId) {
        this.selected = true;
        this.status = MediaStatus.IDLE;
        this.bytes = 0;
        this.size = null;
        this.sources = [];
        this.source = 0;
        this.sourceAttempts = 0;
        this.totalAttempts = 0;
        this.exhuastedSources = false;
        this.request = null;
        this.buffer = Buffer.alloc(0);
        this.bufferedBytes = 0; // Cleared every tick, used to calculate download speed
        this.lastUpdate = 0;
        this.speed = 0;
        this.id = exports.media.length;
        this.listId = taskMediaList.length;
        exports.media.push(this);
        this.title = title;
        this.fileName = fileName;
        this.taskId = taskId;
    }
    start() {
        if (this.status !== MediaStatus.IDLE && this.status !== MediaStatus.PAUSED) {
            return;
        }
        this.getTask().currentDl++;
        this.status = MediaStatus.ACTIVE;
        const source = this.sources[this.source];
        this.resolveSource(source);
    }
    stop(finished = false) {
        if (this.status !== MediaStatus.ACTIVE) {
            return;
        }
        if (this.request) {
            this.request.stop();
            this.request = null;
        }
        this.getTask().currentDl--;
        this.status = MediaStatus.PAUSED;
    }
    resolveSource(source) {
        switch (source.type) {
            case "direct":
                resolve_1.resolveProviderSource(source.url, (err, sources) => {
                    const boxedSources = sources.map(resSource => {
                        let box;
                        switch (resSource.type) {
                            case "mediasource":
                                const gresolver = facets_1.getFacetByHost("provider", resSource.url);
                                box = new MediaSourceDirect(resSource.url, resSource.resolver, gresolver.facetId);
                                break;
                            case "mirror":
                                const mirror = facets_1.getFacetByHost("mirror", resSource.url);
                                box = new MediaSourceMirror(resSource.url, resSource.resolver, mirror.facetId);
                                break;
                            case "stream":
                                const sresolver = facets_1.getFacet("streamresolver", resSource.resolver);
                                box = new MediaSourceStream(resSource.url, resSource.resolver, sresolver.facetId);
                                break;
                        }
                        box.parent = source.id;
                        return box;
                    });
                    this.sources.splice.apply(this.sources, [this.source + 1, 0].concat(boxedSources));
                    source.resolved = true;
                    // Reresolve
                    this.source++;
                    this.resolveSource(this.sources[this.source]);
                });
                break;
            case "mirror":
                resolve_1.resolveMirror(source.url, (err, data) => {
                    const mirror = facets_1.getFacetById("mirror", source.facetId);
                    const sresolver = facets_1.getFacet("streamresolver", mirror.resolver);
                    const mirrorResult = utils_1.type(data) === "object" ? data : {
                        url: data,
                    };
                    const stream = new MediaSourceStream(mirrorResult.url, mirror.resolver, sresolver.facetId);
                    stream.parent = source.id;
                    if (utils_1.type(mirrorResult.options) === "object")
                        stream.options = mirrorResult.options;
                    this.sources.splice(this.source + 1, 0, stream);
                    source.resolved = true;
                    // Reresolve
                    this.source++;
                    this.resolveSource(this.sources[this.source]);
                });
                break;
            case "stream":
                this.startStream(source);
                break;
        }
    }
    startStream(stream) {
        console.log(stream);
        // process.exit();
        const sresolver = facets_1.getFacetById("streamresolver", stream.facetId);
        const task = this.getTask();
        const out = new MediaStream(this);
        this.outStream = fs.createWriteStream(task.dlDir + path.sep + this.fileName, {
            encoding: "binary",
        });
        this.lastUpdate = Date.now();
        this.request = sresolver.resolve(stream.url, out, null, stream.options || {});
    }
    getTask() {
        return exports.crud.getTask(this.taskId);
    }
}
exports.Media = Media;
class MediaStream extends stream_1.Writable {
    constructor(media) {
        super({});
        this.media = media;
        this.mediaAttempt = media.totalAttempts;
    }
    setSize(size) {
        this.media.size = size;
    }
    _write(chunk, encoding, callback) {
        this.media.buffer = Buffer.concat([chunk, this.media.buffer], chunk.length + this.media.buffer.length);
        this.media.bufferedBytes += chunk.length;
        // FIXME: Maybe some checks here, maybe not
        callback();
    }
    _finish(callback) {
        this.media.request;
        // TODO: Wrap up things with our Media
        callback();
    }
}
exports.MediaStream = MediaStream;
const mediaSources = [];
var MediaSourceType;
(function (MediaSourceType) {
    MediaSourceType["Direct"] = "direct";
    MediaSourceType["Mirror"] = "mirror";
    MediaSourceType["Stream"] = "stream";
})(MediaSourceType = exports.MediaSourceType || (exports.MediaSourceType = {}));
;
class MediaSource {
    constructor() {
        this.resolved = false;
        this.options = {};
        this.id = mediaSources.length;
        mediaSources.push(this);
    }
}
exports.MediaSource = MediaSource;
class MediaSourceStream extends MediaSource {
    constructor(url, facet, facetId) {
        super();
        this.url = url;
        this.facet = facet;
        this.facetId = facetId;
        this.type = MediaSourceType.Stream;
    }
}
exports.MediaSourceStream = MediaSourceStream;
class MediaSourceMirror extends MediaSource {
    constructor(url, facet, facetId, // Mirror ID
    sourceStream = null) {
        super();
        this.url = url;
        this.facet = facet;
        this.facetId = facetId;
        this.sourceStream = sourceStream;
        this.type = MediaSourceType.Mirror;
    }
}
exports.MediaSourceMirror = MediaSourceMirror;
class MediaSourceDirect extends MediaSource {
    constructor(url, facet, facetId) {
        super();
        this.url = url;
        this.facet = facet;
        this.facetId = facetId;
        this.type = MediaSourceType.Direct;
    }
}
exports.MediaSourceDirect = MediaSourceDirect;
