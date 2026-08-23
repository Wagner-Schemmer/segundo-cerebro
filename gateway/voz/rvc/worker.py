# Worker RVC permanente: carrega os modelos UMA vez e converte por HTTP local.
# Vantagem: sem ele cada conversão recarrega ~100s de modelos antes de gerar.
# Rotas: GET /saude | POST /converter {"entrada","saida","chave"}

import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from scipy.io import wavfile

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.getcwd())

import rvc_python  # noqa: E402
from rvc_python.modules.vc.modules import VC  # noqa: E402
from rvc_python.configs.config import Config  # noqa: E402
from rvc_python.modules.vc.utils import load_hubert  # noqa: E402

PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 3778
LIB_DIR = os.path.dirname(rvc_python.__file__)
trava = threading.Lock()
pronto = threading.Event()
vc_global = None

# auto-desligamento: solta a RAM se ninguém converter por 10min (exit 0 = systemd não religa)
ULTIMA = [time.time()]
MIN_OCIOSO = 600


def vigia():
    while True:
        time.sleep(60)
        if pronto.is_set() and time.time() - ULTIMA[0] > MIN_OCIOSO:
            print('[worker] ocioso demais, liberando RAM. tchau!', flush=True)
            os._exit(0)


def carregar_modelos():
    config = Config(LIB_DIR, 'cpu:0')
    vc = VC(LIB_DIR, config)
    vc.get_vc('Ultron.pth', 'v2')
    print('[worker] Ultron.pth carregado, agora hubert...', flush=True)
    vc.hubert_model = load_hubert(config, LIB_DIR)
    print('[worker] hubert carregado (rmvpe entra na 1a conversao)', flush=True)
    return vc


class Atende(BaseHTTPRequestHandler):
    def log_message(self, *_a):
        pass

    def _json(self, codigo, obj):
        dados = json.dumps(obj).encode()
        self.send_response(codigo)
        self.send_header('content-type', 'application/json')
        self.send_header('content-length', str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_GET(self):
        if self.path == '/saude':
            self._json(200, {'pronto': pronto.is_set()})
        else:
            self._json(404, {'erro': 'rota desconhecida'})

    def do_POST(self):
        if self.path != '/converter':
            return self._json(404, {'erro': 'rota desconhecida'})
        try:
            tam = int(self.headers.get('content-length', 0))
            pedido = json.loads(self.rfile.read(tam))
        except Exception as e:
            return self._json(400, {'erro': f'json invalido: {e}'})

        entrada = pedido.get('entrada')
        saida = pedido.get('saida')
        chave = int(pedido.get('chave', -4))
        if not entrada or not os.path.exists(entrada):
            return self._json(400, {'erro': 'arquivo de entrada nao existe'})

        with trava:
            ULTIMA[0] = time.time()
            t0 = time.time()
            wav = vc_global.vc_single(
                sid=1,
                input_audio_path=entrada,
                f0_up_key=chave,
                f0_method='rmvpe',
                file_index='Ultron.index',
                index_rate=0.75,
                filter_radius=3,
                resample_sr=0,
                rms_mix_rate=1,
                protect=0.33,
                f0_file='',
                file_index2='',
            )
            if isinstance(wav, tuple):
                return self._json(500, {'erro': f'conversao falhou: {str(wav[0])[:300]}'})
            wavfile.write(saida, vc_global.tgt_sr, wav)
            tempo = round(time.time() - t0, 1)
        print(f'[worker] convertido em {tempo}s: {saida}', flush=True)
        self._json(200, {'ok': True, 'tempo': tempo})


if __name__ == '__main__':
    threading.Thread(target=vigia, daemon=True).start()
    servidor = ThreadingHTTPServer(('127.0.0.1', PORTA), Atende)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    print(f'[worker] porta {PORTA} aberta, carregando modelos...', flush=True)
    vc_global = carregar_modelos()
    pronto.set()
    print(f'[worker] PRONTO em {PORTA}', flush=True)
    ULTIMA[0] = time.time()
    threading.Event().wait()
