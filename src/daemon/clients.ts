export enum Instruction {
  Load = "load",
  Select = "select",
  Start = "start",
  Stop = "stop",
  Delete = "delete",
}

export const instructions = {
  load(done: () => void) {

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
