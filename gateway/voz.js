// voz.js — Ouvidoria e voz do Ultron
// STT: whisper.cpp | TTS: piper (pt_BR faber)  — ambos sobem só quando usados

import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIR_VOZ = path.join(__dirname, 'voz')
const TMP = '/tmp/opencode'

const run = promisify(execFile)

// localiza binários (estruturas variam entre releases)
function primeiroExistente(candidatos) {
  for (const c of candidatos) if (fs.existsSync(c)) return c
  return null
}

export function vozDisponivel() {
  const whisperBin = primeiroExistente([
    path.join(DIR_VOZ, 'whisper/whisper-bin-ubuntu-x64/whisper-cli'),
    path.join(DIR_VOZ, 'whisper/bin/whisper-cli'),
    path.join(DIR_VOZ, 'whisper-bin-x64/whisper-cli'),
    path.join(DIR_VOZ, 'build/bin/whisper-cli'),
  ])
  const piperBin = primeiroExistente([
    path.join(DIR_VOZ, 'piper/piper'),
    path.join(DIR_VOZ, 'piper'),
  ])
  return {
    stt: !!(whisperBin && fs.existsSync(path.join(DIR_VOZ, 'whisper-base.bin'))),
    tts: !!(piperBin && fs.existsSync(path.join(DIR_VOZ, 'faber.onnx'))),
  }
}

/* Cadeado: só UM processo pesado de voz por vez (RAM é sagrada aqui) */
let cadeado = Promise.resolve()
function comCadeado(tarefa) {
  const resultado = cadeado.then(tarefa, tarefa)
  cadeado = resultado.catch(() => {})
  return resultado
}

/* ─────────── ÁUDIO → TEXTO ─────────── */
export async function transcrever(arquivoAudio) {
  const d = vozDisponivel()
  if (!d.stt) throw new Error('whisper não instalado ainda')
  return comCadeado(async () => {
    const wav = path.join(TMP, `ultron-in-${Date.now()}.wav`)
    try {
      fs.mkdirSync(TMP, { recursive: true })
      await run('ffmpeg', ['-y', '-i', arquivoAudio, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], { timeout: 60000 })
      const bin = primeiroExistente([
        path.join(DIR_VOZ, 'whisper/whisper-bin-ubuntu-x64/whisper-cli'),
        path.join(DIR_VOZ, 'whisper/bin/whisper-cli'),
        path.join(DIR_VOZ, 'whisper-bin-x64/whisper-cli'),
      ])
      const { stdout } = await run(bin,
        ['-m', path.join(DIR_VOZ, 'whisper-base.bin'), '-l', 'pt', '-nt', '-f', wav],
        { timeout: 240000, maxBuffer: 10 * 1024 * 1024 })
      return stdout.replace(/\s+/g, ' ').trim()
    } finally {
      fs.rmSync(wav, { force: true })
    }
  })
}

/* ─────────── TEXTO → ÁUDIO (.ogg/opus pronto pro WhatsApp) ─────────── */
function piperFalar(texto, saidaWav) {
  return new Promise((resolve, reject) => {
    const bin = primeiroExistente([path.join(DIR_VOZ, 'piper/piper'), path.join(DIR_VOZ, 'piper')])
    const p = spawn(bin, [
      '--model', path.join(DIR_VOZ, 'faber.onnx'),
      '--output_file', saidaWav,
    ])
    let erro = ''
    p.stderr.on('data', d => { erro += d })
    p.on('error', reject)
    p.on('close', codigo => codigo === 0 ? resolve() : reject(new Error(`piper: ${erro.slice(-300)}`)))
    p.stdin.write(texto)
    p.stdin.end()
  })
}

export async function sintetizar(texto, maxCaracteres = 420) {
  const d = vozDisponivel()
  if (!d.tts) throw new Error('piper não instalado ainda')
  return comCadeado(async () => {
    fs.mkdirSync(TMP, { recursive: true })
    const id = Date.now()
    const wav = path.join(TMP, `ultron-out-${id}.wav`)
    const ogg = path.join(TMP, `ultron-out-${id}.ogg`)
    try {
      // limpa marcações que ficam feias na fala
      let fala = texto
        .replace(/\*/g, '').replace(/[_`#]/g, '')
        .replace(/https?:\/\/\S+/g, ' link na descrição ')
        .replace(/\s+/g, ' ').trim()
      if (fala.length > maxCaracteres) {
        fala = fala.slice(0, maxCaracteres).replace(/\s+\S*$/, '') + '… A resposta completa está no texto.'
      }
      await piperFalar(fala, wav)
      await run('ffmpeg', ['-y', '-i', wav, '-c:a', 'libopus', '-b:a', '48k', '-application', 'voip', '-ar', '48000', ogg], { timeout: 60000 })
      return ogg
    } finally {
      fs.rmSync(wav, { force: true })
    }
  })
}
