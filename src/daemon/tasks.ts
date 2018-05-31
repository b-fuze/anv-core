import * as path from "path";
import * as fs from "fs";
import {Writable} from "stream";
import {parse as parseUrl} from "url";
import {type} from "./utils";
import {Component, StateModel} from "lces";
import {
  Provider,
  Mirror,
  StreamResolver,
  MirrorResult,
  getFacet,
  getFacetById,
  getFacetByHost,
} from "./facets";
import {resolveProviderSource, resolveMirror} from "./resolve";
import {state} from "./state";
import {deepCopy} from "./utils";

const tasks: Task[] = [];

export const crud = class {
  static getTask(id: number) {
    return tasks[id] || null;
  }

  static getTasks() {
    return tasks.filter(task => !!task);
  }

  static hasTaskThen(id: number, then: (task: Task) => void): Task {
    const task = this.getTask(id);

    if (task) then(task);
    return task;
  }

  static removeTask(id: number) {
    return this.hasTaskThen(id, task => {
      task.active = false;
      task.remove = true;
    });
  }

  static selectTaskMedia(id: number, list: Media[]) {
    return this.hasTaskThen(id, task => {
      task.active = true;
    });
  }

  static startTask(id: number) {
    return this.hasTaskThen(id, task => {
      task.active = true;
    });
  }

  static stopTask(id: number) {
    return this.hasTaskThen(id, task => {
      task.active = false;
    });
  }

  static deleteTaskMedia(id: number, media: number[]) {
    return this.hasTaskThen(id, task => {

    });
  }
}

export function getSimpleName(title: string) {
  return title.replace(/[^a-z\d\s\-,:'()@!]/ig, "").replace(/\s+/g, " ");
}

export function getInitials(title: string): string {
  title = title.toLowerCase().replace(/[^\sa-z\d]/ig, "");
  var words = title.split(" ").length;

  if (title.length < 5 || words === 1)
    return title.replace(/\s+/g, "").substr(0, 5).toUpperCase();
  else if (words === 2) {
    var split = title.split(" ");

    return (split[0].substr(0, 2) + split[1].substr(0, 2)).toUpperCase();
  } else if (words === 3) {
    return title.split(" ").map(s => s[0]).join("").toUpperCase();
  } else {
    var wordsFilter = title.split(" ").filter(s => s !== "no" && s !== "of" && s !== "the");

    if (wordsFilter.length < 4)
      return getInitials(wordsFilter.join(" "));
    else
      return wordsFilter.slice(0, 4).map(s => s[0]).join("").toUpperCase();
  }
}

export interface TaskEvents {
  load: boolean;
}

export
class Task extends Component<StateModel, TaskEvents> {
  id: number;
  url: string;
  title: string = "";
  cover: string = "";
  providerId: string;
  provider: string;
  list: Media[];
  active: boolean = false;
  remove: boolean = false; // Whether to remove this task on the next tick
  currentDl: number = 0;
  settings = deepCopy(state.task);
  dlDir: string;
  loaded: boolean = false;

  constructor(
    url: string,
    list: Media[],
    providerId: string,
    provider: string,
  ) {
    super();

    this.url = url;

    this.id = tasks.length;
    tasks.push(this);

    this.providerId = providerId;
    this.provider = provider;

    this.list = list;

    // Create event
    this.newEvent("load");
  }
}

export const media: Media[] = [];

export enum MediaStatus {
  IDLE = "IDLE",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
};

export interface MediaRequest {
  stop(): void;
  finished?: boolean;
}

export
class Media {
  id: number;
  listId: number;
  title: string;
  fileName: string;
  taskId: number;

  selected: boolean = true;
  status: MediaStatus = MediaStatus.IDLE;
  bytes: number = 0;
  size: number = null;
  sources: MediaSource[] = [];
  source: number = 0;
  sourceAttempts: number = 0;
  totalAttempts: number = 0;
  exhuastedSources: boolean = false;
  request: MediaRequest = null;

  outStream: Writable;
  buffer: Buffer = Buffer.alloc(0);
  bufferedBytes: number = 0; // Cleared every tick, used to calculate download speed
  lastUpdate: number = 0;
  speed: number = 0;

  constructor(
    title: string,
    fileName: string,
    taskMediaList: Media[],
    taskId: number,
  ) {
    this.id = media.length;
    this.listId = taskMediaList.length;
    media.push(this);

    this.title = title;
    this.fileName = fileName;
    this.taskId = taskId;
  }

  start() {
    if (this.status !== MediaStatus.IDLE && this.status !== MediaStatus.PAUSED) {
      return;
    }

    this.getTask().currentDl++;
    this.status = MediaStatus.ACTIVE;

    const source = this.sources[this.source];
    this.resolveSource(source);
  }

  stop(finished = false) {
    if (this.status !== MediaStatus.ACTIVE) {
      return;
    }

    if (this.request) {
      this.request.stop();
      this.request = null;
    }

    this.getTask().currentDl--;
    this.status = MediaStatus.PAUSED;
  }

  resolveSource(source: MediaSource) {
    switch (source.type) {
      case "direct":
        resolveProviderSource(source.url, (err, sources) => {
          const boxedSources = sources.map(resSource => {
            let box: MediaSource;

            switch (resSource.type) {
              case "mediasource":
                const gresolver = getFacetByHost("provider", resSource.url);
                box = new MediaSourceDirect(resSource.url, resSource.resolver, gresolver.facetId);
                break;

              case "mirror":
                const mirror = getFacetByHost("mirror", resSource.url);
                box = new MediaSourceMirror(resSource.url, resSource.resolver, mirror.facetId);
                break;

              case "stream":
                const sresolver = getFacet("streamresolver", resSource.resolver);
                box = new MediaSourceStream(resSource.url, resSource.resolver, sresolver.facetId);
                break;
            }

            box.parent = source.id;
            return box;
          });

          this.sources.splice.apply(this.sources, [this.source + 1, 0].concat(<any>boxedSources));
          source.resolved = true;

          // Reresolve
          this.source++;
          this.resolveSource(this.sources[this.source]);
        });
        break;
      case "mirror":
        resolveMirror(source.url, (err, data) => {
          const mirror = getFacetById("mirror", source.facetId);
          const sresolver = getFacet("streamresolver", mirror.resolver);

          const mirrorResult: MirrorResult = type(data) === "object" ? data : {
            url: data,
          };

          const stream = new MediaSourceStream(mirrorResult.url, mirror.resolver, sresolver.facetId);
          stream.parent = source.id;

          if (type(mirrorResult.options) === "object")
            stream.options = mirrorResult.options;

          this.sources.splice(this.source + 1, 0, stream);
          source.resolved = true;

          // Reresolve
          this.source++;
          this.resolveSource(this.sources[this.source]);
        });
        break;
      case "stream":
        this.startStream(<MediaSourceStream> source);
        break;
    }
  }

  startStream(stream: MediaSourceStream) {
    console.log(stream);
    // process.exit();
    const sresolver: StreamResolver = getFacetById("streamresolver", stream.facetId);
    const task = this.getTask();
    const out = new MediaStream(this);
    this.outStream = fs.createWriteStream(task.dlDir + path.sep + this.fileName, {
      encoding: "binary",
    });

    this.lastUpdate = Date.now();
    this.request = sresolver.resolve(stream.url, out, null, stream.options || {});
  }

  getTask() {
    return crud.getTask(this.taskId);
  }
}

export
class MediaStream extends Writable {
  mediaAttempt: number;

  constructor(
    public media: Media,
  ) {
    super({});

    this.mediaAttempt = media.totalAttempts;
  }

  setSize(size: number) {
    this.media.size = size;
  }

  _write(chunk: Buffer, encoding: string, callback: (err?: Error) => void) {
    this.media.buffer = Buffer.concat([chunk, this.media.buffer], chunk.length + this.media.buffer.length);
    this.media.bufferedBytes += chunk.length;

    // FIXME: Maybe some checks here, maybe not
    callback();
  }

  _finish(callback: (err?: Error) => void) {
    this.media.request

    // TODO: Wrap up things with our Media
    callback();
  }
}

const mediaSources: MediaSource[] = [];

export enum MediaSourceType {
  Direct = "direct",
  Mirror = "mirror",
  Stream = "stream",
};

export class MediaSource {
  id: number;
  type: MediaSourceType;
  facet: string;
  facetId: string;
  url: string;
  parent: number;
  resolved: boolean = false;
  options: {
    [option: string]: any;
  } = {};

  constructor() {
    this.id = mediaSources.length;
    mediaSources.push(this);
  }
}

export
class MediaSourceStream extends MediaSource {
  constructor(
    public url: string,
    public facet: string,
    public facetId: string, // Stream Resolver ID
  ) {
  super();
    this.type = MediaSourceType.Stream;
  }
}

export
class MediaSourceMirror extends MediaSource {
  constructor(
    public url: string,
    public facet: string,
    public facetId: string, // Mirror ID
    public sourceStream: MediaSourceStream = null,
  ) {
    super();
    this.type = MediaSourceType.Mirror;
  }
}

export
class MediaSourceDirect extends MediaSource {
  constructor(
    public url: string,
    public facet: string,
    public facetId: string, // Provider ID
  ) {
    super();
    this.type = MediaSourceType.Direct;
  }
}
