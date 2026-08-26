// ============================================================
// 🧠 BRAIN MAP — Google Apps Script para Google Sheets
// Cria uma planilha "Mapa do Cérebro" organizada por PARA
// com links obsidian:// que abrem direto no seu vault
// ============================================================

/**
 * CONFIG — ajuste estes valores antes de rodar:
 */
const VAULT_PATH = '/home/wagner/Documentos/segundo-cerebro/cerebro';  // caminho ABSOLUTO do vault no seu notebook
const CSV_FILE_NAME = 'cerebro_mapa.csv';  // nome do CSV no Google Drive (após fazer upload)

// ============================================================
// FUNÇÃO PRINCIPAL — rode esta uma vez
// ============================================================
function criarMapaDoCerebro() {
  // 1. Pega o CSV do Drive
  const files = DriveApp.getFilesByName(CSV_FILE_NAME);
  if (!files.hasNext()) {
    throw new Error(`CSV "${CSV_FILE_NAME}" não encontrado no Drive. Faça upload primeiro.`);
  }
  const csvBlob = files.next().getBlob();
  const csvText = csvBlob.getDataAsString('UTF-8');
  const rows = parseCSV(csvText);

  // 2. Cria/limpa a planilha
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('🧠 Mapa do Cérebro');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('🧠 Mapa do Cérebro');
  
  // 3. Cabeçalho bonito
  const headers = [
    'PARA', 'Ícone', 'Título', 'Pasta', 'Tipo', 'Matéria', 'Tags',
    '🔗 Abrir no Obsidian', 'Caminho Relativo'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1e293b')
    .setFontColor('#e5e7eb')
    .setFontSize(11)
    .setHorizontalAlignment('center');

  // 4. Processa cada linha
  const data = [];
  const paraOrder = ['00-inbox', '01-projetos', '02-areas', '03-recursos', '04-arquivo', '.', 'sistema', '_templates', 'anexos'];
  
  rows.slice(1).forEach(row => {
    const [caminho, titulo, pasta, tipo, materia, tags] = row;
    if (!caminho || caminho.startsWith('.trash')) return; // ignora lixo
    
    const para = detectPARA(pasta);
    const icone = iconeParaTipo(tipo, caminho);
    const linkObsidian = `=HYPERLINK("obsidian://open?vault=SegundoCerebro&file=${encodeURIComponent(caminho.replace(/\.md$/, ''))}", "🔗 Abrir")`;
    
    data.push([
      para,
      icone,
      titulo || '(sem título)',
      pasta,
      tipo || '',
      materia || '',
      tags || '',
      linkObsidian,
      caminho
    ]);
  });

  // 5. Ordena por PARA
  data.sort((a, b) => {
    const ia = paraOrder.indexOf(a[0]);
    const ib = paraOrder.indexOf(b[0]);
    if (ia !== ib) return ia - ib;
    return a[3].localeCompare(b[3]); // depois por pasta
  });

  // 6. Escreve dados
  if (data.length) {
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  }

  // 6. Formatação
  formatSheet(sheet, data.length + 1);

  // 7. Filtros e congelamento
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, data.length + 1, headers.length).createFilter();

  // 8. Ajusta larguras
  sheet.setColumnWidth(1, 100);   // PARA
  sheet.setColumnWidth(2, 40);    // Ícone
  sheet.setColumnWidth(3, 280);   // Título
  sheet.setColumnWidth(4, 220);   // Pasta
  sheet.setColumnWidth(5, 80);    // Tipo
  sheet.setColumnWidth(6, 180);   // Matéria
  sheet.setColumnWidth(7, 150);   // Tags
  sheet.setColumnWidth(8, 110);   // Link
  sheet.setColumnWidth(9, 250);   // Caminho

  SpreadsheetApp.getUi().alert('✅ Mapa do Cérebro criado! Use o filtro na linha 1 para navegar por PARA/Pasta.');
}

/**
 * Helpers
 */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  return lines.map(line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  });
}

function detectPARA(pasta) {
  if (!pasta || pasta === '.') return '📌 Raiz';
  if (pasta.startsWith('00-inbox')) return '📥 00 Inbox';
  if (pasta.startsWith('01-projetos')) return '🚀 01 Projetos';
  if (pasta.startsWith('02-areas')) return '📂 02 Áreas';
  if (pasta.startsWith('03-recursos')) return '📚 03 Recursos';
  if (pasta.startsWith('04-arquivo')) return '📦 04 Arquivo';
  if (pasta.startsWith('sistema')) return '⚙️ Sistema';
  if (pasta.startsWith('_templates')) return '📝 Templates';
  if (pasta.startsWith('anexos')) return '📎 Anexos';
  return '📌 Raiz';
}

function iconeParaTipo(tipo, caminho) {
  if (tipo === 'projeto') return '🚀';
  if (tipo === 'estudo') return '📚';
  if (tipo === 'template') return '📝';
  if (caminho.endsWith('Dashboard.md') || caminho.includes('Dashboard')) return '📊';
  if (caminho.includes('Índice')) return '📋';
  if (caminho.includes('Mapa')) return '🗺️';
  if (caminho.includes('bem-vindo')) return '👋';
  if (caminho.startsWith('anexos/')) return '📎';
  if (caminho.startsWith('sistema/')) return '⚙️';
  return '📄';
}

function formatSheet(sheet, lastRow) {
  // Cores por PARA (coluna A)
  const cores = {
    '📥 00 Inbox': '#fef3c7',
    '🚀 01 Projetos': '#dbeafe',
    '📂 02 Áreas': '#dcfce7',
    '📚 03 Recursos': '#fce7f3',
    '📦 04 Arquivo': '#f3f4f6',
    '⚙️ Sistema': '#e0e7ff',
    '📝 Templates': '#fff7ed',
    '📎 Anexos': '#fef2f2',
    '📌 Raiz': '#fafafa'
  };
  
  const range = sheet.getRange(2, 1, lastRow - 1, 1);
  const bgColors = [];
  for (let i = 2; i <= lastRow; i++) {
    const para = sheet.getRange(i, 1).getValue();
    bgColors.push([cores[para] || '#ffffff']);
  }
  range.setBackgrounds(bgColors);

  // Fonte monoespaçada no caminho
  sheet.getRange(2, 9, lastRow - 1, 1).setFontFamily('Consolas,Monospace').setFontSize(9);

  // Alinhamento central nas colunas pequenas
  sheet.getRange(2, 1, lastRow - 1, 2).setHorizontalAlignment('center');
  sheet.getRange(2, 5, lastRow - 1, 1).setHorizontalAlignment('center');
  sheet.getRange(2, 8, lastRow - 1, 1).setHorizontalAlignment('center');
}

// ============================================================
// MENU PERSONALIZADO (aparece na barra do Sheets)
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🧠 Cérebro')
    .addItem('Criar/Atualizar Mapa', 'criarMapaDoCerebro')
    .addSeparator()
    .addItem('Abrir no Obsidian (linha selecionada)', 'abrirSelecionadoNoObsidian')
    .addToUi();
}

function abrirSelecionadoNoObsidian() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveRange().getRow();
  if (row < 2) return;
  const caminho = sheet.getRange(row, 9).getValue();
  if (!caminho) return;
  const url = `obsidian://open?vault=SegundoCerebro&file=${encodeURIComponent(caminho.replace(/\.md$/, ''))}`;
  // Não podemos abrir direto do Apps Script, mas copiamos pro clipboard via HTML trick
  const html = `<script>navigator.clipboard.writeText('${url}');google.script.host.close();</script>`;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html), 'Copiando link...');
}

// ============================================================
// COMO USAR (passo a passo):
// 1. Abra Google Sheets → Novo → Extensões → Apps Script
// 2. Cole este código todo → Salve (Ctrl+S)
// 2. Faça upload do cerebro_mapa.csv pro Google Drive (mesma pasta do Sheets ou raiz)
// 3. Volte no Sheets → Menu "🧠 Cérebro" → "Criar/Atualizar Mapa"
// 4. Pronto! Filtra pela coluna A (PARA) e clica em "🔗 Abrir" pra abrir no Obsidian
// ============================================================