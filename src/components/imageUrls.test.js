import { describe, expect, it } from 'bun:test';

import { resized_image_url } from './imageUrls';

describe('resized_image_url', () => {
  it('routes an original upload through the Micro.blog resizer', () => {
    expect(resized_image_url('https://cdn.uploads.micro.blog/2509/img.jpg', 380)).toBe(
      'https://cdn.micro.blog/photos/400x/https%3A%2F%2Fcdn.uploads.micro.blog%2F2509%2Fimg.jpg',
    );
  });

  it('swaps the size of a URL that is already resized', () => {
    expect(resized_image_url('https://cdn.micro.blog/photos/1000x/https%3A%2F%2Fa.blog%2Fp.jpg', 500)).toBe(
      'https://cdn.micro.blog/photos/600x/https%3A%2F%2Fa.blog%2Fp.jpg',
    );
  });
});
