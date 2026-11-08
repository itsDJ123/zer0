import { useEffect, useState, FormEvent } from 'react'
import { sb } from './supabase'
import { Chip } from './Tags'
const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'untitled'
export default function AdminPanel() {
  const [users, setU] = useState<any[]>([]); const [contrib, setC] = useState<string[]>([]); const [msg, setM] = useState(''); const [busy, setB] = useState(false)
  const [f, setF] = useState({ title: '', summary: '', author: '', price: '0', share: '25', bonus: '0' }); const [file, setFile] = useState<File | null>(null); const [cover, setCover] = useState<File | null>(null)
  const load = async () => {
    const a = await sb.from('profiles').select('id,email,display_name,credits').order('email'); setU(a.data || [])
    const b = await sb.from('user_roles').select('user_id').eq('role', 'contributor'); setC((b.data || []).map((x: any) => x.user_id))
  }
  const [tags, setTags] = useState<any[]>([]); const [pubs, setPubs] = useState<any[]>([]); const [links, setLinks] = useState<string[]>([])
  const [rep, setRep] = useState<any[]>([]); const [tn, setTn] = useState(''); const [tc, setTc] = useState('#4f6bff')
  const loadTags = async () => {
    setTags((await sb.from('tags').select('id,name,color').order('name')).data || []); setPubs((await sb.from('publications').select('id,title').eq('status', 'published').order('title')).data || [])
    setLinks(((await sb.from('publication_tags').select('publication_id,tag_id')).data || []).map((x: any) => x.publication_id + ':' + x.tag_id))
  }
  useEffect(() => { load(); loadTags(); sb.from('message_reports').select('id,reason,body_snapshot,created_at').order('created_at', { ascending: false }).limit(50).then(({ data }) => setRep(data || [])) }, [])
  async function addTag(e: FormEvent) { e.preventDefault(); const { error } = await sb.from('tags').insert({ name: tn.trim(), color: tc }); setM(error ? 'Could not add tag (names must be unique).' : 'Tag added.'); setTn(''); loadTags() }
  async function delTag(id: string) { if (!window.confirm('Delete this tag from every publication?')) return; await sb.from('tags').delete().eq('id', id); loadTags() }
  async function toggle(pid: string, tid: string) {
    const on = links.includes(pid + ':' + tid)
    const { error } = on ? await sb.from('publication_tags').delete().eq('publication_id', pid).eq('tag_id', tid) : await sb.from('publication_tags').insert({ publication_id: pid, tag_id: tid })
    if (error) setM(error.message); loadTags()
  }
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  async function publish(e: FormEvent) {
    e.preventDefault(); setM('')
    if (!file || !f.author) return setM('Choose an author and a PDF.')
    if (file.type !== 'application/pdf' || file.size > 50 * 1024 * 1024) return setM('The file must be a PDF under 50 MB.')
    const price = Number(f.price), share = Number(f.share), bonus = Number(f.bonus)
    if ([price, share, bonus].some(n => !Number.isFinite(n) || n < 0) || share > 100) return setM('Check the price, share (0–100) and bonus.')
    setB(true); const slug = slugify(f.title) + '-' + Math.random().toString(36).slice(2, 6); const path = `${Date.now()}-${slug}.pdf`
    const up = await sb.storage.from('publications').upload(path, file, { contentType: 'application/pdf' }); if (up.error) { setB(false); return setM(up.error.message) }
    let coverPath: string | null = null
    if (cover) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(cover.type) || cover.size > 2 * 1024 * 1024) { setB(false); return setM('Cover must be a PNG, JPG or WebP under 2 MB.') }
      const ext = cover.type === 'image/png' ? 'png' : cover.type === 'image/webp' ? 'webp' : 'jpg'; coverPath = `${Date.now()}-${slug}.${ext}`
      const cu = await sb.storage.from('covers').upload(coverPath, cover, { contentType: cover.type }); if (cu.error) { setB(false); return setM(cu.error.message) }
    }
    const ins = await sb.from('publications').insert({ slug, cover_path: coverPath, title: f.title.trim(), summary: f.summary.trim(), author_id: f.author, price_paise: Math.round(price * 100),
      revenue_share_bps: Math.round(share * 100), bonus_paise: Math.round(bonus * 100), file_path: path, status: 'draft' }).select('id').single()
    if (ins.error) { setB(false); return setM(ins.error.message) }
    const pub = await sb.rpc('publish_publication', { p_pub: ins.data.id }); setB(false)
    if (pub.error) return setM(pub.error.message)
    setM('Published. The author has the bonus and the file in their Library.'); setF({ ...f, title: '', summary: '' }); setFile(null); setCover(null); load()
  }
  async function credits(u: any) {
    const v = window.prompt(`New credit balance for ${u.email} (currently ${u.credits}):`, String(u.credits)); if (v === null) return
    const n = Number(v); if (!Number.isInteger(n) || n < 0) return setM('Enter a whole number, 0 or more.')
    const { error } = await sb.rpc('admin_set_credits', { p_user: u.id, p_credits: n }); setM(error ? error.message : 'Credits updated.'); load()
  }
  async function role(u: any) { const on = !contrib.includes(u.id)
    const { error } = await sb.rpc('admin_set_contributor', { p_user: u.id, p_on: on }); setM(error ? error.message : on ? 'Made contributor.' : 'Contributor removed.'); load() }
  return <><h1>Admin</h1>{msg && <p role="status">{msg}</p>}
    <h2>Publish a document</h2>
    <form onSubmit={publish}>
      <input required placeholder="Title" value={f.title} onChange={set('title')} />
      <textarea required rows={3} placeholder="Summary" value={f.summary} onChange={set('summary')} />
      <select required value={f.author} onChange={set('author')} aria-label="Author"><option value="">Choose author…</option>{users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.email}</option>)}</select>
      <label>Price (credits)<input type="number" min="0" value={f.price} onChange={set('price')} /></label>
      <label>Author revenue share (%)<input type="number" min="0" max="100" value={f.share} onChange={set('share')} /></label>
      <label>Publication bonus (credits)<input type="number" min="0" value={f.bonus} onChange={set('bonus')} /></label>
      <label>Cover image (optional, PNG/JPG/WebP, max 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setCover(e.target.files?.[0] || null)} /></label>
      <label>PDF file<input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
      <button className="btn" disabled={busy}>{busy ? 'Publishing…' : 'Publish'}</button></form>
    <h2 style={{ marginTop: 48 }}>Tags</h2>
    <form onSubmit={addTag} style={{ display: 'flex', gap: 12, maxWidth: 'none', flexWrap: 'wrap' }}>
      <input style={{ maxWidth: 220 }} required maxLength={30} placeholder="Tag name" value={tn} onChange={e => setTn(e.target.value)} />
      <input type="color" aria-label="Tag colour" style={{ width: 56, padding: 2 }} value={tc} onChange={e => setTc(e.target.value)} />
      <button className="btn">Add tag</button></form>
    <div className="row" style={{ margin: '12px 0' }}>{tags.map(t => <span key={t.id}><Chip name={t.name} color={t.color} /> <button className="navbtn" style={{ width: 24, height: 24 }} aria-label={'Delete ' + t.name} onClick={() => delTag(t.id)}>×</button></span>)}</div>
    <h3>Tags on publications <span className="muted">(click a tag to add or remove it)</span></h3>
    {pubs.map(pb => <div key={pb.id} className="row" style={{ padding: '6px 0' }}><strong style={{ minWidth: 160 }}>{pb.title}</strong>
      {tags.map(t => <Chip key={t.id} name={t.name} color={t.color} dim={!links.includes(pb.id + ':' + t.id)} onClick={() => toggle(pb.id, t.id)} />)}</div>)}
    <h2 style={{ marginTop: 48 }}>Reported messages</h2>
    {!rep.length ? <p className="muted">No reports.</p> : <table><thead><tr><th>When</th><th>Message</th><th>Reason</th></tr></thead><tbody>{rep.map(r => <tr key={r.id}><td>{new Date(r.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</td><td>{r.body_snapshot}</td><td>{r.reason}</td></tr>)}</tbody></table>}
    <h2 style={{ marginTop: 48 }}>Users</h2>
    <table><thead><tr><th>Email</th><th>Type</th><th>Credits</th><th /></tr></thead><tbody>
      {users.map(u => <tr key={u.id}><td>{u.display_name ? u.display_name + ' · ' : ''}{u.email || u.id.slice(0, 8)}</td><td>{contrib.includes(u.id) ? 'Contributor' : 'User'}</td><td>{u.credits}</td>
        <td className="row"><button className="btn alt" onClick={() => credits(u)}>Set credits</button>
          <button className="btn alt" onClick={() => role(u)}>{contrib.includes(u.id) ? 'Make user' : 'Make contributor'}</button></td></tr>)}</tbody></table></>
}
