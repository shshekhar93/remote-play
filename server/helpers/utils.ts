export function toTimeStamp(seconds: number): string {
  if (!seconds) {
    return '00:00';
  }

  const restSeconds = seconds % 3600;
  return [(seconds / 3600) >> 0, (restSeconds / 60) >> 0, restSeconds % 60]
    .map((num) =>
      Math.round(num + 100)
        .toString()
        .substring(1)
    )
    .join(':');
}

const SIZE_ORDERS = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
export function toReadableSize(numBytes: number): string {
  if (numBytes === 0) {
    return '0 bytes';
  }

  let order = 0;
  while (numBytes > 1000) {
    numBytes = numBytes / 1000;
    order++;
  }
  return numBytes.toFixed(2) + ' ' + SIZE_ORDERS[order];
}

export function delay(mSecs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, mSecs);
  });
}
