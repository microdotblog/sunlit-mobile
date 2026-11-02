import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 1000;

export default function ZoomablePage({ media, width, height, on_tap, on_dismiss, on_zoom_change }) {
  const [is_zoomed, set_is_zoomed] = React.useState(false);
  const scale = useSharedValue(1);
  const saved_scale = useSharedValue(1);
  const translate_x = useSharedValue(0);
  const translate_y = useSharedValue(0);
  const saved_translate_x = useSharedValue(0);
  const saved_translate_y = useSharedValue(0);
  const dismiss_y = useSharedValue(0);

  function update_zoom(next_is_zoomed) {
    set_is_zoomed(next_is_zoomed);
    on_zoom_change(next_is_zoomed);
  }

  const pinch = Gesture.Pinch()
    .onUpdate(event => {
      scale.value = Math.min(Math.max(saved_scale.value * event.scale, 1), MAX_SCALE);
    })
    .onEnd(() => {
      if (scale.value <= 1.01) {
        scale.value = withTiming(1);
        translate_x.value = withTiming(0);
        translate_y.value = withTiming(0);
        saved_scale.value = 1;
        saved_translate_x.value = 0;
        saved_translate_y.value = 0;
        scheduleOnRN(update_zoom, false);
      } else {
        saved_scale.value = scale.value;
        scheduleOnRN(update_zoom, true);
      }
    });

  const zoomed_pan = Gesture.Pan()
    .enabled(is_zoomed)
    .onUpdate(event => {
      translate_x.value = saved_translate_x.value + event.translationX;
      translate_y.value = saved_translate_y.value + event.translationY;
    })
    .onEnd(() => {
      saved_translate_x.value = translate_x.value;
      saved_translate_y.value = translate_y.value;
    });

  const dismiss_pan = Gesture.Pan()
    .enabled(!is_zoomed)
    .activeOffsetY([-12, 12])
    .failOffsetX([-12, 12])
    .onUpdate(event => {
      dismiss_y.value = event.translationY;
    })
    .onEnd(event => {
      const should_dismiss =
        Math.abs(event.translationY) > DISMISS_DISTANCE || Math.abs(event.velocityY) > DISMISS_VELOCITY;

      if (should_dismiss) {
        scheduleOnRN(on_dismiss);
      } else {
        dismiss_y.value = withSpring(0);
      }
    });

  const double_tap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        translate_x.value = withTiming(0);
        translate_y.value = withTiming(0);
        saved_scale.value = 1;
        saved_translate_x.value = 0;
        saved_translate_y.value = 0;
        scheduleOnRN(update_zoom, false);
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        saved_scale.value = DOUBLE_TAP_SCALE;
        scheduleOnRN(update_zoom, true);
      }
    });

  const single_tap = Gesture.Tap().onEnd(() => {
    scheduleOnRN(on_tap);
  });

  const gesture = Gesture.Simultaneous(
    pinch,
    is_zoomed ? zoomed_pan : dismiss_pan,
    Gesture.Exclusive(double_tap, single_tap),
  );

  const image_style = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.abs(dismiss_y.value) / (DISMISS_DISTANCE * 4), 0.5),
    transform: [
      { translateX: translate_x.value },
      { translateY: translate_y.value + dismiss_y.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.page, { height, width }]}>
        <Animated.View style={[StyleSheet.absoluteFill, image_style]}>
          <Image
            accessibilityLabel={media.alt || undefined}
            cachePolicy="memory-disk"
            contentFit="contain"
            source={{ uri: media.url }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  page: {
    overflow: 'hidden',
  },
});
