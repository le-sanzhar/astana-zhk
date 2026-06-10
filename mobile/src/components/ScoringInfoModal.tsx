import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { BuyerProfile, ScoringInfo } from '../api';
import { theme } from '../theme';
import { profileMeta } from '../utils/realEstate';

interface Props {
  visible: boolean;
  profile: BuyerProfile;
  scoringInfo: ScoringInfo;
  onClose: () => void;
}

const PROFILE_ICONS: Record<BuyerProfile, string> = {
  investor: '📈',
  family: '🏡',
  student: '🎓',
  flipper: '🔄',
};

export default function ScoringInfoModal({ visible, profile, scoringInfo, onClose }: Props) {
  const info = scoringInfo.profiles[profile];
  if (!info) return null;

  const totalWeight = info.factors.reduce((s, f) => s + f.weight, 0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.profileIcon}>{PROFILE_ICONS[profile]}</Text>
              <View>
                <Text style={styles.profileLabel}>{info.label}</Text>
                <Text style={styles.profileDesc}>{info.description}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            {/* How it works */}
            <View style={styles.howCard}>
              <Text style={styles.howTitle}>Как считается оценка</Text>
              <Text style={styles.howText}>{scoringInfo.how_it_works}</Text>
            </View>

            {/* Factors */}
            <Text style={styles.sectionTitle}>Факторы оценки</Text>

            {info.factors.map((factor) => {
              const pct = Math.round((factor.weight / totalWeight) * 100);
              const barW = `${pct}%` as any;
              return (
                <View key={factor.key} style={styles.factorCard}>
                  <View style={styles.factorHeader}>
                    <Text style={styles.factorLabel}>{factor.label}</Text>
                    <View style={styles.weightPill}>
                      <Text style={styles.weightText}>{factor.weight_pct}</Text>
                    </View>
                  </View>

                  {/* Weight bar */}
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: barW }]} />
                  </View>

                  <Text style={styles.howDetail}>{factor.how}</Text>

                  <View style={styles.thresholdRow}>
                    <View style={styles.thresholdGood}>
                      <Text style={styles.thresholdIcon}>✅</Text>
                      <Text style={styles.thresholdText}>{factor.good}</Text>
                    </View>
                    <View style={styles.thresholdBad}>
                      <Text style={styles.thresholdIcon}>⚠️</Text>
                      <Text style={styles.thresholdText}>{factor.bad}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Tones legend */}
            <View style={styles.legendCard}>
              <Text style={styles.legendTitle}>Тоны оценки</Text>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.green }]} />
                <Text style={styles.legendText}>Зелёный — сильно (≥ 6.5 / 10)</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.yellow }]} />
                <Text style={styles.legendText}>Жёлтый — средне (≥ 4.0 / 10)</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.red }]} />
                <Text style={styles.legendText}>Красный — слабо ({'<'} 4.0 / 10)</Text>
              </View>
            </View>

            {/* Confidence note */}
            <View style={styles.confidenceCard}>
              <Text style={styles.confidenceTitle}>Что такое confidence?</Text>
              <Text style={styles.confidenceText}>{scoringInfo.confidence_note}</Text>
            </View>

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  profileIcon: { fontSize: 32 },
  profileLabel: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  profileDesc: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2, maxWidth: 240 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  howCard: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  howTitle: { color: theme.colors.primary, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  howText: { color: theme.colors.text, fontSize: 13, lineHeight: 20 },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  factorCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  factorLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  weightPill: {
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
  },
  weightText: { color: theme.colors.primary, fontSize: 13, fontWeight: '800' },
  barBg: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginBottom: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  howDetail: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  thresholdRow: { gap: 6 },
  thresholdGood: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  thresholdBad: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  thresholdIcon: { fontSize: 13 },
  thresholdText: { color: theme.colors.textMuted, fontSize: 12, flex: 1, lineHeight: 17 },
  legendCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    gap: 8,
  },
  legendTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: theme.colors.textSecondary, fontSize: 13 },
  confidenceCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
  },
  confidenceTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  confidenceText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
