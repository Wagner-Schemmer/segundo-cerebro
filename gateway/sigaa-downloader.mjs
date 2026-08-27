// SIGAA DOWNLOADER JSF — Baixa TODOS materiais de TODAS turmas virtuais

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { req, seguir, login, BASE } from './sigaa.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VAULT_BASE = path.join(__dirname, '..', 'cerebro', '02-areas', 'faculdade')

// Carrega .env
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) process.env[m[1]] = m[2]
  }
}

let jar = ''
function guardarCookies(res) {
  const novas = res.headers.getSetCookie?.() ?? []
  if (!novas.length) return
  const mapa = new Map(jar.split('; ').filter(Boolean).map(c => [c.split('=')[0], c.split('=').slice(1).join('=')]))
  for (const c of novas) { const [par] = c.split(';'); const i = par.indexOf('='); mapa.set(par.slice(0, i).trim(), par.slice(i + 1)) }
  jar = [...mapa].map(([k, v]) => `${k}=${v}`).join('; ')
}

// ---------- LOGIN ----------
async function doLogin() {
  const user = process.env.SIGAA_USER
  const pass = process.env.SIGAA_PASS
  if (!user || !pass) throw new Error('SIGAA_USER/SIGAA_PASS não estão no .env')
  console.log('🔐 Logando no SIGAA...')
  await login(user, pass)
  console.log('✅ Logado!')
}

// ---------- EXTRAI TURMAS ----------
async function listarTurmas() {
  console.log('📋 Buscando turmas virtuais...')
  const res = await seguir(`${BASE}/portais/discente/turmas.jsf`)
  const html = await res.text()
  
  const turmas = []
  const linhas = html.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] || ''
  const regexLinha = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  
  for (const m of linhas.matchAll(regexLinha)) {
    const l = m[1]
    const idMatch = l.match(/frontEndIdTurma['"]:\s*'([A-F0-9]+)'/i)
    if (!idMatch) continue
    const id = idMatch[1]
    
    const nomeMatch = l.match(/<td[^>]*>([\s\S]*?)<\/td>/i)
    let nome = `Turma-${id.slice(0, 8)}`
    if (nomeMatch) {
      const limpo = nomeMatch[1].replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim()
      if (limpo.length > 5) nome = limpo.slice(0, 100)
    }
    turmas.push({ id, nome })
  }
  
  const unicas = []
  const vistos = new Set()
  for (const t of turmas) {
    if (!vistos.has(t.id)) { vistos.add(t.id); unicas.push(t) }
  }
  
  console.log(`📚 Encontradas ${unicas.length} turmas virtuais:`)
  unicas.forEach((t, idx) => console.log(`  ${idx + 1}. ${t.nome} (id: ${t.id.slice(0, 12)}...)`))
  return unicas
}
// ---------- ACESSA TURMA VIRTUAL (JSF AJAX RICHFACES) ----------
async function acessarTurmaVirtual(turmaId, rowIndex = 0) {
  console.log(`  🔑 Entrando na turma ${turmaId.slice(0, 12)}...`)
  
  const resGet = await seguir(`${BASE}/portais/discente/turmas.jsf`)
  const htmlGet = await resGet.text()
  
  const viewStateMatch = htmlGet.match(/name="javax.faces.ViewState"[^>]*value="([^"]*)"/i)
  const viewState = viewStateMatch ? viewStateMatch[1] : 'j_id3'
  console.log(`  🔑 ViewState: ${viewState}`)
  
  const formData = new URLSearchParams()
  formData.append('j_id_jsp_1204840590_2', 'j_id_jsp_1204840590_2')
  formData.append('javax.faces.ViewState', viewState)
  
  const sourceComponent = rowIndex === 0 
    ? 'j_id_jsp_1204840590_4' 
    : `j_id_jsp_1204840590_4j_id_${rowIndex}`
  formData.append(sourceComponent, sourceComponent)
  
  formData.append('frontEndIdTurma', turmaId)
  formData.append('inciadoPelaBusca', 'true')
  formData.append('paginaListaTurmasOrigem', '/portais/discente/turmas.jsp')
  
  // RichFaces AJAX params
  formData.append('A4J.AJAX', 'true')
  formData.append('org.richfaces.ajax.component', sourceComponent)
  
  console.log(`  📤 Submetendo AJAX JSF (${formData.toString().length} chars)...`)
  
  // POST AJAX - retorna HTML completo da turma virtual
  const resPost = await req(`${BASE}/portais/discente/turmas.jsf`, {
    method: 'POST',
    body: formData.toString(),
    headers: { 
      'content-type': 'application/x-www-form-urlencoded',
      'faces-request': 'ajax',
      'x-requested-with': 'XMLHttpRequest',
      'accept': 'text/html,application/xml,*/*'
    }
  })
  
  // A resposta AJAX É o HTML da turma virtual!
  const htmlTurma = await resPost.text()
  console.log(`  📥 Resposta turma virtual: ${htmlTurma.length} chars`)
  
  // Salva HTML pra debug
  fs.writeFileSync(`/tmp/sigaa-turma-${turmaId.slice(0,12)}.html`, htmlTurma)
  
  // Cria um objeto resposta fake com o HTML da turma
  return {
    url: `${BASE}/portais/discente/turmaVirtual.jsf?frontEndIdTurma=${turmaId}`,
    text: async () => htmlTurma,
    ok: true
  }
}

// ---------- BAIXA MATERIAIS ----------
async function baixarMateriaisDaTurma(resTurma) {
  const html = await resTurma.text()
  const urlFinal = resTurma.url
  console.log(`  🌐 Na turma virtual: ${urlFinal}`)
  
  const materiais = []
  const extensoes = ['pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'rar', 'odt', 'odp', 'ods', 'txt', 'md', 'jpg', 'png', 'mp4', 'mp3', 'avi', 'mov', 'webm']
  const regexExt = new RegExp(`\\.(${extensoes.join('|')})(['"?\\s])`, 'gi')
  
  for (const m of html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1]
    const texto = m[2].replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim()
    if (!href || !texto) continue
    
    const absUrl = new URL(href, BASE).toString()
    const isArquivo = regexExt.test(href) || /material|slide|apostila|aula|download|anexo|arquivo|pdf|ppt|doc|zip/i.test(texto)
    
    if (isArquivo) {
      materiais.push({ nome: texto || 'arquivo', url: absUrl })
    }
  }
  
  const unicos = []
  const vistas = new Set()
  for (const m of materiais) {
    if (!vistas.has(m.url)) { vistas.add(m.url); unicos.push(m) }
  }
  return { html, materiais: unicos, url: urlFinal }
}

// ---------- BAIXA ARQUIVO ----------
async function baixarArquivo(url, pastaDestino, nomeBase) {
  try {
    const res = await seguir(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ext = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1] || 'bin'
    const nomeSeguro = (nomeBase || 'arquivo').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 100)
    let arquivo = path.join(pastaDestino, `${nomeSeguro}.${ext}`)
    let n = 1
    while (fs.existsSync(arquivo)) { arquivo = path.join(pastaDestino, `${nomeSeguro}-${n}.${ext}`); n++ }
    const buffer = await res.arrayBuffer()
    fs.writeFileSync(arquivo, Buffer.from(buffer))
    return path.basename(arquivo)
  } catch (e) { throw new Error(`${e.message}`) }
}

// ---------- PROCESSA TURMA ----------
async function processarTurma(turma, rowIndex) {
  console.log(`\n📂 ${turma.nome}`)
  
  try {
    const resTurma = await acessarTurmaVirtual(turma.id, rowIndex)
    console.log(`  🌐 Turma virtual: ${resTurma.url}`)
    
    const { materiais } = await baixarMateriaisDaTurma(resTurma)
    
    if (materiais.length === 0) {
      console.log(`  (nenhum material direto)`)
      // Tenta link "Material de Apoio"
      const htmlTurma = await (await seguir(resTurma.url)).text()
      for (const m of htmlTurma.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
        const href = m[1]
        const texto = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
        if (/material\s*(apoio|de apoio)|apostila|slide|arquivo|download|anexo/.test(texto)) {
          const urlMat = new URL(m[1], BASE).toString()
          console.log(`  🔗 Link de material: ${texto.slice(0, 60)}`)
          try {
            const resMat = await seguir(urlMat)
            const htmlMat = await resMat.text()
            return await baixarMateriaisDaTurma(resMat)
          } catch { }
        }
      }
      return { materiais: [] }
    }
    
    console.log(`  📥 ${materiais.length} arquivo(s)`)
    
    const nomeSeguro = turma.nome.replace(/[\\/:*?"<>|]/g, '-').trim()
    const pastaTurma = path.join(VAULT_BASE, nomeSeguro)
    const pastaAnexos = path.join(pastaTurma, 'anexos')
    fs.mkdirSync(pastaAnexos, { recursive: true })
    
    const baixados = []
    for (const mat of materiais) {
      try {
        console.log(`    ⬇️  ${mat.nome.slice(0, 50)}`)
        const salvo = await baixarArquivo(mat.url, pastaAnexos, mat.nome)
        baixados.push(salvo)
      } catch (e) { console.log(`    ⚠️ Falhou: ${e.message}`) }
      await new Promise(r => setTimeout(r, 500))
    }
    
    if (baixados.length) atualizarNotaComAnexos(turma.nome, pastaAnexos, baixados)
    return { materiais: baixados }
    
  } catch (e) { console.log(`  ⚠️ Erro: ${e.message}`); return { materiais: [] } }
}

function atualizarNotaComAnexos(nomeTurma, pastaAnexos, novos) {
  const nomeArq = nomeSeguro(nomeTurma)
  const notaPath = path.join(path.dirname(pastaAnexos), `${nomeArq}.md`)
  let conteudo = fs.existsSync(notaPath) ? fs.readFileSync(notaPath, 'utf8') : ''
  conteudo = conteudo.replace(/## 📎 Anexos[\s\S]*?(?=## |$)/, '')
  const todos = fs.readdirSync(pastaAnexos).filter(f => !f.endsWith('.md'))
  const lista = todos.map(f => `- [[anexos/${f}]]`).join('\n')
  conteudo += `\n## 📎 Anexos (atualizado ${new Date().toLocaleDateString('pt-BR')})\n${lista}\n`
  fs.writeFileSync(notaPath, conteudo)
  console.log(`  📝 Nota atualizada com ${novos.length} arquivo(s)`)
}

function nomeSeguro(s) { return s.replace(/[\\/:*?"<>|]/g, '-').trim() }

// ---------- MAIN ----------
async function main() {
  console.log('🚀 SIGAA DOWNLOADER JSF — Baixando TUDO das turmas virtuais...')
  await doLogin()
  const turmas = await listarTurmas()
  if (turmas.length === 0) { console.log('⚠️ Nenhuma turma'); return }
  
  let total = 0
  for (let i = 0; i < turmas.length; i++) {
    const resultado = await processarTurma(turmas[i], i)
    total += resultado.materiais?.length || 0
    console.log(`  ✅ ${resultado.materiais?.length || 0} arquivo(s)`)
    await new Promise(r => setTimeout(r, 2000))
  }
  console.log(`\n🎉 CONCLUÍDO! ${total} arquivo(s) total`)
  console.log(`📁 Salvos em: ${VAULT_BASE}`)
}

main().catch(e => { console.error('❌ Erro fatal:', e); process.exit(1) })