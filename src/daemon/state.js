"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
exports.state = {
    verbose: false,
    maxConcurrentDl: 2,
    maxGlobalConcurrentDl: 0,
    limitOnlyGlobal: false,
    sourceTimeout: 3000,
    maxBufferSize: 1000000,
    scanDlDirOnStart: false,
    useGlobalPersistentStateStore: false,
    tickDelay: 1000,
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
