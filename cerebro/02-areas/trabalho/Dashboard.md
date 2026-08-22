# 💼 Dashboard Trabalho

## Notas recentes
```dataview
LIST
FROM "02-areas/trabalho"
SORT file.day DESC
LIMIT 15
```

## Tarefas pendentes
```dataview
TASK
FROM "02-areas/trabalho"
WHERE !completed
```
