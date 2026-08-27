import { login, req, BASE, seguir } from './sigaa.js';
import fs from 'node:fs';

await login(process.env.SIGAA_USER, process.env.SIGAA_PASS);
console.log('Logado');

const id = '70F07D213BE85A763C0039D9186169E8108E3CEB';

const resGet = await seguir(`${BASE}/portais/discente/turmas.jsf`);
const htmlGet = await resGet.text();

const viewStateMatch = htmlGet.match(/name="javax.faces.ViewState"[^>]*value="([^"]*)"/i);
const viewState = viewStateMatch ? viewStateMatch[1] : 'j_id3';
console.log('ViewState:', viewState);

const formData = new URLSearchParams();
formData.append('j_id_jsp_1204840590_2', 'j_id_jsp_1204840590_2');
formData.append('javax.faces.ViewState', viewState);
formData.append('j_id_jsp_1204840590_4', 'j_id_jsp_1204840590_4');
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
console.log('Status:', resPost.status);
console.log('Headers:', JSON.stringify(Object.fromEntries(resPost.headers.entries()), null, 2));
console.log('\n--- RESPOSTA COMPLETA ---');
console.log(respostaText);
