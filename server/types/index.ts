export interface VideoCache {
  [key: string]: VideoCollection
}

export interface VideoCollection {
  [key: string]: Array<string>
}