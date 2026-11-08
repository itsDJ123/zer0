import { useEffect, useRef, useState, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { sb, cost } from './supabase'

const credits = () => window.dispatchEvent(new Event('credits'))

export function Inbox() {
  const nav = useNavigate(); const [convs, setC] = useState<any[]>([]); const [q, setQ] = useState(''); const [res, setR] = useState<any[]>([]); const [msg, setM] = useState('')
  useEffect(() => { sb.rpc('my_conversations').then(({ data }) => setC(data || [])) }, [])
  async function search(e: FormEvent) {
    e.preventDefault(); if (q.trim().length < 2) return setM('Type at least 2 letters of a display name.')
    const { data, error } = await sb.rpc('find_users', { p_q: q.trim() }); setR(data || []); setM(error ? 'Search failed.' : data?.length ? '' : 'No one found with that name.')
  }
  async function open(id: string) { const { data, error } = await sb.rpc('start_conversation', { p_other: id }); if (error) return setM(error.message); nav('/messages/' + data) }
  return <><h1>Messages</h1>
    <form onSubmit={search} style={{ gridTemplateColumns: '1fr auto', maxWidth: 480 }}><input placeholder="Find someone by display name" value={q} onChange={e => setQ(e.target.value)} /><button className="btn">Search</button></form>
    {msg && <p role="status" className="muted">{msg}</p>}
    {res.map(u => <div key={u.id} className="row" style={{ padding: '6px 0' }}><strong>{u.name}</strong><button className="btn alt" onClick={() => open(u.id)}>Message</button></div>)}
    <h2 style={{ marginTop: 32 }}>Conversations</h2>
    {!convs.length ? <p className="muted">No conversations yet.</p> : convs.map(c => <div key={c.id} className="card" style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => nav('/messages/' + c.id)}>
      <strong>{c.other_name}</strong><span className="muted">{c.last_body || 'No messages yet'}</span></div>)}</>
}

export function Conversation({ s }: { s: Session }) {
  const { id } = useParams(); const end = useRef<HTMLDivElement>(null)
  const [msgs, setMsgs] = useState<any[]>([]); const [other, setO] = useState<any>(null); const [blocked, setB] = useState(false); const [text, setT] = useState('')
  const [err, setE] = useState(''); const [panel, setP] = useState<'' | 'credits' | 'gift'>(''); const [amt, setA] = useState('50'); const [pubs, setPubs] = useState<any[]>([]); const [pick, setPick] = useState('')
  const load = async () => { const { data } = await sb.from('messages').select('id,sender_id,kind,body,created_at').eq('conversation_id', id!).order('id').limit(200); setMsgs(data || []) }
  useEffect(() => {
    load()
    sb.rpc('my_conversations').then(({ data }) => { const c = (data || []).find((x: any) => x.id === id); setO(c || null)
      if (c) sb.from('blocks').select('blocked').eq('blocked', c.other_id).then(({ data: b }) => setB(!!b?.length)) })
    const ch = sb.channel('chat-' + id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, () => load()).subscribe()
    const t = setInterval(load, 20000); return () => { sb.removeChannel(ch); clearInterval(t) }
  }, [id])
  useEffect(() => { end.current?.scrollIntoView() }, [msgs])
  const run = async (p: PromiseLike<{ error: any }>, ok?: () => void) => { setE(''); const { error } = await p; if (error) setE(error.message); else { ok?.(); load(); credits() } }
  const fee = Math.ceil((Number(amt) || 0) * 0.05)
  async function openGift() { setP('gift'); const { data } = await sb.from('catalogue').select('id,title,price_paise').order('title'); setPubs(data || []) }
  if (other === null && !msgs.length) return <p className="muted">Loading…</p>
  return <><h1>{other?.other_name || 'Conversation'}</h1>
    <div className="row" style={{ marginBottom: 12 }}>
      <button className="btn alt" disabled={blocked} onClick={() => setP(panel === 'credits' ? '' : 'credits')}>Send credits</button>
      <button className="btn alt" disabled={blocked} onClick={() => panel === 'gift' ? setP('') : openGift()}>Gift a publication</button>
      <button className="btn alt" onClick={() => run(sb.rpc('block_user', { p_user: other.other_id, p_on: !blocked }), () => setB(!blocked))}>{blocked ? 'Unblock' : 'Block'}</button></div>
    {panel === 'credits' && <div className="card" style={{ marginBottom: 12, maxWidth: 420 }}>
      <label>Credits to send (10–1000)<input type="number" min="10" max="1000" value={amt} onChange={e => setA(e.target.value)} /></label>
      <span className="muted">A 5% service fee applies. They receive {Math.max(0, (Number(amt) || 0) - fee)}, you pay {Number(amt) || 0}.</span>
      <button className="btn" onClick={() => window.confirm(`Send ${amt} credits?`) && run(sb.rpc('transfer_credits', { p_conv: id, p_amount: Number(amt) }), () => setP(''))}>Send</button></div>}
    {panel === 'gift' && <div className="card" style={{ marginBottom: 12, maxWidth: 420 }}>
      <select value={pick} onChange={e => setPick(e.target.value)} aria-label="Publication"><option value="">Choose a publication…</option>{pubs.map(p => <option key={p.id} value={p.id}>{p.title} — {cost(p.price_paise)} credits</option>)}</select>
      <span className="muted">You pay the full price; they get the publication in their Library.</span>
      <button className="btn" disabled={!pick} onClick={() => window.confirm('Buy this as a gift?') && run(sb.rpc('gift_publication', { p_conv: id, p_publication: pick }), () => { setP(''); setPick('') })}>Send gift</button></div>}
    {err && <p role="alert">{err}</p>}
    <div className="msgs" aria-live="polite">{msgs.map(m => <div key={m.id} className={'bubble' + (m.sender_id === s.user.id ? ' me' : '') + (m.kind !== 'text' ? ' sys' : '')}>
      {m.body}<div className="muted" style={{ fontSize: '.75rem' }}>{new Date(m.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
        {m.sender_id !== s.user.id && <> · <a href="#" onClick={ev => { ev.preventDefault(); const r = window.prompt('Why are you reporting this message?'); if (r) run(sb.rpc('report_message', { p_message: m.id, p_reason: r })) }}>Report</a></>}</div></div>)}<div ref={end} /></div>
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (text.trim()) run(sb.rpc('send_message', { p_conv: id, p_body: text }), () => setT('')) }} style={{ gridTemplateColumns: '1fr auto', maxWidth: 'none', marginTop: 12 }}>
      <input maxLength={2000} placeholder={blocked ? 'You blocked this person' : 'Write a message'} disabled={blocked} value={text} onChange={e => setT(e.target.value)} /><button className="btn" disabled={blocked}>Send</button></form>
    <p className="muted">Never share passwords or personal details. Reports are reviewed by the Zer0 admin.</p></>
}
