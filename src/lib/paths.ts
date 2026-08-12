import path from 'node:path'

/**
 * Env-driven path resolution (single source of truth).
 * DATA_PATH / MEDIA_PATH / DATA_DIR let content, media, and runtime data live
 * outside the repo (e.g. /srv/1edge/content on prod, /var/data/test on test).
 * Falls back to the in-repo defaults when unset.
 */
export const ROOT = process.cwd()
export const CONTENT = process.env.DATA_PATH ? path.resolve(process.env.DATA_PATH) : path.join(ROOT, 'src/content')
export const MEDIA = process.env.MEDIA_PATH ? path.resolve(process.env.MEDIA_PATH) : path.join(ROOT, 'public/media')
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data')
