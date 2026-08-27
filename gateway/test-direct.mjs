import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(path.dirname(new URL(import.meta.url).pathname), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2];
  }
}

import { login, seguir, BASE } from './sigaa.js';

await login(process.env.SIGAA_USER, process.env.SIGAA_PASS);
console.log('Logado!');

const id = '70F07D213BE85A763C0039D9186169E8108E3CEB';

// Tenta URLs conhecidas de material de apoio
const urls = [
  `${BASE}/portais/discente/materialApoio.jsf?frontEndIdTurma=${id}`,
  `${BASE}/portais/discente/verMaterialApoio.jsf?frontEndIdTurma=${id}`,
  `${BASE}/portais/discente/arquivos.jsf?frontEndIdTurma=${id}`,
  `${BASE}/portais/discente/turmaVirtual.jsf?frontEndIdTurma=${id}&aba=material`,
  `${BASE}/portais/discente/turmaVirtual.jsf?frontEndIdTurma=${id}&pagina=material`,
];

for (const url of urls) {
  try {
    const res = await (await import('./sigaa.js')).seguir(url);
    const html = await res.text();
    console.log(`\n${url}`);
    console.log(`  Status: ${res.status}, URL: ${res.url}, Length: ${html.length}`);
    if (html.length > 5000 && !html.includes('não encontrada') && !html.includes('Todas as Turmas')) {
      console.log('  ✅ POSSÍVEL!');
      // Procura links de arquivo
      const links = html.match(/href="([^"]*)"[^>]*>([^<]*(?:pdf|ppt|doc|zip|rar|jpg|png|mp4|mp3)[^<]*)/gi) || [];
      console.log(`  Links de arquivo: ${links.length}`);
      links.slice(0, 5).forEach(l => console.log(`    ${l}`));
    }
  } catch (e) {
    console.log(`  Erro: ${e.message}`);
  }
}
