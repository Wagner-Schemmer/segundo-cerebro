import fs from 'fs'
import path from 'path'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split('\n').filter(l=>l.trim()&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const TOKEN='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'
const H={'Authorization':`Bearer ${TOKEN}`,'Notion-Version':'2022-06-28','Content-Type':'application/json'}
async function api(p,opts){ const r=await fetch(`https://api.notion.com/v1${p}`,{...opts,headers:H}); const j=await r.json(); if(!r.ok) throw new Error(`${p} ${r.status} ${JSON.stringify(j).slice(0,900)}`); return j }
async function listChildren(id){ return (await api(`/blocks/${id}/children`)).results }
async function deleteChildren(id){ for(const b of await listChildren(id)) await api(`/blocks/${b.id}`,{method:'DELETE'}).catch(()=>{}) }
async function addChildren(id,children){ return api(`/blocks/${id}/children`,{method:'PATCH',body:JSON.stringify({children})}) }
async function setMeta(id,cover,icon){ return api(`/pages/${id}`,{method:'PATCH',body:JSON.stringify({cover:cover?{type:'external',external:{url:cover}}:undefined, icon:icon?{type:'emoji',emoji:icon}:undefined})})}
const ULTRON='3ccf2ce0-17b7-8030-89f6-fe3c822bce80'
const DASH='3ccf2ce0-17b7-81b6-903a-d5960e73a8b3'
const FAC='3ccf2ce0-17b7-817f-8542-ed0649a72b40'
await setMeta(ULTRON,'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1500','🧠')
await setMeta(DASH,'https://images.unsplash.com/photo-1451187580459-43490279c429?w=1500','🏠')
await setMeta(FAC,'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1500','🎓')
await deleteChildren(ULTRON); await deleteChildren(DASH); await deleteChildren(FAC)
await addChildren(ULTRON,[
  {type:'heading_1',heading_1:{rich_text:[{text:{content:'Ultron — Segundo Cérebro'},annotations:{bold:true}}]}},
  {type:'paragraph',paragraph:{rich_text:[{text:{content:'Seu sistema operacional acadêmico • Vault + SIGAA + Notion + Telegram • Sync 07:00'},annotations:{italic:true,color:'gray'}}]}},
  {type:'divider',divider:{}},
  {type:'callout',callout:{rich_text:[{text:{content:'🚀 Bem-vindo ao cockpit. Tudo que importa em um lugar só.'}}],icon:{type:'emoji',emoji:'✨'},color:'blue_background'}},
  {type:'callout',callout:{rich_text:[{text:{content:'📚 10 Matérias ativas • 2026.2 IFFAR • 684h'}},{text:{content:'\nVeja Faculdade abaixo'}}],icon:{type:'emoji',emoji:'🎓'},color:'blue_background'}},
  {type:'callout',callout:{rich_text:[{text:{content:'⏰ 4 Prazos pendentes • próximo 02/09'}},{text:{content:'\nMinhas tarefas → Calendar'}}],icon:{type:'emoji',emoji:'🔥'},color:'red_background'}},
  {type:'callout',callout:{rich_text:[{text:{content:'📎 85 PDFs • Materiais SIGAA'}},{text:{content:'\nFiltre por Matéria / Módulo'}}],icon:{type:'emoji',emoji:'📦'},color:'green_background'}},
  {type:'divider',divider:{}},
  {type:'heading_2',heading_2:{rich_text:[{text:{content:'🧭 Navegação rápida'}}]}},
  {type:'paragraph',paragraph:{rich_text:[{text:{content:'👉 Dashboard  •  📚 Faculdade  •  ✅ Minhas tarefas  •  📎 Materiais SIGAA'}}]}},
  {type:'quote',quote:{rich_text:[{text:{content:'"Organização é liberdade." — Ultron'}}]}},
  {type:'paragraph',paragraph:{rich_text:[{text:{content:'🔗 Hub: http://localhost:3777  •  Vault: cerebro/02-areas/faculdade/'}}]}}
])
await addChildren(DASH,[
  {type:'heading_1',heading_1:{rich_text:[{text:{content:'Dashboard — Segundo Cérebro'},annotations:{bold:true}}]}},
  {type:'callout',callout:{rich_text:[{text:{content:'⚡ Sync SIGAA → Notion → Vault → Telegram • Próximo 07:00'}}],icon:{type:'emoji',emoji:'🔄'},color:'purple_background'}},
  {type:'divider',divider:{}},
  {type:'heading_2',heading_2:{rich_text:[{text:{content:'📊 Carga por matéria'}}]}},
  {type:'image',image:{type:'external',external:{url:'https://quickchart.io/chart?c={type:%27bar%27,data:{labels:[%27BD%27,%27Calculo%27,%27Alg%27,%27Logica%27,%27Discreta%27,%27Ingles%27],datasets:[{label:%27CH%27,data:[60,80,60,60,60,40],backgroundColor:%27%23667eea%27}]}&w=600&h=280&bkg=white'}}},
  {type:'callout',callout:{rich_text:[{text:{content:'🎯 CÁLCULO I 04/09 é o mais urgente! Priorize.'}}],icon:{type:'emoji',emoji:'🔥'},color:'yellow_background'}},
  {type:'heading_2',heading_2:{rich_text:[{text:{content:'⏰ Prazos críticos'}}]}},
  {type:'to_do',to_do:{rich_text:[{text:{content:'BANCO DE DADOS I — Modelagem  •  02/09'}}],checked:false}},
  {type:'to_do',to_do:{rich_text:[{text:{content:'CÁLCULO I — 1ª Avaliação  •  04/09 🔴'}}],checked:false}},
  {type:'to_do',to_do:{rich_text:[{text:{content:'METODOLOGIA — Projeto Extensão  •  12/09'}}],checked:false}},
  {type:'to_do',to_do:{rich_text:[{text:{content:'METODOLOGIA — 1ª Avaliação  •  14/09'}}],checked:false}},
  {type:'heading_2',heading_2:{rich_text:[{text:{content:'📈 Progresso'}}]}},
  {type:'paragraph',paragraph:{rich_text:[{text:{content:'▓▓▓▓░░░░░░ 40%  •  4 pendentes  •  2 concluídas'}}]}},
  {type:'divider',divider:{}},
  {type:'callout',callout:{rich_text:[{text:{content:'✨ Capas Unsplash • Gráfico QuickChart • Cores Notion'}}],icon:{type:'emoji',emoji:'🎨'}}}
])
await addChildren(FAC,[
  {type:'heading_1',heading_1:{rich_text:[{text:{content:'Faculdade — 2026.2'}}]}},
  {type:'paragraph',paragraph:{rich_text:[{text:{content:'10 matérias • clique para abrir • links para Materiais e Tarefas'}}]}},
  {type:'divider',divider:{}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🗄️  BANCO DE DADOS I — 60h • 02/09 Modelagem'}}],children:[{type:'paragraph',paragraph:{rich_text:[{text:{content:'Pasta: BANCO DE DADOS I/ • Filtre Materiais por BANCO DE DADOS I'}}]}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🧮  CÁLCULO I — 80h • 04/09 Avaliação 🔴'}}],children:[{type:'paragraph',paragraph:{rich_text:[{text:{content:'Mais urgente!'}}]}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🗣️  INGLÊS TÉCNICO'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🌱  METODOLOGIA — 2 prazos (12/09 e 14/09)'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'📐  TÓPICOS ÁLGEBRA'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'💻  ALGORITMOS'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🔧  FUNDAMENTOS'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'✍️  LEITURA'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🧠  LÓGICA'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🔢  DISCRETA'}}]}},
  {type:'divider',divider:{}},
  {type:'callout',callout:{rich_text:[{text:{content:'🔍 Dica: use filtros linkados para ver só os PDFs/tarefas da matéria.'}}],icon:{type:'emoji',emoji:'💡'},color:'gray_background'}},
  {type:'image',image:{type:'external',external:{url:'https://images.unsplash.com/photo-1434030216411-0b793f4b417d?w=900'}}}
])
console.log('DONE v2b')
