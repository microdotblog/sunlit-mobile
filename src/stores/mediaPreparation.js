import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Video } from 'react-native-compressor';

const MAX_SMALLEST_DIMENSION = 1800;
const JPEG_QUALITY = 0.7;
const VIDEO_MAX_SIZE = 640;
const VIDEO_BITRATE = 3000000;

export async function prepare_media(media) {
  if (media.kind === 'video') {
    return prepare_video(media);
  } else {
    return prepare_image(media);
  }
}

async function prepare_image(media) {
  const is_png = media.mime === 'image/png';
  const context = ImageManipulator.manipulate(media.uri);

  if (media.width > MAX_SMALLEST_DIMENSION && media.height > MAX_SMALLEST_DIMENSION) {
    if (media.width < media.height) {
      context.resize({ width: MAX_SMALLEST_DIMENSION });
    } else {
      context.resize({ height: MAX_SMALLEST_DIMENSION });
    }
  }

  const image = await context.renderAsync();
  const result = await image.saveAsync({
    compress: JPEG_QUALITY,
    format: is_png ? SaveFormat.PNG : SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    name: `${media.id}.${is_png ? 'png' : 'jpg'}`,
    type: is_png ? 'image/png' : 'image/jpeg',
  };
}

async function prepare_video(media) {
  const uri = await Video.compress(media.uri, {
    compressionMethod: 'manual',
    maxSize: VIDEO_MAX_SIZE,
    bitrate: VIDEO_BITRATE,
  });

  return {
    uri,
    name: `${media.id}.mp4`,
    type: 'video/mp4',
  };
}
