import React, { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, MapPin, Trash2 } from 'lucide-react-native';
import { ComplexItem, fetchAllComplexes } from '../api';
import { useFavorites } from '../context/FavoritesContext';
import { theme } from '../theme';
import {
  formatPricePerSqm,
  getScoreLabel,
  getScorePalette,
  getStageLabel,
  getStagePalette,
} from '../utils/realEstate';

export default function FavoritesScreen({ navigation }: any) {
  const { favorites, toggleFavorite } = useFavorites();
  const [complexes, setComplexes] = useState<ComplexItem[]>([]);

  useEffect(() => {
    fetchAllComplexes().then((all) => setComplexes(all.filter((c) => favorites.includes(c.id))));
  }, [favorites]);

  const openDetails = (id: string) =>
    navigation.navigate('HomeTab', { screen: 'ComplexDetail', params: { id } });

  if (complexes.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Избранное</Text>
        </View>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Heart size={32} color={theme.colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Пока пусто</Text>
          <Text style={styles.emptyText}>
            Нажмите на сердечко в карточке ЖК, чтобы сохранить его сюда.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Избранное</Text>
          <Text style={styles.subtitle}>{complexes.length} объект{complexes.length !== 1 ? 'ов' : ''}</Text>
        </View>

        {complexes.map((complex) => {
          const stagePalette = getStagePalette(complex.construction_stage);
          const investorPalette = getScorePalette(complex.investor_score);

          return (
            <TouchableOpacity
              key={complex.id}
              style={styles.card}
              activeOpacity={0.9}
              onPress={() => openDetails(complex.id)}
            >
              <Image source={{ uri: complex.image }} style={styles.image} />

              <View style={styles.topRow}>
                <View style={[styles.stageBadge, { backgroundColor: stagePalette.bg }]}>
                  <Text style={[styles.stageBadgeText, { color: stagePalette.text }]}>
                    {getStageLabel(complex.construction_stage)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => toggleFavorite(complex.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={16} color={theme.colors.red} />
                </TouchableOpacity>
              </View>

              <View style={styles.body}>
                <View style={styles.bodyHeader}>
                  <Text style={styles.name}>{complex.name}</Text>
                  <Text style={styles.price}>{formatPricePerSqm(complex.price_avg)}</Text>
                </View>

                <View style={styles.locationRow}>
                  <MapPin size={13} color={theme.colors.textMuted} />
                  <Text style={styles.address}>{complex.address}</Text>
                </View>

                <View style={styles.footer}>
                  <View style={styles.developerTag}>
                    <Text style={styles.developerText}>{complex.developer}</Text>
                  </View>
                  <View style={[styles.scoreTag, { backgroundColor: investorPalette.bg }]}>
                    <Text style={[styles.scoreTagText, { color: investorPalette.text }]}>
                      Инвестор • {getScoreLabel(complex.investor_score)}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  image: {
    width: '100%',
    height: 190,
  },
  topRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  stageBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: 16,
  },
  bodyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  name: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  address: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  developerTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceMuted,
  },
  developerText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  scoreTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  scoreTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
