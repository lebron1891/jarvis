# Carnet de Sambo

Carnet personnel des techniques de Sambo apprises à l'entraînement.
Un seul fichier HTML (`carnet-sambo.html`) : pas d'installation, pas de dépendance, aucune connexion réseau.

| Fichier | Rôle |
|---|---|
| `carnet-sambo.html` | L'application complète (HTML, CSS et JS dans le même fichier). |
| `sw.js` | **Facultatif.** Permet d'ouvrir le carnet sans réseau quand il est hébergé (iPhone). |

Le carnet est livré vide, avec une seule fiche d'**exemple** qui montre le format. Elle porte le badge EXEMPLE,
n'est jamais proposée en révision et ne revient pas une fois supprimée.

## Sur le PC

Double-clique sur `carnet-sambo.html` : il s'ouvre dans le navigateur et fonctionne hors-ligne.
Les données sont enregistrées dans ce navigateur.

## Sur iPhone

Safari ne sait pas exécuter un fichier HTML stocké dans l'app Fichiers. Il faut donc que la page soit
accessible par une adresse `https://`. Tes fiches, elles, restent uniquement sur le téléphone.

1. **Héberger le dossier `sambo/`** (les deux fichiers ensemble) sur un hébergeur de pages statiques, par exemple :
   - **GitHub Pages** sur ce dépôt (il est public) : Settings → Pages → choisir la branche et le dossier.
     L'adresse sera du type `https://<compte>.github.io/jarvis/sambo/carnet-sambo.html`.
   - ou un service « glisser-déposer » (Netlify Drop, Cloudflare Pages…) avec uniquement le dossier `sambo/`.

   La page publiée ne contient aucune donnée personnelle : c'est le carnet vide.
2. Ouvre l'adresse dans **Safari**, puis bouton **Partager → « Sur l'écran d'accueil »**.
3. Ouvre toujours le carnet **depuis l'icône** :
   - il fonctionne hors-ligne dès la première ouverture (grâce à `sw.js`) ;
   - Safari et l'icône n'ont **pas** le même stockage : ce que tu saisis dans l'un n'apparaît pas dans l'autre ;
   - Safari peut effacer les données d'un site non visité pendant 7 jours d'utilisation du navigateur ; l'icône de l'écran d'accueil n'est pas concernée.

Quand la page hébergée est mise à jour, la nouvelle version s'affiche au lancement suivant (avec réseau).

## Sauvegarder et transférer (onglet « Sauvegarde »)

- **Exporter** crée `carnet-sambo-AAAA-MM-JJ.json`. Sur iPhone : « Partager le fichier » → *Enregistrer dans Fichiers*,
  AirDrop vers le PC, ou e-mail.
- **Importer → Fusionner** : ajoute les fiches nouvelles, réunit les notes de séance des deux côtés, garde la date de
  révision la plus récente, et pour le reste de chaque fiche garde la version modifiée le plus récemment.
  Limite : une fiche supprimée d'un côté revient si on fusionne un ancien export.
- **Importer → Remplacer** : efface le carnet de l'appareil et le remplace par le fichier.

Un point orange sur l'onglet Sauvegarde rappelle d'exporter quand tu ne l'as jamais fait, ou quand tu as modifié le
carnet depuis ton dernier export datant d'au moins 7 jours.

## Format des données

Stockage : une clé `localStorage` `carnetSambo` (même format que le fichier exporté, sans `exporteLe`).

```json
{
  "app": "carnet-sambo",
  "version": 1,
  "exporteLe": "2026-09-23T20:15:00",
  "techniques": [
    {
      "id": "t_m1x9k2_a7f3",
      "exemple": false,
      "nomRusse": "",
      "nomFrancais": "",
      "categorie": "projection | controle | soumission | defense | transition",
      "position": "Debout kimono",
      "etapes": ["…"],
      "pointsCles": ["…"],
      "erreurs": ["…"],
      "video": "https://…",
      "statut": "jamais | en_cours | fiable",
      "derniereRevision": "2026-09-23 ou null",
      "notes": [{ "id": "n_…", "date": "2026-09-23T20:10:00", "texte": "…" }],
      "creeLe": "2026-09-01T19:00:00",
      "modifieLe": "2026-09-23T20:10:00"
    }
  ]
}
```

Règles :
- `modifieLe` change quand on édite la fiche ou son statut ; ajouter une note ou marquer une révision ne le change pas.
- Le mode Révision tire au hasard une fiche (hors exemple) jamais révisée ou révisée il y a plus de 14 jours.
- Ajouter une note de séance marque la fiche comme révisée aujourd'hui (case cochée par défaut, décochable).
