# Sunlit for Android: TODO

The Android port of [Sunlit](../sunlit), built with Expo and React Native. It is Android-first and iOS-capable. The goal is feature parity with iOS Sunlit 4.0.1, delivered in milestones that can each ship on their own.

## Milestone 1: Sign-in and reading

- [x] Scaffold: Expo 57, RN 0.86.3, MST, bun, committed `android/`
- [x] Sign in with IndieAuth (`client_id=https://sunlit.io/`, `sunlit://auth/callback`), with a pasted-token fallback
- [x] Theme: the Sunlit palette (accent #0099FF / #7ECBFF), light and dark
- [x] Bottom navigation: Timeline, Mentions, Discover. Places joins in M3.
- [x] Timeline: `/posts/media?filter=photos,videos&count=20&before_id=`, photo carousel cards with an identity bubble and BlurHash placeholders
- [x] Discover: `/posts/discover/photos`, grid/list toggle, user search (`/users/search?q=`)
- [x] Mentions: `/posts/mentions`
- [x] Profile: `/posts/{username}`, header, follow/unfollow, photo grid, following list
- [x] Conversation: `/posts/conversation?id=`, replies, reply composer with drafts and recipient picker
- [x] Image viewer: zoom, paging, overlay actions
- [x] Bookmarks: toggle via `POST /posts/bookmarks` and `DELETE /posts/bookmarks/{id}`
- [x] Context menus via PopupMenuAndroid
- [x] Deep links: `sunlit://show?id=`, `sunlit://notification`
- [x] Settings: sign out, version, links (iOS shows bundled credits.html; Android links to sunlit.io for now)
- [x] Android CI workflows (debug and release)

Verified on the Pixel 7 emulator while signed out: Discover (grid, list), conversations, the image viewer (zoom, swipe to dismiss), profiles, dark mode and back navigation. The signed-in screens have only unit tests so far: Timeline, Mentions, replies, bookmarks, follow and search all still need a real account.

## Milestone 2: Composer

- [x] Multi-section composer (text plus photos), title when there is more than one section
- [x] Photo picker, reorder, crop, alt text
- [x] Micropub config (`q=config`), destination picker
- [x] Media upload (`/micropub/media`), at most 4 in parallel
- [x] Video transcoding to H.264 at 640px max, 3 Mbps (react-native-compressor)
- [x] "Micro.blog Uploads" picker (`/micropub/media?q=source`)
- [x] Post as `postText` (one section on Micropub) or HTML (`sunlit_image`)
- [x] Delete own posts

Verified on the Pixel 7 emulator while signed in: the compose button and its long-press menu, the system photo picker, the composer with real destinations, crop (uCrop), alt text, the blog chooser, discarding (close and back), and the Uploads browser. Not yet tried on a device: actually publishing (it posts to a real blog), video transcoding and upload, and deleting a post. The builders and stores have unit tests matched to iOS `HTMLBuilder` and Snippets.

## Milestone 3: Places

- [x] Place search on OpenStreetMap through Photon (komoot): nearby places within 1 km, live search within 10 km
- [x] Check-in composer, JSON h-entry with `checkin` h-card (same as iOS, `maps.apple.com` link)
- [x] Check-in history (`q=source`, paged up to 500, filtered), OSM tile thumbnails
- [x] Check-in publish delay setting, and a separate check-in blog
- [x] Delete check-ins (long-press menu, the Android idiom for iOS swipe-to-delete)

Verified on the Pixel 7 emulator: the Places tab, the location permission prompt, nearby places (Portland GPS fix), live search, place selection, and the timeout error state. Not yet tried on a device: posting a real check-in, history rows with thumbnails, and deleting a check-in.

## Milestone 4: Android system integration

- [ ] Share target (images, a movie, URLs; glass.photo special case)
- [ ] Home-screen widget (Timeline or Discover)
- [ ] Push via FCM (`/users/push/register`, `app_name=Sunlit`)

## Milestone 5: External blogs

- [ ] Micropub blogs via IndieAuth (`client_id=https://sunlit.io/`, `redirect_uri=https://sunlit.io/micropub/redirect`)
- [ ] WordPress and other XML-RPC blogs (RSD discovery, `blogger.getUsersBlogs`)
- [ ] Separate blog selection for posts and for check-ins

## Open questions

- **Publishing on a device.** Make a real test post (one section, then several sections with a title, then a video) to a test blog, and delete it from the app.
- **iOS alt text bug.** iOS Snippets drops empty `mp-photo-alt[]` values, so alt text shifts onto the wrong photos when some are blank. Android sends aligned arrays. Worth fixing in Snippets.
- **Predictive back.** It is disabled because enabling it made back presses skip React Navigation on RN 0.86. Try again after the next RN or react-native-screens upgrade.
- **Timeline offline cache.** iOS keeps no disk cache. inkwell caches its timeline as JSON. Is that worth adding?
- **OSM fair use.** Places use the public Photon (photon.komoot.io) and OSM tile servers, with an identifying User-Agent and attribution. If Sunlit grows, move to a hosted OSM provider or a Micro.blog-run Photon. The public Overpass servers were overloaded in testing (all mirrors 502 or timing out), which is why Photon was chosen.
- **IndieAuth client_id.** `https://sunlit.io/` is assumed. Check that the Micro.blog consent screen shows "Sunlit" nicely (sunlit.io may need h-app markup or a `client.json`).
- **Push.** The Micro.blog server needs to accept FCM tokens for `app_name=Sunlit`. A Sunlit Firebase project and `google-services.json` are needed.
- **Bookmarks list.** iOS has an unreachable `BookmarksViewController`. Should Android expose a bookmarks screen?
- **Widget.** Pick an approach for a React Native widget (e.g. `react-native-android-widget`) or write it natively in Kotlin.
- **Release signing.** Keystore and Play Console listing for `blog.micro.sunlit`.
- **Privacy disclosure.** Nearby lookups and place searches send coordinates to komoot's Photon (photon.komoot.io), and tiles come from tile.openstreetmap.org. The Play Data safety form and the Sunlit privacy policy need to say so. The user's own fix is never posted, only the chosen venue.
- **External blog credentials.** iOS keeps per-blog tokens and XML-RPC passwords in UserDefaults. Android will use SecureStore. Confirm there is no need to migrate anything.
