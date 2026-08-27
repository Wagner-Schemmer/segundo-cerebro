import fs from 'node:fs';
import path from 'node:path';

// Carrega .env
const envPath = path.join(path.dirname(new URL(import.meta.url).pathname), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}

import { login, seguir, BASE, req } from './sigaa.js';

await login(process.env.SIGAA_USER, process.env.SIGAA_PASS);
console.log('Logado!');

const id = '70F07D213BE85A763C0039D9186169E8108E3CEB';

// 1. GET página de turmas
const resGet = await seguir(`${BASE}/portais/discente/turmas.jsf`);
const htmlGet = await resGet.text();
fs.writeFileSync('/tmp/turmas-page.html', htmlGet);
console.log('Turmas page:', htmlGet.length);

// Extrai ViewState
const viewStateMatch = htmlGet.match(/name="javax.faces.ViewState"[^>]*value="([^"]*)"/i);
const viewState = viewStateMatch ? viewStateMatch[1] : 'j_id3';
console.log('ViewState:', viewState);

// POST form EXATO
const formData = new URLSearchParams();
formData.append('j_id_jsp_1204840590_2', 'j_id_jsp_1204840590_2');
formData.append('javax.faces.ViewState', viewState);
formData.append('j_id_jsp_1204840590_4', 'j_id_jsp_1204840590_4');
formData.append('frontEndIdTurma', '70F07D213BE85A763C0039D9186169E8108E3CEB');
formData.append('inciadoPelaBusca', 'true');
formData.append('paginaListaTurmasOrigem', '/portais/discente/turmas.jsp');
formData.append('A4J.AJAX', 'true');
formData.append('org.richfaces.ajax.component', 'j_id_jsp_1204840590_4');

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
console.log('Status:', resPost.status);
console.log('Headers:', JSON.stringify(Object.fromEntries(resPost.headers.entries()), null, 2));
console.log('\n--- RESPOSTA COMPLETA ---');
console.log(respostaText);
