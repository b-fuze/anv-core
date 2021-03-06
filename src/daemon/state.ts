import {deepCopy} from "./utils";
import {FacetTiers} from "./utils";

export const state = {
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
  tickDelay: 1000, // This shouldn't be changeable
  taskFairness: true,
  moduleFollowSymlinks: false,

  task: {
    dlPath: null as string,
    minimalFileName: true,
    autoStart: false,
    ignoreCaches: false,
    numberPad: true,
    padMinLength: 2, // Forced padding regardless of how little media the task has, 0 is disabled
    basicGenericResolver: "basic",
    basicStreamResolver: "basic",
    tiers: <FacetTiers> {
      mirror: {},
      provider: {},
    },
  }
};

export const defaultState = deepCopy(state);

export const tmpState = {
  currentDl: 0,
}

// DEBUG
;(<any> global).ANV = {
  tmpState,
};
