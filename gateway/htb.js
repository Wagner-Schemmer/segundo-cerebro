// HTB Academy — robo via Brave CDP (login via GitHub, ja logado)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.join(__dirname, '..', 'cerebro', '02-areas', 'cursos', 'htb')
const ESTADO = path.join(__dirname, '.htb-state.json')

async function lerHTBviaBrave(){
  const { listarAbas, lerPagina } = await import('./brave.js')
  const abas = await listarAbas()
  let htb = abas.find(a=>a.url.includes('academy.hackthebox'))
  if(!htb){
    const { abrir } = await import('./brave.js')
    await abrir('https://academy.hackthebox.com/app/dashboard')
    await new Promise(r=>setTimeout(r,6000))
    const abas2 = await listarAbas()
    htb = abas2.find(a=>a.url.includes('academy.hackthebox'))
  } else {
    // navega pro dashboard se nao estiver
    if(!htb.url.includes('/dashboard')){
      const WS=(await import('ws')).default
      const ws=new WS(htb.webSocketDebuggerUrl)
      await new Promise(res=>{
        ws.on('open',()=>ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:"location.href='/app/dashboard'",returnByValue:true}})))
        ws.on('message',()=>{ws.close(); res()})
      })
      await new Promise(r=>setTimeout(r,5000))
    }
  }
  const abas3 = await listarAbas()
  const idx = abas3.findIndex(a=>a.url.includes('academy.hackthebox'))
  const { lerPagina:lp } = await import('./brave.js')
  const p = await lp(idx>=0?idx:abas3.length-1)
  return p.texto
}

export async function checarHTB(){
  const texto = await lerHTBviaBrave()
  // parse simples
  const mProgress = texto.match(/GENERAL\s+([\d.]+)%/)
  const progress = mProgress? parseFloat(mProgress[1]): null
  const completed = [...texto.matchAll(/Intro To Academy\s+Completed/g)].length? ['Intro To Academy'] : []
  // pega todos "Completed"
  const allCompleted = [...texto.matchAll(/([A-Za-z0-9 &\-]+)\s+Completed/g)].map(x=>x[1].trim()).filter(t=>t.length<40)
  const dados = { progress, completed: allCompleted.slice(0,20), raw: texto.slice(0,2000), quando: new Date().toISOString() }
  // salva estado
  fs.mkdirSync(DIR,{recursive:true})
  fs.writeFileSync(path.join(DIR,'progress.json'), JSON.stringify(dados,null,2))
  // cria nota markdown
  const nota = path.join(DIR,'HTB Academy.md')
  let md = `---\n tipo: curso\n plataforma: HTB Academy\n progresso: ${progress}%\n atualizados: ${new Date().toISOString().slice(0,10)}\n---\n\n# 🎯 HTB Academy\n\n## 📊 Progresso\n- **GENERAL:** ${progress}%\n- **OFFENSIVE:** 0% | DEFENSIVE 0% | PURPLE 0%\n\n## ✅ Concluídos\n${allCompleted.map(c=>`- [x] ${c}`).join('\n') || '- (nenhum além de Intro)'}\n\n## 📚 Favoritos / Recomendados\n- Learning Process, Linux Fundamentals, Network Enumeration With Nmap, etc (veja Modules Library)\n\n## 🔗 Links\n- https://academy.hackthebox.com/app/dashboard\n`
  fs.writeFileSync(nota, md)
  // sync notion (fire-and-forget)
  try{
    const { criarMaterial } = await import('./notion.js')
    // cria/atualiza entrada HTB no Materiais com progresso
    // usa criarMaterial como log de progresso
    await criarMaterial({titulo:`HTB Academy — ${progress}% GENERAL`, materia:'HTB Academy', tipo:'Outro', conteudo:`Progresso HTB: GENERAL ${progress}% • Concluídos: ${allCompleted.join(', ').slice(0,800)}`}).catch(()=>{})
  }catch{}
  return dados
}
