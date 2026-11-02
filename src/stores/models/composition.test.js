import { describe, expect, it } from 'bun:test';

import { build_html, build_html_post, build_micropub_form, scale_to_width, uses_micropub_form, video_size } from './composition';

function image(id, extra = {}) {
  return { id, kind: 'image', alt: '', width: 1200, height: 800, ...extra };
}

const LOCATIONS = {
  a: { url: 'https://vincent.blog/uploads/a.jpg', poster: null },
  b: { url: 'https://vincent.blog/uploads/b.jpg', poster: null },
  v: { url: 'https://vincent.blog/uploads/v.mov', poster: 'https://vincent.blog/uploads/v.jpg' },
};

describe('uses_micropub_form', () => {
  it('posts a single section as a Micropub form and more as HTML', () => {
    expect(uses_micropub_form([{}])).toBe(true);
    expect(uses_micropub_form([{}, {}])).toBe(false);
  });
});

describe('build_micropub_form', () => {
  it('sends photos with alt text kept in step', () => {
    const form = build_micropub_form({
      section: { text: ' Golden hour. ', media: [image('a'), image('b', { alt: 'Sea' })] },
      destination_uid: 'https://vincent.blog/',
      locations: LOCATIONS,
    });

    expect(form).toEqual({
      h: 'entry',
      content: 'Golden hour.',
      'mp-destination': 'https://vincent.blog/',
      'post-status': 'published',
      'photo[]': ['https://vincent.blog/uploads/a.jpg', 'https://vincent.blog/uploads/b.jpg'],
      'mp-photo-alt[]': ['', 'Sea'],
    });
  });

  it('sends videos separately from photos', () => {
    const form = build_micropub_form({
      section: { text: '', media: [{ id: 'v', kind: 'video', alt: 'Waves', width: 640, height: 360 }] },
      locations: LOCATIONS,
    });

    expect(form['video[]']).toEqual(['https://vincent.blog/uploads/v.mov']);
    expect(form['mp-video-alt[]']).toEqual(['Waves']);
    expect(form['photo[]']).toBeUndefined();
  });
});

describe('build_html', () => {
  it('matches the iOS markup for a single photo', () => {
    const html = build_html([{ text: 'Hello', media: [image('a', { alt: 'A "quote" & more' })] }], LOCATIONS);

    expect(html).toBe(
      'Hello\n\n<img src="https://vincent.blog/uploads/a.jpg" width="600" height="400" alt="A &quot;quote&quot; &amp; more" style="height: auto;" class="sunlit_image" />',
    );
  });

  it('links thumbnails to the originals when a section has several photos', () => {
    const html = build_html([{ text: '', media: [image('a'), image('b')] }], LOCATIONS);

    expect(html).toContain('<a href="https://vincent.blog/uploads/a.jpg"><img src="https://micro.blog/photos/200/https://vincent.blog/uploads/a.jpg"');
    expect(html).toContain('max-height: 200px');
  });

  it('separates sections with a blank line', () => {
    const html = build_html(
      [
        { text: 'One', media: [image('a')] },
        { text: 'Two', media: [image('b')] },
      ],
      LOCATIONS,
    );

    expect(html.split('\n\n')).toHaveLength(4);
    expect(html.startsWith('One\n\n<img')).toBe(true);
  });

  it('uses the uploaded poster for videos', () => {
    const html = build_html([{ text: '', media: [{ id: 'v', kind: 'video', alt: '', width: 640, height: 360 }] }], LOCATIONS);

    expect(html).toBe(
      '<video controls="controls" playsinline="playsinline" src="https://vincent.blog/uploads/v.mov" width="640" height="360" alt="" poster="https://vincent.blog/uploads/v.jpg" preload="none" />',
    );
  });
});

describe('build_html for picked uploads', () => {
  it('leaves out the size when it is unknown', () => {
    const html = build_html([{ text: '', media: [image('a', { width: 0, height: 0 })] }], LOCATIONS);

    expect(html).toBe('<img src="https://vincent.blog/uploads/a.jpg" alt="" style="height: auto;" class="sunlit_image" />');
  });
});

describe('build_html_post', () => {
  it('wraps the HTML in a JSON h-entry with the title and destination', () => {
    const post = build_html_post({
      title: ' Weekend ',
      sections: [{ text: 'One', media: [] }],
      destination_uid: 'https://vincent.blog/',
      locations: LOCATIONS,
    });

    expect(post).toEqual({
      type: ['h-entry'],
      properties: { content: [{ html: 'One' }], 'post-status': ['published'], name: ['Weekend'] },
      'mp-destination': 'https://vincent.blog/',
    });
  });
});

describe('video_size', () => {
  it('matches the iOS transcoder sizes', () => {
    expect(video_size(1920, 1080)).toEqual({ width: 640, height: 360 });
    expect(video_size(1080, 1920)).toEqual({ width: 360, height: 640 });
    expect(video_size(640, 360)).toEqual({ width: 640, height: 360 });
    expect(video_size(0, 0)).toEqual({ width: 640, height: 480 });
  });
});

describe('scale_to_width', () => {
  it('keeps small images as they are', () => {
    expect(scale_to_width(400, 300, 600)).toEqual({ width: 400, height: 300 });
  });
});
