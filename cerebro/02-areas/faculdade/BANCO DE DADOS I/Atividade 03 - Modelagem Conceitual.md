# Atividade 03 — Abordagem Relacional — BANCO DE DADOS I

> Prof. Me. Fiorin • IFFAR FW • Entrega 02/09/2026
> 6 estudos de caso — modelagem conceitual (DER) + cardinalidades

## 1) Floricultura
```mermaid
erDiagram
    CLIENTE ||--o{ VENDA : realiza
    VENDA ||--o{ ITEM_VENDA : contém
    PRODUTO ||--o{ ITEM_VENDA : compõe
    CLIENTE { string RG PK "identificador" string nome string telefone string endereco }
    PRODUTO { string nome PK string tipo string preco int estoque }
    VENDA { int id PK date data float valorTotal }
    ITEM_VENDA { int quantidade }
```
**REGRAS:** Cliente(1:N)Venda, Venda(N:M)Produto via Item_Venda com quantidade. RG é PK de Cliente.

## 2) Biblioteca
```mermaid
erDiagram
    LIVRO ||--o{ AUTORIA : tem
    AUTOR ||--o{ AUTORIA : escreve
    CATEGORIA ||--o{ LIVRO : classifica
    LIVRO { string ISBN PK string titulo int ano string editora }
    AUTOR { string nome PK string nacionalidade }
    AUTORIA { string papel }
    CATEGORIA { string codigo PK string descricao }
```
**REGRAS:** Livro(N:M)Autor, Livro(N:1)Categoria. Autoria é tabela associativa M:N.

## 3) Catálogo de CDs
```mermaid
erDiagram
    ARTISTA ||--o{ DISCO : interpreta
    DISCO ||--o{ FAIXA : contém
    MUSICA ||--o{ FAIXA : aparece
    MUSICA ||--o{ COMPOSICAO : tem
    COMPOSITOR ||--o{ COMPOSICAO : cria
    ARTISTA { string nome PK string nacionalidade }
    DISCO { string nome PK int ano string gravadora }
    MUSICA { string titulo PK int duracao date dataComp }
    FAIXA { int numeroFaixa }
    COMPOSITOR { string nome PK date nascimento }
```
**REGRAS:** Disco(N:M)Musica via Faixa (atributo numeroFaixa), Musica(N:M)Compositor (≥1), Disco(N:1)Artista.

## 4) Controle de eventos acadêmicos
```mermaid
erDiagram
    COORDENADOR ||--o{ EVENTO : coordena
    EVENTO ||--o{ PALESTRA : possui
    PALESTRANTE ||--o{ PALESTRA : ministra
    EVENTO ||--o{ INSCRICAO : recebe
    PARTICIPANTE ||--o{ INSCRICAO : faz
    COORDENADOR { string siape PK string nome string email }
    EVENTO { string nome PK date dataInicio date dataFim int capacidade }
    PALESTRANTE { string email PK string nome string cidade date dataPalestra }
    PALESTRA { string titulo }
    PARTICIPANTE { string email PK string nome string matricula string curso }
    INSCRICAO { date dataInscricao }
```
**REGRAS:** Evento(1:N)Palestra, Palestrante(1:N)Palestra, Evento(N:M)Participante via Inscrição, Coordenador(1:N)Evento.

## 5) Sistema de cursos online
```mermaid
erDiagram
    CATEGORIA ||--o{ CURSO : agrupa
    CURSO ||--o{ MINISTRACAO : tem
    PROFESSOR ||--o{ MINISTRACAO : ministra
    CURSO ||--o{ MATRICULA : possui
    ALUNO ||--o{ MATRICULA : faz
    CATEGORIA { string codigo PK string descricao }
    CURSO { string codigo PK string nome string descricao int cargaHoraria float valor }
    PROFESSOR { string codigo PK string nome string email string area }
    ALUNO { string matricula PK string nome string email date nascimento }
    MATRICULA { date dataMatricula string situacao }
    MINISTRACAO { string semestre }
```
**REGRAS:** Curso(N:1)Categoria, Curso(N:M)Professor via Ministração, Curso(N:M)Aluno via Matrícula (com situacao).

## 6) Sistema agência de viagens
```mermaid
erDiagram
    CLIENTE ||--o{ RESERVA : faz
    PACOTE ||--o{ RESERVA : reservado
    PACOTE ||--o{ PACOTE_DESTINO : inclui
    DESTINO ||--o{ PACOTE_DESTINO : compõe
    PACOTE ||--o{ GUIA_PACOTE : acompanha
    GUIA ||--o{ GUIA_PACOTE : guia
    CLIENTE { string codigo PK string nome string cpf string telefone string email }
    PACOTE { string codigo PK string nome string descricao int duracao float valor }
    DESTINO { string codigo PK string nome string cidade string pais }
    RESERVA { string codigo PK date dataReserva int qtdPessoas string situacao }
    GUIA { string codigo PK string nome string telefone string idioma }
```
**REGRAS:** Pacote(N:M)Destino, Pacote(N:M)Guia, Cliente(1:N)Reserva, Reserva(N:1)Pacote.

---
### Como reproduzir no brModelo (5 min por caso)
1. Abra `brModelo.jar` → Arquivo → Novo → Modelo Conceitual
2. Crie entidades (retângulos) com atributos (elipses) — PK sublinhado
3. Ligue com relacionamentos (losangos) e anote cardinalidades (1:N, N:M) como acima
4. Salve como `Atividade03_Floricultura.brM` etc em `Banco de Dados I/anexos/`
> Dica: use o Mermaid acima colado no Obsidian pra visualizar antes de desenhar.

Arquivos salvos em `cerebro/02-areas/faculdade/BANCO DE DADOS I/anexos/` + sincronizados pro Notion Materiais.
