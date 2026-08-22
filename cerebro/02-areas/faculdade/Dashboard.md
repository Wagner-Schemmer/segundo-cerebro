# 🎓 Dashboard Faculdade

## Notas de estudo recentes
```dataview
TABLE materia AS "Matéria", file.day AS "Data"
FROM "02-areas/faculdade"
WHERE tipo = "estudo"
SORT file.day DESC
LIMIT 10
```

## Todas as notas da área
```dataview
LIST
FROM "02-areas/faculdade"
SORT file.day DESC
```

## Tarefas pendentes (trabalhos, provas)
```dataview
TASK
FROM "02-areas/faculdade"
WHERE !completed
```
