// Núcleo do Segundo Cérebro — compartilhado entre Telegram e WhatsApp

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const CEREBRO = path.resolve(__dirname, '..', process.env.CEREBRO_DIR ?? 'cerebro')
export const INBOX = path.join(CEREBRO, '00-inbox')
export const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
export const MODELO_PADRAO = process.env.OLLAMA_MODEL ?? 'qwen2.5:1.5b'

export const estado = {
  modelo: MODELO_PADRAO,
  historicos: new Map(),
}

export const PROMPT_SISTEMA = `Você é Ultron, o segundo cérebro do Wagner — uma IA pessoal que roda 100% local na máquina dele, integrada ao Obsidian, Telegram e WhatsApp.
Regras:
- Se apresente como Ultron quando perguntarem quem você é.
- Responda sempre em português do Brasil, de forma direta e útil.
- Prefira respostas curtas; só detalhe se pedirem.
- Se pedirem para lembrar/anotar algo, diga que ele pode usar o comando /nota.
- Contexto do Wagner: estudante do IFFAR (Instituto Federal Farroupilha), usa Arch Linux, VS Code, Obsidian, e está construindo este sistema.`

export function historico(id) {
  if (!estado.historicos.has(id)) estado.historicos.set(id, [])
  return estado.historicos.get(id)
}

export async function conversar(id, texto) {
  const h = historico(id)
  h.push({ role: 'user', content: texto })
  while (h.length > 16) h.shift()

  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: estado.modelo,
      messages: [{ role: 'system', content: PROMPT_SISTEMA }, ...h],
      stream: false,
      keep_alive: process.env.OLLAMA_KEEP_ALIVE ?? '5m',
      options: { num_ctx: Number(process.env.OLLAMA_NUM_CTX ?? 2048) },
    }),
  })
  if (!r.ok) throw new Error(`Ollama respondeu ${r.status}`)
  const j = await r.json()
  const resposta = j.message?.content?.trim() || '(resposta vazia)'
  h.push({ role: 'assistant', content: resposta })
  return resposta
}

export function salvarNota(texto) {
  // Roteamento: "#trabalho relatório pronto" -> pasta da área certa
  const AREAS = {
    faculdade: path.join(CEREBRO, '02-areas', 'faculdade'),
    facul: path.join(CEREBRO, '02-areas', 'faculdade'),
    trabalho: path.join(CEREBRO, '02-areas', 'trabalho'),
    cursos: path.join(CEREBRO, '02-areas', 'cursos'),
    curso: path.join(CEREBRO, '02-areas', 'cursos'),
    vida: path.join(CEREBRO, '02-areas', 'vida'),
    projetos: path.join(CEREBRO, '01-projetos'),
  }

  const tag = texto.match(/^#(\w+)\s+/)
  let destino = INBOX
  let corpo = texto
  if (tag && AREAS[tag[1].toLowerCase()]) {
    destino = AREAS[tag[1].toLowerCase()]
    corpo = texto.slice(tag[0].length)
  }

  fs.mkdirSync(destino, { recursive: true })
  const hoje = new Date().toISOString().slice(0, 10)
  const slug = corpo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'nota'
  const arquivo = path.join(destino, `${hoje}-${slug}.md`)
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  fs.appendFileSync(arquivo, `## ${hora}\n${corpo}\n\n`)
  return path.relative(CEREBRO, arquivo)
}

export async function statusMaquina() {
  const os = await import('node:os')
  const livre = (os.freemem() / 1024 ** 3).toFixed(2)
  const total = (os.totalmem() / 1024 ** 3).toFixed(2)
  let modelos = 'inacessível'
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`)
    const j = await r.json()
    modelos = j.models?.map(m => m.name).join(', ') || 'nenhum (rode: ollama pull qwen2.5:1.5b)'
  } catch { modelos = 'Ollama offline' }
  return `🧠 Modelo ativo: ${estado.modelo}\n💾 RAM: ${livre} / ${total} GB livres\n📦 Modelos: ${modelos}`
}
