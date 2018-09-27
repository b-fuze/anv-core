"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
exports.state = {
    verbose: false,
    maxConcurrentDl: 3,
    maxGlobalConcurrentDl: 5,
    limitOnlyGlobal: false,
    ignoreMaxConnections: false,
    sourceTimeout: 3000,
    maxSourceRetries: 3,
    skipOccupiedMirrors: false,
    // maxBufferSize: 1000000, // bytes TODO: Check the urgency of this
    scanDlDirOnStart: false,
    useGlobalPersistentStateStore: false,
    tickDelay: 1000,
    taskFairness: true,
    moduleFollowSymlinks: false,
    task: {
        dlPath: null,
        minimalFileName: true,
        autoStart: false,
        ignoreCaches: false,
        numberPad: true,
        padMinLength: 2,
        basicGenericResolver: "basic",
        basicStreamResolver: "basic",
        tiers: {
            mirror: {},
            provider: {},
        },
    }
};
exports.defaultState = utils_1.deepCopy(exports.state);
exports.tmpState = {
    currentDl: 0,
};
global.ANV = {
    tmpState: exports.tmpState,
};
