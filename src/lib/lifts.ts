/**
 * Lift name normalization for LFD.
 *
 * The Strong app exports exercise names with parenthetical equipment qualifiers
 * like "Bench Press (Barbell)". Manual entries may say "Bench Press" or
 * "Barbell Bench Press". This utility normalises all variants to a single
 * canonical display name so that progress is tracked across naming styles.
 */

// Canonical name → array of known aliases (lowercase, for reverse-lookup)
const ALIASES: Record<string, string[]> = {
  'Back Squat': [
    'squat', 'squat (barbell)', 'back squat (barbell)', 'barbell squat',
    'barbell back squat', 'back squat',
    'high bar squat', 'high bar squat (barbell)', 'high bar back squat',
    'high bar back squat (barbell)', 'low bar squat', 'low bar squat (barbell)',
    'low bar back squat', 'low bar back squat (barbell)',
  ],
  'Bench Press': [
    'bench press (barbell)', 'barbell bench press', 'flat bench press',
    'flat bench press (barbell)', 'bench press',
  ],
  'Deadlift': [
    'deadlift (barbell)', 'barbell deadlift', 'conventional deadlift',
    'conventional deadlift (barbell)', 'deadlift',
  ],
  'Overhead Press': [
    'overhead press (barbell)', 'barbell overhead press', 'military press',
    'military press (barbell)', 'press (barbell)', 'shoulder press (barbell)',
    'ohp', 'overhead press',
  ],
  'Barbell Row': [
    'bent over row (barbell)', 'barbell bent over row', 'barbell row',
    'bent-over row (barbell)', 'barbell bent-over row',
    'pendlay row (barbell)', 'pendlay row',
  ],
  'Romanian Deadlift': [
    'romanian deadlift (barbell)', 'rdl (barbell)', 'rdl',
    'romanian deadlift',
  ],
  'Front Squat': [
    'front squat (barbell)', 'barbell front squat', 'front squat',
  ],
  'Incline Bench Press': [
    'incline bench press (barbell)', 'incline barbell bench press',
    'incline bench press (dumbbell)', 'incline dumbbell bench press',
    'incline bench press',
  ],
  'Close-Grip Bench Press': [
    'close grip bench press (barbell)', 'close-grip bench press (barbell)',
    'close grip bench press', 'close-grip bench press',
  ],
  'Sumo Deadlift': [
    'sumo deadlift (barbell)', 'sumo deadlift',
  ],
  'Push Press': [
    'push press (barbell)', 'barbell push press', 'push press',
  ],
  'Good Morning': [
    'good morning (barbell)', 'barbell good morning', 'good morning',
  ],
  'Hip Thrust': [
    'hip thrust (barbell)', 'barbell hip thrust', 'hip thrust',
  ],
  'Hack Squat': [
    'hack squat (barbell)', 'hack squat (sled)', 'hack squat',
  ],
  'Leg Press': [
    'leg press (sled)', 'leg press (machine)', 'leg press',
  ],
  'Dumbbell Bench Press': [
    'bench press (dumbbell)', 'dumbbell bench press',
    'flat dumbbell bench press', 'flat bench press (dumbbell)',
  ],
  'Dumbbell Shoulder Press': [
    'shoulder press (dumbbell)', 'dumbbell shoulder press',
    'seated dumbbell shoulder press', 'seated shoulder press (dumbbell)',
  ],
  'Dumbbell Row': [
    'one arm row (dumbbell)', 'dumbbell row', 'single-arm dumbbell row',
    'single arm dumbbell row (dumbbell)', 'dumbbell bent-over row',
  ],
  'Dumbbell Curl': [
    'bicep curl (dumbbell)', 'dumbbell curl', 'dumbbell bicep curl',
    'curl (dumbbell)',
  ],
  'Barbell Curl': [
    'bicep curl (barbell)', 'barbell curl', 'barbell bicep curl',
    'curl (barbell)', 'ez bar curl', 'ez-bar curl (ez-bar)',
  ],
  'Pull-Up': [
    'pull-up', 'pull up', 'pullup',
    'pull-up (bodyweight)', 'pull-up (weighted)', 'weighted pull-up',
  ],
  'Chin-Up': [
    'chin-up', 'chin up', 'chinup',
    'chin-up (bodyweight)', 'chin-up (weighted)',
  ],
  'Lat Pulldown': [
    'lat pulldown (cable)', 'lat pulldown', 'pull-down (cable)',
    'wide grip lat pulldown (cable)',
  ],
  'Seated Cable Row': [
    'seated row (cable)', 'seated cable row', 'cable row',
    'low row (cable)',
  ],
  'Tricep Pushdown': [
    'tricep pushdown (cable)', 'tricep push-down (cable)',
    'tricep pushdown', 'push-down (cable)',
  ],
  'Skull Crusher': [
    'skull crusher (barbell)', 'skull crushers (barbell)',
    'lying tricep extension (barbell)', 'skull crusher',
  ],
  'Leg Curl': [
    'leg curl (machine)', 'lying leg curl (machine)', 'seated leg curl (machine)',
    'leg curl',
  ],
  'Leg Extension': [
    'leg extension (machine)', 'leg extension',
  ],
  'Calf Raise': [
    'standing calf raise (machine)', 'seated calf raise (machine)',
    'calf raise (machine)', 'calf raise',
  ],
}

// Reverse lookup: lowercase alias → canonical display name
const ALIAS_MAP = new Map<string, string>()
for (const [canonical, aliases] of Object.entries(ALIASES)) {
  ALIAS_MAP.set(canonical.toLowerCase(), canonical)
  for (const alias of aliases) {
    ALIAS_MAP.set(alias.toLowerCase(), canonical)
  }
}

// Equipment qualifiers that can safely be stripped from "Name (Qualifier)" patterns
const EQUIPMENT = new Set([
  'barbell', 'dumbbell', 'dumbbells', 'cable', 'machine', 'band', 'bands',
  'bodyweight', 'weighted', 'kettlebell', 'ez-bar', 'ez bar',
  'smith machine', 'sled', 'plate', 'plates',
])

function stripEquipmentQualifier(name: string): string {
  const match = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/i)
  if (!match) return name
  const qualifier = match[2].toLowerCase().trim()
  return EQUIPMENT.has(qualifier) ? match[1].trim() : name
}

/**
 * Returns the canonical display name for an exercise.
 * Falls back to the trimmed original (with equipment qualifier stripped) if
 * no explicit alias mapping exists.
 */
export function canonicalName(raw: string): string {
  if (!raw) return raw
  const trimmed = raw.trim()

  // 1. Exact reverse-lookup (case-insensitive)
  const direct = ALIAS_MAP.get(trimmed.toLowerCase())
  if (direct) return direct

  // 2. Strip equipment qualifier and try again
  const stripped = stripEquipmentQualifier(trimmed)
  if (stripped !== trimmed) {
    const afterStrip = ALIAS_MAP.get(stripped.toLowerCase())
    if (afterStrip) return afterStrip
    return stripped // clean name without the redundant "(Equipment)" qualifier
  }

  return trimmed
}

/**
 * Returns a URL-safe slug for an exercise name.
 * e.g. "Back Squat" → "back-squat"
 */
export function nameToSlug(name: string): string {
  return canonicalName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Converts a URL slug back to a canonical display name.
 * e.g. "back-squat" → "Back Squat"
 */
export function slugToCanonical(slug: string): string {
  // Scan known canonicals for a slug match
  for (const canonical of Object.keys(ALIASES)) {
    if (nameToSlug(canonical) === slug) return canonical
  }
  // Fall back to title-casing the slug
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Epley estimated one-rep max.
 * Returns null for reps > 10 (formula is unreliable beyond that range).
 */
export function epley1RM(weight: number, reps: number): number | null {
  if (reps <= 0 || reps > 10 || weight <= 0) return null
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}
