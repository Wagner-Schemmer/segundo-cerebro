// BRAVE ESTUDOS — controla um Brave dedicado via CDP (Chrome DevTools Protocol)
// O Ultron lê a página ativa, responde perguntas sobre ela e controla abas.
import WebSocket from 'ws'
import http from 'node:http'

const PORTA_CDP = 9222
const BASE = `http://127.0.0.1:${PORTA_CDP}`

function get(caminho) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${caminho}`, { timeout: 4000 }, res => {
      let d = ''
      res.on('data', c => (d += c))
      res.on('end', () => {
        try { resolve(JSON.parse(d)) } catch { resolve(d) }
      })
    })
    req.on('error', () => reject(new Error('Brave estudos não está aberto')))
    req.on('timeout', () => { req.destroy(); reject(new Error('Brave demorou demais')) })
  })
}

export async function bravoVivo() {
  try { await get('/json/version'); return true } catch { return false }
}

export async function listarAbas() {
  const alvos = await get('/json/list')
  return alvos.filter(a => a.type === 'page' && !a.url.startsWith('devtools'))
}

// fala direto com uma aba por WebSocket
function falarComAba(wsUrl, msg) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { handshakeTimeout: 5000 })
    ws.on('open', () => ws.send(JSON.stringify({ id: 1, ...msg })))
    ws.on('message', d => {
      const r = JSON.parse(d)
      if (r.id === 1) { ws.close(); resolve(r) }
    })
    ws.on('error', e => reject(new Error(`aba não responde: ${e.message}`)))
    setTimeout(() => { ws.close(); reject(new Error('aba demorou demais')) }, 8000)
  })
}

// texto legível da página (o "ver" do Ultron)
export async function lerPagina(indice = 0) {
  const abas = await listarAbas()
  if (!abas.length) throw new Error('nenhuma aba aberta')
  const aba = abas[Math.min(indice, abas.length - 1)]
  const r = await falarComAba(aba.webSocketDebuggerUrl, {
    method: 'Runtime.evaluate',
    params: { expression: 'document.body ? document.body.innerText.slice(0, 12000) : ""', returnByValue: true },
  })
  return {
    titulo: aba.title,
    url: aba.url,
    texto: r.result?.result?.value ?? '',
  }
}

export async function abrir(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  const aba = await get(`/json/new?${encodeURIComponent(url)}`)
  return aba
}

export async function pesquisar(termos) {
  return abrir('https://duckduckgo.com/?q=' + encodeURIComponent(termos))
}

export async function fechar(id) {
  const r = await get(`/json/close/${id}`)
  return String(r).includes('true') || r === true
}

export async function focar(id) {
  await get(`/json/activate/${id}`)
}
