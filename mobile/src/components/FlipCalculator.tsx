import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ConstructionStage } from '../api';
import { formatCurrency } from '../utils/realEstate';
import { theme } from '../theme';

const RENOVATION_TIERS = [
  { label: 'Эконом',   value: 30000, hint: '~30 000 ₸/м²' },
  { label: 'Стандарт', value: 50000, hint: '~50 000 ₸/м²' },
  { label: 'Премиум',  value: 85000, hint: '~85 000 ₸/м²' },
];

// Construction premium (KZ market): price appreciation from current stage → commissioned
const STAGE_PREMIUM: Record<ConstructionStage, number> = {
  foundation:        0.30,
  under_construction: 0.15,
  commissioned:      0.00,
  planned:           0.35,
};

// Months to hold until exit
const HOLD_MONTHS: Record<ConstructionStage, number> = {
  foundation:        20,
  under_construction: 10,
  commissioned:       4,
  planned:           28,
};

// Post-renovation value premium for commissioned apartments
const RENO_VALUE_PREMIUM = 0.12;

// Exit costs: agent 3% + notary/tax 2%
const EXIT_COST_RATE = 0.05;

interface Props {
  pricePerSqm: number;
  areaSqm: number;
  constructionStage: ConstructionStage;
}

export default function FlipCalculator({ pricePerSqm, areaSqm, constructionStage }: Props) {
  const [renovationTier, setRenovationTier] = useState(1); // standard

  const calc = useMemo(() => {
    const buyPrice = pricePerSqm * areaSqm;
    const holdMonths = HOLD_MONTHS[constructionStage];
    const isCommissioned = constructionStage === 'commissioned';

    let arvPerSqm: number;
    let renovationCost: number;
    let totalInvested: number;

    if (isCommissioned) {
      renovationCost = RENOVATION_TIERS[renovationTier].value * areaSqm;
      arvPerSqm = pricePerSqm * (1 + RENO_VALUE_PREMIUM);
      totalInvested = buyPrice + renovationCost;
    } else {
      renovationCost = 0;
      arvPerSqm = pricePerSqm * (1 + STAGE_PREMIUM[constructionStage]);
      totalInvested = buyPrice;
    }

    const arv = arvPerSqm * areaSqm;
    const exitCosts = arv * EXIT_COST_RATE;
    const grossProfit = arv - buyPrice - renovationCost;
    const netProfit = grossProfit - exitCosts;
    const roi = (netProfit / totalInvested) * 100;
    const annualizedRoi = roi / (holdMonths / 12);

    // 70% rule: max safe offer = ARV × 0.70 − renovation
    const maxSafeOffer = arv * 0.70 - renovationCost;
    const rule70Pass = buyPrice <= maxSafeOffer;

    return { buyPrice, arv, arvPerSqm, renovationCost, exitCosts, grossProfit, netProfit, roi, annualizedRoi, holdMonths, totalInvested, maxSafeOffer, rule70Pass };
  }, [pricePerSqm, areaSqm, constructionStage, renovationTier]);

  const isCommissioned = constructionStage === 'commissioned';
  const strategyLabel = constructionStage === 'foundation'
    ? 'Котлован → Сдача'
    : constructionStage === 'under_construction'
    ? 'Строительство → Сдача'
    : 'Покупка → Ремонт → Продажа';

  return (
    <View style={styles.container}>
      {/* Hero card */}
      <LinearGradient
        colors={['#0B1628', '#162645']}
        style={styles.heroCard}
      >
        <Text style={styles.heroStrategy}>{strategyLabel}</Text>
        <Text style={styles.heroLabel}>Чистая прибыль</Text>
        <Text style={[styles.heroValue, { color: calc.netProfit >= 0 ? '#60A5FA' : '#f87171' }]}>
          {formatCurrency(calc.netProfit)}
        </Text>
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Доходность</Text>
            <Text style={[styles.heroStatValue, { color: calc.roi >= 0 ? '#34d399' : '#f87171' }]}>
              {calc.roi.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Годовых</Text>
            <Text style={[styles.heroStatValue, { color: calc.annualizedRoi >= 0 ? '#34d399' : '#f87171' }]}>
              {calc.annualizedRoi.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Срок (мес)</Text>
            <Text style={styles.heroStatValueNeutral}>{calc.holdMonths}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Renovation tier selector (only for commissioned) */}
      {isCommissioned && (
        <>
          <Text style={styles.sectionLabel}>Тип ремонта</Text>
          <View style={styles.chipRow}>
            {RENOVATION_TIERS.map((tier, idx) => {
              const active = renovationTier === idx;
              return (
                <TouchableOpacity
                  key={tier.label}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setRenovationTier(idx)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{tier.label}</Text>
                  <Text style={[styles.chipSub, active && styles.chipTextActive]}>{tier.hint}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* P&L breakdown */}
      <View style={styles.breakdownCard}>
        <Text style={styles.breakdownTitle}>Расчёт сделки</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Покупная цена</Text>
          <Text style={styles.rowValue}>{formatCurrency(calc.buyPrice)}</Text>
        </View>
        {isCommissioned && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Стоимость ремонта</Text>
            <Text style={styles.rowValue}>{formatCurrency(calc.renovationCost)}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Итого вложений</Text>
          <Text style={styles.rowValueBold}>{formatCurrency(calc.totalInvested)}</Text>
        </View>

        <View style={[styles.row, styles.rowDivider]}>
          <Text style={styles.rowLabel}>Цена продажи (ARV)</Text>
          <Text style={styles.rowValueBlue}>{formatCurrency(calc.arv)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Расходы при продаже (5%)</Text>
          <Text style={[styles.rowValue, { color: theme.colors.red }]}>− {formatCurrency(calc.exitCosts)}</Text>
        </View>
        <View style={[styles.row, styles.rowDivider]}>
          <Text style={styles.rowLabelBold}>Чистая прибыль</Text>
          <Text style={[styles.rowValueBold, { color: calc.netProfit >= 0 ? theme.colors.green : theme.colors.red }]}>
            {formatCurrency(calc.netProfit)}
          </Text>
        </View>
      </View>

      {/* 70% rule */}
      <View style={[styles.ruleCard, { borderColor: calc.rule70Pass ? theme.colors.green : theme.colors.red }]}>
        <View style={styles.ruleHeader}>
          <View style={[styles.ruleDot, { backgroundColor: calc.rule70Pass ? theme.colors.green : theme.colors.red }]} />
          <Text style={styles.ruleTitle}>Правило 70%</Text>
          <Text style={[styles.ruleStatus, { color: calc.rule70Pass ? theme.colors.green : theme.colors.red }]}>
            {calc.rule70Pass ? 'Проходит ✓' : 'Не проходит ✗'}
          </Text>
        </View>
        <Text style={styles.ruleFormula}>Макс. безопасная цена покупки:</Text>
        <Text style={styles.ruleValue}>{formatCurrency(calc.maxSafeOffer)}</Text>
        <Text style={styles.ruleHint}>
          Цена продажи × 0.70 − ремонт. Ваша цена {calc.rule70Pass ? 'ниже' : 'выше'} порога.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 8 },
  heroCard: { borderRadius: 24, padding: 22, marginBottom: 16 },
  heroStrategy: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  heroValue: { fontSize: 32, fontWeight: '800', marginTop: 4 },
  heroRow: { flexDirection: 'row', marginTop: 20 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 8 },
  heroStatLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  heroStatValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  heroStatValueNeutral: { color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '800', marginTop: 4 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 10 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: { flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center' },
  chipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  chipText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.primary },
  chipSub: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  breakdownCard: { backgroundColor: theme.colors.surfaceMuted, borderRadius: 20, padding: 16, marginBottom: 12 },
  breakdownTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  rowDivider: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 4 },
  rowLabel: { fontSize: 13, color: theme.colors.textSecondary },
  rowLabelBold: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  rowValue: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  rowValueBold: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  rowValueBlue: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  ruleCard: { borderRadius: 20, padding: 16, borderWidth: 2, backgroundColor: theme.colors.surface },
  ruleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  ruleDot: { width: 10, height: 10, borderRadius: 5 },
  ruleTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: theme.colors.text },
  ruleStatus: { fontSize: 13, fontWeight: '700' },
  ruleFormula: { fontSize: 12, color: theme.colors.textMuted },
  ruleValue: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginTop: 4 },
  ruleHint: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 18 },
});
