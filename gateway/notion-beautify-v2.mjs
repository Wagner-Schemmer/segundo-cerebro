import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname,'.env'),'utf8').split('\n').filter(l=>l.trim()&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const TOKEN='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'
const H={'Authorization':`Bearer ${TOKEN}`,'Notion-Version':'2022-06-28','Content-Type':'application/json'}
async function api(p,opts){ const r=await fetch(`https://api.notion.com/v1${p}`,{...opts,headers:H}); const j=await r.json(); if(!r.ok) throw new Error(`${p} ${r.status} ${JSON.stringify(j).slice(0,800)}`); return j }
async function listChildren(id){ const r=await api(`/blocks/${id}/children?`); return r.results }
async function deleteChildren(id){ const kids=await listChildren(id); for(const b of kids) await api(`/blocks/${b.id}`,{method:'DELETE'}).catch(()=>{}); }
async function addChildren(id,children){ return api(`/blocks/${id}/children`,{method:'PATCH',body:JSON.stringify({children})}) }
async function setPageMeta(id,cover,icon){ return api(`/pages/${id}`,{method:'PATCH',body:JSON.stringify({cover: cover?{type:'external',external:{url:cover}}:undefined, icon: icon?{type:'emoji',emoji:icon}:undefined})})}
// IDs criados no v1
const ULTRON='3ccf2ce0-17b7-8030-89f6-fe3c822bce80'
const DASH='3ccf2ce0-17b7-81b6-903a-d5960e73a8b3'
const FAC='3ccf2ce0-17b7-817f-8542-ed0649a72b40'
const DB_MAT='3ccf2ce0-17b7-81a4-a526-d3ca7f9f81dc'
const DB_TAR='3caf2ce0-17b7-817a-b6f9-f11835055bc5'

console.log('Limpando e redecorando...')
// Capas Unsplash
const coverUltron='https://images.unsplash.com/photo-1518770660439-4636190af475?w=1500' // tech
const coverDash='https://images.unsplash.com/photo-1451187580459-43490279c429?w=1500' // space
const coverFac='https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1500' // university

await setPageMeta(ULTRON, coverUltron,'🧠')
await setPageMeta(DASH, coverDash,'🏠')
await setPageMeta(FAC, coverFac,'🎓')

await deleteChildren(ULTRON)
await deleteChildren(DASH)
await deleteChildren(FAC)

// ULTRON — hero section com 3 colunas
await addChildren(ULTRON,[
  {type:'heading_1',heading_1:{rich_text:[{text:{content:'Ultron — Segundo Cérebro'},annotations:{bold:true}}]}},
  {type:'paragraph',paragraph:{rich_text:[{text:{content:'Seu sistema operacional acadêmico • Vault + SIGAA + Notion + Telegram • Sync 07:00'},annotations:{italic:true,color:'gray'}}]}},
  {type:'divider',divider:{}},
  // colunas com 3 métricas
  {type:'column_list',column_list:{}, children:[
  ]},
])
// coluna é via column_list -> columns
await addChildren(ULTRON,[
  {object:'block',type:'column_list',column_list:{children:[
    // col 1
  ]}}
])
// API não aceita nested assim em um PATCH, então faz via column_list direto com children
// workaround: criar column_list com 3 columns cada com blocos
const metrics = [
  {emoji:'📚', title:'10 matérias', sub:'2026.2 • IFFAR', color:'blue'},
  {emoji:'⏰', title:'4 prazos', sub:'02/09 → 14/09', color:'red'},
  {emoji:'📎', title:'Materiais', sub:'85 PDFs organizados', color:'green'},
]
 // vamos criar callouts coloridos + galeria
await api(`/blocks/${ULTRON}/children`,{method:'PATCH',body:JSON.stringify({children:[
  {type:'callout',callout:{rich_text:[{text:{content:'✨ Bem-vindo ao seu cockpit acadêmico. Tudo o que você precisa em um único lugar.'}}],icon:{type:'emoji',emoji:'🚀'},color:'blue_background'}},
  {type:'columns', columns:{}},
]})}).catch(()=>{})

// Como columns é chato via API, usa blocos simples mas vistosos: 3 callouts lado a lado via quote+divider
await addChildren(ULTRON,[
  {type:'callout',callout:{rich_text:[{text:{content:'📚  10 Matérias ativas  •  2026.2 IFFAR'}}, {text:{content:'\n684h • veja em Faculdade abaixo'}}],icon:{type:'emoji',emoji:'🎓'},color:'blue_background'}},
  {type:'callout',callout:{rich_text:[{text:{content:'⏰  4 Prazos pendentes  •  próximo 02/09'}}, {text:{content:'\nVeja Minhas tarefas → view Calendar'}}],icon:{type:'emoji',emoji:'🔥'},color:'red_background'}},
  {type:'callout',callout:{rich_text:[{text:{content:'📎  85 PDFs  •  Materiais SIGAA'}}, {text:{content:'\nFiltre por Matéria / Módulo'}}],icon:{type:'emoji',emoji:'📦'},color:'green_background'}},
  {type:'divider',divider:{}},
  {type:'heading_2',heading_2:{rich_text:[{text:{content:'🧭 Navegação rápida'}}]}},
  {type:'paragraph',paragraph:{rich_text:[{text:{content:'👉 '}}, {text:{content:'Dashboard'},annotations:{bold:true,color:'blue'}}, {text:{content:'  •  📚 Faculdade (10 matérias)  •  ✅ Minhas tarefas (Calendar)  •  📎 Materiais SIGAA'}}]}},
  {type:'quote',quote:{rich_text:[{text:{content:'"Organização é liberdade. O cérebro só funciona se o sistema funcionar." — Ultron'}}]}},
  {type:'paragraph',paragraph:{rich_text:[{text:{content:'🔗 Hub local: http://localhost:3777  •  Vault: cerebro/02-areas/faculdade/  •  Telegram: /tarefas /sigaa'}}]}},
])

// DASH — rico
await addChildren(DASH,[
  {type:'heading_1',heading_1:{rich_text:[{text:{content:'Dashboard — Segundo Cérebro'},annotations:{bold:true}}]}},
  {type:'callout',callout:{rich_text:[{text:{content:'⚡ Sync automático SIGAA → Notion → Vault → Telegram  •  Próximo ciclo 07:00'}}],icon:{type:'emoji',emoji:'🔄'},color:'purple_background'}},
  {type:'divider',divider:{}},
  // grafico via quickchart embed como imagem
  {type:'heading_2',heading_2:{rich_text:[{text:{content:'📊 Carga por matéria'}}]}},
  {type:'image',image:{type:'external',external:{url:'https://quickchart.io/chart?c={type:%27bar%27,data:{labels:[%27BD%27,%27Calculo%27,%27Algoritmos%27,%27Logica%27,%27Discreta%27,%27Ingles%27],datasets:[{label:%27CH%27,data:[60,80,60,60,60,40],backgroundColor:%27%23667eea%27}]}&w=600&h=250&bkg=white'}}},
  {type:'callout',callout:{rich_text:[{text:{content:'💡 Dica: use Notion Calendar com Minhas tarefas (Prazo) para ver tudo no calendário. Cálculo 04/09 é o mais urgente!'}}],icon:{type:'emoji',emoji:'🎯'},color:'yellow_background'}},
  {type:'heading_2',heading_2:{rich_text:[{text:{content:'⏰ Prazos críticos (14 dias)'}}]}},
  {type:'to_do',to_do:{rich_text:[{text:{content:'BANCO DE DADOS I — Atividade 03 Modelagem  •  02/09'}}],checked:false}},
  {type:'to_do',to_do:{rich_text:[{text:{content:'CÁLCULO I — 1ª Avaliação  •  04/09  🔴'}}],checked:false}},
  {type:'to_do',to_do:{rich_text:[{text:{content:'METODOLOGIA — Entrega Projeto Extensão  •  12/09'}}],checked:false}},
  {type:'to_do',to_do:{rich_text:[{text:{content:'METODOLOGIA — 1ª Avaliação  •  14/09'}}],checked:false}},
  {type:'heading_2',heading_2:{rich_text:[{text:{content:'📈 Progresso'}}]}},
  {type:'paragraph',paragraph:{rich_text:[{text:{content:'▓▓▓▓░░░░░░ 40%  •  4 tarefas pendentes  •  2 concluídas'}}]}},
  {type:'divider',divider:{}},
  {type:'callout',callout:{rich_text:[{text:{content:'🎨 Capas e ícones via Unsplash • Gráfico via QuickChart • Cores Notion'}}],icon:{type:'emoji',emoji:'✨'}}},
])

// FAC — com toggles por matéria e emoji diferenciado
await addChildren(FAC,[
  {type:'heading_1',heading_1:{rich_text:[{text:{content:'Faculdade — 2026.2'}}]}},
  {type:'paragraph',paragraph:{rich_text:[{text:{content:'10 matérias • clique para abrir cada página • cada uma tem atalhos para Materiais e Tarefas'}}]}},
  {type:'divider',divider:{}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🗄️  BANCO DE DADOS I  — 60h  •  Modelagem • Diagramas'}}],children:[{type:'paragraph',paragraph:{rich_text:[{text:{content:'Pasta: cerebro/02-areas/faculdade/BANCO DE DADOS I/  •  Filtre Materiais SIGAA por Matéria = BANCO DE DADOS I'}}]}},{type:'paragraph',paragraph:{rich_text:[{text:{content:'Próximo: Atividade 03 — 02/09'}}]}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🧮  CÁLCULO DIFERENCIAL E INTEGRAL I  — 80h  •  Avaliação 04/09 🔴'}}],children:[{type:'paragraph',paragraph:{rich_text:[{text:{content:'Mais urgente do semestre!'}}]}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🗣️  INGLÊS TÉCNICO'}}],children:[{type:'paragraph',paragraph:{rich_text:[{text:{content:'Vault: INGLES TECNICO/'}}]}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🌱  METODOLOGIA EXTENSIONISTA  — 2 prazos'}}],children:[{type:'paragraph',paragraph:{rich_text:[{text:{content:'12/09 Entrega Projeto + 14/09 Avaliação'}}]}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'📐  TÓPICOS DE ÁLGEBRA LINEAR E GEOMETRIA ANALÍTICA'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'💻  ALGORITMOS E PROGRAMAÇÃO'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🔧  FUNDAMENTOS DA COMPUTAÇÃO'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'✍️  LEITURA E PRODUÇÃO TEXTUAL'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🧠  LÓGICA MATEMÁTICA'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🔢  MATEMÁTICA DISCRETA'}}]}},
  {type:'divider',divider:{}},
  {type:'callout',callout:{rich_text:[{text:{content:'💡 Dica: abra qualquer matéria acima → use os filtros linkados para ver só os PDFs e tarefas daquela matéria.'}}],icon:{type:'emoji',emoji:'🔍'},color:'gray_background'}}},
  {type:'image',image:{type:'external',external:{url:'https://images.unsplash.com/photo-1434030216411-0b793f4b417d?w=800'}}},
])

console.log('DONE v2')
