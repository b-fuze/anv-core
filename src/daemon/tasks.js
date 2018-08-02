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
// DEBUG
global.ANV.tasks = tasks;
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
    // Media
    static getActiveMedia() {
        return exports.mediaByStatus.ACTIVE;
    }
    static getPendingMedia() {
        return exports.mediaByStatus.PENDING;
    }
    static getMediaSource(id) {
        return exports.mediaSources[id] || null;
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
        this.finishedFromStart = 0; // FIXME: Find a better name
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
exports.mediaByStatus = {
    ACTIVE: [],
    PENDING: [],
};
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
        this.pendingBlocked = false;
        this.bytes = 0;
        this.size = null;
        this.sources = [];
        this.source = 0;
        this.sourceAttempts = 0;
        this.totalAttempts = 0;
        this.exhuastedSources = false;
        this.request = null;
        this.streamData = {};
        this.emptyStreamData = true;
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
            const oldStatusArray = exports.mediaByStatus[oldStatus];
            const newStatusArray = exports.mediaByStatus[status];
            if (oldStatusArray) {
                const index = oldStatusArray.indexOf(this);
                if (index !== -1) {
                    oldStatusArray.splice(index, 1);
                }
            }
            if (newStatusArray) {
                newStatusArray.push(this);
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
        // FIXME: This logic may be confusing
        if (this.queueId === null && this.status !== MediaStatus.PAUSED) {
            this.addQueue(source);
        }
        else {
            this.setStatus(MediaStatus.ACTIVE);
            this.resolveSource(source);
        }
    }
    addQueue(source) {
        let refSource = source;
        let streamChild = false;
        // Remap stream sources to their parents if any
        if (source.type === MediaSourceType.Stream) {
            streamChild = true;
            if (source.parent) {
                refSource = exports.crud.getMediaSource(source.parent);
            }
            else {
                // There's no parent, resolve this now
                return this.resolveSource(source);
            }
        }
        const facetType = exports.mediaSourceFacetMap[refSource.type];
        const facet = facets_1.getFacetById(facetType, refSource.facetId);
        const facetQueueMap = {
            direct: "provider",
            mirror: "mirror",
        };
        // For stream sources' parents
        const streamQueueMap = {
            direct: "providerstream",
            mirror: "mirrorstream",
        };
        // Add to queue
        this.queueId = queue_1.queueAdd((streamChild
            ? streamQueueMap[refSource.type]
            : facetQueueMap[refSource.type]), facet.facetId, null, this.id);
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
        // Reset stream data
        this.streamData = {};
        this.emptyStreamData = true;
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
                    if (err || !sources) {
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
                                    if (!mirror) {
                                        console.error("ANV Error: No mirror found for: " + resSource.url);
                                        return null;
                                    }
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
                        }).filter(box => box !== null);
                        this.sources.splice.apply(this.sources, [this.source + 1, 0].concat(boxedSources));
                        source.resolved = true;
                        // Reresolve
                        this.nextSource();
                        const curSource = this.getSource();
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
                        if (err) {
                            console.error("ANV Mirror Error: " + err);
                        }
                        // Mirror says the this is a bad source
                        this.setStatus(MediaStatus.PENDING);
                        return this.reattemptSources(true);
                    }
                    const mirrorResult = utils_1.type(data) === "object" ? data : {
                        url: data,
                    };
                    if (mirrorResult.type === "mirror") {
                        const mirror = facets_1.getFacetByHost("mirror", data.url);
                        if (mirror) {
                            // We have to reresolve this mirror
                            const box = new MediaSourceMirror(data.url, mirror.name, mirror.facetId);
                            this.sources.splice(this.source + 1, 0, box);
                            box.parent = source.id;
                            box.parentType = MediaSourceType.Mirror;
                            this.nextSource();
                            const curSource = this.getSource();
                            this.addQueue(curSource);
                        }
                        else {
                            // FIXME: ERROR
                        }
                    }
                    else {
                        // We have a direct stream
                        const mirror = facets_1.getFacetById("mirror", source.facetId);
                        const sresolver = facets_1.getFacet("streamresolver", mirror.streamResolver);
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
                    }
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
            // Remove connections for this source FIXME: This might be bad design
            this.decreaseMirrorConn(this.getSource());
            // Go to the next source
            this.nextSource();
            // Reset media properties
            this.bytes = 0;
            this.bufferedBytes = 0;
            this.size = null;
            this.buffers = [];
            if (this.outStream) {
                this.pendingBlocked = true;
                this.outStream.end(() => {
                    fs.writeFile(this.getFilePath(), Buffer.alloc(0), (err) => {
                        if (!err) {
                            // FIXME: Log the error somewhere
                            this.pendingBlocked = false;
                        }
                    });
                });
                this.outStream = null;
            }
            const newSource = this.getSource();
            if (newSource) {
                // FIXME: Use queue here or smth
                setTimeout(() => {
                    media.resolveSource(newSource);
                }, 1000);
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
            // FIXME: Use queue here or smth
            setTimeout(() => {
                media.resolveSource(this.getSource());
            }, 1000);
        }
    }
    decreaseMirrorConn(stream) {
        if (stream.parentType === MediaSourceType.Mirror) {
            const mirror = exports.mediaSources[stream.parent];
            const facet = facets_1.getFacetById("mirror", mirror.facetId);
            // Mark mirror facet as done
            facet.connectionCount--;
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
        const out = this.bufferStream = new MediaStream(this);
        if (!this.outStream) {
            this.outStream = fs.createWriteStream(this.getFilePath(), {
                flags: "a",
                encoding: "binary",
            });
        }
        if (this.emptyStreamData) {
            this.streamData = sresolver.streamData || {};
            this.emptyStreamData = false;
        }
        this.lastUpdate = Date.now();
        this.request = sresolver.resolve(stream.url, this.bytes, out, null, stream.options || {});
        sresolver.lastUse = Date.now();
        if (parentSource && !this.sourceAttempts) {
            parentSource.connectionCount++;
        }
    }
    getTask() {
        return exports.crud.getTask(this.taskId);
    }
    getFilePath() {
        return this.getTask().dlDir + path.sep + this.fileName;
    }
}
exports.Media = Media;
class MediaStream extends stream_1.Writable {
    constructor(media) {
        super({});
        this.media = media;
        this.finished = false;
        this.mediaAttempt = media.totalAttempts;
    }
    setSize(size) {
        if (this.mediaAttempt === this.media.totalAttempts && !this.media.size) {
            this.media.size = size;
        }
    }
    setStreamData(data) {
        if (this.mediaAttempt === this.media.totalAttempts && utils_1.type(data) === "object") {
            this.media.streamData = data;
        }
    }
    getStreamData() {
        return this.media.streamData;
    }
    getAccumBytes() {
        return this.media.bytes;
    }
    error(err) {
        if (this.mediaAttempt === this.media.totalAttempts) {
            this.end();
            this.media.reattemptSources();
        }
    }
    _write(chunk, encoding, callback) {
        if (this.mediaAttempt === this.media.totalAttempts) {
            this.media.buffers.push(chunk);
            this.media.bufferedBytes += chunk.length;
        }
        // FIXME: Maybe some checks here, maybe not
        callback();
    }
    _final(callback) {
        // TODO: Wrap up things with our Media
        callback();
        this.finished = true;
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
        this.parentType = null;
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
