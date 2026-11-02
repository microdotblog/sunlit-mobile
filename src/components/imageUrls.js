const PROXY_PREFIX = 'https://cdn.micro.blog/photos/';
const SIZE_STEP = 200;

export function resized_image_url(url, pixel_width) {
  if (!url) {
    return url;
  }

  const width = Math.ceil(pixel_width / SIZE_STEP) * SIZE_STEP;

  if (url.startsWith(PROXY_PREFIX)) {
    const original = url.slice(PROXY_PREFIX.length).replace(/^[^/]+\//, '');
    return `${PROXY_PREFIX}${width}x/${original}`;
  } else {
    return `${PROXY_PREFIX}${width}x/${encodeURIComponent(url)}`;
  }
}
