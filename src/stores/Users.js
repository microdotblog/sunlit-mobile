import * as MicroBlogPosts from '../api/MicroBlogPosts';
import Auth from './Auth';
import { create_users_store } from './createUsersStore';
import { notify_session_expired } from './sessionEvents';

const Users = create_users_store({
  api: MicroBlogPosts,
  get_token: () => Auth.get_token(),
  on_auth_error: notify_session_expired,
});

export default Users;
