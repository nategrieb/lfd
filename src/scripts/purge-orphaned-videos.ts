/**
 * Purge orphaned video/thumbnail files from Supabase Storage.
 *
 * A file is "orphaned" if it exists in the `workout-videos` bucket but is not
 * referenced by any active `video_url` or `thumbnail_url` value in the `sets` table.
 *
 * Usage:
 *   npx tsx src/scripts/purge-orphaned-videos.ts
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← service role key (bypasses RLS for full scan)
 *
 * Pass --dry-run to list orphans without deleting them:
 *   npx tsx src/scripts/purge-orphaned-videos.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET       = 'workout-videos'
const DRY_RUN      = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ────────────────────────────────────────────────────────────────

/** Extract the storage object path from a full public URL. */
function urlToStoragePath(url: string): string | null {
  const prefix = '/storage/v1/object/public/' + BUCKET + '/'
  const idx = url.indexOf(prefix)
  if (idx < 0) return null
  const tail = url.slice(idx + prefix.length)
  return tail.includes('?') ? tail.slice(0, tail.indexOf('?')) : tail
}

/**
 * List every object under an optional prefix in the bucket.
 * Supabase Storage list() is paginated (max 1000 per call) and only lists
 * one level deep, so we recurse into sub-folders.
 */
async function listAllObjects(prefix = ''): Promise<string[]> {
  const paths: string[] = []
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } })

    if (error) throw new Error(`Storage list error at "${prefix}": ${error.message}`)
    if (!data || data.length === 0) break

    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) {
        // item is a folder — recurse
        const nested = await listAllObjects(fullPath)
        paths.push(...nested)
      } else {
        paths.push(fullPath)
      }
    }

    if (data.length < limit) break
    offset += limit
  }

  return paths
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '🔍  DRY RUN — no files will be deleted\n' : '🗑️  LIVE RUN — orphaned files will be deleted\n')

  // 1. Collect all active storage paths from the DB.
  console.log('Fetching active URLs from database…')
  const { data: sets, error: dbErr } = await supabase
    .from('sets')
    .select('video_url, thumbnail_url')
    .or('video_url.not.is.null,thumbnail_url.not.is.null')

  if (dbErr) throw new Error(`DB query failed: ${dbErr.message}`)

  const activePaths = new Set<string>()
  for (const row of sets ?? []) {
    for (const url of [row.video_url, row.thumbnail_url]) {
      if (!url) continue
      const p = urlToStoragePath(url)
      if (p) activePaths.add(p)
    }
  }
  console.log(`  ${activePaths.size} active file(s) referenced in DB\n`)

  // 2. List every file currently in the bucket.
  console.log('Listing all files in Storage bucket…')
  const allPaths = await listAllObjects()
  console.log(`  ${allPaths.length} total file(s) in bucket\n`)

  // 3. Diff — anything in Storage but not in the active set is orphaned.
  const orphans = allPaths.filter((p) => !activePaths.has(p))
  console.log(`  ${orphans.length} orphaned file(s) found`)

  if (orphans.length === 0) {
    console.log('\n✅  Nothing to clean up.')
    return
  }

  console.log('\nOrphaned files:')
  for (const p of orphans) console.log('  ', p)

  if (DRY_RUN) {
    console.log('\n⚠️  Dry run complete — rerun without --dry-run to delete.')
    return
  }

  // 4. Delete in batches of 100 (Supabase Storage remove() limit).
  console.log('\nDeleting…')
  const BATCH = 100
  let deleted = 0
  for (let i = 0; i < orphans.length; i += BATCH) {
    const batch = orphans.slice(i, i + BATCH)
    const { error } = await supabase.storage.from(BUCKET).remove(batch)
    if (error) {
      console.error(`  ⚠️  Error deleting batch starting at index ${i}: ${error.message}`)
    } else {
      deleted += batch.length
      console.log(`  Deleted ${deleted}/${orphans.length}…`)
    }
  }

  console.log(`\n✅  Done. ${deleted} orphaned file(s) removed.`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
