import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsWalker from '@nodelib/fs.walk';
import debug from 'debug';
import * as config from '../config/config.json';
import { VideoCache, VideoCollection } from '../types';

const debuglog = debug('remote-play:walker');

const VIDEOS = new Map<string, VideoCollection>();

function handleNewFile(root: string, file: fsWalker.Entry) {
  const { dir, base } = path.parse(file.path);

  if(!VIDEOS.has(root)) {
    VIDEOS.set(root, {});
  }

  const rootBase = VIDEOS.get(root) || {};
  if(rootBase[dir] === undefined) {
    rootBase[dir] = [];
  }

  rootBase[dir].push(base);
}

function shouldKeepFile(entry: fsWalker.Entry): boolean {
  const { extensions = [] } = config.videos;
  return extensions.some(ext => entry.name.endsWith(ext));
}

function shouldIgnoreError(error: Error) {
  return true;
}

let populating = false;
async function populateLibrary(forceReload: boolean = false): Promise<void> {
  if(populating) {
    debuglog('A library populate request is already in progress.');
    return;
  }

  populating = true;
  if(!forceReload) {
    const done = await populateFromCache();
    if(done) {
      populating = false;
      return;
    }
  }

  return new Promise<void>(resolve => {
    const { roots } = config.videos;
    let idx = 0;

    const loadMore = (): void => {
      if(idx >= roots.length) {
        saveToCache()
          .catch(() => {})
          .finally(() => {
            populating = false;
            resolve();
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
  return Array.from(VIDEOS.entries())
    .reduce((all: VideoCache, [key, coll]) => ({
      ...all,
      [key]: coll
    }), {});
}

function getCacheFilename(): string {
  return path.join(__dirname, '../_library-cache.json');
}

function saveToCache(): Promise<void> {
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

export {
  populateLibrary,
  getLibraries
};
