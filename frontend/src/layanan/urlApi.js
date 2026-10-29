// Public API base URL. Only the backend URL belongs in VITE_*; database and
// session credentials must stay in backend environment variables.
const env = import.meta?.env || {}
const root = String(env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export const URL_API = `${root}/api`
export const URL_UPLOADS = `${root}/uploads`

export function urlMedia(value) {
  const url = String(value || '')
  if (!url || /^(?:https?:|data:|blob:)/i.test(url)) return url
  return `${URL_UPLOADS}/${url.replace(/^\/?uploads\//, '').replace(/^\//, '')}`
}
