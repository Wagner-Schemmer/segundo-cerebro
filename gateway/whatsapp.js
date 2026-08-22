// ULTRON — Gateway WhatsApp do Segundo Cérebro
// Uso: npm run whatsapp  (primeira vez: escaneia QR)
//
// Recebe: textos (conversa IA + /nota), documentos, imagens e áudios → cerebro/
// Envia:  qualquer automação solta um .json em ./fila-envio e o Ulton entrega

import { estado, conversar, salvarNota, listarSkills, obterSkill, esquecer } from './lib.js'
import { transcrever, sintetizar, vozDisponivel } from './voz.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILA_ENVIO = path.join(__dirname, 'fila-envio')
const ARQUIVOS_CEREBRO = path.join(__dirname, '..', 'cerebro', '00-inbox', 'arquivos')

let baileys
try {
  baileys = await import('@whiskeysockets/baileys')
} catch {
  console.error('❌ Baileys não instalado. Rode: npm i @whiskeysockets/baileys pino')
  process.exit(1)
}

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } = baileys
const P = (await import('pino')).default({ level: 'silent' })

const vistos = new Set()
let sock = null
const pendentes = new Map()   // respostas aguardando /ok
const modoVoz = new Map()     // chatId -> responde também em nota de voz?
let contadorAprovacao = 0
let ultimoId = 0

function marcarVisto(id) {
  vistos.add(id)
  if (vistos.size > 3000) {
    let i = 0
    for (const v of vistos) { vistos.delete(v); if (++i > 1000) break }
  }
}

function meuNumero() {
  return sock?.user?.id?.split(':')[0]?.split('@')[0] ?? null
}

// Nome dos grupos (cache pra não perguntar pro servidor toda hora)
const nomesGrupos = new Map()
async function nomeDoGrupo(chatId) {
  if (!nomesGrupos.has(chatId)) {
    try {
      nomesGrupos.set(chatId, (await sock.groupMetadata(chatId)).subject ?? '')
    } catch { return '' }
  }
  return nomesGrupos.get(chatId)
}

async function responder(chatId, texto, citando) {
  const enviada = await sock.sendMessage(chatId, { text: texto }, citando ? { quoted: citando } : {})
  if (enviada?.key?.id) marcarVisto(enviada.key.id)
}

async function responderVoz(chatId, texto, citando) {
  const ogg = await sintetizar(texto)
  try {
    await sock.sendMessage(chatId,
      { audio: fs.readFileSync(ogg), mimetype: 'audio/ogg; codecs=opus', ptt: true },
      citando ? { quoted: citando } : {})
  } finally { fs.rmSync(ogg, { force: true }) }
}

async function salvarArquivo(msg) {
  const m = msg.message
  const tipo = m.documentMessage ? 'document' : m.imageMessage ? 'image'
    : m.audioMessage ? 'audio' : m.videoMessage ? 'video' : null
  if (!tipo) return null

  fs.mkdirSync(ARQUIVOS_CEREBRO, { recursive: true })
  const buffer = await downloadMediaMessage(msg, { reuploadRequest: sock.updateMediaMessage, logger: P })

  const hoje = new Date().toISOString().slice(0, 10)
  const hora = new Date().toTimeString().slice(0, 5).replace(':', '')
  const exts = { document: '', image: '.jpg', audio: '.ogg', video: '.mp4' }
  const nomeOriginal = m.documentMessage?.fileName ?? `${tipo}-${hoje}${exts[tipo]}`
  const seguro = nomeOriginal.replace(/[^\w.\-\u00C0-\u024F ]/g, '_').slice(0, 80)
  const destino = path.join(ARQUIVOS_CEREBRO, `${hoje}-${hora}-${seguro}`)
  fs.writeFileSync(destino, buffer)
  return path.relative(path.join(__dirname, '..'), destino)
}

async function processarFilaEnvio() {
  if (!sock?.user) return
  let pendentes
  try { pendentes = fs.readdirSync(FILA_ENVIO).filter(f => f.endsWith('.json')) } catch { return }
  for (const arquivo of pendentes) {
    const caminho = path.join(FILA_ENVIO, arquivo)
    try {
      const pedido = JSON.parse(fs.readFileSync(caminho, 'utf8'))
      const numero = pedido.para === 'eu' || !pedido.para ? meuNumero() : String(pedido.para).replace(/\D/g, '')
      await sock.sendMessage(`${numero}@s.whatsapp.net`, { text: pedido.texto })
      console.log(`📤 Enviado para ${pedido.para === 'eu' ? 'você' : pedido.para}: ${String(pedido.texto).slice(0, 60)}`)
      fs.unlinkSync(caminho)
    } catch (e) {
      console.error(`⚠️ Falha na fila (${arquivo}): ${e.message}`)
      fs.renameSync(caminho, caminho.replace(/\.json$/, '.falha'))
    }
  }
}

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessao-whatsapp')
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    auth: state,
    logger: P,
    browser: ['Segundo Cerebro', 'Chrome', '1.0'],
    markOnlineOnConnect: false,
  })

  // Pareamento opcional por código (WHATSAPP_PHONE no .env); padrão é QR
  if (!state.creds.registered && process.env.WHATSAPP_PHONE) {
    setTimeout(async () => {
      const codigo = await sock.requestPairingCode(process.env.WHATSAPP_PHONE).catch(() => null)
      if (codigo) console.log(`\n🔑 CÓDIGO DE PAREAMENTO: ${codigo.match(/.{1,4}/g)?.join('-')}\n`)
    }, 3000)
  }

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
    if (qr && !state.creds.registered) {
      console.log('\n📱 Escaneie este QR com o WhatsApp:\n')
      ;(await import('qrcode-terminal')).default.generate(qr, { small: true })
    }
    if (connection === 'open') {
      console.log('🤖 Ultron conectado ao WhatsApp!')
      console.log('💬 Teste: mande mensagem pra VOCÊ MESMO no WhatsApp')
      setInterval(processarFilaEnvio, 3000)
    }
    if (connection === 'close') {
      const codigo = lastDisconnect?.error?.output?.statusCode
      if (codigo === DisconnectReason.loggedOut) {
        console.log('⚠️ Sessão inválida — apagando; rode de novo pra novo QR')
        fs.rmSync('./sessao-whatsapp', { recursive: true, force: true })
        process.exit(2)
      }
      console.log('🔄 Reconectando...')
      conectar()
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    console.log(`🔔 [diagnóstico] evento recebido: tipo=${type}, qtd=${messages.length}`)
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message || vistos.has(msg.key.id)) continue
      marcarVisto(msg.key.id)

      const chatId = msg.key.remoteJid
      if (chatId === 'status@broadcast') continue

      const numeroChat = chatId.split('@')[0].split(':')[0]
      let zonaLivre = !chatId.endsWith('@g.us') && meuNumero() === numeroChat

      // Grupo chamado "Ultron" = sala de comando (como auto-chat). Outros grupos: silêncio.
      if (chatId.endsWith('@g.us')) {
        const nome = ((await nomeDoGrupo(chatId)) || '').toLowerCase()
        if (nome !== 'ultron') continue
        zonaLivre = true
      }

      if (msg.key.fromMe && !zonaLivre) continue

      const chatEu = `${meuNumero()}@s.whatsapp.net`
      const m = msg.message
      const texto = m.conversation ?? m.extendedTextMessage?.text ?? ''

      // ===== Arquivos: direto pro Obsidian (de qualquer pessoa) =====
      if (m.documentMessage || m.imageMessage || m.audioMessage || m.videoMessage) {
        let onde = null
        try {
          onde = await salvarArquivo(msg)
          if (onde) console.log(`📥 Arquivo salvo: ${onde}`)
        } catch (e) { console.error('Erro ao salvar arquivo:', e.message) }

        // 🎙️ MODO JARVIS: áudio na zona livre vira conversa por voz
        if (m.audioMessage && zonaLivre && onde) {
          const caminhoAbs = path.join(__dirname, '..', onde)
          await responder(chatId, '🎤 Ouvindo…')
          try {
            let falado = await transcrever(caminhoAbs)
            falado = falado.replace(/^\s*(oi+|ol[áa]|e a[íi]|hey)\s*(ultron)?\s*[,.!]?\s*/i, '').trim() || falado
            if (!falado) {
              await responder(chatId, '🤔 Não consegui entender o áudio. Manda de novo?')
              continue
            }
            console.log(`🎤 [voz] ${falado.slice(0, 70)}`)
            const resposta = await conversar(`wa-${chatId}`, `🗣️ ${falado}`)
            await responder(chatId, `🗣️ _"${falado.slice(0, 150)}"_\n\n${resposta}`, msg)
            if (modoVoz.get(chatId) !== false && vozDisponivel().tts) {
              await responderVoz(chatId, resposta).catch(e => console.error('TTS:', e.message))
            }
          } catch (e) {
            console.error('Falha no fluxo de voz:', e.message)
            await responder(chatId, `⚠️ Problema com o áudio: ${e.message}`)
          }
          continue
        }

        if (onde && (!zonaLivre || chatId === chatEu)) {
          await responder(chatEu, `📥 Recebi um arquivo de ${numeroChat} e guardei: ${onde}`)
        }
        continue
      }

      if (!texto?.trim()) continue
      console.log(`📩 [${zonaLivre ? (chatId.endsWith('@g.us') ? 'grupo-ultron' : 'autoconversa') : numeroChat}] ${texto.slice(0, 60)}`)

      // ===== Zona livre (auto-chat ou grupo Ultron): comandos + conversa direta =====
      if (zonaLivre) {
        const comando = texto.trim().toLowerCase()
        if (comando.startsWith('/ok')) {
          const n = Number(comando.split(/\s+/)[1] ?? ultimoId)
          const pend = pendentes.get(n)
          if (!pend) { await responder(chatId, `❓ Não achei a sugestão #${n || ultimoId}`); continue }
          await responder(pend.chatId, pend.texto)
          pendentes.delete(n)
          await responder(chatId, `✅ Resposta enviada para ${pend.chatId.split('@')[0]}`)
          continue
        }
        if (['/não', '/nao', '/cancelar'].some(c => comando.startsWith(c))) {
          const n = Number(comando.split(/\s+/)[1] ?? ultimoId)
          pendentes.delete(n)
          await responder(chatId, `🗑️ Sugestão #${n || ultimoId} descartada`)
          continue
        }
        if (comando.startsWith('/voz')) {
          const arg = comando.split(/\s+/)[1]
          if (arg === 'off' || arg === 'desliga') modoVoz.set(chatId, false)
          else if (arg === 'on' || arg === 'liga') modoVoz.set(chatId, true)
          const d = vozDisponivel()
          await responder(chatId,
            `🎙️ Respostas em voz: ${modoVoz.get(chatId) === false ? 'DESLIGADAS' : 'ligadas'}\n` +
            `👂 Ouvido (whisper): ${d.stt ? '✓' : '✗ instalando'}\n` +
            `🗣️ Boca (piper): ${d.tts ? '✓' : '✗ instalando'}`)
          continue
        }
        if (comando.startsWith('/skills')) {
          const lista = listarSkills()
          await responder(chatId, lista.length
            ? `🎯 Skills disponíveis:\n${lista.map(s => `• *${s.id}* — ${s.desc}`).join('\n')}\n\nUse: /skill <nome>`
            : 'Nenhuma skill ainda. Crie .md em cerebro/sistema/skills/')
          continue
        }
        if (comando.startsWith('/skill ')) {
          const s = obterSkill(texto.slice(7).trim())
          if (!s) { await responder(chatId, '❓ Skill não encontrada. Use /skills'); continue }
          estado.skillsAtivas.set(`wa-${chatId}`, s)
          esquecer.length // no-op
          await responder(chatId, `🎯 Skill **${s.titulo}** ativada nesta conversa!\n(mande /esquecer pra desligar)`)
          continue
        }
        if (comando === '/esquecer') {
          esquecer(`wa-${chatId}`)
          await responder(chatId, '🧹 Conversa e skill zeradas pra este chat.')
          continue
        }
        try {
          let resposta
          if (texto.startsWith('/nota')) {
            const conteudo = texto.slice(5).trim()
            resposta = conteudo ? `📝 Salvo: ${salvarNota(conteudo)}` : 'Uso: /nota #area texto'
          } else {
            resposta = await conversar(`wa-${chatId}`, texto)
          }
          await responder(chatId, resposta, msg)
        } catch (e) {
          console.error(e)
          await responder(chatId, `⚠️ Erro: ${e.message}`)
        }
        continue
      }

      // ===== Mensagem de outra pessoa: prepara e PEDE APROVAÇÃO antes de enviar =====
      try {
        const sugestao = await conversar(`wa-${chatId}`, texto)
        const n = ++contadorAprovacao
        ultimoId = n
        pendentes.set(n, { chatId, texto: sugestao })
        await responder(chatEu,
          `📩 *${numeroChat}* disse:\n"${texto.slice(0, 200)}"\n\n🤖 *Sugestão de resposta (#${n}):*\n${sugestao}\n\n` +
          `/ok ${n} → envia\n/não ${n} → descarta\n(ou simplesmente responda você mesmo)`)
      } catch (e) {
        console.error(e)
        await responder(chatEu, `⚠️ Erro ao preparar resposta para ${numeroChat}: ${e.message}`)
      }
    }
  })
}

fs.mkdirSync(FILA_ENVIO, { recursive: true })
conectar()
console.log('🤖 ULTRON | WhatsApp iniciando...')
