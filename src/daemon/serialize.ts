import {Task, MediaStatus, } from "./tasks";

export interface TaskSerialized {
  url: string;
  title: string;
  cover: string;
  providerId: string;
  provider: string;
  active: boolean;
  list: number[];
  settings: Task["settings"];
}

export interface MediaSerialized {
  id: number;
  title: string;
  fileName: string;

  selected: boolean;
  status: MediaStatus;
  bytes: number;
  size: number;
  sources: number[];
  source: number;
}

export interface MediaSourceSerialized {

}

export function validateSerialized() {

}

export function serialize() {

}
