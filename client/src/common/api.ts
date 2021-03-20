import { VideoCache } from '../../../types';

export async function loadLibrary(): Promise<VideoCache> {
  const resp = await fetch('/library');
  if(!resp.ok) {
    throw new Error('LOAD_FAILED');
  }
  return await resp.json();
}
