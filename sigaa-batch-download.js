// ============================================================
// 📥 SIGAA BATCH DOWNLOADER — Baixa TODAS as matérias de uma vez
// Cole no console (F12) no Portal do Discente (página com a lista de turmas)
// ============================================================

(async function baixarTodasMateriais() {
  console.log('🚀 SIGAA BATCH DOWNLOADER iniciado!');
  console.log('⚠️ IMPORTANTE: Execute na página "Todas as Turmas" (turmas.jsf)');
  
  // 1. Pega todos os IDs das turmas da tabela
  const linhas = document.querySelectorAll('table.listagem tbody tr');
  const turmas = [];
  
  for (const tr of linhas) {
    const onclick = tr.querySelector('a[onclick*="jsfcljs"]');
    if (!onclick) continue;
    
    const match = onclick.onclick.toString().match(/frontEndIdTurma['"]:\s*'([A-F0-9]+)'/i);
    const nomeTd = tr.querySelector('td');
    const nome = nomeTd ? nomeTd.textContent.trim() : 'Desconhecida';
    
    if (match) {
      turmas.push({ id: match[1], nome: nome.split('\n')[0].trim() });
    }
  }
  
  console.log(`📚 ${turmas.length} turmas encontradas:`);
  turmas.forEach((t, i) => console.log(`  ${i+1}. ${t.nome} (${t.id.slice(0,12)}...)`));
  
  if (turmas.length === 0) {
    console.log('❌ Nenhuma turma encontrada. Execute na página turmas.jsf');
    return;
  }
  
  // Confirma
  if (!confirm(`Baixar materiais de ${turmas.length} turmas? Isso vai abrir cada turma e baixar os arquivos.`)) {
    console.log('Cancelado pelo usuário');
    return;
  }
  
  let totalArquivos = 0;
  
  for (let i = 0; i < turmas.length; i++) {
    const turma = turmas[i];
    console.log(`\n📂 [${i+1}/${turmas.length}] ${turma.nome}...`);
    
    try {
      // Abre a turma virtual
      const url = `https://sig.iffarroupilha.edu.br/sigaa/portais/discente/turmaVirtual.jsf?frontEndIdTurma=${turma.id}`;
      const novaAba = window.open(url, '_blank');
      
      // Espera carregar
      await new Promise(r => setTimeout(r, 3000));
      
      // Tenta clicar na aba Material de Apoio
      await clicarAbaMaterial(novaAba);
      
      // Aguarda carregar
      await new Promise(r => setTimeout(r, 3000));
      
      // Baixa arquivos
      const baixados = await baixarArquivosDaAba(novaAba, turma.nome);
      totalArquivos += baixados;
      
      // Fecha aba
      novaAba.close();
      
      // Pausa entre turmas
      await new Promise(r => setTimeout(r, 2000));
      
    } catch (e) {
      console.error(`❌ Erro em ${turma.nome}:`, e.message);
    }
  }
  
  console.log(`\n🎉 CONCLUÍDO! Total: ${totalArquivos} arquivo(s) baixado(s)`);
  console.log('📁 Verifique sua pasta de Downloads');
  
  // ===== FUNÇÕES AUXILIARES =====
  
  async function clicarAbaMaterial(aba) {
    try {
      const doc = aba.document;
      
      // Tenta seletores comuns para a aba Material de Apoio
      const seletores = [
        '.rich-tab:contains("Material")',
        '.rich-tab:contains("Apoio")',
        '.rich-tab-header:contains("Material")',
        '.rich-tab-header:contains("Apoio")',
        '[onclick*="switchTab"]:contains("Material")',
        '[onclick*="switchTab"]:contains("Apoio")',
        '.rich-tabpanel-header .rich-tab:contains("Material")',
        '.rich-tabpanel-header .rich-tab:contains("Apoio")',
        'a:contains("Material de Apoio")',
        'a:contains("Material de apoio")'
      ];
      
      for (const sel of seletores) {
        try {
          const el = aba.document.querySelector(sel);
          if (el) {
            el.click();
            console.log('  🖱️ Clicou na aba Material de Apoio');
            return true;
          }
        } catch {}
      }
      
      // Tenta por texto
      const tabs = aba.document.querySelectorAll('.rich-tab, .rich-tab-header, .rich-tabpanel-header .rich-tab, [onclick*="switchTab"]');
      for (const tab of tabs) {
        const txt = tab.textContent.toLowerCase();
        if (txt.includes('material') || txt.includes('apoio')) {
          tab.click();
          console.log('  🖱️ Clicou na aba (por texto)');
          return true;
        }
      }
      
      console.log('  ⚠️ Aba Material não encontrada automaticamente');
      return false;
    } catch (e) {
      console.log('  ⚠️ Erro ao clicar aba:', e.message);
    }
  }
  
  async function baixarArquivosDaAba(aba, nomeTurma) {
    try {
      const doc = aba.document;
      
      // Espera um pouco mais para carregar conteúdo dinâmico
      await new Promise(r => setTimeout(r, 2000));
      
      // Coleta links
      const links = Array.from(doc.querySelectorAll('a[href]'))
        .map(a => ({ href: a.href, text: a.textContent.trim() }))
        .filter(l => l.href && l.text && (
          /\.(pdf|ppt|pptx|doc|docx|xls|xlsx|zip|rar|odt|odp|ods|txt|md|jpg|png|mp4|mp3|avi|mov|webm)$/i.test(l.href) ||
          /material|slide|apostila|aula|download|anexo|arquivo|slide/i.test(l.text)
        ));
      
      // Remove duplicatas
      const unicos = [];
      const vistos = new Set();
      for (const l of links) {
        if (!vistos.has(l.href)) { vistos.add(l.href); unicos.push(l); }
      }
      
      if (unicos.length === 0) {
        console.log(`  (nenhum arquivo encontrado)`);
        return 0;
      }
      
      console.log(`  📎 ${unicos.length} arquivo(s) encontrado(s):`);
      unicos.forEach((l, i) => console.log(`    ${i+1}. ${l.text.slice(0,60)}`));
      
      // Baixa
      let baixados = 0;
      for (const link of unicos) {
        try {
          const response = await fetch(link.href, { credentials: 'include' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const nomeArquivo = (link.text || `arquivo-${Date.now()}`).replace(/[\\/:*?"<>|]/g, '-').slice(0, 100);
          a.download = `${nomeArquivo}.${link.href.split('.').pop().split('?')[0]}`;
          a.href = URL.createObjectURL(blob);
          a.click();
          URL.revokeObjectURL(a.href);
          baixados++;
          await new Promise(r => setTimeout(r, 300));
        } catch (e) {
          console.error(`  ❌ Falhou:`, e.message);
        }
      }
      
      return baixados;
    } catch (e) {
      console.error(`  ❌ Erro ao baixar:`, e.message);
      return 0;
    }
  }
})();

// ===== COMO USAR =====
// 1. Vá no SIGAA → Portal do Discente → "Todas as Turmas" (turmas.jsf)
// 2. F12 → Console → Cole este código → Enter
// 3. Confirme no popup
// 4. Ele abre cada turma, clica em Material de Apoio, baixa tudo
// ============================================================
