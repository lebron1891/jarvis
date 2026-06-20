// hud.js — interface 2D en overlay DOM :
//   - crosshair central minimaliste
//   - coordonnées du joueur en bas à gauche (mono, semi-transparent)
//   - panneau d'aide « cliquez pour jouer » qui s'efface au pointer lock.

const CSS = `
#hud-crosshair {
  position: fixed; left: 50%; top: 50%; width: 18px; height: 18px;
  transform: translate(-50%, -50%); pointer-events: none; z-index: 10;
  opacity: 0.85;
}
#hud-crosshair::before, #hud-crosshair::after {
  content: ""; position: absolute; background: rgba(255,255,255,0.85);
  box-shadow: 0 0 2px rgba(0,0,0,0.6);
}
#hud-crosshair::before { left: 50%; top: 0; width: 1.5px; height: 100%; transform: translateX(-50%); }
#hud-crosshair::after  { top: 50%; left: 0; height: 1.5px; width: 100%; transform: translateY(-50%); }

#hud-coords {
  position: fixed; left: 14px; bottom: 12px; z-index: 10; pointer-events: none;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: rgba(255,255,255,0.55); text-shadow: 0 1px 2px rgba(0,0,0,0.6);
  letter-spacing: 0.04em;
}

#hud-overlay {
  position: fixed; inset: 0; z-index: 20; display: flex;
  align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, rgba(11,15,20,0.25), rgba(11,15,20,0.65));
  color: #eef3f7; text-align: center;
  font: 14px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  transition: opacity 0.35s ease;
  pointer-events: none; /* laisse passer le clic vers le canvas (pointer lock) */
}
#hud-overlay .card {
  padding: 22px 30px; border-radius: 12px;
  background: rgba(20,28,38,0.55); border: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(3px);
}
#hud-overlay h1 { margin: 0 0 10px; font-size: 18px; font-weight: 600; letter-spacing: 0.02em; }
#hud-overlay .keys { color: rgba(255,255,255,0.7); }
#hud-overlay b { color: #fff; }
`;

export function createHud() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const crosshair = document.createElement('div');
  crosshair.id = 'hud-crosshair';

  const coords = document.createElement('div');
  coords.id = 'hud-coords';
  coords.textContent = 'X 0.0   Y 0.0   Z 0.0';

  const overlay = document.createElement('div');
  overlay.id = 'hud-overlay';
  overlay.innerHTML = `
    <div class="card">
      <h1>Mini Monde 3D</h1>
      <div class="keys">
        <b>Cliquez</b> pour explorer<br />
        <b>ZQSD</b> se déplacer &nbsp;·&nbsp; <b>Souris</b> regarder<br />
        <b>Maj</b> courir &nbsp;·&nbsp; <b>Espace</b> sauter &nbsp;·&nbsp; <b>Échap</b> libérer
      </div>
    </div>`;

  document.body.append(crosshair, coords, overlay);

  return {
    update(pos) {
      coords.textContent = `X ${pos.x.toFixed(1)}   Y ${pos.y.toFixed(1)}   Z ${pos.z.toFixed(1)}`;
    },
    setLocked(isLocked) {
      overlay.style.opacity = isLocked ? '0' : '1';
    },
  };
}
