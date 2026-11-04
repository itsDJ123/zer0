import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as pdfjs from 'pdfjs-dist'
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { sb } from './supabase'
pdfjs.GlobalWorkerOptions.workerSrc = worker

// Pages are drawn to canvas; there is no download button. A determined user can still capture the screen.
export default function Reader({ email }: { email: string }) {
  const { id } = useParams(); const box = useRef<HTMLDivElement>(null); const [msg, setMsg] = useState('Loading…'); const [title, setTitle] = useState('')
  useEffect(() => {
    let dead = false
    const block = (e: Event) => e.preventDefault()
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'c', 'a', 'u'].includes(e.key.toLowerCase())) e.preventDefault() }
    document.addEventListener('contextmenu', block); document.addEventListener('copy', block); document.addEventListener('keydown', key)
    ;(async () => {
      const { data: p } = await sb.from('publications').select('title,file_path').eq('id', id!).maybeSingle()
      if (!p) return setMsg('Not found.'); setTitle(p.title)
      const { data: blob, error } = await sb.storage.from('publications').download(p.file_path)
      if (error || !blob) return setMsg('You do not have access to this file.')
      const pdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise; setMsg('')
      for (let n = 1; n <= pdf.numPages && !dead; n++) {
        const page = await pdf.getPage(n); const vp = page.getViewport({ scale: 1.6 }); const c = document.createElement('canvas')
        c.width = vp.width; c.height = vp.height; c.style.cssText = 'width:100%;max-width:820px;display:block;margin:0 auto 16px;background:#fff'
        await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise; box.current?.appendChild(c)
      }
    })().catch(() => setMsg('Could not display this document.'))
    return () => { dead = true; document.removeEventListener('contextmenu', block); document.removeEventListener('copy', block); document.removeEventListener('keydown', key) }
  }, [id, email])
  return <div className="reader"><h1>{title}</h1>{msg && <p className="muted">{msg}</p>}<div ref={box} /></div>
}
