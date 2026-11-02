import { is_micro_blog_callback_url } from '../api/MicroBlogAuth';

export const linking = {
  prefixes: ['sunlit://'],
  filter: url => !is_micro_blog_callback_url(url),
  config: {
    screens: {
      Home: {
        screens: {
          Timeline: 'timeline',
          Mentions: 'notification',
          Discover: 'discover',
        },
      },
      Conversation: 'show',
    },
  },
};
