import fs from 'fs'
const TOKEN='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'
const H={'Authorization':`Bearer ${TOKEN}`,'Notion-Version':'2022-06-28','Content-Type':'application/json'}
async function api(p,opts){ const r=await fetch(`https://api.notion.com/v1${p}`,{...opts,headers:H}); const j=await r.json(); if(!r.ok) throw new Error(JSON.stringify(j).slice(0,900)); return j }
const ULTRON='3ccf2ce0-17b7-8030-89f6-fe3c822bce80'
async function create(title,cover,icon,children){
  return api('/pages',{method:'POST',body:JSON.stringify({parent:{page_id:ULTRON},cover:{type:'external',external:{url:cover}},icon:{type:'emoji',emoji:icon},properties:{title:{title:[{text:{content:title}}]}},children})})
}
console.log('Criando Dashboard PRO...')
const dash=await create('🏠 Dashboard PRO','https://images.unsplash.com/photo-1451187580459-43490279c429?w=1500','🏠',[
  {type:'callout',callout:{rich_text:[{text:{content:'⚡ Sync SIGAA → Notion → Vault → Telegram • Ciclo 07:00 • Tudo vivo'}}],icon:{type:'emoji',emoji:'🔄'},color:'purple_background'}},
  {type:'divider',divider:{}},
  {type:'heading_2',heading_2:{rich_text:[{text:{content:'📊 Carga por matéria'}}]}},
  {type:'image',image:{type:'external',external:{url:'https://quickchart.io/chart?c={type:%27bar%27,data:{labels:[%27BD%27,%27Calculo%27,%27Alg%27,%27Logica%27,%27Discreta%27,%27Ingles%27],datasets:[{label:%27CH%27,data:[60,80,60,60,60,40],backgroundColor:%27%23667eea%27}]}&w=700&h=300&bkg=white'}}},
  {type:'callout',callout:{rich_text:[{text:{content:'🎯 CÁLCULO 04/09 é o mais urgente! Priorize esta semana.'}}],icon:{type:'emoji',emoji:'🔥'},color:'yellow_background'}},
  {type:'heading_2',heading_2:{rich_text:[{text:{content:'⏰ Prazos críticos (14 dias)'}}]}},
  {type:'to_do',to_do:{rich_text:[{text:{content:'BANCO DE DADOS I — Modelagem  •  02/09'}}],checked:false}},
  {type:'to_do',to_do:{rich_text:[{text:{content:'CÁLCULO I — 1ª Avaliação  •  04/09 🔴 URGENTE'}}],checked:false}},
  {type:'to_do',to_do:{rich_text:[{text:{content:'METODOLOGIA — Projeto Extensão  •  12/09'}}],checked:false}},
  {type:'to_do',to_do:{rich_text:[{text:{content:'METODOLOGIA — 1ª Avaliação  •  14/09'}}],checked:false}},
  {type:'heading_2',heading_2:{rich_text:[{text:{content:'📈 Progresso geral'}}]}},
  {type:'paragraph',paragraph:{rich_text:[{text:{content:'▓▓▓▓░░░░░░ 40%  •  4 pendentes  •  85 PDFs  •  10 matérias'}}]}},
])
console.log('dash',dash.id)
console.log('Criando Faculdade PRO...')
const fac=await create('📚 Faculdade PRO','https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1500','🎓',[
  {type:'heading_2',heading_2:{rich_text:[{text:{content:'10 matérias • 2026.2'}}]}},
  {type:'paragraph',paragraph:{rich_text:[{text:{content:'Cada toggle abre detalhes • Links para Materiais e Tarefas'}}]}},
  {type:'divider',divider:{}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🗄️  BANCO DE DADOS I — 60h • 02/09 🔥'}}],children:[{type:'paragraph',paragraph:{rich_text:[{text:{content:'Vault: BANCO DE DADOS I/ • Filtro Materiais = BANCO DE DADOS I'}}]}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🧮  CÁLCULO I — 80h • 04/09 🔴 MAIS URGENTE'}}],children:[{type:'paragraph',paragraph:{rich_text:[{text:{content:'Avaliação dia 04/09!'}}]}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🗣️  INGLÊS TÉCNICO — 40h'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🌱  METODOLOGIA — 2 prazos'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'📐  TÓPICOS ÁLGEBRA'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'💻  ALGORITMOS'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🔧  FUNDAMENTOS'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'✍️  LEITURA'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🧠  LÓGICA'}}]}},
  {type:'toggle',toggle:{rich_text:[{text:{content:'🔢  DISCRETA'}}]}},
  {type:'divider',divider:{}},
  {type:'callout',callout:{rich_text:[{text:{content:'💡 Dica: use filtros em Materiais SIGAA e Minhas tarefas para ver só a matéria.'}}],icon:{type:'emoji',emoji:'🔍'},color:'gray_background'}},
  {type:'image',image:{type:'external',external:{url:'https://images.unsplash.com/photo-1434030216411-0b793f4b417d?w=900'}}}
])
console.log('fac',fac.id)
await api(`/pages/${ULTRON}`,{method:'PATCH',body:JSON.stringify({icon:{type:'emoji',emoji:'🧠'},cover:{type:'external',external:{url:'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1500'}}})})
await api(`/blocks/${ULTRON}/children`,{method:'PATCH',body:JSON.stringify({children:[
  {type:'callout',callout:{rich_text:[{text:{content:'🚀 Novo layout PRO criado! Veja Dashboard PRO e Faculdade PRO abaixo. Antigos foram para lixeira.'}}],icon:{type:'emoji',emoji:'✨'},color:'blue_background'}},
  {type:'callout',callout:{rich_text:[{text:{content:'📚 10 matérias • ⏰ 4 prazos • 📎 85 PDFs'}}],icon:{type:'emoji',emoji:'🎓'},color:'green_background'}},
  {type:'image',image:{type:'external',external:{url:'https://quickchart.io/chart?c={type:%27doughnut%27,data:{labels:[%27Pendentes%27,%27Concluidas%27],datasets:[{data:[4,2],backgroundColor:[%27%23ff6b6b%27,%27%2351cf66%27]}]}&w=400&h=220&bkg=white'}}}
]})}).catch(e=>console.log('ultron add',e.message))
console.log('DONE v3')
