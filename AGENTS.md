# Sunlit for Android

Sunlit is a photo-blogging app for Micro.blog: you share photos to your blog and discover photography from the community. This repo is the Android app, built with Expo and React Native. The native iOS app lives in `../sunlit`.

Android is the target, but the code stays buildable on iOS: platform differences live in `src/platform/` and nowhere else.

## Product concepts

Timeline (photos and videos from people you follow), Discover, Mentions, profiles, conversations and replies, the image viewer, bookmarks, and following. Later milestones add the composer, Places check-ins, a share target, a widget, push, and external blogs. `TODO.md` tracks milestones and open questions.

## Expo

For Expo documentation and how-tos, see https://docs.expo.dev/llms.txt.

## Reference projects

- `../sunlit` (Swift) is the source of truth for product behaviour, flows, and look. Its colours live in `Sunlit/Resources/Assets.xcassets`.
- `../inkwell-react` is the model for structure: MST stores, auth, the fetch wrapper, Android menus, and CI.
- `../microblog-react` is the reference for Micropub posting, media upload, and blog destinations. It is bare React Native with axios, so adapt it rather than copying it.
- iOS networking goes through the Snippets Swift package (github.com/microdotblog/snippets). Check endpoint paths and parameters there.

## Architecture

- `src/api/` handles transport only. `request.js` is the shared `request_json` wrapper (Bearer token, form bodies, errors with `.status` and `.response_text`).
- `src/stores/` holds the MST singletons. Stores with real dependencies are built by `create_*_store` factories, so tests can inject doubles.
  - `Posts` keeps one map of posts plus keyed lists: `timeline`, `discover`, `mentions`, `photos:<username>`, `conversation:<id>`. A change to a post, such as a bookmark, therefore shows up in every list.
  - `Users` holds profiles, follow state, following lists, and search.
  - `Session` resets every store when a 401 or 403 arrives through `sessionEvents`.
  - `Composer` (`create_composer_store`) holds the sections and media and does upload-then-post, with at most 4 uploads at once and a generation counter so a cancelled post can't finish later. The payloads come from `models/composition.js`. One section is a Micropub form (`photo[]`, `mp-photo-alt[]`), several sections are a JSON h-entry with iOS `HTMLBuilder` markup. `mediaPreparation.js` resizes images (shorter side 1800 px, JPEG 0.7) and transcodes video (640 px, 3 Mbps).
  - `Destinations` reads `micropub?q=config` and remembers the chosen blog (and a separate check-in blog), falling back to `microblog-default`. `Uploads` reads `micropub/media?q=source`.
  - `Places` holds check-in history (`micropub?q=source`, paged up to 500), posts check-ins (a JSON h-entry with a `checkin` h-card, the same as iOS), deletes them, and stores the publish delay. `PlaceSearch` finds nearby places and searches them through Photon (`api/OpenStreetMap.js`). `currentLocation.js` asks for a high-accuracy fix, because balanced accuracy has no GPS fallback.
- `src/stores/models/`: `Post` and `User` models, plus `postContent.js`, which parses `content_html` into media and styled paragraphs (matching iOS `SunlitPost`).
- `src/platform/`: `Icon` and `ContextMenu`.
- `src/navigation/`: a root native stack with bottom tabs inside it. Deep links are `sunlit://show?id=` and `sunlit://notification`.
- `plugins/`: local Expo config plugins (release signing from env, and `allowBackup` kept false when libraries such as the compressor ask for true). Always run `bunx expo prebuild --platform android --no-install` without `--clean`, and check `git diff android` afterwards.

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
- **Post media.** It is frozen plain data. Do not turn it into nested models, because re-fetching a post would leave components holding dead nodes.

## Commands

- `bun install`
- `bun test`
- `bun run android` builds and runs a debug build (needs a device or emulator). Add `-PreactNativeArchitectures=arm64-v8a` to a Gradle build for a smaller emulator APK.

## Code style

@specs/STYLE.md

No code comments unless a constraint can't be expressed in code. Commit messages end with a full stop.
