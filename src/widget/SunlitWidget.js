import React from 'react';
import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';

import { resized_image_url } from '../components/imageUrls';
import { conversation_uri, list_row_count, widget_layout } from './widgetModel';

const PALETTES = {
  light: { canvas: '#FFFFFF', ink: '#000000', ink_soft: '#6C6C70', accent: '#0099FF', pane: '#F2F2F2' },
  dark: { canvas: '#1C1C1C', ink: '#FFFFFF', ink_soft: '#98989F', accent: '#7ECBFF', pane: '#262626' },
};
const CORNER_RADIUS = 20;
const IMAGE_SCALE = 3;

export function build_widget_representation({ width, height, items, title, message }) {
  return {
    light: <SunlitWidget colors={PALETTES.light} height={height} items={items} message={message} title={title} width={width} />,
    dark: <SunlitWidget colors={PALETTES.dark} height={height} items={items} message={message} title={title} width={width} />,
  };
}

function SunlitWidget({ width, height, items = [], title = '', message = null, colors }) {
  if (message || items.length === 0) {
    return <MessageWidget colors={colors} message={message || 'No photos yet.'} />;
  }

  const layout = widget_layout(width, height);

  if (layout === 'list') {
    return <ListLayout colors={colors} items={items.slice(0, list_row_count(height))} title={title} width={width} />;
  } else if (layout === 'feature') {
    return <FeatureLayout colors={colors} height={height} item={items[0]} width={width} />;
  } else {
    return <SingleLayout height={height} item={items[0]} width={width} />;
  }
}

function SingleLayout({ item, width, height }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: conversation_uri(item) }}
      style={{ borderRadius: CORNER_RADIUS, height: 'match_parent', width: 'match_parent' }}
    >
      <ImageWidget
        image={resized_image_url(item.image_url, Math.max(width, height) * IMAGE_SCALE)}
        imageHeight={height}
        imageWidth={width}
        radius={CORNER_RADIUS}
        resizeMode="cover"
      />
    </FlexWidget>
  );
}

function FeatureLayout({ item, width, height, colors }) {
  const image_size = Math.max(height - 24, 48);

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: conversation_uri(item) }}
      style={{
        alignItems: 'center',
        backgroundColor: colors.canvas,
        borderRadius: CORNER_RADIUS,
        flexDirection: 'row',
        height: 'match_parent',
        padding: 12,
        width: 'match_parent',
      }}
    >
      <ImageWidget
        image={resized_image_url(item.image_url, image_size * IMAGE_SCALE)}
        imageHeight={image_size}
        imageWidth={image_size}
        radius={14}
        resizeMode="cover"
      />
      <FlexWidget style={{ flex: 1, height: 'match_parent', justifyContent: 'center', paddingLeft: 12, width: width - image_size - 36 }}>
        <TextWidget maxLines={1} style={{ color: colors.ink, fontSize: 15, fontWeight: 'bold' }} text={item.name} truncate="END" />
        <TextWidget maxLines={1} style={{ color: colors.ink_soft, fontSize: 13 }} text={`@${item.username}`} truncate="END" />
        {item.text ? (
          <TextWidget maxLines={3} style={{ color: colors.ink, fontSize: 14, marginTop: 6 }} text={item.text} truncate="END" />
        ) : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function ListLayout({ items, title, width, colors }) {
  const thumbnail_size = 48;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        backgroundColor: colors.canvas,
        borderRadius: CORNER_RADIUS,
        height: 'match_parent',
        padding: 14,
        width: 'match_parent',
      }}
    >
      <TextWidget style={{ color: colors.accent, fontSize: 15, fontWeight: 'bold', marginBottom: 8 }} text={title} />
      {items.map(item => (
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: conversation_uri(item) }}
          key={item.id}
          style={{ alignItems: 'center', flexDirection: 'row', paddingVertical: 5, width: 'match_parent' }}
        >
          <ImageWidget
            image={resized_image_url(item.image_url, thumbnail_size * IMAGE_SCALE)}
            imageHeight={thumbnail_size}
            imageWidth={thumbnail_size}
            radius={10}
            resizeMode="cover"
          />
          <FlexWidget style={{ paddingLeft: 10, width: width - thumbnail_size - 48 }}>
            <TextWidget maxLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: 'bold' }} text={item.name} truncate="END" />
            <TextWidget maxLines={2} style={{ color: colors.ink_soft, fontSize: 13 }} text={item.text || `@${item.username}`} truncate="END" />
          </FlexWidget>
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

function MessageWidget({ message, colors }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        alignItems: 'center',
        backgroundColor: colors.canvas,
        borderRadius: CORNER_RADIUS,
        height: 'match_parent',
        justifyContent: 'center',
        padding: 16,
        width: 'match_parent',
      }}
    >
      <TextWidget style={{ color: colors.accent, fontSize: 15, fontWeight: 'bold', marginBottom: 4 }} text="Sunlit" />
      <TextWidget maxLines={3} style={{ color: colors.ink_soft, fontSize: 13, textAlign: 'center' }} text={message} truncate="END" />
    </FlexWidget>
  );
}
