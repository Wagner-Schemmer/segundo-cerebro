# 📥 00 Inbox — Índice

Entrada bruta → processar → mover para área/projeto/recurso.

## 📋 Pendentes de organizar
```dataview
TABLE WITHOUT ID file.link AS "Nota", file.day AS "Data"
FROM "00-inbox"
WHERE file.name != "Índice"
SORT file.day DESC
```

## 🎯 Como processar
1. Abra a nota
2. Decida: **Projeto** (01) | **Área** (02) | **Recurso** (03) | **Arquivo** (04) | **Lixo**
3. Mova para a pasta certa
4. Adicione links para notas relacionadas
5. Delete daqui

---
> Dica: use `criar pasta` / `criar nota` direto no Telegram pra criar o destino rápido.
