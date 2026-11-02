import { Parser } from 'htmlparser2';

const EMOJI_IMAGE_PATTERN = '/images/core/emoji';
const MINI_THUMBNAIL_PREFIX = 'https://micro.blog/photos/50/';
const BLOCK_TAGS = new Set([
  'p', 'div', 'blockquote', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figure', 'figcaption', 'pre',
]);
const BOLD_TAGS = new Set(['strong', 'b', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const ITALIC_TAGS = new Set(['em', 'i', 'cite']);
const SKIPPED_TAGS = new Set(['script', 'style']);

export function parse_post_html(html = '') {
  const media = [];
  const paragraphs = [];
  const link_stack = [];
  let current_spans = [];
  let bold_depth = 0;
  let italic_depth = 0;
  let skipped_depth = 0;

  function flush_paragraph() {
    const spans = trim_spans(current_spans);

    if (spans.length > 0) {
      paragraphs.push(spans);
    }

    current_spans = [];
  }

  function append_text(text) {
    if (skipped_depth > 0 || !text) {
      return;
    }

    const collapsed_text = text.replace(/\s+/g, ' ');
    const href = link_stack.length > 0 ? link_stack[link_stack.length - 1] : null;
    const span = {
      text: collapsed_text,
      href,
      bold: bold_depth > 0,
      italic: italic_depth > 0,
    };
    const previous_span = current_spans[current_spans.length - 1];

    if (previous_span && has_same_style(previous_span, span)) {
      previous_span.text += collapsed_text;
    } else {
      current_spans.push(span);
    }
  }

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (SKIPPED_TAGS.has(name)) {
          skipped_depth += 1;
        } else if (name === 'img') {
          handle_image(attributes);
        } else if (name === 'video') {
          handle_video(attributes);
        } else if (name === 'br') {
          flush_paragraph();
        } else if (name === 'a') {
          link_stack.push(`${attributes.href || ''}`.trim() || null);
        } else if (BLOCK_TAGS.has(name)) {
          flush_paragraph();
        }

        if (BOLD_TAGS.has(name)) {
          bold_depth += 1;
        }

        if (ITALIC_TAGS.has(name)) {
          italic_depth += 1;
        }
      },

      ontext(text) {
        append_text(text);
      },

      onclosetag(name) {
        if (SKIPPED_TAGS.has(name)) {
          skipped_depth = Math.max(skipped_depth - 1, 0);
        } else if (name === 'a') {
          link_stack.pop();
        } else if (BLOCK_TAGS.has(name)) {
          flush_paragraph();
        }

        if (BOLD_TAGS.has(name)) {
          bold_depth = Math.max(bold_depth - 1, 0);
        }

        if (ITALIC_TAGS.has(name)) {
          italic_depth = Math.max(italic_depth - 1, 0);
        }
      },
    },
    { decodeEntities: true },
  );

  function handle_image(attributes) {
    const source = `${attributes.src || ''}`.trim();

    if (!source) {
      return;
    }

    if (source.includes(EMOJI_IMAGE_PATTERN)) {
      append_text(attributes.alt || '');
      return;
    }

    media.push({
      url: expand_mini_thumbnail(source),
      video_url: null,
      alt: `${attributes.alt || ''}`.trim(),
      width: parse_dimension(attributes.width),
      height: parse_dimension(attributes.height),
    });
  }

  function handle_video(attributes) {
    const source = `${attributes.src || ''}`.trim();

    if (!source) {
      return;
    }

    media.push({
      url: `${attributes.poster || ''}`.trim(),
      video_url: source,
      alt: `${attributes.alt || ''}`.trim(),
      width: parse_dimension(attributes.width),
      height: parse_dimension(attributes.height),
    });
  }

  parser.write(`${html || ''}`);
  parser.end();
  flush_paragraph();

  return { media, paragraphs };
}

export function resolve_aspect_ratio(media = [], default_photo = null) {
  let aspect_ratio = 0;

  media.forEach(item => {
    if (item.width > 0 && item.height > 0) {
      aspect_ratio = Math.max(aspect_ratio, item.height / item.width);
    }
  });

  const default_width = parse_dimension(default_photo?.width);
  const default_height = parse_dimension(default_photo?.height);

  if (default_width > 0 && default_height > 0) {
    aspect_ratio = Math.max(aspect_ratio, default_height / default_width);
  }

  if (aspect_ratio > 0) {
    return aspect_ratio;
  } else {
    return 1;
  }
}

export function paragraphs_to_plain_text(paragraphs = []) {
  return paragraphs
    .map(spans => spans.map(span => span.text).join(''))
    .join('\n\n');
}

function expand_mini_thumbnail(source) {
  if (!source.startsWith(MINI_THUMBNAIL_PREFIX)) {
    return source;
  }

  const original = source.slice(MINI_THUMBNAIL_PREFIX.length);

  try {
    return decodeURIComponent(original);
  } catch (error) {
    return original;
  }
}

function parse_dimension(value) {
  const parsed_value = parseInt(`${value || ''}`, 10);

  if (Number.isFinite(parsed_value) && parsed_value > 0) {
    return parsed_value;
  } else {
    return 0;
  }
}

function has_same_style(left, right) {
  return left.href === right.href && left.bold === right.bold && left.italic === right.italic;
}

function trim_spans(spans) {
  const trimmed_spans = spans.map(span => ({ ...span }));

  if (trimmed_spans.length > 0) {
    trimmed_spans[0].text = trimmed_spans[0].text.replace(/^\s+/, '');
    const last_span = trimmed_spans[trimmed_spans.length - 1];
    last_span.text = last_span.text.replace(/\s+$/, '');
  }

  return trimmed_spans.filter(span => span.text.length > 0);
}
