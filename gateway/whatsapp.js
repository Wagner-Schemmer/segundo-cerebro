// Gateway WhatsApp do Segundo Cérebro (via Baileys, sem navegador)
// Uso: npm run whatsapp
// Na primeira execução escaneie o QR code que aparece no terminal.

import { estado, conversar, salvarNota } from './lib.js'

let baileys
try {
  baileys = await import('@whiskeysockets/baileys')
} catch {
  console.error('❌ Baileys não instalado. Rode: npm i @whiskeysockets/baileys pino')
  process.exit(1)
}

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys
const P = (await import('pino')).default({ level: 'silent' })

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState('./sessao-whatsapp')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: P,
    browser: ['Segundo Cerebro', 'Chrome', '1.0'],
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') console.log('✅ WhatsApp conectado!')
    if (connection === 'close') {
      const codigo = lastDisconnect?.error?.output?.statusCode
      if (codigo === DisconnectReason.loggedOut) {
        console.log('❌ Sessão deslogada. Apague a pasta sessao-whatsapp e rode de novo.')
        process.exit(1)
      }
      console.log('🔄 Reconectando...')
      conectar()
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue
      const texto = msg.message.conversation ?? msg.message.extendedTextMessage?.text
      if (!texto) continue

      const chatId = msg.key.remoteJid
      console.log(`📩 [${chatId}] ${texto.slice(0, 60)}`)

      try {
        let resposta
        if (texto.startsWith('/nota')) {
          const conteudo = texto.slice(5).trim()
          resposta = conteudo ? `📝 Salvo em 00-inbox/${salvarNota(conteudo)}` : 'Uso: /nota texto'
        } else {
          resposta = await conversar(`wa-${chatId}`, texto)
        }
        await sock.sendMessage(chatId, { text: resposta }, { quoted: msg })
      } catch (e) {
        console.error(e)
        await sock.sendMessage(chatId, { text: `⚠️ Erro: ${e.message}` })
      }
    }
  })
}

conectar()
console.log(`🧠 Gateway WhatsApp iniciando | modelo: ${estado.modelo}`)
