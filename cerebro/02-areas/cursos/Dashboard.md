# 📚 Dashboard Cursos

## Cursos e módulos
```dataview
LIST
FROM "02-areas/cursos"
SORT file.day DESC
```

## Tarefas pendentes
```dataview
TASK
FROM "02-areas/cursos"
WHERE !completed
```
