import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BuyerProfile as BP, ComplexItem, ScoringInfo, fetchComplexDetail, fetchScoringInfo } from '../api';
import ScoringInfoModal from '../components/ScoringInfoModal';
import { theme } from '../theme';
import {
  ArrowLeft, Bath, BedDouble, Bus, CalendarDays, ExternalLink,
  Heart, Info, MapPin, Ruler, School, Share2, Sparkles, Star,
  Store, Train, Trees, TrendingUp,
} from 'lucide-react-native';
import {
  BuyerProfile,
  ScoreBreakdown,
  calcPriceGrowth,
  calcScoreBreakdown,
  formatCurrency,
  formatDistance,
  formatMonthly,
  formatPercent,
  formatPricePerSqm,
  getScoreLabel,
  getScorePalette,
  profileMeta,
} from '../utils/realEstate';
import { useFavorites } from '../context/FavoritesContext';
import MortgageCalculator from '../components/MortgageCalculator';
import FlipCalculator from '../components/FlipCalculator';

const screenWidth = Dimensions.get('window').width;

const infraIcons: Record<string, any> = {
  school: School, kindergarten: School, grocery: Store,
  metro: Train, park: Trees, bus_stop: Bus,
};

type Tab = 'overview' | 'scoring' | 'pricing' | 'mortgage' | 'flip' | 'around';

export default function ComplexDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [data, setData] = useState<ComplexItem | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [breakdowns, setBreakdowns] = useState<ScoreBreakdown[]>([]);
  const [scoringInfo, setScoringInfo] = useState<ScoringInfo | null>(null);
  const [infoModalProfile, setInfoModalProfile] = useState<BP | null>(null);

  useEffect(() => {
    fetchComplexDetail(id).then((detail) => {
      setData(detail);
      setBreakdowns([
        calcScoreBreakdown(detail, 'investor'),
        calcScoreBreakdown(detail, 'family'),
        calcScoreBreakdown(detail, 'student'),
        calcScoreBreakdown(detail, 'flipper'),
      ]);
    });
    fetchScoringInfo().then(setScoringInfo);
  }, [id]);

  if (!data) return null;

  const priceGrowth      = calcPriceGrowth(data.price_snapshots);
  const latestSnapshot   = data.price_snapshots[data.price_snapshots.length - 1];
  const strongestScore   = [...data.scores].sort((a, b) => b.score_value - a.score_value)[0];
  const favorited        = isFavorite(data.id);

  const chartData = {
    labels: data.price_snapshots.slice(-6).map((s) =>
      new Date(s.recorded_at).toLocaleDateString('ru', { month: 'short' }),
    ),
    datasets: [{ data: data.price_snapshots.slice(-6).map((s) => s.price_avg / 1000) }],
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'О проекте' },
    { key: 'scoring',  label: 'Скоринг' },
    { key: 'pricing',  label: 'Цены' },
    { key: 'mortgage', label: 'Ипотека' },
    { key: 'flip',     label: 'Флиппер' },
    { key: 'around',   label: 'Рядом' },
  ];

  // ── Tabs content ────────────────────────────────────────────────────────────

  const renderOverview = () => (
    <View>
      <View style={styles.descriptionCard}>
        <Text style={styles.sectionHeadline}>Описание</Text>
        <Text style={styles.descriptionText}>{data.description}</Text>
      </View>

      <View style={styles.aiCard}>
        <View style={styles.sectionRow}>
          <Sparkles size={18} color={theme.colors.primary} />
          <Text style={styles.sectionHeadline}>AI-анализ</Text>
        </View>
        <Text style={styles.aiText}>{data.ai_summary}</Text>
      </View>

      <View style={styles.scoreRail}>
        {data.scores.map((score) => {
          const palette = getScorePalette(score.score);
          return (
            <View key={score.profile} style={[styles.scoreMiniCard, { backgroundColor: palette.bg }]}>
              <Text style={[styles.scoreMiniProfile, { color: palette.text }]}>
                {profileMeta[score.profile].label}
              </Text>
              <Text style={styles.scoreMiniValue}>{score.score_value.toFixed(1)}</Text>
              <Text style={styles.scoreMiniCaption}>{getScoreLabel(score.score)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.agentCard}>
        <Image source={{ uri: data.agent.avatar }} style={styles.agentAvatar} />
        <View style={styles.agentContent}>
          <Text style={styles.agentCaption}>Агент продаж</Text>
          <Text style={styles.agentName}>{data.agent.name}</Text>
          <Text style={styles.agentRole}>{data.agent.role}</Text>
        </View>
        <TouchableOpacity style={styles.agentAction}>
          <Text style={styles.agentActionText}>Связаться</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderScoring = () => (
    <View>
      {breakdowns.map((bd) => {
        const palette = getScorePalette(bd.tone);
        const barWidth = (bd.totalScore / 100) * (screenWidth - 40 - 32 - 2);
        const apiScore = data?.scores.find((s) => s.profile === bd.profile);

        return (
          <View key={bd.profile} style={styles.breakdownCard}>
            {/* Header */}
            <View style={styles.breakdownHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.breakdownProfile}>{profileMeta[bd.profile].label}</Text>
                <Text style={styles.breakdownVerdict}>{bd.verdict}</Text>
              </View>
              <View style={[styles.breakdownScore, { backgroundColor: palette.bg }]}>
                <Text style={[styles.breakdownScoreValue, { color: palette.text }]}>
                  {bd.scoreValue.toFixed(1)}
                </Text>
              </View>
              {scoringInfo && (
                <TouchableOpacity
                  style={styles.infoBtn}
                  onPress={() => setInfoModalProfile(bd.profile as BP)}
                >
                  <Info size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Progress bar */}
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: barWidth, backgroundColor: palette.text }]} />
            </View>

            {/* Criteria */}
            {bd.criteria.map((c) => {
              const cPalette = getScorePalette(c.tone);
              const filledDots = Math.round((c.points / c.maxPoints) * 3);
              return (
                <View key={c.label} style={styles.criterionRow}>
                  <View style={styles.criterionLeft}>
                    <Text style={styles.criterionLabel}>{c.label}</Text>
                    <Text style={styles.criterionValue}>{c.value}</Text>
                  </View>
                  <View style={styles.criterionRight}>
                    <View style={styles.dotsRow}>
                      {[0, 1, 2].map((i) => (
                        <View
                          key={i}
                          style={[
                            styles.dot,
                            i < filledDots
                              ? { backgroundColor: cPalette.text }
                              : { backgroundColor: theme.colors.border },
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.criterionPts, { color: cPalette.text }]}>
                      {c.points}/{c.maxPoints}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* v2 API: top reason + risk flag */}
            {(apiScore?.top_reason || apiScore?.risk_flag) && (
              <View style={styles.reasonBlock}>
                {apiScore.top_reason && (
                  <View style={styles.reasonRow}>
                    <Text style={styles.reasonIcon}>✅</Text>
                    <Text style={styles.reasonText}>{apiScore.top_reason}</Text>
                  </View>
                )}
                {apiScore.risk_flag && (
                  <View style={styles.reasonRow}>
                    <Text style={styles.reasonIcon}>⚠️</Text>
                    <Text style={styles.reasonText}>{apiScore.risk_flag}</Text>
                  </View>
                )}
                {apiScore.confidence !== undefined && (
                  <Text style={styles.confidenceLabel}>
                    Достоверность: {Math.round(apiScore.confidence * 100)}%
                  </Text>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderPricing = () => (
    <View>
      <View style={styles.priceSummaryRow}>
        <View style={styles.priceSummaryCard}>
          <Text style={styles.summaryLabel}>Средняя цена</Text>
          <Text style={styles.summaryValue}>{formatPricePerSqm(latestSnapshot.price_avg)}</Text>
          <Text style={styles.summaryHint}>Актуальный срез</Text>
        </View>
        <View style={styles.priceSummaryCard}>
          <Text style={styles.summaryLabel}>Рост за 6 мес</Text>
          <Text style={[
            styles.summaryValue,
            { color: priceGrowth >= 0 ? theme.colors.green : theme.colors.red },
          ]}>
            {formatPercent(priceGrowth)}
          </Text>
          <Text style={styles.summaryHint}>
            {priceGrowth >= 8 ? 'Выше рынка' : priceGrowth >= 4 ? 'В рынке' : 'Ниже рынка'}
          </Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.sectionRow}>
          <CalendarDays size={18} color={theme.colors.chartLine} />
          <Text style={[styles.sectionHeadline, { color: '#e2e8f0' }]}>Динамика цены</Text>
        </View>
        <LineChart
          data={chartData}
          width={screenWidth - 56}
          height={196}
          chartConfig={{
            backgroundColor: theme.colors.dataPanelBg,
            backgroundGradientFrom: theme.colors.dataPanelBg,
            backgroundGradientTo: '#162645',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(96, 165, 250, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
            propsForDots: { r: '4', strokeWidth: '2', stroke: theme.colors.chartLine, fill: theme.colors.dataPanelBg },
          }}
          bezier
          style={styles.chart}
          yAxisSuffix="k"
        />
      </View>

      <View style={styles.monthlyCard}>
        <View style={styles.monthlyRow}>
          <Text style={styles.monthlyLabel}>Ежемесячный платёж (оценка)</Text>
          <Text style={styles.monthlyValue}>{formatMonthly(data.price_monthly)}</Text>
        </View>
        <Text style={styles.monthlyHint}>
          Рассчитать точнее → вкладка «Ипотека»
        </Text>
      </View>
    </View>
  );

  const renderMortgage = () => (
    <MortgageCalculator pricePerSqm={data.price_avg} areaSqm={data.area_sqm} />
  );

  const renderFlip = () => (
    <FlipCalculator
      pricePerSqm={data.price_avg}
      areaSqm={data.area_sqm}
      constructionStage={data.construction_stage}
    />
  );

  const renderAround = () => (
    <View>
      {data.infrastructure.map((item, index) => {
        const Icon = infraIcons[item.type] || Info;
        return (
          <View key={`${item.name}-${index}`} style={styles.infraCard}>
            <View style={styles.infraIconWrap}>
              <Icon size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.infraContent}>
              <Text style={styles.infraTitle}>{item.name}</Text>
              <Text style={styles.infraType}>{item.type.replace('_', ' ')}</Text>
            </View>
            <Text style={styles.infraDistance}>{formatDistance(item.distance_meters)}</Text>
          </View>
        );
      })}
      <TouchableOpacity
        style={styles.externalButton}
        activeOpacity={0.9}
        onPress={() => Linking.openURL(data.krisha_url)}
      >
        <Text style={styles.externalButtonText}>Открыть на Krisha.kz</Text>
        <ExternalLink size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Hero */}
        <View style={styles.heroSection}>
          <Image source={{ uri: data.image }} style={styles.heroImage} />
          <LinearGradient colors={['rgba(10,20,44,0.08)', 'rgba(10,20,44,0.5)']} style={StyleSheet.absoluteFill} />

          <View style={[styles.topActions, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={styles.topActionButton} onPress={() => navigation.goBack()}>
              <ArrowLeft size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <View style={styles.topActionGroup}>
              <TouchableOpacity style={styles.topActionButton}>
                <Share2 size={18} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.topActionButton, favorited && styles.topActionButtonFav]}
                onPress={() => toggleFavorite(data.id)}
              >
                <Heart size={18} color={favorited ? theme.colors.red : theme.colors.text} fill={favorited ? theme.colors.red : 'transparent'} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryStrip} contentContainerStyle={styles.galleryStripContent}>
            {data.gallery.map((image, index) => (
              <Image key={`${image}-${index}`} source={{ uri: image }} style={styles.galleryThumb} />
            ))}
          </ScrollView>
        </View>

        {/* Sheet */}
        <View style={styles.sheet}>
          <View style={styles.metaHeader}>
            <Text style={styles.metaType}>{data.developer}</Text>
            <View style={styles.metaRating}>
              <Star size={13} color="#f7b731" fill="#f7b731" />
              <Text style={styles.metaRatingText}>{data.rating} ({data.review_count})</Text>
            </View>
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title}>{data.name}</Text>
            {/* Price delta badge */}
            <View style={[
              styles.deltaBadge,
              { backgroundColor: priceGrowth >= 0 ? theme.colors.greenBg : theme.colors.redBg },
            ]}>
              <TrendingUp size={11} color={priceGrowth >= 0 ? theme.colors.green : theme.colors.red} />
              <Text style={[
                styles.deltaBadgeText,
                { color: priceGrowth >= 0 ? theme.colors.green : theme.colors.red },
              ]}>
                {formatPercent(priceGrowth)}
              </Text>
            </View>
          </View>

          <View style={styles.addressRow}>
            <MapPin size={14} color={theme.colors.textMuted} />
            <Text style={styles.address}>{data.address}, Астана</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <BedDouble size={18} color={theme.colors.primary} />
              <Text style={styles.statValue}>{data.bedrooms} спален</Text>
            </View>
            <View style={styles.statCard}>
              <Bath size={18} color={theme.colors.primary} />
              <Text style={styles.statValue}>{data.bathrooms} санузел</Text>
            </View>
            <View style={styles.statCard}>
              <Ruler size={18} color={theme.colors.primary} />
              <Text style={styles.statValue}>{data.area_sqm} м²</Text>
            </View>
          </View>

          <View style={styles.highlightCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.highlightLabel}>Лучший профиль</Text>
              <Text style={styles.highlightTitle}>{profileMeta[strongestScore.profile as BuyerProfile].label}</Text>
              <Text style={styles.highlightDescription}>{strongestScore.explanation}</Text>
            </View>
            <View style={styles.highlightScoreWrap}>
              <Text style={styles.highlightScore}>{strongestScore.score_value.toFixed(1)}</Text>
            </View>
          </View>

          {/* Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}>
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {activeTab === 'overview'  && renderOverview()}
          {activeTab === 'scoring'   && renderScoring()}
          {activeTab === 'pricing'   && renderPricing()}
          {activeTab === 'mortgage'  && renderMortgage()}
          {activeTab === 'flip'      && renderFlip()}
          {activeTab === 'around'    && renderAround()}
        </View>
      </ScrollView>

      {/* Scoring info modal */}
      {scoringInfo && infoModalProfile && (
        <ScoringInfoModal
          visible={!!infoModalProfile}
          profile={infoModalProfile}
          scoringInfo={scoringInfo}
          onClose={() => setInfoModalProfile(null)}
        />
      )}

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View>
          <Text style={styles.bottomLabel}>Цена квартиры</Text>
          <Text style={styles.bottomValue}>{formatCurrency(latestSnapshot.price_avg * data.area_sqm)}</Text>
        </View>
        <TouchableOpacity style={styles.bookButton} activeOpacity={0.9} onPress={() => Linking.openURL(data.krisha_url)}>
          <Text style={styles.bookButtonText}>Открыть на Korter.kz</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 140 },
  heroSection: { height: 392, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  topActions: { position: 'absolute', top: 0, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topActionGroup: { flexDirection: 'row', gap: 12 },
  topActionButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center' },
  topActionButtonFav: { backgroundColor: 'rgba(254,235,235,0.96)' },
  galleryStrip: { position: 'absolute', left: 20, right: 0, bottom: 16 },
  galleryStripContent: { paddingRight: 8 },
  galleryThumb: { width: 88, height: 72, borderRadius: 16, marginRight: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  sheet: { backgroundColor: theme.colors.surface, marginTop: -18, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 22 },
  metaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaType: { color: theme.colors.primary, fontSize: 15, fontWeight: '600' },
  metaRating: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaRatingText: { color: theme.colors.textSecondary, fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  title: { flex: 1, color: theme.colors.text, fontSize: 28, fontWeight: '800' },
  deltaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  deltaBadgeText: { fontSize: 12, fontWeight: '800' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  address: { flex: 1, color: theme.colors.textMuted, fontSize: 14 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, gap: 12 },
  statCard: { flex: 1, borderRadius: 20, backgroundColor: theme.colors.surfaceMuted, paddingVertical: 14, alignItems: 'center', gap: 8 },
  statValue: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  highlightCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.primarySoft, borderRadius: 24, padding: 18, marginTop: 22 },
  highlightLabel: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 4 },
  highlightTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  highlightDescription: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4, maxWidth: 220 },
  highlightScoreWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' },
  highlightScore: { color: theme.colors.primary, fontSize: 26, fontWeight: '800' },
  tabsScroll: { marginTop: 22, marginHorizontal: -20 },
  tabsRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 16 },
  tabButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: theme.colors.surfaceMuted },
  tabButtonActive: { backgroundColor: theme.colors.primarySoft },
  tabLabel: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 14 },
  tabLabelActive: { color: theme.colors.primary },

  // Overview
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionHeadline: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  descriptionCard: { backgroundColor: theme.colors.surfaceMuted, borderRadius: 22, padding: 18 },
  descriptionText: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 24 },
  aiCard: { backgroundColor: theme.colors.surface, borderRadius: 22, padding: 18, marginTop: 14, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card },
  aiText: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 24 },
  scoreRail: { flexDirection: 'row', gap: 12, marginTop: 16 },
  scoreMiniCard: { flex: 1, borderRadius: 20, padding: 14 },
  scoreMiniProfile: { fontSize: 12, fontWeight: '700' },
  scoreMiniValue: { fontSize: 24, fontWeight: '800', color: theme.colors.text, marginTop: 8 },
  scoreMiniCaption: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 3 },
  agentCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.colors.surface, borderRadius: 22, padding: 16, marginTop: 14, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card },
  agentAvatar: { width: 52, height: 52, borderRadius: 26 },
  agentContent: { flex: 1 },
  agentCaption: { fontSize: 11, color: theme.colors.textMuted },
  agentName: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginTop: 3 },
  agentRole: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  agentAction: { backgroundColor: theme.colors.primarySoft, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 },
  agentActionText: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },

  // Scoring breakdown
  breakdownCard: { backgroundColor: theme.colors.surface, borderRadius: 24, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card },
  breakdownHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  infoBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.surfaceMuted, justifyContent: 'center', alignItems: 'center' },
  reasonBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: 6 },
  reasonRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  reasonIcon: { fontSize: 13, marginTop: 1 },
  reasonText: { color: theme.colors.textSecondary, fontSize: 12, flex: 1, lineHeight: 17 },
  confidenceLabel: { color: theme.colors.textMuted, fontSize: 11, marginTop: 4 },
  breakdownProfile: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  breakdownVerdict: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18, marginTop: 4, maxWidth: 220 },
  breakdownScore: { minWidth: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  breakdownScoreValue: { fontSize: 20, fontWeight: '800' },
  progressBg: { height: 6, backgroundColor: theme.colors.surfaceMuted, borderRadius: 3, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  criterionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  criterionLeft: { flex: 1 },
  criterionLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  criterionValue: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  criterionRight: { alignItems: 'flex-end', gap: 4 },
  dotsRow: { flexDirection: 'row', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  criterionPts: { fontSize: 11, fontWeight: '700' },

  // Pricing
  priceSummaryRow: { flexDirection: 'row', gap: 12 },
  priceSummaryCard: { flex: 1, backgroundColor: theme.colors.surfaceMuted, borderRadius: 20, padding: 16 },
  summaryLabel: { color: theme.colors.textMuted, fontSize: 12, marginBottom: 6 },
  summaryValue: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  summaryHint: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 4 },
  chartCard: { backgroundColor: theme.colors.dataPanelBg, borderRadius: 22, padding: 16, marginTop: 14, borderWidth: 1, borderColor: theme.colors.dataPanelBorder },
  chart: { marginTop: 8, borderRadius: 16 },
  monthlyCard: { backgroundColor: theme.colors.primarySoft, borderRadius: 20, padding: 16, marginTop: 14 },
  monthlyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthlyLabel: { fontSize: 13, color: theme.colors.textSecondary, flex: 1 },
  monthlyValue: { fontSize: 17, fontWeight: '800', color: theme.colors.primary },
  monthlyHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6 },

  // Around
  infraCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, padding: 14, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadows.card },
  infraIconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.colors.primarySoft, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  infraContent: { flex: 1 },
  infraTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  infraType: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  infraDistance: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
  externalButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, padding: 16, borderRadius: 20, marginTop: 8, gap: 8 },
  externalButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Bottom bar
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 0, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 28, paddingHorizontal: 18, paddingTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...theme.shadows.floating },
  bottomLabel: { color: theme.colors.textMuted, fontSize: 11 },
  bottomValue: { color: theme.colors.text, fontSize: 20, fontWeight: '800', marginTop: 3 },
  bookButton: { backgroundColor: theme.colors.primary, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 14 },
  bookButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
