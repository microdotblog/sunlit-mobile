# Sunlit for Android

Sunlit is a photo-blogging app for Micro.blog: you share photos to your blog and discover photography from the community. This repo is the Android app, built with Expo and React Native. The native iOS app lives in `../sunlit`.

Android is the target, but the code stays buildable on iOS: platform differences live in `src/platform/` and nowhere else.

## Product concepts

Timeline (photos and videos from people you follow), Discover, Mentions, profiles, conversations and replies, the image viewer, bookmarks, following, the photo composer, Places check-ins (the tab is hidden for now behind `SHOW_PLACES_TAB` in `src/navigation/RootNavigator.js`), a share target, a home-screen widget, and external blogs (Micropub and WordPress/XML-RPC), and push notifications. `TODO.md` tracks milestones and open questions.

## Expo

For Expo documentation and how-tos, see https://docs.expo.dev/llms.txt.

## Reference projects

- `../sunlit` (Swift) is the source of truth for product behaviour, flows, and look. Its colours live in `Sunlit/Resources/Assets.xcassets`.
- `../inkwell-react` is the model for structure: MST stores, auth, the fetch wrapper, Android menus, and CI.
- `../microblog-react` is the reference for Micropub posting, media upload, and blog destinations. It is bare React Native with axios, so adapt it rather than copying it.
- iOS networking goes through the Snippets Swift package (github.com/microdotblog/snippets). Check endpoint paths and parameters there.

## Architecture

- `src/api/` handles transport only. `request.js` is the shared `request_json` wrapper (Bearer token, form bodies, errors with `.status` and `.response_text`). Requests to other servers go through `fetch_external`, which sends `USER_AGENT` and turns network failures into a readable message. `blogDiscovery.js`, `xmlrpc.js`, and `externalAuth.js` are the external blog transport.
- `src/stores/` holds the MST singletons. Stores with real dependencies are built by `create_*_store` factories, so tests can inject doubles.
  - `Posts` keeps one map of posts plus keyed lists: `timeline`, `discover`, `mentions`, `photos:<username>`, `conversation:<id>`. A change to a post, such as a bookmark, therefore shows up in every list.
  - `Users` holds profiles, follow state, following lists, and search.
  - `Session` resets every store when a 401 or 403 arrives through `sessionEvents`.
  - `Composer` (`create_composer_store`) holds the sections and media and does upload-then-post, with at most 4 uploads at once and a generation counter so a cancelled post can't finish later. The payloads come from `models/composition.js`. One section is a Micropub form (`photo[]`, `mp-photo-alt[]`), several sections are a JSON h-entry with iOS `HTMLBuilder` markup. `mediaPreparation.js` resizes images (shorter side 1800 px, JPEG 0.7) and transcodes video (640 px, 3 Mbps).
  - `Destinations` reads `micropub?q=config` and lists targets: Micro.blog blogs keyed by uid, and external blogs keyed `external:<id>`. It remembers the chosen target and a separate check-in target. XML-RPC blogs are never check-in targets. `Uploads` reads `micropub/media?q=source`.
  - `ExternalBlogs` discovers a blog (Micropub links first, then RSD), runs IndieAuth or checks an XML-RPC password, and keeps the blog list. Secrets live in SecureStore under `ExternalBlogSecret-<id>`. Signing out or an expired Micro.blog session forgets every external blog and its secret, because the next person to sign in may be someone else. Discovery uses a generation counter, so a discovery that finishes after its screen closed is dropped. IndieAuth uses PKCE (S256), and Sunlit only talks to Micropub and XML-RPC endpoints over https.
  - `Publishing` (`publishers.js`) turns the selected target into a publisher with one interface (`upload`, `publish`, `create_json`, `fetch_source`, `delete_post`). The Composer and Places talk only to publishers. Only a Micro.blog publisher's 401 signs you out.
  - `Places` holds check-in history (`micropub?q=source`, paged up to 500), posts check-ins (a JSON h-entry with a `checkin` h-card, the same as iOS), deletes them, and stores the publish delay. `PlaceSearch` finds nearby places and searches them through Photon (`api/OpenStreetMap.js`). `currentLocation.js` asks for a high-accuracy fix, because balanced accuracy has no GPS fallback.
  - `Push` (`create_push_store`) asks for notification permission from Mentions, registers the FCM token as `Sunlit for Android`, and unregisters on sign-out before the token is cleared. `src/platform/pushNotifications.js` wraps expo-notifications and reports "denied" on iOS, so an iOS build never registers an APNs token under the Android name. `src/components/PushHandler.js` routes taps (conversation for a `post_id`, Mentions otherwise) and re-registers rotated tokens.
- `src/components/ShareIntentHandler.js` opens the composer with shared files or URLs (`shareImport.js` downloads URLs and the glass.photo case).
- `src/widget/` is the `SunlitPhotos` home-screen widget. `widgetData.js` builds it outside React, with the token read straight from SecureStore. `updateWidgets.js` refreshes widgets when the app backgrounds or the session ends.
- `src/stores/models/`: `Post` and `User` models, plus `postContent.js`, which parses `content_html` into media and styled paragraphs (matching iOS `SunlitPost`).
- `src/platform/`: `Icon` and `ContextMenu`.
- `src/navigation/`: a root native stack with bottom tabs inside it. Deep links are `sunlit://show?id=` and `sunlit://notification`. The IndieAuth callbacks (`sunlit://auth/callback`, `sunlit://micropub`) are kept away from the navigator.
- `plugins/`: local Expo config plugins (release signing from env, `allowBackup` kept false when libraries such as the compressor ask for true, and the camera marked optional so Play still offers Sunlit to devices without one). Always run `bunx expo prebuild --platform android --no-install` without `--clean`, and check `git diff android` afterwards.

## Android gotchas

- **Rounded views (RN 0.86).** On Android, never toggle a rounded view's background to `'transparent'`. Fabric flattens it and then loses `borderRadius` when it un-flattens (facebook/react-native#52415). Use an opaque colour such as `theme.colors.canvas` for the idle state.
- **Predictive back.** It stays off: with `enableOnBackInvokedCallback="true"`, back presses skip React Navigation and send the app to the background.
- **Images.** Grids and thumbnails load through the Micro.blog resizer (`resized_image_url`). Carousels and the viewer use originals.
- **Context menus.** On Android, `ContextMenu` wraps its children in a `collapsable={false}` view. Without it, Fabric flattens layout-only children into the `PopupMenuAndroid` container, and absolutely positioned overlays end up at its origin.
- **Metro.** Never start it with `CI=1` while testing on a device. CI mode turns off file watching, so the device keeps running a stale bundle.
- **OpenStreetMap.** Every Photon and tile request sends `USER_AGENT`, and any screen that shows OSM data shows `OsmAttribution`. Don't add search-as-you-type against Nominatim, because its policy forbids it. Photon allows it.
- **Check-in privacy.** The check-in delay deliberately survives sign-out, because it is a device preference and keeping it is the safer default. A check-in list belongs to the blog it was loaded from (`Places.loaded_uid`), and deletes go to that blog.
- **OSM tile volume.** Lists showing `MapThumbnail` keep a small `windowSize`. The tile policy forbids fetching tiles nobody is looking at.
- **Emulator location.** Send `adb emu geo fix <lon> <lat>` a few times while the app is waiting for a fix.
- **Share intents.** `expo-share-intent` is patched (`patches/`) so a file it can't read reports an error instead of crashing the app. Keep the patch when upgrading, or check the upstream fix.
- **iOS builds and push.** The expo-notifications plugin adds the `aps-environment` entitlement on iOS, so an iOS device build needs a provisioning profile with push enabled, even though Sunlit for Android never registers on iOS.
- **Push app name.** Always register as `Sunlit for Android`. The server sends `Sunlit` over APNs (that is the iOS app), and only knows to use Firebase for `Sunlit for Android`.
- **User agent.** Some hosts (wordpress.org among them) drop connections that carry OkHttp's default user agent. Send `USER_AGENT` on every request, using `fetch_external` for servers that aren't Micro.blog.
- **Post media.** It is frozen plain data. Do not turn it into nested models, because re-fetching a post would leave components holding dead nodes.

## Commands

- `bun install`
- `bun test`
- `bun run android` builds and runs a debug build (needs a device or emulator). Add `-PreactNativeArchitectures=arm64-v8a` to a Gradle build for a smaller emulator APK.

## Code style

@specs/STYLE.md

No code comments unless a constraint can't be expressed in code. Commit messages end with a full stop.
