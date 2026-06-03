-- ============================================================================
--  Mentes Creadoras — Módulo Entrenamiento de Gimnasio (Fase 1)
--  Ejecuta este archivo DESPUÉS de supabase/schema.sql en:
--    Supabase Dashboard > SQL Editor > New query
--
--  Mismo modelo que el resto del proyecto: auth propia (public.usuarios),
--  acceso solo server-side con la service_role key, SIN RLS. Cada tabla cuelga
--  del usuario vía user_id -> public.usuarios(id). Idempotente: seguro de
--  re-ejecutar (create if not exists + alter add column if not exists).
--
--  Diferencia clave del módulo:
--   A) Rutina PLANIFICADA  -> gym_routines + gym_routine_exercises (el objetivo).
--   B) Entrenamiento REAL  -> gym_workout_sessions + gym_workout_exercise_logs
--      + gym_workout_set_logs (lo que de verdad se hizo). Los valores objetivo se
--      COPIAN a los logs al iniciar la sesión, para conservar el historial aunque
--      la rutina cambie después.
-- ============================================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
--  Tabla: gym_exercises (catálogo de ejercicios)
--  is_global=true  -> visible para todos.
--  user_id no nulo -> ejercicio personalizado de ese usuario.
--  deleted_at      -> soft delete: nunca se borra físicamente si ya fue usado.
-- ----------------------------------------------------------------------------
create table if not exists public.gym_exercises (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  description              text,
  primary_muscle_group     text not null,             -- 'pecho' | 'espalda' | ...
  secondary_muscle_groups  text[],
  equipment                text,                       -- 'barra' | 'mancuerna' | ...
  exercise_type            text,                       -- 'fuerza' | 'cardio' | ...
  image_url                text,
  animation_url            text,
  instructions             text,
  is_global                boolean not null default true,
  user_id                  uuid references public.usuarios(id) on delete cascade,
  deleted_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists gym_exercises_muscle_idx on public.gym_exercises (primary_muscle_group);
create index if not exists gym_exercises_user_idx   on public.gym_exercises (user_id);
create index if not exists gym_exercises_global_idx on public.gym_exercises (is_global) where deleted_at is null;

-- ----------------------------------------------------------------------------
--  Tabla: gym_routines (rutina planificada por usuario/entrenador)
-- ----------------------------------------------------------------------------
create table if not exists public.gym_routines (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.usuarios(id) on delete cascade,
  name                        text not null,
  description                 text,
  objective                  text,
  difficulty_level            text,                    -- 'principiante' | 'intermedio' | 'avanzado'
  estimated_duration_minutes  integer,
  is_active                   boolean not null default true,
  created_by                  uuid references public.usuarios(id) on delete set null,
  deleted_at                  timestamptz,             -- soft delete: conserva historial
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists gym_routines_user_idx on public.gym_routines (user_id);

-- ----------------------------------------------------------------------------
--  Tabla: gym_routine_exercises (ejercicios planificados dentro de una rutina)
--  target_reps     -> objetivo exacto (ej. 10).
--  target_reps_min/max -> rango (ej. 8-12).
--  order_index     -> orden en pantalla.
-- ----------------------------------------------------------------------------
create table if not exists public.gym_routine_exercises (
  id                  uuid primary key default gen_random_uuid(),
  routine_id          uuid not null references public.gym_routines(id) on delete cascade,
  exercise_id         uuid not null references public.gym_exercises(id),
  order_index         integer not null default 0,
  target_sets         integer not null default 3,
  target_reps         integer,
  target_reps_min     integer,
  target_reps_max     integer,
  target_weight       numeric(7,2),
  target_weight_unit  text not null default 'kg',
  rest_seconds        integer,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists gym_routine_exercises_routine_idx on public.gym_routine_exercises (routine_id);

-- ----------------------------------------------------------------------------
--  Tabla: gym_workout_sessions (sesión real de entrenamiento)
--  routine_id puede ser null -> sesión libre sin rutina.
--  status: 'in_progress' | 'completed' | 'cancelled'.
-- ----------------------------------------------------------------------------
create table if not exists public.gym_workout_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.usuarios(id) on delete cascade,
  routine_id        uuid references public.gym_routines(id) on delete set null,
  routine_name      text,                              -- snapshot del nombre de la rutina
  session_date      date not null default current_date,
  started_at        timestamptz,
  finished_at       timestamptz,
  duration_minutes  integer,
  overall_effort    integer check (overall_effort between 1 and 10),
  status            text not null default 'in_progress'
                    check (status in ('in_progress', 'completed', 'cancelled')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists gym_workout_sessions_user_date_idx on public.gym_workout_sessions (user_id, session_date desc);
create index if not exists gym_workout_sessions_routine_idx   on public.gym_workout_sessions (routine_id);

-- ----------------------------------------------------------------------------
--  Tabla: gym_workout_exercise_logs (ejercicio realizado dentro de una sesión)
--  Los datos target_* se COPIAN desde la rutina al iniciar, para preservar el
--  objetivo histórico aunque la rutina cambie después.
-- ----------------------------------------------------------------------------
create table if not exists public.gym_workout_exercise_logs (
  id                  uuid primary key default gen_random_uuid(),
  workout_session_id  uuid not null references public.gym_workout_sessions(id) on delete cascade,
  exercise_id         uuid not null references public.gym_exercises(id),
  routine_exercise_id uuid references public.gym_routine_exercises(id) on delete set null,
  exercise_name       text,                            -- snapshot del nombre del ejercicio
  order_index         integer not null default 0,
  target_sets         integer,
  target_reps         integer,
  target_weight       numeric(7,2),
  rest_seconds        integer,
  is_completed        boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists gym_workout_exercise_logs_session_idx on public.gym_workout_exercise_logs (workout_session_id);

-- ----------------------------------------------------------------------------
--  Tabla: gym_workout_set_logs (cada serie real ejecutada)
--  Tabla más importante para el progreso: peso, reps y esfuerzo reales.
-- ----------------------------------------------------------------------------
create table if not exists public.gym_workout_set_logs (
  id                       uuid primary key default gen_random_uuid(),
  workout_exercise_log_id  uuid not null references public.gym_workout_exercise_logs(id) on delete cascade,
  set_number               integer not null,
  target_reps              integer,
  actual_reps              integer,
  target_weight            numeric(7,2),
  actual_weight            numeric(7,2),
  weight_unit              text not null default 'kg',
  effort_level             integer check (effort_level between 1 and 10),
  completed                boolean not null default true,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists gym_workout_set_logs_exercise_idx on public.gym_workout_set_logs (workout_exercise_log_id);

-- ----------------------------------------------------------------------------
--  Migraciones idempotentes para bases ya creadas con esquema previo
-- ----------------------------------------------------------------------------
alter table public.gym_exercises          add column if not exists image_path   text;
alter table public.gym_routines           add column if not exists deleted_at   timestamptz;
alter table public.gym_workout_sessions   add column if not exists routine_name text;
alter table public.gym_workout_exercise_logs add column if not exists exercise_name text;
alter table public.gym_workout_exercise_logs add column if not exists is_completed boolean not null default false;

-- ----------------------------------------------------------------------------
--  Triggers: mantener updated_at (reusa public.set_updated_at de schema.sql)
-- ----------------------------------------------------------------------------
drop trigger if exists gym_exercises_set_updated_at on public.gym_exercises;
create trigger gym_exercises_set_updated_at
  before update on public.gym_exercises
  for each row execute function public.set_updated_at();

drop trigger if exists gym_routines_set_updated_at on public.gym_routines;
create trigger gym_routines_set_updated_at
  before update on public.gym_routines
  for each row execute function public.set_updated_at();

drop trigger if exists gym_routine_exercises_set_updated_at on public.gym_routine_exercises;
create trigger gym_routine_exercises_set_updated_at
  before update on public.gym_routine_exercises
  for each row execute function public.set_updated_at();

drop trigger if exists gym_workout_sessions_set_updated_at on public.gym_workout_sessions;
create trigger gym_workout_sessions_set_updated_at
  before update on public.gym_workout_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists gym_workout_exercise_logs_set_updated_at on public.gym_workout_exercise_logs;
create trigger gym_workout_exercise_logs_set_updated_at
  before update on public.gym_workout_exercise_logs
  for each row execute function public.set_updated_at();

drop trigger if exists gym_workout_set_logs_set_updated_at on public.gym_workout_set_logs;
create trigger gym_workout_set_logs_set_updated_at
  before update on public.gym_workout_set_logs
  for each row execute function public.set_updated_at();

-- ============================================================================
--  FASE 2 — IA: análisis objetivo vs realizado
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Tabla: gym_workout_analyses (1 análisis por sesión — regenerable)
--  comparison = JSON con los números exactos (objetivo vs realizado).
--  El resto son los campos narrativos que redacta la IA.
-- ----------------------------------------------------------------------------
create table if not exists public.gym_workout_analyses (
  id                  uuid primary key default gen_random_uuid(),
  workout_session_id  uuid not null unique references public.gym_workout_sessions(id) on delete cascade,
  user_id             uuid not null references public.usuarios(id) on delete cascade,
  summary             text,
  what_went_well      text[],
  to_improve          text[],
  next_focus          text,
  comparison          jsonb,
  source              text not null default 'ai_mock',   -- 'ai' | 'ai_mock'
  is_mock             boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists gym_workout_analyses_user_idx on public.gym_workout_analyses (user_id, created_at desc);

drop trigger if exists gym_workout_analyses_set_updated_at on public.gym_workout_analyses;
create trigger gym_workout_analyses_set_updated_at
  before update on public.gym_workout_analyses
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
--  Tabla: gym_ai_requests (auditoría de llamadas a IA — mock y reales)
-- ----------------------------------------------------------------------------
create table if not exists public.gym_ai_requests (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.usuarios(id) on delete cascade,
  request_type      text not null,                 -- 'workout_analysis'
  is_mock           boolean not null default true,
  request_payload   jsonb,
  response_payload  jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists gym_ai_requests_user_idx on public.gym_ai_requests (user_id, created_at desc);

-- ----------------------------------------------------------------------------
--  Tabla: gym_chat_messages (chat con el Coach IA del gimnasio)
-- ----------------------------------------------------------------------------
create table if not exists public.gym_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.usuarios(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists gym_chat_messages_user_idx on public.gym_chat_messages (user_id, created_at);

-- ----------------------------------------------------------------------------
--  Seed: catálogo global de ejercicios base. Idempotente por nombre+global.
-- ----------------------------------------------------------------------------
insert into public.gym_exercises (name, primary_muscle_group, equipment, exercise_type, is_global, description)
select v.name, v.muscle, v.equipment, 'fuerza', true, v.description
from (values
  ('Press de banca',            'pecho',           'barra',     'Press horizontal con barra para pecho.'),
  ('Press inclinado mancuernas','pecho',           'mancuerna', 'Press en banco inclinado con mancuernas.'),
  ('Aperturas con mancuernas',  'pecho',           'mancuerna', 'Aperturas en banco plano para pecho.'),
  ('Fondos en paralelas',       'pecho',           'peso_corporal', 'Fondos para pecho y tríceps.'),
  ('Dominadas',                 'espalda',         'peso_corporal', 'Dominadas con agarre prono.'),
  ('Remo con barra',            'espalda',         'barra',     'Remo inclinado con barra.'),
  ('Jalón al pecho',            'espalda',         'maquina',   'Jalón en polea alta al pecho.'),
  ('Remo con mancuerna',        'espalda',         'mancuerna', 'Remo a una mano con mancuerna.'),
  ('Press militar',             'hombros',         'barra',     'Press de hombros de pie con barra.'),
  ('Elevaciones laterales',     'hombros',         'mancuerna', 'Elevaciones laterales para deltoides.'),
  ('Pájaros',                   'hombros',         'mancuerna', 'Elevaciones posteriores para deltoide trasero.'),
  ('Curl con barra',            'biceps',          'barra',     'Curl de bíceps de pie con barra.'),
  ('Curl con mancuernas',       'biceps',          'mancuerna', 'Curl alterno con mancuernas.'),
  ('Curl martillo',             'biceps',          'mancuerna', 'Curl con agarre neutro.'),
  ('Press francés',             'triceps',         'barra',     'Extensión de tríceps tumbado.'),
  ('Extensión en polea',        'triceps',         'maquina',   'Extensión de tríceps en polea alta.'),
  ('Fondos de tríceps',         'triceps',         'peso_corporal', 'Fondos en banco para tríceps.'),
  ('Plancha',                   'abdomen',         'peso_corporal', 'Plancha isométrica para core.'),
  ('Crunch abdominal',          'abdomen',         'peso_corporal', 'Encogimientos para abdomen.'),
  ('Elevación de piernas',      'abdomen',         'peso_corporal', 'Elevación de piernas para abdomen inferior.'),
  ('Sentadilla',                'piernas',         'barra',     'Sentadilla trasera con barra.'),
  ('Prensa de piernas',         'piernas',         'maquina',   'Prensa inclinada para piernas.'),
  ('Peso muerto',               'piernas',         'barra',     'Peso muerto convencional.'),
  ('Zancadas',                  'piernas',         'mancuerna', 'Zancadas con mancuernas.'),
  ('Extensión de cuádriceps',   'piernas',         'maquina',   'Extensión en máquina para cuádriceps.'),
  ('Curl femoral',              'piernas',         'maquina',   'Curl de isquiotibiales en máquina.'),
  ('Hip thrust',                'gluteos',         'barra',     'Empuje de cadera para glúteos.'),
  ('Patada de glúteo',          'gluteos',         'maquina',   'Patada de glúteo en polea o máquina.'),
  ('Burpees',                   'cuerpo_completo', 'peso_corporal', 'Ejercicio metabólico de cuerpo completo.'),
  ('Cinta de correr',           'cardio',          'maquina',   'Carrera continua en cinta.'),
  ('Bicicleta estática',        'cardio',          'maquina',   'Cardio en bicicleta estática.'),
  ('Saltar la cuerda',          'cardio',          'otro',      'Cardio saltando la cuerda.')
) as v(name, muscle, equipment, description)
where not exists (
  select 1 from public.gym_exercises e
  where e.name = v.name and e.is_global = true
);
