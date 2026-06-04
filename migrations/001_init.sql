-- ============================================================
-- Astana ZhK Analyzer — Initial Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Жилые комплексы
CREATE TABLE complexes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    developer       VARCHAR(255),
    address         VARCHAR(500),
    district        VARCHAR(100),
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    construction_stage VARCHAR(50),   -- 'commissioned', 'under_construction', 'foundation', 'planned'
    completion_date DATE,
    krisha_id       VARCHAR(100) UNIQUE,  -- внешний ID с krisha.kz
    krisha_url      TEXT,
    total_floors    INTEGER,
    total_apartments INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Снимки цен (история)
CREATE TABLE price_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complex_id      UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
    price_min       DECIMAL(15, 2),   -- минимальная цена за м² в тенге
    price_max       DECIMAL(15, 2),   -- максимальная цена за м² в тенге
    price_avg       DECIMAL(15, 2),   -- средняя цена за м² в тенге
    total_area_min  DECIMAL(8, 2),    -- минимальная площадь квартиры
    total_area_max  DECIMAL(8, 2),
    listings_count  INTEGER,          -- кол-во активных объявлений
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Инфраструктура (данные из 2ГИС)
CREATE TABLE infrastructure (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complex_id      UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,  -- 'school', 'kindergarten', 'grocery', 'metro', 'bus_stop', 'hospital', 'park'
    name            VARCHAR(255),
    distance_meters INTEGER,
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    fetched_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Кэш скоринга
CREATE TABLE scoring_cache (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complex_id      UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
    profile         VARCHAR(50) NOT NULL,  -- 'investor', 'family', 'student'
    score           VARCHAR(10) NOT NULL,  -- 'green', 'yellow', 'red'
    score_value     DECIMAL(4, 2),         -- числовой скор 0–10
    explanation     TEXT,
    ai_summary      TEXT,                  -- Claude AI абзац (только для profile='all')
    computed_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (complex_id, profile)
);

-- Индексы
CREATE INDEX idx_complexes_district ON complexes(district);
CREATE INDEX idx_complexes_stage ON complexes(construction_stage);
CREATE INDEX idx_price_snapshots_complex ON price_snapshots(complex_id);
CREATE INDEX idx_price_snapshots_recorded ON price_snapshots(recorded_at DESC);
CREATE INDEX idx_infrastructure_complex ON infrastructure(complex_id);
CREATE INDEX idx_infrastructure_type ON infrastructure(type);
CREATE INDEX idx_scoring_complex_profile ON scoring_cache(complex_id, profile);

-- Функция автообновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_complexes_updated_at
    BEFORE UPDATE ON complexes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
