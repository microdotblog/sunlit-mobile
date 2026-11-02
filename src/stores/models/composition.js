const MAX_HTML_IMAGE_WIDTH = 600;
const MAX_VIDEO_SIZE = 640;
const DEFAULT_VIDEO_SIZE = { width: 640, height: 480 };
const THUMBNAIL_PREFIX = 'https://micro.blog/photos/200/';

export function uses_micropub_form(sections) {
  return sections.length <= 1;
}

export function build_micropub_form({ section, destination_uid = null, locations }) {
  const photos = section.media.filter(media => media.kind === 'image');
  const videos = section.media.filter(media => media.kind === 'video');
  const form = {
    h: 'entry',
    content: section.text.trim(),
    'mp-destination': destination_uid,
    'post-status': 'published',
  };

  if (photos.length > 0) {
    form['photo[]'] = photos.map(media => locations[media.id].url);
    form['mp-photo-alt[]'] = photos.map(media => media.alt.trim());
  }

  if (videos.length > 0) {
    form['video[]'] = videos.map(media => locations[media.id].url);
    form['mp-video-alt[]'] = videos.map(media => media.alt.trim());
  }

  return form;
}

export function build_html_post({ title = '', sections, destination_uid = null, locations }) {
  const properties = {
    content: [{ html: build_html(sections, locations) }],
    'post-status': ['published'],
  };
  const trimmed_title = title.trim();

  if (trimmed_title) {
    properties.name = [trimmed_title];
  }

  const post = { type: ['h-entry'], properties };

  if (destination_uid) {
    post['mp-destination'] = destination_uid;
  }

  return post;
}

export function build_html(sections, locations) {
  return sections.map(section => build_section_html(section, locations)).join('\n\n');
}

function build_section_html(section, locations) {
  const text = section.text.trim();
  const use_thumbnails = section.media.length > 1;
  const media_html = section.media
    .map(media => build_media_html(media, locations[media.id], use_thumbnails))
    .join('');

  if (text && media_html) {
    return `${text}\n\n${media_html}`;
  } else {
    return text || media_html;
  }
}

function build_media_html(media, location, use_thumbnails) {
  const size = build_size_attributes(media);
  const alt = escape_attribute(media.alt.trim());

  if (media.kind === 'video') {
    return `<video controls="controls" playsinline="playsinline" src="${location.url}"${size} alt="${alt}" poster="${location.poster || ''}" preload="none" />`;
  }

  if (use_thumbnails) {
    return `<a href="${location.url}"><img src="${THUMBNAIL_PREFIX}${location.url}"${size} alt="${alt}" style="display: inline-block; max-height: 200px; width: auto; padding: 1px;" class="sunlit_image" /></a>`;
  }

  return `<img src="${location.url}"${size} alt="${alt}" style="height: auto;" class="sunlit_image" />`;
}

function build_size_attributes(media) {
  if (media.kind === 'video') {
    const { width, height } = video_size(media.width, media.height);
    return ` width="${width}" height="${height}"`;
  }

  if (!(media.width > 0 && media.height > 0)) {
    return '';
  }

  const { width, height } = scale_to_width(media.width, media.height, MAX_HTML_IMAGE_WIDTH);
  return ` width="${width}" height="${height}"`;
}

export function video_size(width, height) {
  if (!(width > 0 && height > 0)) {
    return DEFAULT_VIDEO_SIZE;
  }

  if (width > MAX_VIDEO_SIZE && height > MAX_VIDEO_SIZE) {
    if (width > height) {
      return { width: MAX_VIDEO_SIZE, height: Math.trunc((height * MAX_VIDEO_SIZE) / width) };
    } else {
      return { width: Math.trunc((width * MAX_VIDEO_SIZE) / height), height: MAX_VIDEO_SIZE };
    }
  }

  return { width: Math.trunc(width), height: Math.trunc(height) };
}

export function scale_to_width(width, height, max_width) {
  if (width > max_width) {
    return { width: max_width, height: Math.trunc((max_width * height) / width) };
  } else {
    return { width: Math.trunc(width), height: Math.trunc(height) };
  }
}

function escape_attribute(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
