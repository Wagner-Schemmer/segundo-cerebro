// Gateway Telegram do Segundo Cérebro
// Uso: npm start  (requer .env com TELEGRAM_BOT_TOKEN)

import { Telegraf } from 'telegraf'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { exec, execFile } from 'node:child_process'
import { conversar, salvarNota, statusMaquina, estado, MODELO_PADRAO, esquecer, transcreverAudio, sintetizarVoz } from './lib.js'
import { addTarefa, listarTarefas, fazerTarefa, proximasVencer, marcarLembrado, separarPrazo } from './tarefas.js'
import * as bravo from './brave.js'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const executar = promisify(exec)
const ARQ_DONO = path.join(__dirname, '.dono-telegram')
const CEREBRO_VAULT = path.resolve(__dirname, '..', 'cerebro')

// extrai pedido de criação de pasta/página de frases naturais
// retorna { tipo: 'pasta'|'nota', partes: ['Cursos','cybersecurity'] } ou null
function extrairCriacao(texto) {
  const t = texto.toLowerCase()
  if (!/\bcria(r|ndo|ções|ção)?\b|\bcrie(m)?\b|\bnomea(r|ndo)\b/.test(t)) return null
  const mtipo = t.match(/\b(pasta|nota|p[áa]gina)\b/)
  if (!mtipo) return null
  const tipo = mtipo[1] === 'pasta' ? 'pasta' : 'nota'

  // forma direta: "criar pasta Cursos/cybersecurity"
  const direto = texto.match(/^\s*\/?(?:cria|criar|nova?|novo)\s+(?:pasta|nota|p[áa]gina)\s+(.+)$/i)
  if (direto) {
    const partes = direto[1].trim().replace(/^["']|["']$/g, '').split('/')
      .map(p => p.trim().replace(/[^\p{L}\p{N} _.()-]/gu, '')).filter(Boolean)
    return partes.length ? { tipo, partes } : null
  }

  // frase natural: exige nome explícito ("como X", "chamada X", "nomeada X" ou "entre aspas")
  let nome = null
  const mn = texto.match(/(?:chamad[ao]|nomead[ao]|com (?:o )?nome(?: de)?|como)\s+["“']?([\p{L}\p{N}][\p{L}\p{N} _/.-]*?)["”']?\s*[?.!；]?$/iu)
  if (mn) nome = mn[1].trim().replace(/\s+no obsidia+n\w*$/i, '').trim()
  else {
    const mq = texto.match(/["“']([^"”']{1,60})["”']/u)
    if (mq) nome = mq[1].trim()
  }
  if (!nome || /^(ela|ele|essa|esse|esta|este|aquela|aquele|a pasta|o arquivo)$/i.test(nome)) return null

  // pai opcional: "dentro de Cursos", "em Cursos", "na pasta Cursos"
  let pai = null
  const mp = texto.match(/dentro d[eao]\s+(?:pasta\s+)?["']?([\p{L}\p{N}][\p{L}\p{N} _-]*?)["']?\s*(?:,|\s+e\b|\s+que\b|$)/iu)
    || texto.match(/\bem\b\s+(?:pasta\s+)?["']?([\p{L}\p{N}][\p{L}\p{N} _-]*?)["']?\s*(?:,|\s+e\b|\s+que\b|$)/iu)
  if (mp) pai = mp[1].trim()
  if (pai && pai.toLowerCase() === nome.toLowerCase()) pai = null

  const limpa = s => s.split('/').map(x => x.trim().replace(/[^\p{L}\p{N} _.()-]/gu, '')).filter(Boolean)
  const partes = [...(pai ? limpa(pai) : []), ...limpa(nome)]
  return partes.length ? { tipo, partes } : null
}
const ARQ_MODO = path.join(__dirname, '.modo-tecnico')

// Modo técnico: texto comum vira comando de shell (tipo opencode no celular)
let modoTecnico = fs.existsSync(ARQ_MODO)

function definirModo(ligado) {
  modoTecnico = ligado
  try {
    if (ligado) fs.writeFileSync(ARQ_MODO, '1')
    else fs.rmSync(ARQ_MODO, { force: true })
  } catch {}
}

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
  `/modo — alterna modo técnico (agora: ${modoTecnico ? 'LIGADO ⚡' : 'desligado 💬'})\n` +
  '/nota <texto> — salva no Obsidian (#faculdade #trabalho #cursos #vida #projetos)\n' +
  '/tarefa <texto> [prazo] — adiciona tarefa (ex: /tarefa pagar conta amanhã 14h)\n' +
  '/tarefas — lista pendentes · /feito <n> — conclui\n' +
  '🖥️ Navegador: /abrir · /abas · /aba <n> · /fechar <n>\n' +
  '📖 Página ativa: /ler (resumo) · /perguntar <dúvida> · /salvar (pro Obsidian)\n' +
  '/run <comando> — executa no notebook (só o dono)\n' +
  '/modelo <nome> — troca o modelo Ollama\n' +
  '/status — RAM e modelos'
))

// Modo técnico: quando ligado, texto comum = comando de shell
bot.command('modo', ctx => {
  if (!ehDono(ctx)) return ctx.reply('🔒 Só o dono pode alternar o modo.')
  definirModo(!modoTecnico)
  ctx.reply(
    modoTecnico
      ? '⚡ MODO TÉCNICO LIGADO\nAgora todo texto que você mandar vira um comando executado no notebook (como opencode no celular).\nUse /modo pra voltar ao papo normal.'
      : '💬 Modo técnico desligado — voltei a conversar normalmente e te avisar das coisas (auto-chat).'
  )
})

async function rodarComando(cmd) {
  try {
    const { stdout, stderr } = await executar(cmd, { timeout: 120_000, maxBuffer: 1024 * 1024 })
    let saida = (stdout + (stderr ? `\n${stderr}` : '')).trim() || '(sem saída)'
    return saida.length > 3500 ? `${saida.slice(0, 3500)}\n…(cortado)` : saida
  } catch (e) {
    let saida = ((e.stdout ?? '') + (e.stderr ?? '')).trim() || e.message
    return `❌ ${saida.length > 3500 ? `${saida.slice(0, 3500)}\n…(cortado)` : saida}`
  }
}

bot.command('run', async ctx => {
  if (!ehDono(ctx)) return ctx.reply('🔒 Só o dono pode usar /run.')
  const cmd = ctx.message.text.split(' ').slice(1).join(' ').trim()
  if (!cmd) return ctx.reply('Uso: /run <comando>\nEx: /run npm run sigaa')
  await ctx.sendChatAction('typing')
  await ctx.reply(`$ ${cmd}\n\n${await rodarComando(cmd)}`)
})

bot.command('status', async ctx => ctx.reply(await statusMaquina()))

bot.command('limpar', ctx => {
  esquecer(ctx.chat.id)
  ctx.reply('🧹 Memória desta conversa zerada! Vou te tratar como se fosse a primeira vez (seus fatos e notas continuam guardados).')
})

// descarrega o modelo da RAM (~1GB livres); recarrega sozinho na próxima mensagem
bot.command('frio', async ctx => {
  await ctx.sendChatAction('typing')
  try {
    await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
      method: 'POST',
      body: JSON.stringify({ model: estado.modelo, keep_alive: 0 }),
      signal: AbortSignal.timeout(15000),
    })
    ctx.reply('🧊 Modelo descarregado — ~1GB de RAM devolvida ao sistema.\nNa próxima mensagem eu esquento de novo sozinho.')
  } catch { ctx.reply('⚠️ Não consegui falar com o Ollama.') }
})

// modo leve total: mata opencode, descarrega modelo, limpa cache
bot.command('leve', async ctx => {
  if (!ehDono(ctx)) return ctx.reply('🔒 Só o dono.')
  await ctx.sendChatAction('typing')
  try {
    const { stdout } = await execFile('/home/wagner/modo-leve.sh', { timeout: 30_000 })
    await ctx.reply(`⚡ Modo leve ativado:\n${stdout}`)
  } catch (e) {
    await ctx.reply(`⚠️ ${e.message}`)
  }
})

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

/* ───────── TAREFAS ───────── */
const fmtPrazo = ms => new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

bot.command('tarefa', ctx => {
  const bruto = ctx.message.text.split(' ').slice(1).join(' ').trim()
  if (!bruto) return ctx.reply('Uso: /tarefa <o que fazer> [prazo]\nEx: /tarefa pagar conta amanhã 14h\nEx: /tarefa entregar trabalho 30/8')
  const { texto, prazo } = separarPrazo(bruto)
  const t = addTarefa(texto, prazo)
  ctx.reply(`✅ Tarefa #${t.id}: ${t.texto}${t.prazo ? `\n📅 prazo: ${fmtPrazo(t.prazo)}` : '\n(sem prazo — me lembro mesmo assim quando quiser)'}`)
})

bot.command('tarefas', ctx => {
  const pendentes = listarTarefas()
  if (!pendentes.length) return ctx.reply('🎉 Nenhuma tarefa pendente!')
  ctx.reply(
    '📋 Pendentes:\n' +
    pendentes.map(t => `#${t.id} — ${t.texto}${t.prazo ? ` (📅 ${fmtPrazo(t.prazo)})` : ''}`).join('\n') +
    '\n\nMarcar como feita: /feito <número>'
  )
})

bot.command('feito', ctx => {
  const n = parseInt(ctx.message.text.split(' ')[1], 10)
  if (!n) return ctx.reply('Uso: /feito <número da tarefa>')
  const t = fazerTarefa(n)
  if (!t) return ctx.reply(`🤔 Não achei a tarefa #${n} aberta. Veja a lista: /tarefas`)
  ctx.reply(`🎉 Boa! "${t.texto}" concluída.`)
})

/* ───────── BRAVE (o navegador do Wagner, com canal de controle) ───────── */
let abaSel = 0 // índice da aba que o Ultron "olha"

function acordarBrave() {
  // usa o perfil padrão dele; a porta de controle vem do brave-flags.conf
  spawn('/usr/bin/flatpak', ['run', 'com.brave.Browser'],
    { detached: true, stdio: 'ignore' }).unref()
}

async function esperarBrave(segundos = 25) {
  for (let i = 0; i < segundos * 2; i++) {
    if (await bravo.bravoVivo()) return true
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

bot.command('estudos', async ctx => {
  if (await bravo.bravoVivo()) return ctx.reply('🖥️ Seu Brave já tá conectado comigo!')
  await ctx.sendChatAction('typing')
  acordarBrave()
  ctx.reply(await esperarBrave()
    ? '🖥️ Brave aberto e conectado! Abra o que quiser e me chame com /ler ou /perguntar.'
    : '⚠️ Não consegui conectar no Brave. Fecha ele por completo (menu → Sair) e abre de novo.')
})

bot.command('abas', async ctx => {
  try {
    const abas = await bravo.listarAbas()
    if (!abas.length) return ctx.reply('Nenhuma aba aberta.')
    abaSel = Math.min(abaSel, abas.length - 1)
    ctx.reply(
      '🗂️ Abas:\n' +
      abas.map((a, i) => `${i === abaSel ? '👉' : ' '} ${i + 1}. ${a.title.slice(0, 60)}`).join('\n') +
      '\n\nSelecionar: /aba <n> · Fechar: /fechar <n>'
    )
  } catch (e) { ctx.reply(`⚠️ ${e.message}`) }
})

bot.command('aba', async ctx => {
  const n = parseInt(ctx.message.text.split(' ')[1], 10)
  try {
    const abas = await bravo.listarAbas()
    if (!n || n > abas.length) return ctx.reply(`Uso: /aba <1-${abas.length}>`)
    abaSel = n - 1
    await bravo.focar(abas[abaSel].id)
    ctx.reply(`👉 Olhando: ${abas[abaSel].title.slice(0, 70)}`)
  } catch (e) { ctx.reply(`⚠️ ${e.message}`) }
})

bot.command('fechar', async ctx => {
  const n = parseInt(ctx.message.text.split(' ')[1], 10)
  try {
    const abas = await bravo.listarAbas()
    if (!n || n > abas.length) return ctx.reply(`Uso: /fechar <1-${abas.length}>`)
    await bravo.fechar(abas[n - 1].id)
    ctx.reply(`🗑️ Fechei a aba ${n}`)
  } catch (e) { ctx.reply(`⚠️ ${e.message}`) }
})

bot.command('abrir', async ctx => {
  const alvo = ctx.message.text.split(' ').slice(1).join(' ').trim()
  if (!alvo) return ctx.reply('Uso: /abrir <site> — ex: /abrir coursera.org\nOu pesquisa: /abrir como fazer pão')
  try {
    await ctx.sendChatAction('typing')
    const ehUrl = /^[\w-]+(\.[\w-]+)+/.test(alvo) && !alvo.includes(' ')
    const aba = ehUrl ? await bravo.abrir(alvo) : await bravo.pesquisar(alvo)
    abaSel = (await bravo.listarAbas()).findIndex(a => a.id === aba.id)
    ctx.reply(ehUrl ? `🌐 ${alvo} aberto` : `🔎 Pesquisei "${alvo}" no navegador`)
  } catch (e) {
    if (/não está aberto/.test(e.message)) {
      acordarBrave()
      if (await esperarBrave()) return ctx.reply('🖥️ Abri seu Brave — manda de novo o que quer abrir!')
    }
    ctx.reply(`⚠️ ${e.message}`)
  }
})

// lê a página selecionada
async function paginaAtual() {
  const pagina = await bravo.lerPagina(abaSel)
  if (!pagina.texto.trim()) throw new Error('página sem texto legível (vídeo ou imagem?)')
  return pagina
}

// recorta a página ativa pro Obsidian
bot.command('salvar', async ctx => {
  try {
    await ctx.sendChatAction('typing')
    const pag = await paginaAtual()
    const pasta = path.join(os.homedir(), 'Documentos', 'segundo-cerebro', 'cerebro', '03-recursos', 'da-web')
    fs.mkdirSync(pasta, { recursive: true })
    const slug = pag.titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'pagina'
    const arquivo = path.join(pasta, `${slug}.md`)
    const conteudo = [
      `# ${pag.titulo}`, '',
      `> 🔗 ${pag.url}`,
      `> 📅 salvo em ${new Date().toLocaleDateString('pt-BR')} pelo Ultron`, '',
      pag.texto.slice(0, 25000), '',
    ].join('\n')
    let final = arquivo
    if (fs.existsSync(final)) final = arquivo.replace(/\.md$/, `-${Date.now()}.md`)
    fs.writeFileSync(final, conteudo)
    ctx.reply(`💾 Guarduei no cérebro:\n📄 .../03-recursos/da-web/${path.basename(final)}`)
  } catch (e) { ctx.reply(`⚠️ ${e.message}`).catch(() => {}) }
})

bot.command('ler', async ctx => {
  try {
    await ctx.sendChatAction('typing')
    const pag = await paginaAtual()
    const resposta = await conversar('brave-ler', `Resuma em até 6 frases o conteúdo desta página da web, em português:\n\nTÍTULO: ${pag.titulo}\n\n${pag.texto.slice(0, 4000)}`)
    await ctx.reply(`📖 ${pag.titulo.slice(0, 80)}\n\n${resposta}`)
} catch (e) { ctx.reply(`⚠️ ${e.message}`).catch(() => {}) }
})

/* ───────── NOVOS COMANDOS ÚTEIS ───────── */

// SIGAA manual check
bot.command('sigaa', async ctx => {
  await ctx.sendChatAction('typing')
  ctx.reply('🔍 Verificando SIGAA...')
  try {
    const { checarSIGAA } = await import('./sigaa-check.js')
    const { novas } = await checarSIGAA()
    if (novas.length === 0) return ctx.reply('✅ SIGAA verificado — nenhuma novidade.')
    ctx.reply(`📬 ${novas.length} item(ns) novo(s):\n` + novas.map(n => `• ${n.titulo} (${n.prazo})`).join('\n'))
  } catch (e) { ctx.reply(`⚠️ ${e.message}`) }
})

// Voz: sintetiza e manda áudio
bot.command('voz', async ctx => {
  const texto = ctx.message.text.split(' ').slice(1).join(' ').trim()
  if (!texto) return ctx.reply('Uso: /voz <texto para falar>\nEx: /voz Olá Wagner, tudo bem?')
  try {
    await ctx.sendChatAction('record_voice')
    const { sintetizarVoz } = await import('./lib.js')
    const arquivo = await sintetizarVoz(texto, 'pt-br')
    await ctx.replyWithVoice({ source: arquivo })
  } catch (e) { ctx.reply(`⚠️ ${e.message}`) }
})

// Ajuda completa
bot.command('ajuda', ctx => ctx.reply(
  '🤖 <b>Ultron — Comandos Completos</b>\n\n' +
  '<b>💬 Conversa & Memória</b>\n' +
  '• Qualquer texto → conversa normal\n' +
  '• <code>/limpar</code> — zera memória desta conversa\n' +
  '• <code>/modo</code> — alterna modo técnico (comandos shell)\n\n' +
  '<b>📝 Notas & Tarefas</b>\n' +
  '• <code>/nota #area texto</code> — salva no Obsidian\n' +
  '• <code>/tarefa texto [prazo]</code> — adiciona tarefa\n' +
  '• <code>/tarefas</code> — lista pendentes\n' +
  '• <code>/feito <n></code> — marca como feita\n\n' +
  '<b>🧠 SIGAA (Faculdade)</b>\n' +
  '• <code>/sigaa</code> — verifica novidades agora\n' +
  '• Avisos automáticos chegam aqui sozinhos (7h)\n\n' +
  '<b>🖥️ Navegador (Brave)</b>\n' +
  '• <code>/estudos</code> — abre/conecta Brave\n' +
  '• <code>/abas</code> — lista abas\n' +
  '• <code>/aba <n></code> — seleciona aba\n' +
  '• <code>/abrir site</code> — abre site ou pesquisa\n' +
  '• <code>/fechar <n></code> — fecha aba\n' +
  '• <code>/ler</code> — resume página ativa\n' +
  '• <code>/perguntar <dúvida></code> — pergunta sobre a página\n' +
  '• <code>/salvar</code> — guarda página no Obsidian\n\n' +
  '<b>🎙️ Voz</b>\n' +
  '• <code>/voz texto</code> — Ultron fala (envia áudio)\n' +
  '• Mande áudio → eu transcrevo e respondo\n\n' +
  '<b>⚙️ Sistema</b>\n' +
  '• <code>/status</code> — RAM, modelo, fila\n' +
  '• <code>/modelo <nome></code> — troca modelo Ollama\n' +
  '• <code>/frio</code> — descarrega modelo (libera 1GB RAM)\n' +
  '• <code>/leve</code> — modo leve (mata opencode + frio)\n' +
  '• <code>/run <cmd></code> — executa comando (só dono)\n' +
  '• <code>/limpar</code> — zera memória do chat\n' +
  '• <code>/ajuda</code> — esta mensagem\n\n' +
  '<b>💡 Dicas</b>\n' +
  '• Use <code>#faculdade #trabalho #cursos #vida #projetos</code> nas notas\n' +
  '• Prazos: "amanhã 14h", "hoje 19h", "30/8", "sem prazo"\n' +
  '• Criação natural: "criar pasta Cursos/cybersecurity"\n' +
  '• Mande áudio que eu transcrevo e respondo', { parse_mode: 'HTML' })
)

bot.command('perguntar', async ctx => {
  const q = ctx.message.text.split(' ').slice(1).join(' ').trim()
  if (!q) return ctx.reply('Uso: /perguntar <dúvida sobre a página>\nEx: /perguntar explica o que é recursão')
  try {
    await ctx.sendChatAction('typing')
    const pag = await paginaAtual()
    const resposta = await conversar('brave-perguntar', `Baseado nesta página da web, responda em português. Se não estiver na página, diga o que sabe.\n\nPÁGINA: ${pag.titulo}\n\n${pag.texto.slice(0, 4000)}\n\nPERGUNTA: ${q}`)
    await ctx.reply(`❓ ${q}\n\n${resposta}`)
  } catch (e) { ctx.reply(`⚠️ ${e.message}`) }
})

bot.on('text', async ctx => {
  try {
    // Modo técnico: texto comum vira comando (só o dono)
    if (modoTecnico) {
      if (!ehDono(ctx)) return ctx.reply('💬 (modo técnico é só pro dono; desligue com /modo)')
      await ctx.sendChatAction('typing')
      return ctx.reply(`$ ${ctx.message.text}\n\n${await rodarComando(ctx.message.text)}`)
    }

    // criação direta no cérebro — instantâneo, sem IA no meio
    // entende tanto comando direto ("criar pasta X") quanto frase natural
    // ("quero uma pasta dentro de Cursos e nomear como cybersecurity")
    const criacao = extrairCriacao(ctx.message.text)
    if (criacao) {
      const { tipo, partes } = criacao
      const cheio = path.join(CEREBRO_VAULT, ...partes)
      try {
        if (tipo === 'pasta') {
          fs.mkdirSync(cheio, { recursive: true })
          return ctx.reply(`📁 Pasta pronta no Obsidian: ${partes.join('/')}`)
        }
        fs.mkdirSync(path.dirname(cheio), { recursive: true })
        const arq = cheio.endsWith('.md') ? cheio : `${cheio}.md`
        if (fs.existsSync(arq)) return ctx.reply('📄 Já existe uma página com esse nome!')
        fs.writeFileSync(arq, `# ${partes.at(-1)}\n\n`)
        return ctx.reply(`📄 Página criada no Obsidian: ${partes.join('/')}.md`)
      } catch (e) { return ctx.reply(`⚠️ ${e.message}`) }
    }
    await ctx.sendChatAction('typing')
    const resposta = await conversar(ctx.chat.id, ctx.message.text)
    await ctx.reply(resposta)
  } catch (e) {
    console.error(e)
    ctx.reply(`⚠️ Erro: ${e.message}\nOllama está rodando? (systemctl status ollama)`)
  }
})

/* ───────── VOICE MESSAGE HANDLER (áudio do usuário) ───────── */
bot.on('voice', async ctx => {
  try {
    await ctx.sendChatAction('typing')
    const { transcreverAudio } = await import('./lib.js')
    const fileId = ctx.message.voice.file_id
    const link = await ctx.telegram.getFileLink(fileId)
    const texto = await transcreverAudio(link.href)
    if (!texto.trim()) return ctx.reply('🤔 Não entendi o áudio. Tenta falar mais perto do microfone.')
    const resposta = await conversar(ctx.chat.id, texto)
    await ctx.reply(`🎙️ Você disse: "${texto}"\n\n${resposta}`)
  } catch (e) { ctx.reply(`⚠️ Erro no áudio: ${e.message}`) }
})

/* ───────── FILA DE AVISOS (mesma pasta do WhatsApp, destino 'telegram') ───────── */
const FILA_ENVIO = path.join(__dirname, 'fila-envio')
let filaTgRodando = false

async function processarFilaTelegram() {
  if (!modoDonoRegistrado() || filaTgRodando) return
  filaTgRodando = true
  let pendentes
  try { pendentes = fs.readdirSync(FILA_ENVIO).filter(f => f.startsWith('sigaa-telegram-') && f.endsWith('.json')) } catch { filaTgRodando = false; return }
  const chatId = fs.readFileSync(ARQ_DONO, 'utf8').trim()
  for (const arquivo of pendentes) {
    const caminho = path.join(FILA_ENVIO, arquivo)
    try {
      const pedido = JSON.parse(fs.readFileSync(caminho, 'utf8'))
      await bot.telegram.sendMessage(chatId, pedido.texto)
      console.log(`📤 [tg] aviso entregue: ${String(pedido.texto).slice(0, 60)}`)
      fs.rmSync(caminho, { force: true })
    } catch (e) {
      console.error(`⚠️ [tg] falha na fila (${arquivo}): ${e.message}`)
      try { fs.renameSync(caminho, caminho.replace(/\.json$/, '.falha')) } catch {}
    }
  }
  filaTgRodando = false
}

function modoDonoRegistrado() {
  try { return !!fs.readFileSync(ARQ_DONO, 'utf8').trim() } catch { return false }
}

setInterval(processarFilaTelegram, 5_000)

// Lembretes de tarefas: checa a cada minuto, avisa uma vez só
setInterval(async () => {
  for (const t of proximasVencer()) {
    marcarLembrado(t.id)
    if (modoDonoRegistrado()) {
      const chatId = fs.readFileSync(ARQ_DONO, 'utf8').trim()
      bot.telegram.sendMessage(chatId, `⏰ Lembrete: ${t.texto}${t.prazo ? ` (era pra ${fmtPrazo(t.prazo)})` : ''}`).catch(() => {})
      console.log(`⏰ lembrete enviado: #${t.id} ${t.texto}`)
    }
  }
}, 60_000)

bot.catch(e => console.error('⚠️ erro no bot:', e?.message ?? e))

// vigia: conta falhas seguidas do polling; se acumular, o systemd levanta de novo
// (SEM chamar getUpdates por fora — isso conflitava com o próprio Telegraf!)
let errosPolling = 0
bot.on('polling_error', e => {
  errosPolling++
  console.error(`⚠️ polling erro #${errosPolling}: ${String(e.message).slice(0, 90)}`)
  if (errosPolling >= 10) {
    console.log('🔄 polling morto — reiniciando o gateway...')
    process.exit(1)
  }
})
bot.on('message', () => { errosPolling = 0 })

bot.launch()
console.log(`🧠 Gateway Telegram no ar | modelo: ${estado.modelo} | padrão: ${MODELO_PADRAO} | técnico: ${modoTecnico ? 'ON' : 'off'}`)

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
