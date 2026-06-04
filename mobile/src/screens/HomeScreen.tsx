import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  GraduationCap,
  Hammer,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Users,
  X,
  ArrowUpRight,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  API_BASE,
  BuyerProfile,
  ComplexItem,
  ConstructionStage,
  Notification,
  fetchComplexes,
  mockNotifications,
} from '../api';
import { theme } from '../theme';
import {
  calcPriceGrowth,
  formatMonthly,
  formatPercent,
  formatPricePerSqm,
  getScoreLabel,
  getScorePalette,
  getStageLabel,
  getStagePalette,
  profileMeta,
} from '../utils/realEstate';
import { SkeletonFeaturedCard, SkeletonNearbyCard } from '../components/SkeletonCard';
import FilterSheet, { DEFAULT_FILTERS, FilterState } from '../components/FilterSheet';

const profiles = [
  { id: 'investor', label: 'Инвестор', icon: TrendingUp },
  { id: 'family',   label: 'Семья',    icon: Users },
  { id: 'student',  label: 'Студент',  icon: GraduationCap },
  { id: 'flipper',  label: 'Флиппер',  icon: Hammer },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  return `${Math.floor(hrs / 24)} д назад`;
}

export default function HomeScreen({ navigation }: any) {
  const [complexes, setComplexes] = useState<ComplexItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<BuyerProfile>('investor');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterVisible, setFilterVisible] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [bellOpen, setBellOpen] = useState(false);

  const scoreAnim = useRef(new Animated.Value(1)).current;

  const activeFilterCount =
    filters.stages.length +
    filters.districts.length +
    (filters.maxPrice < 1000000 ? 1 : 0);

  const loadData = async (f: FilterState = filters) => {
    setLoading(true);
    try {
      const data = await fetchComplexes({
        profile: selectedProfile,
        stages: f.stages.length > 0 ? (f.stages as ConstructionStage[]) : undefined,
        districts: f.districts.length > 0 ? f.districts : undefined,
        maxPrice: f.maxPrice < 1000000 ? f.maxPrice : undefined,
      });
      setComplexes(data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    fetch(`${API_BASE}/api/v1/notifications`, { signal: ctrl.signal })
      .finally(() => clearTimeout(t))
      .then((r) => r.json())
      .then((data: Notification[]) => { if (data.length > 0) setNotifications(data); })
      .catch(() => {/* keep mock notifications */});
  }, []);

  const handleProfileChange = (profile: BuyerProfile) => {
    if (profile === selectedProfile) return;
    Animated.sequence([
      Animated.timing(scoreAnim, { toValue: 0.3, duration: 120, useNativeDriver: true }),
      Animated.timing(scoreAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setSelectedProfile(profile);
    loadData(filters);
  };

  const handleApplyFilters = (f: FilterState) => {
    setFilters(f);
  };

  const dismissNotification = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? complexes.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.district.toLowerCase().includes(query) ||
          item.developer.toLowerCase().includes(query),
      )
    : complexes;

  const featuredComplexes = filtered.slice(0, 3);
  const nearbyComplexes = filtered.slice(3);

  const openDetails = (id: string) => navigation.navigate('ComplexDetail', { id });

  const renderFeaturedCard = (item: ComplexItem) => {
    const score = item[`${selectedProfile}_score` as const];
    const scorePalette = getScorePalette(score);
    const stagePalette = getStagePalette(item.construction_stage);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.featuredCard}
        activeOpacity={0.9}
        onPress={() => openDetails(item.id)}
      >
        <Image source={{ uri: item.image }} style={styles.featuredImage} />
        <View style={styles.featuredOverlayTop}>
          <View style={[styles.badge, { backgroundColor: stagePalette.bg }]}>
            <Text style={[styles.badgeText, { color: stagePalette.text }]}>
              {getStageLabel(item.construction_stage)}
            </Text>
          </View>
          <View style={styles.ratingBadge}>
            <Star size={12} color="#f7b731" fill="#f7b731" />
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
        </View>
        <View style={styles.featuredBody}>
          <View style={styles.featuredMetaRow}>
            <View style={styles.developerDeltaRow}>
              <Text style={styles.featuredType}>{item.developer}</Text>
              {(() => {
                const g = calcPriceGrowth(item.price_snapshots);
                return (
                  <View style={[styles.deltaPill, { backgroundColor: g >= 0 ? theme.colors.greenBg : theme.colors.redBg }]}>
                    <ArrowUpRight size={10} color={g >= 0 ? theme.colors.green : theme.colors.red} />
                    <Text style={[styles.deltaPillText, { color: g >= 0 ? theme.colors.green : theme.colors.red }]}>
                      {formatPercent(g)}
                    </Text>
                  </View>
                );
              })()}
            </View>
            <Animated.View
              style={[styles.scorePill, { backgroundColor: scorePalette.bg, opacity: scoreAnim }]}
            >
              <Text style={[styles.scorePillText, { color: scorePalette.text }]}>
                {profileMeta[selectedProfile].shortLabel}
              </Text>
            </Animated.View>
          </View>
          <Text style={styles.featuredTitle}>{item.name}</Text>
          <View style={styles.locationRow}>
            <MapPin size={13} color={theme.colors.textMuted} />
            <Text style={styles.locationText}>{item.address}</Text>
          </View>
          <Text style={styles.taglineText}>{item.tagline}</Text>
          <View style={styles.featuredFooter}>
            <Text style={styles.featuredPrice}>{formatMonthly(item.price_monthly)}</Text>
            <Text style={styles.featuredPriceMeta}>{formatPricePerSqm(item.price_avg)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderNearbyCard = (item: ComplexItem) => {
    const score = item[`${selectedProfile}_score` as const];
    const scorePalette = getScorePalette(score);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.nearbyCard}
        activeOpacity={0.9}
        onPress={() => openDetails(item.id)}
      >
        <Image source={{ uri: item.image }} style={styles.nearbyImage} />
        <View style={styles.nearbyBody}>
          <View style={styles.nearbyHeader}>
            <Text style={styles.nearbyTitle}>{item.name}</Text>
            <Text style={styles.nearbyPrice}>{formatMonthly(item.price_monthly)}</Text>
          </View>
          <View style={styles.locationRow}>
            <MapPin size={13} color={theme.colors.textMuted} />
            <Text style={styles.locationText}>{item.district}, Астана</Text>
          </View>
          <Text style={styles.nearbyDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.nearbyFooter}>
            <Animated.View
              style={[styles.scoreTag, { backgroundColor: scorePalette.bg, opacity: scoreAnim }]}
            >
              <Text style={[styles.scoreTagText, { color: scorePalette.text }]}>
                {profileMeta[selectedProfile].label} • {getScoreLabel(score)}
              </Text>
            </Animated.View>
            <Text style={styles.metricText}>{formatPricePerSqm(item.price_avg)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Bell dropdown */}
      {bellOpen && (
        <View style={styles.notifPanel}>
          <View style={styles.notifHeader}>
            <Text style={styles.notifTitle}>Уведомления</Text>
            <TouchableOpacity onPress={() => setBellOpen(false)}>
              <X size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {notifications.length === 0 ? (
            <Text style={styles.notifEmpty}>Всё тихо — новых изменений нет.</Text>
          ) : (
            notifications.map((n) => (
              <View key={n.id} style={styles.notifItem}>
                <View style={styles.notifDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifName}>{n.complexName}</Text>
                  <Text style={styles.notifMsg}>{n.message}</Text>
                  <Text style={styles.notifTime}>{timeAgo(n.timestamp)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => dismissNotification(n.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={14} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerCaption}>Текущее местоположение</Text>
            <View style={styles.headerLocationRow}>
              <MapPin size={16} color={theme.colors.primary} fill={theme.colors.primary} />
              <Text style={styles.headerLocationText}>Астана, Казахстан</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={() => setBellOpen((v) => !v)}>
            <Bell size={18} color={theme.colors.text} />
            {notifications.length > 0 && (
              <View style={styles.notificationDot}>
                <Text style={styles.notificationDotText}>
                  {notifications.length > 9 ? '9+' : notifications.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Search size={18} color={theme.colors.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Поиск по ЖК, району, застройщику"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity activeOpacity={0.9} onPress={() => setFilterVisible(true)}>
            <LinearGradient
              colors={
                activeFilterCount > 0
                  ? [theme.colors.primaryStrong, theme.colors.primary]
                  : [theme.colors.primary, theme.colors.primaryStrong]
              }
              style={styles.filterAction}
            >
              <SlidersHorizontal size={20} color="#fff" />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.profileRailScroll}
          style={styles.profileRail}
        >
          {profiles.map((profile) => {
            const Icon = profile.icon;
            const active = selectedProfile === profile.id;

            return (
              <TouchableOpacity
                key={profile.id}
                activeOpacity={0.9}
                style={styles.profileItem}
                onPress={() => handleProfileChange(profile.id as BuyerProfile)}
              >
                <View style={[styles.profileIconWrap, active && styles.profileIconWrapActive]}>
                  {active ? (
                    <LinearGradient
                      colors={[theme.colors.primary, '#4a82ff']}
                      style={styles.profileIconGradient}
                    >
                      <Icon size={22} color="#fff" />
                    </LinearGradient>
                  ) : (
                    <Icon size={22} color={theme.colors.primary} />
                  )}
                </View>
                <Text style={styles.profileLabel}>{profile.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Рекомендуем</Text>
            <Text style={styles.sectionSubtitle}>{profileMeta[selectedProfile].description}</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>Все</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredRail}
          >
            <SkeletonFeaturedCard />
            <SkeletonFeaturedCard />
          </ScrollView>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredRail}
          >
            {featuredComplexes.map(renderFeaturedCard)}
          </ScrollView>
        )}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Все ЖК</Text>
            <Text style={styles.sectionSubtitle}>Остальные объекты в подборке</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>Все</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <>
            <SkeletonNearbyCard />
            <SkeletonNearbyCard />
          </>
        ) : nearbyComplexes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Ничего не найдено</Text>
            <Text style={styles.emptyText}>Попробуйте другой запрос или сбросьте фильтры.</Text>
          </View>
        ) : (
          nearbyComplexes.map(renderNearbyCard)
        )}
      </ScrollView>

      <FilterSheet
        visible={filterVisible}
        filters={filters}
        onApply={handleApplyFilters}
        onClose={() => setFilterVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingBottom: 120 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerCaption: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 6 },
  headerLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLocationText: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.red,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  notificationDotText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  notifPanel: {
    position: 'absolute',
    top: 72,
    right: 16,
    left: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 16,
    zIndex: 100,
    ...theme.shadows.floating,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notifTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  notifEmpty: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 8 },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginTop: 4,
  },
  notifName: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  notifMsg: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, lineHeight: 18 },
  notifTime: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  searchInput: { flex: 1, marginLeft: 10, color: theme.colors.text, fontSize: 15 },
  filterAction: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.floating,
  },
  filterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: { fontSize: 9, fontWeight: '800', color: theme.colors.primary },
  profileRail: { marginTop: 24 },
  profileRailScroll: { paddingHorizontal: 20, gap: 16 },
  profileItem: { alignItems: 'center', width: 80 },
  profileIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  profileIconWrapActive: { borderColor: '#cfe0ff' },
  profileIconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileLabel: { marginTop: 10, fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 30,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
  sectionSubtitle: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  seeAllText: { color: theme.colors.primary, fontSize: 15, fontWeight: '600' },
  featuredRail: { paddingLeft: 20, paddingRight: 8 },
  featuredCard: {
    width: 278,
    marginRight: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    overflow: 'hidden',
    ...theme.shadows.floating,
  },
  featuredImage: { width: '100%', height: 190 },
  featuredOverlayTop: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ratingText: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  featuredBody: { padding: 18 },
  featuredMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  developerDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 999 },
  deltaPillText: { fontSize: 10, fontWeight: '800' },
  featuredType: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  scorePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  scorePillText: { fontSize: 11, fontWeight: '800' },
  featuredTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  locationText: { flex: 1, fontSize: 13, color: theme.colors.textMuted },
  taglineText: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20, marginTop: 10 },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
  },
  featuredPrice: { fontSize: 22, fontWeight: '800', color: theme.colors.primary },
  featuredPriceMeta: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 4 },
  nearbyCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  nearbyImage: { width: '100%', height: 210 },
  nearbyBody: { padding: 18 },
  nearbyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  nearbyTitle: { flex: 1, fontSize: 22, fontWeight: '800', color: theme.colors.text },
  nearbyPrice: { fontSize: 16, fontWeight: '800', color: theme.colors.primary },
  nearbyDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    marginTop: 12,
  },
  nearbyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  scoreTag: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999 },
  scoreTagText: { fontSize: 12, fontWeight: '700' },
  metricText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  emptyContainer: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 24,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 8 },
  emptyText: { color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
