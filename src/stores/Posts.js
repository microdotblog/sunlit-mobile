import { delete_post } from '../api/Micropub';
import * as MicroBlogPosts from '../api/MicroBlogPosts';
import Auth from './Auth';
import { create_posts_store } from './createPostsStore';
import { notify_session_expired } from './sessionEvents';

const Posts = create_posts_store({
  api: { ...MicroBlogPosts, delete_post },
  get_token: () => Auth.get_token(),
  on_auth_error: notify_session_expired,
});

export default Posts;
