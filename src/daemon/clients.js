"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const jshorts_1 = require("jshorts");
const utils_1 = require("./utils");
const facets_1 = require("./facets");
const queue_1 = require("./queue");
const tasks_1 = require("./tasks");
const resolve_1 = require("./resolve");
const serialize_1 = require("./serialize");
const tiers_1 = require("./tiers");
var Instruction;
(function (Instruction) {
    Instruction["Load"] = "load";
    Instruction["Select"] = "select";
    Instruction["Start"] = "start";
    Instruction["Stop"] = "stop";
    Instruction["Delete"] = "delete";
})(Instruction = exports.Instruction || (exports.Instruction = {}));
exports.instructions = {
    load(url, done) {
        const parsed = url_1.parse(url);
        if (parsed.host) {
            const provider = facets_1.getFacetByHost("provider", url);
            if (provider && provider.validUrl(url, true)) {
                const task = new tasks_1.Task(url, [], provider.facetId, provider.name);
                done(null, task.id);
                queue_1.queueAdd("provider", provider.facetId, () => {
                    resolve_1.resolveProvider(url, (err, metadata) => {
                        if (err) {
                            console.error("ANV: Error loading metadata for task " + task.id);
                        }
                        else {
                            task.title = metadata.title;
                            task.cover = metadata.cover;
                            task.dlDir = task.settings.dlPath + path.sep + tasks_1.getSimpleName(task.title);
                            task.metaFile = task.dlDir + path.sep + ".anv" + path.sep + "meta";
                            let fileNameBase = task.settings.minimalFileName ? tasks_1.getInitials(task.title) : tasks_1.getSimpleName(task.title);
                            if (/^.+\d$/.test(fileNameBase)) {
                                fileNameBase += "-";
                            }
                            for (const source of metadata.sources) {
                                let facet;
                                const fileName = fileNameBase
                                    + (source.number !== undefined
                                        ? (task.settings.numberPad
                                            ? utils_1.getPadding(source.number, Math.max(Math.pow(10, Math.max(0, task.settings.padMinLength - 1)), metadata.sources.length))
                                            : source.number)
                                        : "")
                                    + (source.title !== undefined
                                        ? " " + source.title
                                        : "")
                                    + "." + source.fileExtension;
                                const media = new tasks_1.Media(source.number, fileName, task.list, task.id);
                                task.list.push(media);
                                // FIXME: Why this IIFE?
                                void function addSources(media, source) {
                                    switch (source.type) {
                                        case "mediasource":
                                            facet = facets_1.getFacetByHost("provider", source.url);
                                            media.sources.push(new tasks_1.MediaSourceDirect(source.url, facet.name, facet.facetId));
                                            break;
                                        case "mirror":
                                            facet = facets_1.getFacetByHost("mirror", source.url);
                                            media.sources.push(new tasks_1.MediaSourceMirror(source.url, facet.name, facet.facetId));
                                            break;
                                        case "stream":
                                            facet = facets_1.getFacet("streamresolver", source.resolver);
                                            media.sources.push(new tasks_1.MediaSourceStream(source.url, facet.name, facet.facetId));
                                            break;
                                        case "media":
                                            // Grouped sources
                                            for (const src of tiers_1.rankItems("provider", provider.name, source.sources, task.settings.tiers)) {
                                                addSources(media, src);
                                            }
                                            break;
                                    }
                                }(media, source);
                            }
                            // Create dl directory
                            fs.stat(task.dlDir, (err, stats) => {
                                if (err && err.code === 'ENOENT') {
                                    fs.mkdir(task.dlDir, (err) => {
                                        if (!err) {
                                            fs.mkdir(task.dlDir + path.sep + ".anv", err => {
                                                task.loaded = true;
                                                task.triggerEvent("load", true);
                                            });
                                        }
                                        else {
                                            console.error("ANV: Error creating directory for task " + task.id, err);
                                        }
                                    });
                                }
                                else {
                                    console.error("ANV: Directory for task already exists \"" + task.dlDir + "\"");
                                }
                            });
                        }
                    });
                });
            }
            else {
                done("No provider found for " + url, null);
            }
        }
        else {
            done("Invalid url", null);
        }
    },
    loadLocal(localPath, verified = false, done) {
        // FIXME: Flatten this with promises
        const anvPath = localPath + path.sep + ".anv";
        const metaPath = anvPath + path.sep + "meta";
        function load(localPath) {
            fs.readFile(metaPath, { encoding: "utf8" }, (err, metadata) => {
                const rawTask = jshorts_1.jSh.parseJSON(metadata);
                if (rawTask && !rawTask.error) {
                    const task = serialize_1.validate.task(rawTask);
                    if (task) {
                        // We have a valid task
                        let validData = true;
                        let media = [];
                        let mediaSources = [];
                        for (const rawMedia of task.media) {
                            const verified = serialize_1.validate.media(rawMedia);
                            if (verified) {
                                if (verified.status === tasks_1.MediaStatus.PENDING) {
                                    // Reset Pending media to Idle
                                    verified.status = tasks_1.MediaStatus.IDLE;
                                }
                                if (verified.source >= verified.sources.length) {
                                    // Reset media's source index to a valid source
                                    verified.source = Math.max(verified.sources.length - 1, 0);
                                    // FIXME: Use logging mechanism
                                    console.log(`Warning: Media "${verified.fileName}" has an invalid source index, from Task "${task.title}"`);
                                }
                                media.push(verified);
                            }
                            else {
                                validData = false;
                                break;
                            }
                        }
                        // FIXME: Use better error mechanisms
                        if (!validData) {
                            return false;
                        }
                        for (const rawMediaSource of task.mediaSources) {
                            const verified = serialize_1.validate.mediaSource(rawMediaSource);
                            if (verified) {
                                mediaSources.push(verified);
                            }
                            else {
                                validData = false;
                                break;
                            }
                        }
                        if (!validData) {
                            return false;
                        }
                        // Deserialize
                        const readyTask = serialize_1.deserialize(task, media, mediaSources);
                        readyTask.metaFile = metaPath;
                        readyTask.dlDir = readyTask.settings.dlPath + path.sep + tasks_1.getSimpleName(readyTask.title);
                        readyTask.loaded = true;
                        for (const media of readyTask.list) {
                            if (media.status === tasks_1.MediaStatus.FINISHED) {
                                readyTask.finishedFromStart++;
                            }
                        }
                        // Update dlPath setting
                        readyTask.settings.dlPath = path.dirname(localPath);
                        done(null, readyTask.id);
                    }
                }
            });
        }
        if (verified) {
            load(localPath);
        }
        else {
            fs.stat(metaPath, (err, stat) => {
                if (!err && stat.isFile()) {
                    console.log("Loading: " + localPath);
                    load(localPath);
                }
            });
        }
    },
    taskFromList(taskBase, done) {
        const task = new tasks_1.Task(taskBase.url || "https://anv.io/url", [], "", "");
        done(null, task.id);
        task.title = taskBase.title || "Untitled";
        task.cover = taskBase.cover || "";
        // FIXME: DRY with .load(...)
        task.dlDir = task.settings.dlPath + path.sep + tasks_1.getSimpleName(task.title);
        task.metaFile = task.dlDir + path.sep + ".anv" + path.sep + "meta";
        let fileNameBase = task.settings.minimalFileName ? tasks_1.getInitials(task.title) : tasks_1.getSimpleName(task.title);
        if (/^.+\d$/.test(fileNameBase)) {
            fileNameBase += "-";
        }
        for (let i = 0; i < taskBase.list.length; i++) {
            const source = taskBase.list[i];
            const facet = facets_1.getFacetByHost("mirror", source.url);
            if (facet) {
                const media = new tasks_1.Media(i + 1 + "", source.filename, task.list, task.id);
                task.list.push(media);
                media.sources.push(new tasks_1.MediaSourceMirror(source.url, facet.name, facet.facetId));
            }
            else {
                console.error("ANV.taskFromList: No facet found for (" + source.url + ")");
            }
        }
        // Create dl directory
        fs.stat(task.dlDir, (err, stats) => {
            if (err && err.code === 'ENOENT') {
                fs.mkdir(task.dlDir, (err) => {
                    if (!err) {
                        fs.mkdir(task.dlDir + path.sep + ".anv", err => {
                            task.loaded = true;
                            task.triggerEvent("load", true);
                        });
                    }
                    else {
                        console.error("ANV: Error creating directory for task " + task.id, err);
                    }
                });
            }
            else {
                console.error("ANV: Directory for task already exists \"" + task.dlDir + "\"");
            }
        });
    },
    select(taskId) {
    },
    start(taskId) {
    },
    stop(taskId, done) {
        const task = tasks_1.crud.getTask(taskId);
        if (!(task.loaded && task.metaFile)) {
            // There's nothing to stop
            done(null);
        }
        let toComplete = 1;
        let finished = 0;
        if (task) {
            task.active = false;
            for (const media of task.list) {
                if (media.status === tasks_1.MediaStatus.ACTIVE) {
                    media.stop(false, () => {
                        finished++;
                        if (finished === toComplete) {
                            done(null);
                        }
                    });
                    toComplete++;
                }
            }
            // Serialize
            const serialized = serialize_1.serialize(task);
            fs.writeFile(task.metaFile, JSON.stringify(serialized), err => {
                if (err) {
                    console.log("ANV: Error writing task metadata for #" + task.id + " - " + task.title + "\n" + err);
                }
                else {
                    finished++;
                    if (finished === toComplete) {
                        done(null);
                    }
                }
            });
        }
    },
    // FIXME: mediaList type
    delete(taskId, mediaList) {
    },
};
function instruction(data, conn) {
}
exports.instruction = instruction;
