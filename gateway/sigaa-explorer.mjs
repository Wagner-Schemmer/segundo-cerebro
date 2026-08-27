// SIGAA EXPLORER — usa o robô existente pra descobrir a estrutura do portal
// Roda: node sigaa-explorer.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { req, seguir, login, BASE } from './sigaa.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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

async function doLogin() {
  const user = process.env.SIGAA_USER
  const pass = process.env.SIGAA_PASS
  console.log('🔐 Logando...')
  await login(user, pass)
  console.log('✅ Logado!')
}

// Salva HTML pra análise
function salvarHTML(nome, html) {
  fs.writeFileSync(`/tmp/sigaa-${nome}.html`, html)
  console.log(`  💾 Salvo: /tmp/sigaa-${nome}.html`)
}

async function explorar() {
  await doLogin()
  
  console.log('\n📍 1. Portal principal do discente...')
  const portal = await seguir(`${BASE}/verPortalDiscente.do`)
  const html = await portal.text()
  salvarHTML('portal-discente', html)
  
  // Procura TODOS os links do portal
  console.log('\n🔍 Analisando links do portal...')
  const links = []
  for (const m of html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1]
    const texto = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (href && texto) {
      const abs = new URL(href, BASE).toString()
      links.push({ texto: texto.slice(0, 80), url: abs })
    }
  }
  
  // Agrupa por tipo
  const categorias = {
    turmas: [],
    materiais: [],
    notas: [],
    outros: []
  }
  
  for (const l of links) {
    const t = l.texto.toLowerCase()
    const u = l.url.toLowerCase()
    if (/turma|disciplina|mat[eé]ria|componente/i.test(t) || /turma|disciplina|componente/i.test(u)) {
      categorias.turmas.push(l)
    } else if (/material|slide|apostila|aula|download|anexo|arquivo/i.test(t) || /material|slide|anexo|download/i.test(u)) {
      categorias.materiais.push(l)
    } else if (/nota|avalia|prova|trabalho|conceito/i.test(t)) {
      categorias.notas.push(l)
    } else {
      categorias.outros.push(l)
    }
  }
  
  console.log('\n📊 LINKS ENCONTRADOS NO PORTAL:')
  console.log(`  📚 Turmas/Disciplinas: ${categorias.turmas.length}`)
  console.log(`  📎 Materiais/Slides: ${categorias.materiais.length}`)
  console.log(`  📝 Notas/Avaliações: ${categorias.notas.length}`)
  console.log(`  📦 Outros: ${categorias.outros.length}`)
  
  // Mostra exemplos de cada categoria
  for (const [cat, arr] of Object.entries(categorias)) {
    if (arr.length) {
      console.log(`\n  === ${cat.toUpperCase()} (primeiros 10) ===`)
      arr.slice(0, 10).forEach(l => console.log(`  • ${l.texto} → ${l.url}`))
    }
  }
  
  // Se achou turmas, explora a primeira
  if (categorias.turmas.length) {
    console.log('\n🔍 2. Explorando primeira turma encontrada...')
    const primeira = categorias.turmas[0]
    console.log(`   Acessando: ${primeira.texto} → ${primeira.url}`)
    
    try {
      const res = await seguir(primeira.url)
      const html = await res.text()
      salvarHTML('turma-exemplo', html)
      
      // Procura links dentro da turma
      const subLinks = []
      for (const m of html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
        const href = m[1]
        const texto = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        if (href && texto) {
          const abs = new URL(href, BASE).toString()
          subLinks.push({ texto: texto.slice(0, 80), url: abs })
        }
      }
      
      console.log(`   📎 Links dentro da turma: ${subLinks.length}`)
      const matLinks = subLinks.filter(l => /material|slide|apostila|aula|download|anexo|arquivo|pdf|ppt/i.test(l.texto.toLowerCase()) || /material|slide|anexo|download/.test(l.url.toLowerCase()))
      console.log(`   📎 Possíveis materiais: ${matLinks.length}`)
      matLinks.slice(0, 15).forEach(l => console.log(`     • ${l.texto} → ${l.url}`))
      
      // Tenta achar página específica de material de apoio
      const matApoioPatterns = [
        'materialApoio.jsf',
        'materialApoio.do',
        'verMaterialApoio',
        'material_apoi',
        'arquivos',
        'download'
      ]
      for (const pattern of matApoioPatterns) {
        const testUrl = primeira.url.replace(/[^/]+$/, '') + pattern
        try {
          const res = await seguir(testUrl)
          if (res.ok) {
            console.log(`   ✅ Página de material encontrada: ${testUrl}`)
            const html2 = await res.text()
            salvarHTML('material-apoio', html2)
            break
          }
        } catch { }
      }
      
    } catch (e) {
      console.log(`   ⚠️ Erro ao explorar turma: ${e.message}`)
    }
  }
  
  // Tenta URLs conhecidas de material de apoio
  console.log('\n🔍 3. Testando URLs conhecidas de material de apoio...')
  const knownPaths = [
    'verMaterialApoioDiscente.do',
    'materialApoioDiscente.jsf',
    'portalDiscente/materialApoio.jsf',
    'aluno/materialApoio.jsf'
  ]
  
  for (const p of knownPaths) {
    try {
      const url = `${BASE}/${p}`
      const res = await seguir(url)
      if (res.ok && !res.url.includes('login')) {
        console.log(`   ✅ ${url} → ${res.url}`)
        const html = await res.text()
        salvarHTML(`known-${p.replace(/\//g, '-')}`, html)
      }
    } catch { }
  }
  
  console.log('\n✅ EXPLORAÇÃO CONCLUÍDA!')
  console.log('📁 HTMLs salvos em /tmp/sigaa-*.html — abre no navegador pra ver a estrutura')
}

explorar().catch(e => { console.error('❌', e); process.exit(1) })