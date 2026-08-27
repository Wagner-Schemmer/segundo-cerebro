import { login, seguir, BASE } from './sigaa.js';
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
const url = BASE + '/portais/discente/turmaVirtual.jsf?frontEndIdTurma=' + id;
const res = await seguir(url);
const html = await res.text();
fs.writeFileSync('/tmp/turma-completa.html', html);
console.log('Salvo! Length:', html.length);

const iframes = html.match(/<iframe[^>]*src="([^"]*)"/gi) || [];
console.log('\nIFRAMES encontrados:', iframes.length);
iframes.forEach(f => console.log(f));

const menuLinks = html.match(/href="([^"]*)"[^>]*>([^<]*(?:Material|Apoio|Anexo|Arquivo|Slide|Aula)[^<]*)/gi) || [];
console.log('\nLinks com Material/Apoio/Anexo:', menuLinks.length);
menuLinks.forEach(l => console.log(l));

const tabs = html.match(/rich:tab[^>]*label="([^"]*)"/gi) || [];
console.log('\nRichFaces tabs:', tabs.length);
tabs.forEach(t => console.log(t));

const jsfLinks = html.match(/onclick="[^"]*jsfcljs[^"]*"/gi) || [];
console.log('\nJSF links (onclick):', jsfLinks.length);
jsfLinks.slice(0, 10).forEach(t => console.log(t.slice(0, 150)));
