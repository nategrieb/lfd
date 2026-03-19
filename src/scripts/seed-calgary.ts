/**
 * Calgary Barbell 8-Week Program seed data.
 *
 * Run via: npx tsx src/scripts/seed-calgary.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExDef = {
  name: string
  slug: string
  category: string
}

type SetDef = {
  exerciseSlug: string
  setsCount: number
  reps: number | null
  repsNote?: string
  percentage?: number    // 0.80 etc. — mutually exclusive with targetRpe
  targetRpe?: number     // e.g. 8.0
  tempo?: string
  restSeconds?: number
}

type DayDef = {
  weekNumber: number
  dayNumber: number
  name: string
  sets: SetDef[]
}

// ---------------------------------------------------------------------------
// Exercise catalogue
// ---------------------------------------------------------------------------

const EXERCISES: ExDef[] = [
  { name: 'Competition Squat',         slug: 'competition-squat',          category: 'squat'     },
  { name: 'Competition Pause Bench',   slug: 'competition-pause-bench',    category: 'bench'     },
  { name: 'Competition Deadlift',      slug: 'competition-deadlift',       category: 'deadlift'  },
  { name: '2ct Pause Squat',           slug: '2ct-pause-squat',            category: 'squat'     },
  { name: '2ct Pause Bench',           slug: '2ct-pause-bench',            category: 'bench'     },
  { name: '2ct Pause Deadlift',        slug: '2ct-pause-deadlift',         category: 'deadlift'  },
  { name: 'High Bar Squat',            slug: 'high-bar-squat',             category: 'squat'     },
  { name: 'Pin Squat',                 slug: 'pin-squat',                  category: 'squat'     },
  { name: 'Feet Up Bench',             slug: 'feet-up-bench',              category: 'bench'     },
  { name: 'Close Grip Bench',          slug: 'close-grip-bench',           category: 'bench'     },
  { name: 'Touch and Go Bench',        slug: 'touch-and-go-bench',         category: 'bench'     },
  { name: 'Close Grip Incline Press',  slug: 'close-grip-incline-press',   category: 'bench'     },
  { name: 'Overhead Press',            slug: 'overhead-press',             category: 'bench'     },
  { name: 'SLDL',                      slug: 'sldl',                       category: 'deadlift'  },
  { name: 'Wide Grip Seated Row',      slug: 'wide-grip-seated-row',       category: 'row'       },
  { name: 'Vertical Pull',             slug: 'vertical-pull',              category: 'row'       },
  { name: 'Landmine Rows',             slug: 'landmine-rows',              category: 'row'       },
  { name: 'Side Planks',               slug: 'side-planks',                category: 'accessory' },
]

// ---------------------------------------------------------------------------
// Program days — Calgary Barbell 8-Week + Taper
// ---------------------------------------------------------------------------

const DAYS: DayDef[] = [

  // ── WEEKS 1–4 · Day 1 ────────────────────────────────────────────────────
  {
    weekNumber: 1, dayNumber: 1, name: 'Day 1 – Squat / Pause Bench',
    sets: [
      { exerciseSlug: 'competition-squat',        setsCount: 3, reps: 3, percentage: 0.80, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',        setsCount: 2, reps: 5, percentage: 0.68, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench',  setsCount: 4, reps: 3, percentage: 0.80, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench',  setsCount: 2, reps: 5, percentage: 0.68, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'sldl',                     setsCount: 4, reps: 9, targetRpe: 8,     tempo: '1.0.1', restSeconds: 90  },
      { exerciseSlug: 'side-planks',              setsCount: 3, reps: null, repsNote: '30s/side', restSeconds: 60 },
    ],
  },
  {
    weekNumber: 2, dayNumber: 1, name: 'Day 1 – Squat / Pause Bench',
    sets: [
      { exerciseSlug: 'competition-squat',        setsCount: 4, reps: 3, percentage: 0.82, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',        setsCount: 2, reps: 5, percentage: 0.70, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench',  setsCount: 5, reps: 3, percentage: 0.82, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench',  setsCount: 3, reps: 5, percentage: 0.70, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'sldl',                     setsCount: 4, reps: 8, targetRpe: 8,     tempo: '1.0.1', restSeconds: 90  },
      { exerciseSlug: 'side-planks',              setsCount: 4, reps: null, repsNote: '30s/side', restSeconds: 60 },
    ],
  },
  {
    weekNumber: 3, dayNumber: 1, name: 'Day 1 – Squat / Pause Bench',
    sets: [
      { exerciseSlug: 'competition-squat',        setsCount: 5, reps: 2, percentage: 0.86, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',        setsCount: 2, reps: 4, percentage: 0.72, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench',  setsCount: 5, reps: 2, percentage: 0.86, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench',  setsCount: 2, reps: 4, percentage: 0.72, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'sldl',                     setsCount: 4, reps: 8, targetRpe: 8,     tempo: '1.0.1', restSeconds: 90  },
      { exerciseSlug: 'side-planks',              setsCount: 4, reps: null, repsNote: '45s/side', restSeconds: 60 },
    ],
  },
  {
    weekNumber: 4, dayNumber: 1, name: 'Day 1 – Squat / Pause Bench',
    sets: [
      { exerciseSlug: 'competition-squat',        setsCount: 4, reps: 3, percentage: 0.85, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',        setsCount: 3, reps: 4, percentage: 0.75, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench',  setsCount: 5, reps: 3, percentage: 0.85, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench',  setsCount: 3, reps: 4, percentage: 0.75, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'sldl',                     setsCount: 4, reps: 7, targetRpe: 8,     tempo: '1.0.1', restSeconds: 90  },
      { exerciseSlug: 'side-planks',              setsCount: 4, reps: null, repsNote: '45s/side', restSeconds: 60 },
    ],
  },

  // ── WEEKS 1–4 · Day 2 ────────────────────────────────────────────────────
  {
    weekNumber: 1, dayNumber: 2, name: 'Day 2 – Deadlift / Pause Bench / Squat',
    sets: [
      { exerciseSlug: 'competition-deadlift',  setsCount: 3, reps: 3, percentage: 0.80, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-deadlift',  setsCount: 2, reps: 5, percentage: 0.68, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: '2ct-pause-bench',       setsCount: 3, reps: 4, targetRpe: 8,     tempo: '1.3.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',     setsCount: 2, reps: 5, percentage: 0.65, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'wide-grip-seated-row',  setsCount: 4, reps: 10, targetRpe: 8,    tempo: '1.0.1', restSeconds: 60  },
    ],
  },
  {
    weekNumber: 2, dayNumber: 2, name: 'Day 2 – Deadlift / Pause Bench / Squat',
    sets: [
      { exerciseSlug: 'competition-deadlift',  setsCount: 4, reps: 3, percentage: 0.82, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-deadlift',  setsCount: 2, reps: 5, percentage: 0.70, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: '2ct-pause-bench',       setsCount: 4, reps: 3, targetRpe: 8,     tempo: '1.3.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',     setsCount: 3, reps: 5, percentage: 0.68, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'wide-grip-seated-row',  setsCount: 4, reps: 10, targetRpe: 8,    tempo: '1.0.1', restSeconds: 60  },
    ],
  },
  {
    weekNumber: 3, dayNumber: 2, name: 'Day 2 – Deadlift / Pause Bench / Squat',
    sets: [
      { exerciseSlug: 'competition-deadlift',  setsCount: 5, reps: 2, percentage: 0.86, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-deadlift',  setsCount: 2, reps: 4, percentage: 0.72, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: '2ct-pause-bench',       setsCount: 3, reps: 3, targetRpe: 8,     tempo: '1.3.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',     setsCount: 2, reps: 5, percentage: 0.71, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'wide-grip-seated-row',  setsCount: 4, reps: 8, targetRpe: 8,     tempo: '1.0.1', restSeconds: 60  },
    ],
  },
  {
    weekNumber: 4, dayNumber: 2, name: 'Day 2 – Deadlift / Pause Bench / Squat',
    sets: [
      { exerciseSlug: 'competition-deadlift',  setsCount: 4, reps: 3, percentage: 0.85, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-deadlift',  setsCount: 3, reps: 4, percentage: 0.75, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: '2ct-pause-bench',       setsCount: 4, reps: 4, targetRpe: 8,     tempo: '1.3.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',     setsCount: 2, reps: 4, percentage: 0.74, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'wide-grip-seated-row',  setsCount: 4, reps: 8, targetRpe: 8,     tempo: '1.0.1', restSeconds: 60  },
    ],
  },

  // ── WEEKS 1–4 · Day 3 ────────────────────────────────────────────────────
  {
    weekNumber: 1, dayNumber: 3, name: 'Day 3 – Pause Squat / Bench Volume',
    sets: [
      { exerciseSlug: '2ct-pause-squat',        setsCount: 4, reps: 4, targetRpe: 8,     tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 6, reps: 5, percentage: 0.70, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'feet-up-bench',           setsCount: 4, reps: 5, targetRpe: 8,     tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-deadlift',    setsCount: 2, reps: 5, percentage: 0.65, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'vertical-pull',           setsCount: 4, reps: 10, targetRpe: 8,    restSeconds: 90  },
    ],
  },
  {
    weekNumber: 2, dayNumber: 3, name: 'Day 3 – Pause Squat / Bench Volume',
    sets: [
      { exerciseSlug: '2ct-pause-squat',        setsCount: 5, reps: 3, targetRpe: 8, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 6, reps: 4, percentage: 0.73, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'feet-up-bench',           setsCount: 3, reps: 4, targetRpe: 8, tempo: '1.0.1', restSeconds: 120 },
      { exerciseSlug: 'competition-deadlift',    setsCount: 3, reps: 5, percentage: 0.68, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'vertical-pull',           setsCount: 4, reps: 10, targetRpe: 8, restSeconds: 90 },
    ],
  },
  {
    weekNumber: 3, dayNumber: 3, name: 'Day 3 – Pause Squat / Bench Volume',
    sets: [
      { exerciseSlug: '2ct-pause-squat',        setsCount: 4, reps: 5, targetRpe: 9, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 6, reps: 3, percentage: 0.75, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'feet-up-bench',           setsCount: 4, reps: 3, targetRpe: 8, tempo: '1.0.1', restSeconds: 120 },
      { exerciseSlug: 'competition-deadlift',    setsCount: 2, reps: 5, percentage: 0.71, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'vertical-pull',           setsCount: 4, reps: 8, targetRpe: 8, restSeconds: 90 },
    ],
  },
  {
    weekNumber: 4, dayNumber: 3, name: 'Day 3 – Pause Squat / Bench Volume',
    sets: [
      { exerciseSlug: '2ct-pause-squat',        setsCount: 4, reps: 2, targetRpe: 9, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 6, reps: 5, percentage: 0.68, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'feet-up-bench',           setsCount: 4, reps: 4, targetRpe: 8, tempo: '1.0.1', restSeconds: 120 },
      { exerciseSlug: 'competition-deadlift',    setsCount: 2, reps: 4, percentage: 0.74, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'vertical-pull',           setsCount: 4, reps: 8, targetRpe: 8, restSeconds: 90 },
    ],
  },

  // ── WEEKS 1–4 · Day 4 ────────────────────────────────────────────────────
  {
    weekNumber: 1, dayNumber: 4, name: 'Day 4 – Pause Deadlift / Bench',
    sets: [
      { exerciseSlug: '2ct-pause-deadlift',     setsCount: 4, reps: 4,  targetRpe: 8,  restSeconds: 180 },
      { exerciseSlug: 'touch-and-go-bench',     setsCount: 3, reps: 6,  targetRpe: 9,  tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'close-grip-incline-press', setsCount: 4, reps: 8, targetRpe: 8, tempo: '1.0.1', restSeconds: 120 },
      { exerciseSlug: 'landmine-rows',          setsCount: 6, reps: 10, targetRpe: 8,  tempo: '1.0.1', restSeconds: 60  },
    ],
  },
  {
    weekNumber: 2, dayNumber: 4, name: 'Day 4 – Pause Deadlift / Bench',
    sets: [
      { exerciseSlug: '2ct-pause-deadlift',     setsCount: 5, reps: 3,  targetRpe: 8,   restSeconds: 180 },
      { exerciseSlug: 'touch-and-go-bench',     setsCount: 3, reps: 12, targetRpe: 10,  tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'close-grip-incline-press', setsCount: 4, reps: 7, targetRpe: 8,  tempo: '1.0.1', restSeconds: 120 },
      { exerciseSlug: 'landmine-rows',          setsCount: 6, reps: 10, targetRpe: 8,   tempo: '1.0.1', restSeconds: 60  },
    ],
  },
  {
    weekNumber: 3, dayNumber: 4, name: 'Day 4 – Pause Deadlift / Bench',
    sets: [
      { exerciseSlug: '2ct-pause-deadlift',     setsCount: 4, reps: 5,  targetRpe: 8,  restSeconds: 180 },
      { exerciseSlug: 'touch-and-go-bench',     setsCount: 4, reps: 7,  targetRpe: 8,  tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'close-grip-incline-press', setsCount: 5, reps: 6, targetRpe: 8, tempo: '1.0.1', restSeconds: 120 },
      { exerciseSlug: 'landmine-rows',          setsCount: 6, reps: 8,  targetRpe: 8,  tempo: '1.0.1', restSeconds: 60  },
    ],
  },
  {
    weekNumber: 4, dayNumber: 4, name: 'Day 4 – Pause Deadlift / Bench',
    sets: [
      { exerciseSlug: '2ct-pause-deadlift',     setsCount: 4, reps: 2,  targetRpe: 9,  restSeconds: 180 },
      { exerciseSlug: 'touch-and-go-bench',     setsCount: 4, reps: 5,  targetRpe: 8,  tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'close-grip-incline-press', setsCount: 4, reps: 10, targetRpe: 8, tempo: '1.0.1', restSeconds: 120 },
      { exerciseSlug: 'landmine-rows',          setsCount: 6, reps: 8,  targetRpe: 8,  tempo: '1.0.1', restSeconds: 60  },
    ],
  },

  // ── WEEKS 5–8 · Day 1 ────────────────────────────────────────────────────
  {
    weekNumber: 5, dayNumber: 1, name: 'Day 1 – Squat / Pause Bench Peak',
    sets: [
      { exerciseSlug: 'competition-squat',       setsCount: 1, reps: 3, targetRpe: 8,     tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',       setsCount: 6, reps: 5, percentage: 0.65, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 1, reps: 3, targetRpe: 8,     tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 7, reps: 5, percentage: 0.65, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'overhead-press',          setsCount: 3, reps: 6, targetRpe: 9,     tempo: '1.0.1', restSeconds: 120 },
    ],
  },
  {
    weekNumber: 6, dayNumber: 1, name: 'Day 1 – Squat / Pause Bench Peak',
    sets: [
      { exerciseSlug: 'competition-squat',       setsCount: 1, reps: 2, targetRpe: 8,     tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',       setsCount: 6, reps: 5, percentage: 0.68, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 1, reps: 2, targetRpe: 8,     tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 7, reps: 5, percentage: 0.68, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'overhead-press',          setsCount: 2, reps: 7, targetRpe: 9,     tempo: '1.0.1', restSeconds: 90  },
    ],
  },
  {
    weekNumber: 7, dayNumber: 1, name: 'Day 1 – Squat / Pause Bench Peak',
    sets: [
      { exerciseSlug: 'competition-squat',       setsCount: 1, reps: 1, targetRpe: 8,     tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',       setsCount: 4, reps: 4, percentage: 0.72, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 1, reps: 1, targetRpe: 9,     tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 5, reps: 4, percentage: 0.72, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'overhead-press',          setsCount: 3, reps: 6, targetRpe: 8,     tempo: '1.0.1', restSeconds: 120 },
    ],
  },
  {
    weekNumber: 8, dayNumber: 1, name: 'Day 1 – Squat / Pause Bench Peak',
    sets: [
      { exerciseSlug: 'competition-squat',       setsCount: 1, reps: 1, targetRpe: 8,     tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',       setsCount: 3, reps: 3, percentage: 0.76, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 1, reps: 1, targetRpe: 9,     tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 4, reps: 3, percentage: 0.76, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'overhead-press',          setsCount: 2, reps: 5, targetRpe: 9,     tempo: '1.0.1', restSeconds: 90  },
    ],
  },

  // ── WEEKS 5–8 · Day 2 ────────────────────────────────────────────────────
  {
    weekNumber: 5, dayNumber: 2, name: 'Day 2 – Deadlift / Bench / High Bar',
    sets: [
      { exerciseSlug: 'competition-deadlift', setsCount: 1, reps: 3, targetRpe: 8,     tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-deadlift', setsCount: 6, reps: 5, percentage: 0.65, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: '2ct-pause-bench',      setsCount: 3, reps: 4, targetRpe: 9,     tempo: '1.2.1', restSeconds: 180 },
      { exerciseSlug: 'high-bar-squat',       setsCount: 3, reps: 4, targetRpe: 8,     tempo: '1.0.1', restSeconds: 180 },
    ],
  },
  {
    weekNumber: 6, dayNumber: 2, name: 'Day 2 – Deadlift / Bench / High Bar',
    sets: [
      { exerciseSlug: 'competition-deadlift', setsCount: 1, reps: 2, targetRpe: 8,     tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-deadlift', setsCount: 6, reps: 5, percentage: 0.68, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: '2ct-pause-bench',      setsCount: 3, reps: 5, targetRpe: 8,     tempo: '1.2.1', restSeconds: 180 },
      { exerciseSlug: 'high-bar-squat',       setsCount: 2, reps: 3, targetRpe: 9,     tempo: '1.0.1', restSeconds: 180 },
    ],
  },
  {
    weekNumber: 7, dayNumber: 2, name: 'Day 2 – Deadlift / Bench / High Bar',
    sets: [
      { exerciseSlug: 'competition-deadlift', setsCount: 1, reps: 1, targetRpe: 8,     tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-deadlift', setsCount: 4, reps: 4, percentage: 0.72, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: '2ct-pause-bench',      setsCount: 3, reps: 2, targetRpe: 9,     tempo: '1.2.1', restSeconds: 180 },
      { exerciseSlug: 'high-bar-squat',       setsCount: 3, reps: 4, targetRpe: 9,     tempo: '1.0.1', restSeconds: 180 },
    ],
  },
  {
    weekNumber: 8, dayNumber: 2, name: 'Day 2 – Deadlift / Bench / High Bar',
    sets: [
      { exerciseSlug: 'competition-deadlift', setsCount: 1, reps: 1, targetRpe: 8,     tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-deadlift', setsCount: 3, reps: 3, percentage: 0.76, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: '2ct-pause-bench',      setsCount: 3, reps: 4, targetRpe: 8,     tempo: '1.2.1', restSeconds: 180 },
      { exerciseSlug: 'high-bar-squat',       setsCount: 2, reps: 2, targetRpe: 8,     tempo: '1.0.1', restSeconds: 180 },
    ],
  },

  // ── WEEKS 5–8 · Day 3 ────────────────────────────────────────────────────
  {
    weekNumber: 5, dayNumber: 3, name: 'Day 3 – Pin Squat / Bench Variation',
    sets: [
      { exerciseSlug: 'pin-squat',       setsCount: 1, reps: 3, targetRpe: 8,  tempo: '1.2.1', restSeconds: 180 },
      { exerciseSlug: 'pin-squat',       setsCount: 3, reps: 4, targetRpe: 9,  tempo: '1.2.1', restSeconds: 180 },
      { exerciseSlug: 'close-grip-bench', setsCount: 3, reps: 3, targetRpe: 9, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'feet-up-bench',   setsCount: 3, reps: 5, targetRpe: 9,  tempo: '1.0.1', restSeconds: 180 },
    ],
  },
  {
    weekNumber: 6, dayNumber: 3, name: 'Day 3 – Pin Squat / Bench Variation',
    sets: [
      { exerciseSlug: 'pin-squat',       setsCount: 1, reps: 2, targetRpe: 8,  tempo: '1.2.1', restSeconds: 180 },
      { exerciseSlug: 'pin-squat',       setsCount: 3, reps: 5, targetRpe: 9,  tempo: '1.2.1', restSeconds: 180 },
      { exerciseSlug: 'close-grip-bench', setsCount: 2, reps: 2, targetRpe: 9, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'feet-up-bench',   setsCount: 3, reps: 6, targetRpe: 9,  tempo: '1.0.1', restSeconds: 180 },
    ],
  },
  {
    weekNumber: 7, dayNumber: 3, name: 'Day 3 – Pin Squat / Bench Variation',
    sets: [
      { exerciseSlug: 'pin-squat',       setsCount: 1, reps: 1, targetRpe: 8,  tempo: '1.2.1', restSeconds: 180 },
      { exerciseSlug: 'pin-squat',       setsCount: 3, reps: 2, targetRpe: 9,  tempo: '1.2.1', restSeconds: 180 },
      { exerciseSlug: 'close-grip-bench', setsCount: 3, reps: 3, targetRpe: 8, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'feet-up-bench',   setsCount: 3, reps: 3, targetRpe: 9,  tempo: '1.0.1', restSeconds: 180 },
    ],
  },
  {
    weekNumber: 8, dayNumber: 3, name: 'Day 3 – Pin Squat / Bench Variation',
    sets: [
      { exerciseSlug: 'pin-squat',       setsCount: 1, reps: 1, targetRpe: 8,  tempo: '1.2.1', restSeconds: 180 },
      { exerciseSlug: 'pin-squat',       setsCount: 4, reps: 4, targetRpe: 8,  tempo: '1.2.1', restSeconds: 180 },
      { exerciseSlug: 'close-grip-bench', setsCount: 3, reps: 4, targetRpe: 9, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'feet-up-bench',   setsCount: 3, reps: 4, targetRpe: 9,  tempo: '1.0.1', restSeconds: 180 },
    ],
  },

  // ── WEEKS 5–8 · Day 4 ────────────────────────────────────────────────────
  {
    weekNumber: 5, dayNumber: 4, name: 'Day 4 – Pause Deadlift / Touch-n-Go',
    sets: [
      { exerciseSlug: '2ct-pause-deadlift', setsCount: 1, reps: 3, targetRpe: 8, restSeconds: 180 },
      { exerciseSlug: '2ct-pause-deadlift', setsCount: 3, reps: 5, targetRpe: 9, restSeconds: 180 },
      { exerciseSlug: 'touch-and-go-bench', setsCount: 4, reps: 5, targetRpe: 8, tempo: '1.0.1', restSeconds: 180 },
    ],
  },
  {
    weekNumber: 6, dayNumber: 4, name: 'Day 4 – Pause Deadlift / Touch-n-Go',
    sets: [
      { exerciseSlug: '2ct-pause-deadlift', setsCount: 1, reps: 2, targetRpe: 8, restSeconds: 180 },
      { exerciseSlug: '2ct-pause-deadlift', setsCount: 3, reps: 4, targetRpe: 8, restSeconds: 180 },
      { exerciseSlug: 'touch-and-go-bench', setsCount: 4, reps: 4, targetRpe: 8, tempo: '1.0.1', restSeconds: 180 },
    ],
  },
  {
    weekNumber: 7, dayNumber: 4, name: 'Day 4 – Pause Deadlift / Touch-n-Go',
    sets: [
      { exerciseSlug: '2ct-pause-deadlift', setsCount: 1, reps: 1, targetRpe: 8, restSeconds: 180 },
      { exerciseSlug: '2ct-pause-deadlift', setsCount: 3, reps: 2, targetRpe: 9, restSeconds: 180 },
      { exerciseSlug: 'touch-and-go-bench', setsCount: 2, reps: 3, targetRpe: 9, tempo: '1.0.1', restSeconds: 180 },
    ],
  },
  {
    weekNumber: 8, dayNumber: 4, name: 'Day 4 – Pause Deadlift / Touch-n-Go',
    sets: [
      { exerciseSlug: '2ct-pause-deadlift', setsCount: 1, reps: 1, targetRpe: 8, restSeconds: 180 },
      { exerciseSlug: '2ct-pause-deadlift', setsCount: 4, reps: 4, targetRpe: 9, restSeconds: 180 },
      { exerciseSlug: 'touch-and-go-bench', setsCount: 3, reps: 3, targetRpe: 9, tempo: '1.0.1', restSeconds: 180 },
    ],
  },

  // ── WEEK 9 – TAPER ───────────────────────────────────────────────────────
  {
    weekNumber: 9, dayNumber: 1, name: 'Taper – 5 Days Out',
    sets: [
      { exerciseSlug: 'competition-squat',       setsCount: 1, reps: 1, repsNote: 'Opener',    percentage: 0.91, tempo: '1.0.1', restSeconds: 300 },
      { exerciseSlug: 'competition-squat',       setsCount: 3, reps: 2, percentage: 0.82,       tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 1, reps: 1, repsNote: 'Opener',    percentage: 0.91, tempo: '1.1.1', restSeconds: 300 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 3, reps: 2, percentage: 0.84,       tempo: '1.1.1', restSeconds: 180 },
    ],
  },
  {
    weekNumber: 9, dayNumber: 2, name: 'Taper – 4 Days Out',
    sets: [
      { exerciseSlug: 'competition-deadlift',    setsCount: 1, reps: 1, repsNote: 'Opener',    percentage: 0.91, tempo: '1.0.1', restSeconds: 300 },
      { exerciseSlug: 'competition-deadlift',    setsCount: 2, reps: 2, percentage: 0.82,       tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 4, reps: 1, percentage: 0.85,       tempo: '1.1.1', restSeconds: 180 },
    ],
  },
  {
    weekNumber: 9, dayNumber: 3, name: 'Taper – 3 Days Out',
    sets: [
      { exerciseSlug: 'competition-squat',       setsCount: 1, reps: 1, percentage: 0.85, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-squat',       setsCount: 2, reps: 2, percentage: 0.78, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 1, reps: 1, percentage: 0.85, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 3, reps: 2, percentage: 0.78, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-deadlift',    setsCount: 1, reps: 1, percentage: 0.82, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-deadlift',    setsCount: 2, reps: 2, percentage: 0.75, tempo: '1.0.1', restSeconds: 180 },
    ],
  },
  {
    weekNumber: 9, dayNumber: 4, name: 'Taper – 2 Days Out',
    sets: [
      { exerciseSlug: 'competition-squat',       setsCount: 2, reps: 3, percentage: 0.75, tempo: '1.0.1', restSeconds: 180 },
      { exerciseSlug: 'competition-pause-bench', setsCount: 3, reps: 3, percentage: 0.78, tempo: '1.1.1', restSeconds: 180 },
      { exerciseSlug: 'competition-deadlift',    setsCount: 1, reps: 3, percentage: 0.75, tempo: '1.0.1', restSeconds: 180 },
    ],
  },
]

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

async function seed() {
  console.log('─── Calgary Barbell 8-Week Program Seed ───\n')

  // 1. Upsert exercises
  const { error: exErr } = await supabase
    .from('exercises')
    .upsert(EXERCISES.map(e => ({ name: e.name, slug: e.slug, category: e.category })), { onConflict: 'slug' })
  if (exErr) { console.error('exercises upsert failed:', exErr); process.exit(1) }

  // Build slug → id map
  const { data: exRows } = await supabase.from('exercises').select('id, slug')
  const exMap = new Map<string, string>((exRows ?? []).map(e => [e.slug, e.id]))
  console.log(`✓ ${exMap.size} exercises`)

  // 2. Upsert program template
  const { data: tmpl, error: tmplErr } = await supabase
    .from('program_templates')
    .upsert({
      name: 'Calgary Barbell 8-Week',
      description: 'Classic 4-day/week powerlifting peaking program. 8 training weeks followed by a 1-week competition taper. Developed by Calgary Barbell.',
      duration_weeks: 9,
    }, { onConflict: 'name' })
    .select('id')
    .single()
  if (tmplErr || !tmpl) { console.error('program_templates upsert failed:', tmplErr); process.exit(1) }
  const templateId = tmpl.id
  console.log(`✓ Template id: ${templateId}`)

  // 3. Upsert template_workouts + template_sets for every day
  for (const day of DAYS) {
    const { data: tw, error: twErr } = await supabase
      .from('template_workouts')
      .upsert({
        template_id: templateId,
        week_number: day.weekNumber,
        day_number: day.dayNumber,
        name: day.name,
      }, { onConflict: 'template_id,week_number,day_number' })
      .select('id')
      .single()

    if (twErr || !tw) { console.error(`template_workouts W${day.weekNumber}D${day.dayNumber}:`, twErr); continue }

    // Delete existing sets (idempotent re-seed)
    await supabase.from('template_sets').delete().eq('template_workout_id', tw.id)

    const setRows = day.sets.map((s, i) => ({
      template_workout_id: tw.id,
      sort_order:          i,
      exercise_id:         exMap.get(s.exerciseSlug) ?? null,
      exercise_name:       EXERCISES.find(e => e.slug === s.exerciseSlug)?.name ?? s.exerciseSlug,
      sets_count:          s.setsCount,
      reps:                s.reps ?? null,
      reps_note:           s.repsNote ?? null,
      percentage:          s.percentage ?? null,
      target_rpe:          s.targetRpe ?? null,
      tempo:               s.tempo ?? null,
      rest_seconds:        s.restSeconds ?? null,
    }))

    const { error: tsErr } = await supabase.from('template_sets').insert(setRows)
    if (tsErr) { console.error(`template_sets W${day.weekNumber}D${day.dayNumber}:`, tsErr); continue }
    console.log(`  ✓ W${day.weekNumber} D${day.dayNumber} — ${day.name} (${setRows.length} set groups)`)
  }

  console.log('\nDone!')
}

seed().catch(e => { console.error(e); process.exit(1) })

