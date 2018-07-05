import * as fs from "fs";
import * as path from "path";
import {parse as parseUrl} from "url";
import {jSh} from "jshorts";
import {getPadding, bufferConcat} from "./utils";
import {state} from "./state";
import {getFacet, getFacetByHost} from "./facets";
import {queueAdd} from "./queue";
import {
  crud,
  Task,
  Media,
  MediaStatus,
  MediaSourceStream,
  MediaSourceMirror,
  MediaSourceDirect,
  getSimpleName,
  getInitials,
} from "./tasks";
import {resolveProvider} from "./resolve";
import {validate, serialize, deserialize, MediaSerialized, MediaSourceSerialized} from "./serialize";

export enum Instruction {
  Load = "load",
  Select = "select",
  Start = "start",
  Stop = "stop",
  Delete = "delete",
}

export const instructions = {
  load(url: string, done: (err: string, taskId: number) => void) {
    const parsed = parseUrl(url);

    if (parsed.host) {
      const provider = getFacetByHost("provider", url);

      if (provider && provider.validUrl(url, true)) {
        const task = new Task(url, [], provider.facetId, provider.name);
        done(null, task.id);

        queueAdd("provider", provider.facetId, () => {
          resolveProvider(url, (err, metadata) => {
            if (err) {
              console.error("ANV: Error loading metadata for task " + task.id);
            } else {
              task.title = metadata.title;
              task.cover = metadata.cover;

              task.dlDir = task.settings.dlPath + path.sep + getSimpleName(task.title);
              task.metaFile = task.dlDir + path.sep + ".anv" + path.sep + "meta";
              let fileNameBase = task.settings.minimalFileName ? getInitials(task.title) : getSimpleName(task.title);

              if (/^.+\d$/.test(fileNameBase)) {
                fileNameBase += "-";
              }

              for (const source of metadata.sources) {
                let facet;
                const fileName = fileNameBase
                               + (task.settings.numberPad
                                  ? getPadding(source.number, Math.max(Math.pow(10, Math.max(0, task.settings.padMinLength - 1)), metadata.sources.length))
                                  : source.number)
                               + "." + source.fileExtension;
                const media = new Media(source.number, fileName, task.list, task.id);
                task.list.push(media);

                switch (source.type) {
                  case "mediasource":
                    facet = getFacetByHost("provider", source.url);
                    media.sources.push(new MediaSourceDirect(source.url, facet.name, facet.facetId));
                    break;
                  case "mirror":
                    facet = getFacetByHost("mirror", source.url);
                    media.sources.push(new MediaSourceMirror(source.url, facet.name, facet.facetId));
                    break;
                  case "stream":
                    facet = getFacet("streamresolver", source.resolver);
                    media.sources.push(new MediaSourceStream(source.url, facet.name, facet.facetId));
                    break;
                }
              }

              // Create dl directory
              fs.stat(task.dlDir, (err, stats) => {
                if (err && err.code === 'ENOENT') {
                  fs.mkdir(task.dlDir, (err) => {
                    if (!err) {
                      fs.mkdir(task.dlDir + path.sep + ".anv", err => {
                        task.loaded = true;
                        task.triggerEvent("load", true);
                      });
                    } else {
                      console.error("ANV: Error creating directory for task " + task.id, err);
                    }
                  });
                } else {
                  console.error("ANV: Directory for task already exists \"" + task.dlDir + "\"");
                }
              });
            }
          });
        });
      } else {
        done("No provider found for " + url, null);
      }
    } else {
      done("Invalid url", null);
    }
  },

  loadLocal(localPath: string, verified = false, done: (err: string, taskId: number) => void) {
    // FIXME: Flatten this with promises
    const anvPath = localPath + path.sep + ".anv";
    const metaPath = anvPath + path.sep + "meta";

    function load(localPath: string) {
      fs.readFile(metaPath, {encoding: "utf8"}, (err, metadata) => {
        const rawTask = jSh.parseJSON(metadata);

        if (rawTask && !rawTask.error) {
          const task = validate.task(rawTask);

          if (task) {
            // We have a valid task
            let validData = true;
            let media: MediaSerialized[] = [];
            let mediaSources: MediaSourceSerialized[] = [];

            for (const rawMedia of task.media) {
              const verified = validate.media(rawMedia);

              if (verified) {
                media.push(verified);
              } else {
                validData = false;
                break;
              }
            }

            // FIXME: Use better error mechanisms
            if (!validData) {
              return false;
            }

            for (const rawMediaSource of task.mediaSources) {
              const verified = validate.mediaSource(rawMediaSource);

              if (verified) {
                mediaSources.push(verified);
              } else {
                validData = false;
                break;
              }
            }

            if (!validData) {
              return false;
            }

            // Deserialize
            const readyTask = deserialize(task, media, mediaSources);
            readyTask.task.metaFile = metaPath;
            readyTask.task.dlDir = readyTask.task.settings.dlPath + path.sep + getSimpleName(readyTask.task.title);

            // FIXME: Remove reduadant object wrapper
            done(null, readyTask.task.id);
          }
        }
      });
    }

    if (verified) {
      load(localPath);
    } else {
      fs.stat(metaPath, (err, stat) => {
        if (!err && stat.isFile()) {
          console.log("Loading: " + localPath);
          load(localPath);
        }
      });
    }
  },

  select(taskId: number) {

  },

  start(taskId: number) {

  },

  stop(taskId: number, done: (err: string) => void) {
    const task = crud.getTask(taskId);
    let toComplete = 1;
    let finished = 0;

    if (task) {
      task.active = false;

      for (const media of task.list) {
        if (media.status === MediaStatus.ACTIVE) {
          media.setStatus(MediaStatus.PAUSED);
          media.request.stop();
          media.outStream.write(bufferConcat(media.buffers));
          media.outStream.end(() => {
            finished++;

            if (finished === toComplete) {
              done(null);
            }
          });

          media.bytes += media.bufferedBytes;
          media.buffers = [];
          media.bufferedBytes = 0;

          const stream = media.getSource();
          media.decreaseMirrorConn(stream);

          toComplete++;
        }
      }

      // Serialize
      const serialized = serialize(task);
      fs.writeFile(task.metaFile, JSON.stringify(serialized), err => {
        if (err) {
          console.log("ANV: Error writing task metadata for #" + task.id + " - " + task.title + "\n" + err);
        } else {
          finished++;

          if (finished === toComplete) {
            done(null);
          }
        }
      });
    }
  },

  // FIXME: mediaList type
  delete(taskId: number, mediaList: any[]) {

  },
}

export function instruction<Connection = any>(data: any, conn: Connection) {

}
