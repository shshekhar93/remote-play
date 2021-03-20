import { join as pathJoin } from 'path';
import { writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import { default as makeDir } from 'make-dir';
import { ffprobe, FfprobeData, default as ffmpeg } from 'fluent-ffmpeg';
import { default as imagemin } from 'imagemin';
import { default as pngquant } from 'imagemin-pngquant';
import { promisify } from 'util';
import { delay, toReadableSize, toTimeStamp } from '../helpers/utils';
import { VideoDetails } from '../types';
const ffprobeAsync: (path: string) => Promise<FfprobeData> = promisify(ffprobe);

async function getVideoDetails(path: string): Promise<VideoDetails> {
  const details = await ffprobeAsync(path);
  const { duration = 0, size = 0 } = details.format;

  const durationTs = toTimeStamp(duration);
  const sizeStr = toReadableSize(size);

  const videoTrack = (details.streams || []).find(
    ({ codec_type }) => codec_type === 'video'
  );
  const { codec_name = '', width = 0, height = 0 } = videoTrack || {};
  const resolution = `${width}x${height}`;

  return {
    durationInSecs: duration,
    duration: durationTs,
    sizeInBytes: size,
    size: sizeStr,
    codec: codec_name,
    width,
    height,
    resolution,
  };
}

function getThumbsDir(path: string): string {
  const scFolder = createHash('sha1').update(path).digest('hex');
  return pathJoin(__dirname, '../_cache', scFolder);
}

const THUMBS_PROCESSING = new Set<string>();

async function takeScreenshots(path: string): Promise<void> {
  let waitCycles = 0;
  while (THUMBS_PROCESSING.has(path)) {
    waitCycles++;
    if (waitCycles > 3) {
      throw new Error('ELOCKED');
    }
    await delay(250);
  }

  THUMBS_PROCESSING.add(path);
  const folder = getThumbsDir(path);
  await makeDir(folder);

  await new Promise((resolve, reject) => {
    ffmpeg(path)
      .on('end', resolve)
      .on('error', (err) => reject(err))
      .screenshot({
        count: 1,
        filename: '%i.png',
        folder,
        size: '?x240',
      });
  });

  const thumbPath = pathJoin(folder, '1.png');
  const compressed = await imagemin([thumbPath], {
    plugins: [pngquant()],
  });
  if (compressed.length > 0 && compressed[0].data) {
    await writeFile(thumbPath, compressed[0].data);
  }
  THUMBS_PROCESSING.delete(path);
}

export { getVideoDetails, getThumbsDir, takeScreenshots };
