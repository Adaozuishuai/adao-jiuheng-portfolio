import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { getUploadDir } from './runtime';

function assetPath(objectKey: string) {
  const root = getUploadDir();
  const fullPath = resolve(root, objectKey);
  if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) throw new Error('非法的图片路径');
  return fullPath;
}

export async function readAsset(objectKey: string) {
  return readFile(assetPath(objectKey));
}
