export function Chip({ name, color, onClick, dim }: { name: string; color: string; onClick?: () => void; dim?: boolean }) {
  const st = { background: 'transparent', color, border: `1px solid ${color}`, borderRadius: 8, opacity: dim ? 0.35 : 1, padding: '1px 10px', fontSize: '.8rem', fontWeight: 500, font: 'inherit', display: 'inline-block' } as const
  return onClick ? <button type="button" style={{ ...st, cursor: 'pointer' }} onClick={onClick}>{name}</button> : <span style={st}>{name}</span>
}
export const Tags = ({ tags }: { tags: { name: string; color: string }[] | null }) =>
  tags?.length ? <div className="row" style={{ gap: 6 }}>{tags.map(t => <Chip key={t.name} {...t} />)}</div> : null
