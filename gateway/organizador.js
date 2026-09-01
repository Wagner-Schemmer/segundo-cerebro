// ORGANIZADOR AUTOMÁTICO — vigia Downloads, Área de Trabalho e Documentos
// e guarda o material dentro do Obsidian (cerebro/anexos), silenciosamente.
// Registro em cerebro/sistema/memoria/arquivos-recebidos.md (consultável no hub)

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CEREBRO = path.resolve(__dirname, '..', 'cerebro')
const VAULT = path.join(CEREBRO, 'anexos')
const LOG = path.join(CEREBRO, 'sistema', 'memoria', 'arquivos-recebidos.md')

// pastas vigiadas
const VIGIADAS = [os.homedir() + '/Downloads', os.homedir() + '/Área de trabalho', os.homedir() + '/Documentos', os.homedir() + '/Organizado']

// nunca mexer nisso
const EXCLUIR_CAMINHOS = [
  CEREBRO, // o vault inteiro é intocável
  path.join(os.homedir(), '.config'),
  path.join(__dirname),
]
const IGNORAR_NOMES = [/^\./, /\.(part|crdownload|tmp|partial|download)$/i, /~$/]

// classificação por extensão → subpasta do vault
const REGRAS = [
  { teste: /\.(pdf|epub|mobi|azw3?|djvu)$/i, destino: 'apostilas-ebooks' },
  { teste: /\.(pptx?|odp|key)$/i, destino: 'slides' },
  { teste: /\.(docx?|odt|rtf|txt|md)$/i, destino: 'textos' },
  { teste: /\.(mp4|mkv|webm|avi|mov|m4a|mp3|wav|flac|ogg)$/i, destino: 'videos-e-audios' },
  { teste: /\.(png|jpe?g|gif|webp|svg|bmp|heic)$/i, destino: 'imagens' },
  { teste: /\.(xlsx?|ods|csv)$/i, destino: 'planilhas' },
  { teste: /\.(zip|rar|7z|tar|tar\.gz|tgz|bz2|xz)$/i, destino: 'compactados' },
]
// instaladores ficam FORA do vault (software não é conhecimento)
const INSTALADORES = /\.(deb|rpm|appimage|exe|msi|dmg|pkg|flatpak|snap)$/i
const PASTA_INSTALADORES = os.homedir() + '/Downloads/instaladores'

const pendentes = new Map() // arquivo -> timer de estabilização

function logArquivo(linha) {
  fs.mkdirSync(path.dirname(LOG), { recursive: true })
  if (!fs.existsSync(LOG)) {
    fs.writeFileSync(LOG, '# 📥 Arquivos recebidos pelo organizador\n\n')
  }
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  fs.appendFileSync(LOG, `- ${agora} — ${linha}\n`)
}

function ignorado(caminho) {
  const nome = path.basename(caminho)
  if (IGNORAR_NOMES.some(r => r.test(nome))) return true
  if (EXCLUIR_CAMINHOS.some(ex => caminho === ex || caminho.startsWith(ex + path.sep))) return true
  return false
}

function destinoPara(caminho) {
  if (INSTALADORES.test(caminho)) return { pasta: PASTA_INSTALADORES, foraDoVault: true }
  // se for PDF/PPT do SIGAA e temos matéria atual (definida pelo script do navegador há <15min), manda para a pasta da matéria
  try {
    const statMateria = fs.statSync('/tmp/ultima-materia-sigaa.txt')
    const recente = Date.now() - statMateria.mtimeMs < 15*60*1000
    const ehDocAcademico = /\.(pdf|pptx?|docx?|odt)$/i.test(caminho)
    if (recente && ehDocAcademico) {
      const materia = fs.readFileSync('/tmp/ultima-materia-sigaa.txt','utf8').trim().replace(/[\\/:*?"<>|]/g,'-')
      const pastaMateria = path.join(CEREBRO, '02-areas', 'faculdade', materia, 'anexos')
      if (materia && fs.existsSync(path.join(CEREBRO, '02-areas','faculdade', materia))) {
        return { pasta: pastaMateria, foraDoVault: false }
      }
    }
  } catch {}
  const regra = REGRAS.find(r => r.teste.test(caminho))
  if (!regra) return null // desconhecido: fica onde está
  return { pasta: path.join(VAULT, regra.destino), foraDoVault: false }
}

function mover(caminho) {
  try {
    const st = fs.statSync(caminho)
    if (!st.isFile()) return
    const alvo = destinoPara(caminho)
    if (!alvo || alvo.pasta.startsWith(path.dirname(caminho) + path.sep)) return

    fs.mkdirSync(alvo.pasta, { recursive: true })
    let final = path.join(alvo.pasta, path.basename(caminho))
    if (fs.existsSync(final)) {
      const ext = path.extname(final)
      final = path.join(alvo.pasta, `${path.basename(final, ext)}-${Date.now()}${ext}`)
    }
    fs.renameSync(caminho, final)
    const relativo = alvo.foraDoVault ? final.replace(os.homedir(), '~') : final.replace(CEREBRO + '/', '')
    console.log(`📥 ${path.basename(caminho)} → ${relativo}`)
    logArquivo(`\`${path.basename(caminho)}\` (${caminho.replace(os.homedir(), '~')}) → \`${relativo}\``)
  } catch (e) {
    console.error(`⚠️ ${path.basename(caminho)}: ${e.message}`)
  }
}

// só move quando o arquivo parou de crescer (download terminou)
function aguardarEstavel(caminho) {
  let ultimoTam = -1
  const tick = () => {
    let tam
    try { tam = fs.statSync(caminho).size } catch { return } // sumiu
    if (tam === ultimoTam) {
      pendentes.delete(caminho)
      mover(caminho)
    } else {
      ultimoTam = tam
      pendentes.set(caminho, setTimeout(tick, 4000))
    }
  }
  pendentes.set(caminho, setTimeout(tick, 4000))
}

for (const pasta of VIGIADAS) {
  if (!fs.existsSync(pasta)) continue
  fs.watch(pasta, { recursive: false }, (_, nome) => {
    if (!nome) return
    const cheio = path.join(pasta, nome)
    if (ignorado(cheio) || pendentes.has(cheio)) return
    aguardarEstavel(cheio)
  })
  console.log(`👀 vigiando ${pasta.replace(os.homedir(), '~')}`)
}

console.log('🧹 Organizador no ar (silencioso)')
