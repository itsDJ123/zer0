import { useEffect, useState, FormEvent } from 'react'
import { Routes, Route, Link, Navigate, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { sb, cr, cost, stars } from './supabase'
import Compiler from './Compiler'
import Reader from './Reader'
import Reviews from './Reviews'
import AdminPanel from './AdminPanel'
import { Tags } from './Tags'

function useSession() {
  const [s, setS] = useState<Session | null | undefined>(undefined)
  useEffect(() => { sb.auth.getSession().then(({ data }) => setS(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, x) => setS(x)); return () => data.subscription.unsubscribe() }, [])
  return s
}
function useRoles(s: Session | null | undefined) {
  const [r, setR] = useState<string[]>([])
  useEffect(() => { if (s) sb.from('user_roles').select('role').then(({ data }) => setR((data || []).map((x: any) => x.role))); else setR([]) }, [s])
  return r
}
const Cover = ({ t }: { t: string }) => <div className="cover" aria-hidden>{t.slice(0, 1)}</div>

function Shell({ s, admin, children }: { s: Session | null | undefined; admin: boolean; children: any }) {
  const nav = useNavigate(); const loc = useLocation(); const [c, setC] = useState<number | null>(null)
  useEffect(() => { if (s) sb.from('profiles').select('credits').eq('id', s.user.id).maybeSingle().then(({ data }) => setC(data?.credits ?? null)); else setC(null) }, [s, loc.pathname])
  return <>
    <header><div className="wrap"><div className="row" style={{ gap: 6 }}><button className="navbtn" aria-label="Back" onClick={() => nav(-1)}>←</button><button className="navbtn" aria-label="Forward" onClick={() => nav(1)}>→</button><button className="navbtn" aria-label="Refresh" onClick={() => window.location.reload()}>↻</button></div><Link to="/" className="logo">∅ Zer0</Link><div className="sp" />
      <nav><Link to="/catalogue">Catalogue</Link><Link to="/compiler">Python</Link>
        {s ? <><Link to="/library">Library</Link><Link to="/profile">Profile</Link>{admin && <Link to="/admin">Admin</Link>}
          <span className="pill" style={{ marginLeft: 16 }}>{c ?? 0} credits</span>
          <a href="#" onClick={e => { e.preventDefault(); sb.auth.signOut() }}>Sign out</a></>
          : <Link to="/login">Sign in</Link>}</nav></div></header>
    <main><div className="wrap">{children}</div></main>
    <footer><div className="wrap">∅ Zer0</div></footer></>
}

function Cards({ items, empty }: { items: any[]; empty: string }) {
  if (!items.length) return <p className="muted">{empty}</p>
  return <div className="grid">{items.map(p => <Link key={p.id} to={'/p/' + p.slug} className="card" style={{ textDecoration: 'none' }}>
    <Cover t={p.title} /><strong>{p.title}</strong><span className="muted">{p.summary}</span><span>{cr(p.price_paise)}</span><span className="muted">by {p.author_name}</span><Tags tags={p.tags} /><span>{cr(p.price_paise)}</span><span className="muted">{stars(p)}</span></Link>)}</div>
}

function Home() {
  const nav = useNavigate(); const [q, setQ] = useState(''); const [recent, setRecent] = useState<any[]>([])
  useEffect(() => { sb.from('catalogue').select('id,slug,title,summary,price_paise,avg_rating,rating_count,author_name,tags').order('published_at', { ascending: false }).limit(4).then(({ data }) => setRecent(data || [])) }, [])
  return <>
    <h1>Independent learning materials, published by Zer0.</h1>
    <p className="muted" style={{ fontSize: '1.1rem' }}>Explore ideas across disciplines. Learn from independent student authors.</p>
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); nav('/catalogue?q=' + encodeURIComponent(q)) }} style={{ maxWidth: 520, gridTemplateColumns: '1fr auto' }}>
      <input aria-label="Search" placeholder="Search titles, topics, authors" value={q} onChange={e => setQ(e.target.value)} />
      <button className="btn">Search</button></form>
    <h2 style={{ marginTop: 48 }}>Recently published</h2><Cards items={recent} empty="Nothing published yet." />
    <h2 style={{ marginTop: 48 }}>How it works</h2>
    <p>Browse freely. Sign in, spend credits on a publication, and it is added to your Library straight away.</p></>
}

function Catalogue() {
  const [sp, setSp] = useSearchParams(); const q = sp.get('q') || ''; const sort = sp.get('sort') || 'new'; const [items, setItems] = useState<any[]>([])
  useEffect(() => {
    let r = sb.from('catalogue').select('id,slug,title,summary,price_paise,avg_rating,rating_count,author_name,tags')
    if (q) { const t = q.replace(/[%,()]/g, ' '); r = r.or(`title.ilike.%${t}%,summary.ilike.%${t}%,author_name.ilike.%${t}%,tag_names.ilike.%${t}%`) }
    r = sort === 'title' ? r.order('title') : sort === 'price' ? r.order('price_paise') : sort === 'rating' ? r.order('avg_rating', { ascending: false }).order('rating_count', { ascending: false }) : r.order('published_at', { ascending: false })
    r.limit(60).then(({ data }) => setItems(data || []))
  }, [q, sort])
  return <><h1>Catalogue</h1>
    <div className="row"><input style={{ maxWidth: 360 }} aria-label="Search" placeholder="Search" value={q} onChange={e => setSp({ q: e.target.value, sort })} />
      <select style={{ maxWidth: 180 }} aria-label="Sort" value={sort} onChange={e => setSp({ q, sort: e.target.value })}>
        <option value="new">Newest</option><option value="rating">Top rated</option><option value="title">Title</option><option value="price">Price</option></select></div>
    <Cards items={items} empty="No publications match your search." /></>
}

function Publication({ s }: { s: Session | null | undefined }) {
  const { slug } = useParams(); const nav = useNavigate()
  const [p, setP] = useState<any>(null); const [owned, setOwned] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  useEffect(() => { sb.from('catalogue').select('id,slug,title,summary,price_paise,published_at,avg_rating,rating_count,author_name,tags').eq('slug', slug!).maybeSingle().then(({ data }) => setP(data || false)) }, [slug])
  useEffect(() => { if (s && p) sb.from('document_entitlements').select('id').eq('publication_id', p.id).is('revoked_at', null).maybeSingle().then(({ data }) => setOwned(!!data)) }, [s, p])
  if (p === null) return <p className="muted">Loading…</p>
  if (p === false) return <p>Publication not found.</p>
  async function buy() {
    if (!s) return nav('/login?next=' + encodeURIComponent('/p/' + slug))
    setBusy(true); setErr(''); const { error } = await sb.rpc('buy_publication', { p_publication: p.id })
    if (!error) return nav('/library')
    setErr(error.message.includes('insufficient') ? `You need ${cost(p.price_paise)} credits. Ask Zer0 to add credits to your account.` : 'Purchase failed. Please try again.'); setBusy(false)
  }
  return <div className="row" style={{ alignItems: 'flex-start', gap: 40 }}>
    <div style={{ width: 220 }}><Cover t={p.title} /></div>
    <div style={{ flex: 1, minWidth: 260 }}><h1>{p.title}</h1><p className="muted">by {p.author_name}</p><Tags tags={p.tags} /><p>{p.summary}</p>
      <p><strong>{cr(p.price_paise)}</strong> <span className="muted">Published {new Date(p.published_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span></p>
      {owned ? <Link className="btn" to="/library">Open in Library</Link> : <button className="btn" disabled={busy} onClick={buy}>Buy with credits</button>}
      <p className="muted">{stars(p)}</p>{err && <p role="alert">{err}</p>}</div>
    <div style={{ flexBasis: '100%' }}><Reviews pubId={p.id} s={s} /></div></div>
}

function Auth({ mode }: { mode: 'login' | 'register' }) {
  const nav = useNavigate(); const [sp] = useSearchParams(); const next = sp.get('next') || '/library'
  const [name, setN] = useState(''); const [email, setE] = useState(''); const [pw, setP] = useState(''); const [msg, setM] = useState('')
  async function go(e: FormEvent) {
    e.preventDefault(); setM('')
    const { error, data } = mode === 'login' ? await sb.auth.signInWithPassword({ email, password: pw }) : await sb.auth.signUp({ email, password: pw, options: { data: { display_name: name.trim() } } })
    if (error) return setM(error.message)
    if (data.session) nav(next); else setM('Check your email to verify your account, then sign in.')
  }
  return <><h1>{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
    <form onSubmit={go}>{mode === 'register' && <input placeholder="Display name (shown on reviews)" maxLength={40} value={name} onChange={e => setN(e.target.value)} />}<input type="email" required placeholder="Email" value={email} onChange={e => setE(e.target.value)} />
      <input type="password" required minLength={8} placeholder="Password (8+ characters)" value={pw} onChange={e => setP(e.target.value)} />
      <button className="btn">{mode === 'login' ? 'Sign in' : 'Register'}</button>{msg && <p role="alert">{msg}</p>}</form>
    {mode === 'login' && <p className="muted"><Link to="/forgot">Forgot password?</Link></p>}<p className="muted">{mode === 'login' ? <>New here? <Link to={'/register?next=' + encodeURIComponent(next)}>Create an account</Link></> : <>Have an account? <Link to={'/login?next=' + encodeURIComponent(next)}>Sign in</Link></>}</p></>
}

function Forgot() {
  const [email, setE] = useState(''); const [msg, setM] = useState('')
  async function go(e: FormEvent) {
    e.preventDefault()
    await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })
    setM('If an account exists for that email, a reset link is on its way.')
  }
  return <><h1>Reset password</h1><form onSubmit={go}><input type="email" required placeholder="Email" value={email} onChange={e => setE(e.target.value)} />
    <button className="btn">Send reset link</button>{msg && <p role="status">{msg}</p>}</form></>
}

function Reset({ s }: { s: Session | null }) {
  const nav = useNavigate(); const [pw, setP] = useState(''); const [msg, setM] = useState('')
  async function go(e: FormEvent) {
    e.preventDefault(); const { error } = await sb.auth.updateUser({ password: pw })
    if (error) setM(error.message); else nav('/library')
  }
  if (!s) return <><h1>Set a new password</h1><p>Open this page from the link in your reset email. <Link to="/forgot">Send a new link</Link></p></>
  return <><h1>Set a new password</h1><form onSubmit={go}><input type="password" required minLength={8} placeholder="New password (8+ characters)" value={pw} onChange={e => setP(e.target.value)} />
    <button className="btn">Update password</button>{msg && <p role="alert">{msg}</p>}</form></>
}

function Library() {
  const [rows, setR] = useState<any[] | null>(null)
  useEffect(() => { sb.from('document_entitlements').select('publication_id,created_at,publications(title,summary)').is('revoked_at', null).order('created_at', { ascending: false }).then(({ data }) => setR(data || [])) }, [])
  if (!rows) return <p className="muted">Loading…</p>
  return <><h1>Library</h1>{!rows.length ? <><p><strong>Your Library is empty.</strong></p><p className="muted">Explore the Zer0 catalogue and find something worth learning.</p><Link className="btn" to="/catalogue">Browse catalogue</Link></> :
    <div className="grid">{rows.map(r => <div className="card" key={r.publication_id}><Cover t={r.publications?.title || ''} />
      <strong>{r.publications?.title}</strong><span className="muted">{r.publications?.summary}</span>
      <span className="muted">Added {new Date(r.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
      <Link className="btn" to={'/read/' + r.publication_id}>Read</Link></div>)}</div>}</>
}

function Profile({ s, roles }: { s: Session; roles: string[] }) {
  const [c, setC] = useState(0); const [name, setN] = useState(''); const [sales, setS] = useState<any[]>([]); const [msg, setM] = useState('')
  const contributor = roles.includes('contributor')
  useEffect(() => { sb.from('profiles').select('credits,display_name').eq('id', s.user.id).maybeSingle().then(({ data }) => { setC(data?.credits ?? 0); setN(data?.display_name || '') })
    if (contributor) sb.rpc('my_sales').then(({ data }) => setS(data || [])) }, [s, contributor])
  async function save(e: FormEvent) { e.preventDefault(); const { error } = await sb.from('profiles').update({ display_name: name.trim() }).eq('id', s.user.id); setM(error ? 'Could not save.' : 'Saved.') }
  return <><h1>Profile</h1><p><span className="pill">{contributor ? 'Contributor' : 'User'}</span> <span className="muted">{s.user.email}</span></p>
    <p>Credits: <strong>{c}</strong></p>
    <form onSubmit={save}><label>Display name<input maxLength={40} value={name} onChange={e => setN(e.target.value)} /></label><button className="btn alt">Save</button>{msg && <p role="status">{msg}</p>}</form>
    {contributor && <><h2 style={{ marginTop: 48 }}>Your published materials</h2>{!sales.length ? <p className="muted">Nothing published yet.</p> :
      <table><thead><tr><th>Title</th><th>Sales</th></tr></thead><tbody>{sales.map(r => <tr key={r.publication_id}><td><Link to={'/p/' + r.slug}>{r.title}</Link></td><td>{r.sales}</td></tr>)}</tbody></table>}
      <p className="muted">Your published materials are also in your Library.</p></>}</>
}

export default function App() {
  const s = useSession(); const roles = useRoles(s); const admin = roles.includes('admin'); const loc = useLocation()
  if (s === undefined) return null
  const guard = (el: JSX.Element) => s ? el : <Navigate to={'/login?next=' + encodeURIComponent(loc.pathname)} />
  return <Shell s={s} admin={admin}><Routes>
    <Route path="/" element={<Home />} /><Route path="/catalogue" element={<Catalogue />} /><Route path="/compiler" element={<Compiler />} />
    <Route path="/p/:slug" element={<Publication s={s} />} />
    <Route path="/login" element={<Auth mode="login" />} /><Route path="/register" element={<Auth mode="register" />} />
    <Route path="/library" element={guard(<Library />)} /><Route path="/profile" element={s ? <Profile s={s} roles={roles} /> : guard(<></>)} /><Route path="/read/:id" element={s ? <Reader email={s.user.email || ""} /> : guard(<></>)} />
    <Route path="/admin" element={admin ? <AdminPanel /> : <p>Not authorised.</p>} />
    <Route path="/forgot" element={<Forgot />} /><Route path="/reset-password" element={<Reset s={s} />} /><Route path="*" element={<p>Page not found.</p>} /></Routes></Shell>
}
