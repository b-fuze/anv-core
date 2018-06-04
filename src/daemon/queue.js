"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const facets_1 = require("./facets");
const state_1 = require("./state");
const queueFacetMap = {
    mirror: "mirror",
    provider: "provider",
    mirrorstream: "mirror",
};
var QueueState;
(function (QueueState) {
    QueueState[QueueState["EARLY"] = -1] = "EARLY";
    QueueState[QueueState["CURRENT"] = 0] = "CURRENT";
    QueueState[QueueState["PAST"] = 1] = "PAST";
    QueueState[QueueState["READY"] = 2] = "READY";
})(QueueState = exports.QueueState || (exports.QueueState = {}));
;
const queue = {
    mirror: {},
    provider: {},
    mirrorstream: {}
};
function queueAdd(facet, facetId, callback, id = null) {
    const facetMap = queue[facet];
    let facetQueue = facetMap[facetId];
    if (!facetQueue) {
        facetQueue = facetMap[facetId] = {
            index: 0,
            queue: [],
            state: -1,
            ready: false,
        };
    }
    facetQueue.queue.push([id, callback]);
    return facetQueue.queue.length - 1;
}
exports.queueAdd = queueAdd;
function queueState(facet, facetId, queueId) {
    const facetQueue = queue[facet][facetId];
    if (!facetQueue) {
        return null;
    }
    const offset = Math.sign(facetQueue.index - queueId);
    return (offset === 0
        ? (facetQueue.ready ? QueueState.READY : QueueState.CURRENT)
        : offset);
}
exports.queueState = queueState;
function advanceQueue(facet, facetId, maintainState = false) {
    const facetQueue = queue[facet][facetId];
    facetQueue.index++;
    if (!maintainState) {
        facetQueue.ready = false;
    }
}
exports.advanceQueue = advanceQueue;
function processQueue(callback) {
    const mediaIds = [];
    // TODO: Check the relevance of a genericresolver to this issue
    for (const facetType of ["mirror", "provider", "mirrorstream"]) {
        facetLoop: for (const facetId of Object.keys(queue[facetType])) {
            const facetQueue = queue[facetType][facetId];
            const facet = facets_1.getFacetById(queueFacetMap[facetType], facetId);
            const queueItem = facetQueue.queue[facetQueue.index];
            if (!queueItem) {
                // The index passed all the items
                break facetLoop;
            }
            let ready;
            let key;
            switch (facetType) {
                case "mirror":
                case "provider":
                    const time = Date.now();
                    ready = facetQueue.state !== facet.lastUse && facet.delay < (time - facet.lastUse);
                    key = "lastUse";
                    break;
                case "mirrorstream":
                    ready = !facet.maxConnections || state_1.state.ignoreMaxConnections
                        ? true
                        : facetQueue.state !== facet.connectionCount && facet.connectionCount < facet.maxConnections;
                    key = "connectionCount";
                    break;
            }
            if (ready) {
                facetQueue.ready = true;
                facetQueue.state = facet[key];
                if (queueItem[1]) {
                    queueItem[1]();
                    advanceQueue(facetType, facetId);
                }
            }
            if (!queueItem[1]) {
                mediaIds.push(queueItem[0]);
            }
        }
    }
    callback(mediaIds);
}
exports.processQueue = processQueue;
