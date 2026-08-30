// HUB WEB — painel local do Segundo Cérebro
// http://localhost:3777
import http from 'node:http'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { conversar } from './lib.js'
import { criarMaterial } from './notion.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CEREBRO = path.resolve(__dirname, '..', 'cerebro')
const MEMORIA = path.join(CEREBRO, 'sistema', 'memoria')
const LOG_ANEXOS = path.join(MEMORIA, 'arquivos-recebidos.md')
const FILA = path.join(__dirname, 'fila-envio')

const PORTA = 3777
const PASTA_WEB = path.join(CEREBRO, '03-recursos', 'da-web')
const FILA_ENVIO = path.join(__dirname, 'fila-envio')

function slugDe(t) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'pagina'
}

function salvarPagina({ titulo, url, texto }) {
  fs.mkdirSync(PASTA_WEB, { recursive: true })
  const base = path.join(PASTA_WEB, `${slugDe(titulo)}.md`)
  let arquivo = base
  if (fs.existsSync(arquivo)) arquivo = base.replace(/\.md$/, `-${Date.now()}.md`)
  const conteudo = [
    `# ${titulo}`, '',
    `> 🔗 ${url}`,
    `> 📅 salvo em ${new Date().toLocaleDateString('pt-BR')} pelo Ultron (botão do navegador)`, '',
    String(texto ?? '').slice(0, 25000), '',
  ].join('\n')
  fs.writeFileSync(arquivo, conteudo)
  return arquivo
}

// pergunta sobre a página: responde com o cérebro e entrega no Telegram
async function perguntarSobre({ titulo, url, texto, pergunta }) {
  const resposta = await conversar('web-perguntar',
    `Baseado nesta página, responda em português. Se não estiver na página, diga o que sabe.\n\nPÁGINA: ${titulo} (${url})\n\n${String(texto ?? '').slice(0, 4000)}\n\nPERGUNTA: ${pergunta}`)
  try {
    fs.mkdirSync(FILA_ENVIO, { recursive: true })
    fs.writeFileSync(path.join(FILA_ENVIO, `sigaa-telegram-${Date.now()}-web.json`),
      JSON.stringify({ para: 'telegram', texto: `❓ ${pergunta}\n\n📄 ${titulo}\n\n${resposta}` }))
  } catch {}
  return resposta
}

function lerSeguro(arquivo) {
  try { return fs.readFileSync(arquivo, 'utf8') } catch { return '' }
}

function servico(nome) {
  try {
    const estado = execSync(`systemctl --user is-active ${nome}`, { encoding: 'utf8' }).trim()
    const cor = estado === 'active' ? '#4ade80' : estado.includes('tim') ? '#facc15' : '#f87171'
    return `<tr><td>${nome.replace('cerebro-', '')}</td><td style="color:${cor};font-weight:bold">${estado}</td></tr>`
  } catch { return `<tr><td>${nome.replace('cerebro-', '')}</td><td style="color:#f87171">?</td></tr>` }
}

function modeloAtual() {
  const env = lerSeguro(path.join(__dirname, '.env'))
  const m = env.match(/^OLLAMA_MODEL=(.*)$/m)
  return m ? m[1].trim() : '?'
}

function ultimasFalas(n) {
  const agora = new Date()
  const mes = `${String(agora.getFullYear()).slice(2)}-${String(agora.getMonth() + 1).padStart(2, '0')}`
  const linhas = lerSeguro(path.join(MEMORIA, `diario-${mes}.md`)).trim().split('\n').filter(Boolean)
  return linhas.slice(-n).map(l => {
    const cor = l.startsWith('**Wagner:**') ? '#93c5fd' : l.startsWith('**Ultron:**') ? '#a5b4fc' : '#9ca3af'
    return `<div class="fala" style="border-left-color:${cor}">${escapar(l)}</div>`
  }).join('\n') || '<i>diário vazio</i>'
}

function escapar(t) {
  return t.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function notasRecentes() {
  const pastas = [
    path.join(CEREBRO, '01-projetos'),
    path.join(CEREBRO, '02-areas'),
    path.join(CEREBRO, '03-recursos'),
  ]
  const achados = []
  for (const p of pastas) {
    let entradas = []
    try { entradas = fs.readdirSync(p, { recursive: true }) } catch { continue }
    for (const rel of entradas) {
      const cheio = path.join(p, rel)
      if (!rel.endsWith('.md')) continue
      try {
        if (!fs.statSync(cheio).isFile()) continue
      } catch { continue }
      achados.push({ rel, cheio, mtime: fs.statSync(cheio).mtimeMs })
    }
  }
  return achados.sort((a, b) => b.mtime - a.mtime).slice(0, 8)
}

function pagina() {
  const carga = os.loadavg().map(v => v.toFixed(1)).join(' / ')
  const livreMB = Math.round(os.freemem() / 1024 / 1024)
  const totalMB = Math.round(os.totalmem() / 1024 / 1024)
  const fila = (() => { try { return fs.readdirSync(FILA).filter(f => f.endsWith('.json')).length } catch { return 0 } })()

  const notasHtml = notasRecentes().map(n =>
    `<li><span style="color:#6b7280">${escapar(path.dirname(n.rel))}/</span> <a href="#" onclick="return false" style="color:#e5e7eb;text-decoration:none">${escapar(path.basename(n.rel))}</a></li>`
  ).join('')

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>🧠 Segundo Cérebro</title>
<style>
  body{background:#0f172a;color:#e5e7eb;font-family:system-ui,sans-serif;margin:24px;line-height:1.45}
  h1{font-size:1.4rem} h2{font-size:1.05rem;color:#818cf8;margin-top:28px}
  .grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
  .cartao{background:#1e293b;border-radius:12px;padding:14px 16px}
  table{border-collapse:collapse;width:100%}
  td{padding:3px 10px 3px 0}
  .fala{padding:3px 10px;margin:3px 0;border-left:3px solid #334155;font-size:.88rem;color:#cbd5e1;white-space:pre-wrap}
  ul{margin:4px 0;padding-left:18px}
  .meta{color:#94a3b8;font-size:.85rem}
</style></head><body>
<h1>🧠 Segundo Cérebro — Ultron</h1>
<div class="meta">${new Date().toLocaleString('pt-BR')} · atualiza a cada 30s</div>

<div class="grade">
<div class="cartao"><h2>⚙️ Serviços</h2>
<table>
${servico('cerebro-whatsapp.service')}
${servico('cerebro-gateway.service')}
${servico('cerebro-sigaa.timer')}
${servico('cerebro-wake.service')}
${servico('cerebro-rvc.service')}
<tr><td>ollama</td><td id="ollama"></td></tr>
</table></div>

<div class="cartao"><h2>💻 Máquina</h2>
<table>
<tr><td>carga (1/5/15min)</td><td>${carga}${parseFloat(carga.split(' / ')[0]) > 3 ? ' 🔥' : ' ✅'}</td></tr>
<tr><td>RAM</td><td>livre ${livreMB} MB / ${totalMB} MB</td></tr>
<tr><td>modelo ativo</td><td>${modeloAtual()}</td></tr>
<tr><td>fila de envio</td><td>${fila === 0 ? 'vazia ✅' : fila + ' pendente(s)'}</td></tr>
</table></div>

<div class="cartao"><h2>📔 Diário de hoje</h2>
${ultimasFalas(10)}
</div>

<div class="cartao"><h2>📝 Notas recentes</h2><ul>${notasHtml || '<i>nenhuma</i>'}</ul></div>

<div class="cartao"><h2>🧩 Fatos & Pessoas</h2>
<div class="fala" style="border-left-color:#34d399">${escapar(lerSeguro(path.join(MEMORIA, 'fatos.md')).slice(0, 600)) || '<i>vazio</i>'}</div>
<div class="fala" style="border-left-color:#fbbf24">${escapar(lerSeguro(path.join(MEMORIA, 'pessoas.md')).slice(0, 400)) || '<i>vazio</i>'}</div>
</div>

<div class="cartao"><h2>📥 Arquivos organizados</h2>
${lerSeguro(LOG_ANEXOS).trim().split('\n').filter(l => l.startsWith('- ')).slice(-8).reverse().map(l => `<div class="fala" style="border-left-color:#38bdf8">${escapar(l)}</div>`).join('\n') || '<i>nada por aqui ainda</i>'}
</div>
</div>

<script>fetch('/api/ollama').then(r=>r.json()).then(d=>{document.getElementById('ollama').innerHTML=d.vivo?'<span style="color:#4ade80;font-weight:bold">ativo</span>'+(d.modelo?' ('+d.modelo+' na RAM)':' <span style="color:#6b7280">(frio, carrega ao usar)</span>'):'<span style="color:#f87171;font-weight:bold">fora do ar</span>'}).catch(()=>{document.getElementById('ollama').innerHTML='<span style="color:#f87171;font-weight:bold">fora do ar</span>'})</script>
</body></html>`
}

http.createServer(async (req, res) => {
  // CORS para o SIGAA mandar arquivos direto pro vault
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (req.method === 'POST' && req.url === '/api/materia-atual') {
    let corpo=''; req.on('data',c=>corpo+=c); req.on('end',()=>{
      try{ const {materia}=JSON.parse(corpo||'{}'); fs.writeFileSync('/tmp/ultima-materia-sigaa.txt', String(materia||'')); res.writeHead(200,{...cors,'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:true, materia})); }catch(e){ res.writeHead(400,{...cors,'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:false,erro:e.message})) }
    }); return
  }
  if (req.method === 'POST' && req.url === '/api/arquivo') {
    let corpo = ''
    req.on('data', c => { corpo += c; if (corpo.length > 80_000_000) req.destroy() })
    req.on('end', () => {
      try {
        const { materia, nome, base64 } = JSON.parse(corpo || '{}')
        if (!materia || !nome || !base64) throw new Error('materia/nome/base64 obrigatório')
        const pasta = path.join(CEREBRO, '02-areas', 'faculdade', String(materia).replace(/[\\/:*?"<>|]/g,'-').trim(), 'anexos')
        fs.mkdirSync(pasta, { recursive: true })
        const ext = path.extname(nome) || '.pdf'
        let base = String(nome).replace(/[\\/:*?"<>|]/g,'-').trim().slice(0,120)
        if (!base.toLowerCase().endsWith(ext.toLowerCase())) base += ext
        let dest = path.join(pasta, base)
        let n=1; while(fs.existsSync(dest)){ dest = path.join(pasta, base.replace(/(\.[^.]+)$/, `-${n}$1`)); n++ }
        fs.writeFileSync(dest, Buffer.from(base64, 'base64'))
        // atualiza nota da matéria
        const nota = path.join(path.dirname(pasta), String(materia).replace(/[\\/:*?"<>|]/g,'-').trim() + '.md')
        if (fs.existsSync(nota)) {
          let md = fs.readFileSync(nota,'utf8')
          if (!md.includes(path.basename(dest))) {
            if (!md.includes('## 📎 Anexos')) md += `\n## 📎 Anexos\n`
            md = md.replace('## 📎 Anexos', `## 📎 Anexos\n- [[anexos/${path.basename(dest)}]]`)
            fs.writeFileSync(nota, md)
          }
        }
        fs.appendFileSync(LOG_ANEXOS, `- ${new Date().toLocaleString('pt-BR')} — \`${path.basename(dest)}\` → \`${String(materia)}/anexos/\`\n`)
        console.log(`📎 [sigaa] ${path.basename(dest)} → ${String(materia)}/anexos/`)
        // sync Notion Materiais (fire-and-forget)
        criarMaterial({ titulo: path.basename(dest), materia: String(materia), tipo: ext.replace('.','').toUpperCase(), link: '', conteudo: `Arquivo SIGAA • ${String(materia)} • ${new Date().toLocaleDateString('pt-BR')}` }).catch(e=>console.error('Notion Materiais erro:',e.message))
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ ok:true, arquivo: path.basename(dest) }))
      } catch(e){ res.writeHead(400, { ...cors, 'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:false, erro:e.message})) }
    })
    return
  }
  if (req.url === '/api/ollama') {
    let vivo = false, modelo = ''
    try {
      const r = await fetch('http://localhost:11434/api/ps', { signal: AbortSignal.timeout(3000) })
      const d = await r.json()
      vivo = true
      modelo = d.models?.[0]?.name ?? ''
    } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ vivo, modelo }))
  }

  // botões do navegador falam com o cérebro aqui
  if (req.method === 'POST' && (req.url === '/api/salvar' || req.url === '/api/perguntar')) {
    let corpo = ''
    req.on('data', c => { corpo += c; if (corpo.length > 200_000) req.destroy() })
    req.on('end', async () => {
      try {
        const d = JSON.parse(corpo || '{}')
        if (req.url === '/api/salvar') {
          const arquivo = salvarPagina(d)
          console.log(`💾 [web] salvo: ${path.basename(arquivo)}`)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          return res.end(JSON.stringify({ ok: true, arquivo: path.basename(arquivo) }))
        }
        perguntarSobre(d).then(r => console.log(`❓ [web] respondido: ${d.pergunta}`))
          .catch(e => console.error(`⚠️ [web] ${e.message}`))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, msg: 'processando, resposta vai pro Telegram' }))
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, erro: e.message }))
      }
    })
    return
  }

  // página pra instalar os botões na barra de favoritos
  if (req.url === '/instalar') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Instalar botões do Ultron</title>
<style>body{background:#0f172a;color:#e5e7eb;font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;line-height:1.6}
.botao{display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:10px;margin:6px;font-weight:bold;text-decoration:none;cursor:grab}</style></head><body>
<h1>🧠 Botões do Ultron no navegador</h1>
<p><b>Arraste os dois botões abaixo</b> pra barra de favoritos do Brave (se a barra estiver escondida, aperte <code>Ctrl+Shift+B</code>):</p>
<p>
<a class="botao" href="javascript:(()=>{fetch('http://localhost:3777/api/salvar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({titulo:document.title,url:location.href,texto:document.body.innerText.slice(0,25000)})}).then(r=>r.json()).then(d=>alert(d.ok?'💾 Ultron guardou:\\n'+d.arquivo:'⚠️ falhou: '+d.erro)).catch(()=>alert('⚠️ hub não respondeu'))})()">💾 Salvar no cérebro</a>
<a class="botao" href="javascript:(()=>{const q=prompt('Pergunta pro Ultron sobre esta página:');if(!q)return;fetch('http://localhost:3777/api/perguntar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({titulo:document.title,url:location.href,texto:document.body.innerText.slice(0,25000),pergunta:q})}).then(()=>alert('🧠 Ultron tá pensando... a resposta chega no seu Telegram!'))})()">❓ Perguntar ao Ultron</a>
</p>
<ol>
<li><b>💾 Salvar no cérebro</b> — guarda a página inteira no Obsidian (<code>03-recursos/da-web/</code>) pra ver quando quiser.</li>
<li><b>❓ Perguntar ao Ultron</b> — pergunta o que quiser sobre a página; ele pensa e <b>responde no seu Telegram</b>.</li>
</ol>
<p style="color:#94a3b8">Funciona em qualquer página, sem Telegram aberto. O cérebro roda aqui no seu notebook mesmo. ✅</p>
</body></html>`)
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(pagina())
}).listen(PORTA, '127.0.0.1', () => console.log(`🌐 Hub do cérebro em http://localhost:${PORTA}`))
