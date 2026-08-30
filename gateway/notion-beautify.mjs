import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname,'.env'),'utf8').split('\n').filter(l=>l.trim()&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const TOKEN = env.NOTION_TOKEN
const PARENT = env.NOTION_PAGE_ULTRON
const DB_MAT = env.NOTION_DB_MATERIAIS
const DB_TAR = env.NOTION_DB_TAREFAS
const H = {'Authorization':`Bearer ${TOKEN}`,'Notion-Version':'2022-06-28','Content-Type':'application/json'}
async function api(p,opts){ const r=await fetch(`https://api.notion.com/v1${p}`,{...opts,headers:H}); const j=await r.json(); if(!r.ok) throw new Error(JSON.stringify(j).slice(0,400)); return j }
const subjects = [
  "BANCO DE DADOS I","CÁLCULO DIFERENCIAL E INTEGRAL I","INGLÊS TÉCNICO","METODOLOGIA EXTENSIONISTA","TÓPICOS DE ÁLGEBRA LINEAR E GEOMETRIA ANALÍTICA","ALGORITMOS E PROGRAMAÇÃO","FUNDAMENTOS DA COMPUTAÇÃO","LEITURA E PRODUÇÃO TEXTUAL","LÓGICA MATEMÁTICA","MATEMÁTICA DISCRETA"
]
async function createPage(title, icon, children){
  return api('/pages',{method:'POST',body:JSON.stringify({parent:{page_id:PARENT},icon:icon?{type:'emoji',emoji:icon}:undefined,properties:{title:{title:[{text:{content:title}}]}},children})})
}
console.log('Criando Dashboard...')
const dash = await createPage('🏠 Dashboard — Segundo Cérebro','🧠',[
  {object:'block',type:'callout',callout:{rich_text:[{text:{content:'Bem-vindo ao seu Segundo Cérebro • 10 matérias • Sincronizado com SIGAA • Atualizado via Ultron'}}],icon:{type:'emoji',emoji:'✨'}}},
  {object:'block',type:'heading_2',heading_2:{rich_text:[{text:{content:'📚 Faculdade — 2026.2'}}]}},
  {object:'block',type:'bulleted_list_item',bulleted_list_item:{rich_text:[{text:{content:'10 matérias ativas no IFFAR'}}]}},
  {object:'block',type:'bulleted_list_item',bulleted_list_item:{rich_text:[{text:{content:'Próximas provas e entregas: veja Minhas tarefas abaixo'}}]}},
  {object:'block',type:'heading_2',heading_2:{rich_text:[{text:{content:'✅ Próximos prazos'}}]}},
  {object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:'Abra '}}, {text:{content:'Minhas tarefas'},annotations:{bold:true}}, {text:{content:' em visão Calendar ou filtre por Prazo. Datas vêm direto do SIGAA.'}}]}},
  {object:'block',type:'heading_2',heading_2:{rich_text:[{text:{content:'📎 Materiais'}}]}},
  {object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:'Todos os PDFs do SIGAA organizados por Matéria/Módulo em '}}, {text:{content:'Materiais SIGAA'},annotations:{bold:true}}]}},
  {object:'block',type:'divider',divider:{}},
  {object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:'🔗 Vault local: cerebro/02-areas/faculdade/ • Hub: http://localhost:3777'}}]}}
])
console.log('Dashboard:',dash.id)
console.log('Criando Faculdade...')
const fac = await createPage('📚 Faculdade','🎓',[
  {object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:'10 matérias do semestre 2026.2. Cada página abaixo espelha o vault (Obsidian).'}}]}},
  {object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:'Use com Notion Calendar para ver prazos das avaliações.'}}]}},
])
console.log('Faculdade:',fac.id)
for(const s of subjects){
  const p = await api('/pages',{method:'POST',body:JSON.stringify({parent:{page_id:fac.id},icon:{type:'emoji',emoji:'📘'},properties:{title:{title:[{text:{content:s}}]}}})})
  console.log(' +',s, p.id)
  await api(`/blocks/${p.id}/children`,{method:'PATCH',body:JSON.stringify({children:[
    {object:'block',type:'callout',callout:{rich_text:[{text:{content:`Matéria • IFFAR 2026.2`}}],icon:{type:'emoji',emoji:'📖'}}},
    {object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:`Pasta no vault: `}}, {text:{content:`cerebro/02-areas/faculdade/${s}/`},annotations:{code:true}}]}},
    {object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:`📎 Anexos em Materiais SIGAA (filtre por Matéria = ${s})`}}]}},
    {object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:`✅ Tarefas em Minhas tarefas (filtre por nome contendo ${s.slice(0,12)})`}}]}}
  ]})})
}
// atualizar página Ultron principal com descrição
await api(`/pages/${PARENT}`,{method:'PATCH',body:JSON.stringify({properties:{title:{title:[{text:{content:'Ultron — Segundo Cérebro'}}]}}})})
await api(`/blocks/${PARENT}/children`,{method:'PATCH',body:JSON.stringify({children:[
  {object:'block',type:'heading_1',heading_1:{rich_text:[{text:{content:'🧠 Ultron — Segundo Cérebro'}}]}},
  {object:'block',type:'callout',callout:{rich_text:[{text:{content:'Central • Vault Obsidian + SIGAA + Notion + Telegram • Sync diário 07:00'}}],icon:{type:'emoji',emoji:'⚡'}}},
  {object:'block',type:'paragraph',paragraph:{rich_text:[{text:{content:'Abaixo: Dashboard, Faculdade (10 matérias), e os 2 databases.'}}]}}
]})})
console.log('DONE')
