# -*- coding: utf-8 -*-
"""Genera las ilustraciones (SVG) y las maquetas (HTML) de diseno/.

    python3 diseno/herramientas/gen.py          # SVG + maquetas/index.html
    python3 diseno/herramientas/gen.py --png    # además, el fondo del .dmg en PNG @1x y @2x
                                                # (usa Google Chrome sin ventana; necesita internet
                                                #  para cargar Newsreader y Schibsted Grotesk)
El contenido de las pantallas está en pagina.py.
"""
import math, os, subprocess, sys, tempfile, shutil
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
TINTA="#18141D"; LILA="#A439FF"; LILA_SUAVE="#F3E8FF"; LINO="#F5F1F8"; LINEA="#CFCAD4"

def onda(x0,x1,y,amp,ciclos,n=220,fase=0.0):
    pts=[]
    for i in range(n+1):
        t=i/n; x=x0+(x1-x0)*t
        env=math.sin(math.pi*t)**1.4
        v=math.sin(2*math.pi*ciclos*t+fase)*0.78+math.sin(2*math.pi*ciclos*1.9*t+1.3)*0.22
        pts.append((x,y+amp*env*v))
    return "M"+" L".join("%.1f %.1f"%p for p in pts)

def svg(w,h,cuerpo):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" fill="none" '
            'stroke-linecap="round" stroke-linejoin="round">\n%s\n</svg>')%(w,h,w,h,cuerpo)

def il_voz():   # la voz se vuelve renglón (bienvenida e instalación)
    c=[]
    c.append('<path d="M286 84 Q284 76 293 75 L484 71 Q493 71 493 80 L497 332 Q497 341 488 341 L291 345 Q282 345 282 336 Z" fill="#FFFFFF" stroke="%s" stroke-width="2"/>'%TINTA)
    c.append('<path d="M352 62 Q352 56 358 56 L420 55 Q426 55 426 61 L426 82 Q426 87 421 87 L357 88 Q352 88 352 83 Z" fill="%s" stroke="%s" stroke-width="2"/>'%(LILA_SUAVE,TINTA))
    c.append('<path d="M372 71 L406 70.5" stroke="%s" stroke-width="2"/>'%TINTA)
    c.append('<path d="M310 124 L392 123" stroke="%s" stroke-width="5"/>'%TINTA)
    for y,x2 in ((154,466),(180,448)):
        c.append('<path d="M310 %d L%d %d" stroke="%s" stroke-width="2.5" opacity=".28"/>'%(y,x2,y-1,TINTA))
    c.append('<path d="%s L250 208 L458 207" stroke="%s" stroke-width="3"/>'%(onda(22,236,208,58,6.5),LILA))
    c.append('<path d="M310 235 L402 234" stroke="%s" stroke-width="3"/>'%LILA)
    c.append('<path d="M412 224 L412 245" stroke="%s" stroke-width="2.5"/>'%TINTA)
    for y,x2 in ((264,470),(290,440),(316,380)):
        c.append('<path d="M310 %d L%d %d" stroke="%s" stroke-width="2.5" stroke-dasharray="1 9"/>'%(y,x2,y,LINEA))
    return svg(520,400,"\n".join(c))

def il_priv():
    c=[]
    c.append('<path d="M150 70 Q148 62 157 61 L348 57 Q357 57 357 66 L361 318 Q361 327 352 327 L155 331 Q146 331 146 322 Z" fill="#FFFFFF" stroke="%s" stroke-width="2"/>'%TINTA)
    c.append('<path d="M176 108 L258 107" stroke="%s" stroke-width="5"/>'%TINTA)
    for y,x2 in ((140,330),(166,312),(192,326),(218,270)):
        c.append('<path d="M176 %d L%d %d" stroke="%s" stroke-width="2.5" opacity=".28"/>'%(y,x2,y-1,TINTA))
    c.append('<path d="M300 246 L300 218 Q300 182 336 182 Q372 182 372 218 L372 246" stroke="%s" stroke-width="2"/>'%TINTA)
    c.append('<path d="M278 254 Q278 245 287 245 L386 244 Q395 244 395 253 L396 330 Q396 339 387 339 L288 340 Q279 340 279 331 Z" fill="%s" stroke="%s" stroke-width="2"/>'%(LILA_SUAVE,TINTA))
    c.append('<circle cx="337" cy="283" r="9" fill="%s"/>'%LILA)
    c.append('<path d="M337 290 L337 310" stroke="%s" stroke-width="5"/>'%LILA)
    return svg(520,400,"\n".join(c))

def il_correo():
    c=[]
    c.append('<path d="M166 88 Q166 80 174 80 L346 77 Q354 77 354 85 L356 250 L164 252 Z" fill="#FFFFFF" stroke="%s" stroke-width="2"/>'%TINTA)
    c.append('<path d="M190 112 L262 111" stroke="%s" stroke-width="5"/>'%TINTA)
    for i in range(6):
        x=188+i*25
        col = LILA if i==5 else TINTA
        c.append('<rect x="%d" y="136" width="19" height="26" rx="5" stroke="%s" stroke-width="%s" fill="#FFFFFF"/>'%(x,col,2.5 if i==5 else 2))
        if i<5: c.append('<circle cx="%.1f" cy="149" r="2.6" fill="%s"/>'%(x+9.5,TINTA))
    c.append('<path d="M118 196 L260 286 L402 194 L404 330 Q404 339 395 339 L127 341 Q118 341 118 332 Z" fill="%s" stroke="%s" stroke-width="2"/>'%(LILA_SUAVE,TINTA))
    c.append('<path d="M120 336 L214 258 M402 334 L306 257" stroke="%s" stroke-width="2"/>'%TINTA)
    return svg(520,400,"\n".join(c))

def il_dmg():
    c=['<rect width="560" height="400" fill="%s"/>'%LINO]
    c.append('<path d="%s" stroke="%s" stroke-width="3"/>'%(onda(-6,192,215,40,6.5,fase=0.4),LILA))
    for y,x2 in ((195,522),(215,566),(235,478)):
        c.append('<path d="M370 %d L%d %d" stroke="%s" stroke-width="3"/>'%(y,x2,y,TINTA))
    c.append('<path d="M352 150 L364 136 M362 162 L380 154 M340 142 L344 124" stroke="%s" stroke-width="2.5"/>'%TINTA)
    c.append('<text x="280" y="76" text-anchor="middle" font-family="Newsreader, Georgia, serif" font-size="34" font-weight="500" fill="%s" letter-spacing="-0.4">Haz <tspan font-style="italic" fill="%s">doble clic</tspan> en el ícono</text>'%(TINTA,LILA))
    c.append('<text x="280" y="330" text-anchor="middle" font-family="\'Schibsted Grotesk\', Helvetica, sans-serif" font-size="15" fill="#55505E">Se instala sola en unos segundos.</text>')
    # Si la versión anterior sigue abierta (el botón rojo solo esconde la ventana), macOS no deja abrir
    # la nueva y dice "can't be opened" (REVISION-PRIMER-USO.md, 2026-11-12). Mismo texto que la web.
    c.append('<path d="M150 348 L410 348" stroke="%s" stroke-width="1"/>'%LINEA)
    nota='font-family="\'Schibsted Grotesk\', Helvetica, sans-serif" font-size="13" fill="#55505E"'
    c.append('<text x="280" y="368" text-anchor="middle" %s><tspan font-weight="600" fill="%s">¿Ya tenías CloseLabs Voice?</tspan> Ciérrala antes: clic en su ícono,</text>'%(nota,TINTA))
    c.append('<text x="280" y="386" text-anchor="middle" %s>arriba a la derecha, y luego <tspan font-weight="600" fill="%s">Salir</tspan>. O reinicia tu Mac.</text>'%(nota,TINTA))
    return svg(560,400,"\n".join(c))

ILS={"voz-a-texto.svg":il_voz(),"privacidad.svg":il_priv(),"correo-codigo.svg":il_correo(),"dmg-fondo.svg":il_dmg()}
for n,s in ILS.items():
    open(os.path.join(RAIZ,"ilustraciones",n),"w").write(s+"\n")

exec(open(os.path.join(AQUI,"pagina.py")).read())

if "--png" in sys.argv:
    chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    tmp=tempfile.mkdtemp()
    html=os.path.join(tmp,"dmg.html")
    open(html,"w").write('<!doctype html><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,500;1,6..72,500&family=Schibsted+Grotesk:wght@400;600&display=swap" rel="stylesheet"><style>html,body{margin:0;overflow:hidden}svg{display:block}</style>'+ILS["dmg-fondo.svg"])
    for esc,nombre in ((1,"dmg-fondo.png"),(2,"dmg-fondo@2x.png")):
        subprocess.run([chrome,"--headless=new","--disable-gpu","--hide-scrollbars","--user-data-dir="+os.path.join(tmp,"perfil"),
                        "--window-size=560,400","--force-device-scale-factor=%d"%esc,"--virtual-time-budget=6000",
                        "--screenshot="+os.path.join(RAIZ,"ilustraciones",nombre),"file://"+html],stderr=subprocess.DEVNULL)
        print("png",nombre)
    shutil.rmtree(tmp,ignore_errors=True)
