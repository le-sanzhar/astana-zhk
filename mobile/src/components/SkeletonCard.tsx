import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

function ShimmerBox({ width, height, borderRadius = 12, style }: {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Animated.View style={[{ width, height, borderRadius, overflow: 'hidden', opacity }, style]}>
      <LinearGradient
        colors={[theme.colors.surfaceMuted, theme.colors.surfaceStrong, theme.colors.surfaceMuted]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

export function SkeletonFeaturedCard() {
  return (
    <View style={styles.featuredCard}>
      <ShimmerBox width={278} height={190} borderRadius={0} />
      <View style={styles.featuredBody}>
        <ShimmerBox width={80} height={14} borderRadius={8} />
        <ShimmerBox width={200} height={22} borderRadius={8} style={{ marginTop: 10 }} />
        <ShimmerBox width={140} height={14} borderRadius={8} style={{ marginTop: 8 }} />
        <ShimmerBox width={120} height={14} borderRadius={8} style={{ marginTop: 6 }} />
        <View style={styles.featuredFooterRow}>
          <ShimmerBox width={110} height={20} borderRadius={8} />
          <ShimmerBox width={70} height={14} borderRadius={8} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonNearbyCard() {
  return (
    <View style={styles.nearbyCard}>
      <ShimmerBox width="100%" height={180} borderRadius={0} />
      <View style={styles.nearbyBody}>
        <View style={styles.nearbyHeaderRow}>
          <ShimmerBox width={160} height={20} borderRadius={8} />
          <ShimmerBox width={80} height={18} borderRadius={8} />
        </View>
        <ShimmerBox width={120} height={14} borderRadius={8} style={{ marginTop: 10 }} />
        <ShimmerBox width="90%" height={14} borderRadius={8} style={{ marginTop: 8 }} />
        <ShimmerBox width="70%" height={14} borderRadius={8} style={{ marginTop: 4 }} />
        <View style={styles.nearbyFooterRow}>
          <ShimmerBox width={140} height={34} borderRadius={999} />
          <ShimmerBox width={80} height={14} borderRadius={8} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  featuredCard: {
    width: 278,
    marginRight: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    overflow: 'hidden',
  },
  featuredBody: {
    padding: 18,
    gap: 0,
  },
  featuredFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
  },
  nearbyCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
  },
  nearbyBody: {
    padding: 18,
  },
  nearbyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  nearbyFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
});
