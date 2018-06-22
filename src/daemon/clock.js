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
const utils_1 = require("./utils");
const state_1 = require("./state");
const tasks_1 = require("./tasks");
const tick_1 = require("./tick");
const queue_1 = require("./queue");
const serialize_1 = require("./serialize");
function taskActiveCount(task) {
    return task.list.filter(m => (m.selected && m.status === tasks_1.MediaStatus.ACTIVE)).length;
}
function taskFinishedCount(task) {
    return task.list.filter(m => (m.selected && m.status === tasks_1.MediaStatus.FINISHED)).length;
}
function getTasksByFairness(tasks) {
    return (state_1.state.taskFairness
        ? tasks.slice().sort((a, b) => (taskFinishedCount(a) - taskFinishedCount(b)) + (taskActiveCount(a) - taskActiveCount(b)))
        : tasks.slice());
}
// FIXME: Unnecessary term clash made this a requirement
const sourceQueueMap = {
    direct: "provider",
    mirror: "mirror",
};
function exhuastedConcurrent(task, activeMedia, setActive) {
    return (state_1.state.maxGlobalConcurrentDl
        && state_1.tmpState.currentDl >= state_1.state.maxGlobalConcurrentDl
        && activeMedia === task.currentDl
        || !state_1.state.maxGlobalConcurrentDl
            && activeMedia >= state_1.state.maxConcurrentDl);
}
function clock() {
    const clock = tick_1.startTick([50, state_1.state.tickDelay, 2000], (tasks, intervals) => {
        let available = state_1.state.maxGlobalConcurrentDl
            ? state_1.state.maxGlobalConcurrentDl - state_1.tmpState.currentDl
            : 1;
        let oldAvailable = available;
        let iterations = 0;
        // Add new media
        while (!iterations || available > 0 && !(iterations && oldAvailable === available)) {
            oldAvailable = available;
            taskLoop: for (const task of getTasksByFairness(tasks)) {
                if (!task.active) {
                    continue taskLoop;
                }
                let activeMedia = 0;
                let setActive = 0;
                mediaLoop: for (const media of task.list) {
                    if (media.selected) {
                        if (media.status !== tasks_1.MediaStatus.FINISHED) {
                            if (media.status !== tasks_1.MediaStatus.ACTIVE) {
                                let mediaSource = media.getSource();
                                let mirrorStream = false;
                                if (mediaSource.type === "stream" && mediaSource.parentType === "mirror") {
                                    mediaSource = tasks_1.mediaSources[mediaSource.parent];
                                    mirrorStream = true;
                                }
                                const queueFacet = (mirrorStream ? "mirrorstream" : sourceQueueMap[mediaSource.type]);
                                const queueId = media.queueId;
                                if (media.status === tasks_1.MediaStatus.PENDING
                                    && queue_1.queueState(queueFacet, mediaSource.facetId, media.queueId) === queue_1.QueueState.READY
                                    || !exhuastedConcurrent(task, activeMedia, setActive)
                                        && media.queueId === null) {
                                    media.start();
                                    setActive++;
                                    if (queueId !== null) {
                                        queue_1.advanceQueue(queueFacet, mediaSource.facetId, true, true);
                                    }
                                    if (!state_1.state.maxGlobalConcurrentDl) {
                                        available--;
                                    }
                                }
                            }
                            if (media.status === tasks_1.MediaStatus.ACTIVE || media.status === tasks_1.MediaStatus.PENDING) {
                                activeMedia++;
                            }
                            if (state_1.state.taskFairness && setActive) {
                                break mediaLoop;
                            }
                            if (exhuastedConcurrent(task, activeMedia, setActive)) {
                                break mediaLoop;
                            }
                        }
                    }
                }
            }
            iterations++;
        }
        if (intervals[state_1.state.tickDelay]) {
            for (const task of tasks) {
                for (const media of task.list) {
                    if (media.status === tasks_1.MediaStatus.ACTIVE && media.outStream && media.request) {
                        const now = Date.now();
                        const dur = now - media.lastUpdate;
                        const bytes = media.bufferedBytes;
                        media.speed = Math.floor((1000 / dur) * bytes);
                        if (media.bytes === media.size) {
                            media.request = null;
                            media.setStatus(tasks_1.MediaStatus.FINISHED);
                            media.outStream.write(utils_1.bufferConcat(media.buffers));
                            media.buffers = [];
                            media.bufferedBytes = 0;
                            media.outStream.end();
                            // FIXME: Tidy this up
                            const stream = media.getSource();
                            media.decreaseMirrorConn(stream);
                        }
                        else {
                            media.outStream.write(utils_1.bufferConcat(media.buffers));
                            media.bytes += bytes;
                            media.buffers = [];
                            media.bufferedBytes = 0;
                            media.lastUpdate = Date.now();
                        }
                    }
                }
            }
            // Serialize
            for (const task of tasks) {
                if (task.loaded) {
                    const serialized = serialize_1.serialize(task);
                    fs.writeFile(task.metaFile, JSON.stringify(serialized), err => {
                        if (err) {
                            console.log("ANV: Error writing task metadata for #" + task.id + " - " + task.title);
                        }
                    });
                }
            }
        }
        // Process queue
        queue_1.processQueue(mediaIds => {
            // FIXME: Do something here
        });
    });
    clock.start();
    return clock;
}
exports.clock = clock;
