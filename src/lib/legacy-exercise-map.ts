/**
 * Maps older free-text / Strong-export exercise names to catalogue exercise names
 * (the `name` column of the exercises table). Keys are lowercase.
 *
 * Only unambiguous matches are listed. Variations that the catalogue has no entry for
 * (Pendlay row, Hammer Strength machines, ...) stay as free text until they're added.
 * Paused / tempo squat, bench and deadlift are tracked together with the base lift.
 */

const BENCH = 'Barbell Bench Press - Medium Grip'
const SQUAT = 'Barbell Squat'
const DEADLIFT = 'Barbell Deadlift'

export const LEGACY_EXERCISE_MAP: Record<string, string> = {
  // Bench
  'bench press (barbell)': BENCH,
  'bench': BENCH,
  'paused bench': BENCH,
  'incline bench press (barbell)': 'Barbell Incline Bench Press - Medium Grip',
  'bench press - close grip (barbell)': 'Close-Grip Barbell Bench Press',
  'bench press (dumbbell)': 'Dumbbell Bench Press',
  'incline bench (dumbell)': 'Incline Dumbbell Press',
  'incline bench press (dumbbell)': 'Incline Dumbbell Press',
  'chest press (machine)': 'Machine Bench Press',
  'incline chest press (machine)': 'Leverage Incline Chest Press',
  'chest fly (dumbbell)': 'Dumbbell Flyes',

  // Squat
  'squat (barbell)': SQUAT,
  'squat': SQUAT,
  'squat (paused)': SQUAT,
  'paused squats': SQUAT,
  'paused high bar squt': SQUAT,
  'tempo squat': SQUAT,
  'front squat (barbell)': 'Front Barbell Squat',
  'front squat (paused)': 'Front Barbell Squat',
  'jefferson squat': 'Jefferson Squats',

  // Deadlift
  'deadlift (barbell)': DEADLIFT,
  'deadlift': DEADLIFT,
  'paused deadlifts': DEADLIFT,
  'deficit deadlift (barbell)': 'Deficit Deadlift',
  'romanian deadlift (barbell)': 'Romanian Deadlift',
  'stiff leg deadlift (barbell)': 'Stiff-Legged Barbell Deadlift',

  // Press
  'overhead press (barbell)': 'Standing Military Press',
  'strict military press (barbell)': 'Standing Military Press',
  'seated overhead press (barbell)': 'Seated Barbell Military Press',
  'overhead press (dumbbell)': 'Dumbbell Shoulder Press',
  'seated overhead press (dumbbell)': 'Seated Dumbbell Press',
  'standing one arm shoulder press (dumbell)': 'Dumbbell One-Arm Shoulder Press',
  'arnold press (dumbbell)': 'Arnold Dumbbell Press',
  'shoulder press (machine)': 'Machine Shoulder (Military) Press',
  'shoulder press (plate loaded)': 'Leverage Shoulder Press',

  // Pull
  'pull up': 'Pullups',
  'pullup': 'Pullups',
  'pull ups': 'Pullups',
  'pull up (band)': 'Band Assisted Pull-Up',
  'lat pulldown (cable)': 'Wide-Grip Lat Pulldown',
  'lat pull downs': 'Wide-Grip Lat Pulldown',
  'lat pull down (close grip)': 'Close-Grip Front Lat Pulldown',
  'lat pulldown (single arm)': 'One Arm Lat Pulldown',
  'bent over row (barbell)': 'Bent Over Barbell Row',
  'bent over one arm row (dumbbell)': 'One-Arm Dumbbell Row',
  'dumbbell rows': 'One-Arm Dumbbell Row',
  'incline row (dumbbell)': 'Dumbbell Incline Row',
  'seated row (cable)': 'Seated Cable Rows',
  'cable row': 'Seated Cable Rows',
  'inverted row (bodyweight)': 'Inverted Row',
  'straight arm pull downs': 'Straight-Arm Pulldown',
  'straight arm pulldowns': 'Straight-Arm Pulldown',
  'straight-arm pull-downs': 'Straight-Arm Pulldown',
  'straight arm pull-downs': 'Straight-Arm Pulldown',
  'face pull (cable)': 'Face Pull',

  // Arms & shoulders
  'bicep curl (dumbbell)': 'Dumbbell Bicep Curl',
  'bicep curl (barbell)': 'Barbell Curl',
  'hammer curl (dumbbell)': 'Hammer Curls',
  'incline hammer curl': 'Incline Hammer Curls',
  'reverse curl (barbell)': 'Reverse Barbell Curl',
  'triceps pushdown (cable - straight bar)': 'Triceps Pushdown',
  'skullcrusher (barbell)': 'EZ-Bar Skullcrusher',
  'lateral raise (dumbbell)': 'Side Lateral Raise',
  'lateral raise': 'Side Lateral Raise',
  'lateral raises': 'Side Lateral Raise',
  'reverse fly': 'Reverse Flyes',
  'reverse fly (dumbbell)': 'Reverse Flyes',
  'reverse fly (machine)': 'Reverse Machine Flyes',
  'rear delt cable fly': 'Cable Rear Delt Fly',
  'shrug (barbell)': 'Barbell Shrug',
  'shrug (dumbbell)': 'Dumbbell Shrug',
  'dumbbell shrugs': 'Dumbbell Shrug',

  // Bodyweight
  'dips': 'Parallel Bar Dip',
  'chest dip': 'Dips - Chest Version',
  'push up': 'Pushups',
  'close grip push up': 'Push-Ups - Close Triceps Position',
  'push up legs up': 'Push-Ups With Feet Elevated',
  'sit ups': 'Sit-Up',
  'ab wheel': 'Ab Roller',
  "knee raise (captain's chair)": 'Knee/Hip Raise On Parallel Bars',

  // Legs
  'hip thrust (barbell)': 'Barbell Hip Thrust',
  'lunge (dumbbell)': 'Dumbbell Lunges',
  'lunge (barbell)': 'Barbell Lunge',
  'lying leg curl (machine)': 'Lying Leg Curls',
  'seated leg curl (machine)': 'Seated Leg Curl',
  'leg extension': 'Leg Extensions',
  'standing calf raise (barbell)': 'Standing Barbell Calf Raise',
  'standing calf raise (dumbbell)': 'Standing Dumbbell Calf Raise',
  'standing calf raise': 'Standing Calf Raises',
  'calf raise': 'Standing Calf Raises',
  'seated calf raise (plate loaded)': 'Seated Calf Raise',
  'calf press on leg press': 'Calf Press On The Leg Press Machine',

  // Other
  'clean (barbell)': 'Clean',
  'side bend (dumbbell)': 'Dumbbell Side Bend',
  'running (treadmill)': 'Running, Treadmill',
}

/** Catalogue name for an older exercise name, or null if there's no unambiguous match. */
export function resolveLegacyName(name: string): string | null {
  return LEGACY_EXERCISE_MAP[name.trim().toLowerCase()] ?? null
}
