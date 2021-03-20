import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsWalker from '@nodelib/fs.walk';
import debug from 'debug';
import * as config from '../config/config.json';
import { VideoCache, VideoCollection, VideoEntry } from '../types';
import { getVideoDetails } from './probe';

const debuglog = debug('remote-play:walker');

const VIDEOS = new Map<string, VideoCollection>();

async function isPathValid(path: string): Promise<boolean> {
  const roots = config.videos.roots || [];
  if(!roots.some(root => path.startsWith(root))) {
    return false;
  }

  try {
    await fs.access(path);
    return true;
  }
  catch(e) {
    return false;
  }
}

function handleNewFile(root: string, file: fsWalker.Entry) {
  const { dir, base: name } = path.parse(file.path);

  if(!VIDEOS.has(root)) {
    VIDEOS.set(root, {});
  }

  const rootBase = VIDEOS.get(root) || {};
  if(rootBase[dir] === undefined) {
    rootBase[dir] = [];
  }

  const fullPath = path.join(root, file.path);
  rootBase[dir].push({
    name,
    fullPath,
    details: null
  });
}

function shouldKeepFile(entry: fsWalker.Entry): boolean {
  const { extensions = [] } = config.videos;
  return extensions.some(ext => entry.name.endsWith(ext));
}

function shouldIgnoreError(error: Error) {
  return true;
}

let populating = false;
async function populateLibrary(forceReload: boolean = false): Promise<boolean> {
  if(populating) {
    debuglog('A library populate request is already in progress.');
    return false;
  }

  populating = true;
  if(!forceReload) {
    const done = await populateFromCache();
    if(done) {
      populating = false;
      return false;
    }
  }

  return new Promise<boolean>(resolve => {
    const { roots } = config.videos;
    let idx = 0;

    const loadMore = (): void => {
      if(idx >= roots.length) {
        saveToCache()
          .catch(() => {})
          .finally(() => {
            populating = false;
            resolve(true);
          });
        return;
      }

      fsWalker.walkStream(roots[idx], {
        basePath: '',
        entryFilter: shouldKeepFile,
        errorFilter: shouldIgnoreError
      })
        .on('data', handleNewFile.bind(null, roots[idx]))
        .on('error', (err) => debuglog('Recursive walk error', err.stack))
        .on('end', () => {
          idx++;
          loadMore();
        });
    }
    loadMore();
  });
}

function getLibraries(): VideoCache {
  return Object.fromEntries(VIDEOS);
}

function getCacheFilename(): string {
  return path.join(__dirname, '../_cache/library-cache.json');
}

async function saveToCache(): Promise<void> {
  if(VIDEOS.size === 0) {
    return;
  }

  const serialized = JSON.stringify(Array.from(VIDEOS.entries()));
  let shutdownRequested = false;

  const delayShutdown = () => {
    console.log('Saving library. The server will shutdown after save is complete.');
    shutdownRequested = true;
  };

  process.once('SIGTERM', delayShutdown);
  process.once('SIGINT', delayShutdown);
  return fs.writeFile(getCacheFilename(), serialized, 'utf-8')
    .catch((err: Error) => {
      debuglog('Save failed:', err.stack);
    })
    .finally(() => {
      if(shutdownRequested) {
        process.exit();
      }
      process.off('SIGTERM', delayShutdown);
      process.off('SIGINT', delayShutdown);
    });
}

async function populateFromCache(): Promise<boolean> {
  try {
    const cacheStr = await fs.readFile(getCacheFilename(), 'utf-8');
    let cache: Map<string, VideoCollection>;
    try {
      cache = new Map(JSON.parse(cacheStr));
    }
    catch(e) {
      throw new Error('PARSEFAIL')
    }

    VIDEOS.clear();
    cache.forEach((val, key) => VIDEOS.set(key, val));

    debuglog('Library populated from cache.');
    return true;
  }
  catch(e) {
    // File not found or JSON parse failed.
    // This is okay.
    if(e.code === 'ENOENT' || e.message === 'PARSEFAIL') {
      return false;
    }
    console.error('Library read failed.', e.stack);
    throw e;
  }
}

async function probeAllVideoDetails(): Promise<void> {
  let count = 0;
  for(const coll of VIDEOS.values()) {
    for(const entries of Object.values(coll)) {
      for(const entry of entries) {
        if(entry.details !== null) {
          continue;
        }
        entry.details = await getVideoDetails(entry.fullPath);
        count++;

        if(count % 100 === 0) {
          await saveToCache();
        }
      }
    }
  }
  if(count % 100 !== 0) {
    await saveToCache();
  }
}

async function probeVideoDetails():
  Promise<void>;
async function probeVideoDetails(root: string, dir: string, filename: string): 
  Promise<VideoEntry | undefined>;
async function probeVideoDetails(...args: string[]) {
  if(args.length === 0) {
    return probeAllVideoDetails();
  }

  const [
    root, dir, filename
  ] = args;
  const coll = VIDEOS.get(root);
  const entries = coll?.[dir];
  const entry = entries?.find(({name}) => name === filename);

  if(entry === undefined) {
    return;
  }

  if(entry.details === null) {
    entry.details = await getVideoDetails(entry.fullPath);
  }

  // @TODO: Save this back to library.

  return entry;
}

export {
  isPathValid,
  populateLibrary,
  probeVideoDetails,
  getLibraries
};
