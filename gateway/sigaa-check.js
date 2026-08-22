// Verificação do SIGAA: roda, organiza por matéria no cérebro e avisa pelo Ultron
// Uso manual:  npm run sigaa
// Automático:  timer cerebro-sigaa (todo dia às 7h)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checarSIGAA, DIR_FACULDADE } from './sigaa.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILA_ENVIO = path.join(__dirname, 'fila-envio')

function notificar(texto) {
  fs.mkdirSync(FILA_ENVIO, { recursive: true })
  fs.writeFileSync(path.join(FILA_ENVIO, `sigaa-${Date.now()}.json`),
    JSON.stringify({ para: 'eu', texto }))
}

async function main() {
  const { SIGAA_USER, SIGAA_PASS } = process.env
  if (!SIGAA_USER || !SIGAA_PASS) {
    console.error('❌ Preencha SIGAA_USER e SIGAA_PASS no gateway/.env')
    process.exit(1)
  }

  console.log('🎓 Conectando no SIGAA...')
  const { atividades, materias, novas } = await checarSIGAA()
  console.log(`✅ ${atividades.length} atividade(s) em ${materias.length} matéria(s) | 🆕 ${novas.length} nova(s)`)

  // ordena por prazo
  atividades.sort((a, b) => (a.prazo.split('/').reverse().join('') > b.prazo.split('/').reverse().join('') ? 1 : -1))

  let msg = `🎓 *ULTRON ACADÊMICO*\n`
  if (novas.length) msg += `🆕 ${novas.length} novidade(s)!\n`
  msg += `📚 ${materias.length} matérias com atividades:\n\n`
  for (const a of atividades.slice(0, 12)) {
    const icone = a.tipo === 'tarefa' ? '📝' : '🧪'
    const marca = novas.includes(a) ? '🆕 ' : ''
    msg += `${marca}${icone} *${a.prazo}* — ${a.titulo}\n   _${a.turma}_\n`
  }
  if (atividades.length > 12) msg += `\n…e mais ${atividades.length - 12} (veja tudo no Obsidian)`
  msg += `\n📁 Organizado em: 02-areas/faculdade/`

  notificar(msg)
  console.log(`📤 Resumo na fila pro WhatsApp | pastas atualizadas em ${DIR_FACULDADE}`)
}

main().catch(e => {
  console.error('💥', e.message)
  notificar(`⚠️ Robô do SIGAA com problema: ${e.message}`)
  process.exit(1)
})
