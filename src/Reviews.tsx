import { useEffect, useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { sb } from './supabase'
export default function Reviews({ pubId, s }: { pubId: string; s: Session | null | undefined }) {
  const [list, setL] = useState<any[]>([]); const [rating, setR] = useState(5); const [text, setT] = useState(''); const [msg, setM] = useState('')
  const load = () => sb.from('reviews_public').select('user_id,rating,comment,created_at,author_name').eq('publication_id', pubId).order('created_at', { ascending: false })
    .then(({ data }) => { setL(data || []); const m = data?.find((x: any) => x.user_id === s?.user.id); if (m) { setR(m.rating); setT(m.comment || '') } })
  useEffect(() => { load() }, [pubId, s])
  async function save(e: FormEvent) {
    e.preventDefault()
    const { error } = await sb.from('reviews').upsert({ publication_id: pubId, user_id: s!.user.id, rating, comment: text.trim() || null }, { onConflict: 'publication_id,user_id' })
    setM(error ? 'Could not save your review.' : 'Review saved.'); load()
  }
  return <section style={{ marginTop: 48 }}><h2>Ratings and comments</h2>
    {s ? <form onSubmit={save} style={{ maxWidth: 520 }}>
      <label>Your rating <select value={rating} onChange={e => setR(Number(e.target.value))}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}</select></label>
      <textarea rows={3} maxLength={1000} placeholder="Add a comment (optional)" value={text} onChange={e => setT(e.target.value)} />
      <button className="btn">Save review</button>{msg && <p role="status">{msg}</p>}</form>
      : <p className="muted"><Link to="/login">Sign in</Link> to rate and comment.</p>}
    {list.map((r, i) => <div key={i} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
      <strong>{r.author_name}</strong> <span className="muted">{r.rating} ★ · {new Date(r.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
      {r.comment && <p style={{ margin: '4px 0 0' }}>{r.comment}</p>}</div>)}</section>
}
