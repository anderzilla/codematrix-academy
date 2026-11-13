"""Pipeline de vídeo CodeMatrix Academy: roteiro → cenas → narração → legendas → quadros → vídeo.

Cada cena vira um arquivo .mp4 próprio (mesmo tamanho, fps e encoder), com fade e legenda queimada;
depois tudo é unido com concat -c copy e o áudio normalizado é acrescentado com -c:v copy.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import textwrap
from pathlib import Path

import requests

from . import atividades, credentials, llm, marca
from .config import settings

QUEBRA_ASS = "\\N"
TIPOS = {"capa", "secao", "topicos", "passo", "codigo", "destaque", "comparacao", "cta"}

PROMPT_CENAS = """Transforme o roteiro abaixo em cenas de vídeo para a CodeMatrix Academy.
Regras: cada cena = 1 ideia; narração de 12 a 35 palavras, natural para ser falada em português do Brasil;
texto na tela curto (o que aparece NÃO repete a narração inteira); no máximo 4 itens em "topicos";
use *asteriscos* em 1 palavra-chave do título para destacar com a cor do tema.
Tipos permitidos: capa, secao, topicos, passo, codigo, destaque, comparacao, cta.
Campos por tipo: capa{{eyebrow,titulo,subtitulo}} secao{{numero,titulo,texto}} topicos{{titulo,itens[]}}
passo{{numero,titulo,texto}} codigo{{titulo,codigo}} destaque{{texto}}
comparacao{{titulo,esquerda{{titulo,itens[]}},direita{{titulo,itens[]}}}} cta{{titulo,texto,botao}}.
Todas as cenas têm "narracao". Comece com uma capa e termine com cta. Entre 6 e 14 cenas.
Em até metade das cenas, inclua "personagem" da biblioteca (regra RC-013), conforme o papel da cena:
trix-ola (abertura), trix-explica (explicação), trix-pensa (pergunta/reflexão), trix-alerta (erro comum/cuidado),
trix-dica (dica rápida), trix-ok (confirmação/checklist), trix-estuda (exercício), trix-apresenta (dados/comparação),
trix-comemora (conquista/fim). Não use personagem em cenas de código.

Título do curso/aula: {titulo}

Roteiro:
{roteiro}

Responda SOMENTE com um JSON: {{"cenas": [ ... ]}}
"""


# ------------------------------------------------------------------ cenas

def _cenas_deterministicas(md: str, titulo: str) -> list[dict]:
    """Fallback sem IA: cada '## seção' vira uma cena de tópicos."""
    cenas = [{"tipo": "capa", "titulo": titulo, "subtitulo": "", "narracao": f"Nesta aula: {titulo}."}]
    for bloco in re.split(r"^##\s+", md, flags=re.M)[1:]:
        linhas = bloco.strip().splitlines()
        tit = linhas[0].strip()
        itens = [re.sub(r"^[\-\*\d\.\)\s]+", "", x).strip() for x in linhas[1:] if re.match(r"^\s*([-*]|\d+[.)])\s+", x)]
        corpo = " ".join(x.strip() for x in linhas[1:] if x.strip() and not re.match(r"^\s*([-*]|\d+[.)])\s+", x))
        narr = corpo or "; ".join(itens)
        if itens:
            cenas.append({"tipo": "topicos", "titulo": tit, "itens": [i[:60] for i in itens[:4]], "narracao": narr[:400]})
        elif narr:
            cenas.append({"tipo": "destaque", "texto": tit, "narracao": narr[:400]})
    cenas.append({"tipo": "cta", "titulo": "Agora é com *você*", "texto": "Faça o exercício antes da próxima aula.",
                  "botao": "Próxima aula", "narracao": "Agora é com você: faça o exercício antes da próxima aula."})
    return cenas


def validar(cenas: list[dict], tema: str, rotulo: str) -> list[dict]:
    ok = []
    for c in cenas:
        if c.get("tipo") not in TIPOS or not str(c.get("narracao", "")).strip():
            continue
        if c.get("personagem") and not (Path(__file__).resolve().parent.parent / "marca" / "personagens" / f"{c['personagem']}.svg").exists():
            c.pop("personagem")
        if "itens" in c:
            c["itens"] = [str(i) for i in c["itens"]][:4]
        c.update(tema=tema, rotulo=rotulo)
        ok.append(c)
    for i, c in enumerate(ok, 1):
        c.update(indice=i, total=len(ok))
    if not ok:
        raise ValueError("Nenhuma cena válida")
    return ok


def gerar_cenas(roteiro: Path, tema: str, titulo: str | None = None, saida: Path | None = None) -> Path:
    md = roteiro.read_text(encoding="utf-8")
    titulo = titulo or (re.search(r"^#\s+(.+)$", md, flags=re.M) or [None, roteiro.stem])[1]
    try:
        bruto = llm.gerar("cenas_video", PROMPT_CENAS.format(titulo=titulo, roteiro=md[:9000]),
                          "Você é o diretor audiovisual da CodeMatrix Academy. Responda apenas JSON válido.")
        dados = llm.extrair_json(bruto)
        cenas = dados["cenas"] if isinstance(dados, dict) else dados
        cenas = validar(cenas, tema, titulo)
    except Exception:  # noqa: BLE001 — IA indisponível ou JSON ruim: usa o fallback determinístico
        cenas = validar(_cenas_deterministicas(md, titulo), tema, titulo)
    saida = saida or roteiro.parent / f"{roteiro.stem}_video" / "cenas.json"
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(json.dumps({"titulo": titulo, "tema": tema, "cenas": cenas}, ensure_ascii=False, indent=2), encoding="utf-8")
    return saida


# ------------------------------------------------------------------ narração (TTS)

def _ffprobe_dur(p: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                         capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def _para_wav(origem: Path, destino: Path) -> None:
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(origem), "-ar", "48000", "-ac", "1", str(destino)], check=True)


def narrar(texto: str, destino: Path, motor: str | None = None) -> float:
    """Gera WAV 48 kHz mono e devolve a duração em segundos."""
    cfg = settings().get("video", {})
    motor = motor or cfg.get("voz_motor", "kokoro")
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(".tmp")

    if motor == "silencio":  # ensaio: duração estimada pela fala (~2,6 palavras/s)
        dur = max(2.5, len(texto.split()) / 2.6)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono",
                        "-t", f"{dur:.2f}", str(destino)], check=True)
        return dur

    if motor == "kokoro":
        from kokoro import KPipeline  # noqa: PLC0415  (pip install kokoro soundfile; Apache-2.0)
        import numpy as np  # noqa: PLC0415
        import soundfile as sf  # noqa: PLC0415

        voz = cfg.get("kokoro_voz", "pm_alex")  # pt-BR: pm_alex, pm_santa, pf_dora — confira a lista da sua versão
        pipe = KPipeline(lang_code="p")
        audio = np.concatenate([a for _, _, a in pipe(texto, voice=voz, speed=cfg.get("velocidade", 1.0))])
        sf.write(str(tmp) + ".wav", audio, 24000)
        _para_wav(Path(str(tmp) + ".wav"), destino)
    elif motor == "piper":
        modelo = cfg.get("piper_modelo", "pt_BR-faber-medium.onnx")
        subprocess.run(["piper", "--model", modelo, "--output_file", str(tmp) + ".wav"], input=texto, text=True, check=True)
        _para_wav(Path(str(tmp) + ".wav"), destino)
    elif motor == "azure":
        chave, regiao = credentials.obter("azure_speech_key"), cfg.get("azure_regiao", "brazilsouth")
        if not chave:
            raise RuntimeError("Sem azure_speech_key no cofre (rex credenciais).")
        voz = cfg.get("azure_voz", "pt-BR-AntonioNeural")
        ssml = (f"<speak version='1.0' xml:lang='pt-BR'><voice name='{voz}'>"
                f"<prosody rate='{cfg.get('azure_ritmo', '0%')}'>{_xml(texto)}</prosody></voice></speak>")
        r = requests.post(f"https://{regiao}.tts.speech.microsoft.com/cognitiveservices/v1", data=ssml.encode(),
                          headers={"Ocp-Apim-Subscription-Key": chave, "Content-Type": "application/ssml+xml",
                                   "X-Microsoft-OutputFormat": "riff-48khz-16bit-mono-pcm"}, timeout=120)
        r.raise_for_status()
        Path(str(tmp) + ".wav").write_bytes(r.content)
        _para_wav(Path(str(tmp) + ".wav"), destino)
    elif motor == "elevenlabs":
        chave = credentials.obter("elevenlabs_api_key")
        if not chave:
            raise RuntimeError("Sem elevenlabs_api_key no cofre (rex credenciais).")
        r = requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{cfg['elevenlabs_voz_id']}",
                          headers={"xi-api-key": chave}, json={"text": texto, "model_id": cfg.get("elevenlabs_modelo", "eleven_multilingual_v2")},
                          timeout=180)
        r.raise_for_status()
        Path(str(tmp) + ".mp3").write_bytes(r.content)
        _para_wav(Path(str(tmp) + ".mp3"), destino)
    else:
        raise ValueError(f"motor de voz desconhecido: {motor}")
    for ext in (".wav", ".mp3"):
        Path(str(tmp) + ext).unlink(missing_ok=True)
    return _ffprobe_dur(destino)


def _xml(t: str) -> str:
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ------------------------------------------------------------------ legendas

def blocos_legenda(texto: str, max_linha: int = 42, max_linhas: int = 2) -> list[str]:
    """Quebra por frase e depois em blocos de até `max_linhas` linhas (uma frase nunca começa no meio de um bloco)."""
    texto = re.sub(r"\s+", " ", texto.replace("*", "")).strip()
    frases = [f for f in re.split(r"(?<=[.!?:;])\s+", texto) if f]
    blocos = []
    cap = max_linha * max_linhas
    for f in frases:
        n = -(-len(f) // cap)  # nº mínimo de blocos
        while True:  # divide a frase em n blocos de tamanho parecido (evita sobrar 1 palavra)
            alvo, palavras, partes, atual = len(f) / n, f.split(), [], ""
            for w in palavras:
                if atual and len(atual) + 1 + len(w) > alvo * 1.15 and len(partes) < n - 1:
                    partes.append(atual)
                    atual = w
                else:
                    atual = f"{atual} {w}".strip()
            partes.append(atual)
            linhas_ok = [textwrap.wrap(p, max_linha, break_long_words=False) for p in partes]
            if all(len(x) <= max_linhas for x in linhas_ok) or n > 20:
                blocos += ["\n".join(x) for x in linhas_ok]
                break
            n += 1
    # junta blocos muito curtos com o anterior quando cabem
    juntos: list[str] = []
    for b in blocos:
        if juntos and "\n" not in juntos[-1] and "\n" not in b and len(juntos[-1]) + len(b) + 1 <= max_linha:
            juntos[-1] = juntos[-1] + " " + b
        else:
            juntos.append(b)
    return juntos


def tempos(blocos: list[str], inicio: float, dur: float) -> list[tuple[float, float, str]]:
    """Distribui a duração da fala entre os blocos pelo nº de caracteres."""
    total = sum(len(b) for b in blocos) or 1
    t, out = inicio, []
    for b in blocos:
        d = dur * len(b) / total
        out.append((t, t + d, b))
        t += d
    return out


def _ts_srt(s: float) -> str:
    ms = int(round(s * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def _ts_ass(s: float) -> str:
    cs = int(round(s * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def ass(cues: list[tuple[float, float, str]], w: int, h: int, vertical: bool) -> str:
    fs = 54 if vertical else 50
    mv = 300 if vertical else 56
    cab = (
        "[Script Info]\nScriptType: v4.00+\nWrapStyle: 2\nScaledBorderAndShadow: yes\n"
        f"PlayResX: {w}\nPlayResY: {h}\n\n[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, "
        "StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        # texto branco em caixa escura translúcida (BorderStyle 3) — legível sobre o vidro claro
        f"Style: Leg,Inter SemiBold,{fs},&H00FFFFFF,&H00FFFFFF,&H33301A0B,&H33301A0B,0,0,0,0,100,100,0,0,4,16,0,2,120,120,{mv},1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    linhas = [f"Dialogue: 0,{_ts_ass(a)},{_ts_ass(b)},Leg,,0,0,0,,{t.replace(chr(10), QUEBRA_ASS)}\n" for a, b, t in cues]
    return cab + "".join(linhas)


# ------------------------------------------------------------------ render

def _run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, capture_output=True)


def render(cenas_json: Path, vertical: bool = False, motor_voz: str | None = None, movimento: bool = True,
           legenda_queimada: bool = True, so_previa: bool = False) -> dict:
    dados = json.loads(cenas_json.read_text(encoding="utf-8"))
    cenas = dados["cenas"]
    fmt = "9x16" if vertical else "16x9"
    w, h = marca.FORMATOS[fmt]
    tk = marca.tokens()["video"]
    fps, tr = tk["fps"], tk["transicao_s"]
    leg = tk["legenda"]
    pasta = cenas_json.parent / ("vertical" if vertical else "horizontal")
    for sub in ("quadros", "audio", "cenas", "legendas"):
        (pasta / sub).mkdir(parents=True, exist_ok=True)
    fundo = marca.tokens()["marca"]["fundo"].lstrip("#")

    # 1) quadros
    with marca.navegador() as b:
        alvos = range(len(cenas))
        if so_previa:  # capa, a cena mais cheia e o CTA
            cheia = max(range(len(cenas)), key=lambda i: len(json.dumps(cenas[i], ensure_ascii=False)))
            alvos = sorted({0, cheia, len(cenas) - 1})
        for i in alvos:
            marca.render(cenas[i], pasta / "quadros" / f"{i + 1:02d}.png", fmt, browser=b)
    if so_previa:
        return {"previa": str(pasta / "quadros")}

    srt, t_global, audios = [], 0.0, []
    pre, pos = 0.35, 0.55
    for i, c in enumerate(cenas, 1):
        wav = pasta / "audio" / f"{i:02d}.wav"
        dur_fala = narrar(c["narracao"], wav, motor_voz)
        dur = round(pre + dur_fala + pos, 3)
        max_linha = 30 if vertical else leg["max_caracteres_linha"]
        cues_local = tempos(blocos_legenda(c["narracao"], max_linha, leg["max_linhas"]), pre, dur_fala)
        srt += [(t_global + a, t_global + b_, t) for a, b_, t in cues_local]
        ass_path = pasta / "legendas" / f"{i:02d}.ass"
        ass_path.write_text(ass(cues_local, w, h, vertical), encoding="utf-8")

        # 2) vídeo da cena (um arquivo por cena; fade dentro do arquivo)
        frames = int(round(dur * fps))
        vf = []
        if movimento:  # empurrão lento de 4% — desenhado em 2x para não tremer
            vf += [f"scale={w * 2}:{h * 2}", f"zoompan=z='1+0.04*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={w}x{h}:fps={fps}"]
        else:
            vf += ["loop=-1:1", f"trim=duration={dur}"]
        vf += ["format=yuv420p", f"fade=t=in:st=0:d={tr}:color=0x{fundo}", f"fade=t=out:st={dur - tr:.3f}:d={tr}:color=0x{fundo}"]
        if legenda_queimada:
            fontsdir = (Path(__file__).resolve().parent.parent / "marca" / "fontes").as_posix()
            vf.append(f"subtitles='{ass_path.as_posix()}':fontsdir='{fontsdir}'")
        tmp = pasta / "cenas" / f"{i:02d}.parcial.mp4"
        _run(["ffmpeg", "-y", "-v", "error", "-framerate", str(fps), "-i", str(pasta / "quadros" / f"{i:02d}.png"),
              "-vf", ",".join(vf), "-frames:v", str(frames), "-r", str(fps), "-c:v", "libx264", "-crf", "18",
              "-preset", "veryfast", "-pix_fmt", "yuv420p", str(tmp)])
        tmp.rename(pasta / "cenas" / f"{i:02d}.mp4")

        # áudio da cena com as pausas, na duração exata do vídeo
        padded = pasta / "audio" / f"{i:02d}_cena.wav"
        _run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-af", f"adelay={int(pre * 1000)},apad", "-t", f"{frames / fps:.3f}",
              "-ar", "48000", "-ac", "1", str(padded)])
        audios.append(padded)
        t_global += frames / fps

    # 3) juntar vídeo (-c copy) e áudio normalizado (-c:v copy)
    lista = pasta / "cenas" / "lista.txt"
    lista.write_text("".join(f"file '{p.name}'\n" for p in sorted((pasta / "cenas").glob("[0-9][0-9].mp4"))), encoding="utf-8")
    _run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lista), "-c", "copy", str(pasta / "video_mudo.mp4")])
    alista = pasta / "audio" / "lista.txt"
    alista.write_text("".join(f"file '{p.name}'\n" for p in audios), encoding="utf-8")
    _run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(alista),
          "-af", f"loudnorm=I={leg.get('loudness_lufs', -16)}:TP=-1.5:LRA=11", "-ar", "48000", str(pasta / "narracao.wav")])
    final = pasta / "video.parcial.mp4"
    _run(["ffmpeg", "-y", "-v", "error", "-i", str(pasta / "video_mudo.mp4"), "-i", str(pasta / "narracao.wav"),
          "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(final)])
    final.rename(pasta / "video.mp4")
    (pasta / "legendas.srt").write_text(
        "".join(f"{n}\n{_ts_srt(a)} --> {_ts_srt(b_)}\n{t}\n\n" for n, (a, b_, t) in enumerate(srt, 1)), encoding="utf-8")
    (pasta / "video_mudo.mp4").unlink(missing_ok=True)

    # thumbnail
    capa = next((c for c in cenas if c["tipo"] == "capa"), cenas[0])
    marca.capa(capa.get("titulo", dados["titulo"]), dados["tema"], "thumb", saida=pasta / "thumbnail.png")
    res = {"video": str(pasta / "video.mp4"), "srt": str(pasta / "legendas.srt"), "duracao_s": round(t_global, 1),
           "cenas": len(cenas), "voz": motor_voz or settings().get("video", {}).get("voz_motor", "kokoro")}
    atividades.registrar("execucao", f"rex video: {res}", automatico=True)
    return res


def disponivel() -> dict:
    return {"ffmpeg": bool(shutil.which("ffmpeg")), "ffprobe": bool(shutil.which("ffprobe")),
            "kokoro": _importa("kokoro"), "piper": bool(shutil.which("piper")), "playwright": _importa("playwright"),
            "azure_key": bool(credentials.obter("azure_speech_key")), "elevenlabs_key": bool(credentials.obter("elevenlabs_api_key"))}


def _importa(mod: str) -> bool:
    try:
        __import__(mod)
        return True
    except Exception:  # noqa: BLE001
        return False

