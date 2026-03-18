# MR-PRD: IronTrack Pro
**Version:** 1.0.0  
**Stack:** Vercel (Next.js/App Router), Supabase (Postgres/Auth/Storage), FFmpeg.wasm (Client-side Media)

## 1. System Overview
IronTrack Pro is a specialized fitness SaaS for powerlifting and bodybuilding. It focuses on **automated programming** via CSV ingestion, **hyper-local gym communities** through a "King of the Lift" (KOTL) voting system, and a **branded media pipeline** for social validation.

## 2. Core Logic & Implementation Requirements

### 2.1. The Programming Engine
* **Formula-Based Loading:** Weights must be calculated dynamically.
    * `PlannedWeight = round((User1RM * FormulaPercentage) / Increment) * Increment`
* **Meso-cycle Management:** Workouts are grouped into 6–8 week blocks (e.g., Candito, Calgary Barbell). 
* **Cascade Updates:** Updating a global 1RM in settings must recalculate all future sessions in the active block.

### 2.2. The "Golden Moment" Media Pipeline
* **Processing Engine:** `ffmpeg.wasm` running in a Web Worker.
* **Overlay Specifications:**
    * **HUD:** Exercise Name, Load (Weight), % of 1RM, and RPE.
    * **Branding:** IronTrack Pro logo + Gym Location Name watermark.
* **Workflow:** User records set -> App pulls metadata -> Client-side burn-in -> Upload to Supabase Storage.

### 2.3. Social & Community Mechanism
* **Gym Check-In:** GPS-bound. Users can only join a Gym Leaderboard if `geo_distance(User, Gym) < 200m`.
* **KOTL Voting:** Upvote/Downvote only. **Strictly No Comments.**
* **Activity Feed:** Chronological feed of videos, PR badges, and gym tags.

## 3. Database Schema (Supabase/Postgres)

```sql
-- Profiles: Stores 1RM data and settings
CREATE TABLE profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE,
  squat_1rm float8 DEFAULT 0,
  bench_1rm float8 DEFAULT 0,
  deadlift_1rm float8 DEFAULT 0,
  preferred_unit text DEFAULT 'lb', 
  is_premium boolean DEFAULT false
);

-- Gyms: Location-based community hubs
CREATE TABLE gyms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text,
  location geography(POINT),
  is_managed boolean DEFAULT false
);

-- Workout_Sets: The core data for logging and media
CREATE TABLE workout_sets (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  exercise_name text,
  weight_actual float8,
  reps_actual int,
  rpe float8,
  video_url text, 
  gym_id uuid REFERENCES gyms(id),
  is_kotl_entry boolean DEFAULT false
);
```
