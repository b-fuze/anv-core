"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
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
class Task {
    constructor(list, providerId, provider) {
        this.url = "";
        this.active = false;
        this.remove = false; // Whether to remove this task on the next tick
        this.id = tasks.length;
        tasks.push(this);
        this.providerId = providerId;
        this.provider = provider;
        this.list = list;
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
    constructor(title, fileName, taskMediaList) {
        this.selected = true;
        this.status = MediaStatus.IDLE;
        this.bytes = 0;
        this.size = null;
        this.sources = [];
        this.source = 0;
        this.sourceAttempts = 0;
        this.exhuastedSources = false;
        this.id = exports.media.length;
        this.listId = taskMediaList.length;
        exports.media.push(this);
        this.title = title;
        this.fileName = fileName;
    }
}
exports.Media = Media;
class MediaStream extends stream_1.Writable {
    constructor(media) {
        super({});
        this.media = media;
    }
    setSize(size) {
        this.media.size = size;
    }
    _write(chunk, encoding, callback) {
        // FIXME: Maybe some checks here, maybe not
        callback();
    }
}
exports.MediaStream = MediaStream;
var MediaSourceType;
(function (MediaSourceType) {
    MediaSourceType["Mirror"] = "mirror";
    MediaSourceType["Stream"] = "stream";
})(MediaSourceType = exports.MediaSourceType || (exports.MediaSourceType = {}));
;
class MediaSourceStream {
    constructor(url, facetId) {
        this.url = url;
        this.facetId = facetId;
        this.type = MediaSourceType.Mirror;
    }
}
exports.MediaSourceStream = MediaSourceStream;
class MediaSourceMirror {
    constructor(url, mirror, facetId, // Mirror ID
    sourceStream = null) {
        this.url = url;
        this.mirror = mirror;
        this.facetId = facetId;
        this.sourceStream = sourceStream;
        this.type = MediaSourceType.Stream;
    }
}
exports.MediaSourceMirror = MediaSourceMirror;
