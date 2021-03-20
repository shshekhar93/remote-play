export interface VideoCache {
  [key: string]: VideoCollection;
}

export interface VideoEntry {
  name: string;
  fullPath: string;
  details: VideoDetails | null;
}

export interface VideoCollection {
  [key: string]: Array<VideoEntry>;
}

export interface VideoDetails {
  durationInSecs: number;
  duration: string;
  sizeInBytes: number;
  size: string;
  codec: string;
  width: number;
  height: number;
  resolution: string;
}
