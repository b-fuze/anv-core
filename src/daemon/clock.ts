import * as fs from "fs";
import {bufferConcat} from "./utils";
import {state, tmpState} from "./state";
import {Task, mediaSources, MediaStatus, MediaSourceType} from "./tasks";
import {startTick} from "./tick";
import {getFacet, getFacetById} from "./facets";
import {advanceQueue, processQueue, queueState, QueueState} from "./queue";
import {serialize} from "./serialize";

function taskActiveCount(task: Task) {
  return task.list.filter(m => (m.selected && m.status === MediaStatus.ACTIVE)).length;
}

function taskFinishedCount(task: Task) {
  return task.list.filter(m => (m.selected && m.status === MediaStatus.FINISHED)).length;
}

function getTasksByFairness(tasks: Task[]) {
  return (state.taskFairness
          ? tasks.slice().sort((a, b) => (taskFinishedCount(a) - taskFinishedCount(b)) + (taskActiveCount(a) - taskActiveCount(b)))
          : tasks.slice());
}

// FIXME: Unnecessary term clash made this a requirement
const sourceQueueMap = {
  direct: "provider",
  mirror: "mirror",
};

function exhuastedConcurrent(task: Task, activeMedia: number, setActive: number) {
  return (state.maxGlobalConcurrentDl
          && tmpState.currentDl >= state.maxGlobalConcurrentDl
          && activeMedia === task.currentDl
          || !state.maxGlobalConcurrentDl
             && activeMedia >= state.maxConcurrentDl);
}

export function clock() {
  const clock = startTick([50, state.tickDelay, 2000], (tasks, intervals) => {
    let available = state.maxGlobalConcurrentDl
                    ? state.maxGlobalConcurrentDl - tmpState.currentDl
                    : 1;
    let oldAvailable = available;
    let iterations = 0;

    // Add new media
    while (!iterations || available > 0 && !(iterations && oldAvailable === available)) {
      oldAvailable = available;

      taskLoop:
      for (const task of getTasksByFairness(tasks)) {
        if (!task.active) {
          continue taskLoop;
        }

        let activeMedia = 0;
        let setActive = 0;

        mediaLoop:
        for (const media of task.list) {
          if (media.selected) {
            if (media.status !== MediaStatus.FINISHED) {
                if (media.status !== MediaStatus.ACTIVE) {
                  let mediaSource = media.getSource();
                  let mirrorStream = false;

                  if (mediaSource.type === "stream" && mediaSource.parentType === "mirror") {
                    mediaSource = mediaSources[mediaSource.parent];
                    mirrorStream = true;
                  }
                  const queueFacet = <any> (mirrorStream ? "mirrorstream" : (<any> sourceQueueMap)[mediaSource.type]);
                  const queueId = media.queueId;

                  if (media.status === MediaStatus.PENDING
                      && queueState(queueFacet, mediaSource.facetId, media.queueId) === QueueState.READY
                      || !exhuastedConcurrent(task, activeMedia, setActive)
                         && media.queueId === null) {
                    media.start();
                    setActive++;

                    if (queueId !== null) {
                      advanceQueue(queueFacet, mediaSource.facetId, true, true);
                    }

                    if (!state.maxGlobalConcurrentDl) {
                      available--;
                    }
                  }
                }

                if (media.status === MediaStatus.ACTIVE || media.status === MediaStatus.PENDING) {
                  activeMedia++;
                }

                if (state.taskFairness && setActive) {
                  break mediaLoop;
                }

                if (exhuastedConcurrent(task, activeMedia, setActive)) {
                  break mediaLoop;
                }
            }
          }
        }
      }

      iterations++;
    }

    if (intervals[state.tickDelay]) {
      for (const task of tasks) {
        for (const media of task.list) {
          if (media.status === MediaStatus.ACTIVE && media.outStream && media.request) {
            const now = Date.now();
            const dur = now - media.lastUpdate;
            const bytes = media.bufferedBytes;

            media.speed = Math.floor((1000 / dur) * bytes);

            if (media.bytes === media.size) {
                media.request = null;
                media.setStatus(MediaStatus.FINISHED);
                media.outStream.write(bufferConcat(media.buffers));

                media.buffers = [];
                media.bufferedBytes = 0;
                media.outStream.end();

                // FIXME: Tidy this up
                const stream = media.getSource();
                media.decreaseMirrorConn(stream);
            } else {
              media.outStream.write(bufferConcat(media.buffers));
              media.bytes += bytes;
              media.buffers = [];
              media.bufferedBytes = 0;
              media.lastUpdate = Date.now();
            }
          }
        }
      }

      // Serialize
      for (const task of tasks) {
        if (task.loaded) {
          const serialized = serialize(task);
          fs.writeFile(task.metaFile, JSON.stringify(serialized), err => {
            if (err) {
              console.log("ANV: Error writing task metadata for #" + task.id + " - " + task.title);
            }
          });
        }
      }
    }

    // Process queue
    processQueue(mediaIds => {
      // FIXME: Do something here
    });
  });

  clock.start();
  return clock;
}
