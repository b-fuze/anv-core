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
      open: boolean;
    };
  }
}

export enum QueueState {
  EARLY = "E",
  CURRENT = "C",
  PAST = "P",
  READY = "R",
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

export function queueState(facet: keyof QueueFacet, facetId: string, queueId: number): QueueState | number {
  const facetQueue = queue[facet][facetId];

  if (!facetQueue) {
    return null;
  }

  const offset = Math.sign(facetQueue.index - queueId);
  return (offset === 0
          ? (facetQueue.ready ? QueueState.READY : QueueState.CURRENT)
          : offset);
}

export function advanceQueue(facet: keyof QueueFacet, facetId: string, onlyOpen = false, open = true, ready = false) {
  const facetQueue = queue[facet][facetId];

  if (!onlyOpen) {
    facetQueue.index++;
  }

  facetQueue.open = open;
  facetQueue.ready = ready;
}

export function processQueue(callback: (ids: number[]) => void) {
  const mediaIds: number[] = [];

  // TODO: Check the relevance of a genericresolver to this issue
  for (const facetType of ["mirror", "provider", "mirrorstream"]) {
    facetLoop:
    for (const facetId of Object.keys(queue[<keyof QueueFacet> facetType])) {
      const facetQueue = queue[<keyof QueueFacet> facetType][facetId];

      if (!facetQueue.open) {
        // This facet queue isn't ready to advance yet
        continue facetLoop;
      }

      const facet = getFacetById(queueFacetMap[<keyof QueueFacet> facetType], facetId);

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

      let queueItem: QueueItem = facetQueue.queue[facetQueue.index];

      if (ready) {
        facetQueue.ready = true;
        facetQueue.state = (<any> facet)[key];

        queueItem = facetQueue.queue[facetQueue.index + 1];

        if (queueItem && queueItem[1]) {
          advanceQueue(<keyof QueueFacet> facetType, facetId, false, true);
          (<any> queueItem[1])();
        } else {
          advanceQueue(<keyof QueueFacet> facetType, facetId, false, false, true);
        }
      }

      if (queueItem && !queueItem[1]) {
        mediaIds.push(queueItem[0]);
      }
    }
  }

  callback(mediaIds);
}
