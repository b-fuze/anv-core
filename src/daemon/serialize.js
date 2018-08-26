"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const tasks_1 = require("./tasks");
var ShapeType;
(function (ShapeType) {
    ShapeType[ShapeType["BASIC"] = 0] = "BASIC";
    ShapeType[ShapeType["ARRAY"] = 1] = "ARRAY";
    ShapeType[ShapeType["SELECT"] = 2] = "SELECT";
    ShapeType[ShapeType["CUSTOM"] = 3] = "CUSTOM";
})(ShapeType || (ShapeType = {}));
;
const taskShape = {
    url: "!string",
    title: "!string",
    cover: "!string",
    providerId: "!string",
    provider: "!string",
    active: "!boolean",
    settings: (settings) => {
        return utils_1.type(settings) === "object";
    },
};
const mediaShape = {
    title: "!string",
    fileName: "!string",
    selected: "!boolean",
    status: ["IDLE", "ACTIVE", "PENDING", "PAUSED", "FINISHED"],
    bytes: "!number",
    size: "number",
    totalAttempts: "!number",
    sources: "!array:number",
    source: "!number",
    streamData: "!object",
    emptyStreamData: "!boolean",
};
const mediaSourceShape = {
    id: "!number",
    type: [null, "direct", "mirror", "stream"],
    facet: "!string",
    facetId: "!string",
    facetType: "!string",
    url: "string",
    parent: "number",
    parentType: [null, "direct", "mirror", "stream"],
    resolved: "!boolean",
    options: (options) => {
        return utils_1.type(options) === "object";
    },
};
const taskShapeCache = buildShapeCache(taskShape);
const mediaShapeCache = buildShapeCache(mediaShape);
const mediaSourceShapeCache = buildShapeCache(mediaSourceShape);
class validate {
    static task(task) {
        const err = [];
        const valid = validateShapeCache(task, taskShapeCache, err) ? task : null;
        if (err.length) {
            console.log("ANV Corrupt Metadata:\n - " + err.join("\n - "));
        }
        return valid ? task : null;
    }
    static media(media) {
        const err = [];
        const valid = validateShapeCache(media, mediaShapeCache, err) ? media : null;
        if (err.length) {
            console.log("ANV Corrupt Metadata:\n - " + err.join("\n - "));
        }
        return valid ? media : null;
    }
    static mediaSource(mediaSource) {
        const err = [];
        const valid = validateShapeCache(mediaSource, mediaSourceShapeCache, err) ? mediaSource : null;
        if (err.length) {
            console.log("ANV Corrupt Metadata:\n - " + err.join("\n - "));
        }
        return valid ? mediaSource : null;
    }
}
exports.validate = validate;
function serialize(task) {
    const sTask = serializeFromShapeCache(task, taskShapeCache);
    const sMedia = [];
    const sMediaSources = [];
    const mediaSources = [];
    const sourceIdMap = {};
    for (const media of task.list) {
        let sourceStart = mediaSources.length;
        mediaSources.push.apply(mediaSources, media.sources);
        const mediaSerialized = serializeFromShapeCache(media, mediaShapeCache);
        mediaSerialized.sources = [];
        for (const source of media.sources) {
            const index = sourceStart++;
            sourceIdMap[source.id] = index;
            mediaSerialized.sources.push(index);
        }
        sMedia.push(mediaSerialized);
    }
    for (let i = 0; i < mediaSources.length; i++) {
        const source = mediaSources[i];
        const serializedSource = serializeFromShapeCache(source, mediaSourceShapeCache);
        serializedSource.id = i;
        if (serializedSource.parent) {
            serializedSource.parent = sourceIdMap[serializedSource.parent];
        }
        sMediaSources.push(serializedSource);
    }
    sTask.media = sMedia;
    sTask.mediaSources = sMediaSources;
    return sTask;
}
exports.serialize = serialize;
function deserialize(taskSrc, mediaList, mediaSourcesList) {
    const task = new tasks_1.Task(taskSrc.url, [], taskSrc.providerId, taskSrc.provider);
    // Copy props
    task.title = taskSrc.title;
    task.cover = taskSrc.cover;
    task.active = taskSrc.active;
    task.settings = taskSrc.settings;
    const mediaSourcesMap = {};
    const mediaSourcesDeserialized = [];
    const mediaSourceIdBaseOffset = tasks_1.mediaSources.length;
    for (const sourceSrc of mediaSourcesList) {
        let box;
        switch (sourceSrc.type) {
            case tasks_1.MediaSourceType.Direct:
                box = new tasks_1.MediaSourceDirect(sourceSrc.url, sourceSrc.facet, sourceSrc.facetId);
                break;
            case tasks_1.MediaSourceType.Mirror:
                box = new tasks_1.MediaSourceMirror(sourceSrc.url, sourceSrc.facet, sourceSrc.facetId);
                break;
            case tasks_1.MediaSourceType.Stream:
                box = new tasks_1.MediaSourceStream(sourceSrc.url, sourceSrc.facet, sourceSrc.facetId);
                break;
        }
        // Copy props
        box.facetType = sourceSrc.facetType;
        box.parent = sourceSrc.parent === null ? null : sourceSrc.parent + mediaSourceIdBaseOffset;
        box.parentType = sourceSrc.parentType;
        box.resolved = sourceSrc.resolved;
        box.options = sourceSrc.options;
        mediaSourcesMap[sourceSrc.id] = box;
        mediaSourcesDeserialized.push(box);
    }
    for (const mediaSrc of mediaList) {
        const media = new tasks_1.Media(mediaSrc.title, mediaSrc.fileName, task.list, task.id);
        // Copy props
        media.selected = mediaSrc.selected;
        media.status = mediaSrc.status;
        media.bytes = mediaSrc.bytes;
        media.size = mediaSrc.size;
        media.totalAttempts = mediaSrc.totalAttempts;
        media.source = mediaSrc.source;
        media.streamData = mediaSrc.streamData;
        media.emptyStreamData = mediaSrc.emptyStreamData;
        for (const source of mediaSrc.sources) {
            media.sources.push(mediaSourcesMap[source]);
        }
        task.list.push(media);
    }
    return task;
}
exports.deserialize = deserialize;
function buildShapeCache(shape) {
    const cache = [];
    for (const key of Object.keys(shape)) {
        const value = shape[key];
        const cacheItem = [key, ShapeType.BASIC, null, false];
        switch (utils_1.type(value)) {
            case "string":
                const types = value.split(":");
                let required = false;
                if (types[0][0] === "!") {
                    required = true;
                    types[0] = types[0].substr(1);
                }
                if (types[0] === "array") {
                    cacheItem[1] = ShapeType.ARRAY;
                    cacheItem[2] = types[1] || null;
                }
                else {
                    cacheItem[1] = ShapeType.BASIC;
                    cacheItem[2] = types[0];
                }
                cacheItem[3] = required;
                break;
            case "array":
                cacheItem[1] = ShapeType.SELECT;
                cacheItem[2] = value;
                break;
            case "function":
                cacheItem[1] = ShapeType.CUSTOM;
                cacheItem[2] = value;
                break;
        }
        cache.push(cacheItem);
    }
    return cache;
}
function validateShapeCache(data, shape, errors) {
    for (const [key, shapeType, valueType, required] of shape) {
        const dataValue = data[key];
        const dataValueType = utils_1.type(dataValue);
        const dataHasValue = key in data;
        switch (shapeType) {
            case ShapeType.BASIC:
                if (required && (dataValue === null || dataValue === undefined)
                    || !required && dataValueType !== valueType && dataValue !== null) {
                    errors.push(`Wrong basic data type for "${key}", is "${dataValueType}" should be "${valueType}"`);
                    return false;
                }
                break;
            case ShapeType.ARRAY:
                if (dataValueType !== "array"
                    || valueType && !dataValue.every(item => utils_1.type(item) === valueType)) {
                    errors.push(`Wrong array items types for "${key}", should be "${valueType}"`);
                    return false;
                }
                break;
            case ShapeType.SELECT:
                let valid = false;
                typeLoop: for (const value of valueType) {
                    if (dataValue === value) {
                        valid = true;
                        break typeLoop;
                    }
                }
                if (!valid) {
                    errors.push(`Wrong select data type for "${key}", is "${dataValue}" should be "${valueType.join(", ")}"`);
                    return false;
                }
                break;
            case ShapeType.CUSTOM:
                if (!valueType(dataValue)) {
                    errors.push(`Wrong custom data type for "${key}", is "${dataValueType}"`);
                    return false;
                }
                break;
        }
    }
    return true;
}
function serializeFromShapeCache(base, shape) {
    const out = {};
    for (const [key] of shape) {
        out[key] = base[key];
    }
    return out;
}
