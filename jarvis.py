#!/usr/bin/env python3
"""
jarvis.py — Entrypoint CLI de Jarvis-CYB.

Modes :
  jarvis "ma question"          -> screenshot + question -> Claude -> réponse (rich)
  jarvis context "..."          -> met à jour ~/.jarvis/context.md
  jarvis context                -> affiche le contexte courant
  jarvis daemon                 -> lance le daemon hotkey global (Ctrl+Alt+J)
  jarvis _render <fichier.md>   -> (interne) rendu rich pour le terminal flottant

Options du mode question :
  --no-screenshot   pose la question sans capture d'écran
  --model <id>      surcharge le modèle Claude (ex: claude-opus-4-8)
"""

from __future__ import annotations

import argparse
import os
import sys

# Permet `import core` / `import daemon` peu importe d'où jarvis est lancé.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import core  # noqa: E402


def cmd_ask(question: str, no_screenshot: bool, model: str | None) -> None:
    """Mode CLI principal : pose une question avec (ou sans) screenshot."""
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel

    console = Console()
    config = core.load_config()
    if model:
        config["model"] = model

    jpeg = None
    shot_path = None
    if not no_screenshot:
        with console.status("[cyan]Capture de l'écran...", spinner="dots"):
            try:
                jpeg = core.capture_compressed(config)
                shot_path = core.cache_screenshot(jpeg)
            except Exception as exc:
                console.print(
                    f"[yellow]Screenshot impossible ({exc}) — envoi sans image.[/yellow]"
                )

    try:
        with console.status("[cyan]Jarvis réfléchit...", spinner="dots"):
            answer = core.ask_claude(question, jpeg, config)
    except core.JarvisError as exc:
        console.print(Panel(str(exc), title="[red]Erreur", border_style="red"))
        sys.exit(1)

    core.log_qa(question, answer, shot_path)
    core.purge_old_screenshots(config.get("screenshot_retention_hours", 24))
    console.print(Panel(Markdown(answer), title="[bold green]Jarvis-CYB", border_style="green"))


def cmd_context(text: str | None) -> None:
    """Affiche (sans arg) ou met à jour (avec arg) le contexte courant."""
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel

    console = Console()
    if text:
        core.update_context(text)
        console.print("[green]✓ Contexte mis à jour.[/green]")
        return

    ctx = core.load_context()
    if ctx:
        console.print(Panel(Markdown(ctx), title="Contexte courant", border_style="cyan"))
    else:
        console.print(
            '[yellow]Aucun contexte. Ex : '
            'jarvis context "Room: Bounty Hacker, je cherche le user flag"[/yellow]'
        )


def cmd_daemon() -> None:
    """Lance le daemon hotkey (délègue à daemon.py)."""
    import daemon as daemon_mod
    daemon_mod.run()


def cmd_render(path: str) -> None:
    """(Interne) Rend un fichier markdown avec rich, attend une touche, puis supprime le fichier."""
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel

    console = Console()
    try:
        text = open(path, encoding="utf-8").read()
    except OSError as exc:
        text = f"(impossible de lire la réponse : {exc})"
    console.print(Panel(Markdown(text), title="[bold green]Jarvis-CYB", border_style="green"))
    try:
        input("\n[Entrée pour fermer] ")
    except (EOFError, KeyboardInterrupt):
        pass
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _build_question_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="jarvis",
        description="Jarvis-CYB — assistant pentest local (TryHackMe / HTB / CTF légaux).",
        epilog=(
            "Sous-commandes :\n"
            '  jarvis "ma question"      pose une question (+ screenshot)\n'
            '  jarvis context "..."      met à jour le contexte courant\n'
            "  jarvis context            affiche le contexte courant\n"
            "  jarvis daemon             lance le daemon hotkey global\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("question", nargs="?", help="Ta question (déclenche un screenshot).")
    parser.add_argument(
        "--no-screenshot", action="store_true", help="N'envoie pas de capture d'écran."
    )
    parser.add_argument("--model", help="Surcharge le modèle Claude (ex: claude-opus-4-8).")
    return parser


def main(argv: list[str] | None = None) -> None:
    argv = list(sys.argv[1:] if argv is None else argv)

    # Dispatch manuel des sous-commandes (évite l'ambiguïté argparse
    # entre un positionnel « question » et des sous-parsers).
    if argv and argv[0] == "context":
        cmd_context(argv[1] if len(argv) > 1 else None)
        return
    if argv and argv[0] == "daemon":
        cmd_daemon()
        return
    if argv and argv[0] == "_render":
        if len(argv) < 2:
            sys.exit("usage interne : jarvis _render <fichier.md>")
        cmd_render(argv[1])
        return

    # Sinon : mode question.
    parser = _build_question_parser()
    args = parser.parse_args(argv)
    if not args.question:
        parser.print_help()
        return
    cmd_ask(args.question, args.no_screenshot, args.model)


if __name__ == "__main__":
    main()
