# 📂 02 Áreas — Faculdade

> **Semestre:** 2026.2 | **Instituição:** IFFAR | **Total:** 10 matérias | **CH Total:** 684h

---

## 📊 Visão Geral — clique no título da matéria para abrir. Estado editável nas Propriedades do arquivo.

```dataview
TABLE WITHOUT ID
  link(file.link, materia) AS "Matéria",
  codigo AS "Código",
  ch AS "CH",
  choice(estado = "ativo", "🟢 Ativo", "⚪ Inativo") AS "Estado",
  file.folder AS "Pasta"
FROM "02-areas/faculdade"
WHERE tipo = "estudo"
SORT estado DESC, materia ASC
```

---

## 📈 Estatísticas

- **Total de matérias:** 10
- **Carga horária total:** 684h
- **Matérias de 72h:** 7 (Banco de Dados, Cálculo, Álgebra Linear, Fundamentos, Leitura, Lógica, Discreta)
- **Matérias de 36h:** 3 (Inglês Técnico, Metodologia Extensionista)
- **Matéria de 108h:** 1 (Algoritmos e Programação)

---

## 🔗 Acesso Rápido

### Por Tipo
- **Exatas:** Cálculo, Álgebra Linear, Lógica, Discreta
- **Computação:** Banco de Dados, Algoritmos, Fundamentos
- **Humanas:** Inglês Técnico, Leitura e Produção Textual, Metodologia Extensionista
- **Aplicadas:** Fundamentos, Algoritmos, Banco de Dados

### Acessos Diretos
- [Dashboard Faculdade](Dashboard.md)
- [Materiais Compartilhados](Materiais/)
- [Tarefas da Faculdade](../Tarefas.md)

---

## 📋 Próximos Passos

- [ ] Baixar materiais de cada Turma Virtual no SIGAA
- [ ] Preencher cronogramas com datas reais
- [ ] Adicionar professores e contatos
- [ ] Criar notas de aula conforme avançam
- [ ] Vincular materiais de apoio (PDFs, slides) nas pastas `anexos/`

---

## 🏷️ Tags
#faculdade #índice #dashboard #semestre-2026.2 #iffar
