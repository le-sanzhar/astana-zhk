import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building2, Check, GitCompareArrows, MoveRight } from 'lucide-react-native';
import { ComplexItem, fetchCompare, fetchComplexes } from '../api';
import { theme } from '../theme';
import {
  formatPricePerSqm,
  getScorePalette,
  getStageLabel,
  profileMeta,
} from '../utils/realEstate';

export default function CompareScreen() {
  const [allComplexes, setAllComplexes] = useState<ComplexItem[]>([]);
  const [selected1, setSelected1] = useState('');
  const [selected2, setSelected2] = useState('');
  const [compareData, setCompareData] = useState<ComplexItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSelector, setActiveSelector] = useState<'first' | 'second'>('first');

  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    const data = await fetchComplexes({ limit: 100 });
    setAllComplexes(data.items);
  };

  useEffect(() => {
    if (selected1 && selected2 && selected1 !== selected2) {
      loadComparison();
    }
  }, [selected1, selected2]);

  const loadComparison = async () => {
    setLoading(true);
    try {
      const data = await fetchCompare([selected1, selected2]);
      setCompareData(data.complexes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const firstComplex = useMemo(
    () => allComplexes.find((complex) => complex.id === selected1) ?? null,
    [allComplexes, selected1],
  );
  const secondComplex = useMemo(
    () => allComplexes.find((complex) => complex.id === selected2) ?? null,
    [allComplexes, selected2],
  );

  const selectComplex = (complexId: string) => {
    if (activeSelector === 'first') {
      setSelected1(complexId);
      if (complexId === selected2) {
        setSelected2('');
      }
      setActiveSelector('second');
      return;
    }

    setSelected2(complexId);
    if (complexId === selected1) {
      setSelected1('');
    }
    setActiveSelector('first');
  };

  const renderSelectorCard = (
    label: string,
    complex: ComplexItem | null,
    selectedKey: 'first' | 'second',
  ) => {
    const active = activeSelector === selectedKey;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.selectorCard, active && styles.selectorCardActive]}
        onPress={() => setActiveSelector(selectedKey)}
      >
        {complex ? (
          <>
            <Image source={{ uri: complex.image }} style={styles.selectorImage} />
            <View style={styles.selectorOverlay} />
            <View style={styles.selectorContent}>
              <Text style={styles.selectorLabel}>{label}</Text>
              <Text style={styles.selectorTitle}>{complex.name}</Text>
              <Text style={styles.selectorMeta}>{complex.district} • {formatPricePerSqm(complex.price_avg)}</Text>
            </View>
          </>
        ) : (
          <View style={styles.selectorPlaceholder}>
            <Building2 size={24} color={theme.colors.primary} />
            <Text style={styles.selectorLabel}>{label}</Text>
            <Text style={styles.selectorPlaceholderText}>Выберите ЖК из списка ниже</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const comparisonReady = compareData.length === 2;
  const priceDiff = comparisonReady
    ? Math.abs(compareData[0].price_avg - compareData[1].price_avg)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Сравнение</Text>
          <Text style={styles.subtitle}>
            Выберите два комплекса и быстро посмотрите, кто выигрывает по цене, готовности и профилям.
          </Text>
        </View>

        <View style={styles.selectorRow}>
          {renderSelectorCard('ЖК 1', firstComplex, 'first')}
          {renderSelectorCard('ЖК 2', secondComplex, 'second')}
        </View>

        <View style={styles.pickerHeader}>
          <View>
            <Text style={styles.sectionTitle}>Список ЖК</Text>
            <Text style={styles.sectionSubtitle}>
              Сейчас заполняете: {activeSelector === 'first' ? 'первую карточку' : 'вторую карточку'}
            </Text>
          </View>
          <View style={styles.selectorPill}>
            <GitCompareArrows size={14} color={theme.colors.primary} />
            <Text style={styles.selectorPillText}>Нажмите выбрать</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.candidateRail}>
          {allComplexes.map((complex) => {
            const chosen = complex.id === selected1 || complex.id === selected2;

            return (
              <TouchableOpacity
                key={complex.id}
                style={[styles.candidateCard, chosen && styles.candidateCardActive]}
                activeOpacity={0.92}
                onPress={() => selectComplex(complex.id)}
              >
                <Image source={{ uri: complex.image }} style={styles.candidateImage} />
                {chosen && (
                  <View style={styles.candidateCheck}>
                    <Check size={14} color="#fff" />
                  </View>
                )}
                <Text style={styles.candidateTitle}>{complex.name}</Text>
                <Text style={styles.candidateMeta}>{complex.district}</Text>
                <Text style={styles.candidatePrice}>{formatPricePerSqm(complex.price_avg)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : comparisonReady ? (
          <>
            <View style={styles.summaryHero}>
              <Text style={styles.summaryHeroLabel}>Итог сравнения</Text>
              <Text style={styles.summaryHeroTitle}>
                Разница по цене: {formatPricePerSqm(priceDiff)}
              </Text>
              <View style={styles.summaryHeroRow}>
                <Text style={styles.summaryHeroText}>{compareData[0].name}</Text>
                <MoveRight size={16} color={theme.colors.textMuted} />
                <Text style={styles.summaryHeroText}>{compareData[1].name}</Text>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Цена / м²</Text>
                <Text style={styles.metricPrimary}>{formatPricePerSqm(compareData[0].price_avg)}</Text>
                <Text style={styles.metricSecondary}>{formatPricePerSqm(compareData[1].price_avg)}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Стадия</Text>
                <Text style={styles.metricPrimary}>{getStageLabel(compareData[0].construction_stage)}</Text>
                <Text style={styles.metricSecondary}>{getStageLabel(compareData[1].construction_stage)}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Площадь</Text>
                <Text style={styles.metricPrimary}>{compareData[0].area_sqm} м²</Text>
                <Text style={styles.metricSecondary}>{compareData[1].area_sqm} м²</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Заезд</Text>
                <Text style={styles.metricPrimary}>{compareData[0].move_in}</Text>
                <Text style={styles.metricSecondary}>{compareData[1].move_in}</Text>
              </View>
            </View>

            <View style={styles.scoreBoard}>
              <Text style={styles.sectionTitle}>Оценка по профилям</Text>
              {(['investor', 'family', 'student'] as const).map((profile) => {
                const leftScore = compareData[0].scores.find((score) => score.profile === profile);
                const rightScore = compareData[1].scores.find((score) => score.profile === profile);

                if (!leftScore || !rightScore) {
                  return null;
                }

                const leftPalette = getScorePalette(leftScore.score);
                const rightPalette = getScorePalette(rightScore.score);

                return (
                  <View key={profile} style={styles.scoreRow}>
                    <Text style={styles.scoreRowLabel}>{profileMeta[profile].label}</Text>
                    <View style={[styles.scoreCell, { backgroundColor: leftPalette.bg }]}>
                      <Text style={[styles.scoreCellValue, { color: leftPalette.text }]}>
                        {leftScore.score_value.toFixed(1)}
                      </Text>
                    </View>
                    <View style={[styles.scoreCell, { backgroundColor: rightPalette.bg }]}>
                      <Text style={[styles.scoreCellValue, { color: rightPalette.text }]}>
                        {rightScore.score_value.toFixed(1)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <GitCompareArrows size={42} color={theme.colors.primary} />
            <Text style={styles.emptyTitle}>Подготовьте пару для сравнения</Text>
            <Text style={styles.emptyText}>
              Выберите два разных ЖК, и экран ниже соберёт сводку без перегруза таблицами.
            </Text>
          </View>
        )}
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
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 22,
  },
  selectorCard: {
    flex: 1,
    height: 186,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  selectorCardActive: {
    borderColor: '#bfd4ff',
  },
  selectorImage: {
    width: '100%',
    height: '100%',
  },
  selectorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,20,44,0.22)',
  },
  selectorContent: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  selectorPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  selectorLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  selectorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  selectorMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 6,
  },
  selectorPlaceholderText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  selectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  selectorPillText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  candidateRail: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  candidateCard: {
    width: 166,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 10,
    marginRight: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  candidateCardActive: {
    borderColor: '#c5d8ff',
  },
  candidateImage: {
    width: '100%',
    height: 120,
    borderRadius: 18,
  },
  candidateCheck: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  candidateTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  candidateMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  candidatePrice: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  summaryHero: {
    marginHorizontal: 20,
    marginTop: 28,
    padding: 22,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
  },
  summaryHeroLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
  },
  summaryHeroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 10,
  },
  summaryHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  summaryHeroText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 18,
    gap: 12,
  },
  metricCard: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 18,
    ...theme.shadows.card,
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 12,
  },
  metricPrimary: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  metricSecondary: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 8,
  },
  scoreBoard: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    padding: 20,
    ...theme.shadows.card,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  scoreRowLabel: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  scoreCell: {
    minWidth: 74,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginLeft: 10,
  },
  scoreCellValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyState: {
    marginHorizontal: 20,
    marginTop: 30,
    padding: 28,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
  },
});
