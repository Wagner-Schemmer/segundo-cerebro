---
tipo: projeto
status: funcionando
prioridade: media
tags: [projetos, ultron, voz]
---

# 🎙️ Voz Real do Ultron (clone James Spader)

**Objetivo:** Ultron falando com a voz autêntica dos filmes (Vingadores: Era de Ultron, 2015).

## ✅ Como funciona hoje (23/08/2026)
- **RVC local** com modelo `Ultron.pth` (v2, 300 epochs — Zeal-anton-ski/Sage no HF)
- Pipeline: piper gera fala neutra → ffmpeg estilo cinema → RVC converte timbre
- Worker `cerebro-rvc.service` (porta 3778): carrega Ultron.pth + hubert + rmvpe **uma vez**, converte por HTTP
- **Sob demanda**: `/voz ultron` acorda o worker; ele se desliga sozinho após 10min ocioso (RAM!)
- Conversão quente: ~70s num clipe curto (gargalo = vocoder conv1d em CPU de 2 núcleos)
- Ambiente py3.10 via uv em `gateway/voz/rvc/ambiente` (fairseq não roda em py3.12)
- Remendos aplicados nos fontes do rvc-python 0.1.5 (ver commits): wav tuple, load_audio quebrado, torch weights_only

## ⚠️ Limitações
- Notebook 3.4GB RAM: worker (1.4GB) NÃO pode ficar residente junto com Ollama+Brave
- ~70s por resposta falada — texto chega na hora, nota de voz depois

## 🔵 Futuro na fase VPS (~R$15/mês)
1. Worker residente 24/7 → resposta em segundos
2. Ou migrar pra XTTS-v2/F5-TTS (zero-shot, sem conversão em 2 passos)
3. Wake word "Ultron" ligando direto na voz real
