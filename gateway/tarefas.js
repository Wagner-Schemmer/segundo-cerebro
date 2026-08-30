// TAREFAS — lista simples com prazos, visível no Obsidian e lembrada no Telegram
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ARQ = path.join(__dirname, 'tarefas.json')
const MD = path.resolve(__dirname, '..', 'cerebro', '02-areas', 'Tarefas.md')

let tarefas = carregar()

function carregar() {
  try { return JSON.parse(fs.readFileSync(ARQ, 'utf8')) } catch { return [] }
}

function salvar() {
  fs.writeFileSync(ARQ, JSON.stringify(tarefas, null, 2))
  renderMd()
}

// espelha em Markdown pro Obsidian mostrar checkboxes bonitinhos
function renderMd() {
  const pendentes = tarefas.filter(t => !t.feita)
  const feitas = tarefas.filter(t => t.feita).slice(-15).reverse()
  const fmt = t => t.prazo ? ` 📅 ${new Date(t.prazo).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''
  const linhas = [
    '# ✅ Tarefas', '',
    '> Mantido pelo Ultron — gerencie pelos comandos do Telegram (`/tarefa`, `/tarefas`, `/feito`)', '',
    ...pendentes.map(t => `- [ ] ${t.texto}${fmt(t)} *(# ${t.id})*`),
    '', '<details><summary>🗂️ Concluídas recentemente</summary>', '',
    ...feitas.map(t => `- [x] ${t.texto}`),
    '', '</details>', '',
  ]
  fs.mkdirSync(path.dirname(MD), { recursive: true })
  fs.writeFileSync(MD, linhas.join('\n'))
}

export function addTarefa(texto, prazo = null) {
  const t = { id: tarefas.reduce((m, x) => Math.max(m, x.id), 0) + 1, texto, prazo, feita: false, lembrado: false }
  tarefas.push(t)
  salvar()
  // sync Notion Minhas tarefas (fire-and-forget)
  import('./notion.js').then(m=>{
    const prazoISO = prazo ? new Date(prazo).toISOString().slice(0,10) : null
    m.criarTarefa({ nome: texto.slice(0,180), status: 'Não iniciada', prazo: prazoISO, prioridade: 'Média', descricao: `Criada via Telegram • ${new Date().toLocaleString('pt-BR')}` }).catch(e=>console.error('Notion Tarefas erro:',e.message))
  }).catch(()=>{})
  return t
}

export function listarTarefas() {
  return tarefas.filter(t => !t.feita)
}

export function fazerTarefa(id) {
  const t = tarefas.find(x => x.id === id && !x.feita)
  if (t) { t.feita = true; salvar() }
  return t
}

export function proximasVencer() {
  const agora = Date.now()
  return tarefas.filter(t => !t.feita && !t.lembrado && t.prazo && t.prazo <= agora)
}

export function marcarLembrado(id) {
  const t = tarefas.find(x => x.id === id)
  if (t) { t.lembrado = true; salvar() }
}

/* ─── interpretação de prazos em português ─── */
export function parsePrazo(s) {
  s = s.toLowerCase().trim().replace('amanhã', 'amanha')
  const agora = new Date()
  let h = null, min = 0, dia = null, mes = null

  const hm = s.match(/(\d{1,2})[:h](\d{2})/)
  if (hm) { h = +hm[1]; min = +hm[2] } else {
    const hs = s.match(/\b(\d{1,2})h\b/)
    if (hs) h = +hs[1]
  }
  if (/amanha/.test(s)) { const d = new Date(agora); d.setDate(d.getDate() + 1); dia = d.getDate(); mes = d.getMonth() }
  else if (/^hoje/.test(s)) { dia = agora.getDate(); mes = agora.getMonth() }
  else {
    const dm = s.match(/\b(\d{1,2})\/(\d{1,2})\b/)
    if (dm) { dia = +dm[1]; mes = +dm[2] - 1 }
  }
  if (dia == null && h == null) return null

  const d = new Date(agora)
  if (dia != null) { d.setDate(dia); d.setMonth(mes); if (d.getTime() < agora.getTime()) d.setFullYear(d.getFullYear() + 1) }
  d.setHours(h ?? 9, min ?? 0, 0, 0)
  // "hoje 3h" quando já passou das 3 → assume que falou do próximo ciclo válido (amanhã)
  if (d.getTime() < agora.getTime()) d.setDate(d.getDate() + 1)
  return d.getTime()
}

// separa "pagar conta amanhã 14h" → { texto, prazo }
export function separarPrazo(txt) {
  const m = txt.replace('amanhã', 'amanha').match(/(?:\bamanha\b|^hoje\b|\d{1,2}\/\d{1,2})(?:\s+\d{1,2}(?:[:h]\d{2})?h?)?(?=\s*$)/i)
  if (!m) return { texto: txt.trim(), prazo: null }
  return { texto: txt.slice(0, m.index).trim(), prazo: parsePrazo(m[0]) }
}
