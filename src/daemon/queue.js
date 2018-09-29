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
    QueueState["EARLY"] = "E";
    QueueState["CURRENT"] = "C";
    QueueState["PAST"] = "P";
    QueueState["READY"] = "R";
})(QueueState = exports.QueueState || (exports.QueueState = {}));
;
const queue = {
    mirror: {},
    provider: {},
    mirrorstream: {}
};
// DEBUG
;
global.ANV.queue = queue;
function queueAdd(facet, facetId, callback, id = null) {
    const facetMap = queue[facet];
    let facetQueue = facetMap[facetId];
    if (!facetQueue) {
        facetQueue = facetMap[facetId] = {
            index: -1,
            queue: [],
            state: -1,
            ready: false,
            // FIXME: Maybe rename this to "lock" or such
            open: true,
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
function queueFacetState(facet, facetId) {
    return (queue[facet] || {})[facetId] || null;
}
exports.queueFacetState = queueFacetState;
function advanceQueue(facet, facetId, onlyOpen = false, open = true, ready = false) {
    const facetQueue = queue[facet][facetId];
    if (!onlyOpen) {
        facetQueue.index++;
    }
    facetQueue.open = open;
    facetQueue.ready = ready;
}
exports.advanceQueue = advanceQueue;
function processQueue(callback) {
    const mediaIds = [];
    // TODO: Check the relevance of a genericresolver to this issue
    for (const facetType of ["mirror", "provider", "mirrorstream"]) {
        facetLoop: for (const facetId of Object.keys(queue[facetType])) {
            const facetQueue = queue[facetType][facetId];
            if (!facetQueue.open) {
                // This facet queue isn't ready to advance yet
                continue facetLoop;
            }
            const facet = facets_1.getFacetById(queueFacetMap[facetType], facetId);
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
            let queueItem = facetQueue.queue[facetQueue.index];
            if (ready) {
                facetQueue.ready = true;
                facetQueue.state = facet[key];
                queueItem = facetQueue.queue[facetQueue.index + 1];
                if (queueItem && queueItem[1]) {
                    advanceQueue(facetType, facetId, false, true);
                    queueItem[1]();
                }
                else {
                    advanceQueue(facetType, facetId, false, false, true);
                }
            }
            if (queueItem && !queueItem[1]) {
                mediaIds.push(queueItem[0]);
            }
        }
    }
    callback(mediaIds);
}
exports.processQueue = processQueue;
