// Gateway Telegram do Segundo Cérebro
// Uso: npm start  (requer .env com TELEGRAM_BOT_TOKEN)

import { Telegraf } from 'telegraf'
import { conversar, salvarNota, statusMaquina, estado, MODELO_PADRAO } from './lib.js'

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, { handlerTimeout: 300_000 })

bot.command('start', ctx => ctx.reply(
  '🧠 Segundo Cérebro online!\n\n' +
  'Me mande qualquer texto que eu respondo.\n' +
  '/nota <texto> — salva no inbox do Obsidian\n' +
  '/modelo <nome> — troca o modelo Ollama\n' +
  '/status — RAM e modelos'
))

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
