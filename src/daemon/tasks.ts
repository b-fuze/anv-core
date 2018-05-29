import {Provider} from "./facets";
import {Writable} from "stream";

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

  static deleteTaskMedia(id: number, media: Media) {
    return this.hasTaskThen(id, task => {

    });
  }
}

export
class Task {
  id: number;
  url: string = "";
  providerId: string;
  provider: string;
  list: Media[];
  active: boolean = false;
  remove: boolean = false; // Whether to remove this task on the next tick
  currentDl: number = 0;

  constructor(
    list: Media[],
    providerId: string,
    provider: string,
  ) {
    this.id = tasks.length;
    tasks.push(this);

    this.providerId = providerId;
    this.provider = provider;

    this.list = list;
  }
}

export const media: Media[] = [];

export enum MediaStatus {
  IDLE = "IDLE",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
};

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
  facetId: string = null;
  sources: MediaSource[] = [];
  source: number = 0;
  sourceAttempts: number = 0;
  exhuastedSources: boolean = false;

  outStream: Writable;
  buffer: Writable;
  bufferedBytes: number = 0; // Cleared every tick, used to calculate download speed
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

    // FIXXX
    this.request = someNewRequest();

    this.getTask().currentDl++;
    this.status = MediaStatus.ACTIVE;
  }

  stop(finished = false) {
    if (this.status !== MediaStatus.ACTIVE) {
      return;
    }

    this.getTask().currentDl--;
    this.status = MediaStatus.PAUSED;
  }

  getTask() {
    return crud.getTask(this.taskId);
  }
}

export
class MediaStream extends Writable {
  constructor(
    public media: Media,
  ) {
    super({});
  }

  setSize(size: number) {
    this.media.size = size;
  }

  _write(chunk: any, encoding: string, callback: (err?: Error) => void) {
    // FIXME: Maybe some checks here, maybe not
    callback();
  }
}

export enum MediaSourceType {
  Mirror = "mirror",
  Stream = "stream",
};

export interface MediaSource {
  type: MediaSourceType;
  facetId: string;
  url: string;
}

export
class MediaSourceStream implements MediaSource {
  type: MediaSourceType;

  constructor(
    public url: string,
    public facetId: string, // Stream Resolver ID
  ) {
    this.type = MediaSourceType.Mirror;
  }
}

export
class MediaSourceMirror implements MediaSource {
  type: MediaSourceType;

  constructor(
    public url: string,
    public mirror: string,
    public facetId: string, // Mirror ID
    public sourceStream: MediaSourceStream = null,
  ) {
    this.type = MediaSourceType.Stream;
  }
}
