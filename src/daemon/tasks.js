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
const tiers_1 = require("./tiers");
const resolve_1 = require("./resolve");
const state_1 = require("./state");
const queue_1 = require("./queue");
const utils_2 = require("./utils");
const tasks = [null];
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
    static deleteTaskMediaFile(id, media) {
        return this.hasTaskThen(id, task => {
        });
    }
    static resetTaskMedia(id, media) {
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
exports.media = [null];
var MediaStatus;
(function (MediaStatus) {
    MediaStatus["IDLE"] = "IDLE";
    MediaStatus["ACTIVE"] = "ACTIVE";
    MediaStatus["PENDING"] = "PENDING";
    MediaStatus["PAUSED"] = "PAUSED";
    MediaStatus["FINISHED"] = "FINISHED";
})(MediaStatus = exports.MediaStatus || (exports.MediaStatus = {}));
;
// FIXME: Multiple terms for the same things
exports.mediaSourceFacetMap = {
    direct: "provider",
    mirror: "mirror",
    stream: "streamresolver",
};
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
        this.buffers = [];
        this.bufferedBytes = 0; // Cleared every tick, used to calculate download speed
        this.lastUpdate = 0;
        this.speed = 0;
        this.queueId = null;
        this.id = exports.media.length;
        this.listId = taskMediaList.length;
        exports.media.push(this);
        this.title = title;
        this.fileName = fileName;
        this.taskId = taskId;
    }
    setStatus(status) {
        if (status !== this.status) {
            const task = this.getTask();
            const oldStatus = this.status;
            this.status = status;
            let compare = [oldStatus, status].map(status => {
                switch (status) {
                    case MediaStatus.IDLE:
                    case MediaStatus.PAUSED:
                    case MediaStatus.FINISHED:
                        return -1;
                    case MediaStatus.PENDING:
                    case MediaStatus.ACTIVE:
                        return 1;
                }
            });
            if (compare[0] !== compare[1]) {
                state_1.tmpState.currentDl += compare[1];
                task.currentDl += compare[1];
            }
        }
    }
    start() {
        if (this.status !== MediaStatus.IDLE
            && this.status !== MediaStatus.PAUSED
            && this.status !== MediaStatus.PENDING) {
            return;
        }
        const source = this.getSource();
        if (this.queueId === null) {
            this.addQueue(source);
        }
        else {
            this.setStatus(MediaStatus.ACTIVE);
            this.resolveSource(source);
        }
    }
    addQueue(source) {
        const facetType = exports.mediaSourceFacetMap[source.type];
        const facet = facets_1.getFacetById(facetType, source.facetId);
        const facetQueueMap = {
            direct: "provider",
            mirror: "mirror",
            // FIXME: No providerstream atm
            stream: "providerstream",
        };
        // Add to queue
        this.queueId = queue_1.queueAdd(facetQueueMap[source.type], facet.facetId, null, this.id);
        this.setStatus(MediaStatus.PENDING);
    }
    stop(finished = false) {
        if (this.status !== MediaStatus.ACTIVE && this.status !== MediaStatus.FINISHED) {
            return;
        }
        if (this.request) {
            this.request.stop();
            this.request = null;
        }
        this.setStatus(MediaStatus.PAUSED);
    }
    nextSource() {
        return ++this.source;
    }
    getSource() {
        return this.sources[this.source];
    }
    resolveSource(source) {
        const task = this.getTask();
        switch (source.type) {
            case "direct":
                resolve_1.resolveProviderSource(source.url, this.sources.length !== 1, (err, sources) => {
                    if (err) {
                        console.log("ANV Provider Error: ", err);
                        this.reattemptSources();
                    }
                    else {
                        const boxedSources = tiers_1.rankItems("provider", source.facet, sources, task.settings.tiers).map(resSource => {
                            let box;
                            switch (resSource.type) {
                                case "mediasource":
                                    const gresolver = facets_1.getFacetByHost("provider", resSource.url);
                                    box = new MediaSourceDirect(resSource.url, gresolver.name, gresolver.facetId);
                                    break;
                                case "mirror":
                                    const mirror = facets_1.getFacetByHost("mirror", resSource.url);
                                    box = new MediaSourceMirror(resSource.url, mirror.name, mirror.facetId);
                                    break;
                                case "stream":
                                    // FIXME: Default stream resolver is probably a bug
                                    const sresolver = facets_1.getFacet("streamresolver", resSource.resolver || "basic");
                                    box = new MediaSourceStream(resSource.url, sresolver.name, sresolver.facetId);
                                    break;
                            }
                            box.parent = source.id;
                            box.parentType = source.type;
                            return box;
                        });
                        this.sources.splice.apply(this.sources, [this.source + 1, 0].concat(boxedSources));
                        source.resolved = true;
                        // Reresolve
                        this.nextSource();
                        const curSource = this.sources[this.source];
                        if (!curSource) {
                            console.log("No sources for Media #" + this.id + " - " + this.fileName);
                            return this.setStatus(MediaStatus.FINISHED);
                        }
                        this.addQueue(curSource);
                    }
                });
                break;
            case "mirror":
                resolve_1.resolveMirror(source.url, (err, data) => {
                    if (!data) {
                        // Mirror says the this is a bad source
                        this.setStatus(MediaStatus.PENDING);
                        return this.reattemptSources(true);
                    }
                    const mirror = facets_1.getFacetById("mirror", source.facetId);
                    const sresolver = facets_1.getFacet("streamresolver", mirror.streamResolver);
                    const mirrorResult = utils_1.type(data) === "object" ? data : {
                        url: data,
                    };
                    const stream = new MediaSourceStream(mirrorResult.url, mirror.streamResolver, sresolver.facetId);
                    stream.parent = source.id;
                    stream.parentType = MediaSourceType.Mirror;
                    if (utils_1.type(mirrorResult.options) === "object")
                        stream.options = mirrorResult.options;
                    this.sources.splice(this.source + 1, 0, stream);
                    source.resolved = true;
                    // Reresolve
                    this.nextSource();
                    this.queueId = queue_1.queueAdd("mirrorstream", mirror.facetId, null, this.id);
                    this.setStatus(MediaStatus.PENDING);
                });
                break;
            case "stream":
                this.startStream(source);
                break;
        }
    }
    // FIXME: Tidy this up
    reattemptSources(skip = false) {
        const media = this;
        const task = media.getTask();
        media.totalAttempts++;
        console.log("ANV Stream Error for source #" + media.source + " in Media #" + media.id + " - " + media.fileName);
        if (skip || media.sourceAttempts >= state_1.state.maxSourceRetries) {
            // Give up
            console.log(`Skipping bad source #${media.source} (${media.sources[media.source].url}) in Media #${media.id} - ${media.fileName}`);
            media.sourceAttempts = 0;
            this.nextSource();
            if (media.sources[media.source]) {
                media.resolveSource(this.getSource());
            }
            else {
                media.setStatus(MediaStatus.FINISHED);
                media.exhuastedSources = true;
                console.log(`Exhausted all sources for Media #${media.id} - ${media.fileName}`);
            }
        }
        else {
            // Try again
            media.sourceAttempts++;
            console.log(`Reattempt #${media.sourceAttempts} for source #${media.source} in Media #${media.id} - ${media.fileName}`);
            media.resolveSource(media.sources[media.source]);
        }
    }
    startStream(stream) {
        let parentSource;
        if (!state_1.state.ignoreMaxConnections && stream.parentType === MediaSourceType.Mirror) {
            const parent = exports.mediaSources[stream.parent];
            const facet = parentSource = facets_1.getFacetById("mirror", parent.facetId);
            // Are there too many connections being used now?
            if (facet.maxConnections && facet.connectionCount === facet.maxConnections) {
                // Can we skip and are there are any more sources to use? FIXME: Check the following sources aren't also the same mirror
                if (state_1.state.skipOccupiedMirrors && this.source + 1 < this.sources.length) {
                    this.nextSource();
                    const source = this.getSource();
                    const facet = facets_1.getFacetById(exports.mediaSourceFacetMap[source.type], source.facetId);
                    const streamFacetQueueMap = {
                        // FIXME: No such thing as "providerstream"
                        provider: "providerstream",
                        mirror: "mirrorstream",
                    };
                    // Add to queue
                    this.queueId = queue_1.queueAdd(streamFacetQueueMap[source.type], facet.facetId, null, this.id);
                    return this.setStatus(MediaStatus.PENDING);
                }
                else {
                    // Just wait
                    return this.setStatus(MediaStatus.PENDING);
                }
            }
        }
        const sresolver = facets_1.getFacetById("streamresolver", stream.facetId);
        const task = this.getTask();
        const out = new MediaStream(this);
        if (!this.outStream) {
            this.outStream = fs.createWriteStream(task.dlDir + path.sep + this.fileName);
        }
        this.lastUpdate = Date.now();
        this.request = sresolver.resolve(stream.url, this.bytes, out, null, stream.options || {});
        sresolver.lastUse = Date.now();
        if (parentSource) {
            parentSource.connectionCount++;
        }
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
    error(err) {
        this.end();
        this.media.reattemptSources();
    }
    _write(chunk, encoding, callback) {
        this.media.buffers.push(chunk);
        this.media.bufferedBytes += chunk.length;
        // FIXME: Maybe some checks here, maybe not
        callback();
    }
    _final(callback) {
        // TODO: Wrap up things with our Media
        callback();
    }
}
exports.MediaStream = MediaStream;
exports.mediaSources = [null];
var MediaSourceType;
(function (MediaSourceType) {
    MediaSourceType["Direct"] = "direct";
    MediaSourceType["Mirror"] = "mirror";
    MediaSourceType["Stream"] = "stream";
})(MediaSourceType = exports.MediaSourceType || (exports.MediaSourceType = {}));
;
class MediaSource {
    constructor() {
        this.parent = null;
        this.resolved = false;
        this.options = {};
        this.id = exports.mediaSources.length;
        exports.mediaSources.push(this);
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
        this.facetType = "streamresolver";
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
        this.facetType = "mirror";
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
        this.facetType = "provider";
    }
}
exports.MediaSourceDirect = MediaSourceDirect;
