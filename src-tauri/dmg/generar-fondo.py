"""⚠️ YA NO SE USA (2026-11-12). El fondo actual es el de «Tinta y voz», dibujado por diseño en
`diseno/ilustraciones/dmg-fondo.svg` y exportado con `python3 diseno/herramientas/gen.py --png`.
Para regenerar `fondo.tiff`:
    cd src-tauri/dmg && cp ../../diseno/ilustraciones/dmg-fondo.png fondo.png \
      && cp ../../diseno/ilustraciones/dmg-fondo@2x.png fondo@2x.png \
      && tiffutil -cathidpicheck fondo.png fondo@2x.png -out fondo.tiff && rm fondo*.png
Se deja este script como referencia del fondo anterior.

Fondo de la ventana del .dmg: "Haz doble clic aquí para instalar", con el ícono solo en el centro.

Desde 2026-11-11 (decisión de Nicolás) el .dmg NO trae la carpeta Aplicaciones: arrastrar era el
gesto que más costaba, y la carpeta decía "Applications" en inglés. El doble clic abre la app, que se
copia sola a Aplicaciones (ver `src-tauri/src/instalacion_mac.rs`). El enlace a Applications que
Tauri mete siempre se borra después de armar el .dmg (paso "Leave only the app in the .dmg" de
`.github/workflows/build-macos-universal.yml`).

Uso (desde la raíz del repo):
    python3 src-tauri/dmg/generar-fondo.py public/brand/closelabs-black.png src-tauri/dmg
    cd src-tauri/dmg && tiffutil -cathidpicheck fondo.png fondo@2x.png -out fondo.tiff && rm fondo*.png

⚠️ El recuadro va centrado en (280, 215): es `appPosition` de `bundle.macOS.dmg` en tauri.conf.json,
y la ventana mide 560x400 (`windowSize`). Si se cambia uno, el otro.
El .tiff lleva 1x y 2x juntos para que se vea nítido en pantallas Retina.
"""
import sys
from PIL import Image, ImageDraw, ImageFont
logo_path, out_dir = sys.argv[1], sys.argv[2]
FONT = "/System/Library/Fonts/HelveticaNeue.ttc"
# índices de HelveticaNeue.ttc: 0 Regular, 1 Bold
def fuente(px, bold): return ImageFont.truetype(FONT, px, index=1 if bold else 0)

W0, H0 = 560, 400
CX, CY = 280, 215

def centrado(d, y, texto, f, color, W):
    tw = d.textlength(texto, font=f)
    d.text(((W - tw) / 2, y), texto, font=f, fill=color)

def dibujar(esc):
    W, H = W0*esc, H0*esc
    im = Image.new("RGB", (W, H), "#FBF8FF")
    d = ImageDraw.Draw(im)
    # logo
    logo = Image.open(logo_path).convert("RGBA")
    lw = 130*esc; lh = int(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    im.paste(logo, ((W-lw)//2, 22*esc), logo)
    # título
    centrado(d, 68*esc, "Haz doble clic en el ícono", fuente(26*esc, True), "#1A1620", W)
    # recuadro detrás del ícono (el nombre de la app lo pone el Finder debajo del ícono)
    r = 86*esc
    d.rounded_rectangle((CX*esc-r, CY*esc-r, CX*esc+r, CY*esc+r+16*esc), radius=26*esc,
                        fill="#F1E7FF", outline="#A439FF", width=3*esc)
    # pie
    centrado(d, 330*esc, "Se instala sola en unos segundos.", fuente(17*esc, False), "#6F677E", W)
    return im

dibujar(1).save(f"{out_dir}/fondo.png")
dibujar(2).save(f"{out_dir}/fondo@2x.png")
