// Gateway Telegram do Segundo Cérebro
// Uso: npm start  (requer .env com TELEGRAM_BOT_TOKEN)

import { Telegraf } from 'telegraf'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'
import { conversar, salvarNota, statusMaquina, estado, MODELO_PADRAO } from './lib.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const executar = promisify(exec)
const ARQ_DONO = path.join(__dirname, '.dono-telegram')

// O primeiro que usar /run vira o dono registrado (depois só ele)
function ehDono(ctx) {
  const id = String(ctx.message?.from?.id ?? '')
  if (!id || id === 'undefined') return false
  try {
    const salvo = fs.readFileSync(ARQ_DONO, 'utf8').trim()
    if (salvo) return id === salvo
  } catch {}
  fs.writeFileSync(ARQ_DONO, id)
  console.log(`👑 Dono do Telegram registrado: ${id}`)
  return true
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, { handlerTimeout: 300_000 })

bot.command('start', ctx => ctx.reply(
  '🤖 Ultron online!\n\n' +
  'Me mande qualquer texto que eu respondo.\n' +
  '/nota <texto> — salva no Obsidian (#faculdade #trabalho #cursos #vida #projetos)\n' +
  '/run <comando> — executa no notebook (só o dono)\n' +
  '/modelo <nome> — troca o modelo Ollama\n' +
  '/status — RAM e modelos'
))

bot.command('run', async ctx => {
  if (!ehDono(ctx)) return ctx.reply('🔒 Só o dono pode usar /run.')
  const cmd = ctx.message.text.split(' ').slice(1).join(' ').trim()
  if (!cmd) return ctx.reply('Uso: /run <comando>\nEx: /run npm run sigaa')
  await ctx.sendChatAction('typing')
  try {
    const { stdout, stderr } = await executar(cmd, { timeout: 120_000, maxBuffer: 1024 * 1024 })
    let saida = (stdout + (stderr ? `\n${stderr}` : '')).trim() || '(sem saída)'
    if (saida.length > 3500) saida = `${saida.slice(0, 3500)}\n…(cortado)`
    await ctx.reply(`$ ${cmd}\n\n${saida}`)
  } catch (e) {
    let saida = ((e.stdout ?? '') + (e.stderr ?? '')).trim() || e.message
    if (saida.length > 3500) saida = `${saida.slice(0, 3500)}\n…(cortado)`
    await ctx.reply(`❌ $ ${cmd}\n\n${saida}`)
  }
})

bot.command('status', async ctx => ctx.reply(await statusMaquina()))

bot.command('modelo', ctx => {
  const nome = ctx.message.text.split(' ').slice(1).join(' ').trim()
  if (!nome) return ctx.reply(`Modelo ativo: ${estado.modelo}\nUso: /modelo qwen2.5:3b`)
  estado.modelo = nome
  estado.historicos.clear()
  ctx.reply(`✅ Modelo trocado para ${nome}`)
})

bot.command('nota', ctx => {
  const texto = ctx.message.text.split(' ').slice(1).join(' ').trim()
  if (!texto) {
    return ctx.reply(
      'Uso: /nota <texto>\n\n' +
      'Com destino automático:\n' +
      '/nota #faculdade equação de segundo grau...\n' +
      '/nota #trabalho reunião às 14h\n' +
      '/nota #cursos terminei módulo 3\n' +
      '/nota #vida pagar conta de luz\n' +
      '/nota #projetos ideia de app\n\n' +
      'Sem # vai pro inbox pra organizar depois.'
    )
  }
  const arquivo = salvarNota(texto)
  ctx.reply(`📝 Salvo em ${arquivo}`)
})

bot.on('text', async ctx => {
  try {
    await ctx.sendChatAction('typing')
    const resposta = await conversar(ctx.chat.id, ctx.message.text)
    await ctx.reply(resposta)
  } catch (e) {
    console.error(e)
    ctx.reply(`⚠️ Erro: ${e.message}\nOllama está rodando? (systemctl status ollama)`)
  }
})

bot.launch()
console.log(`🧠 Gateway Telegram no ar | modelo: ${estado.modelo} | padrão: ${MODELO_PADRAO}`)

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
