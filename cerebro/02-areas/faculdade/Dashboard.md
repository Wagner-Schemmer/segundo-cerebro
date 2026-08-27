---
materia: Dashboard Faculdade
tipo: dashboard
tags: [faculdade, dashboard, visão-geral]
---

# 🎓 Dashboard — Faculdade (2026.2)

> **Semestre atual:** 2026.2 | **Total:** 10 matérias | **684h** | **IFFAR**

---

## 📊 Visão Geral Rápida

```dataview
TABLE WITHOUT ID
  link(file.link, materia) AS "Matéria",
  codigo AS "Código",
  ch AS "CH",
  turma AS "Turma",
  "🟢" AS "Status"
FROM "02-areas/faculdade"
WHERE file.name != "Dashboard.md" AND file.name != "Índice.md" AND file.name != "Faculdade.md"
SORT ch DESC
```

---

## 📅 Próximos Prazos (Próximos 14 dias)

```dataview
TABLE WITHOUT ID
  link(file.link, "⏰ " + file.name) AS "Tarefa",
  prazo AS "Prazo",
  status AS "Status"
FROM "02-areas/faculdade"
WHERE prazo AND date(prazo) <= date(today) + dur(14 days)
SORT prazo ASC
```

---

## 📚 Progresso por Matéria

```dataview
TABLE WITHOUT ID
  link(file.link, materia) AS "Matéria",
  ch AS "CH",
  "<progress value='" + (length(filter(tarefas, (t) => t.status = "✅")) / length(tarefas) * 100) + "' max='100'></progress>" AS "Progresso",
  length(filter(tarefas, (t) => t.status = "✅")) + "/" + length(tarefas) AS "Concluídas"
FROM "02-areas/faculdade"
WHERE file.name != "Dashboard.md" AND file.name != "Índice.md" AND file.name != "Faculdade.md"
SORT ch DESC
```

---

## 📥 Últimos Materiais Adicionados

```dataview
TABLE WITHOUT ID
  file.link AS "Arquivo",
  file.folder AS "Matéria",
  file.mtime AS "Adicionado em"
FROM "02-areas/faculdade"
WHERE file.folder AND file.folder != "02-areas/faculdade"
SORT file.mtime DESC
LIMIT 10
```

---

## 🎯 Ações Rápidas

| Ação | Comando Telegram | Link Obsidian |
|------|------------------|---------------|
| Ver todas as tarefas | `/tarefas` | [[Tarefas.md]] |
| Adicionar tarefa | `/tarefa estudar cálculo amanhã 14h` | — |
| Verificar SIGAA | `/sigaa` | — |
| Abrir Brave estudos | `/estudos` | — |
| Salvar página atual | `/salvar` | — |

---

## 📂 Estrutura de Pastas

```
02-areas/faculdade/
├── 📄 Dashboard.md           (este arquivo)
├── 📄 Índice.md              (lista completa)
├── 📄 Faculdade.md           (visão geral)
├── 📂 BANCO DE DADOS I/
│   ├── 📄 BANCO DE DADOS I.md
│   └── 📂 anexos/
├── 📂 CÁLCULO DIFERENCIAL E INTEGRAL I/
│   ├── 📄 CÁLCULO DIFERENCIAL E INTEGRAL I.md
│   └── 📂 anexos/
├── 📂 INGLÊS TÉCNICO/
│   ├── 📄 INGLÊS TÉCNICO.md
│   └── 📂 anexos/
├── 📂 METODOLOGIA EXTENSIONISTA/
│   ├── 📄 METODOLOGIA EXTENSIONISTA.md
│   └── 📂 anexos/
├── 📂 TÓPICOS DE ÁLGEBRA LINEAR E GEOMETRIA ANALÍTICA/
│   ├── 📄 TÓPICOS DE ÁLGEBRA LINEAR E GEOMETRIA ANALÍTICA.md
│   └── 📂 anexos/
├── 📂 ALGORITMOS E PROGRAMAÇÃO/
│   ├── 📄 ALGORITMOS E PROGRAMAÇÃO.md
│   └── 📂 anexos/
├── 📂 FUNDAMENTOS DA COMPUTAÇÃO/
│   ├── 📄 FUNDAMENTOS DA COMPUTAÇÃO.md
│   └── 📂 anexos/
├── 📂 LEITURA E PRODUÇÃO TEXTUAL/
│   ├── 📄 LEITURA E PRODUÇÃO TEXTUAL.md
│   └── 📂 anexos/
├── 📂 LÓGICA MATEMÁTICA/
│   ├── 📄 LÓGICA MATEMÁTICA.md
│   └── 📂 anexos/
├── 📂 MATEMÁTICA DISCRETA/
│   ├── 📄 MATEMÁTICA DISCRETA.md
│   └── 📂 anexos/
└── 📂 Materiais/
    └── 📄 Propriedades dos Determinantes.md
```

---

## 🏷️ Tags
#faculdade #dashboard #semestre-2026.2 #iffar #visão-geral
