#!/usr/bin/env bash
#
# install.sh — Installe Jarvis-CYB sur Kali Linux (ou autre distro Linux).
#
#   - crée un virtualenv et installe les dépendances Python
#   - crée l'arborescence ~/.jarvis/ (config, contexte, history, screenshots)
#   - installe un lanceur 'jarvis' dans ~/.local/bin
#   - propose (optionnel) un service systemd user pour le daemon hotkey
#
set -euo pipefail

# Répertoire du dépôt (là où se trouve ce script).
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JARVIS_HOME="${JARVIS_HOME:-$HOME/.jarvis}"
VENV_DIR="$REPO_DIR/.venv"
BIN_DIR="$HOME/.local/bin"

echo "==> Jarvis-CYB : installation"
echo "    Dépôt   : $REPO_DIR"
echo "    Données : $JARVIS_HOME"

# 1. Vérifs de base ---------------------------------------------------------
command -v python3 >/dev/null 2>&1 || {
  echo "python3 introuvable. Installe-le : sudo apt install python3 python3-venv"
  exit 1
}

# 2. Virtualenv + dépendances ----------------------------------------------
echo "==> Création du virtualenv ($VENV_DIR)"
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip >/dev/null
echo "==> Installation des dépendances"
"$VENV_DIR/bin/pip" install -r "$REPO_DIR/requirements.txt"

# 3. Arborescence ~/.jarvis/ ------------------------------------------------
echo "==> Création de l'arborescence $JARVIS_HOME"
mkdir -p "$JARVIS_HOME/history" "$JARVIS_HOME/screenshots"

if [ ! -f "$JARVIS_HOME/config.yaml" ]; then
  cp "$REPO_DIR/config.yaml" "$JARVIS_HOME/config.yaml"
  echo "    config.yaml créé."
else
  echo "    config.yaml déjà présent — conservé."
fi

if [ ! -f "$JARVIS_HOME/context.md" ]; then
  cat > "$JARVIS_HOME/context.md" <<'EOF'
# Contexte courant
Room : (à remplir)
Objectif : (ex: user flag)
Déjà essayé :
EOF
  echo "    context.md créé."
else
  echo "    context.md déjà présent — conservé."
fi

# 4. Lanceur 'jarvis' dans ~/.local/bin ------------------------------------
echo "==> Installation du lanceur 'jarvis' dans $BIN_DIR"
mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/jarvis" <<EOF
#!/usr/bin/env bash
# Lanceur Jarvis-CYB (généré par install.sh)
exec "$VENV_DIR/bin/python" "$REPO_DIR/jarvis.py" "\$@"
EOF
chmod +x "$BIN_DIR/jarvis"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "    ⚠ $BIN_DIR n'est pas dans ton PATH."
     echo "       Ajoute : export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
esac

# 5. Clé API ----------------------------------------------------------------
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "    ⚠ ANTHROPIC_API_KEY non définie. Ajoute dans ~/.bashrc (ou ~/.zshrc) :"
  echo '        export ANTHROPIC_API_KEY="sk-ant-..."'
fi

# 6. Service systemd user (optionnel) --------------------------------------
echo
read -r -p "Installer le service systemd user (daemon au login) ? [o/N] " ans
if [[ "${ans:-}" =~ ^[oOyY]$ ]]; then
  SERVICE_DIR="$HOME/.config/systemd/user"
  ENV_FILE="$JARVIS_HOME/jarvis.env"
  mkdir -p "$SERVICE_DIR"

  # Fichier d'environnement (clé API) lu par le service, hors du fichier d'unité.
  if [ -n "${ANTHROPIC_API_KEY:-}" ] && [ ! -f "$ENV_FILE" ]; then
    echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo "    Clé API écrite dans $ENV_FILE (chmod 600)."
  elif [ ! -f "$ENV_FILE" ]; then
    echo "    ⚠ Pense à créer $ENV_FILE avec :  ANTHROPIC_API_KEY=sk-ant-..."
  fi

  cat > "$SERVICE_DIR/jarvis.service" <<EOF
[Unit]
Description=Jarvis-CYB daemon (hotkey global)
After=graphical-session.target
PartOf=graphical-session.target

[Service]
Type=simple
ExecStart=$VENV_DIR/bin/python $REPO_DIR/daemon.py
EnvironmentFile=-$ENV_FILE
Restart=on-failure
RestartSec=3

[Install]
WantedBy=graphical-session.target
EOF
  echo "    Service écrit : $SERVICE_DIR/jarvis.service"
  systemctl --user daemon-reload || true
  echo "    Active-le :"
  echo "        systemctl --user import-environment DISPLAY XAUTHORITY"
  echo "        systemctl --user enable --now jarvis.service"
else
  echo "    Service systemd ignoré. Lance le daemon à la main : jarvis daemon"
fi

echo
echo "==> Terminé."
echo "    Test CLI : jarvis \"que dois-je faire sur cette room ?\""
echo "    Contexte : jarvis context \"Room: Bounty Hacker, user flag\""
echo "    Daemon   : jarvis daemon   (puis Ctrl+Alt+J)"
