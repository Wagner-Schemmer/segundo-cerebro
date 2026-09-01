import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname=path.dirname(fileURLToPath(import.meta.url))
const FILA=path.join(__dirname,'fila-envio')
import { listarTarefas } from './tarefas.js'
const pendentes=listarTarefas()
if(!pendentes.length){
  console.log('sem tarefas')
  process.exit(0)
}
const fmt=t=>{ if(!t.prazo) return 'sem prazo'; const d=new Date(t.prazo); return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
let msg='⏰ *Bom dia! Tarefas pendentes ('+pendentes.length+')*\n\n'
for(const t of pendentes.slice(0,12)){
  msg+=`• #${t.id} ${t.texto} — ${fmt(t)}\n`
}
if(pendentes.length>12) msg+=`\n…e mais ${pendentes.length-12}`
msg+='\n\nUse /tarefas e /feito <n>'
// usa fila do gateway (telegram)
fs.mkdirSync(FILA,{recursive:true})
for(const para of ['telegram','grupo']){
  const pref = para==='telegram' ? 'sigaa-telegram' : 'sigaa-grupo'
  fs.writeFileSync(path.join(FILA,`${pref}-tarefas-${Date.now()}-${Math.random().toString(36).slice(2,4)}.json`), JSON.stringify({para,texto:msg}))
}
console.log('enfileirado',pendentes.length)
