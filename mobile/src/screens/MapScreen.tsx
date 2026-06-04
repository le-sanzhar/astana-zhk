import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GraduationCap, TrendingUp, Users } from 'lucide-react-native';
import { BuyerProfile, ComplexItem, fetchAllComplexes } from '../api';
import { theme } from '../theme';
import { formatPricePerSqm, getScorePalette, getStageLabel } from '../utils/realEstate';

const ASTANA_REGION = {
  latitude: 51.118,
  longitude: 71.44,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const profiles: { id: BuyerProfile; label: string; Icon: any }[] = [
  { id: 'investor', label: 'Инвестор', Icon: TrendingUp },
  { id: 'family', label: 'Семья', Icon: Users },
  { id: 'student', label: 'Студент', Icon: GraduationCap },
];

export default function MapScreen({ navigation }: any) {
  const [selectedProfile, setSelectedProfile] = useState<BuyerProfile>('investor');
  const [complexes, setComplexes] = useState<ComplexItem[]>([]);

  useEffect(() => {
    fetchAllComplexes().then(setComplexes);
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={ASTANA_REGION}
        showsUserLocation={false}
        showsCompass={false}
        showsScale={false}
      >
        {complexes.map((complex) => {
          const score = complex[`${selectedProfile}_score` as const];
          const palette = getScorePalette(score);

          return (
            <Marker
              key={complex.id}
              coordinate={{ latitude: complex.coordinates.lat, longitude: complex.coordinates.lng }}
              onCalloutPress={() => navigation.navigate('HomeTab', {
                screen: 'ComplexDetail',
                params: { id: complex.id },
              })}
            >
              <View style={[styles.pin, { backgroundColor: palette.bg, borderColor: palette.text }]}>
                <View style={[styles.pinDot, { backgroundColor: palette.text }]} />
              </View>

              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>{complex.name}</Text>
                  <Text style={styles.calloutDev}>{complex.developer}</Text>
                  <View style={styles.calloutRow}>
                    <Text style={styles.calloutPrice}>{formatPricePerSqm(complex.price_avg)}</Text>
                    <Text style={[styles.calloutStage, { color: palette.text }]}>
                      {getStageLabel(complex.construction_stage)}
                    </Text>
                  </View>
                  <Text style={styles.calloutHint}>Открыть →</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.header}>
          <Text style={styles.title}>Карта ЖК</Text>
          <Text style={styles.subtitle}>Астана • {complexes.length} объектов</Text>
        </View>

        <View style={styles.profileBar}>
          {profiles.map(({ id, label, Icon }) => {
            const active = selectedProfile === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.profileChip, active && styles.profileChipActive]}
                onPress={() => setSelectedProfile(id)}
              >
                <Icon size={14} color={active ? '#fff' : theme.colors.textSecondary} />
                <Text style={[styles.profileChipText, active && styles.profileChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      <View style={styles.legend}>
        {[
          { label: 'Сильный', color: theme.colors.green, bg: theme.colors.greenBg },
          { label: 'Средний', color: theme.colors.yellow, bg: theme.colors.yellowBg },
          { label: 'Слабый', color: theme.colors.red, bg: theme.colors.redBg },
        ].map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  profileBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 10,
    gap: 8,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  profileChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  profileChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  profileChipTextActive: {
    color: '#fff',
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  callout: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
  },
  calloutName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  calloutDev: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  calloutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  calloutPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  calloutStage: {
    fontSize: 12,
    fontWeight: '700',
  },
  calloutHint: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  legend: {
    position: 'absolute',
    bottom: 110,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
