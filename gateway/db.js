// cerebro-pg — ponte Postgres do Segundo Cérebro
// Nunca derruba o bot: se o PG estiver fora, só loga e segue (Obsidian continua valendo).
import pg from 'pg'

const URL = process.env.DATABASE_URL ?? 'postgresql://cerebro:cerebro@localhost:5432/cerebro_central'

export const pool = new pg.Pool({ connectionString: URL, max: 5, idleTimeoutMillis: 30000 })
pool.on('error', e => console.error('[pg] pool:', e.message))

export let pgAtivo = false
// teste inicial não-bloqueante
pool.query('SELECT 1').then(() => {
  pgAtivo = true
  console.log('[pg] conectado:', URL.replace(/:[^:@/]+@/, ':****@'))
}).catch(e => console.error('[pg] offline (Obsidian segue valendo):', e.message))

const PROJ_CACHE = new Map()
export async function projetoId(nome = 'segundo-cerebro') {
  if (PROJ_CACHE.has(nome)) return PROJ_CACHE.get(nome)
  try {
    const { rows } = await pool.query('SELECT id FROM projetos WHERE nome=$1', [nome])
    const id = rows[0]?.id ?? null
    if (id) PROJ_CACHE.set(nome, id)
    return id
  } catch { return null }
}

function tagsDe(texto) {
  const tags = [...texto.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map(m => m[1].toLowerCase()).slice(0, 10)
  return tags
}

export async function salvarNotaPG({ origem = 'telegram', arquivo = null, texto = '', projeto = 'segundo-cerebro' }) {
  try {
    const pid = await projetoId(projeto)
    const titulo = texto.replace(/\s+/g, ' ').slice(0, 120)
    await pool.query(
      `INSERT INTO notas (origem, arquivo_obsidian, titulo, conteudo, projeto_id, tags)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [origem, arquivo, titulo, texto, pid, tagsDe(texto)]
    )
    pgAtivo = true
  } catch (e) { console.error('[pg] nota:', e.message) }
}

export async function addTarefaPG({ titulo, prazo = null, projeto = 'segundo-cerebro', obsidian_file = null }) {
  try {
    const pid = await projetoId(projeto)
    const { rows } = await pool.query(
      `INSERT INTO tarefas (titulo, projeto_id, status, data_limite, obsidian_file)
       VALUES ($1,$2,'inbox',$3,$4) RETURNING id`,
      [titulo, pid, prazo ? new Date(prazo).toISOString() : null, obsidian_file]
    )
    pgAtivo = true
    return rows[0]?.id ?? null
  } catch (e) { console.error('[pg] tarefa:', e.message); return null }
}

export async function concluirTarefaPG(pgId) {
  if (!pgId) return
  try {
    await pool.query(`UPDATE tarefas SET status='feito', updated_at=now() WHERE id=$1`, [pgId])
  } catch (e) { console.error('[pg] feito:', e.message) }
}

export async function buscarContextoPG(texto, limite = 3) {
  try {
    const curto = texto.slice(0, 200)
    const { rows } = await pool.query(
      `SELECT titulo, conteudo FROM notas
       WHERE conteudo % $1 OR titulo % $1
       ORDER BY similarity(conteudo, $1) DESC LIMIT $2`,
      [curto, limite]
    )
    pgAtivo = true
    return rows.map(r => `- ${r.titulo}: ${String(r.conteudo).slice(0, 180)}`).join('\n')
  } catch { return '' }
}

export async function statusPG() {
  try {
    const { rows } = await pool.query(`SELECT (SELECT count(*) FROM notas) AS notas, (SELECT count(*) FROM tarefas WHERE status!='feito') AS tarefas_abertas, (SELECT count(*) FROM projetos) AS projetos`)
    pgAtivo = true
    return rows[0]
  } catch (e) { return { erro: e.message } }
}
