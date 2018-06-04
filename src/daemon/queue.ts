import {Mirror, FacetStore, getFacetById} from "./facets";
import {state} from "./state";

export interface QueueFacet {
  mirror: {},
  provider: {},
  mirrorstream: {},
}

const queueFacetMap = {
  mirror: "mirror",
  provider: "provider",
  mirrorstream: "mirror",
} as {
  [K in keyof QueueFacet]: keyof FacetStore;
};

// [mediaId | null, arbitraryCallback] - mediaId is null if it's an arbitrary callback
type QueueItem = [number] | [number, () => void];

export type Queue = {
  [F in keyof QueueFacet]: {
    [facetId: string]: {
      index: number;
      queue: QueueItem[];
      state: number;
      ready: boolean;
    };
  }
}

export enum QueueState {
  EARLY = -1,
  CURRENT = 0,
  PAST = 1,
  READY = 2,
};

const queue: Queue = {
  mirror: {},
  provider: {},
  mirrorstream: {}
};

export function queueAdd(facet: keyof QueueFacet, facetId: string, callback: () => void, id: number = null) {
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

export function queueState(facet: keyof QueueFacet, facetId: string, queueId: number): QueueState {
  const facetQueue = queue[facet][facetId];

  if (!facetQueue) {
    return null;
  }

  const offset = Math.sign(facetQueue.index - queueId);
  return (offset === 0
          ? (facetQueue.ready ? QueueState.READY : QueueState.CURRENT)
          : offset);
}

export function advanceQueue(facet: keyof QueueFacet, facetId: string, maintainState = false) {
  const facetQueue = queue[facet][facetId];

  facetQueue.index++;

  if (!maintainState) {
    facetQueue.ready = false;
  }
}

export function processQueue(callback: (ids: number[]) => void) {
  const mediaIds: number[] = [];

  // TODO: Check the relevance of a genericresolver to this issue
  for (const facetType of ["mirror", "provider", "mirrorstream"]) {
    facetLoop:
    for (const facetId of Object.keys(queue[<keyof QueueFacet> facetType])) {
      const facetQueue = queue[<keyof QueueFacet> facetType][facetId];
      const facet = getFacetById(queueFacetMap[<keyof QueueFacet> facetType], facetId);
      const queueItem = facetQueue.queue[facetQueue.index];

      if (!queueItem) {
        // The index passed all the items
        break facetLoop;
      }

      let ready: boolean;
      let key: string;

      switch (<keyof QueueFacet> facetType) {
        case "mirror":
        case "provider":
          const time = Date.now();
          ready = facetQueue.state !== facet.lastUse && (<any> facet).delay < (time - facet.lastUse);
          key = "lastUse";
          break;
        case "mirrorstream":
          ready = !(<Mirror> facet).maxConnections || state.ignoreMaxConnections
                  ? true
                  : facetQueue.state !== (<Mirror> facet).connectionCount && (<Mirror> facet).connectionCount < (<Mirror> facet).maxConnections;
          key = "connectionCount";
          break;
      }

      if (ready) {
        facetQueue.ready = true;
        facetQueue.state = (<any> facet)[key];

        if (queueItem[1]) {
          (<any> queueItem[1])();
          advanceQueue(<keyof QueueFacet> facetType, facetId);
        }
      }

      if (!queueItem[1]) {
        mediaIds.push(queueItem[0]);
      }
    }
  }

  callback(mediaIds);
}
