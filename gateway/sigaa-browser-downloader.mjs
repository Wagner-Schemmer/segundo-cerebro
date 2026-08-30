// ============================================================
// SIGAA BROWSER DOWNLOADER - Usa o Brave controlado via CDP
// Baixa TODOS os materiais de TODAS as turmas e organiza no Cerebro
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { req, seguir, login, BASE } from './sigaa.js';
import * as bravo from './brave.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_BASE = path.join(__dirname, '..', 'cerebro', '02-areas', 'faculdade');
const FILA_BASE = path.join(__dirname, 'fila-envio');

// Carrega .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}

// Mapeamento SIGAA ID -> pasta no vault
const MATERIA_MAP = {
  '70F07D213BE85A763C0039D9186169E8108E3CEB': { nome: 'BANCO DE DADOS I', pasta: 'BANCO DE DADOS I' },
  '5D631E39ABC1CC8B0D201EB673CD20373F74DA60': { nome: 'CALCULO DIFERENCIAL E INTEGRAL I', pasta: 'CALCULO DIFERENCIAL E INTEGRAL I' },
  'A4B289E26D6F47AB1AB1DE77B4A511302F9B3304': { nome: 'INGLESTECNICO', pasta: 'INGLESTECNICO' },
  'ABF4DC1E15E009946FFC6A46E8B849EF3CC344AB': { nome: 'METODOLOGIA EXTENSIONISTA', pasta: 'METODOLOGIA EXTENSIONISTA' },
  'F53C4C961A954D46083449332C20557149239023': { nome: 'TOPICOS DE ALGEBRA LINEAR E GEOMETRIA ANALITICA', pasta: 'TOPICOS DE ALGEBRA LINEAR E GEOMETRIA ANALITICA' },
  '31C9E187E6321422A836879896FC877F78F345BE': { nome: 'ALGORITMOS E PROGRAMACAO', pasta: 'ALGORITMOS E PROGRAMACAO' },
  '7B37B3A98C90DD5569D11E5838111DD8845421FB': { nome: 'FUNDAMENTOS DA COMPUTACAO', pasta: 'FUNDAMENTOS DA COMPUTACAO' },
  '71EAC92384A6F2C22270692DB43C402D6B6D94AE': { nome: 'LEITURA E PRODUCAO TEXTUAL', pasta: 'LEITURA E PRODUCAO TEXTUAL' },
  'F43C160AC2CB8FD68EF14F68078F4F74B5B88753': { nome: 'LOGICA MATEMATICA', pasta: 'LOGICA MATEMATICA' },
  '8D4D39729A2B7AF5F039AD16E1E80F7DAEC33B95': { nome: 'MATEMATICA DISCRETA', pasta: 'MATEMATICA DISCRETA' },
];

// ---------- LOGIN SIGAA ----------
async function doLogin() {
  const user = process.env.SIGAA_USER;
  const pass = process.env.SIGAA_PASS;
  if (!user || !pass) throw new Error('SIGAA_USER/SIGAA_PASS nao estao no .env');
  console.log('Logando no SIGAA...');
  await login(user, pass);
  console.log('Logado!');
}

// ---------- ABRE BRAVE E CONECTA ----------
async function acordarBrave() {
  console.log('Iniciando Brave...');
  bravo.acordarBrave();
  await bravo.esperarBrave(30);
  console.log('Brave conectado!');
}

// ---------- LISTA TURMAS DA PAGINA turmas.jsf ----------
async function listarTurmas() {
  console.log('Buscando lista de turmas...');
  const res = await seguir(`${BASE}/portais/discente/turmas.jsf`);
  const html = await res.text();

  const turmas = [];
  const linhas = html.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] || '';
  const regexLinha = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const m of linhas.matchAll(regexLinha)) {
    const l = m[1];
    const idMatch = l.match(/frontEndIdTurma['"]:\s*'([A-F0-9]+)'/i);
    if (!idMatch) continue;
    const id = idMatch[1];

    const nomeMatch = l.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    let nome = `Turma-${id.slice(0,8)}`;
    if (nomeMatch) {
      const limpo = nomeMatch[1].replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
      if (limpo.length > 5) nome = limpo.slice(0, 100);
    }
    turmas.push({ id, nome });
  }

  const unicas = [];
  const vistos = new Set();
  for (const t of turmas) {
    if (!vistos.has(t.id)) { vistos.add(t.id); unicas.push(t); }
  }

  console.log(`Encontradas ${unicas.length} turmas:`);
  unicas.forEach((t, idx) => console.log(`  ${idx+1}. ${t.nome} (${t.id.slice(0,12)}...)`));
  return unicas;
}

// ---------- ACESSA TURMA VIRTUAL (JSF POST EXATO) ----------
async function acessarTurmaVirtual(turmaId, rowIndex = 0) {
  console.log(`  Entrando na turma ${turmaId.slice(0,12)}...`);

  const resGet = await seguir(`${BASE}/portais/discente/turmas.jsf`);
  const htmlGet = await resGet.text();

  const viewStateMatch = htmlGet.match(/name="javax.faces.ViewState"[^>]*value="([^"]*)"/i);
  const viewState = viewStateMatch ? viewStateMatch[1] : 'j_id3';
  console.log(`  ViewState: ${viewState}`);

  const formData = new URLSearchParams();
  formData.append('j_id_jsp_1204840590_2', 'j_id_jsp_1204840590_2');
  formData.append('javax.faces.ViewState', viewState);

  const sourceComponent = rowIndex === 0
    ? 'j_id_jsp_1204840590_4'
    : `j_id_jsp_1204840590_4j_id_${rowIndex}`;
  formData.append(sourceComponent, sourceComponent);

  formData.append('frontEndIdTurma', turmaId);
  formData.append('inciadoPelaBusca', 'true');
  formData.append('paginaListaTurmasOrigem', '/portais/discente/turmas.jsp');

  // RichFaces AJAX params
  formData.append('A4J.AJAX', 'true');
  formData.append('org.richfaces.ajax.component', sourceComponent);

  console.log(`  Submetendo AJAX JSF (${formData.toString().length} chars)...`);

  const resPost = await fetch(`${BASE}/portais/discente/turmas.jsf`, {
    method: 'POST',
    body: formData.toString(),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'faces-request': 'ajax',
      'x-requested-with': 'XMLHttpRequest',
      'accept': 'text/xml,application/xml,*/*'
    }
  });

  const htmlTurma = await resPost.text();
  console.log(`  Resposta turma virtual: ${htmlTurma.length} chars`);

  return {
    url: `${BASE}/portais/discente/turmaVirtual.jsf?frontEndIdTurma=${turmaId}`,
    text: async () => htmlTurma,
    ok: true
  };
}

// ---------- BAIXA MATERIAIS DA PAGINA ----------
async function baixarMateriaisDaPagina(html, turma) {
  const materiais = [];
  const extensoes = ['pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'rar', 'odt', 'odp', 'ods', 'txt', 'md', 'jpg', 'png', 'mp4', 'mp3', 'avi', 'mov', 'webm'];
  const regexExt = new RegExp(`\\.(${extensoes.join('|')})(['"?\\s])`, 'gi');

  for (const m of html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    const texto = m[2].replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
    if (!href || !texto) continue;

    const absUrl = new URL(href, BASE).toString();
    const isArquivo = regexExt.test(href) || /material|slide|apostila|aula|download|anexo|arquivo|pdf|ppt|doc|zip/i.test(texto);

    if (isArquivo) {
      materiais.push({ nome: texto || 'arquivo', url: absUrl });
    }
  }

  const unicos = [];
  const vistas = new Set();
  for (const m of materiais) {
    if (!vistas.has(m.url)) { vistas.add(m.url); unicos.push(m); }
  }
  return unicos;
}

// ---------- BAIXA ARQUIVO ----------
async function baixarArquivo(url, pastaDestino, nomeBase) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const ext = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1] || 'bin';
    const nomeSeguro = (nomeBase || 'arquivo').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 100);
    let arquivo = path.join(pastaDestino, `${nomeSeguro}.${ext}`);
    let n = 1;
    while (fs.existsSync(arquivo)) { arquivo = path.join(pastaDestino, `${nomeSeguro}-${n}.${ext}`); n++; }

    const buffer = await res.arrayBuffer();
    fs.writeFileSync(arquivo, Buffer.from(buffer));
    return path.basename(arquivo);
  } catch (e) {
    throw new Error(`${e.message}`);
  }
}

// ---------- ATUALIZA NOTA COM ANEXOS ----------
function atualizarNotaComAnexos(nomeTurma, pastaAnexos, novos) {
  const nomeArq = nomeTurma.replace(/[\\/:*?"<>|]/g, '-').trim();
  const notaPath = path.join(path.dirname(pastaAnexos), `${nomeArq}.md`);
  let conteudo = fs.existsSync(notaPath) ? fs.readFileSync(notaPath, 'utf8') : '';

  conteudo = conteudo.replace(/## Anexeos[\s\S]*?(?=## |$)/, '');

  const todos = fs.readdirSync(pastaAnexos).filter(f => !f.endsWith('.md'));
  const lista = todos.map(f => `- [[anexos/${f}]]`).join('\n');
  conteudo += `\n## Anexeos (atualizado ${new Date().toLocaleDateString('pt-BR')})\n${lista}\n`;

  fs.writeFileSync(notaPath, conteudo);
  console.log(`  Nota atualizada com ${novos.length} arquivo(s)`);
}

// ---------- PROCESSA UMA TURMA ----------
async function processarTurma(turma, rowIndex) {
  const info = MATERIA_MAP[turma.id] || { nome: turma.nome, pasta: turma.nome.replace(/[\\/:*?"<>|]/g, '-').trim() };
  console.log(`\nMateria: ${turma.nome}`);

  try {
    // 1. Acessa turma virtual
    const resTurma = await acessarTurmaVirtual(turma.id, rowIndex);
    console.log(`  Turma virtual: ${resTurma.url}`);

    // 2. Baixa materiais da pagina
    const htmlTurma = await resTurma.text();
    const materiais = await baixarMateriaisDaPagina(htmlTurma, turma);

    if (materiais.length === 0) {
      console.log(`  (nenhum material direto na pagina)`);
      return { materiais: [] };
    }

    console.log(`  ${materiais.length} arquivo(s) encontrado(s)`);

    // Prepara pastas
    const info = MATERIA_MAP[turma.id] || { nome: turma.nome, pasta: turma.nome.replace(/[\\/:*?"<>|]/g, '-').trim() };
    const pastaTurma = path.join(VAULT_BASE, info.pasta);
    const pastaAnexos = path.join(pastaTurma, 'anexos');
    fs.mkdirSync(pastaAnexos, { recursive: true });

    // Baixa cada arquivo
    const baixados = [];
    for (const mat of materiais) {
      try {
        console.log(`    ${mat.nome.slice(0,50)}`);
        const salvo = await baixarArquivo(mat.url, pastaAnexos, mat.nome);
        baixados.push(salvo);
      } catch (e) {
        console.log(`    Falhou: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 500));
    }

    // Atualiza nota
    if (baixados.length) atualizarNotaComAnexos(turma.nome, path.join(VAULT_BASE, info.pasta, 'anexos'), baixados);

    return { materiais: baixados };

  } catch (e) {
    console.log(`  Erro: ${e.message}`);
    return { materiais: [] };
  }
}

// ---------- ACESSA TURMA VIRTUAL (JSF POST EXATO) ----------
async function acessarTurmaVirtual(turmaId, rowIndex = 0) {
  console.log(`  Entrando na turma ${turmaId.slice(0,12)}...`);

  const resGet = await seguir(`${BASE}/portais/discente/turmas.jsf`);
  const htmlGet = await resGet.text();

  const viewStateMatch = htmlGet.match(/name="javax.faces.ViewState"[^>]*value="([^"]*)"/i);
  const viewState = viewStateMatch ? viewStateMatch[1] : 'j_id3';
  console.log(`  ViewState: ${viewState}`);

  const formData = new URLSearchParams();
  formData.append('j_id_jsp_1204840590_2', 'j_id_jsp_1204840590_2');
  formData.append('javax.faces.ViewState', viewState);

  const sourceComponent = rowIndex === 0
    ? 'j_id_jsp_1204840590_4'
    : `j_id_jsp_1204840590_4j_id_${rowIndex}`;
  formData.append(sourceComponent, sourceComponent);

  formData.append('frontEndIdTurma', turmaId);
  formData.append('inciadoPelaBusca', 'true');
  formData.append('paginaListaTurmasOrigem', '/portais/discente/turmas.jsp');

  // RichFaces AJAX params
  formData.append('A4J.AJAX', 'true');
  formData.append('org.richfaces.ajax.component', sourceComponent);

  console.log(`  Submetendo AJAX JSF (${formData.toString().length} chars)...`);

  const resPost = await fetch(`${BASE}/portais/discente/turmas.jsf`, {
    method: 'POST',
    body: formData.toString(),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'faces-request': 'ajax',
      'x-requested-with': 'XMLHttpRequest',
      'accept': 'text/xml,application/xml,*/*'
    }
  });

  const htmlTurma = await resPost.text();
  console.log(`  Resposta turma virtual: ${htmlTurma.length} chars`);

  return {
    url: `${BASE}/portais/discente/turmaVirtual.jsf?frontEndIdTurma=${turmaId}`,
    text: async () => htmlTurma,
    ok: true
  };
}

// ---------- LOGIN SIGAA ----------
async function doLogin() {
  const user = process.env.SIGAA_USER;
  const pass = process.env.SIGAA_PASS;
  if (!user || !pass) throw new Error('SIGAA_USER/SIGAA_PASS nao estao no .env');
  console.log('Logando no SIGAA...');
  await login(user, pass);
  console.log('Logado!');
}

// ---------- ABRE BRAVE E CONECTA ----------
async function acordarBrave() {
  console.log('Iniciando Brave...');
  bravo.acordarBrave();
  await bravo.esperarBrave(30);
  console.log('Brave conectado!');
}

// ---------- LISTA TURMAS DA PAGINA turmas.jsf ----------
async function listarTurmas() {
  console.log('Buscando lista de turmas...');
  const res = await seguir(`${BASE}/portais/discente/turmas.jsf`);
  const html = await res.text();

  const turmas = [];
  const linhas = html.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] || '';
  const regexLinha = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const m of linhas.matchAll(regexLinha)) {
    const l = m[1];
    const idMatch = l.match(/frontEndIdTurma['"]:\s*'([A-F0-9]+)'/i);
    if (!idMatch) continue;
    const id = idMatch[1];

    const nomeMatch = l.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    let nome = `Turma-${id.slice(0,8)}`;
    if (nomeMatch) {
      const limpo = nomeMatch[1].replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
      if (limpo.length > 5) nome = limpo.slice(0, 100);
    }
    turmas.push({ id, nome });
  }

  const unicas = [];
  const vistos = new Set();
  for (const t of turmas) {
    if (!vistos.has(t.id)) { vistos.add(t.id); unicas.push(t); }
  }

  console.log(`Encontradas ${unicas.length} turmas:`);
  unicas.forEach((t, idx) => console.log(`  ${idx+1}. ${t.nome} (${t.id.slice(0,12)}...)`));
  return unicas;
}

// ---------- LOGIN SIGAA ----------
async function doLogin() {
  const user = process.env.SIGAA_USER;
  const pass = process.env.SIGAA_PASS;
  if (!user || !pass) throw new Error('SIGAA_USER/SIGAA_PASS nao estao no .env');
  console.log('Logando no SIGAA...');
  await login(user, pass);
  console.log('Logado!');
}

// ---------- ABRE BRAVE E CONECTA ----------
async function acordarBrave() {
  console.log('Iniciando Brave...');
  bravo.acordarBrave();
  await bravo.esperarBrave(30);
  console.log('Brave conectado!');
}

// ---------- MAIN ----------
async function main() {
  console.log('SIGAA BROWSER DOWNLOADER - Usando Brave via CDP');
  console.log('==================================================');

  // 1. Inicia Brave
  await acordarBrave();

  // 2. Login SIGAA
  await doLogin();

  // 3. Lista turmas
  const turmas = await listarTurmas();
  if (turmas.length === 0) { console.log('Nenhuma turma'); return; }

  // 4. Processa cada turma
  let total = 0;
  for (let i = 0; i < turmas.length; i++) {
    const resultado = await processarTurma(turmas[i], i);
    total += resultado.materiais?.length || 0;
    console.log(`  ${resultado.materiais?.length || 0} arquivo(s)`);
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log(`\nCONCLUIDO! ${total} arquivo(s) total`);
  console.log(`Salvos em: ${VAULT_BASE}`);
  console.log('Abra o Obsidian -> cada materia tem pasta anexos/ com os PDFs/PPTs');
}

main().catch(e => { console.error('Erro fatal:', e); process.exit(1) });