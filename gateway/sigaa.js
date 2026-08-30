// ULTRON SIGAA — Robô acadêmico do Segundo Cérebro
// Lê o Portal do Discente do SIGAA (IFFAR), extrai tarefas e avaliações,
// organiza por matéria em cerebro/02-areas/faculdade/ e notifica pelo Ultron.
// Credenciais ficam SOMENTE no .env local.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const BASE = process.env.SIGAA_URL ?? 'https://sig.iffarroupilha.edu.br/sigaa'
export const DIR_FACULDADE = path.join(__dirname, '..', 'cerebro', '02-areas', 'faculdade')
const ESTADO = path.join(__dirname, '.sigaa-state.json')

let jar = ''

function guardarCookies(res) {
  const novas = res.headers.getSetCookie?.() ?? []
  if (!novas.length) return
  const mapa = new Map(jar.split('; ').filter(Boolean).map(c => [c.split('=')[0], c.split('=').slice(1).join('=')]))
  for (const c of novas) {
    const [par] = c.split(';')
    const i = par.indexOf('=')
    mapa.set(par.slice(0, i).trim(), par.slice(i + 1))
  }
  jar = [...mapa].map(([k, v]) => `${k}=${v}`).join('; ')
}

export async function req(url, opts = {}) {
  let res = await fetch(url, {
    redirect: 'manual',
    ...opts,
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Ultron/1.0',
      ...(jar ? { cookie: jar } : {}),
      ...(opts.body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      ...opts.headers,
    },
  })
  guardarCookies(res)
  return res
}

// segue redirects mantendo cookies (o SIGAA vive redirecionando)
export async function seguir(url) {
  let res = await req(url)
  const origem = new URL(BASE).origin
  for (let i = 0; i < 6 && [301, 302, 303].includes(res.status); i++) {
    const destino = res.headers.get('location')
    if (!destino) break
    res = await req(new URL(destino, origem).toString())
  }
  return res
}

function decodificar(texto) {
  return texto
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-zA-Z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function login(usuario, senha) {
  jar = ''
  const tela = await req(`${BASE}/verTelaLogin.do`)
  const htmlTela = await tela.text()

  const acao = htmlTela.match(/<form[^>]*action="([^"]*)"/i)?.[1]?.replace(/&amp;/g, '&') ?? '/logar.do?dispatch=logOn'
  const campos = new Map()
  for (const c of htmlTela.matchAll(/<input[^>]*name="([^"]+)"[^>]*>/gi)) {
    if (['user.login', 'user.senha'].includes(c[1])) continue
    campos.set(c[1], c[0].match(/value="([^"]*)"/i)?.[1] ?? '')
  }
  campos.set('user.login', usuario)
  campos.set('user.senha', senha)

  const origem = new URL(BASE).origin
  let res = await req(new URL(acao, origem).toString(), {
    method: 'POST',
    body: new URLSearchParams(campos).toString(),
  })

  for (let i = 0; i < 5 && [301, 302, 303].includes(res.status); i++) {
    const destino = res.headers.get('location')
    if (!destino) break
    res = await req(new URL(destino, origem).toString())
  }

  const urlFinal = res.url ?? ''
  if (!/discente|portal|principal/i.test(urlFinal)) {
    throw new Error(`Login SIGAA falhou (página: ${urlFinal || '?'} — confira SIGAA_USER/SIGAA_PASS)`)
  }
}

// ===== Leitura das atividades do Portal do Discente =====

export async function lerAtividades() {
  const res = await seguir(`${BASE}/verPortalDiscente.do`)
  const html = await res.text()

  const ini = html.indexOf("getElementById('formAtividades')")
  if (ini === -1) throw new Error('Seção de atividades não encontrada no portal')
  const fim = html.indexOf('</form>', ini)
  const trecho = html.slice(Math.max(0, ini - 4000), fim)

  const atividades = []
  let periodo = ''

  for (const m of trecho.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const l = m[1]
    const celulas = [...l.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(c => decodificar(c[1].replace(/<[^>]+>/g, ' ')))

    const marcaPeriodo = celulas.find(c => /^\d{4}\.\d$/.test(c))
    if (marcaPeriodo) { periodo = marcaPeriodo; continue }

    const dados = l.match(/'id':'(\d+)','idTurma':'(\d+)'/)
    const quando = celulas.find(c => /\d{2}\/\d{2}\/\d{4}/.test(c))
    const desc = celulas.find(c => /Tarefa:|Avalia/i.test(c))
    if (!quando || !desc) continue

    const [prazo, hora] = quando.split(' ')
    if (dados) {
      const partes = desc.match(/^(.+?)\s+Tarefa:\s*(.+)$/i)
      atividades.push({
        tipo: 'tarefa',
        chave: `${dados[1]}-${dados[2]}`,
        turma: partes?.[1]?.trim() ?? '',
        titulo: partes?.[2]?.trim() ?? desc,
        prazo, hora: hora ?? '',
        periodo,
      })
    } else {
      const partes = desc.match(/^(.+?)\s+Avaliação:\s*(.+)$/i)
      atividades.push({
        tipo: 'avaliacao',
        chave: `av-${prazo}-${(partes?.[1] ?? desc).slice(0, 20)}`,
        turma: partes?.[1]?.trim() ?? '',
        titulo: `Avaliação: ${partes?.[2]?.trim() ?? ''}`,
        prazo, hora: '',
        periodo,
      })
    }
  }
  return atividades
}

// ===== Organização no cérebro: uma pasta por matéria =====

function pastaMateria(turma) {
  const limpo = turma.replace(/[\\/:*?"<>|]/g, '-').trim()
  return path.join(DIR_FACULDADE, limpo)
}

export function organizarNoCerebro(atividades) {
  const porMateria = new Map()
  for (const a of atividades) {
    const materia = a.turma || 'Geral'
    if (!porMateria.has(materia)) porMateria.set(materia, [])
    porMateria.get(materia).push(a)
  }

  fs.mkdirSync(DIR_FACULDADE, { recursive: true })

  for (const [materia, lista] of porMateria) {
    const pasta = pastaMateria(materia)
    fs.mkdirSync(pasta, { recursive: true })
    fs.mkdirSync(path.join(pasta, 'anexos'), { recursive: true })

    lista.sort((a, b) => (a.prazo.split('/').reverse().join('') > b.prazo.split('/').reverse().join('') ? 1 : -1))

    const nota = path.join(pasta, `${materia}.md`)
    let corpo = `---\ntipo: materia\nsigaa: true\natualizado: ${new Date().toISOString().slice(0, 10)}\ntags: [faculdade, "${materia.toLowerCase().slice(0, 30)}"]\n---\n\n`
    corpo += `# ${materia}\n\n## 📋 Atividades e prazos (via SIGAA)\n\n`
    for (const a of lista) {
      const icone = a.tipo === 'tarefa' ? '📝' : '🧪'
      corpo += `- ${icone} **${a.prazo}${a.hora ? ' ' + a.hora : ''}** — ${a.titulo}\n`
    }
    corpo += `\n## 🔑 Conceitos-chave\n- \n\n## ❓ Dúvidas\n- \n\n## 📎 Anexos\n(vão pra pasta anexos/ deste diretório)\n`

    fs.writeFileSync(nota, corpo)
  }
  return [...porMateria.keys()]
}

// ===== Verificação principal =====

export async function checarSIGAA() {
  await login(process.env.SIGAA_USER, process.env.SIGAA_PASS)
  const atividades = await lerAtividades()
  const materias = organizarNoCerebro(atividades)

  // quais são novidades?
  let vistas = []
  try { vistas = JSON.parse(fs.readFileSync(ESTADO, 'utf8')).vistas ?? [] } catch { }
  const antes = new Set(vistas)
  const novas = atividades.filter(a => !antes.has(a.chave))
  fs.writeFileSync(ESTADO, JSON.stringify({
    vistas: atividades.map(a => a.chave),
    quando: new Date().toISOString(),
  }, null, 2))

  // sync atividades -> Notion + vault Tarefas (só novidades pra não duplicar)
  try {
    const { criarTarefa } = await import('./notion.js')
    const tarefasMod = await import('./tarefas.js')
    for (const a of novas) {
      const [d,m,aa] = (a.prazo||'').split('/')
      const prazo = d&&m&&aa ? `${aa}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` : null
      const nome = `${a.turma ? a.turma+': ' : ''}${a.titulo}`.slice(0,180)
      criarTarefa({ nome, status: 'Não iniciada', prazo, prioridade: a.tipo==='avaliacao'?'Alta':'Média', descricao: `${a.tipo} • ${a.periodo} • prazo ${a.prazo} ${a.hora}`.slice(0,1500) }).catch(()=>{})
      const prazoMs = prazo ? new Date(prazo).getTime() : null
      tarefasMod.addTarefa(`${a.turma ? '['+a.turma+'] ' : ''}${a.titulo} (${a.tipo} ${a.prazo})`, prazoMs)
    }
  } catch {}

  return { atividades, materias, novas }
}
