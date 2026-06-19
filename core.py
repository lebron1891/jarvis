"""
core.py — Cœur partagé de Jarvis-CYB.

Regroupe toute la logique commune aux deux modes (CLI et daemon) :
config, contexte, capture + compression d'écran, appel à l'API Claude
(avec vision), logging markdown, notifications et terminal flottant.
"""

from __future__ import annotations

import datetime as _dt
import io
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import yaml

# --- Chemins de base -------------------------------------------------------

# Tout vit sous ~/.jarvis/ (surchargeable via la variable d'env JARVIS_HOME).
JARVIS_HOME = Path(os.environ.get("JARVIS_HOME", Path.home() / ".jarvis"))
CONFIG_PATH = JARVIS_HOME / "config.yaml"
CONTEXT_PATH = JARVIS_HOME / "context.md"
HISTORY_DIR = JARVIS_HOME / "history"
SCREENSHOTS_DIR = JARVIS_HOME / "screenshots"

# Répertoire du dépôt (là où se trouvent jarvis.py / daemon.py / le template).
REPO_DIR = Path(__file__).resolve().parent
CONFIG_TEMPLATE = REPO_DIR / "config.yaml"


# --- Prompt système (hardcodé, comme demandé) ------------------------------

SYSTEM_PROMPT = (
    "Tu es Jarvis-CYB, l'assistant pentest de l'utilisateur. Tu vois son écran. "
    "Il travaille sur des plateformes légales (TryHackMe, HackTheBox, CTF). "
    "Style : ultra-concret, direct, pas de paragraphes longs. "
    "Donne d'abord la commande/action à faire, puis 1-2 phrases d'explication "
    "avec une analogie simple si le concept est nouveau. "
    "Si tu vois un terminal, lis ce qui a déjà été tapé avant de suggérer. "
    "Si tu vois une page web TryHackMe, identifie la room et la question en cours. "
    "Refuse poliment toute action contre une cible non-autorisée."
)


# --- Valeurs par défaut de la config ---------------------------------------

DEFAULT_CONFIG = {
    "model": "claude-sonnet-4-6",
    "hotkey": "<ctrl>+<alt>+j",
    "max_tokens": 1024,
    "screenshot": {
        "max_width": 1600,
        "jpeg_quality": 70,
        "monitor": 0,  # 0 = tous les écrans, 1 = principal, 2 = secondaire...
    },
    "hotkey_prompt": "Regarde mon écran et dis-moi quoi faire pour avancer.",
    "terminal_cmd": "",  # vide = auto-détection
    "screenshot_retention_hours": 24,
}


class JarvisError(Exception):
    """Erreur « propre », destinée à être affichée à l'utilisateur."""


# --- Config & arborescence -------------------------------------------------

def ensure_dirs() -> None:
    """Crée l'arborescence ~/.jarvis/ si elle n'existe pas."""
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def _deep_merge(base: dict, override: dict) -> dict:
    """Fusionne récursivement `override` dans `base` (gère les sous-dicts)."""
    out = dict(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def load_config() -> dict:
    """
    Charge ~/.jarvis/config.yaml fusionné avec les valeurs par défaut.
    Si le fichier n'existe pas, on retourne juste les défauts (install.sh le crée).
    """
    user_cfg: dict = {}
    if CONFIG_PATH.exists():
        try:
            user_cfg = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError as exc:
            raise JarvisError(f"config.yaml illisible : {exc}")
    return _deep_merge(DEFAULT_CONFIG, user_cfg)


# --- Contexte --------------------------------------------------------------

def load_context() -> str:
    """Lit ~/.jarvis/context.md (chaîne vide si absent)."""
    if CONTEXT_PATH.exists():
        return CONTEXT_PATH.read_text(encoding="utf-8").strip()
    return ""


def update_context(text: str) -> None:
    """Écrase context.md avec le texte fourni."""
    ensure_dirs()
    CONTEXT_PATH.write_text(text.strip() + "\n", encoding="utf-8")


# --- Capture & compression d'écran -----------------------------------------

def take_screenshot(monitor: int = 0):
    """
    Capture l'écran avec mss et renvoie une image Pillow (RGB).
    `monitor` : index mss (0 = tous les écrans fusionnés, 1 = principal...).
    """
    import mss
    from PIL import Image

    with mss.mss() as sct:
        monitors = sct.monitors  # [0] = tous les écrans, [1] = principal, ...
        idx = monitor if 0 <= monitor < len(monitors) else 0
        shot = sct.grab(monitors[idx])
        # mss fournit du BGRA ; `.rgb` le convertit en RGB pour Pillow.
        return Image.frombytes("RGB", shot.size, shot.rgb)


def compress_image(img, max_width: int = 1600, quality: int = 70) -> bytes:
    """
    Redimensionne (largeur max) puis compresse en JPEG.
    But : économiser les tokens AVANT l'envoi à l'API.
    """
    from PIL import Image

    if img.width > max_width:
        ratio = max_width / img.width
        new_size = (max_width, max(1, int(img.height * ratio)))
        img = img.resize(new_size, Image.LANCZOS)

    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def capture_compressed(config: dict) -> bytes:
    """Capture + compresse en une étape, selon la config."""
    sshot = config["screenshot"]
    img = take_screenshot(sshot.get("monitor", 0))
    return compress_image(img, sshot.get("max_width", 1600), sshot.get("jpeg_quality", 70))


def cache_screenshot(jpeg_bytes: bytes) -> Path:
    """Sauvegarde le JPEG dans le cache (debug/historique) et renvoie son chemin."""
    ensure_dirs()
    name = _dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f") + ".jpg"
    path = SCREENSHOTS_DIR / name
    path.write_bytes(jpeg_bytes)
    return path


def purge_old_screenshots(retention_hours: int = 24) -> int:
    """Supprime les screenshots du cache plus vieux que N heures. Renvoie le nb supprimé."""
    if not SCREENSHOTS_DIR.exists():
        return 0
    cutoff = time.time() - retention_hours * 3600
    removed = 0
    for f in SCREENSHOTS_DIR.glob("*.jpg"):
        try:
            if f.stat().st_mtime < cutoff:
                f.unlink()
                removed += 1
        except OSError:
            pass
    return removed


# --- Appel à l'API Claude (vision) -----------------------------------------

def ask_claude(question: str, jpeg_bytes: bytes | None, config: dict) -> str:
    """
    Envoie (screenshot + contexte + question) à Claude et renvoie la réponse texte.
    Gère proprement : clé manquante, réseau, rate limit, erreurs API.
    """
    import base64

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise JarvisError(
            "Variable ANTHROPIC_API_KEY absente. "
            'Exporte-la : export ANTHROPIC_API_KEY="sk-ant-..."'
        )

    try:
        import anthropic
    except ImportError:
        raise JarvisError(
            "Module 'anthropic' manquant. Lance install.sh (ou pip install anthropic)."
        )

    client = anthropic.Anthropic(api_key=api_key)

    # Construction du contenu : screenshot d'abord, puis contexte + question.
    context = load_context()
    content: list = []
    if jpeg_bytes:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": base64.standard_b64encode(jpeg_bytes).decode("utf-8"),
            },
        })
    text_parts = []
    if context:
        text_parts.append(f"# Contexte courant (fourni par l'utilisateur)\n{context}")
    text_parts.append(f"# Question\n{question}")
    content.append({"type": "text", "text": "\n\n".join(text_parts)})

    try:
        resp = client.messages.create(
            model=config.get("model", "claude-sonnet-4-6"),
            max_tokens=config.get("max_tokens", 1024),
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": content}],
        )
    except anthropic.AuthenticationError:
        raise JarvisError("Clé API invalide (401). Vérifie ANTHROPIC_API_KEY.")
    except anthropic.RateLimitError as exc:
        retry = "60"
        try:
            retry = exc.response.headers.get("retry-after", "60")
        except Exception:
            pass
        raise JarvisError(f"Rate limit atteint (429). Réessaie dans {retry}s.")
    except anthropic.APIConnectionError:
        raise JarvisError("Pas de réseau / API injoignable. Vérifie ta connexion.")
    except anthropic.BadRequestError as exc:
        raise JarvisError(f"Requête invalide : {getattr(exc, 'message', exc)}")
    except anthropic.APIStatusError as exc:
        raise JarvisError(f"Erreur API ({exc.status_code}). Réessaie plus tard.")

    answer = "".join(b.text for b in resp.content if b.type == "text").strip()
    return answer or "(réponse vide)"


# --- Logging markdown ------------------------------------------------------

def log_qa(question: str, answer: str, screenshot_path: Path | None = None) -> Path:
    """Ajoute la Q/R du jour dans ~/.jarvis/history/YYYY-MM-DD.md (markdown lisible)."""
    ensure_dirs()
    now = _dt.datetime.now()
    day_file = HISTORY_DIR / f"{now:%Y-%m-%d}.md"
    block = [f"## {now:%H:%M:%S}", "", f"**Q :** {question}", ""]
    if screenshot_path:
        block += [f"*Screenshot : `{screenshot_path}`*", ""]
    block += [f"**R :**", "", answer, "", "---", ""]
    with day_file.open("a", encoding="utf-8") as f:
        f.write("\n".join(block) + "\n")
    return day_file


# --- Notification système --------------------------------------------------

def notify(title: str, message: str) -> None:
    """Notification système (best-effort : n'échoue jamais bruyamment)."""
    short = " ".join(message.strip().split())  # une ligne, espaces normalisés
    if len(short) > 240:
        short = short[:237] + "..."
    try:
        from plyer import notification
        notification.notify(title=title, message=short, app_name="Jarvis-CYB", timeout=10)
        return
    except Exception:
        pass
    # Repli : notify-send si dispo.
    if shutil.which("notify-send"):
        try:
            subprocess.run(["notify-send", title, short], check=False)
        except Exception:
            pass


# --- Terminal flottant -----------------------------------------------------

# Terminaux connus + flag pour leur passer une commande à exécuter.
_TERMINALS = [
    ("x-terminal-emulator", "-e"),
    ("kitty", None),
    ("alacritty", "-e"),
    ("xfce4-terminal", "-x"),
    ("qterminal", "-e"),
    ("konsole", "-e"),
    ("gnome-terminal", "--"),
    ("xterm", "-e"),
]


def _detect_terminal():
    """Renvoie (binaire, flag) du premier terminal trouvé, sinon (None, None)."""
    for name, flag in _TERMINALS:
        if shutil.which(name):
            return name, flag
    return None, None


def show_in_terminal(answer: str, config: dict) -> bool:
    """
    Ouvre un terminal flottant affichant la réponse (rendue avec rich).
    Renvoie True si un terminal a pu être lancé.
    """
    # Fichier temporaire que le sous-process de rendu va lire (puis supprimer).
    fd, tmppath = tempfile.mkstemp(prefix="jarvis-", suffix=".md")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(answer)

    def _cleanup() -> None:
        # Le fichier temp n'est supprimé par 'jarvis _render' que si un terminal
        # a bien été lancé. Sur les chemins d'échec, on nettoie nous-mêmes.
        try:
            os.unlink(tmppath)
        except OSError:
            pass

    render_cmd = [sys.executable, str(REPO_DIR / "jarvis.py"), "_render", tmppath]

    custom = (config.get("terminal_cmd") or "").strip()
    if custom:
        import shlex
        full = shlex.split(custom) + render_cmd
    else:
        term, flag = _detect_terminal()
        if not term:
            _cleanup()
            return False
        full = [term] + ([flag] if flag else []) + render_cmd

    try:
        subprocess.Popen(full, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        _cleanup()
        return False
