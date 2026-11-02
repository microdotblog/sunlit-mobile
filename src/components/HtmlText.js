import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { use_theme } from '../theme/theme';

export default function HtmlText({ paragraphs = [], on_link, number_of_lines, style }) {
  const theme = use_theme();
  const text_style = [styles.text, { color: theme.colors.ink }, style];

  if (number_of_lines) {
    const flattened = paragraphs.flatMap((spans, index) => {
      if (index === 0) {
        return spans;
      } else {
        return [{ text: ' ' }, ...spans];
      }
    });

    return (
      <Text numberOfLines={number_of_lines} style={text_style}>
        {render_spans(flattened, theme, on_link)}
      </Text>
    );
  }

  return (
    <View style={styles.paragraphs}>
      {paragraphs.map((spans, index) => (
        <Text key={index} selectable style={text_style}>
          {render_spans(spans, theme, on_link)}
        </Text>
      ))}
    </View>
  );
}

function render_spans(spans, theme, on_link) {
  return spans.map((span, index) => {
    const span_style = [
      span.bold ? styles.bold : null,
      span.italic ? styles.italic : null,
      span.href ? { color: theme.colors.accent } : null,
    ];

    if (span.href && on_link) {
      return (
        <Text key={index} onPress={() => on_link(span.href)} style={span_style}>
          {span.text}
        </Text>
      );
    }

    return (
      <Text key={index} style={span_style}>
        {span.text}
      </Text>
    );
  });
}

const styles = StyleSheet.create({
  paragraphs: {
    gap: 10,
  },
  text: {
    fontSize: 16,
    lineHeight: 23,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
});
