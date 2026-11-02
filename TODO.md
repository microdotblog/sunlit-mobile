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

- [ ] Multi-section composer (text plus photos), title when there is more than one section
- [ ] Photo picker, reorder, crop, alt text
- [ ] Micropub config (`q=config`), destination picker
- [ ] Media upload (`/micropub/media`), at most 4 in parallel
- [ ] Video transcoding to H.264 at 640px max (library to choose)
- [ ] "Micro.blog Uploads" picker (`/micropub/media?q=source`)
- [ ] Post as `postText` (one section on Micropub) or HTML (`sunlit_image`)
- [ ] Delete own posts

## Milestone 3: Places

- [ ] `PlaceSearch` interface, then pick a provider (see open questions)
- [ ] Check-in composer, JSON h-entry with `checkin` h-card
- [ ] Check-in history (`q=source`, filtered), map thumbnails
- [ ] Check-in publish delay setting
- [ ] Swipe to delete check-ins

## Milestone 4: Android system integration

- [ ] Share target (images, a movie, URLs; glass.photo special case)
- [ ] Home-screen widget (Timeline or Discover)
- [ ] Push via FCM (`/users/push/register`, `app_name=Sunlit`)

## Milestone 5: External blogs

- [ ] Micropub blogs via IndieAuth (`client_id=https://sunlit.io/`, `redirect_uri=https://sunlit.io/micropub/redirect`)
- [ ] WordPress and other XML-RPC blogs (RSD discovery, `blogger.getUsersBlogs`)
- [ ] Separate blog selection for posts and for check-ins

## Open questions

- **Signed-in check on a device.** Sign in with a real account (IndieAuth or an app token) and walk through Timeline, Mentions, replies, bookmarks, follow and search.
- **Predictive back.** It is disabled because enabling it made back presses skip React Navigation on RN 0.86. Try again after the next RN or react-native-screens upgrade.
- **Timeline offline cache.** iOS keeps no disk cache. inkwell caches its timeline as JSON. Is that worth adding?
- **Places provider.** Foursquare, Google Places or OpenStreetMap. To decide at M3. Map thumbnails depend on the same choice.
- **IndieAuth client_id.** `https://sunlit.io/` is assumed. Check that the Micro.blog consent screen shows "Sunlit" nicely (sunlit.io may need h-app markup or a `client.json`).
- **Push.** The Micro.blog server needs to accept FCM tokens for `app_name=Sunlit`. A Sunlit Firebase project and `google-services.json` are needed.
- **Bookmarks list.** iOS has an unreachable `BookmarksViewController`. Should Android expose a bookmarks screen?
- **Widget.** Pick an approach for a React Native widget (e.g. `react-native-android-widget`) or write it natively in Kotlin.
- **Video transcoding.** Pick a library: `react-native-compressor` or a Media3 Transformer native module.
- **Release signing.** Keystore and Play Console listing for `blog.micro.sunlit`.
- **External blog credentials.** iOS keeps per-blog tokens and XML-RPC passwords in UserDefaults. Android will use SecureStore. Confirm there is no need to migrate anything.
