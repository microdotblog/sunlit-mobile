import React from 'react';
import { Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SFSymbol } from 'react-native-sfsymbols';

const ICONS = {
  timeline: { android: 'photo-library', ios: 'bubble.left.and.bubble.right' },
  mentions: { android: 'alternate-email', ios: 'at' },
  discover: { android: 'explore', ios: 'magnifyingglass' },
  places: { android: 'place', ios: 'mappin.and.ellipse' },
  grid: { android: 'grid-view', ios: 'square.grid.2x2' },
  list: { android: 'view-agenda', ios: 'rectangle.grid.1x2' },
  search: { android: 'search', ios: 'magnifyingglass' },
  close: { android: 'close', ios: 'xmark' },
  back: { android: 'arrow-back', ios: 'chevron.left' },
  settings: { android: 'settings', ios: 'gear' },
  bookmark: { android: 'bookmark', ios: 'bookmark.fill' },
  bookmark_outline: { android: 'bookmark-border', ios: 'bookmark' },
  share: { android: 'share', ios: 'square.and.arrow.up' },
  open_in_browser: { android: 'open-in-browser', ios: 'safari' },
  conversation: { android: 'chat-bubble-outline', ios: 'bubble.left' },
  reply: { android: 'reply', ios: 'arrowshape.turn.up.left' },
  send: { android: 'send', ios: 'paperplane.fill' },
  play: { android: 'play-circle-filled', ios: 'play.circle.fill' },
  person: { android: 'person', ios: 'person.crop.circle' },
  people: { android: 'people-outline', ios: 'person.2' },
  link: { android: 'link', ios: 'link' },
  more: { android: 'more-vert', ios: 'ellipsis' },
  check: { android: 'check', ios: 'checkmark' },
  compose: { android: 'add-a-photo', ios: 'square.and.pencil' },
  add_photo: { android: 'add-photo-alternate', ios: 'photo.badge.plus' },
  crop: { android: 'crop', ios: 'crop' },
  delete: { android: 'delete-outline', ios: 'trash' },
  description: { android: 'notes', ios: 'text.bubble' },
  expand: { android: 'expand-more', ios: 'chevron.down' },
  video: { android: 'videocam', ios: 'video.fill' },
  uploads: { android: 'cloud-upload', ios: 'icloud.and.arrow.up' },
  add_location: { android: 'add-location-alt', ios: 'mappin.and.ellipse' },
  my_location: { android: 'my-location', ios: 'location' },
  schedule: { android: 'schedule', ios: 'clock' },
};

export default function Icon({ name, size = 24, color }) {
  const icon = ICONS[name];

  if (!icon) {
    throw new Error(`Unknown icon: ${name}`);
  }

  if (Platform.OS === 'ios') {
    return (
      <SFSymbol
        color={color}
        name={icon.ios}
        resizeMode="center"
        style={{ height: size, width: size }}
      />
    );
  }

  return <MaterialIcons color={color} name={icon.android} size={size} />;
}
