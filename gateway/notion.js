// NOTION — integração total SIGAA ↔ Notion
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
function loadEnv() {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    }
  } catch {}
}
loadEnv()

const TOKEN = process.env.NOTION_TOKEN
const DB_MATERIAIS = process.env.NOTION_DB_MATERIAIS
const DB_TAREFAS = process.env.NOTION_DB_TAREFAS
const NOTION_VERSION = '2022-06-28'

async function notion(path_, opts = {}) {
  const r = await fetch(`https://api.notion.com/v1${path_}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`Notion ${r.status}: ${JSON.stringify(j)}`)
  return j
}

export async function criarMaterial({ titulo, materia, modulo, tipo, link, conteudo }) {
  return notion('/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: DB_MATERIAIS },
      properties: {
        'Título': { title: [{ text: { content: titulo.slice(0, 200) } }] },
        'Matéria': materia ? { select: { name: materia } } : undefined,
        'Módulo': modulo ? { select: { name: String(modulo) } } : undefined,
        'Tipo': tipo ? { select: { name: tipo } } : undefined,
        'Link SIGAA': link ? { url: link } : undefined,
        'Baixado em': { date: { start: new Date().toISOString().slice(0, 10) } },
        'Conteúdo': conteudo ? { rich_text: [{ text: { content: conteudo.slice(0, 2000) } }] } : undefined
      }
    })
  })
}

export async function criarTarefa({ nome, status, prazo, prioridade, descricao }) {
  return notion('/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: DB_TAREFAS },
      properties: {
        'Nome': { title: [{ text: { content: nome.slice(0, 200) } }] },
        'Status': status ? { status: { name: status } } : undefined,
        'Prazo': prazo ? { date: { start: prazo } } : undefined,
        'Prioridade': prioridade ? { select: { name: prioridade } } : undefined,
        'Descrição': descricao ? { rich_text: [{ text: { content: descricao.slice(0, 2000) } }] } : undefined
      }
    })
  })
}

export async function listarMateriais() {
  return notion(`/databases/${DB_MATERIAIS}/query`, { method: 'POST', body: JSON.stringify({ page_size: 20 }) })
}
export async function listarTarefas() {
  return notion(`/databases/${DB_TAREFAS}/query`, { method: 'POST', body: JSON.stringify({ page_size: 20 }) })
}
