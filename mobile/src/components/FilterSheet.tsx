import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { ConstructionStage } from '../api';
import { theme } from '../theme';
import { getStageLabel } from '../utils/realEstate';

export interface FilterState {
  stages: ConstructionStage[];
  districts: string[];
  maxPrice: number;
}

export const DEFAULT_FILTERS: FilterState = {
  stages: [],
  districts: [],
  maxPrice: 1000000,
};

const ALL_STAGES: ConstructionStage[] = ['commissioned', 'under_construction', 'foundation', 'planned'];
const ALL_DISTRICTS = ['Есиль', 'Алматы', 'Нура', 'Сарыарка', 'Байконур'];
const PRICE_STEPS = [400000, 500000, 600000, 700000, 800000, 900000, 1000000];

interface Props {
  visible: boolean;
  filters: FilterState;
  onApply: (f: FilterState) => void;
  onClose: () => void;
}

export default function FilterSheet({ visible, filters, onApply, onClose }: Props) {
  const [local, setLocal] = useState<FilterState>(filters);

  const toggleStage = (s: ConstructionStage) =>
    setLocal((prev) => ({
      ...prev,
      stages: prev.stages.includes(s) ? prev.stages.filter((x) => x !== s) : [...prev.stages, s],
    }));

  const toggleDistrict = (d: string) =>
    setLocal((prev) => ({
      ...prev,
      districts: prev.districts.includes(d) ? prev.districts.filter((x) => x !== d) : [...prev.districts, d],
    }));

  const handleApply = () => {
    onApply(local);
    onClose();
  };

  const handleReset = () => {
    const clean = { ...DEFAULT_FILTERS };
    setLocal(clean);
    onApply(clean);
    onClose();
  };

  const activeCount =
    local.stages.length + local.districts.length + (local.maxPrice < 1000000 ? 1 : 0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Фильтры</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <Text style={styles.sectionLabel}>Стадия</Text>
            <View style={styles.chipRow}>
              {ALL_STAGES.map((s) => {
                const active = local.stages.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleStage(s)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {getStageLabel(s)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Район</Text>
            <View style={styles.chipRow}>
              {ALL_DISTRICTS.map((d) => {
                const active = local.districts.includes(d);
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleDistrict(d)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>
              Макс. цена — до {(local.maxPrice / 1000).toFixed(0)} 000 ₸/м²
            </Text>
            <View style={styles.priceRow}>
              {PRICE_STEPS.map((step) => {
                const active = local.maxPrice === step;
                return (
                  <TouchableOpacity
                    key={step}
                    style={[styles.priceChip, active && styles.chipActive]}
                    onPress={() => setLocal((prev) => ({ ...prev, maxPrice: step }))}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {step / 1000}k
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetText}>Сбросить{activeCount > 0 ? ` (${activeCount})` : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyText}>Применить</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(16,26,50,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginTop: 20,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  priceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  priceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: theme.colors.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 8,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  resetText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  applyText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
