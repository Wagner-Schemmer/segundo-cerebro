import { login, seguir, BASE, req } from './sigaa.js';
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(path.dirname(new URL(import.meta.url).pathname), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}

await login(process.env.SIGAA_USER, process.env.SIGAA_PASS);
console.log('Logado');

const id = '70F07D213BE85A763C0039D9186169E8108E3CEB';

// 1. GET a página de turmas pra pegar ViewState
const resGet = await seguir(`${BASE}/portais/discente/turmas.jsf`);
const htmlGet = await resGet.text();

const viewStateMatch = htmlGet.match(/name="javax.faces.ViewState"[^>]*value="([^"]*)"/i);
const viewState = viewStateMatch ? viewStateMatch[1] : 'j_id3';
console.log('ViewState:', viewState);

// POST EXATO como o navegador faz (primeira linha da tabela = rowIndex 0)
const formData = new URLSearchParams();
formData.append('j_id_jsp_1204840590_2', 'j_id_jsp_1204840590_2');
formData.append('javax.faces.ViewState', 'j_id3');
formData.append('j_id_jsp_1204840590_4', 'j_id_jsp_1204840590_4'); // row 0
formData.append('frontEndIdTurma', '70F07D213BE85A763C0039D9186169E8108E3CEB');
formData.append('inciadoPelaBusca', 'true');
formData.append('paginaListaTurmasOrigem', '/portais/discente/turmas.jsp');
formData.append('A4J.AJAX', 'true');
formData.append('org.richfaces.ajax.component', 'j_id_jsp_1204840590_4');

console.log('Submetendo AJAX...');
const resPost = await req(`${BASE}/portais/discente/turmas.jsf`, {
  method: 'POST',
  body: formData.toString(),
  headers: { 
    'content-type': 'application/x-www-form-urlencoded',
    'faces-request': 'ajax',
    'x-requested-with': 'XMLHttpRequest',
    'accept': 'text/xml,application/xml,*/*'
  }
});

const respostaText = await resPost.text();
console.log('Resposta AJAX length:', respostaText.length);
console.log('Primeiros 2000 chars:');
console.log(respostaText.slice(0, 2000));

fs.writeFileSync('/tmp/ajax-response.xml', respostaText);

// Tenta seguir redirects
const resFinal = await require('./sigaa.js').seguir('https://sig.iffarroupilha.edu.br/sigaa/portais/discente/turmas.jsf');
const htmlFinal = await resFinal.text();
fs.writeFileSync('/tmp/after-post.html', htmlFinal);
console.log('\nAfter POST length:', htmlFinal.length);
console.log('URL final:', resFinal.url);
