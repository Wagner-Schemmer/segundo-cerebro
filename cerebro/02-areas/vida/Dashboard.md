# 🌱 Dashboard Vida

## Notas recentes
```dataview
LIST
FROM "02-areas/vida"
SORT file.day DESC
LIMIT 15
```

## Tarefas pendentes
```dataview
TASK
FROM "02-areas/vida"
WHERE !completed
```
