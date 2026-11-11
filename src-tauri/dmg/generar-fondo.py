"""Fondo de la ventana del .dmg: la flecha y la instrucción de arrastrar a Aplicaciones.

Uso (desde la raíz del repo):
    python3 src-tauri/dmg/generar-fondo.py public/brand/closelabs-black.png src-tauri/dmg
    cd src-tauri/dmg && tiffutil -cathidpicheck fondo.png fondo@2x.png -out fondo.tiff && rm fondo*.png

⚠️ Los recuadros van centrados en (170, 215) y (490, 215): son `appPosition` y
`applicationFolderPosition` de `bundle.macOS.dmg` en tauri.conf.json. Si se mueve uno, el otro.
El .tiff lleva 1x y 2x juntos para que se vea nítido en pantallas Retina.
"""
import sys
from PIL import Image, ImageDraw, ImageFont
logo_path, out_dir = sys.argv[1], sys.argv[2]
FONT = "/System/Library/Fonts/HelveticaNeue.ttc"
# índices de HelveticaNeue.ttc: 0 Regular, 1 Bold
def fuente(px, bold): return ImageFont.truetype(FONT, px, index=1 if bold else 0)

def dibujar(esc):
    W, H = 660*esc, 400*esc
    im = Image.new("RGB", (W, H), "#FBF8FF")
    d = ImageDraw.Draw(im)
    # logo
    logo = Image.open(logo_path).convert("RGBA")
    lw = 150*esc; lh = int(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    im.paste(logo, ((W-lw)//2, 26*esc), logo)
    # título
    t = "Arrastra el ícono a la carpeta Aplicaciones"
    f = fuente(22*esc, True)
    tw = d.textlength(t, font=f)
    d.text(((W-tw)/2, 84*esc), t, font=f, fill="#1A1620")
    # zonas suaves detrás de los íconos (centros en 170,215 y 490,215)
    for cx in (170, 490):
        r = 84*esc
        d.rounded_rectangle((cx*esc-r, 215*esc-r-6*esc, cx*esc+r, 215*esc+r+10*esc), radius=22*esc,
                            fill="#F1E7FF" if cx==490 else "#FFFFFF", outline="#E4D6F7", width=2*esc)
    # flecha
    y = 205*esc
    x0, x1 = 268*esc, 384*esc
    col = "#A439FF"
    d.line((x0, y, x1, y), fill=col, width=8*esc)
    d.polygon([(x1+22*esc, y), (x1-6*esc, y-20*esc), (x1-6*esc, y+20*esc)], fill=col)
    # pie
    p = "Luego abre CloseLabs Voice desde Aplicaciones."
    f2 = fuente(16*esc, False)
    pw = d.textlength(p, font=f2)
    d.text(((W-pw)/2, 330*esc), p, font=f2, fill="#6F677E")
    return im

dibujar(1).save(f"{out_dir}/fondo.png")
dibujar(2).save(f"{out_dir}/fondo@2x.png")
