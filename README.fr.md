<p align="center">
  <img src="src/assets/eraw-icon.svg" width="96" alt="Icône eRAW">
</p>

<h1 align="center">eRAW</h1>

<p align="center">Visionneuse, outil de diagnostic et convertisseur d’images RAW pour la mise au point de SoC et de capteurs d’image.</p>

<p align="center">
  <a href="https://github.com/woooooooooolf/eRAW/actions/workflows/ci.yml"><img src="https://github.com/woooooooooolf/eRAW/actions/workflows/ci.yml/badge.svg?branch=master" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0--or--later-2ea44f?style=flat-square" alt="Licence"></a>
  <img src="https://img.shields.io/badge/platform-Windows-0078D4?style=flat-square&amp;logo=windows11&amp;logoColor=white" alt="Windows">
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&amp;logo=tauri&amp;logoColor=white" alt="Tauri 2"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.es.md">Español</a> · Français · <a href="README.de.md">Deutsch</a>
</p>

## Captures d’écran

![Fenêtre principale d’eRAW en français](docs/images/readme-main-fr.jpg)

## Téléchargement

Téléchargez la dernière version Windows x64 et consultez ses notes dans [GitHub Releases](https://github.com/woooooooooolf/eRAW/releases/latest).

## Fonctionnalités principales

- Lecture de RAW8, de RAW9–RAW16 dans des conteneurs 16 bits et de MIPI RAW10/12/14.
- Prise en charge de Mono, de quatre motifs Bayer et de quatre motifs Quad CFA.
- Taille active, décalage d’en-tête, stride et alignement des lignes/trames configurables, avec navigation multiframe.
- Affichages de l’intensité RAW, du CFA, du Remosaic, du Demosaic et des canaux R/G/B individuels.
- Rendu hiérarchique par tuiles, LOD et cache de tuiles GPU pour les grandes images.
- Zoom, déplacement, inspection des pixels, identification du canal CFA d’origine et lecture du DN.
- Neuf thèmes d’interface et sept langues, commutables pendant l’exécution.

## Formats et affichage

| Catégorie | Prise en charge actuelle |
| --- | --- |
| Stockage | Unpacked 8, Unpacked 16, MIPI RAW10, MIPI RAW12, MIPI RAW14 |
| Profondeur | RAW8–RAW16 ; en MIPI, elle est déterminée par le mode de stockage |
| CFA | Mono, RGGB, BGGR, GBRG, GRBG et les quatre motifs Quad CFA correspondants |
| Disposition des octets | Little/Big Endian, bits valides LSB/MSB, décalage d’en-tête, stride et alignement des lignes/trames |
| Traitement | Réorganisation Quad CFA, reconstruction bilinéaire de même couleur, Demosaic bilinéaire |
| Inspection | Navigation multiframe, zoom/déplacement, grille de pixels, coordonnées, canal CFA et DN |

L’affichage tolère autant que possible les données tronquées ou incomplètes et présente des diagnostics explicites. L’export applique une validation stricte afin d’éviter les sorties incomplètes ou ambiguës.

## Export et capture

- Conversion et export des données CFA d’origine, avec recadrage, suppression du padding, conversion packed/unpacked et ordre des octets.
- Export de la trame courante en données Remosaic Bayer ou RGB48 Interleaved.
- Enregistrement de la fenêtre du canevas ou de l’aperçu complet en PNG, ou copie dans le presse-papiers.

## Plateforme et technologies

eRAW cible actuellement Windows en priorité et repose sur Tauri 2 :

- Frontend : TypeScript, WebGL2, Canvas 2D, HTML/CSS natifs
- Backend : Rust, mappage mémoire en lecture seule, IPC Tauri binaire
- Dépendance d’exécution : Windows WebView2 Runtime

## Exécution depuis les sources

Node.js, Rust stable, Windows WebView2 et les dépendances système requises par Tauri 2 sont nécessaires.

```powershell
npm.cmd install
npm.cmd run tauri dev
```

## Vérification, tests et compilation

```powershell
npm.cmd run check
npm.cmd run test:frontend
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml
npm.cmd run release
```

`npm.cmd run release` utilise la CLI Tauri pour produire un EXE Release Windows contenant les ressources du frontend. Ne le remplacez pas par un simple `cargo build --release`, qui ignore la compilation du frontend et l’intégration des ressources.

## Documentation technique

Consultez l’[index de la documentation technique](docs/README.md) pour les décisions produit, l’architecture, la sémantique RAW, le rendu, les tests et le processus de développement.

## Périmètre actuel

- eRAW sert au diagnostic des données brutes du capteur ; il n’effectue pas d’amélioration photographique telle que la réduction du bruit, l’accentuation, la correction des couleurs ou la réparation des pixels défectueux.
- Le Demosaic utilise actuellement un algorithme bilinéaire.
- La sélection d’un ROI rectangulaire, la saisie de coordonnées et les statistiques de région sur les DN CFA RAW L0 sont prises en charge.
- Aucun traitement par lots générique n’est proposé.

## Maintenance et contributions

Le projet privilégie actuellement la stabilité, la correction des défauts et la complétude des flux existants. Les défauts reproductibles, la compatibilité, la documentation, les tests et les optimisations limitées qui préservent la sémantique actuelle sont bienvenus. Les fonctions modifiant sensiblement l’architecture, le traitement ou le comportement utilisateur ne sont généralement pas prioritaires ; leur nécessité, leur périmètre et leur coût de maintenance à long terme doivent d’abord être expliqués.

Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour le périmètre et le processus, et [SECURITY.md](SECURITY.md) pour signaler une vulnérabilité.

## Licence

eRAW est distribué sous la [GNU General Public License v3.0 or later](LICENSE).
