# Wake word "Ultron": fica ouvindo o microfone e, quando ouve o nome,
# apita, grava o comando e passa pro cérebro (comando-voz.mjs).
# RAM ~60MB — leve o bastante pra ficar sempre ligado.

import json
import os
import subprocess
import sys
import time

from vosk import Model, KaldiRecognizer

DIR = os.path.dirname(os.path.abspath(__file__))
MODELO = os.path.join(DIR, 'vosk-model-small-pt-0.3')
COMANDO_NODE = os.path.join(DIR, '..', 'comando-voz.mjs')
BEEP = os.path.join(DIR, '..', 'voz', 'beep.wav')
# o vosk pequeno ouve "Ultron" como estas variações
VARIANTES = {'ultron', 'outro', 'outron', 'oltron', 'uutron', 'rultro'}
COOLDOWN = 8          # segundos entre um disparo e o próximo
MAX_GRAVACAO = 9      # limite do comando falado
SILÊNCIO_CORTE = 1.6  # encerra a gravação após tanto silêncio
RMS_SILENCIO = 450    # limiar de "ninguém falando"


def eh_wake(parcial: str) -> bool:
    """Nome no comecinho da frase = chamada de verdade."""
    palavras = parcial.lower().replace(',', ' ').split()
    return any(v in palavras[:3] for v in VARIANTES)

ocupado_ate = [0]


def log(txt):
    print(f'[wake {time.strftime("%H:%M:%S")}] {txt}', flush=True)


def rms(dados: bytes) -> int:
    total = amostras = 0
    for i in range(0, len(dados) - 1, 2):
        total += abs(int.from_bytes(dados[i:i + 2], 'little', signed=True))
        amostras += 1
    return total // max(amostras, 1)


def gravar_comando() -> str | None:
    """Grava até o silêncio ou o limite. Retorna caminho do wav."""
    proc = subprocess.Popen(
        ['ffmpeg', '-loglevel', 'error', '-f', 'pulse', '-i', 'default',
         '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1'],
        stdout=subprocess.PIPE,
    )
    saida = '/tmp/opencode/comando-ultron.wav'
    bruto = b''
    fim = time.time() + MAX_GRAVACAO
    silencioso_desde = None
    try:
        while time.time() < fim:
            pedaco = proc.stdout.read(3200)  # 100ms @16kHz s16 mono
            if not pedaco:
                break
            bruto += pedaco
            calmo = rms(pedaco) < RMS_SILENCIO
            if calmo:
                # só corta se já houve fala de verdade na gravação
                if len(bruto) > 16000 * 4 and silencioso_desde is None:
                    silencioso_desde = time.time()
                if silencioso_desde and time.time() - silencioso_desde > SILÊNCIO_CORTE:
                    break
            else:
                silencioso_desde = None
    finally:
        proc.terminate()
        proc.wait()
    if len(bruto) < 16000 * 2:  # menos de 2s? ignora
        return None
    with open(saida, 'wb') as f:
        f.write(bruto)
    return saida


def main():
    if not os.path.isdir(MODELO):
        log(f'modelo não encontrado em {MODELO}')
        sys.exit(1)
    log('carregando vosk...')
    modelo = Model(MODELO)
    recon = KaldiRecognizer(modelo, 16000)
    log('ouvindo. Diga "Ultron" 🎙️')
    ultimos = ['', time.time()]

    ffmpeg = subprocess.Popen(
        ['ffmpeg', '-loglevel', 'error', '-f', 'pulse', '-i', 'default',
         '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1'],
        stdout=subprocess.PIPE,
    )

    while True:
        pedaco = ffmpeg.stdout.read(6400)  # 200ms
        if not pedaco:
            break
        if time.time() < ocupado_ate[0]:
            continue  # processando fala anterior: não escuta
        if not recon.AcceptWaveform(pedaco):
            parcial = json.loads(recon.PartialResult()).get('partial', '')
            # medidor de som: mostra quando há volume de voz (a cada ~5s)
            nivel = rms(pedaco)
            if nivel > 900 and time.time() - ultimos[1] > 5:
                ultimos[1] = time.time()
                log(f'🔊 som nível {nivel} | ouvi: "{parcial}"')
            elif parcial and parcial != ultimos[0] and time.time() - ultimos[1] > 4:
                ultimos[0] = parcial
                ultimos[1] = time.time()
                log(f'👂 "{parcial}"')
            if parcial and eh_wake(parcial) and time.time() >= ocupado_ate[0]:
                ocupado_ate[0] = time.time() + COOLDOWN
                log('🔥 WAKE WORD detectada!')
                recon.Reset()
                subprocess.Popen(['ffplay', '-loglevel', 'quiet', '-nodisp',
                                  '-autoexit', BEEP])
                wav = gravar_comando()
                if not wav:
                    log('não captei fala depois do nome; seguindo ouvindo')
                    continue
                log('comando gravado, passando pro cérebro...')
                try:
                    r = subprocess.run(
                        [os.path.expanduser('~/.local/bin/node'), COMANDO_NODE, wav],
                        capture_output=True, text=True, timeout=420,
                        env={**os.environ, 'OMP_NUM_THREADS': '2'},
                    )
                    if r.stdout.strip():
                        log(r.stdout.strip().splitlines()[-1])
                    if r.returncode != 0:
                        log(f'cérebro falhou: {r.stderr.strip()[-200:]}')
                except Exception as e:
                    log(f'erro ao chamar cérebro: {e}')
                ocupado_ate[0] = time.time() + COOLDOWN


if __name__ == '__main__':
    main()
