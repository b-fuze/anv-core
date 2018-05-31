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
const utils_1 = require("./utils");
const facets_1 = require("./facets");
const tasks_1 = require("./tasks");
const resolve_1 = require("./resolve");
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
                resolve_1.resolveProvider(url, (err, metadata) => {
                    if (err) {
                        console.error("ANV: Error loading metadata for task " + task.id);
                    }
                    else {
                        task.title = metadata.title;
                        task.cover = metadata.cover;
                        task.dlDir = task.settings.dlPath + path.sep + tasks_1.getSimpleName(task.title);
                        const fileNameBase = task.settings.minimalFileName ? tasks_1.getInitials(task.title) : tasks_1.getSimpleName(task.title);
                        for (const source of metadata.sources) {
                            let facet;
                            const fileName = fileNameBase
                                + (task.settings.numberPad
                                    ? utils_1.getPadding(source.number, Math.max(Math.pow(10, Math.max(0, task.settings.padMinLength - 1)), metadata.sources.length))
                                    : source.number)
                                + "." + source.fileExtension;
                            const media = new tasks_1.Media(source.number, fileName, task.list, task.id);
                            task.list.push(media);
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
                            }
                        }
                        // Create dl directory
                        fs.stat(task.dlDir, (err, stats) => {
                            if (err && err.code === 'ENOENT') {
                                fs.mkdir(task.dlDir, (err) => {
                                    if (!err) {
                                        task.loaded = true;
                                        task.triggerEvent("load", true);
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
            }
            else {
                done("No provider found for " + url, null);
            }
        }
        else {
            done("Invalid url", null);
        }
    },
    select(taskId) {
    },
    start(taskId) {
    },
    stop(taskId) {
    },
    // FIXME: mediaList type
    delete(taskId, mediaList) {
    },
};
function instruction(data, conn) {
}
exports.instruction = instruction;
