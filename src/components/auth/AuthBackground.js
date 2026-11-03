import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

const LIGHT_LAYERS = {
  base: ['#FFFDE8', '#FFF7D6', '#FFEFC2'],
  tint: ['rgba(255, 255, 255, 0.05)', 'rgba(255, 200, 0, 0.14)', 'rgba(255, 138, 0, 0.16)'],
  glow: ['rgba(255, 253, 232, 0.6)', 'rgba(255, 200, 0, 0.12)', 'rgba(255, 253, 232, 0)'],
  edge: ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 138, 0, 0.1)'],
};

const DARK_LAYERS = {
  base: ['#14110A', '#1B160C', '#24190D'],
  tint: ['rgba(20, 17, 10, 0.05)', 'rgba(255, 170, 0, 0.1)', 'rgba(255, 120, 0, 0.14)'],
  glow: ['rgba(255, 170, 0, 0.08)', 'rgba(255, 200, 0, 0.05)', 'rgba(0, 0, 0, 0)'],
  edge: ['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)', 'rgba(255, 120, 0, 0.1)'],
};

export default function AuthBackground({ theme }) {
  const glow_shift = useSharedValue(0);
  const layers = theme.is_dark ? DARK_LAYERS : LIGHT_LAYERS;

  React.useEffect(() => {
    glow_shift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 16000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [glow_shift]);

  const tint_style = useAnimatedStyle(() => {
    return {
      opacity: 0.84 - glow_shift.value * 0.08,
      transform: [
        { translateX: -10 + glow_shift.value * 20 },
        { translateY: -12 + glow_shift.value * 18 },
        { scale: 1.02 + glow_shift.value * 0.03 },
      ],
    };
  }, []);

  const glow_style = useAnimatedStyle(() => {
    return {
      opacity: 0.66 + glow_shift.value * 0.14,
      transform: [
        { translateX: 12 - glow_shift.value * 28 },
        { translateY: -18 + glow_shift.value * 30 },
        { scale: 1.04 + glow_shift.value * 0.05 },
      ],
    };
  }, []);

  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={[styles.layer, { experimental_backgroundImage: linear_gradient(180, layers.base) }]} />
      <Animated.View style={[styles.layer, { experimental_backgroundImage: linear_gradient(170, layers.tint) }, tint_style]} />
      <Animated.View style={[styles.layer, { experimental_backgroundImage: linear_gradient(180, layers.glow) }, glow_style]} />
      <View style={[styles.layer, { experimental_backgroundImage: linear_gradient(180, layers.edge) }]} />
    </View>
  );
}

function linear_gradient(angle, colors) {
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  layer: {
    ...StyleSheet.absoluteFill,
  },
});
