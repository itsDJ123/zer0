import { createClient } from '@supabase/supabase-js'
export const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
// 1 credit = INR 1; prices are stored in paise.
export const cost = (paise: number) => Math.ceil(paise / 100)
export const cr = (paise: number) => cost(paise) === 0 ? 'Free' : cost(paise) + ' credits'
export const stars = (p: { avg_rating: number; rating_count: number }) =>
  p.rating_count ? `${Number(p.avg_rating).toFixed(1)} ★ (${p.rating_count})` : 'No ratings yet'
