import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MORTGAGE_BANKS,
  MortgageBank,
  calcMortgage,
  formatCurrency,
  formatMonthly,
} from '../utils/realEstate';
import { theme } from '../theme';

const DOWN_PAYMENTS = [
  { label: '10%', value: 0.10 },
  { label: '20%', value: 0.20 },
  { label: '30%', value: 0.30 },
  { label: '50%', value: 0.50 },
];

const TERMS = [
  { label: '10 лет', value: 10 },
  { label: '15 лет', value: 15 },
  { label: '20 лет', value: 20 },
  { label: '25 лет', value: 25 },
];

interface Props {
  pricePerSqm: number;
  areaSqm: number;
}

export default function MortgageCalculator({ pricePerSqm, areaSqm }: Props) {
  const [bank, setBank] = useState<MortgageBank>(MORTGAGE_BANKS[0]);
  const [downPayment, setDownPayment] = useState(0.20);
  const [term, setTerm] = useState(20);

  const result = useMemo(
    () => calcMortgage(pricePerSqm, areaSqm, downPayment, bank.rate, term),
    [pricePerSqm, areaSqm, downPayment, bank.rate, term],
  );

  const totalPrice = pricePerSqm * areaSqm;
  const overpaymentPct = (result.overpayment / totalPrice) * 100;

  return (
    <View style={styles.container}>
      {/* Main result card */}
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryStrong]}
        style={styles.heroCard}
      >
        <Text style={styles.heroLabel}>Ежемесячный платёж</Text>
        <Text style={styles.heroValue}>{formatMonthly(result.monthlyPayment)}</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Сумма кредита</Text>
            <Text style={styles.heroStatValue}>{formatCurrency(result.loanAmount)}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Переплата</Text>
            <Text style={styles.heroStatValue}>
              {formatCurrency(result.overpayment)} ({overpaymentPct.toFixed(0)}%)
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Min income */}
      <View style={styles.incomeCard}>
        <Text style={styles.incomeLabel}>Минимальный доход</Text>
        <Text style={styles.incomeValue}>{formatMonthly(result.minMonthlyIncome)}</Text>
        <Text style={styles.incomeHint}>Банки требуют: платёж ≤ 50% дохода</Text>
      </View>

      {/* Bank selector */}
      <Text style={styles.sectionLabel}>Банк</Text>
      {MORTGAGE_BANKS.map((b) => {
        const active = b.id === bank.id;
        return (
          <TouchableOpacity
            key={b.id}
            style={[styles.bankRow, active && styles.bankRowActive]}
            onPress={() => setBank(b)}
            activeOpacity={0.8}
          >
            <View style={styles.bankLeft}>
              <View style={[styles.bankRadio, active && styles.bankRadioActive]}>
                {active && <View style={styles.bankRadioDot} />}
              </View>
              <View>
                <Text style={[styles.bankName, active && styles.bankNameActive]}>{b.name}</Text>
                <Text style={styles.bankNote}>{b.note}</Text>
              </View>
            </View>
            <Text style={[styles.bankRate, active && styles.bankRateActive]}>{b.rate}%</Text>
          </TouchableOpacity>
        );
      })}

      {/* Down payment */}
      <Text style={styles.sectionLabel}>Первоначальный взнос</Text>
      <View style={styles.chipRow}>
        {DOWN_PAYMENTS.map(({ label, value }) => {
          const active = downPayment === value;
          return (
            <TouchableOpacity
              key={label}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setDownPayment(value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              <Text style={[styles.chipSub, active && styles.chipTextActive]}>
                {formatCurrency(totalPrice * value)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Term */}
      <Text style={styles.sectionLabel}>Срок</Text>
      <View style={styles.chipRow}>
        {TERMS.map(({ label, value }) => {
          const active = term === value;
          return (
            <TouchableOpacity
              key={label}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setTerm(value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Total cost breakdown */}
      <View style={styles.breakdownCard}>
        <Text style={styles.breakdownTitle}>Итог за весь срок</Text>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Стоимость квартиры</Text>
          <Text style={styles.breakdownValue}>{formatCurrency(totalPrice)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Первоначальный взнос</Text>
          <Text style={styles.breakdownValue}>{formatCurrency(totalPrice * downPayment)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Тело кредита</Text>
          <Text style={styles.breakdownValue}>{formatCurrency(result.loanAmount)}</Text>
        </View>
        <View style={[styles.breakdownRow, styles.breakdownRowLast]}>
          <Text style={styles.breakdownLabelBold}>Переплата по процентам</Text>
          <Text style={styles.breakdownValueRed}>{formatCurrency(result.overpayment)}</Text>
        </View>
        <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 12, marginTop: 4 }]}>
          <Text style={styles.breakdownLabelBold}>Итого выплатите</Text>
          <Text style={styles.breakdownValueBold}>{formatCurrency(result.totalCost)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 8 },
  heroCard: {
    borderRadius: 24,
    padding: 22,
    marginBottom: 12,
  },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  heroValue: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 6 },
  heroRow: { flexDirection: 'row', marginTop: 18 },
  heroStat: { flex: 1 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 14 },
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  heroStatValue: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 4 },
  incomeCard: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  incomeLabel: { fontSize: 12, color: theme.colors.textMuted },
  incomeValue: { fontSize: 22, fontWeight: '800', color: theme.colors.primary, marginTop: 4 },
  incomeHint: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 10,
    marginTop: 6,
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 8,
  },
  bankRowActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  bankLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  bankRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankRadioActive: { borderColor: theme.colors.primary },
  bankRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  bankName: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  bankNameActive: { color: theme.colors.primary },
  bankNote: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  bankRate: { fontSize: 20, fontWeight: '800', color: theme.colors.textSecondary },
  bankRateActive: { color: theme.colors.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
  },
  chipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  chipText: { fontSize: 14, fontWeight: '700', color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.primary },
  chipSub: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  breakdownCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 20,
    padding: 16,
    marginTop: 6,
  },
  breakdownTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginBottom: 14 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  breakdownRowLast: { marginBottom: 0 },
  breakdownLabel: { fontSize: 13, color: theme.colors.textSecondary },
  breakdownLabelBold: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  breakdownValue: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  breakdownValueRed: { fontSize: 13, fontWeight: '700', color: theme.colors.red },
  breakdownValueBold: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
});
