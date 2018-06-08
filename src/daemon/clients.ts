import * as fs from "fs";
import * as path from "path";
import {parse as parseUrl} from "url";
import {getPadding} from "./utils";
import {state} from "./state";
import {getFacet, getFacetByHost} from "./facets";
import {queueAdd} from "./queue";
import {
  Task,
  Media,
  MediaSourceStream,
  MediaSourceMirror,
  MediaSourceDirect,
  getSimpleName,
  getInitials,
} from "./tasks";
import {resolveProvider} from "./resolve";

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
                      task.loaded = true;
                      task.triggerEvent("load", true);
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

  select(taskId: number) {

  },

  start(taskId: number) {

  },

  stop(taskId: number) {

  },

  // FIXME: mediaList type
  delete(taskId: number, mediaList: any[]) {

  },
}

export function instruction<Connection = any>(data: any, conn: Connection) {

}
