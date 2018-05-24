import {deepCopy} from "./utils";

export const state = {
  verbose: false,
  maxConcurrentDl: 2,
  maxGlobalConcurrentDl: 0,
  limitOnlyGlobal: false,
  sourceTimeout: 3000,
  maxBufferSize: 1000000, // bytes

  task: {
    dlPath: null as string,
    minimalFileName: true,
    autoStart: false,
  }
};

export const defaultState = deepCopy(state);
