# 🏠 Dashboard

> Abra este arquivo todo dia. Requer o plugin **Dataview** ativado.

## 📥 Inbox (últimas 10 notas pra organizar)
```dataview
TABLE WITHOUT ID file.link AS "Nota", file.day AS "Data"
FROM "00-inbox"
SORT file.day DESC
LIMIT 10
```

## 🚀 Projetos ativos
```dataview
TABLE status AS "Status", prazo AS "Prazo"
FROM "01-projetos"
WHERE status = "ativo"
```

## ✅ Tarefas pendentes em todo o cérebro
```dataview
TASK
WHERE !completed
GROUP BY file.link
LIMIT 20
```

## 🎓 Notas de estudo recentes
```dataview
TABLE materia AS "Matéria", file.day AS "Estudado em"
FROM "02-areas/faculdade"
WHERE tipo = "estudo"
SORT file.day DESC
LIMIT 5
```

## 🔗 Atalhos
- [[🗺️ Mapa do Cérebro|Mapa visual]]
- [[00-inbox/2026-08-20-bem-vindo|Como usar o cérebro]]
