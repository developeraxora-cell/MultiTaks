-- ============================================================================
--  Mentes Creadoras — Módulo Fitness / Nutrición IA
--  Ejecuta este archivo DESPUÉS de supabase/schema.sql en:
--    Supabase Dashboard > SQL Editor > New query
--
--  Mismo modelo que el resto del proyecto: auth propia (public.usuarios),
--  acceso solo server-side con la service_role key, SIN RLS. Todas las tablas
--  cuelgan del usuario vía user_id -> public.usuarios(id) on delete cascade.
-- ============================================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
--  Tabla: nutrition_profiles (1 fila por usuario — perfil nutricional)
--  El onboarding por pasos rellena estos campos. onboarding_completed marca si
--  el formulario inicial se terminó (controla el guard del módulo).
-- ----------------------------------------------------------------------------
create table if not exists public.nutrition_profiles (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references public.usuarios(id) on delete cascade,

  -- Paso 1: datos básicos
  age                  integer,
  sex                  text,                       -- 'masculino' | 'femenino' | 'otro'
  weight_kg            numeric(6,2),
  height_cm            numeric(6,2),
  country              text,
  meals_per_day        integer,
  meal_times           text,                       -- horarios habituales (texto libre)

  -- Paso 2: objetivo principal
  main_goal            text,                        -- 'bajar_grasa' | 'mantener' | 'ganar_musculo' | ...
  goal_description     text,

  -- Paso 3: actividad física
  activity_level       text,                        -- 'sedentario' | 'ligero' | 'moderado' | 'alto' | 'muy_alto'
  exercise_type        text,
  exercise_days_week   integer,
  exercise_minutes     integer,
  exercise_intensity   text,                        -- 'baja' | 'media' | 'alta'

  -- Paso 4: preferencias alimenticias
  favorite_foods       text,
  frequent_foods       text,
  disliked_foods       text,
  avoid_foods          text,
  food_style           text,                        -- 'casera' | 'economica' | 'alta_proteina' | ...

  -- Paso 5: restricciones / salud
  allergies            text,
  intolerances         text,
  dietary_restrictions text,
  health_notes         text,

  onboarding_completed boolean not null default false,
  onboarding_step      integer not null default 0,  -- último paso guardado (reanudar)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists nutrition_profiles_user_idx on public.nutrition_profiles (user_id);

-- Migración idempotente: agrega columnas faltantes si la tabla ya existía con
-- otro esquema (p.ej. creada por un SQL previo sin estos campos). Seguro de
-- re-ejecutar.
alter table public.nutrition_profiles add column if not exists age                  integer;
alter table public.nutrition_profiles add column if not exists sex                  text;
alter table public.nutrition_profiles add column if not exists weight_kg            numeric(6,2);
alter table public.nutrition_profiles add column if not exists height_cm            numeric(6,2);
alter table public.nutrition_profiles add column if not exists country              text;
alter table public.nutrition_profiles add column if not exists meals_per_day        integer;
alter table public.nutrition_profiles add column if not exists meal_times           text;
alter table public.nutrition_profiles add column if not exists main_goal            text;
alter table public.nutrition_profiles add column if not exists goal_description     text;
alter table public.nutrition_profiles add column if not exists activity_level       text;
alter table public.nutrition_profiles add column if not exists exercise_type        text;
alter table public.nutrition_profiles add column if not exists exercise_days_week   integer;
alter table public.nutrition_profiles add column if not exists exercise_minutes     integer;
alter table public.nutrition_profiles add column if not exists exercise_intensity   text;
alter table public.nutrition_profiles add column if not exists favorite_foods       text;
alter table public.nutrition_profiles add column if not exists frequent_foods       text;
alter table public.nutrition_profiles add column if not exists disliked_foods       text;
alter table public.nutrition_profiles add column if not exists avoid_foods          text;
alter table public.nutrition_profiles add column if not exists food_style           text;
alter table public.nutrition_profiles add column if not exists allergies            text;
alter table public.nutrition_profiles add column if not exists intolerances         text;
alter table public.nutrition_profiles add column if not exists dietary_restrictions text;
alter table public.nutrition_profiles add column if not exists health_notes         text;
alter table public.nutrition_profiles add column if not exists onboarding_completed boolean not null default false;
alter table public.nutrition_profiles add column if not exists onboarding_step      integer not null default 0;

-- Normaliza a text las columnas que la app guarda como CSV. Si una columna existía
-- como array (text[]) u otro tipo, esto evita el error "malformed array literal".
-- `using col::text` es no-op si ya es text. Seguro de re-ejecutar.
alter table public.nutrition_profiles alter column meal_times           type text using meal_times::text;
alter table public.nutrition_profiles alter column main_goal            type text using main_goal::text;
alter table public.nutrition_profiles alter column exercise_type        type text using exercise_type::text;
alter table public.nutrition_profiles alter column favorite_foods       type text using favorite_foods::text;
alter table public.nutrition_profiles alter column frequent_foods       type text using frequent_foods::text;
alter table public.nutrition_profiles alter column disliked_foods       type text using disliked_foods::text;
alter table public.nutrition_profiles alter column avoid_foods          type text using avoid_foods::text;
alter table public.nutrition_profiles alter column allergies            type text using allergies::text;
alter table public.nutrition_profiles alter column intolerances         type text using intolerances::text;
alter table public.nutrition_profiles alter column dietary_restrictions type text using dietary_restrictions::text;

-- ----------------------------------------------------------------------------
--  Tabla: nutrition_goals (metas generadas por IA — histórico, una activa)
-- ----------------------------------------------------------------------------
create table if not exists public.nutrition_goals (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.usuarios(id) on delete cascade,
  profile_id               uuid references public.nutrition_profiles(id) on delete cascade,

  daily_calories           integer,
  daily_protein_g          integer,
  daily_carbs_g            integer,
  daily_fat_g              integer,
  daily_fiber_g            integer,
  daily_water_l            numeric(4,2),
  daily_vegetable_servings integer,
  weekly_calories          integer,

  goal_summary             text,
  ai_recommendations       text,

  source                   text not null default 'ai_mock',  -- 'ai_mock' | 'ai' | 'manual'
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Migración idempotente para tablas ya existentes con otro esquema.
alter table public.nutrition_goals add column if not exists profile_id               uuid references public.nutrition_profiles(id) on delete cascade;
alter table public.nutrition_goals add column if not exists daily_calories           integer;
alter table public.nutrition_goals add column if not exists daily_protein_g          integer;
alter table public.nutrition_goals add column if not exists daily_carbs_g            integer;
alter table public.nutrition_goals add column if not exists daily_fat_g              integer;
alter table public.nutrition_goals add column if not exists daily_fiber_g            integer;
alter table public.nutrition_goals add column if not exists daily_water_l            numeric(4,2);
alter table public.nutrition_goals add column if not exists daily_vegetable_servings integer;
alter table public.nutrition_goals add column if not exists weekly_calories          integer;
alter table public.nutrition_goals add column if not exists goal_summary             text;
alter table public.nutrition_goals add column if not exists ai_recommendations       text;
alter table public.nutrition_goals add column if not exists source                   text not null default 'ai_mock';
alter table public.nutrition_goals add column if not exists is_active                boolean not null default true;

create index if not exists nutrition_goals_user_idx        on public.nutrition_goals (user_id);
create index if not exists nutrition_goals_user_active_idx on public.nutrition_goals (user_id) where is_active;

-- ----------------------------------------------------------------------------
--  Tabla: meal_logs (comidas registradas, normalmente vía foto + análisis IA)
-- ----------------------------------------------------------------------------
create table if not exists public.meal_logs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.usuarios(id) on delete cascade,

  logged_at             timestamptz not null default now(),
  log_date              date not null default current_date,  -- para agrupar por día (hora local resuelta en app)
  meal_type             text,                                -- 'desayuno' | 'almuerzo' | 'cena' | 'snack'
  meal_name             text not null,

  image_url             text,
  image_path            text,

  detected_foods        jsonb,                               -- ["arroz","pollo",...]
  portion_estimate      text,

  calories              integer not null default 0,
  protein_g             numeric(6,2) not null default 0,
  carbs_g               numeric(6,2) not null default 0,
  fat_g                 numeric(6,2) not null default 0,
  fiber_g               numeric(6,2) not null default 0,
  micronutrients        jsonb,                               -- {"iron":"medio",...}

  nutrition_quality       text,                              -- 'muy_baja'|'baja'|'media'|'buena'|'muy_buena'
  nutrition_quality_score integer,                           -- 0-100
  ai_analysis             text,
  ai_recommendation       text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Migración idempotente para tablas ya existentes con otro esquema.
alter table public.meal_logs add column if not exists logged_at               timestamptz not null default now();
alter table public.meal_logs add column if not exists log_date                date not null default current_date;
alter table public.meal_logs add column if not exists meal_type               text;
alter table public.meal_logs add column if not exists meal_name               text;
alter table public.meal_logs add column if not exists image_url               text;
alter table public.meal_logs add column if not exists image_path              text;
alter table public.meal_logs add column if not exists detected_foods          jsonb;
alter table public.meal_logs add column if not exists portion_estimate        text;
alter table public.meal_logs add column if not exists calories                integer not null default 0;
alter table public.meal_logs add column if not exists protein_g               numeric(6,2) not null default 0;
alter table public.meal_logs add column if not exists carbs_g                 numeric(6,2) not null default 0;
alter table public.meal_logs add column if not exists fat_g                   numeric(6,2) not null default 0;
alter table public.meal_logs add column if not exists fiber_g                 numeric(6,2) not null default 0;
alter table public.meal_logs add column if not exists micronutrients          jsonb;
alter table public.meal_logs add column if not exists nutrition_quality       text;
alter table public.meal_logs add column if not exists nutrition_quality_score integer;
alter table public.meal_logs add column if not exists ai_analysis             text;
alter table public.meal_logs add column if not exists ai_recommendation       text;

create index if not exists meal_logs_user_date_idx on public.meal_logs (user_id, log_date);
create index if not exists meal_logs_user_idx       on public.meal_logs (user_id);

-- ----------------------------------------------------------------------------
--  Tabla: daily_nutrition_summaries (1 fila por usuario+día — agregado caché)
--  Se recalcula desde meal_logs tras cada cambio (ver app: recalcular resumen).
-- ----------------------------------------------------------------------------
create table if not exists public.daily_nutrition_summaries (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.usuarios(id) on delete cascade,
  summary_date            date not null,

  total_calories          integer not null default 0,
  total_protein_g         numeric(7,2) not null default 0,
  total_carbs_g           numeric(7,2) not null default 0,
  total_fat_g             numeric(7,2) not null default 0,
  total_fiber_g           numeric(7,2) not null default 0,
  meals_count             integer not null default 0,
  avg_quality_score       numeric(5,2),

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint daily_nutrition_summaries_user_date_unique unique (user_id, summary_date)
);

-- Migración idempotente para tablas ya existentes con otro esquema.
alter table public.daily_nutrition_summaries add column if not exists summary_date      date;
alter table public.daily_nutrition_summaries add column if not exists total_calories    integer not null default 0;
alter table public.daily_nutrition_summaries add column if not exists total_protein_g   numeric(7,2) not null default 0;
alter table public.daily_nutrition_summaries add column if not exists total_carbs_g     numeric(7,2) not null default 0;
alter table public.daily_nutrition_summaries add column if not exists total_fat_g       numeric(7,2) not null default 0;
alter table public.daily_nutrition_summaries add column if not exists total_fiber_g     numeric(7,2) not null default 0;
alter table public.daily_nutrition_summaries add column if not exists meals_count       integer not null default 0;
alter table public.daily_nutrition_summaries add column if not exists avg_quality_score numeric(5,2);

create index if not exists daily_summaries_user_date_idx on public.daily_nutrition_summaries (user_id, summary_date);

-- ----------------------------------------------------------------------------
--  Tabla: nutrition_chat_messages (chat IA nutricional, historial)
-- ----------------------------------------------------------------------------
create table if not exists public.nutrition_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.usuarios(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- Migración idempotente para tablas ya existentes con otro esquema.
alter table public.nutrition_chat_messages add column if not exists role       text;
alter table public.nutrition_chat_messages add column if not exists content    text;
alter table public.nutrition_chat_messages add column if not exists created_at timestamptz not null default now();

create index if not exists nutrition_chat_user_idx on public.nutrition_chat_messages (user_id, created_at);

-- ----------------------------------------------------------------------------
--  Tabla: ai_nutrition_requests (auditoría de llamadas a IA — mock y reales)
--  Útil para depurar y, más adelante, no repetir/medir costes del modelo real.
-- ----------------------------------------------------------------------------
create table if not exists public.ai_nutrition_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.usuarios(id) on delete cascade,
  request_type  text not null,                  -- 'goals' | 'meal_analysis' | 'chat'
  is_mock       boolean not null default true,
  request_payload  jsonb,
  response_payload jsonb,
  created_at    timestamptz not null default now()
);

-- Migración idempotente para tablas ya existentes con otro esquema.
alter table public.ai_nutrition_requests add column if not exists request_type     text;
alter table public.ai_nutrition_requests add column if not exists is_mock          boolean not null default true;
alter table public.ai_nutrition_requests add column if not exists request_payload  jsonb;
alter table public.ai_nutrition_requests add column if not exists response_payload jsonb;
alter table public.ai_nutrition_requests add column if not exists created_at       timestamptz not null default now();

create index if not exists ai_nutrition_requests_user_idx on public.ai_nutrition_requests (user_id, created_at);

-- ----------------------------------------------------------------------------
--  Triggers: mantener updated_at (reusa public.set_updated_at de schema.sql)
-- ----------------------------------------------------------------------------
drop trigger if exists nutrition_profiles_set_updated_at on public.nutrition_profiles;
create trigger nutrition_profiles_set_updated_at
  before update on public.nutrition_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists nutrition_goals_set_updated_at on public.nutrition_goals;
create trigger nutrition_goals_set_updated_at
  before update on public.nutrition_goals
  for each row execute function public.set_updated_at();

drop trigger if exists meal_logs_set_updated_at on public.meal_logs;
create trigger meal_logs_set_updated_at
  before update on public.meal_logs
  for each row execute function public.set_updated_at();

drop trigger if exists daily_summaries_set_updated_at on public.daily_nutrition_summaries;
create trigger daily_summaries_set_updated_at
  before update on public.daily_nutrition_summaries
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
--  Storage: bucket para fotos de comidas (ejecutar una vez; idempotente).
--  Acceso vía service_role desde el servidor; bucket privado.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('meal-images', 'meal-images', true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
--  Recarga el cache de esquema de PostgREST tras todas las migraciones
--  (evita "Could not find the X column ... in the schema cache"). Va al FINAL.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';
