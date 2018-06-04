"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
const state_1 = require("./state");
const tasks_1 = require("./tasks");
const tick_1 = require("./tick");
const facets_1 = require("./facets");
const queue_1 = require("./queue");
const mediaFacetMap = {
    [tasks_1.MediaSourceType.Direct]: "provider",
    [tasks_1.MediaSourceType.Mirror]: "mirror",
    [tasks_1.MediaSourceType.Stream]: "streamresolver",
};
// FIXME: Unnecessary term clash made this a requirement
const sourceQueueMap = {
    direct: "provider",
    mirror: "mirror",
};
function taskActiveCount(task) {
    return task.list.filter(m => (m.status === tasks_1.MediaStatus.ACTIVE)).length;
}
function taskFinishedCount(task) {
    return task.list.filter(m => (m.status === tasks_1.MediaStatus.FINISHED)).length;
}
function getTasksByFairness(tasks) {
    return (state_1.state.taskFairness
        ? tasks.slice().sort((a, b) => (taskFinishedCount(a) - taskFinishedCount(b)) + (taskActiveCount(a) - taskActiveCount(b)))
        : tasks.slice());
}
function taskPendingCount(task, delayMap) {
    return task.list.filter(m => {
        const eligible = m.selected && m.status !== tasks_1.MediaStatus.FINISHED && m.status !== tasks_1.MediaStatus.ACTIVE;
        if (eligible) {
            if (m.queueId === null) {
                // This media hasn't even been queued yet
                return true;
            }
            else {
                let source = m.getSource();
                let mirrorStream = false;
                if (source.type === "stream" && source.parentType === "mirror") {
                    source = tasks_1.mediaSources[source.parent];
                    mirrorStream = true;
                }
                return queue_1.queueState((mirrorStream ? "mirrorstream" : sourceQueueMap[source.type]), source.facetId, m.queueId) === queue_1.QueueState.READY;
            }
        }
    }).length;
}
function clock() {
    const clock = tick_1.startTick([50, state_1.state.tickDelay, 2000], (tasks, intervals) => {
        let exhaustedTasks = false;
        function addMoreMedia(tasks, limit) {
            taskLoop: for (const task of tasks) {
                if (task.active) {
                    mediaLoop: for (const media of task.list) {
                        if (media.selected) {
                            let mediaSource = media.getSource();
                            let mirrorStream = false;
                            if (mediaSource.type === "stream" && mediaSource.parentType === "mirror") {
                                mediaSource = tasks_1.mediaSources[mediaSource.parent];
                                mirrorStream = true;
                            }
                            const queueFacet = (mirrorStream ? "mirrorstream" : sourceQueueMap[mediaSource.type]);
                            if (media.status !== tasks_1.MediaStatus.FINISHED
                                && media.status !== tasks_1.MediaStatus.ACTIVE
                                && (media.queueId === null
                                    || mediaSource.type === "stream"
                                    || queue_1.queueState(queueFacet, mediaSource.facetId, media.queueId) === queue_1.QueueState.READY)) {
                                media.start();
                                if (media.queueId !== null) {
                                    queue_1.advanceQueue(queueFacet, mediaSource.facetId);
                                }
                                limit--;
                                break mediaLoop;
                            }
                            else if (media.status === tasks_1.MediaStatus.PENDING) {
                                limit--;
                            }
                        }
                        if (!limit) {
                            continue taskLoop;
                        }
                    }
                    if (task.currentDl < taskPendingCount(task)) {
                        exhaustedTasks = false;
                    }
                }
            }
        }
        while (!exhaustedTasks && state_1.state.maxGlobalConcurrentDl && state_1.tmpState.currentDl < state_1.state.maxGlobalConcurrentDl) {
            exhaustedTasks = true;
            addMoreMedia(getTasksByFairness(tasks), state_1.state.maxGlobalConcurrentDl - state_1.tmpState.currentDl);
        }
        for (const task of getTasksByFairness(tasks)) {
            if (!exhaustedTasks && !state_1.state.maxGlobalConcurrentDl && !state_1.state.limitOnlyGlobal) {
                while (!exhaustedTasks && task.currentDl < state_1.state.maxConcurrentDl && taskPendingCount(task)) {
                    exhaustedTasks = true;
                    addMoreMedia([task], 1);
                }
            }
            if (intervals[state_1.state.tickDelay]) {
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
                            if (stream.parentType === tasks_1.MediaSourceType.Mirror) {
                                const mirror = tasks_1.mediaSources[stream.parent];
                                const facet = facets_1.getFacetById("mirror", mirror.facetId);
                                // Mark mirror facet as done
                                facet.connectionCount--;
                            }
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
