<p align="center">
  <img src="src/assets/eraw-icon.svg" width="96" alt="Icono de eRAW">
</p>

<h1 align="center">eRAW</h1>

<p align="center">Visor, herramienta de diagnóstico y conversor de imágenes RAW para la puesta en marcha de SoC y sensores de imagen.</p>

<p align="center">
  <a href="https://github.com/woooooooooolf/eRAW/stargazers"><img src="https://img.shields.io/github/stars/woooooooooolf/eRAW?style=flat-square&amp;logo=github" alt="GitHub Stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/woooooooooolf/eRAW?style=flat-square" alt="Licencia"></a>
  <img src="https://img.shields.io/badge/platform-Windows-0078D4?style=flat-square&amp;logo=windows11&amp;logoColor=white" alt="Windows">
  <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&amp;logo=tauri&amp;logoColor=white" alt="Tauri 2"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.ja.md">日本語</a> · Español · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a>
</p>

## Capturas de pantalla

![Ventana principal de eRAW con el tema oscuro Violeta Obsidiana](docs/images/readme-main-dark.png)

![Ajustes de eRAW con el tema claro Azul Polar](docs/images/readme-settings-light.png)

## Funciones principales

- Lee RAW8, RAW9–RAW16 en contenedores de 16 bits y MIPI RAW10/12/14.
- Admite Mono, cuatro patrones Bayer y cuatro patrones Quad CFA.
- Permite configurar el tamaño activo, el desplazamiento de cabecera y el stride y la alineación de filas y fotogramas, con navegación entre varios fotogramas.
- Vistas de intensidad RAW, CFA, Remosaic, Demosaic y canales R/G/B individuales.
- Renderizado jerárquico por mosaicos, LOD y caché de mosaicos en la GPU para imágenes grandes.
- Zoom, desplazamiento, inspección de píxeles, identificación del canal CFA original y lectura de DN.
- Nueve temas de interfaz y siete idiomas que pueden cambiarse durante la ejecución.

## Formatos y visualización

| Categoría | Compatibilidad actual |
| --- | --- |
| Almacenamiento | Unpacked 8, Unpacked 16, MIPI RAW10, MIPI RAW12, MIPI RAW14 |
| Profundidad de bits | RAW8–RAW16; en MIPI la determina el modo de almacenamiento |
| CFA | Mono, RGGB, BGGR, GBRG, GRBG y los cuatro patrones Quad CFA correspondientes |
| Disposición de bytes | Little/Big Endian, bits válidos LSB/MSB, desplazamiento de cabecera y stride/alineación de filas y fotogramas |
| Procesamiento | Reordenación Quad CFA, reconstrucción bilineal del mismo color y Demosaic bilineal |
| Inspección | Navegación entre fotogramas, zoom/desplazamiento, cuadrícula de píxeles, coordenadas, canal CFA y DN |

La visualización tolera, cuando es posible, entradas truncadas o incompletas y muestra diagnósticos explícitos. La exportación aplica una validación estricta para evitar resultados incompletos o ambiguos.

## Exportación y captura

- Convierte y exporta los datos CFA originales, incluidos recorte, eliminación de padding, conversión packed/unpacked y orden de bytes.
- Exporta el fotograma actual como datos Remosaic Bayer o RGB48 Interleaved.
- Guarda la ventana del lienzo o la vista previa completa como PNG, o las copia al portapapeles.

## Plataforma y tecnologías

eRAW se dirige actualmente primero a Windows y está construido con Tauri 2:

- Frontend: TypeScript, WebGL2, Canvas 2D y HTML/CSS nativos
- Backend: Rust, mapeo de memoria de solo lectura y Tauri IPC binario
- Dependencia de ejecución: Windows WebView2 Runtime

## Ejecutar desde el código fuente

Se necesitan Node.js, Rust estable, Windows WebView2 y las dependencias del sistema requeridas por Tauri 2.

```powershell
npm.cmd install
npm.cmd run tauri dev
```

## Comprobación, pruebas y compilación

```powershell
npm.cmd run check
npm.cmd run test:frontend
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml
npm.cmd run release
```

`npm.cmd run release` usa Tauri CLI para crear un EXE Release de Windows con los recursos del frontend integrados. No debe sustituirse por un `cargo build --release` aislado, ya que este omite la compilación del frontend y la integración de recursos.

## Documentación técnica

Consulta el [índice de documentación técnica](docs/README.md) para conocer las decisiones de producto, la arquitectura, la semántica RAW, el renderizado, las pruebas y el flujo de desarrollo.

## Alcance actual

- eRAW diagnostica datos sin procesar del sensor; no realiza mejoras fotográficas como reducción de ruido, enfoque, corrección de color o reparación de píxeles defectuosos.
- Demosaic utiliza actualmente un algoritmo bilineal.
- Existe un modelo de selección rectangular reservado, pero todavía no está conectado a las estadísticas de región.
- No hay un flujo de procesamiento por lotes de propósito general.

## Licencia

eRAW se publica bajo la [GNU General Public License v3.0 or later](LICENSE).
