import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator } from 'expo-image-manipulator';

import { USER_AGENT } from '../api/request';
import { is_glass_url, parse_glass_page, shared_files_to_assets, shared_url } from './models/sharedContent';

export async function import_share(share_intent) {
  const files = shared_files_to_assets(share_intent?.files);

  if (files.length > 0) {
    return { assets: await Promise.all(files.map(measure_image)), text: '' };
  }

  const url = shared_url(share_intent);

  if (!url) {
    throw new Error('Sunlit can only post photos and videos.');
  }

  if (is_glass_url(url)) {
    return import_glass_page(url);
  }

  return { assets: [await download_image(url)], text: '' };
}

async function import_glass_page(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

  if (!response.ok) {
    throw new Error('Could not open that Glass photo.');
  }

  const page = parse_glass_page(await response.text(), url);

  if (!page.image_url) {
    throw new Error('Could not find a photo on that Glass page.');
  }

  return { assets: [await download_image(page.image_url)], text: page.description };
}

async function download_image(url) {
  const directory = new Directory(Paths.cache, 'shared');

  if (!directory.exists) {
    directory.create();
  }

  const file = await File.downloadFileAsync(url, directory, { headers: { 'User-Agent': USER_AGENT }, idempotent: true });

  try {
    return await measure_image({ kind: 'image', uri: file.uri, width: 0, height: 0, mime: null });
  } catch (error) {
    file.delete();
    throw new Error('That link is not a photo Sunlit can post.');
  }
}

async function measure_image(asset) {
  if (asset.kind !== 'image' || (asset.width > 0 && asset.height > 0)) {
    return asset;
  }

  const image = await ImageManipulator.manipulate(asset.uri).renderAsync();
  return { ...asset, width: image.width, height: image.height };
}
