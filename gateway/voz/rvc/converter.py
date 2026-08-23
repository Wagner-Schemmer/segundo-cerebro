import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
from rvc_python.infer import infer_file  # noqa: E402

entrada, saida = sys.argv[1], sys.argv[2]
chave = int(sys.argv[3]) if len(sys.argv) > 3 else -4
infer_file(
    input_path=entrada,
    model_path="Ultron.pth",
    index_path="Ultron.index",
    device="cpu:0",
    f0up_key=chave,
    index_rate=0.75, f0method='rmvpe',
    opt_path=saida,
)
