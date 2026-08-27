// Núcleo do Segundo Cérebro — compartilhado entre Telegram e WhatsApp
// v2: memória persistente no Obsidian + skills criadas pelo usuário

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const CEREBRO = path.resolve(__dirname, '..', process.env.CEREBRO_DIR ?? 'cerebro')
export const INBOX = path.join(CEREBRO, '00-inbox')
export const SISTEMA = path.join(CEREBRO, 'sistema')
export const DIR_MEMORIA = path.join(SISTEMA, 'memoria')
export const DIR_SKILLS = path.join(SISTEMA, 'skills')
export const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
export const MODELO_PADRAO = process.env.OLLAMA_MODEL ?? 'qwen2.5:1.5b'

export const estado = {
  modelo: MODELO_PADRAO,
  historicos: new Map(),
  skillsAtivas: new Map(), // idChat -> { nome, conteudo }
}

export const PROMPT_SISTEMA = `Você é Ultron, o segundo cérebro do Wagner — uma IA pessoal que roda 100% local na máquina dele, integrada ao Obsidian, Telegram e WhatsApp.
Regras:
- O usuário se chama WAGNER. Sempre chame-o de Wagner ou de você/nada. Nunca use o nome de perfil do WhatsApp.
- Se apresente como Ultron quando perguntarem quem você é.
- Responda sempre em português do Brasil, de forma direta e útil.
- Prefira respostas curtas; só detalhe se pedirem.
- Se pedirem para lembrar/anotar algo, diga que ele pode usar o comando /nota.
- Se o Wagner pedir para criar pasta ou página no Obsidian/cérebro, explique que é só escrever: "criar pasta Nome" ou "criar nota Nome" (funciona na hora, sem espera).
- Contexto do Wagner: estudante do IFFAR (Instituto Federal Farroupilha), usa Arch Linux, VS Code, Obsidian, e está construindo este sistema.
- Nas "Conversas recentes" você vê um resumo do que rolou ultimamente. Use isso pra entender referências como "a gente", "nosso projeto", "aquilo que faltava".
- ATENÇÃO à autoria: nas mensagens, WAGNER é quem pergunta/fala; VOCÊ é quem responde. NUNCA repita como suas as palavras, sintomas, sentimentos ou situações que ELE relatar (ex: se ele diz "estou com febre", VOCÊ não tem febre — ele tem). Antes de responder, identifique o assunto exato e sobre QUEM se está falando.
- IMPORTANTE: se não tiver contexto suficiente sobre algo que Wagner menciona, DIGA honestamente ("não tenho esse contexto aqui") em vez de inventar. Nunca crie projetos, tarefas ou fatos fictícios.`

/* ───────────────────────── MEMÓRIA ───────────────────────── */

function arquivoMem(nome) { return path.join(DIR_MEMORIA, `${nome}.md`) }
const CABECALHOS = {
  fatos: '# Fatos que o Ultron sabe\n\n',
  pessoas: '# Pessoas na vida do Wagner\n\n',
}

function garantirMemoria() {
  fs.mkdirSync(DIR_MEMORIA, { recursive: true })
  for (const [nome, cab] of Object.entries(CABECALHOS)) {
    const arq = arquivoMem(nome)
    if (!fs.existsSync(arq)) fs.writeFileSync(arq, cab)
  }
}

// lê só as linhas de conteúdo (sem cabeçalho), mais recentes primeiro, limitado
function lerMem(nome, limite = 700) {
  try {
    const linhas = fs.readFileSync(arquivoMem(nome), 'utf8')
      .split('\n').filter(l => l.trim().startsWith('-'))
    return linhas.slice(-40).join('\n').slice(-limite)
  } catch { return '' }
}

export function memoriaTexto() {
  garantirMemoria()
  const fatos = lerMem('fatos')
  const pessoas = lerMem('pessoas')
  const diario = lerDiarioRecente()
  if (!fatos && !pessoas && !diario) return ''
  let bloco = '\n\n## MEMÓRIA (aprendida nas conversas)\n'
  if (pessoas) bloco += `\nPessoas conhecidas:\n${pessoas}\n`
  if (fatos) bloco += `\nFatos:\n${fatos}\n`
  if (diario) bloco += `\nCoisas que o WAGNER disse em conversas passadas (é ELE falando — nunca repita como se fosse você):\n${diario}\n`
  return bloco.slice(0, 1400)
}

// últimas falas do Wagner no diário (sem respostas do Ultron, pra não ecoar alucinação)
function lerDiarioRecente(linhas = 6) {
  try {
    const mes = new Date().toISOString().slice(0, 7)
    const falas = fs.readFileSync(path.join(DIR_MEMORIA, `diario-${mes}.md`), 'utf8')
      .split('\n').filter(l => l.trim().startsWith('- ') && l.includes('**Wagner:**'))
    return falas.slice(-linhas).join('\n').slice(-450)
  } catch { return '' }
}

// detecta frases tipo "lembre que…", "memoriza: …", "meu amigo X é Y"
export function tentarLembrar(texto) {
  const m = texto.match(/^\s*(?:lembra|lembre|memoriza|memorize|grava|grave|anota|anote)\s+(?:que\s+|disso[:,]?\s*|isso[:,]?\s*|:\s*)(.{4,})$/i)
  if (!m) return null
  const fato = m[1].trim()
  garantirMemoria()
  const data = new Date().toLocaleDateString('pt-BR')
  fs.appendFileSync(arquivoMem('fatos'), `- [${data}] ${fato}\n`)
  return fato
}

// "o João é meu irmão" / "a Maria é minha colega" -> pessoas.md
export function tentarPessoa(texto) {
  const m = texto.match(/\b(?:o|a)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zá-úâêôãõç]{2,15})\s+(?:é|eh)\s+(?:meu|minha|nosso|nossa)?\s?(irmão|irmã|pai|mãe|avô|avó|tio|tia|primo|prima|colega|amigo|amiga|professor|professora|chefe|vizinho|vizinha)\b/i)
  if (!m) return null
  const linha = `- ${m[1]}: ${m[2].toLowerCase()}${texto.length < 90 ? ` (${texto.trim()})` : ''}`
  garantirMemoria()
  const atual = fs.readFileSync(arquivoMem('pessoas'), 'utf8')
  if (!atual.includes(`- ${m[1]}:`)) fs.appendFileSync(arquivoMem('pessoas'), `${linha}\n`)
  return m[1]
}

/* ───────────────────────── SKILLS ───────────────────────── */

export function listarSkills() {
  fs.mkdirSync(DIR_SKILLS, { recursive: true })
  return fs.readdirSync(DIR_SKILLS)
    .filter(f => f.endsWith('.md') && f !== 'LEIA-ME.md')
    .map(f => {
      const bruto = fs.readFileSync(path.join(DIR_SKILLS, f), 'utf8')
      const titulo = bruto.match(/^#\s+(.+)$/m)?.[1] ?? f.replace('.md', '')
      const desc = bruto.match(/^>\s?(.+)$/m)?.[1] ?? ''
      return { id: f.replace('.md', ''), titulo, desc }
    })
}

export function obterSkill(nomeOuId) {
  const limpo = nomeOuId.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const alvo = listarSkills().find(s => s.id === limpo || s.titulo.toLowerCase().includes(limpo))
  if (!alvo) return null
  const conteudo = fs.readFileSync(path.join(DIR_SKILLS, `${alvo.id}.md`), 'utf8')
  return { ...alvo, conteudo }
}

/* ───────────────────── CONVERSA (com tudo junto) ───────────────────── */

export function historico(id) {
  if (!estado.historicos.has(id)) estado.historicos.set(id, [])
  return estado.historicos.get(id)
}

// histórico persiste em disco: reinício do gateway não apaga as conversas
const ARQ_HIST = path.join(DIR_MEMORIA, 'historicos.json')
function carregarHistoricos() {
  try {
    const dados = JSON.parse(fs.readFileSync(ARQ_HIST, 'utf8'))
    for (const [k, v] of Object.entries(dados)) estado.historicos.set(k, v)
  } catch {}
}
carregarHistoricos()

function salvarHistoricos() {
  try {
    fs.mkdirSync(DIR_MEMORIA, { recursive: true })
    fs.writeFileSync(ARQ_HIST, JSON.stringify(Object.fromEntries(estado.historicos)))
  } catch {}
}

export function esquecer(id) { estado.historicos.delete(id); estado.skillsAtivas.delete(id) }

function montarSistema(id) {
  let sistema = PROMPT_SISTEMA + memoriaTexto()
  const skill = estado.skillsAtivas.get(id)
  if (skill) sistema += `\n\n## MODO SKILL ATIVO: ${skill.titulo}\n${skill.conteudo}\n(siga estas instruções nesta conversa)`
  return sistema
}

function registrarDiario(papel, canal, texto) {
  try {
    const hoje = new Date().toISOString().slice(0, 10)
    const arq = path.join(DIR_MEMORIA, `diario-${hoje.slice(0, 7)}.md`)
    if (!fs.existsSync(arq)) fs.writeFileSync(arq, `# Diário de conversas — ${hoje.slice(0, 7)}\n\n`)
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const resumo = texto.replace(/\s+/g, ' ').slice(0, 160)
    fs.appendFileSync(arq, `- \`${canal} ${hora}\` **${papel}:** ${resumo}\n`)
  } catch { /* diário nunca derruba a conversa */ }
}

// chamada HTTP direta ao Ollama: sem os limites escondidos do fetch (300s)
function ollamaChat(corpoJson, esperaMs = 720_000) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${OLLAMA_URL}/api/chat`)
    const req = http.request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      timeout: esperaMs,
    }, res => {
      let dados = ''
      res.on('data', c => { dados += c })
      res.on('end', () => {
        try { resolve(JSON.parse(dados)) } catch { reject(new Error('resposta inválida do Ollama')) }
      })
    })
    req.on('timeout', () => req.destroy(new Error('tempo esgotado esperando o Ollama')))
    req.on('error', reject)
    req.end(corpoJson)
  })
}

export async function conversar(id, texto, canal = 'chat') {  // memória automática antes de tudo
  const novoFato = tentarLembrar(texto)
  const novaPessoa = novoFato ? null : tentarPessoa(texto)

  const h = historico(id)
  h.push({ role: 'user', content: texto })
  while (h.length > 16) h.shift()

  const corpo = JSON.stringify({
    model: estado.modelo,
    messages: [{ role: 'system', content: montarSistema(id) }, ...h],
    stream: false,
    keep_alive: process.env.OLLAMA_KEEP_ALIVE ?? '5m',
    options: { num_ctx: Number(process.env.OLLAMA_NUM_CTX ?? 2048) },
  })

  // máquina fraca: geração pode demorar minutos; 2 tentativas e paciência de 12min
  let j
  for (let tent = 1; tent <= 2; tent++) {
    try {
      j = await ollamaChat(corpo)
      break
    } catch (e) {
      if (tent === 2) throw new Error(`Ollama não respondeu (${e.message})`)
      console.log('⚠️ Ollama falhou, tentando de novo em 3s...')
      await new Promise(res => setTimeout(res, 3000))
    }
  }
  let resposta = j.message?.content?.trim() || '(resposta vazia)'

  if (novoFato) resposta = `🧠 Gravado na memória: "${novoFato}".\n\n${resposta}`
  else if (novaPessoa) resposta = `👤 Anotado: ${novaPessoa} está na sua rede de pessoas.\n\n${resposta}`

  h.push({ role: 'assistant', content: resposta })
  salvarHistoricos()
  registrarDiario('Wagner', canal, texto)
  registrarDiario('Ultron', canal, resposta)
  return resposta
}

/* ───────────────────────── NOTAS ───────────────────────── */

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

/* ───────────────────────── STATUS ───────────────────────── */

/* ───────── VOICE (STT/TTS) ───────── */

// Transcreve áudio via whisper.cpp local
export async function transcreverAudio(url) {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execFileAsync = promisify(execFile)
const WHISPER = path.join(__dirname, '..', 'voz', 'whisper', 'whisper-bin-ubuntu-x64', 'whisper-cli')
const MODEL = path.join(__dirname, '..', 'voz', 'whisper-base.bin')
  const TMP = `/tmp/ultron-audio-${Date.now()}.ogg`
  
  // Baixa áudio
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha ao baixar áudio: ${res.status}`)
  fs.writeFileSync(TMP, Buffer.from(await res.arrayBuffer()))
  
  // Converte para WAV 16kHz mono (whisper precisa)
  const WAV = TMP.replace('.ogg', '.wav')
  await new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ['-y', '-i', TMP, '-ar', '16000', '-ac', '1', WAV])
    ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg falhou')))
    ffmpeg.on('error', reject)
  })
  
  // Roda whisper
  const { stdout } = await execFileAsync(WHISPER, ['-m', MODEL, '-f', WAV, '-l', 'pt', '-otxt'], { timeout: 120_000 })
  fs.rmSync(TMP, { force: true })
  fs.rmSync(WAV, { force: true })
  return stdout.trim()
}

// Sintetiza voz via piper (TTS local)
export async function sintetizarVoz(texto, voz = 'pt-br') {
const PIPER = path.join(__dirname, '..', 'voz', 'piper', 'piper')
const MODELO = path.join(__dirname, '..', 'voz', 'faber.onnx')
  const SAIDA = `/tmp/ultron-tts-${Date.now()}.wav`
  
  if (!fs.existsSync(MODELO)) throw new Error('Modelo Piper não encontrado')
  
  await new Promise((resolve, reject) => {
    const p = spawn(PIPER, ['-m', MODELO, '-o', SAIDA], { stdio: ['pipe', 'inherit', 'inherit'] })
    p.stdin.write(texto)
    p.stdin.end()
    p.on('close', code => code === 0 ? resolve() : reject(new Error('Piper falhou')))
    p.on('error', reject)
  })
  
  return SAIDA
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
  const skills = listarSkills()
  return `🧠 Modelo ativo: ${estado.modelo}
💾 RAM: ${livre} / ${total} GB livres
📦 Modelos: ${modelos}
🎯 Skills: ${skills.map(s => s.titulo).join(', ') || 'nenhuma'}
🗂️ Memória: ${lerMem('fatos').split('\n').filter(Boolean).length} fatos aprendidos`
}

garantirMemoria()
