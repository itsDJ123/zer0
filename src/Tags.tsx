export const textOn = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? '#0a0a0a' : '#ffffff' }
export function Chip({ name, color, onClick, dim }: { name: string; color: string; onClick?: () => void; dim?: boolean }) {
  const st = { background: color, color: textOn(color), opacity: dim ? 0.3 : 1, padding: '1px 10px', fontSize: '.8rem', fontWeight: 500, border: 0, font: 'inherit', display: 'inline-block' } as const
  return onClick ? <button type="button" style={{ ...st, cursor: 'pointer' }} onClick={onClick}>{name}</button> : <span style={st}>{name}</span>
}
export const Tags = ({ tags }: { tags: { name: string; color: string }[] | null }) =>
  tags?.length ? <div className="row" style={{ gap: 6 }}>{tags.map(t => <Chip key={t.name} {...t} />)}</div> : null
