// ============================================================
// 📥 SIGAA MATERIAL DOWNLOADER — Script para Console do Navegador
// Cole no console (F12) dentro de uma Turma Virtual do SIGAA
// Baixa todos os materiais da aba "Material de Apoio"
// ============================================================

(async function baixarTodosMateriais() {
  console.log('🚀 Iniciando download de materiais...');
  
  // 1. Encontra a aba "Material de Apoio" e clica
  const tabs = document.querySelectorAll('.rich-tabpanel .rich-tab, .rich-tabpanel-header .rich-tab, .rich-tab-header');
  let materialTab = null;
  
  for (const tab of tabs) {
    const text = tab.textContent.trim().toLowerCase();
    if (text.includes('material') || text.includes('apoio') || text.includes('slide') || text.includes('arquivo')) {
      materialTab = tab;
      console.log('📑 Aba encontrada:', tab.textContent.trim());
      break;
    }
  }
  
  if (!materialTab) {
    console.log('⚠️ Aba "Material de Apoio" não encontrada. Tentando seletor alternativo...');
    // Tenta achar por rich:tabPanel
    const tabPanel = document.querySelector('.rich-tabpanel, .rich-tabpanel-content');
    if (tabPanel) {
      const tabs2 = tabPanel.querySelectorAll('.rich-tab, [onclick*="switchTab"], [onclick*="tab"]');
      for (const t of tabs2) {
        if (t.textContent.toLowerCase().includes('material') || t.textContent.toLowerCase().includes('apoio')) {
          materialTab = t;
          break;
        }
      }
    }
  }
  
  if (materialTab) {
    console.log('🖱️ Clicando na aba...');
    materialTab.click();
    await new Promise(r => setTimeout(r, 2000)); // espera carregar
  } else {
    console.log('⚠️ Não achou a aba. Tentando carregar material direto via AJAX...');
  }
  
  // 2. Aguarda carregar e procura links de download
  await new Promise(r => setTimeout(r, 3000));
  
  // 3. Coleta todos os links de arquivo na página
  const links = Array.from(document.querySelectorAll('a[href]'))
    .map(a => ({ href: a.href, text: a.textContent.trim() }))
    .filter(l => /\.(pdf|ppt|pptx|doc|docx|xls|xlsx|zip|rar|odt|odp|ods|txt|md|jpg|png|mp4|mp3|avi|mov|webm)$/i.test(l.href) ||
                 /material|slide|apostila|aula|download|anexo|arquivo/i.test(l.text));
  
  console.log(`📎 ${links.length} arquivo(s) encontrado(s):`);
  links.forEach((l, i) => console.log(`  ${i+1}. ${l.text.slice(0,60)} → ${l.href}`));
  
  if (links.length === 0) {
    console.log('⚠️ Nenhum link de arquivo visível. Tentando buscar em iframes/frames...');
    const frames = document.querySelectorAll('iframe, frame');
    for (const frame of frames) {
      try {
        const doc = frame.contentDocument || frame.contentWindow.document;
        const links2 = Array.from(doc.querySelectorAll('a[href]'))
          .map(a => ({ href: a.href, text: a.textContent.trim() }))
          .filter(l => /\.(pdf|ppt|pptx|doc|docx|xls|xlsx|zip|rar|odt|odp|ods|txt|md|jpg|png|mp4|mp3|avi|mov|webm)$/i.test(l.href));
        console.log(`  Iframe "${frame.name || frame.id}": ${links2.length} links`);
        links.push(...links2);
      } catch (e) { console.log('  Iframe inacessível:', e.message); }
    }
  }
  
  if (links.length === 0) {
    console.log('❌ Nenhum arquivo encontrado. Verifique se a aba "Material de Apoio" está carregada.');
    return;
  }
  
  // 4. Baixa cada arquivo
  console.log('\n⬇️ Iniciando downloads...');
  for (let i = 0; i < links.length; i++) {
    const { href, text } = links[i];
    try {
      console.log(`  ${i+1}/${links.length} ⬇️ ${text.slice(0,50)}...`);
      const response = await fetch(href, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = text.replace(/[\\/:*?"<>|]/g, '-').slice(0, 100) || `arquivo-${i}`;
      a.click();
      URL.revokeObjectURL(url);
      await new Promise(r => setTimeout(r, 500)); // pausa entre downloads
    } catch (e) {
      console.error(`  ❌ Falhou: ${text} - ${e.message}`);
    }
  }
  
  console.log('\n✅ Downloads concluídos! Verifique sua pasta de downloads.');
})();

// ============================================================
// Como usar:
// 1. Abra o SIGAA no navegador e entre na Turma Virtual desejada
// 2. Abra o DevTools (F12) → aba Console
// 2. Cole este código e aperte Enter
// 3. O script vai tentar clicar na aba "Material de Apoio" e baixar tudo
// ============================================================