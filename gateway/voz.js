// voz.js — Ouvidoria e voz do Ultron
// STT: whisper.cpp | TTS: piper (pt_BR faber)  — ambos sobem só quando usados

import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import http from 'node:http'
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

/* ─────────── CONVERSÃO PRA VOZ DO ULTRON (RVC, James Spader) ─────────── */
const RVC_WORKER = 'http://127.0.0.1:3778'

function rvcPronto() {
  return fs.existsSync(path.join(DIR_VOZ, 'rvc/ambiente/bin/python'))
    && fs.existsSync(path.join(DIR_VOZ, 'rvc/Ultron.pth'))
}

// POST com node:http (fetch do Node corta conexões lentas aos 300s)
function postJson(url, obj, esperaMs = 600_000) {
  return new Promise((resolve, reject) => {
    const alvo = new URL(url)
    const corpo = JSON.stringify(obj)
    const req = http.request(alvo, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(corpo) },
      timeout: esperaMs,
    }, res => {
      let dados = ''
      res.on('data', c => { dados += c })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(dados) }) }
        catch { reject(new Error('resposta inválida do worker')) }
      })
    })
    req.on('timeout', () => req.destroy(new Error('tempo esgotado')))
    req.on('error', reject)
    req.end(corpo)
  })
}

function getJson(url, esperaMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: esperaMs }, res => {
      let dados = ''
      res.on('data', c => { dados += c })
      res.on('end', () => {
        try { resolve(JSON.parse(dados)) } catch { reject(new Error('resposta inválida')) }
      })
    })
    req.on('timeout', () => req.destroy(new Error('tempo esgotado')))
    req.on('error', reject)
  })
}

const runBin = promisify(execFile)

// acorda o worker (modelos na RAM custam ~1.4GB, então só ligamos ao usar a voz real)
async function acordarWorker() {
  try {
    if ((await getJson(`${RVC_WORKER}/saude`)).pronto) return true
  } catch {}
  console.log('🎙️ despertando worker RVC...')
  await runBin('systemctl', ['--user', 'start', 'cerebro-rvc']).catch(() => {})
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000))
    try { if ((await getJson(`${RVC_WORKER}/saude`)).pronto) return true } catch {}
  }
  return false
}

export async function converterUltron(entradaWav) {
  const saida = entradaWav.replace(/\.wav$/, '-ultron.wav')
  if (!rvcPronto()) throw new Error('ambiente RVC não instalado')
  return comCadeado(async () => {
    // caminho rápido: worker permanente com modelos já na RAM
    if (await acordarWorker()) {
      try {
        const r = await postJson(`${RVC_WORKER}/converter`, { entrada: entradaWav, saida, chave: -4 })
        if (r.status === 200 && r.json.ok) {
          console.log(`🎙️ voz do Ultron gerada em ${r.json.tempo}s (worker)`)
          return saida
        }
        throw new Error(r.json.erro ?? `worker respondeu ${r.status}`)
      } catch (e) {
        console.log(`⚠️ worker falhou (${e.message}); usando conversor avulso`)
      }
    }
    // reserva: processo avulso que recarrega os modelos (lento)
    const py = path.join(DIR_VOZ, 'rvc/ambiente/bin/python')
    const script = path.join(DIR_VOZ, 'rvc/converter.py')
    await run(py, ['-u', script, entradaWav, saida, '-4'], {
      timeout: 420_000,
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, OMP_NUM_THREADS: '2', MKL_NUM_THREADS: '2' },
    })
    return saida
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

export async function sintetizar(texto, maxCaracteres = 420, estilo = 'cinema') {
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

      let wavFinal = wav
      let filtro = 'anull'
      if (estilo === 'ultron' && rvcPronto()) {
        try {
          wavFinal = await converterUltron(wav)
          filtro = 'aecho=0.6:0.4:40:0.18,lowpass=f=5200'
        } catch (e) {
          console.error('RVC falhou, uso cinema:', e.message.slice(-100))
        }
      }
      if (wavFinal === wav && estilo !== 'normal') {
        filtro = 'asetrate=22050*0.82,aresample=22050,atempo=1.06,aecho=0.7:0.55:55:0.28,lowpass=f=3400'
      }
      await run('ffmpeg', ['-y', '-i', wavFinal, '-af', filtro,
        '-c:a', 'libopus', '-b:a', '48k', '-application', 'voip', '-ar', '48000', ogg], { timeout: 60000 })
      return ogg
    } finally {
      fs.rmSync(wav, { force: true })
      fs.rmSync(wav.replace(/\.wav$/, '-ultron.wav'), { force: true })
    }
  })
}
