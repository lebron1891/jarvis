# Jarvis-CYB 🤖🔓

Assistant IA local pour **Kali Linux** qui t'aide en temps réel sur **TryHackMe**, **HackTheBox** et tes **labs/CTF légaux**.

Hotkey global → screenshot → Claude (vision) → réponse **ultra-concrète** dans une notification + un terminal flottant. Le tout loggé en markdown.

> ⚠️ Outil d'**apprentissage**, pour plateformes **autorisées uniquement**. Le prompt système de Jarvis refuse toute action contre une cible non-autorisée.

---

## Fonctionnalités (v1)

- **Hotkey global** (`Ctrl+Alt+J`, configurable) : capture l'écran, compresse (JPEG qualité 70, max 1600 px), envoie à Claude avec le contexte courant, affiche la réponse (**notif système + terminal flottant**), logge la Q/R.
- **Mode CLI** : `jarvis "ma question"` → screenshot + question → réponse formatée avec `rich`.
- **Context awareness** : Jarvis lit `~/.jarvis/context.md` avant chaque appel. Édite-le à la main ou via `jarvis context "..."`.

## Prérequis

- Linux — **session X11 recommandée** (voir [Wayland vs X11](#wayland-vs-x11))
- Python 3.9+
- Une clé API Anthropic

## Installation

```bash
git clone <repo> jarvis && cd jarvis
chmod +x install.sh
./install.sh
```

`install.sh` crée un virtualenv, installe les dépendances, crée `~/.jarvis/`, installe le lanceur `jarvis` dans `~/.local/bin`, et propose un service systemd user pour le daemon.

Vérifie que `~/.local/bin` est dans ton PATH :

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
```

## Clé API

```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.bashrc && source ~/.bashrc
```

Pour le **service systemd**, la clé est lue depuis `~/.jarvis/jarvis.env` (voir [Daemon](#daemon-hotkey-global)).

## Utilisation

### Mode CLI

```bash
jarvis "quelle est la prochaine étape sur cette room ?"
jarvis "explique cette sortie nmap"
jarvis --no-screenshot "rappelle-moi la syntaxe de hydra pour du ssh"
jarvis --model claude-opus-4-8 "analyse ce bout de code"
```

### Contexte

```bash
jarvis context "Room: Bounty Hacker, je cherche le user flag, nmap complet déjà fait"
jarvis context        # affiche le contexte courant
```

Ou édite directement `~/.jarvis/context.md`.

### Daemon (hotkey global)

```bash
jarvis daemon          # avant-plan : appuie sur Ctrl+Alt+J pour déclencher
```

Ou via **systemd** (lancé au login) :

```bash
# La clé API doit être dans ~/.jarvis/jarvis.env :
echo 'ANTHROPIC_API_KEY=sk-ant-...' > ~/.jarvis/jarvis.env && chmod 600 ~/.jarvis/jarvis.env

systemctl --user import-environment DISPLAY XAUTHORITY   # pour X11
systemctl --user enable --now jarvis.service
journalctl --user -u jarvis.service -f                   # voir les logs
```

## Configuration

`~/.jarvis/config.yaml` (relu à **chaque** déclenchement, pas besoin de redémarrer le daemon) :

| Clé | Défaut | Description |
|---|---|---|
| `model` | `claude-sonnet-4-6` | Modèle Claude (vision) |
| `hotkey` | `<ctrl>+<alt>+j` | Hotkey global (syntaxe pynput) |
| `max_tokens` | `1024` | Taille max de la réponse |
| `screenshot.max_width` | `1600` | Largeur max avant envoi |
| `screenshot.jpeg_quality` | `70` | Qualité JPEG |
| `screenshot.monitor` | `0` | `0` = tous, `1` = principal, `2` = secondaire... |
| `hotkey_prompt` | *"Regarde mon écran..."* | Question envoyée en mode hotkey |
| `terminal_cmd` | `""` | Terminal flottant (vide = auto-détection) |
| `screenshot_retention_hours` | `24` | Purge auto du cache de screenshots |

## Arborescence

```
~/.jarvis/
├── config.yaml      # config
├── context.md       # contexte courant (éditable)
├── jarvis.env       # clé API pour systemd (optionnel)
├── history/         # logs Q/R par jour (YYYY-MM-DD.md)
└── screenshots/     # cache JPEG (purge > 24h)
```

## Wayland vs X11

Le **hotkey global** et la **capture d'écran** reposent sur `pynput` + `mss`, fiables sous **X11**. Kali tourne en Xfce/X11 par défaut → rien à faire.

Sous **Wayland**, le hotkey global ne fonctionne pas (limitation de sécurité Wayland) et `mss` peut échouer. Solutions :

- Bascule ta session en **X11** (écran de login → roue dentée → « Xorg »).
- Ou utilise seulement le **mode CLI** `jarvis "..."` ; si la capture échoue, ajoute `--no-screenshot`.

## Dépannage

| Symptôme | Solution |
|---|---|
| `ANTHROPIC_API_KEY absente` | Exporte la clé (voir [Clé API](#clé-api)). |
| Pas de terminal flottant | `sudo apt install xterm` ou définis `terminal_cmd` dans la config. |
| Pas de notification | `sudo apt install libnotify-bin` (fournit `notify-send`). |
| Hotkey inactif sous systemd | `systemctl --user import-environment DISPLAY XAUTHORITY` puis `restart`. |
| `rate limit (429)` | Attends le délai indiqué, ou baisse la fréquence d'appels. |

## Roadmap (V2 — non implémenté)

- 🎙️ **STT/TTS local** : dictée des questions + lecture vocale des réponses (Whisper + Piper).
- 📺 **Lecture auto de la sortie tmux** active (pas besoin de screenshot pour le terminal).
- 🔁 **Mode « follow-along »** : screenshot automatique toutes les 30 s en tâche de fond.
- 🌐 **Détection auto de la room TryHackMe** via l'URL du navigateur actif.

---

*Code commenté en français. Architecture 100 % Python natif (pas d'Electron, pas de webapp).*
