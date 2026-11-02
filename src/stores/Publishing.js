import { File } from 'expo-file-system';

import * as Micropub from '../api/Micropub';
import * as XmlRpc from '../api/xmlrpc';
import Auth from './Auth';
import Destinations from './Destinations';
import ExternalBlogs, { external_blog_storage } from './ExternalBlogs';
import { create_publishing } from './publishers';

const Publishing = create_publishing({
  micropub: Micropub,
  xmlrpc: XmlRpc,
  destinations: Destinations,
  external_blogs: ExternalBlogs,
  get_token: () => Auth.get_token(),
  get_secret: blog_id => external_blog_storage.load_secret(blog_id),
  read_base64: uri => new File(uri).base64(),
});

export default Publishing;
