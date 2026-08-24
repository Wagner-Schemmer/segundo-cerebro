// HUB WEB — painel local do Segundo Cérebro
// http://localhost:3777
import http from 'node:http'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CEREBRO = path.resolve(__dirname, '..', 'cerebro')
const MEMORIA = path.join(CEREBRO, 'sistema', 'memoria')
const FILA = path.join(__dirname, 'fila-envio')

const PORTA = 3777

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
</div>

<script>fetch('/api/ollama').then(r=>r.json()).then(d=>{document.getElementById('ollama').innerHTML=d.vivo?'<span style="color:#4ade80;font-weight:bold">ativo</span> ('+d.modelo+')':'<span style="color:#f87171;font-weight:bold">fora do ar</span>'}).catch(()=>{document.getElementById('ollama').innerHTML='<span style="color:#f87171;font-weight:bold">fora do ar</span>'})</script>
</body></html>`
}

http.createServer(async (req, res) => {
  if (req.url === '/api/ollama') {
    let vivo = false, modelo = ''
    try {
      const r = await fetch('http://localhost:11434/api/ps', { signal: AbortSignal.timeout(3000) })
      const d = await r.json()
      vivo = d.models?.length > 0
      modelo = d.models?.[0]?.name ?? ''
    } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ vivo, modelo }))
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(pagina())
}).listen(PORTA, '127.0.0.1', () => console.log(`🌐 Hub do cérebro em http://localhost:${PORTA}`))
