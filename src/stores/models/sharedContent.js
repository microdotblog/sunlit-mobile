import { Parser } from 'htmlparser2';

export const MAX_SHARED_FILES = 10;
const GLASS_HOST = 'glass.photo';

export function shared_files_to_assets(files = []) {
  return (files || [])
    .filter(file => is_media_mime(file?.mimeType))
    .slice(0, MAX_SHARED_FILES)
    .map(file => ({
      kind: `${file.mimeType}`.startsWith('video/') ? 'video' : 'image',
      uri: file.path,
      width: file.width || 0,
      height: file.height || 0,
      mime: file.mimeType,
    }));
}

export function shared_url(share_intent) {
  const candidate = `${share_intent?.webUrl || share_intent?.text || ''}`.trim();

  try {
    const url = new URL(candidate);

    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return url.toString();
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
}

export function is_glass_url(raw_url) {
  try {
    const host = new URL(raw_url).host.replace(/^www\./, '');
    return host === GLASS_HOST;
  } catch (error) {
    return false;
  }
}

export function parse_glass_page(html = '', base_url = '') {
  let image_url = null;
  let description = '';
  let description_depth = 0;

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (name === 'img' && !image_url && attributes.src) {
          image_url = resolve_url(attributes.src, base_url);
        }

        if (name === 'p' && `${attributes.class || ''}`.includes('description')) {
          description_depth = 1;
          description = '';
        } else if (description_depth > 0) {
          description_depth += 1;
        }
      },

      ontext(text) {
        if (description_depth > 0) {
          description += text;
        }
      },

      onclosetag() {
        if (description_depth > 0) {
          description_depth -= 1;
        }
      },
    },
    { decodeEntities: true },
  );

  parser.write(html);
  parser.end();

  return {
    image_url,
    description: description.replace(/\s+/g, ' ').trim(),
  };
}

function is_media_mime(mime) {
  const value = `${mime || ''}`;
  return value.startsWith('image/') || value.startsWith('video/');
}

function resolve_url(source, base_url) {
  try {
    return new URL(source, base_url || undefined).toString();
  } catch (error) {
    return null;
  }
}
