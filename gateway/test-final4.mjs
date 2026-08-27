import fs from 'node:fs';
import path from 'node:path';

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

const resGet = await (await import('./sigaa.js')).seguir(`${BASE}/portais/discente/turmas.jsf`);
const htmlGet = await resGet.text();

const viewStateMatch = htmlGet.match(/name="javax.faces.ViewState"[^>]*value="([^"]*)"/i);
const viewState = viewStateMatch ? viewStateMatch[1] : 'j_id3';
console.log('ViewState:', viewState);

// POST form COM o source component CORRETO (com prefixo do form ID)
const formData = new URLSearchParams();
formData.append('j_id_jsp_1204840590_2', 'j_id_jsp_1204840590_2');
formData.append('javax.faces.ViewState', viewState);
// O source component DEVE ter o prefixo do form ID: j_id_jsp_1204840590_2:j_id_jsp_1204840590_4
formData.append('j_id_jsp_1204840590_2:j_id_jsp_1204840590_4', 'j_id_jsp_1204840590_2:j_id_jsp_1204840590_4');
formData.append('frontEndIdTurma', '70F07D213BE85A763C0039D9186169E8108E3CEB');
formData.append('inciadoPelaBusca', 'true');
formData.append('paginaListaTurmasOrigem', '/portais/discente/turmas.jsp');

console.log('Submetendo POST com source component CORRETO...');
const resPost = await req(`${BASE}/portais/discente/turmas.jsf`, {
  method: 'POST',
  body: formData.toString(),
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  redirect: 'manual'
});

console.log('Status:', resPost.status);
console.log('URL final:', resPost.url);

// Segue redirects
const resFinal = await (await import('./sigaa.js')).seguir(resPost.url);
const htmlFinal = await resFinal.text();
console.log('\nFinal URL:', resFinal.url);
console.log('Final length:', htmlFinal.length);

if (htmlFinal.includes('Turma Virtual') && !htmlFinal.includes('Todas as Turmas')) {
  console.log('✅ SUCESSO! Turma virtual carregada!');
} else if (htmlFinal.includes('Todas as Turmas')) {
  console.log('❌ Ainda na lista de turmas');
} else {
  console.log('❓ Página inesperada');
}
