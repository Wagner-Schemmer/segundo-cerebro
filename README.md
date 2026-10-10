# 🧠 Segundo Cérebro — Wagner

![Local](https://img.shields.io/badge/100%25-local-4ade80?style=for-the-badge&logo=homeassistant&logoColor=white)
![Custo](https://img.shields.io/badge/custo-R$0-22c55e?style=for-the-badge&logo=cashapp&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-≤3B-000000?style=flat-square&logo=ollama&logoColor=white)
![Obsidian](https://img.shields.io/badge/Obsidian-vault-7C3AED?style=flat-square&logo=obsidian&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-gateway-339933?style=flat-square&logo=node.js&logoColor=white)

Sistema de IA pessoal **100% local e gratuito**: Telegram + WhatsApp → gateway Node.js → Ollama → base de conhecimento no Obsidian.

## Arquitetura

```
[Telegram]───┐
             ├──> Gateway Node.js (~100 MB) ──> Ollama (modelos ≤ 3B)
[WhatsApp]───┘              │
                            ▼
        cerebro/ (vault Obsidian) ← editado por: VS Code, opencode, agentes
```

## Estrutura

```
cerebro/            ← VAULT DO OBSIDIAN (abrir esta pasta como vault)
  00-inbox/         ← tudo que chega do Telegram/WhatsApp
  01-projetos/      ← com prazo/objetivo
  02-areas/         ← responsabilidade contínua
  03-recursos/      ← referências úteis
  04-arquivo/       ← inativo
gateway/            ← código do bot (Telegram + WhatsApp + Ollama)
workflows/          ← automações futuras
docker-compose.yml  ← reserva p/ quando tiver mais RAM ou um VPS
```

## Como rodar

```bash
# 1. Baixar um modelo (só uma vez)
ollama pull qwen2.5:1.5b

# 2. Configurar
cd gateway
cp .env.example .env   # editar: colar TELEGRAM_BOT_TOKEN

# 3. Instalar e subir Telegram
npm install
npm start

# 4. WhatsApp (depois, quando o Telegram estiver ok)
npm i @whiskeysockets/baileys pino
npm run whatsapp       # escaneia QR code no terminal
```

## Comandos do bot

- texto livre → conversa com a IA (memória por conversa)
- `/nota <texto>` → salva em `00-inbox/` (aparece no Obsidian na hora)
- `/modelo <nome>` → troca de modelo na hora
- `/status` → RAM livre + modelos instalados

## Modelos que cabem na sua RAM (3,4 GB)

| Modelo | RAM em uso | Quando usar |
|---|---|---|
| `qwen2.5:1.5b` | ~1 GB | padrão do dia a dia |
| `gemma2:2b` | ~1,6 GB | alternativa boa em pt-BR |
| `llama3.2:3b` | ~2 GB | melhor qualidade, máquina folgada |

Regras de ouro:
- Um modelo por vez (`OLLAMA_KEEP_ALIVE=5m` descarrega sozinho)
- Modelo grande carregado = feche o navegador pesado
- Hermes/Claude/Gemini "grandes" ficam na lista de desejos p/ quando tiver VPS ou mais RAM
  (OpenRouter tem modelos gratuitos via API se um dia quiser testar sem custo)

## Integrações

- **Obsidian**: abrir pasta `cerebro/` como vault ("Open folder as vault")
- **VS Code**: workspace na pasta `segundo-cerebro/`; extensão do opencode no marketplace
- **opencode** (eu): trabalho direto no vault — organizar inbox, resumir, criar notas, codar o gateway

## Manutenção

```bash
git add -A && git commit -m "cerebro: backup"   # versionar o cérebro
docker compose up -d                             # (futuro) n8n p/ automações pesadas
```
