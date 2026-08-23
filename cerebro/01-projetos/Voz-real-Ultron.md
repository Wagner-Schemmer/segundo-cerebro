---
tipo: projeto
status: aguardando-vps
prioridade: media
tags: [projetos, ultron, voz]
---

# 🎙️ Voz Real do Ultron (clone James Spader)

**Objetivo:** Ultron falando com a voz autêntica dos filmes (Vingadores: Era de Ultron, 2015).

## Por que está pausado
Clonagem de voz com XTTS-v2 / F5-TTS precisa de ~2–3GB de RAM só de inferência.
O notebook do Wagner tem 3,4GB total — não cabe junto com bots + Ollama.

## Plano na fase VPS (~R$15/mês, 4–8GB RAM)
1. Subir XTTS-v2 via Docker (já temos docker-compose.yml preparado)
2. Coletar amostras limpas da voz (6s+ bastam; ideal 2–5min de fala do personagem)
3. Endpoint local: POST texto → WAV clonado
4. Trocar o piper do `gateway/voz.js` por chamada HTTP ao clonador

## Enquanto isso
Ultron usa **piper pt_BR-faber-medium** (voz masculina local, ~0 RAM).
Efeito "estilo filme" testável com ffmpeg (pitch −18% + eco metálico).
