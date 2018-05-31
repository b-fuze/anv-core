import {deepCopy} from "./utils";
import {FacetTiers} from "./facets";

export const state = {
  verbose: false,
  maxConcurrentDl: 2,
  maxGlobalConcurrentDl: 0,
  limitOnlyGlobal: false,
  sourceTimeout: 3000,
  maxBufferSize: 1000000, // bytes
  scanDlDirOnStart: false,
  useGlobalPersistentStateStore: false,
  tickDelay: 1000, // This shouldn't be changeable

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
