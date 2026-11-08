import { useEffect, useRef, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
const BASE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
const LIBS = ['numpy', 'pandas', 'matplotlib']
const SAMPLE = `import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(0, 2 * np.pi, 200)
plt.plot(x, np.sin(x))
plt.title("sin(x)")
print("done")
`
const CAPTURE = `import json, io, base64
import matplotlib.pyplot as plt
_o = []
for _n in plt.get_fignums():
    _b = io.BytesIO(); plt.figure(_n).savefig(_b, format='png', bbox_inches='tight'); _o.append(base64.b64encode(_b.getvalue()).decode())
plt.close('all')
json.dumps(_o)`
const w = window as any
function boot(): Promise<any> {
  if (w.__py) return Promise.resolve(w.__py)
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = BASE + 'pyodide.js'
    s.onload = async () => { try { w.__py = await w.loadPyodide({ indexURL: BASE }); res(w.__py) } catch (e) { rej(e) } }
    s.onerror = () => rej(new Error('Could not download Python. Check your connection.')); document.head.appendChild(s)
  })
}
export default function Compiler() {
  const host = useRef<HTMLDivElement>(null); const view = useRef<EditorView | null>(null); const [libs, setLibs] = useState<string[]>(['numpy', 'matplotlib'])
  const [out, setOut] = useState(''); const [imgs, setImgs] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [status, setStatus] = useState('')
  useEffect(() => {
    const v = new EditorView({ doc: SAMPLE, parent: host.current!, extensions: [basicSetup, keymap.of([indentWithTab]), python(), oneDark,
      EditorView.theme({ '&': { minHeight: '260px' }, '.cm-scroller': { fontFamily: 'ui-monospace,Menlo,monospace' } })] })
    view.current = v; return () => v.destroy()
  }, [])
  const toggle = (l: string) => setLibs(x => x.includes(l) ? x.filter(i => i !== l) : [...x, l])
  async function run() {
    setBusy(true); setOut(''); setImgs([])
    try {
      setStatus('Loading Python…'); const py = await boot()
      if (libs.length) { setStatus('Loading ' + libs.join(', ') + '…'); await py.loadPackage(libs) }
      let buf = ''; py.setStdout({ batched: (s: string) => { buf += s + '\n' } }); py.setStderr({ batched: (s: string) => { buf += s + '\n' } })
      if (libs.includes('matplotlib')) await py.runPythonAsync("import matplotlib\nmatplotlib.use('AGG')")
      setStatus('Running…')
      try { await py.runPythonAsync(view.current?.state.doc.toString() ?? '') } catch (e: any) { buf += String(e.message || e) }
      if (libs.includes('matplotlib')) setImgs(JSON.parse(await py.runPythonAsync(CAPTURE)))
      setOut(buf)
    } catch (e: any) { setOut('Could not start Python: ' + (e.message || e)) }
    setBusy(false); setStatus('')
  }
  return <><h1>Python</h1>
    <p className="muted">Runs in your browser. Choose the libraries to load, then run.</p>
    <div className="row" role="group" aria-label="Libraries">{LIBS.map(l => <label key={l} className="row" style={{ gap: 6 }}>
      <input type="checkbox" style={{ width: 'auto' }} checked={libs.includes(l)} onChange={() => toggle(l)} />{l}</label>)}</div>
    <div ref={host} aria-label="Code editor" style={{ marginTop: 12, border: '1px solid var(--line)' }} />
    <div className="row" style={{ margin: '12px 0' }}><button className="btn" disabled={busy} onClick={run}>Run</button><span className="muted">{status}</span></div>
    <h3>Output</h3><div className="out" aria-live="polite">{out || (busy ? '' : 'Nothing yet.')}</div>
    {imgs.map((b, i) => <img key={i} className="plot" alt={'Plot ' + (i + 1)} src={'data:image/png;base64,' + b} />)}</>
}
