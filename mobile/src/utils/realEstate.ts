import { theme } from '../theme';
import type { BuyerProfile, ComplexItem, ConstructionStage, InfrastructureItem, ScoreTone } from '../api';

const numberFormatter = new Intl.NumberFormat('ru-RU');

// ─── Labels & meta ───────────────────────────────────────────────────────────

export const profileMeta: Record<BuyerProfile, { label: string; shortLabel: string; description: string }> = {
  investor: { label: 'Инвестор', shortLabel: 'INV', description: 'Рост, ликвидность и аренда' },
  family:   { label: 'Семья',    shortLabel: 'FAM', description: 'Школы, тишина и готовность' },
  student:  { label: 'Студент',  shortLabel: 'STD', description: 'Низкий вход и мобильность' },
  flipper:  { label: 'Флиппер',  shortLabel: 'FLP', description: 'Стадия + дисконт + маржа' },
};

export const formatCurrency    = (v: number) => `${numberFormatter.format(Math.round(v))} ₸`;
export const formatPricePerSqm = (v: number) => `${numberFormatter.format(Math.round(v))} ₸/м²`;
export const formatMonthly     = (v: number) => `${numberFormatter.format(Math.round(v))} ₸/мес`;
export const formatDistance    = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)} км` : `${Math.round(v)} м`;
export const formatPercent     = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

export const getStageLabel = (stage: ConstructionStage) => {
  switch (stage) {
    case 'commissioned':    return 'Сдан';
    case 'under_construction': return 'Строится';
    case 'foundation':      return 'Котлован';
    case 'planned':         return 'Проект';
    default:                return 'Статус';
  }
};

export const getStagePalette = (stage: ConstructionStage) => {
  switch (stage) {
    case 'commissioned':    return { bg: theme.colors.greenBg,  text: theme.colors.green };
    case 'under_construction': return { bg: theme.colors.primarySoft, text: theme.colors.primary };
    case 'foundation':      return { bg: theme.colors.yellowBg, text: theme.colors.yellow };
    case 'planned':         return { bg: theme.colors.surfaceMuted, text: theme.colors.textSecondary };
    default:                return { bg: theme.colors.surfaceMuted, text: theme.colors.textSecondary };
  }
};

export const getScorePalette = (score: ScoreTone) => {
  switch (score) {
    case 'green':  return { bg: theme.colors.greenBg,  text: theme.colors.green };
    case 'yellow': return { bg: theme.colors.yellowBg, text: theme.colors.yellow };
    case 'red':    return { bg: theme.colors.redBg,    text: theme.colors.red };
    default:       return { bg: theme.colors.surfaceMuted, text: theme.colors.textSecondary };
  }
};

export const getScoreLabel = (score: ScoreTone) => {
  switch (score) {
    case 'green':  return 'Сильный';
    case 'yellow': return 'Средний';
    case 'red':    return 'Слабый';
    default:       return 'Оценка';
  }
};

// ─── Price growth ─────────────────────────────────────────────────────────────

export function calcPriceGrowth(snapshots: Array<{ price_avg: number; recorded_at: string }>) {
  if (snapshots.length < 2) return 0;
  const first = snapshots[0].price_avg;
  const last  = snapshots[snapshots.length - 1].price_avg;
  return ((last - first) / first) * 100;
}

export function calcMonthlyGrowth(snapshots: Array<{ price_avg: number; recorded_at: string }>) {
  if (snapshots.length < 2) return 0;
  const months = snapshots.length - 1;
  return calcPriceGrowth(snapshots) / months;
}

// ─── Score breakdown ──────────────────────────────────────────────────────────

export interface ScoreCriterion {
  label: string;
  value: string;
  points: number;
  maxPoints: number;
  tone: ScoreTone;
}

export interface ScoreBreakdown {
  profile: BuyerProfile;
  totalScore: number;       // 0–100
  scoreValue: number;       // 0–10
  tone: ScoreTone;
  criteria: ScoreCriterion[];
  verdict: string;
}

function toneFromRatio(ratio: number): ScoreTone {
  if (ratio >= 0.65) return 'green';
  if (ratio >= 0.40) return 'yellow';
  return 'red';
}

function nearestInfra(infra: InfrastructureItem[], types: string[]) {
  const items = infra.filter((i) => types.includes(i.type));
  if (items.length === 0) return Infinity;
  return Math.min(...items.map((i) => i.distance_meters));
}

export function calcScoreBreakdown(complex: ComplexItem, profile: BuyerProfile): ScoreBreakdown {
  const growth = calcPriceGrowth(complex.price_snapshots);
  const criteria: ScoreCriterion[] = [];
  let total = 0;
  let maxTotal = 0;

  if (profile === 'investor') {
    // 1. Price growth (50 pts)
    const growthPts = growth >= 12 ? 50 : growth >= 8 ? 38 : growth >= 5 ? 26 : growth >= 2 ? 14 : 5;
    criteria.push({ label: 'Рост цены (6 мес)', value: `${formatPercent(growth)}`, points: growthPts, maxPoints: 50, tone: toneFromRatio(growthPts / 50) });

    // 2. Stage (30 pts) — foundation is best for investor
    const stagePts = complex.construction_stage === 'foundation' ? 30
      : complex.construction_stage === 'under_construction' ? 22
      : complex.construction_stage === 'commissioned' ? 14 : 8;
    const stageInvLabel = complex.construction_stage === 'foundation' ? 'Максимальный апсайд'
      : complex.construction_stage === 'under_construction' ? 'Хороший потенциал'
      : 'Стабильный актив';
    criteria.push({ label: 'Стадия стройки', value: stageInvLabel, points: stagePts, maxPoints: 30, tone: toneFromRatio(stagePts / 30) });

    // 3. Location prestige (20 pts)
    const locPts = ['Есиль', 'Есильский'].includes(complex.district) ? 20 : ['Алматы', 'Алматинский', 'Нура'].includes(complex.district) ? 16 : 10;
    criteria.push({ label: 'Локация', value: complex.district, points: locPts, maxPoints: 20, tone: toneFromRatio(locPts / 20) });

    total = growthPts + stagePts + locPts;
    maxTotal = 100;

    const scoreValue = total / 10;
    const tone = toneFromRatio(total / maxTotal);
    const verdict = tone === 'green'
      ? `Сильная инвестиционная позиция. Рост ${formatPercent(growth)} за полгода говорит о живом спросе.`
      : tone === 'yellow'
      ? `Умеренный потенциал. Рост есть, но не выдающийся — смотрите на стадию и локацию.`
      : `Слабый инвестиционный кейс. Рост цены не покрывает инфляцию.`;
    return { profile, totalScore: total, scoreValue: Math.min(10, scoreValue), tone, criteria, verdict };
  }

  if (profile === 'family') {
    // 1. Stage readiness (40 pts)
    const stagePts = complex.construction_stage === 'commissioned' ? 40
      : complex.construction_stage === 'under_construction' ? 20
      : complex.construction_stage === 'foundation' ? 8 : 4;
    const stageLabel = complex.construction_stage === 'commissioned' ? 'Готов к заселению'
      : complex.construction_stage === 'under_construction' ? 'Строится'
      : 'Ранняя стадия';
    criteria.push({ label: 'Готовность', value: stageLabel, points: stagePts, maxPoints: 40, tone: toneFromRatio(stagePts / 40) });

    // 2. School proximity (30 pts)
    const schoolDist = nearestInfra(complex.infrastructure, ['school', 'kindergarten']);
    const schoolPts = schoolDist <= 500 ? 30 : schoolDist <= 1000 ? 20 : schoolDist <= 1500 ? 10 : 4;
    const schoolLabel = schoolDist === Infinity ? 'Нет данных' : formatDistance(schoolDist);
    criteria.push({ label: 'Школа / сад', value: schoolLabel, points: schoolPts, maxPoints: 30, tone: toneFromRatio(schoolPts / 30) });

    // 3. Park / green zone (20 pts)
    const parkDist = nearestInfra(complex.infrastructure, ['park']);
    const parkPts = parkDist <= 400 ? 20 : parkDist <= 800 ? 14 : parkDist <= 1200 ? 8 : 3;
    const parkLabel = parkDist === Infinity ? 'Нет данных' : formatDistance(parkDist);
    criteria.push({ label: 'Парк / зелень', value: parkLabel, points: parkPts, maxPoints: 20, tone: toneFromRatio(parkPts / 20) });

    // 4. Price affordability (10 pts)
    const pricePts = complex.price_avg <= 500000 ? 10 : complex.price_avg <= 700000 ? 7 : 3;
    criteria.push({ label: 'Доступность цены', value: formatPricePerSqm(complex.price_avg), points: pricePts, maxPoints: 10, tone: toneFromRatio(pricePts / 10) });

    total = stagePts + schoolPts + parkPts + pricePts;
    maxTotal = 100;
    const scoreValue = total / 10;
    const tone = toneFromRatio(total / maxTotal);
    const verdict = tone === 'green'
      ? `Отличный семейный вариант. Инфраструктура готова, школы рядом.`
      : tone === 'yellow'
      ? `Рабочий вариант для семьи, но есть компромиссы — обычно это стадия или удалённость от школ.`
      : `Семейный сценарий ограничен. Либо проект ещё не сдан, либо нет нужной инфраструктуры.`;
    return { profile, totalScore: total, scoreValue: Math.min(10, scoreValue), tone, criteria, verdict };
  }

  if (profile === 'flipper') {
    const growth = calcPriceGrowth(complex.price_snapshots);

    // 1. Stage potential (35 pts) — earlier stage = more upside
    const stagePts = complex.construction_stage === 'foundation' ? 35
      : complex.construction_stage === 'under_construction' ? 25 : 8;
    const stageFlipLabel = complex.construction_stage === 'foundation' ? 'Максимальный апсайд котлована'
      : complex.construction_stage === 'under_construction' ? 'Строится — хороший потенциал'
      : 'Сдан — только ремонт-флип';
    criteria.push({ label: 'Стадия', value: stageFlipLabel, points: stagePts, maxPoints: 35, tone: toneFromRatio(stagePts / 35) });

    // 2. Price momentum (25 pts)
    const momentumPts = growth >= 14 ? 25 : growth >= 10 ? 20 : growth >= 7 ? 14 : growth >= 4 ? 8 : 3;
    criteria.push({ label: 'Ценовой импульс', value: formatPercent(growth), points: momentumPts, maxPoints: 25, tone: toneFromRatio(momentumPts / 25) });

    // 3. Price discount vs district average (20 pts)
    const districtAvg: Record<string, number> = {
      'Есиль': 630000, 'Есильский': 654000,
      'Алматы': 810000, 'Алматинский': 501000,
      'Нура': 541000,
      'Сарыарка': 370000,
    };
    const avgPrice = districtAvg[complex.district] ?? 500000;
    const discountPct = (avgPrice - complex.price_avg) / avgPrice * 100;
    const discountPts = discountPct >= 20 ? 20 : discountPct >= 10 ? 14 : discountPct >= 5 ? 8 : 3;
    const discountLabel = discountPct > 0
      ? `Дисконт ${discountPct.toFixed(0)}% к ср. по району`
      : `Наценка ${Math.abs(discountPct).toFixed(0)}% к ср. по району`;
    criteria.push({ label: 'Цена vs район', value: discountLabel, points: discountPts, maxPoints: 20, tone: toneFromRatio(discountPts / 20) });

    // 4. Exit liquidity (20 pts) — district + stage combo
    const isEsil = ['Есиль', 'Есильский'].includes(complex.district);
    const isMid  = ['Алматы', 'Алматинский', 'Нура'].includes(complex.district);
    let liquidityPts: number;
    if (complex.construction_stage === 'commissioned') {
      liquidityPts = isEsil ? 18 : isMid ? 15 : 8;
    } else if (complex.construction_stage === 'under_construction') {
      liquidityPts = isEsil ? 16 : isMid ? 13 : 12;
    } else {
      liquidityPts = isEsil ? 14 : 8;
    }
    const liquidityLabel = liquidityPts >= 16 ? 'Высокая' : liquidityPts >= 12 ? 'Средняя' : 'Низкая';
    criteria.push({ label: 'Ликвидность выхода', value: liquidityLabel, points: liquidityPts, maxPoints: 20, tone: toneFromRatio(liquidityPts / 20) });

    total = stagePts + momentumPts + discountPts + liquidityPts;
    maxTotal = 100;
    const scoreValue = total / 10;
    const tone = toneFromRatio(total / maxTotal);
    const verdict = tone === 'green'
      ? `Сильная флиппер-позиция. Ранняя стадия + дисконт = максимальный апсайд до сдачи.`
      : tone === 'yellow'
      ? `Умеренный потенциал. Стадия или цена ограничивают флиппер-маржу.`
      : `Слабый флиппер-кейс. Цена выше рынка или объект уже сдан без дисконта.`;
    return { profile, totalScore: total, scoreValue: Math.min(10, scoreValue), tone, criteria, verdict };
  }

  // student
  // 1. Price per sqm (40 pts)
  const pricePts = complex.price_avg <= 380000 ? 40 : complex.price_avg <= 450000 ? 30
    : complex.price_avg <= 550000 ? 18 : complex.price_avg <= 680000 ? 8 : 2;
  criteria.push({ label: 'Цена входа', value: formatPricePerSqm(complex.price_avg), points: pricePts, maxPoints: 40, tone: toneFromRatio(pricePts / 40) });

  // 2. Transport proximity (35 pts)
  const transDist = nearestInfra(complex.infrastructure, ['bus_stop', 'metro']);
  const transPts = transDist <= 200 ? 35 : transDist <= 400 ? 25 : transDist <= 700 ? 14 : 5;
  const transLabel = transDist === Infinity ? 'Нет данных' : formatDistance(transDist);
  criteria.push({ label: 'Транспорт', value: transLabel, points: transPts, maxPoints: 35, tone: toneFromRatio(transPts / 35) });

  // 3. Stage (25 pts) — commissioned preferred (can rent now)
  const stagePts = complex.construction_stage === 'commissioned' ? 25
    : complex.construction_stage === 'under_construction' ? 14 : 5;
  const stageLabel = complex.construction_stage === 'commissioned' ? 'Готов — можно заехать'
    : complex.construction_stage === 'under_construction' ? 'Строится'
    : 'Ранняя стадия';
  criteria.push({ label: 'Готовность', value: stageLabel, points: stagePts, maxPoints: 25, tone: toneFromRatio(stagePts / 25) });

  total = pricePts + transPts + stagePts;
  maxTotal = 100;
  const scoreValue = total / 10;
  const tone = toneFromRatio(total / maxTotal);
  const verdict = tone === 'green'
    ? `Хороший выбор для первой покупки. Доступная цена и удобный транспорт.`
    : tone === 'yellow'
    ? `Рабочий вариант, но придётся идти на компромисс — цена или транспорт.`
    : `Сложно вписать в студенческий бюджет. Цена или недоступность транспорта ограничивают.`;
  return { profile, totalScore: total, scoreValue: Math.min(10, scoreValue), tone, criteria, verdict };
}

// ─── Mortgage calculator ──────────────────────────────────────────────────────

export interface MortgageBank {
  id: string;
  name: string;
  rate: number;       // % годовых
  note: string;
}

export const MORTGAGE_BANKS: MortgageBank[] = [
  { id: 'otbasy', name: 'Отбасы банк',  rate: 5.0,  note: 'Льготная программа, нужны накопления' },
  { id: 'bcc',    name: 'БЦК',          rate: 13.5, note: 'Стандартная ипотека' },
  { id: 'halyk',  name: 'Халык банк',   rate: 14.5, note: 'Первичный и вторичный рынок' },
  { id: 'kaspi',  name: 'Каспи банк',   rate: 16.0, note: 'Без первоначального взноса (от 30%)' },
];

export interface MortgageResult {
  loanAmount: number;
  monthlyPayment: number;
  totalCost: number;
  overpayment: number;
  minMonthlyIncome: number;
}

export function calcMortgage(
  pricePerSqm: number,
  areaSqm: number,
  downPaymentPct: number,  // 0–1
  annualRatePct: number,
  termYears: number,
): MortgageResult {
  const totalPrice  = pricePerSqm * areaSqm;
  const loanAmount  = totalPrice * (1 - downPaymentPct);
  const r           = annualRatePct / 100 / 12;
  const n           = termYears * 12;

  let monthlyPayment: number;
  if (r === 0) {
    monthlyPayment = loanAmount / n;
  } else {
    monthlyPayment = (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  const totalCost      = monthlyPayment * n + totalPrice * downPaymentPct;
  const overpayment    = totalCost - totalPrice;
  const minMonthlyIncome = monthlyPayment * 2; // bank typically requires payment < 50% of income

  return { loanAmount, monthlyPayment, totalCost, overpayment, minMonthlyIncome };
}
