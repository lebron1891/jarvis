#!/usr/bin/env python3
"""
daemon.py — Process en arrière-plan de Jarvis-CYB.

Écoute le hotkey global (Ctrl+Alt+J par défaut). À chaque déclenchement :
  1. capture l'écran
  2. compresse le screenshot (JPEG)
  3. envoie screenshot + contexte courant à Claude
  4. affiche la réponse (notification système + terminal flottant)
  5. logge la Q/R dans ~/.jarvis/history/

Lancement : `jarvis daemon`, `python daemon.py`, ou via systemd user (voir install.sh).
"""

from __future__ import annotations

import os
import signal
import sys
import threading

# Permet `import core` peu importe d'où le daemon est lancé.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import core  # noqa: E402


def _handle_trigger(config: dict) -> None:
    """
    Traite un déclenchement du hotkey.
    Exécuté dans un thread pour ne pas bloquer le listener pendant l'appel API.
    """
    try:
        jpeg = core.capture_compressed(config)
        shot_path = core.cache_screenshot(jpeg)
    except Exception as exc:
        core.notify("Jarvis-CYB — erreur", f"Capture impossible : {exc}")
        return

    question = config.get("hotkey_prompt") or "Regarde mon écran et aide-moi."
    try:
        answer = core.ask_claude(question, jpeg, config)
    except core.JarvisError as exc:
        core.notify("Jarvis-CYB — erreur", str(exc))
        return
    except Exception as exc:  # le daemon ne doit jamais mourir sur une réponse
        core.notify("Jarvis-CYB — erreur", f"Erreur inattendue : {exc}")
        return

    core.log_qa(question, answer, shot_path)
    core.purge_old_screenshots(config.get("screenshot_retention_hours", 24))
    core.notify("Jarvis-CYB", answer)
    core.show_in_terminal(answer, config)


def run() -> None:
    """Démarre l'écoute du hotkey global (bloquant)."""
    try:
        from pynput import keyboard
    except ImportError:
        sys.exit("Module 'pynput' manquant. Lance install.sh (ou pip install pynput).")

    core.ensure_dirs()
    config = core.load_config()
    hotkey = config.get("hotkey", "<ctrl>+<alt>+j")

    print(f"[Jarvis-CYB] daemon démarré. Hotkey : {hotkey}")
    print("[Jarvis-CYB] Astuce : édite ~/.jarvis/context.md pour donner le contexte de ta room.")

    def on_activate() -> None:
        # On relit la config à chaque fois -> modifs prises en compte sans redémarrage.
        cfg = core.load_config()
        threading.Thread(target=_handle_trigger, args=(cfg,), daemon=True).start()

    try:
        listener = keyboard.GlobalHotKeys({hotkey: on_activate})
    except ValueError as exc:
        sys.exit(f"Hotkey invalide '{hotkey}' : {exc}")

    # Arrêt propre (systemd envoie SIGTERM ; Ctrl-C en avant-plan).
    def _stop(*_):
        listener.stop()

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)

    listener.start()
    listener.join()
    print("[Jarvis-CYB] daemon arrêté.")


if __name__ == "__main__":
    run()
