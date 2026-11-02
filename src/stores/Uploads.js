import * as Micropub from '../api/Micropub';
import Auth from './Auth';
import { create_uploads_store } from './createUploadsStore';
import Destinations from './Destinations';
import { notify_session_expired } from './sessionEvents';

const Uploads = create_uploads_store({
  api: Micropub,
  destinations: Destinations,
  get_token: () => Auth.get_token(),
  on_auth_error: notify_session_expired,
});

export default Uploads;
