export type ScoreTone = 'green' | 'yellow' | 'red';
export type BuyerProfile = 'investor' | 'family' | 'student' | 'flipper';
export type ConstructionStage =
  | 'commissioned'
  | 'under_construction'
  | 'foundation'
  | 'planned';

export interface ScoreEntry {
  profile: BuyerProfile;
  score: ScoreTone;
  score_value: number;
  explanation: string;
  confidence?: number;
  top_reason?: string;
  risk_flag?: string;
  breakdown?: Record<string, number>;
}

export interface ScoringFactor {
  key: string;
  label: string;
  weight: number;
  weight_pct: string;
  how: string;
  good: string;
  bad: string;
}

export interface ScoringProfile {
  label: string;
  description: string;
  factors: ScoringFactor[];
}

export interface ScoringInfo {
  version: string;
  how_it_works: string;
  confidence_note: string;
  profiles: Record<BuyerProfile, ScoringProfile>;
}

export interface InfrastructureItem {
  type: string;
  name: string;
  distance_meters: number;
}

export interface ComplexItem {
  id: string;
  name: string;
  district: string;
  developer: string;
  address: string;
  price_avg: number;
  construction_stage: ConstructionStage;
  investor_score: ScoreTone;
  family_score: ScoreTone;
  student_score: ScoreTone;
  flipper_score: ScoreTone;
  image: string;
  gallery: string[];
  rating: number;
  review_count: number;
  price_monthly: number;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number;
  tagline: string;
  description: string;
  move_in: string;
  agent: { name: string; role: string; avatar: string };
  price_snapshots: Array<{ price_avg: number; recorded_at: string }>;
  scores: ScoreEntry[];
  ai_summary: string;
  infrastructure: InfrastructureItem[];
  krisha_url: string;
  coordinates: { lat: number; lng: number };
}

export interface Notification {
  id: string;
  complexId: string;
  complexName: string;
  message: string;
  delta: number;
  timestamp: string;
}

// API server run with: uvicorn scraper.api:app --port 8001
// On Android emulator use 10.0.2.2 instead of localhost
export const API_BASE = 'http://localhost:8001';

const mockComplexes: ComplexItem[] = [
  {
    id: '1',
    name: 'Expo Residence',
    district: 'Есиль',
    developer: 'BI Group',
    address: 'пр. Кабанбай батыра, 60',
    price_avg: 490000,
    construction_stage: 'commissioned',
    investor_score: 'green',
    family_score: 'yellow',
    student_score: 'yellow',
    flipper_score: 'yellow',
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=1000&q=80',
    ],
    rating: 4.7,
    review_count: 312,
    price_monthly: 198000,
    bedrooms: 2,
    bathrooms: 1,
    area_sqm: 72,
    tagline: 'Ликвидная позиция в EXPO-кластере',
    description: 'Квартал из 42 домов вблизи EXPO-2017. Активный спрос на аренду от сотрудников министерств и международных организаций. Квартиры 41–124 м².',
    move_in: 'Сдан',
    agent: { name: 'Aizat N.', role: 'BI Group Sales', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80' },
    price_snapshots: [
      { price_avg: 452000, recorded_at: '2024-01-01' },
      { price_avg: 462000, recorded_at: '2024-02-01' },
      { price_avg: 470000, recorded_at: '2024-03-01' },
      { price_avg: 478000, recorded_at: '2024-04-01' },
      { price_avg: 485000, recorded_at: '2024-05-01' },
      { price_avg: 490000, recorded_at: '2024-06-01' },
    ],
    scores: [
      { profile: 'investor', score: 'green', score_value: 8.2, explanation: 'Стабильный рост +8% за полгода. Высокий спрос на аренду от EXPO-кластера.' },
      { profile: 'family', score: 'yellow', score_value: 6.8, explanation: 'Инфраструктура района развивается. Школы в 1–1.5 км.' },
      { profile: 'student', score: 'yellow', score_value: 6.1, explanation: 'Умеренный чек входа, хорошая транспортная связь с центром.' },
    ],
    ai_summary: 'Expo Residence устойчиво растёт за счёт аренды: EXPO-кластер даёт постоянный поток арендаторов с хорошим доходом. Для семьи район ещё формируется, но цена уже справедливая.',
    infrastructure: [
      { type: 'bus_stop', name: 'Остановка EXPO', distance_meters: 180 },
      { type: 'grocery', name: 'Magnum Cash&Carry', distance_meters: 420 },
      { type: 'school', name: 'НИШ Астана', distance_meters: 1100 },
      { type: 'park', name: 'Парк EXPO', distance_meters: 650 },
    ],
    krisha_url: 'https://krisha.kz/prodazha/kvartiry/astana/?das[who]=1&das[live.complexId]=expo-residence',
    coordinates: { lat: 51.0896, lng: 71.4071 },
  },
  {
    id: '2',
    name: 'Expo-городок',
    district: 'Есиль',
    developer: 'BAZIS-A',
    address: 'пр. Кабанбай батыра / ул. Хусейна бен Талала',
    price_avg: 620000,
    construction_stage: 'commissioned',
    investor_score: 'yellow',
    family_score: 'green',
    student_score: 'red',
    flipper_score: 'yellow',
    image: 'https://images.unsplash.com/photo-1580041065738-e72023775cdc?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1580041065738-e72023775cdc?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1000&q=80',
    ],
    rating: 4.8,
    review_count: 218,
    price_monthly: 248000,
    bedrooms: 3,
    bathrooms: 2,
    area_sqm: 109,
    tagline: 'Готовая семейная среда на EXPO',
    description: 'Сданный комплекс BAZIS-A прямо на территории бывшей EXPO. Чистовая отделка, 4-комнатные квартиры 109–124 м², прогулочные аллеи внутри двора.',
    move_in: 'Сдан',
    agent: { name: 'Dinara B.', role: 'BAZIS-A Official', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80' },
    price_snapshots: [
      { price_avg: 570000, recorded_at: '2024-01-01' },
      { price_avg: 578000, recorded_at: '2024-02-01' },
      { price_avg: 585000, recorded_at: '2024-03-01' },
      { price_avg: 594000, recorded_at: '2024-04-01' },
      { price_avg: 606000, recorded_at: '2024-05-01' },
      { price_avg: 620000, recorded_at: '2024-06-01' },
    ],
    scores: [
      { profile: 'investor', score: 'yellow', score_value: 6.5, explanation: 'Рост умеренный — 8.7% за полгода. Высокий порог входа ограничивает ликвидность.' },
      { profile: 'family', score: 'green', score_value: 8.9, explanation: 'Сдан, просторные квартиры, закрытый двор и прогулочные аллеи.' },
      { profile: 'student', score: 'red', score_value: 3.8, explanation: 'Цена от 620 000 ₸/м² недоступна для студенческого бюджета.' },
    ],
    ai_summary: 'Expo-городок — лучший выбор для семьи, которая хочет готовую среду без компромиссов. Для инвестора апсайд уже частично реализован, но аренда крупногабаритных квартир даёт стабильный доход.',
    infrastructure: [
      { type: 'park', name: 'Парк ЭКСПО', distance_meters: 220 },
      { type: 'grocery', name: 'Small', distance_meters: 340 },
      { type: 'school', name: 'Частная школа Тілдар', distance_meters: 780 },
      { type: 'bus_stop', name: 'Остановка Хусейна бен Талала', distance_meters: 150 },
    ],
    krisha_url: 'https://krisha.kz/complex/show/expo-gorodok/',
    coordinates: { lat: 51.0921, lng: 71.3985 },
  },
  {
    id: '3',
    name: 'Esil Riverside',
    district: 'Есиль',
    developer: 'BI Group',
    address: 'ул. Наркескен, 1, мкр. Шубар',
    price_avg: 780000,
    construction_stage: 'commissioned',
    investor_score: 'yellow',
    family_score: 'green',
    student_score: 'red',
    flipper_score: 'yellow',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1000&q=80',
    ],
    rating: 4.9,
    review_count: 187,
    price_monthly: 310000,
    bedrooms: 3,
    bathrooms: 2,
    area_sqm: 115,
    tagline: 'Панорамы реки и Центрального парка',
    description: 'Премиальный комплекс на берегу Есиля в мкр. Шубар. 332 квартиры 43–188 м². Из окон — река и парк. Один из самых желанных адресов Левобережья.',
    move_in: 'Сдан',
    agent: { name: 'Arman K.', role: 'Premium Broker', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80' },
    price_snapshots: [
      { price_avg: 720000, recorded_at: '2024-01-01' },
      { price_avg: 730000, recorded_at: '2024-02-01' },
      { price_avg: 742000, recorded_at: '2024-03-01' },
      { price_avg: 754000, recorded_at: '2024-04-01' },
      { price_avg: 766000, recorded_at: '2024-05-01' },
      { price_avg: 780000, recorded_at: '2024-06-01' },
    ],
    scores: [
      { profile: 'investor', score: 'yellow', score_value: 7.1, explanation: 'Стабильный рост +8.3%, высокий спрос на аренду в премиум-сегменте.' },
      { profile: 'family', score: 'green', score_value: 9.2, explanation: 'Речная набережная, Центральный парк в шаговой доступности. Одна из лучших локаций.' },
      { profile: 'student', score: 'red', score_value: 3.1, explanation: 'Порог входа слишком высок — минимальная квартира от 33 млн ₸.' },
    ],
    ai_summary: 'Esil Riverside — адрес для тех, кто не хочет компромиссов. Набережная, парк и престижный район дают высокое качество жизни. Инвестиционный потенциал ограничен высокой ценой, но ликвидность сильная.',
    infrastructure: [
      { type: 'park', name: 'Центральный парк', distance_meters: 320 },
      { type: 'school', name: 'Haileybury Astana', distance_meters: 680 },
      { type: 'grocery', name: 'Galmart', distance_meters: 540 },
      { type: 'bus_stop', name: 'Остановка Наркескен', distance_meters: 210 },
    ],
    krisha_url: 'https://krisha.kz/prodazha/kvartiry/astana/?das[live.complexId]=esil-riverside',
    coordinates: { lat: 51.1435, lng: 71.4650 },
  },
  {
    id: '4',
    name: 'Ботанический',
    district: 'Есиль',
    developer: 'BI Group',
    address: 'ул. Бухар Жырау, 34',
    price_avg: 740000,
    construction_stage: 'commissioned',
    investor_score: 'yellow',
    family_score: 'green',
    student_score: 'red',
    flipper_score: 'red',
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80',
    ],
    rating: 4.8,
    review_count: 143,
    price_monthly: 295000,
    bedrooms: 2,
    bathrooms: 2,
    area_sqm: 98,
    tagline: 'Стиль 1920-х в 100 метрах от Ботсада',
    description: 'Пятисекционный дом 12–20 этажей в американском ар-деко стиле. Двор закрытый, консьерж, спа. В 100 метрах — Ботанический сад. Один из самых узнаваемых домов Астаны.',
    move_in: 'Сдан',
    agent: { name: 'Dana T.', role: 'BI Group Elite', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80' },
    price_snapshots: [
      { price_avg: 695000, recorded_at: '2024-01-01' },
      { price_avg: 705000, recorded_at: '2024-02-01' },
      { price_avg: 712000, recorded_at: '2024-03-01' },
      { price_avg: 720000, recorded_at: '2024-04-01' },
      { price_avg: 730000, recorded_at: '2024-05-01' },
      { price_avg: 740000, recorded_at: '2024-06-01' },
    ],
    scores: [
      { profile: 'investor', score: 'yellow', score_value: 6.8, explanation: 'Рост +6.5% за полгода. Уникальный проект с ограниченным предложением.' },
      { profile: 'family', score: 'green', score_value: 9.0, explanation: 'Ботсад рядом, тихий двор, высокий уровень безопасности и сервиса.' },
      { profile: 'student', score: 'red', score_value: 2.9, explanation: 'Входной чек от 72 млн ₸ делает проект недоступным.' },
    ],
    ai_summary: 'Ботанический — штучный продукт с харизмой и репутацией. Его выбирают за образ жизни, а не за инвестиционный расчёт. Цена продолжит расти, но медленнее, чем у строящихся проектов.',
    infrastructure: [
      { type: 'park', name: 'Ботанический сад', distance_meters: 100 },
      { type: 'school', name: 'Школа-лицей №55', distance_meters: 430 },
      { type: 'grocery', name: 'Galmart Бухар Жырау', distance_meters: 290 },
      { type: 'bus_stop', name: 'Остановка Бухар Жырау', distance_meters: 160 },
    ],
    krisha_url: 'https://krisha.kz/prodazha/kvartiry/astana/?das[live.complexId]=botanicheskiy',
    coordinates: { lat: 51.1274, lng: 71.4398 },
  },
  {
    id: '5',
    name: 'Akbulak Riviera',
    district: 'Алматы',
    developer: 'BI Group',
    address: 'ул. Амман, 19, мкр. Акбулак',
    price_avg: 850000,
    construction_stage: 'commissioned',
    investor_score: 'red',
    family_score: 'green',
    student_score: 'red',
    flipper_score: 'red',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=1000&q=80',
    ],
    rating: 4.9,
    review_count: 94,
    price_monthly: 340000,
    bedrooms: 4,
    bathrooms: 3,
    area_sqm: 145,
    tagline: 'Элитные виллы и таунхаусы на Есиле',
    description: 'Элитный ансамбль вилл, таунхаусов и малоэтажных домов на берегу реки. Теннисный корт, бассейн, фазанарий, 1000 крупномерных деревьев. Гейтед-коммьюнити для статусной аудитории.',
    move_in: 'Сдан',
    agent: { name: 'Madi B.', role: 'Elite Estates', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80' },
    price_snapshots: [
      { price_avg: 810000, recorded_at: '2024-01-01' },
      { price_avg: 818000, recorded_at: '2024-02-01' },
      { price_avg: 825000, recorded_at: '2024-03-01' },
      { price_avg: 833000, recorded_at: '2024-04-01' },
      { price_avg: 841000, recorded_at: '2024-05-01' },
      { price_avg: 850000, recorded_at: '2024-06-01' },
    ],
    scores: [
      { profile: 'investor', score: 'red', score_value: 4.5, explanation: 'Апсайд практически исчерпан. Рост +4.9% за полгода — ниже рынка.' },
      { profile: 'family', score: 'green', score_value: 9.4, explanation: 'Лучшая среда для семьи в Астане: природа, безопасность, полный сервис.' },
      { profile: 'student', score: 'red', score_value: 2.0, explanation: 'Стоимость виллы от 120 млн ₸ — недостижимо для данного профиля.' },
    ],
    ai_summary: 'Akbulak Riviera — вершина сегмента. Здесь покупают ради статуса и образа жизни, а не ради роста капитала. Семейный комфорт на высшем уровне, но инвестиционный потенциал минимален.',
    infrastructure: [
      { type: 'park', name: 'Набережная р. Есиль', distance_meters: 80 },
      { type: 'school', name: 'Частная школа Miras', distance_meters: 920 },
      { type: 'grocery', name: 'Metro Cash&Carry', distance_meters: 1100 },
      { type: 'bus_stop', name: 'Остановка Амман', distance_meters: 340 },
    ],
    krisha_url: 'https://krisha.kz/prodazha/kvartiry/astana/?das[live.complexId]=akbulak-riviera',
    coordinates: { lat: 51.1162, lng: 71.4780 },
  },
  {
    id: '6',
    name: 'Central Park',
    district: 'Есиль',
    developer: 'Sensata Group',
    address: 'пр. Туран, 5а',
    price_avg: 680000,
    construction_stage: 'commissioned',
    investor_score: 'yellow',
    family_score: 'green',
    student_score: 'red',
    flipper_score: 'yellow',
    image: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80',
    ],
    rating: 4.7,
    review_count: 276,
    price_monthly: 272000,
    bedrooms: 2,
    bathrooms: 2,
    area_sqm: 90,
    tagline: 'Панорамы парка, потолки 3 метра',
    description: 'Премиум-класс от Sensata Group, 5–14 этажей, 4 очереди, квартиры 63–220 м². Панорамные окна, потолки 3 м, в 300 метрах от набережной. Сильнейшее коммерческое окружение.',
    move_in: 'Сдан',
    agent: { name: 'Kamila S.', role: 'Sensata Official', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80' },
    price_snapshots: [
      { price_avg: 620000, recorded_at: '2024-01-01' },
      { price_avg: 634000, recorded_at: '2024-02-01' },
      { price_avg: 645000, recorded_at: '2024-03-01' },
      { price_avg: 655000, recorded_at: '2024-04-01' },
      { price_avg: 666000, recorded_at: '2024-05-01' },
      { price_avg: 680000, recorded_at: '2024-06-01' },
    ],
    scores: [
      { profile: 'investor', score: 'yellow', score_value: 7.3, explanation: 'Рост +9.7% за полгода. Хорошая центральная локация поддерживает спрос.' },
      { profile: 'family', score: 'green', score_value: 8.7, explanation: 'Парк, набережная, торговля — полноценная инфраструктура прямо рядом.' },
      { profile: 'student', score: 'red', score_value: 4.2, explanation: 'Высокая цена ограничивает доступность для молодого покупателя.' },
    ],
    ai_summary: 'Central Park — самый сбалансированный премиум в Астане. Сильная локация на Туран делает его ликвидным во всех сценариях. Хороший выбор для тех, кто хочет и жить комфортно, и сохранить капитал.',
    infrastructure: [
      { type: 'park', name: 'Набережная Есиль', distance_meters: 300 },
      { type: 'grocery', name: 'Magnum', distance_meters: 180 },
      { type: 'school', name: 'Школа-гимназия №74', distance_meters: 560 },
      { type: 'bus_stop', name: 'Остановка Туран', distance_meters: 120 },
    ],
    krisha_url: 'https://www.sensata.kz/project/central-park',
    coordinates: { lat: 51.1355, lng: 71.4230 },
  },
  {
    id: '7',
    name: 'Green House Premium',
    district: 'Есиль',
    developer: 'DM Invest Stroy',
    address: 'ул. Калдаякова, 32',
    price_avg: 425000,
    construction_stage: 'under_construction',
    investor_score: 'green',
    family_score: 'yellow',
    student_score: 'green',
    flipper_score: 'green',
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1000&q=80',
    ],
    rating: 4.4,
    review_count: 67,
    price_monthly: 172000,
    bedrooms: 2,
    bathrooms: 1,
    area_sqm: 74,
    tagline: 'Доступный вход, быстрый рост',
    description: 'Комфорт-класс 8–9 этажей с чистовой отделкой. Один из немногих строящихся проектов в Есиле с ценой ниже рынка. Ипотека Отбасы банка от 5%.',
    move_in: 'Q2 2026',
    agent: { name: 'Zhanar A.', role: 'DM Invest', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80' },
    price_snapshots: [
      { price_avg: 380000, recorded_at: '2024-01-01' },
      { price_avg: 390000, recorded_at: '2024-02-01' },
      { price_avg: 398000, recorded_at: '2024-03-01' },
      { price_avg: 408000, recorded_at: '2024-04-01' },
      { price_avg: 416000, recorded_at: '2024-05-01' },
      { price_avg: 425000, recorded_at: '2024-06-01' },
    ],
    scores: [
      { profile: 'investor', score: 'green', score_value: 8.7, explanation: 'Рост +11.8% за полгода при строящейся стадии. Хороший потенциал до сдачи.' },
      { profile: 'family', score: 'yellow', score_value: 5.9, explanation: 'До сдачи ещё год. После ввода район получит зрелую инфраструктуру.' },
      { profile: 'student', score: 'green', score_value: 7.8, explanation: 'Самый доступный вариант в Есиле с ипотекой под 5%.' },
    ],
    ai_summary: 'Green House Premium — лучшее соотношение цены и роста в нынешней подборке. Строящаяся стадия с ценой ниже рынка даёт инвестору до 15% апсайда к сдаче. Для студента — редкий шанс войти в Есиль дёшево.',
    infrastructure: [
      { type: 'bus_stop', name: 'Остановка Калдаякова', distance_meters: 200 },
      { type: 'grocery', name: 'Small', distance_meters: 380 },
      { type: 'school', name: 'Школа №62', distance_meters: 640 },
      { type: 'park', name: 'Городской парк Есиль', distance_meters: 820 },
    ],
    krisha_url: 'https://krisha.kz/prodazha/kvartiry/astana/?das[live.complexId]=green-house-premium',
    coordinates: { lat: 51.1480, lng: 71.4510 },
  },
  {
    id: '8',
    name: 'Riviera',
    district: 'Сарыарка',
    developer: 'Жануя Инвест',
    address: 'ул. Жумабека Ташенова, 8/1',
    price_avg: 360000,
    construction_stage: 'under_construction',
    investor_score: 'green',
    family_score: 'yellow',
    student_score: 'green',
    flipper_score: 'green',
    image: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80',
    ],
    rating: 4.3,
    review_count: 48,
    price_monthly: 146000,
    bedrooms: 2,
    bathrooms: 1,
    area_sqm: 68,
    tagline: 'Самый доступный вход на рынок',
    description: 'Строящийся комплекс в Сарыаркинском районе. 10 минут пешком до набережной. Квартиры 41–91 м², 1–3 комнаты. Ипотека Отбасы банка от 5%. Самые низкие цены в действующей подборке.',
    move_in: 'Q4 2026',
    agent: { name: 'Nursultan E.', role: 'Жануя Инвест', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80' },
    price_snapshots: [
      { price_avg: 310000, recorded_at: '2024-01-01' },
      { price_avg: 322000, recorded_at: '2024-02-01' },
      { price_avg: 333000, recorded_at: '2024-03-01' },
      { price_avg: 342000, recorded_at: '2024-04-01' },
      { price_avg: 352000, recorded_at: '2024-05-01' },
      { price_avg: 360000, recorded_at: '2024-06-01' },
    ],
    scores: [
      { profile: 'investor', score: 'green', score_value: 9.1, explanation: 'Рост +16.1% за полгода — лучший показатель в подборке. Ранняя стадия даёт максимальный апсайд.' },
      { profile: 'family', score: 'yellow', score_value: 5.2, explanation: 'Инфраструктура района развивается. До ввода ждать 1.5 года.' },
      { profile: 'student', score: 'green', score_value: 8.5, explanation: 'Самая низкая цена входа — от 14 млн ₸ за однушку с ипотекой Отбасы.' },
    ],
    ai_summary: 'Riviera — агрессивная инвестиционная ставка. Самый быстрый рост и самая низкая цена в подборке. Для студента идеальный первый шаг на рынок. Семейный сценарий откроется после сдачи в Q4 2026.',
    infrastructure: [
      { type: 'bus_stop', name: 'Остановка Ташенова', distance_meters: 260 },
      { type: 'grocery', name: 'Anvar', distance_meters: 480 },
      { type: 'school', name: 'Школа №51', distance_meters: 720 },
      { type: 'park', name: 'Набережная Есиль', distance_meters: 950 },
    ],
    krisha_url: 'https://krisha.kz/complex/show/nur-sultan/riviera/',
    coordinates: { lat: 51.1580, lng: 71.4920 },
  },
  {
    id: '9',
    name: 'Expo Avenue',
    district: 'Есиль',
    developer: 'TS Com',
    address: 'пр. Кабанбай батыра / ул. Рыскулова',
    price_avg: 540000,
    construction_stage: 'commissioned',
    investor_score: 'yellow',
    family_score: 'yellow',
    student_score: 'yellow',
    flipper_score: 'yellow',
    image: 'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80',
    ],
    rating: 4.5,
    review_count: 134,
    price_monthly: 217000,
    bedrooms: 2,
    bathrooms: 1,
    area_sqm: 80,
    tagline: 'Сбалансированный вариант на Кабанбай',
    description: '10–12-этажный сданный комплекс ~350 квартир 45–111 м². Удобная транспортная развязка на пересечении двух главных проспектов Левобережья. Подходит для любого профиля покупателя.',
    move_in: 'Сдан',
    agent: { name: 'Aslan M.', role: 'TS Com Sales', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80' },
    price_snapshots: [
      { price_avg: 502000, recorded_at: '2024-01-01' },
      { price_avg: 510000, recorded_at: '2024-02-01' },
      { price_avg: 516000, recorded_at: '2024-03-01' },
      { price_avg: 524000, recorded_at: '2024-04-01' },
      { price_avg: 532000, recorded_at: '2024-05-01' },
      { price_avg: 540000, recorded_at: '2024-06-01' },
    ],
    scores: [
      { profile: 'investor', score: 'yellow', score_value: 6.2, explanation: 'Умеренный рост +7.6%. Хорошая транспортная доступность поддерживает спрос.' },
      { profile: 'family', score: 'yellow', score_value: 6.4, explanation: 'Приличный район, но школы и парки на расстоянии 10+ минут.' },
      { profile: 'student', score: 'yellow', score_value: 6.3, explanation: 'Умеренная цена и удобные пересадки делают вариант рабочим.' },
    ],
    ai_summary: 'Expo Avenue — универсальный выбор без ярких плюсов и минусов. Хорошая транспортная связь и умеренная цена делают его надёжным вариантом для широкой аудитории.',
    infrastructure: [
      { type: 'bus_stop', name: 'Остановка Кабанбай / Рыскулова', distance_meters: 90 },
      { type: 'grocery', name: 'Small Кабанбай', distance_meters: 230 },
      { type: 'school', name: 'Школа-гимназия №60', distance_meters: 870 },
      { type: 'park', name: 'Сквер Молодёжный', distance_meters: 610 },
    ],
    krisha_url: 'https://www.kn.kz/zhilye-kompleksy/astana/expo-avenue',
    coordinates: { lat: 51.0950, lng: 71.4020 },
  },
  {
    id: '10',
    name: 'Sensata Park',
    district: 'Есиль',
    developer: 'Sensata Group',
    address: 'ул. Туран, 22',
    price_avg: 720000,
    construction_stage: 'under_construction',
    investor_score: 'green',
    family_score: 'yellow',
    student_score: 'red',
    flipper_score: 'green',
    image: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1000&q=80',
    ],
    rating: 4.8,
    review_count: 156,
    price_monthly: 288000,
    bedrooms: 3,
    bathrooms: 2,
    area_sqm: 96,
    tagline: 'Новый флагман Sensata в центре Есиля',
    description: 'Новый проект Sensata Group рядом с уже успешным Central Park. Бизнес-класс, закрытая территория, умный двор. Старт продаж прошёл успешно — раскуплено 60% квартир.',
    move_in: 'Q3 2026',
    agent: { name: 'Kamila S.', role: 'Sensata Official', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80' },
    price_snapshots: [
      { price_avg: 640000, recorded_at: '2024-01-01' },
      { price_avg: 656000, recorded_at: '2024-02-01' },
      { price_avg: 668000, recorded_at: '2024-03-01' },
      { price_avg: 681000, recorded_at: '2024-04-01' },
      { price_avg: 700000, recorded_at: '2024-05-01' },
      { price_avg: 720000, recorded_at: '2024-06-01' },
    ],
    scores: [
      { profile: 'investor', score: 'green', score_value: 8.4, explanation: 'Рост +12.5% за полгода. Бренд Sensata даёт надёжность и хорошую репутацию на рынке.' },
      { profile: 'family', score: 'yellow', score_value: 6.6, explanation: 'Строится. Готовая семейная среда появится после ввода в Q3 2026.' },
      { profile: 'student', score: 'red', score_value: 4.1, explanation: 'Высокий чек входа — от 69 млн ₸ за двушку.' },
    ],
    ai_summary: 'Sensata Park — сильная ставка на бренд и локацию. Рост 12.5% говорит о том, что рынок верит в проект. После сдачи Central Park и Sensata Park создадут самый насыщенный квартал бизнес-класса на Туран.',
    infrastructure: [
      { type: 'park', name: 'Набережная Есиль', distance_meters: 380 },
      { type: 'grocery', name: 'Magnum Туран', distance_meters: 210 },
      { type: 'school', name: 'Школа-гимназия №74', distance_meters: 490 },
      { type: 'bus_stop', name: 'Остановка Туран / 22', distance_meters: 140 },
    ],
    krisha_url: 'https://sensata.kz/project/sensata-park',
    coordinates: { lat: 51.1320, lng: 71.4195 },
  },
];

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    complexId: '8',
    complexName: 'Riviera',
    message: 'Цена выросла на 8 000 ₸/м² за последний месяц',
    delta: 8000,
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
  },
  {
    id: 'n2',
    complexId: '7',
    complexName: 'Green House Premium',
    message: 'Цена выросла на 9 000 ₸/м² — осталось 40% квартир',
    delta: 9000,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'n3',
    complexId: '10',
    complexName: 'Sensata Park',
    message: 'Раскуплено 60% — застройщик повысит цену в июле',
    delta: 20000,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
];

const scoreRank: Record<ScoreTone, number> = { green: 0, yellow: 1, red: 2 };

export const fetchComplexes = async (params: {
  profile?: BuyerProfile;
  limit?: number;
  stages?: ConstructionStage[];
  districts?: string[];
  minPrice?: number;
  maxPrice?: number;
} = {}): Promise<{ items: ComplexItem[]; total: number }> => {
  try {
    const qs = new URLSearchParams({ limit: '500' });
    if (params.minPrice) qs.set('min_price', String(params.minPrice));
    if (params.maxPrice) qs.set('max_price', String(params.maxPrice));

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${API_BASE}/api/v1/complexes?${qs}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { total: number; items: ComplexItem[] };

    let items = data.items;

    if (params.stages && params.stages.length > 0) {
      items = items.filter((c) => params.stages!.includes(c.construction_stage));
    }
    if (params.districts && params.districts.length > 0) {
      items = items.filter((c) => params.districts!.includes(c.district));
    }

    items.sort((a, b) => {
      if (!params.profile) return 0;
      const ra = scoreRank[a[`${params.profile}_score` as const]];
      const rb = scoreRank[b[`${params.profile}_score` as const]];
      if (ra !== rb) return ra - rb;
      return (b.price_avg ?? 0) - (a.price_avg ?? 0);
    });

    const visibleItems = typeof params.limit === 'number' ? items.slice(0, params.limit) : items;
    return { items: visibleItems, total: items.length };
  } catch {
    // Fallback to mock data when server is not reachable
    let items = [...mockComplexes];
    if (params.stages?.length) items = items.filter((c) => params.stages!.includes(c.construction_stage));
    if (params.districts?.length) items = items.filter((c) => params.districts!.includes(c.district));
    if (params.minPrice) items = items.filter((c) => c.price_avg >= params.minPrice!);
    if (params.maxPrice) items = items.filter((c) => c.price_avg <= params.maxPrice!);
    items.sort((a, b) => {
      if (!params.profile) return b.rating - a.rating;
      const ra = scoreRank[a[`${params.profile}_score` as const]];
      const rb = scoreRank[b[`${params.profile}_score` as const]];
      return ra !== rb ? ra - rb : b.rating - a.rating;
    });
    const visibleItems = typeof params.limit === 'number' ? items.slice(0, params.limit) : items;
    return { items: visibleItems, total: items.length };
  }
};

export const fetchComplexDetail = async (id: string): Promise<ComplexItem> => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${API_BASE}/api/v1/complexes/${id}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as ComplexItem;
  } catch {
    return mockComplexes.find((item) => item.id === id) ?? mockComplexes[0];
  }
};

let _scoringInfoCache: ScoringInfo | null = null;

export const fetchScoringInfo = async (): Promise<ScoringInfo | null> => {
  if (_scoringInfoCache) return _scoringInfoCache;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${API_BASE}/api/v1/scoring-info`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    _scoringInfoCache = await res.json() as ScoringInfo;
    return _scoringInfoCache;
  } catch {
    return null;
  }
};

export const fetchCompare = async (ids: string[]): Promise<{ complexes: ComplexItem[] }> => {
  const complexes = await Promise.all(ids.map((id) => fetchComplexDetail(id)));
  return { complexes };
};

export const fetchAllComplexes = async (): Promise<ComplexItem[]> => {
  const { items } = await fetchComplexes({ limit: 500 });
  return items;
};
