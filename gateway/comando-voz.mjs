// Cérebro do wake word: recebe o wav do comando falado, entende, pensa e responde falando.
// Uso: node comando-voz.mjs /caminho/do/comando.wav

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { transcrever, sintetizar, vozDisponivel } from './voz.js'
import { conversar } from './lib.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const wav = process.argv[2]
if (!wav) {
  console.error('uso: node comando-voz.mjs <arquivo.wav>')
  process.exit(1)
}

function tocar(arquivo) {
  return new Promise(resolve => {
    const p = spawn('ffplay', ['-loglevel', 'quiet', '-nodisp', '-autoexit', arquivo])
    p.on('close', resolve)
  })
}

try {
  let texto = await transcrever(wav)
  // tira o nome dele do começo, se veio na transcrição
  texto = texto.replace(/^\s*(oi+|ol[áa]|e a[íi]|hey|al[ôo])?\s*(ultron)?\s*[,.!]?\s*/i, '').trim()
  if (!texto || texto.length < 2) {
    console.log('🤔 não entendi o comando')
    process.exit(0)
  }
  console.log(`🗣️ "${texto}"`)

  const resposta = await conversar('pc-wake', texto)
  console.log(`🤖 ${resposta.slice(0, 120)}`)

  if (vozDisponivel().tts) {
    try {
      const falado = await sintetizar(resposta, 420, 'cinema')
      await tocar(falado)
    } catch (e) {
      console.error('TTS:', e.message)
    }
  }
} catch (e) {
  console.error('💥', e.message)
  process.exit(1)
}
