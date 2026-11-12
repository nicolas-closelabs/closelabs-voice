# -*- coding: utf-8 -*-
# Contenido de las maquetas. Se ejecuta desde gen.py (comparte RAIZ, ILS, onda…).
BR = "../../public/brand/"
ICONO = "../../src-tauri/icons/128x128@2x.png"

CSS = r"""
:root{
  --tinta:#18141D; --tinta-2:#55505E; --tinta-3:#6E6877;
  --papel:#FFFFFF; --lino:#F5F1F8; --lino-2:#ECE7F0;
  --linea:#E6E2EA; --linea-fuerte:#CFCAD4;
  --lila:#A439FF; --lila-hover:#8B2FF3; --lila-texto:#8B2FF3; --lila-suave:#F3E8FF; --lila-tinta:#5E1AA6; --lila-claro:#C79BFF; --lila-borde:#7A1FD1;
  --noche:#18141D; --noche-2:#221B29;
  --ok:#1F7A4D; --aviso:#6B4500; --aviso-fondo:#FFF3D6; --aviso-punto:#C98A00; --error:#B3261E;
  --serif:"Newsreader", Georgia, "Times New Roman", serif;
  --sans:"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif;
  --sombra-1:0 1px 2px rgba(24,20,29,.06);
  --sombra-2:0 1px 2px rgba(24,20,29,.05), 0 10px 28px rgba(24,20,29,.08);
  --sombra-flota:0 8px 24px rgba(0,0,0,.28);
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#DDD9E0;color:var(--tinta);font-family:var(--sans);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
img{display:block}
em{font-style:italic}
h1 em{color:var(--lila)}
.pagina{width:1184px;margin:0 auto;padding:72px 0 120px}
.portada h1{font-family:var(--serif);font-weight:500;font-size:64px;line-height:68px;letter-spacing:-.02em;max-width:900px}
.portada>p{font-size:18px;line-height:28px;color:var(--tinta-2);max-width:780px;margin-top:20px}
.portada .fila{display:flex;gap:32px;margin-top:40px}
.muestra{flex:1;background:var(--papel);border-radius:16px;padding:28px;box-shadow:var(--sombra-1)}
.muestra h4{font-size:14px;font-weight:600;color:var(--tinta-3);margin-bottom:16px}
.colores{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.colores div{font-size:14px;line-height:18px;color:var(--tinta-2)}
.colores i{display:block;height:56px;border-radius:10px;margin-bottom:8px;border:1px solid rgba(24,20,29,.08)}
.dosis{display:grid;gap:10px;font-size:15px;line-height:22px;color:var(--tinta-2)}
.dosis b{color:var(--tinta);font-weight:600}
.dosis div{display:flex;gap:12px}.dosis i{flex:none;width:10px;height:10px;border-radius:50%;background:var(--lila);margin-top:6px}
.dosis i.no{background:none;border:1.5px solid var(--linea-fuerte)}

.marco{margin-top:96px}
.marco>header{display:flex;align-items:baseline;gap:14px;margin-bottom:20px;padding:0 32px}
.marco>header .n{font-family:var(--serif);font-style:italic;font-size:22px;color:var(--tinta-3)}
.marco>header h3{font-size:20px;font-weight:600;white-space:nowrap}
.marco>header p{font-size:15px;color:var(--tinta-2);margin-left:auto;max-width:660px;text-align:right}
.lienzo{display:flex;flex-direction:column;align-items:center;gap:40px}
.sub{font-size:15px;font-weight:600;color:var(--tinta-2);margin-bottom:-24px;align-self:flex-start;padding-left:32px}

/* ---------- ventana ---------- */
.ventana{border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px rgba(24,20,29,.14),0 24px 60px rgba(24,20,29,.18);background:var(--papel)}
.barra-titulo{height:32px;background:#ECE9EE;display:flex;align-items:center;justify-content:center;position:relative;font-size:13px;font-weight:600;color:#6E6877;border-bottom:1px solid var(--linea)}
.barra-titulo b{position:absolute;left:12px;top:10px;display:flex;gap:8px}
.barra-titulo b i{width:12px;height:12px;border-radius:50%;background:#CFCAD4}

/* ---------- plantilla del primer uso: 1120 x 680 ---------- */
.ob{width:1120px;height:680px;background:var(--papel);display:flex;flex-direction:column;position:relative}
.ob-top{height:64px;flex:none;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 32px 0 24px;border-bottom:1px solid var(--linea)}
.logo{width:132px;height:auto}
.etapas{display:flex;gap:12px}
.etapa{width:104px;font-size:14px;font-weight:600;color:var(--tinta-3);display:flex;flex-direction:column;gap:8px}
.etapa i{height:3px;border-radius:2px;background:var(--linea)}
.etapa.hecha,.etapa.actual{color:var(--tinta)}
.etapa.hecha i{background:var(--tinta)}
.etapa.actual i{background:var(--lila)}
.ayuda{justify-self:end;font-size:15px;font-weight:600;color:var(--tinta);text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--linea-fuerte)}
.ob-cuerpo{flex:1;display:flex;min-height:0}
.ob-izq{width:500px;flex:none;padding:36px 56px 0 64px;position:relative}
.atras{height:24px;font-size:15px;font-weight:600;color:var(--tinta-2);display:flex;align-items:center;gap:8px}
.ob-izq h1{font-family:var(--serif);font-weight:500;font-size:40px;line-height:46px;letter-spacing:-.015em;margin-top:24px}
.ob-izq .p{font-size:18px;line-height:28px;color:var(--tinta-2);margin-top:14px}
.ob-pie{position:absolute;left:64px;right:56px;bottom:32px}
.btn{height:56px;border-radius:12px;background:var(--lila);color:#fff;font:600 17px/1 var(--sans);display:flex;align-items:center;justify-content:center;width:100%;border:0;white-space:nowrap}
.btn.off{background:var(--linea);color:var(--tinta-3)}
.btn.sec{background:#fff;color:var(--tinta);border:1.5px solid var(--linea-fuerte)}
.btn.chico{height:44px;width:auto;padding:0 20px;font-size:16px;display:inline-flex}
.btn.rojo{background:#fff;color:var(--error);border:1.5px solid #E3B8B4}
.enlace{display:block;text-align:center;height:24px;line-height:24px;margin-top:12px;font-size:16px;font-weight:600;color:var(--tinta);text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--linea-fuerte)}
.enlace.vacio{visibility:hidden}
.enl{font-size:15px;font-weight:600;color:var(--tinta);text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--linea-fuerte)}
.ob-esc{flex:1;background:var(--lino);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;gap:20px}
.pie-il{font-size:16px;line-height:24px;color:var(--tinta-2);text-align:center;max-width:380px}

/* oscuro (solo recompensa) */
.ob.noche{background:var(--noche);color:#fff}
.ob.noche .ob-top{border-color:rgba(255,255,255,.12)}
.ob.noche .etapa{color:rgba(255,255,255,.6)} .ob.noche .etapa.hecha{color:#fff}
.ob.noche .etapa i{background:rgba(255,255,255,.16)} .ob.noche .etapa.hecha i{background:#fff}
.ob.noche .ayuda,.ob.noche .enlace{color:#fff;text-decoration-color:rgba(255,255,255,.35)}
.ob.noche .ob-izq .p{color:rgba(255,255,255,.72)}
.ob.noche h1 em{color:var(--lila-claro)}
.ob.noche .ob-esc{background:var(--noche-2)}

/* campos */
.campo{margin-top:14px}
.campo label{display:flex;justify-content:space-between;font-size:15px;font-weight:600;line-height:22px;margin-bottom:6px}
.campo label span{font-weight:600;color:var(--tinta-2);text-decoration:underline;text-underline-offset:3px}
.entrada{height:50px;border:1.5px solid var(--linea-fuerte);border-radius:12px;padding:0 16px;display:flex;align-items:center;font-size:17px;background:#fff}
.entrada.foco{border-color:var(--tinta);box-shadow:0 0 0 3px rgba(164,57,255,.28)}
.entrada.ph{color:var(--tinta-3)}
.cursor{display:inline-block;width:2px;height:22px;background:var(--tinta);margin-left:2px;vertical-align:-4px}
.casilla{display:flex;gap:12px;align-items:flex-start;font-size:15px;line-height:22px;color:var(--tinta-2);margin-top:16px}
.casilla i{flex:none;width:22px;height:22px;border-radius:6px;background:var(--tinta);display:flex;align-items:center;justify-content:center}
.casilla u{color:var(--tinta);text-underline-offset:3px}
.codigo{display:flex;gap:10px;margin-top:28px}
.codigo div{width:54px;height:68px;border:1.5px solid var(--linea-fuerte);border-radius:12px;display:flex;align-items:center;justify-content:center;font:500 34px/1 var(--serif)}
.codigo div.foco{border-color:var(--tinta);box-shadow:0 0 0 3px rgba(164,57,255,.28)}
.codigo div.foco::after{content:"";width:2px;height:30px;background:var(--tinta)}

/* tecla */
.tecla{display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:36px;padding:0 10px;border-radius:9px;background:#fff;border:1.5px solid var(--linea-fuerte);border-bottom-width:3.5px;font:600 16px/1 var(--sans);font-style:normal;color:var(--tinta);vertical-align:middle;position:relative;top:-2px}
.mas{font:500 16px var(--sans);color:var(--tinta-3);margin:0 5px;position:relative;top:-2px}
.tecla.g{height:112px;min-width:112px;padding:0 34px;border-radius:22px;border-width:2px;border-bottom-width:8px;font-size:30px;top:0}
.tecla.g.on{background:var(--lila);border-color:var(--lila-borde);color:#fff;border-bottom-width:3px;margin-top:5px}
.mas.g{font-size:30px;margin:0 18px;top:0}
.tecla.n{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.3);color:#fff;height:26px;min-width:26px;font-size:14px;border-radius:7px;border-bottom-width:2.5px;top:-1px;padding:0 7px}

/* lista de pasos (permisos, instalación) */
.permisos{margin-top:28px;border-top:1px solid var(--linea)}
.permiso{display:flex;align-items:center;gap:16px;padding:18px 0;border-bottom:1px solid var(--linea)}
.permiso .marca{flex:none;width:28px;height:28px;border-radius:50%;border:2px solid var(--linea-fuerte);display:flex;align-items:center;justify-content:center}
.permiso.listo .marca{background:var(--ok);border-color:var(--ok)}
.permiso.ahora .marca{border-color:var(--tinta)}
.permiso.vivo .marca{border-color:var(--lila);border-right-color:var(--lila-suave)}
.permiso.pend b{color:var(--tinta-3);font-weight:500}
.permiso b{display:block;font-size:17px;font-weight:600;line-height:24px}
.permiso span{display:block;font-size:15px;line-height:22px;color:var(--tinta-2)}
.permiso em{margin-left:auto;font-style:normal;font-size:15px;font-weight:600;color:var(--ok)}
.permisos.inst .permiso{padding:14px 0}

/* tarjeta de escenario */
.tarjeta{width:468px;background:#fff;border-radius:16px;box-shadow:var(--sombra-2);border:1px solid var(--linea);overflow:hidden}
.tarjeta .cab{height:52px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--linea);font-size:15px;font-weight:600;background:#FBFAFC}
.tarjeta .cab span{font-weight:500;color:var(--tinta-2)}
.tarjeta .cuerpo{padding:20px}
.hc-l{font-size:14px;font-weight:600;color:var(--tinta-2);margin-bottom:8px}
.hc-c{border:1.5px solid var(--linea-fuerte);border-radius:10px;padding:14px 16px;font-size:16px;line-height:25px;min-height:52px}
.hc-c.activo{border-color:var(--tinta)}
.hc-c.apagado{background:#FBFAFC;border-color:var(--linea)}
.hc-c .guia{font-size:15px;line-height:24px;color:var(--tinta-2)}
.hc-c .frase{font-family:var(--serif);font-style:italic;font-size:20px;line-height:29px;color:var(--tinta);margin:8px 0 10px}
.etiquetas{display:flex;gap:8px;justify-content:center;white-space:nowrap}
.etiqueta{height:34px;padding:0 14px 0 10px;border-radius:17px;background:var(--lila-suave);color:var(--lila-tinta);font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}
.rp{font-family:var(--serif);font-size:30px;font-weight:500;line-height:1;margin-bottom:8px}

/* barras de voz */
.barras{display:flex;align-items:center;justify-content:center;gap:6px;height:150px}
.barras i{width:8px;border-radius:4px;background:var(--lila)}
.fila-mic{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--linea);padding:16px 20px;font-size:16px}

/* píldora */
.pildora{height:44px;border-radius:22px;background:var(--noche);border:1px solid rgba(255,255,255,.18);box-shadow:var(--sombra-flota);display:inline-flex;align-items:center;padding:0 7px;gap:12px;color:#fff;white-space:nowrap}
.pildora .x,.pildora .okb{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}
.pildora .x{background:rgba(255,255,255,.14)} .pildora .okb{background:#fff}
.onda{display:flex;align-items:center;gap:3px;height:28px}
.onda i{width:3px;border-radius:2px;background:var(--lila-claro)}
.pildora.txt{padding:0 18px;font-size:15px;font-weight:600;gap:10px}
.pildora.txt .pt{width:9px;height:9px;border-radius:50%;background:#F2C14E;flex:none}
.puntos{display:flex;gap:4px}.puntos i{width:5px;height:5px;border-radius:50%;background:var(--lila-claro)}
.puntos i:nth-child(2){opacity:.65}.puntos i:nth-child(3){opacity:.35}
.pista{font-size:14px;font-weight:500;color:#fff;background:var(--noche);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:6px 12px;margin-bottom:8px;display:inline-flex;align-items:center;gap:6px;box-shadow:var(--sombra-flota)}
.flota{position:absolute;bottom:24px;left:0;right:0;display:flex;flex-direction:column;align-items:center}

/* chat */
.chat{background:#EEEAF1;padding:20px;display:flex;flex-direction:column;gap:14px}
.globo{background:#fff;border-radius:4px 14px 14px 14px;padding:10px 14px;font-size:16px;line-height:24px;max-width:330px;box-shadow:var(--sombra-1)}
.globo small{display:block;text-align:right;font-size:13px;color:var(--tinta-3);margin-top:2px}
.avatar{width:32px;height:32px;border-radius:50%;background:var(--lino-2);display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--tinta-2);margin-right:10px}

/* recompensa */
.cifra{font-family:var(--serif);font-weight:400;font-size:136px;line-height:1;letter-spacing:-.03em;color:#fff}
.cifra em{color:var(--lila-claro)}
.comparar{width:440px;display:flex;flex-direction:column;gap:20px;margin-top:20px}
.comparar .r{font-size:15px;color:rgba(255,255,255,.72);display:flex;justify-content:space-between;margin-bottom:8px}
.comparar .r b{color:#fff;font-weight:600}
.comparar i{display:block;height:10px;border-radius:5px;background:rgba(255,255,255,.3)}
.comparar i.tu{background:var(--lila)}
.ahorro{width:440px;margin-top:20px;border-top:1px solid rgba(255,255,255,.16);padding-top:18px;font-size:17px;line-height:26px;color:#fff}
.ahorro small{display:block;font-size:14px;line-height:20px;color:rgba(255,255,255,.6);margin-top:2px}

/* app */
.app{width:1120px;height:680px;display:flex;background:var(--papel)}
.lateral{width:248px;flex:none;background:var(--lino);padding:14px 16px 20px;display:flex;flex-direction:column}
.lateral .logo{margin:4px 0 26px 0}
.nav a{display:flex;align-items:center;height:46px;padding:0 16px;border-radius:10px;font-size:17px;font-weight:500;color:var(--tinta-2);position:relative}
.nav a.aqui{background:#fff;color:var(--tinta);font-weight:600;box-shadow:var(--sombra-1)}
.nav a.aqui::before{content:"";position:absolute;left:0;top:11px;bottom:11px;width:3px;border-radius:2px;background:var(--lila)}
.lateral .abajo{margin-top:auto;padding:0 16px;font-size:15px;color:var(--tinta-2);display:flex;align-items:center;gap:10px}
.lateral .abajo i{width:9px;height:9px;border-radius:50%;background:var(--ok)}
.lateral .abajo.sin i{background:var(--aviso-punto)}
.principal{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 72px;position:relative}
.frase-inicio{font-family:var(--serif);font-weight:500;font-size:42px;line-height:60px;letter-spacing:-.015em;text-align:center;max-width:700px}
.frase-inicio em{color:var(--lila)}
.frase-inicio .tecla{height:46px;min-width:46px;font-size:20px;border-radius:11px;top:-6px;padding:0 14px}
.frase-inicio .mas{top:-6px;font-size:20px}
.nota-inicio{position:absolute;bottom:32px;font-size:16px;color:var(--tinta-2)}
.nota-inicio u{color:var(--tinta);font-weight:600;text-underline-offset:4px;text-decoration-color:var(--linea-fuerte)}
.principal.arriba{align-items:stretch;justify-content:flex-start;padding:40px 72px 0}
.principal.arriba h1{font-family:var(--serif);font-weight:500;font-size:40px;line-height:46px;letter-spacing:-.015em}
.principal.arriba .p{font-size:18px;line-height:28px;color:var(--tinta-2);margin-top:8px}
.grupo{margin-top:24px}
.grupo h2{font-size:14px;font-weight:600;color:var(--tinta-3);padding-bottom:10px;border-bottom:1px solid var(--linea)}
.ajuste{display:flex;align-items:center;min-height:66px;border-bottom:1px solid var(--linea);gap:24px;padding:8px 0}
.ajuste b{display:block;font-size:17px;font-weight:600;line-height:24px}
.ajuste span{display:block;font-size:15px;line-height:22px;color:var(--tinta-2)}
.ajuste .d{margin-left:auto;display:flex;align-items:center;gap:14px;flex:none}
.ajuste.bajo{min-height:54px}.ajuste.bajo b{font-weight:500}
.interruptor{width:52px;height:30px;border-radius:15px;background:var(--linea-fuerte);position:relative}
.interruptor::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2)}
.interruptor.si{background:var(--tinta)}.interruptor.si::after{left:25px}
.selector{height:44px;border:1.5px solid var(--linea-fuerte);border-radius:10px;padding:0 14px;display:flex;align-items:center;gap:12px;font-size:16px}
.lapiz{font-style:normal;width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;margin-left:6px;border:1.5px solid var(--linea-fuerte);position:relative;top:-1px}
.aviso{background:var(--aviso-fondo);color:var(--aviso);border-radius:12px;padding:14px 18px;font-size:16px;line-height:24px}
.aviso b{font-weight:600}
.vacio{flex:1;margin:24px 0 40px;border-radius:16px;background:var(--lino);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center}
.vacio b{font-family:var(--serif);font-weight:500;font-size:28px;line-height:34px}
.vacio span{font-size:17px;line-height:26px;color:var(--tinta-2);max-width:460px}
.abierta{padding:16px 0 18px;border-bottom:1px solid var(--linea)}
.abierta b{display:flex;font-size:17px;font-weight:600;line-height:24px;margin-bottom:6px}
.abierta p{font-size:16px;line-height:26px;color:var(--tinta-2);max-width:640px}
.chev{margin-left:auto;flex:none}
.precio{font-family:var(--serif);font-weight:500;font-size:64px;line-height:1;letter-spacing:-.02em}
.precio small{font-family:var(--sans);font-weight:400;font-size:18px;letter-spacing:0;color:var(--tinta-2);margin-left:10px}
.estados{width:1120px;background:#fff;border-radius:12px;padding:4px 72px 24px;box-shadow:var(--sombra-1)}

/* dmg */
.dmg{width:560px;height:400px;position:relative}
.dmg svg{position:absolute;inset:0}
.dmg .ic{position:absolute;left:216px;top:151px;width:128px;height:128px}
.dmg .et{position:absolute;left:0;right:0;top:284px;text-align:center;font:500 13px -apple-system,"Helvetica Neue",sans-serif;color:#18141D}

/* escritorio de mentira */
.escritorio{background:linear-gradient(160deg,#C9C4D0,#AFA9B8);border-radius:12px;position:relative;overflow:hidden}
.escritorio.osc{background:linear-gradient(160deg,#3A3442,#231E2A)}
.dock{position:absolute;left:0;right:0;bottom:0;height:40px;background:rgba(255,255,255,.55);border-top:1px solid rgba(255,255,255,.5);display:flex;align-items:center;gap:10px;padding:0 14px}
.escritorio.osc .dock{background:rgba(20,16,24,.7);border-color:rgba(255,255,255,.08)}
.dock i{width:22px;height:22px;border-radius:5px;background:rgba(24,20,29,.22)}
.escritorio.osc .dock i{background:rgba(255,255,255,.2)}
.tira{display:grid;grid-template-columns:repeat(2,1fr);gap:28px 24px;width:1120px}
.tira figure{display:flex;flex-direction:column;gap:12px}
.tira .escritorio{height:180px}
.tira .pos{position:absolute;left:0;right:0;bottom:52px;display:flex;flex-direction:column;align-items:center}
.tira figcaption,.cuadros figcaption{font-size:16px;line-height:24px;color:var(--tinta)}
.tira figcaption b,.cuadros figcaption b{font-weight:600}
.tira figcaption span,.cuadros figcaption span{display:block;font-size:15px;color:var(--tinta-2)}

/* Ajustes del Sistema (imitación neutra) */
.ajustes{width:700px;height:400px;background:#F5F5F7;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.3);display:flex;overflow:hidden;font-family:-apple-system,"Helvetica Neue",sans-serif}
.ajustes .l{width:200px;background:#E9E8EC;padding:44px 14px 0;display:flex;flex-direction:column;gap:14px}
.ajustes .l i{height:12px;border-radius:6px;background:#CFCDD6;display:block}
.ajustes .r{flex:1;padding:18px 22px}
.ajustes .r h5{font-size:15px;font-weight:700;margin-bottom:6px}
.ajustes .r p{font-size:12px;color:#77747F;margin-bottom:12px}
.ajustes .lista{background:#fff;border-radius:10px;border:1px solid #E1E0E6}
.ajustes .it{display:flex;align-items:center;gap:10px;height:42px;padding:0 12px;border-bottom:1px solid #EEEDF1;font-size:13px}
.ajustes .it:last-child{border:0}
.ajustes .it s{width:22px;height:22px;border-radius:6px;background:#D9D7DF;flex:none}
.ajustes .it s.cl{background:#fff url(ICONO_URL) center/150% no-repeat;border:1px solid #DDD}
.ajustes .it u{margin-left:auto;width:36px;height:21px;border-radius:11px;background:#D5D3DB;position:relative;flex:none}
.ajustes .it u::after{content:"";position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;background:#fff}
.ajustes .it u.si{background:#3A82F7}.ajustes .it u.si::after{left:17px}
.ayudante{width:540px;background:var(--noche);border:1px solid rgba(255,255,255,.18);border-radius:16px;box-shadow:var(--sombra-flota);padding:16px 20px;display:flex;align-items:center;gap:16px;color:#fff;font-size:17px;line-height:25px}
.ayudante .ic{width:52px;height:52px;border-radius:12px;background:#fff url(ICONO_URL) center/150% no-repeat;flex:none}
.ayudante .fl{flex:none;width:40px;height:40px;border-radius:50%;background:var(--lila);display:flex;align-items:center;justify-content:center}
.mini{transform:scale(.62);transform-origin:center;margin:-70px 0 -84px}

/* storyboard */
.cuadros{display:grid;grid-template-columns:repeat(4,1fr);gap:28px 24px;width:1120px}
.cuadros figure{display:flex;flex-direction:column;gap:12px}
.cuadro{height:168px;background:var(--lino);border-radius:12px;border:1px solid var(--linea);position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
.cuadro .num{position:absolute;left:12px;top:10px;font-family:var(--serif);font-style:italic;font-size:17px;color:var(--tinta-3)}
.pap{background:#fff;border:1.5px solid var(--tinta);border-radius:10px}
.cur{position:absolute}
.archivo{white-space:nowrap;display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:14px;font-weight:600}
.archivo s{width:26px;height:32px;border:1.5px solid var(--tinta);border-radius:5px;flex:none}
.aro{box-shadow:0 0 0 3px var(--lila)}
.bt{white-space:nowrap;height:26px;border-radius:7px;border:1.5px solid var(--tinta);font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 10px}
.bt.lleno{background:var(--tinta);color:#fff}
.bt.gris{border-color:var(--linea-fuerte);color:var(--tinta-3)}
.ln{height:5px;border-radius:3px;background:var(--linea-fuerte)}

/* web */
.web{width:1120px;height:600px;display:flex;background:#fff}
.web .i{width:500px;padding:36px 56px 0 64px;position:relative}
.web h1{font-family:var(--serif);font-weight:500;font-size:44px;line-height:50px;letter-spacing:-.02em;margin-top:44px}
.pest{display:inline-flex;margin-top:40px;border:1.5px solid var(--linea-fuerte);border-radius:10px;padding:3px}
.pest a{height:36px;padding:0 18px;display:flex;align-items:center;font-size:15px;font-weight:600;border-radius:7px;color:var(--tinta-2)}
.pest a.aqui{background:var(--tinta);color:#fff}
.pasos{list-style:none;margin-top:28px;counter-reset:p}
.pasos li{counter-increment:p;display:flex;gap:16px;font-size:18px;line-height:28px;padding:12px 0;border-bottom:1px solid var(--linea)}
.pasos li::before{content:counter(p);font-family:var(--serif);font-style:italic;font-size:22px;color:var(--tinta-3);width:16px}
.pasos li.aqui{font-weight:600}.pasos li.aqui::before{color:var(--lila)}
.web .d{flex:1;background:var(--lino);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;position:relative}
.alerta{width:300px;background:#fff;border-radius:16px;border:1.5px solid var(--tinta);padding:22px 20px 18px;display:flex;flex-direction:column;align-items:center;gap:10px;position:relative}
.alerta .ic{width:56px;height:56px;border-radius:12px;background:#fff url(ICONO_URL) center/150% no-repeat;border:1px solid var(--linea)}
.alerta p{font-size:15px;line-height:21px;text-align:center;font-weight:600}
.alerta .bt{width:100%;height:36px;font-size:15px;border-radius:9px}
.progreso{display:flex;gap:8px}
.progreso i{width:28px;height:4px;border-radius:2px;background:var(--linea-fuerte)}
.progreso i.h{background:var(--tinta)} .progreso i.a{background:var(--lila)}
""".replace("ICONO_URL", ICONO)

CHECK_B = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-7" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
CHECK_N = CHECK_B.replace("#fff", "#18141D")
CHECK_L = CHECK_B.replace("#fff", "#8B2FF3")
EQUIS = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'
FLECHA_I = '<svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M6 1L1 6l5 5M1 6h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
FLECHA_A = '<svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M9 19V2M2 8l7-7 7 7" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
CHEV = '<svg class="chev" width="14" height="9" viewBox="0 0 14 9" fill="none"><path d="M1 1.5l6 6 6-6" stroke="#18141D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
CHEV_A = '<svg class="chev" width="14" height="9" viewBox="0 0 14 9" fill="none"><path d="M1 7.5l6-6 6 6" stroke="#18141D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
LAPIZ = '<i class="lapiz"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10.5 2.5l3 3L5.5 13.5H2.5v-3zM9 4l3 3" stroke="#18141D" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></i>'
CURSOR = '<svg width="22" height="26" viewBox="0 0 22 26"><path d="M3 2l15 11-7 1 4 8-3 1.5-4-8-5 5z" fill="#18141D" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>'

def t(x, c=""): return '<kbd class="tecla ' + c + '">' + x + '</kbd>'
def atajo(c="", win=False):
    return t("Ctrl" if win else "⌥", c) + '<span class="mas ' + c + '">+</span>' + t("Espacio", c)

ETAPAS = ["Cuenta", "Permisos", "Prueba", "Práctica"]
def top(actual, noche=False, todas=False):
    e = ""
    for i, n in enumerate(ETAPAS):
        c = "hecha" if (i < actual or todas) else ("actual" if i == actual else "")
        e += '<div class="etapa ' + c + '">' + n + '<i></i></div>'
    logo = BR + ("closelabs-white.png" if noche else "closelabs-black.png")
    return '<div class="ob-top"><img class="logo" src="' + logo + '" alt="CloseLabs"><div class="etapas">' + e + '</div><a class="ayuda">¿Necesitas ayuda?</a></div>'

def izq(h1, p="", cuerpo="", btn="", link="", off=False, atras=True):
    a = '<div class="atras">' + (FLECHA_I + ' Atrás' if atras else '') + '</div>'
    pp = '<p class="p">' + p + '</p>' if p else ""
    pie = ""
    if btn:
        pie = ('<div class="ob-pie"><div class="btn ' + ("off" if off else "") + '">' + btn + '</div><a class="enlace ' +
               ("" if link else "vacio") + '">' + (link or "·") + '</a></div>')
    return '<div class="ob-izq">' + a + '<h1>' + h1 + '</h1>' + pp + cuerpo + pie + '</div>'

def marco_v(inner):
    return '<div class="ventana"><div class="barra-titulo"><b><i></i><i></i><i></i></b>CloseLabs Voice</div>' + inner + '</div>'
def ob(actual, izquierda, escenario, noche=False, todas=False):
    return marco_v('<div class="ob ' + ("noche" if noche else "") + '">' + top(actual, noche, todas) + '<div class="ob-cuerpo">' + izquierda +
                   '<div class="ob-esc">' + escenario + '</div></div></div>')

MENU = ["Inicio", "Diccionario", "Mi cuenta", "Configuración", "Acerca de", "Ayuda"]
def lateral(aqui, estado="Lista para dictar", sin=False):
    its = "".join('<a class="' + ("aqui" if i == aqui else "") + '">' + i + '</a>' for i in MENU)
    return ('<div class="lateral"><img class="logo" src="' + BR + 'closelabs-black.png" alt="CloseLabs"><nav class="nav">' + its +
            '</nav><div class="abajo ' + ("sin" if sin else "") + '"><i></i>' + estado + '</div></div>')
def app(aqui, principal, estado="Lista para dictar", sin=False):
    return marco_v('<div class="app">' + lateral(aqui, estado, sin) + principal + '</div>')
def pagina(h1, p="", cuerpo=""):
    return '<div class="principal arriba"><h1>' + h1 + '</h1>' + ('<p class="p">' + p + '</p>' if p else '') + cuerpo + '</div>'
def aj(b, s, d="", cls="", extra=""):
    return ('<div class="ajuste ' + cls + '" ' + extra + '><div><b>' + b + '</b>' + ('<span>' + s + '</span>' if s else '') + '</div><div class="d">' + d + '</div></div>')
def grupo(titulo, *filas, extra=""):
    return '<div class="grupo" ' + extra + '><h2>' + titulo + '</h2>' + "".join(filas) + '</div>'

N = [0]
def marco(nombre, nota, *contenido):
    N[0] += 1
    return ('<section class="marco"><header><span class="n">%02d</span><h3>' % N[0]) + nombre + '</h3><p>' + nota + '</p></header><div class="lienzo">' + "".join(contenido) + '</div></section>'
def sub(x): return '<div class="sub">' + x + '</div>'

ONDA = [6,10,16,22,14,8,18,26,20,12,6,10,18,24,16,8,12,20,14,6,4,8]
PILD_GRAB = '<div class="pildora"><span class="x">' + EQUIS + '</span><div class="onda">' + "".join('<i style="height:%dpx"></i>' % h for h in ONDA) + '</div><span class="okb">' + CHECK_N + '</span></div>'
PILD_PROC = '<div class="pildora txt">Escribiendo<span class="puntos"><i></i><i></i><i></i></span></div>'
def pista(win=False):
    return '<div class="pista">Presiona ' + t("Ctrl" if win else "⌥", "n") + ' + ' + t("Espacio", "n") + ' para terminar</div>'

P = []
# ------------------------------------------------------------------ portada
P.append("""
<div class="portada">
  <h1>Tinta y <em>voz</em>.</h1>
  <p>Dirección visual de CloseLabs Voice (versión final, ronda 3). Es la primera propuesta, con el lila un poco más presente para que se sienta el color de CloseLabs, y con todas las pantallas que faltaban. Papel blanco, tinta casi negra, un escenario de lino con un tinte lila apenas visible, títulos en serif con una palabra en cursiva y la interfaz en una sans amable y grande.</p>
  <div class="fila">
    <div class="muestra" style="flex:1.15"><h4>Color</h4><div class="colores">
      <div><i style="background:#18141D"></i>Tinta<br>#18141D</div>
      <div><i style="background:#FFFFFF"></i>Papel<br>#FFFFFF</div>
      <div><i style="background:#F5F1F8"></i>Lino<br>#F5F1F8</div>
      <div><i style="background:#A439FF"></i>Lila<br>#A439FF</div>
      <div><i style="background:#55505E"></i>Tinta 2<br>#55505E</div>
      <div><i style="background:#CFCAD4"></i>Línea fuerte<br>#CFCAD4</div>
      <div><i style="background:#F3E8FF"></i>Lila suave<br>#F3E8FF</div>
      <div><i style="background:#8B2FF3"></i>Lila al pasar<br>#8B2FF3</div>
    </div></div>
    <div class="muestra"><h4>La dosis de lila</h4><div class="dosis">
      <div><i></i><span><b>El botón principal.</b> Uno por pantalla.</span></div>
      <div><i></i><span><b>La palabra en cursiva</b> del título. Una.</span></div>
      <div><i></i><span><b>La voz y lo que está pasando:</b> onda, tecla presionada, etapa en curso, foco, lo que la app corrigió.</span></div>
      <div><i></i><span><b>La marca del menú activo</b> y el tinte del lino.</span></div>
      <div><i class="no"></i><span><b>Nunca:</b> bordes, íconos, fondos de tarjeta, interruptores, enlaces, botones secundarios.</span></div>
    </div></div>
  </div>
</div>""")

# ------------------------------------------------------------------ dmg
dmg = marco_v('<div class="dmg">' + ILS["dmg-fondo.svg"] + '<img class="ic" src="' + ICONO + '" alt=""><div class="et">CloseLabs Voice</div></div>')
P.append(marco("Fondo del .dmg", "560 × 400. Exportado a PNG @1x y @2x en diseno/ilustraciones/. El ícono (280, 215) y su nombre los pone Finder.", dmg))

# ------------------------------------------------------------------ instalando
def prog(pct, ancho=380):
    x = ancho * pct
    return ('<svg width="%d" height="36" viewBox="0 0 %d 36" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin-top:28px">' % (ancho, ancho) +
            '<path d="M2 18 H%.0f" stroke="#18141D" stroke-width="3"/><path d="%s" stroke="#A439FF" stroke-width="3"/>' % (max(2, x - 64), onda(max(2, x - 64), x, 18, 12, 3)) +
            '<path d="M%.0f 18 H%d" stroke="#CFCAD4" stroke-width="3" stroke-dasharray="1 9"/></svg>' % (x + 10, ancho - 2))
def inst(estado):
    filas = ["Copiando a Aplicaciones", "Preparando tu computador", "Abriendo CloseLabs Voice"]
    h = ""
    for i, n in enumerate(filas):
        if i < estado: h += '<div class="permiso listo"><span class="marca">' + CHECK_B + '</span><div><b>' + n + '</b></div><em>Listo</em></div>'
        elif i == estado: h += '<div class="permiso vivo"><span class="marca"></span><div><b>' + n + '…</b></div></div>'
        else: h += '<div class="permiso pend"><span class="marca"></span><div><b>' + n + '</b></div></div>'
    return ob(-1, izq("<em>Instalando</em> CloseLabs Voice.", "No tienes que hacer nada. Tarda unos segundos.",
                      cuerpo=prog([0.3, 0.62, 0.97][estado]) + '<div class="permisos inst" style="margin-top:12px">' + h + '</div>', atras=False), ILS["voz-a-texto.svg"])
P.append(marco("Instalando (Mac)", "La misma ventana, tamaño y lugar que la bienvenida, y el mismo dibujo en el escenario: al terminar solo cambia la columna de texto. Cada paso se ve al menos 1,2 s.",
  sub("Paso 1 de 3 · la app abierta desde el disco"), inst(0),
  sub("Paso 3 de 3 · con este mismo cuadro abre la app ya instalada; de aquí funde a la bienvenida"), inst(2)))

# ------------------------------------------------------------------ bienvenida
P.append(marco("Bienvenida", "1120 × 680. Sin etapas marcadas todavía. El dibujo no parece un formulario: nadie intenta hacerle clic.",
  ob(-1, izq("Escribe tus historias <em>hablando</em>.", "Tú hablas. El texto aparece donde tengas el cursor, con sus puntos y sus comas.",
             btn="Crear mi cuenta", link="Ya tengo una cuenta", atras=False), ILS["voz-a-texto.svg"])))

# ------------------------------------------------------------------ cuenta
campos = ('<div class="campo" style="margin-top:22px"><label>Nombre y apellido</label><div class="entrada">Laura Morales</div></div>'
          '<div class="campo"><label>Correo</label><div class="entrada">laura.morales@gmail.com</div></div>'
          '<div class="campo"><label>Contraseña <span>Mostrar</span></label><div class="entrada foco">••••••••••<span class="cursor"></span></div></div>'
          '<div class="casilla"><i>' + CHECK_B + '</i><div>Acepto los <u>Términos</u> y la <u>Política de privacidad</u>.</div></div>')
P.append(marco("Crear cuenta", "Etiquetas siempre visibles, un solo botón lila. La frase de privacidad vive en el escenario, no en letra chica.",
  ob(0, izq("Crea tu <em>cuenta</em>.", cuerpo=campos, btn="Crear mi cuenta", link="Ya tengo una cuenta"),
     ILS["privacidad.svg"] + '<p class="pie-il">Tus dictados no se almacenan ni se usan para entrenar modelos.</p>')))

# ------------------------------------------------------------------ código
cod = '<div class="codigo"><div>4</div><div>8</div><div>1</div><div>9</div><div class="foco"></div><div></div></div>'
P.append(marco("Código del correo", "Seis casillas grandes. El botón se enciende al completar el código. Abajo, siempre en el mismo sitio, la salida.",
  ob(0, izq("Revisa tu <em>correo</em>.", 'Te enviamos un código de 6 números a <b style="color:#18141D;font-weight:600">laura.morales@gmail.com</b>', cuerpo=cod,
            btn="Confirmar", link="No me llegó: enviar otro código", off=True), ILS["correo-codigo.svg"])))

# ------------------------------------------------------------------ permisos
def ajustes_html():
    def it(n, cl="", si=False): return '<div class="it"><s class="' + cl + '"></s>' + n + '<u class="' + ("si" if si else "") + '"></u></div>'
    barras = "".join('<i style="width:' + w + '"></i>' for w in ("70%", "55%", "80%", "62%", "74%", "50%", "68%"))
    return ('<div class="ajustes"><div class="l">' + barras + '</div><div class="r"><h5>Accesibilidad</h5><p>Permite que estas apps controlen tu computador.</p><div class="lista">' +
            it("Google Chrome", si=True) + it("CloseLabs Voice", "cl") + it("Microsoft Word", si=True) + it("Zoom") + '</div></div></div>')
AYUDANTE = '<div class="ayudante"><span class="fl">' + FLECHA_A + '</span><div>Busca <b>CloseLabs Voice</b> en la lista de arriba y enciende su interruptor.</div><span class="ic"></span></div>'
perm = ('<div class="permisos">'
        '<div class="permiso listo"><span class="marca">' + CHECK_B + '</span><div><b>Micrófono</b><span>Para oír lo que dictas.</span></div><em>Listo</em></div>'
        '<div class="permiso ahora"><span class="marca"></span><div><b>Accesibilidad</b><span>Para escribir el texto donde tengas el cursor.</span></div></div></div>')
esc_perm = ('<div class="mini"><div style="display:flex;flex-direction:column;align-items:center;gap:10px">' + ajustes_html() + AYUDANTE +
            '</div></div><p class="pie-il">Se abre Ajustes del Sistema y te señalamos dónde tocar.</p>')
P.append(marco("Permisos (Mac)", "Una lista de dos renglones y un botón. En Windows esta etapa no existe: la barra muestra Cuenta, Prueba, Práctica.",
  ob(1, izq("Dos permisos y <em>listo</em>.", "macOS te los pide una sola vez.", cuerpo=perm, btn="Abrir Ajustes del Sistema"), esc_perm),
  sub("La ventanita que se pega debajo de Ajustes del Sistema (540 × 86, flotante, sigue a Ajustes si se mueve)"),
  '<div class="escritorio" style="width:1120px;height:600px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">' + ajustes_html() + AYUDANTE + '</div>'))

# ------------------------------------------------------------------ micrófono
import random
random.seed(7)
bh = [int(18 + 110 * abs(math.sin(i * 0.55)) * (0.45 + 0.55 * random.random())) for i in range(30)]
barras = ('<div class="tarjeta"><div class="cuerpo"><div class="barras">' + "".join('<i style="height:%dpx"></i>' % h for h in bh) +
          '</div></div><div class="fila-mic"><span>Micrófono del MacBook Air</span><u class="enl">Cambiar</u></div></div>')
P.append(marco("Prueba del micrófono", "Una pregunta de sí o no. El «sí» es el botón; el «no», el enlace de abajo.",
  ob(2, izq("¿Se mueven las barras cuando <em>hablas</em>?", "Di cualquier cosa, con tu voz de siempre.", btn="Sí, se mueven", link="No se mueven"), barras)))

# ------------------------------------------------------------------ atajo
teclas = ('<div style="display:flex;align-items:center;height:120px">' + t("⌥", "g on") + '<span class="mas g">+</span>' + t("Espacio", "g on") +
          '</div><p class="pie-il">Primero ⌥ y, sin soltarla, Espacio.</p>')
P.append(marco("Prueba del atajo", "Las teclas dibujadas se encienden y se hunden al presionarlas. En Windows dicen Ctrl + Espacio.",
  ob(2, izq("Presiona las dos teclas. ¿Se <em>encienden</em>?", "Con ellas empiezas y terminas cada dictado.", btn="Sí, se encienden", link="No se encienden"), teclas)))

# ------------------------------------------------------------------ prácticas
def etqs(*xs): return '<div class="etiquetas">' + "".join('<span class="etiqueta">' + CHECK_L + ' ' + x + '</span>' for x in xs) + '</div>'
def c_antes(frase): return '<div class="guia">Presiona ' + atajo() + ' y di:</div><div class="frase">' + frase + '</div><div class="guia">Presiona ' + atajo() + ' otra vez para terminar.</div>'
def c_grab(frase): return '<div class="guia" style="color:#8B2FF3;font-weight:600">Te escucho…</div><div class="frase">' + frase + '</div><div class="guia">Presiona ' + atajo() + ' para terminar.</div>'
def c_res(txt): return txt + '<span class="cursor" style="height:20px"></span>'

F1 = "«Paciente de 58 años que consulta por, eh, dolor en la rodilla izquierda, no, perdón, en la rodilla derecha, desde hace tres días.»"
R1 = "Paciente de 58 años que consulta por dolor en la rodilla derecha desde hace tres días."
def hc(campo, mh=176):
    return ('<div class="tarjeta"><div class="cab">Historia clínica<span>Marta Rojas · 58 años</span></div><div class="cuerpo">'
            '<div class="hc-l">Motivo de consulta</div><div class="hc-c activo" style="min-height:%dpx">' % mh + campo + '</div>'
            '<div class="hc-l" style="margin-top:16px">Examen físico</div><div class="hc-c apagado"></div></div></div>')
P1 = "Haz clic en el campo y lee la frase tal como está, con el «eh» y la equivocación."
P.append(marco("Práctica 1 · Historia clínica", "La frase va DENTRO del campo, con una muletilla y una corrección de lado (izquierda → derecha). Cursiva serif: lo que se dice. Sans: lo que queda escrito.",
  sub("Antes"), ob(3, izq("Dicta el <em>motivo</em> de consulta.", P1, btn="Continuar", link="Saltar la práctica", off=True), hc(c_antes(F1))),
  sub("Grabando"), ob(3, izq("Dicta el <em>motivo</em> de consulta.", P1, btn="Continuar", link="Saltar la práctica", off=True),
                      hc(c_grab(F1)) + '<div style="height:36px"></div><div class="flota">' + PILD_GRAB + '</div>'),
  sub("Resultado · cada etiqueta sale solo si una comprobación exacta la confirma"),
  ob(3, izq("Te corregiste al hablar. Quedó <em>limpio</em>.", "Así puedes dictar siempre: sin cuidarte de hablar perfecto.", btn="Continuar", link="Repetir"),
     hc(c_res(R1), 110) + etqs("Quitó «eh»", "Corrigió izquierda → derecha", "Puso la puntuación"))))

F2 = "«Hola, don Jaime. Tómela, este, después del almuerzo, no, perdón, después del desayuno, con un vaso de agua.»"
R2 = "Hola, don Jaime. Tómela después del desayuno, con un vaso de agua."
def chat(campo):
    return ('<div class="tarjeta"><div class="cab"><div style="display:flex;align-items:center"><span class="avatar">JP</span>Jaime Pardo</div><span>WhatsApp</span></div>'
            '<div class="chat"><div class="globo">Doctora, buenas tardes. ¿La pastilla de la presión me la tomo antes o después de comer?<small>3:42 p. m.</small></div></div>'
            '<div class="cuerpo" style="padding:14px 16px 16px"><div class="hc-c activo">' + campo + '</div></div></div>')
P.append(marco("Práctica 2 · WhatsApp a un paciente", "Otra muletilla («este») y otra corrección (almuerzo → desayuno). Misma plantilla, otro lugar conocido.",
  sub("Antes"), ob(3, izq("Ahora, respóndele a un <em>paciente</em>.", "Igual que antes: clic en el campo, las dos teclas y hablas.", btn="Continuar", link="Saltar la práctica", off=True), chat(c_antes(F2))),
  sub("Resultado"), ob(3, izq("Lo que retiraste no <em>llegó</em>.", "El paciente solo lee lo que quisiste decir.", btn="Continuar", link="Repetir"),
                       chat(c_res(R2)) + etqs("Quitó «este»", "Corrigió almuerzo → desayuno", "Puso la puntuación"))))

F3 = "«Losartán de 50 miligramos, una tableta cada 12 horas, no, mentira, cada 24 horas, por 30 días.»"
R3 = "Losartán de 50 miligramos, una tableta cada 24 horas, por 30 días."
def formula(campo, mh=0):
    return ('<div class="tarjeta"><div class="cab">Dra. Laura Morales<span>Fórmula médica</span></div><div class="cuerpo">'
            '<div style="display:flex;justify-content:space-between;font-size:15px;color:#55505E;padding-bottom:14px;margin-bottom:16px;border-bottom:1px solid #E6E2EA"><span>Paciente: <b style="color:#18141D;font-weight:600">Marta Rojas</b></span><span>12 de noviembre de 2026</span></div>'
            '<div class="rp">Rp.</div><div class="hc-c activo" style="min-height:%dpx">' % mh + campo + '</div></div></div>')
P.append(marco("Práctica 3 · Fórmula médica", "La corrección aquí es un número (cada 12 → cada 24 horas): lo que más importa que no falle.",
  sub("Antes"), ob(3, izq("Por último, una <em>fórmula</em>.", "Aquí te vas a corregir en la dosis.", btn="Continuar", link="Saltar la práctica", off=True), formula(c_antes(F3))),
  sub("Resultado"), ob(3, izq("La dosis quedó como la <em>corregiste</em>.", "Lo que retiras al hablar no llega al texto.", btn="Continuar", link="Repetir"),
                       formula(c_res(R3), 84) + etqs("Corrigió cada 12 → cada 24 horas", "Puso la puntuación"))))

# ------------------------------------------------------------------ recompensa
rec = ('<div class="cifra">3,1<em>×</em></div>'
       '<div class="comparar"><div><div class="r"><b>Tú, dictando</b><span>126 palabras por minuto</span></div><i class="tu"></i></div>'
       '<div><div class="r"><b>Escribiendo en el teclado</b><span>40 por minuto, en promedio</span></div><i style="width:32%"></i></div></div>'
       '<div class="ahorro">En 20 historias al día, son unos 40 minutos menos frente al teclado.<small>Calculado con historias de 120 palabras.</small></div>')
P.append(marco("Recompensa", "La única pantalla oscura del recorrido: se siente como un cierre. La cifra sale del dictado real del médico; el ahorro lleva su supuesto escrito.",
  ob(4, izq("Dictaste <em>3 veces</em> más rápido de lo que escribes.", "Lo medimos con lo que acabas de dictar.", btn="Empezar a usar CloseLabs Voice", atras=False), rec, noche=True, todas=True)))

# ------------------------------------------------------------------ inicio
def inicio(aviso=""):
    return ('<div class="principal">' + aviso + '<p class="frase-inicio">Haz clic donde quieras escribir, presiona ' + atajo() + ', habla, y presiona otra vez para <em>terminar</em>.</p>'
            '<div class="btn sec chico" style="margin-top:36px">Hacer un dictado de prueba</div>'
            '<p class="nota-inicio">¿Escribió mal una palabra? <u>Agrégala al Diccionario</u></p></div>')
P.append(marco("Inicio", "El mismo tamaño del primer uso: la ventana no salta. Menú sin íconos, con una marca lila en el activo. Una sola frase; sin historial ni cifras.", app("Inicio", inicio())))

# ------------------------------------------------------------------ diccionario
def pal(w): return aj(w, "", '<u class="enl">Quitar</u>', "bajo")
def agregar(lleno):
    e = '<div class="entrada foco" style="flex:1">empagliflozina<span class="cursor"></span></div>' if lleno else '<div class="entrada ph" style="flex:1">Escribe la palabra como debe quedar</div>'
    return '<div style="display:flex;gap:12px;margin-top:22px">' + e + '<div class="btn ' + ("" if lleno else "off") + '" style="height:50px;width:auto;padding:0 26px">Agregar</div></div>'
DIC_P = "Nombres, medicamentos o siglas que la app debe escribir siempre igual."
dic = pagina("Diccionario", DIC_P, agregar(True) + grupo("Tus palabras · 5", pal("losartán"), pal("gMedic"), pal("Dr. Peñaranda"), pal("metoprolol succinato"), pal("Clínica del Country")))
dic0 = pagina("Diccionario", DIC_P, agregar(False) + '<div class="vacio"><b>Todavía no hay palabras.</b><span>Cuando la app escriba mal un nombre o un medicamento, agrégalo aquí una vez. No vuelve a fallar.</span></div>')
P.append(marco("Diccionario", "Un campo, un botón y renglones. El vacío explica cuándo usarlo, sin pedir tarea.",
  sub("Con palabras"), app("Diccionario", dic), sub("Vacío"), app("Diccionario", dic0)))

# ------------------------------------------------------------------ mi cuenta
sus_prueba = aj("Prueba gratis", "Te quedan 5 días. Después, US$12 al mes.", '<div class="btn chico">Suscribirme</div>')
sus_activa = aj("Plan mensual · activo", "US$12 al mes. Próximo cobro: 10 de diciembre de 2026.", '<div class="btn sec chico">Administrar el pago</div>')
eq1 = aj("Nicolass MacBook Air 2" + LAPIZ, "Este computador.")
eq2 = aj("CONSULTORIO-PC" + LAPIZ, "Último dictado: ayer.", '<u class="enl">Quitar</u>')
eq_edit = ('<div class="ajuste"><div style="display:flex;gap:10px;align-items:center;flex:1"><div class="entrada foco" style="width:340px;height:46px">Portátil del consultorio<span class="cursor"></span></div>'
           '<div class="btn chico">Guardar</div><u class="enl">Cancelar</u></div></div>')
cuenta = pagina("Mi cuenta", "",
    grupo("Tus datos", aj("Laura Morales", "laura.morales@gmail.com", '<div class="btn sec chico">Cambiar contraseña</div>'), extra='style="margin-top:18px"') +
    grupo("Suscripción", sus_prueba) + grupo("Computadores · 2 de 3", eq1, eq2) +
    grupo("Sesión", aj("Cerrar sesión", "Solo en este computador.", '<div class="btn sec chico">Cerrar sesión</div>')))
estados = ('<div class="estados">' + grupo("Computadores · al tocar el lapicito, el nombre se edita ahí mismo", eq_edit, eq2) +
           grupo("Suscripción · cuando ya paga", sus_activa) +
           grupo("Eliminar la cuenta · al final de la página, después de desplazarse",
                 aj("Eliminar mi cuenta", "Se borran tu cuenta, tu diccionario y tu suscripción. No se puede deshacer.", '<div class="btn rojo chico">Eliminar mi cuenta</div>', extra='style="border:0"')) + '</div>')
P.append(marco("Mi cuenta", "Cada computador sale con su nombre de red limpio y un lapicito para renombrarlo. Pagar no es lo primero que se ve. Eliminar queda al fondo.",
  sub("En prueba"), app("Mi cuenta", cuenta), sub("Otros estados de la misma página"), estados))

# ------------------------------------------------------------------ configuración
conf = pagina("Configuración", "",
    grupo("Dictado", aj("Atajo para dictar", "Las teclas con las que empiezas y terminas.", atajo() + '<div class="btn sec chico" style="margin-left:6px">Cambiar</div>'),
          aj("Micrófono", "El que usa la app para oírte.", '<div class="selector">Micrófono del MacBook Air ' + CHEV.replace('class="chev"', '') + '</div>'), extra='style="margin-top:18px"') +
    grupo("El texto", aj("Escribir todo en MAYÚSCULAS", "Para sistemas de historia clínica que lo piden así.", '<div class="interruptor"></div>'),
          aj("Sonido al empezar y al terminar", "Un tono corto te confirma que te está oyendo.", '<div class="interruptor si"></div>')) +
    grupo("El computador", aj("Abrir al encender el computador", "Así el atajo siempre está listo.", '<div class="interruptor si"></div>')))
P.append(marco("Configuración", "Renglones, no tarjetas. Los interruptores encendidos son de tinta: el lila no se gasta aquí.", app("Configuración", conf)))

# ------------------------------------------------------------------ ayuda
ayuda = pagina("Ayuda", "",
    grupo("Hablar con nosotros", aj("Escríbenos por WhatsApp", "Te ayudamos a instalar, a dictar o con tu cuenta.", '<div class="btn chico">Abrir WhatsApp</div>'),
          aj("Reportar un problema", "Nos llega un informe técnico de la app, sin el texto de tus dictados.", '<div class="btn sec chico">Reportar</div>'), extra='style="margin-top:18px"') +
    '<div class="grupo"><h2>Preguntas frecuentes</h2>'
    '<div class="abierta"><b>Dicté y el texto no apareció. ¿Qué hago?' + CHEV_A + '</b><p>Tu dictado quedó copiado. Haz clic donde quieras escribir y pega con ' + t("⌘") + '<span class="mas">+</span>' + t("V") + '. Si pasa seguido en el mismo programa, repórtalo.</p></div>' +
    aj("¿Funciona sin internet?", "", CHEV, "bajo") + aj("¿Cómo cambio las teclas del atajo?", "", CHEV, "bajo") + aj("¿En cuántos computadores puedo usarla?", "", CHEV, "bajo") + '</div>')
P.append(marco("Ayuda", "Primero una persona; después el informe; después las preguntas, una abierta a la vez. Un solo botón lila.", app("Ayuda", ayuda)))

# ------------------------------------------------------------------ acerca de
acerca = pagina("Acerca de", "",
    grupo("La aplicación", aj("CloseLabs Voice 0.9.4", "Tienes la última versión.", '<div class="btn sec chico">Buscar actualizaciones</div>'),
          aj("Privacidad", "Tus dictados no se almacenan ni se usan para entrenar modelos.", '<u class="enl">Política de privacidad</u>'),
          aj("Términos de uso", "Versión 1.3.", '<u class="enl">Leer los términos</u>'), extra='style="margin-top:18px"') +
    grupo("Quién la hace", aj("CLOSELABS GROUP LLC", "Automatiza tu consultorio.", '<u class="enl">closelabs.co</u>'),
          aj("Hecha sobre Handy", "Proyecto de código abierto de CJ Pais, con licencia MIT.", '<u class="enl">Ver licencias</u>')))
P.append(marco("Acerca de", "La versión dice si está al día, sin jerga. El logo no se repite: ya está en el menú.", app("Acerca de", acerca)))

# ------------------------------------------------------------------ errores
av = '<div class="aviso" style="position:absolute;top:24px;left:72px;right:72px"><b>Sin internet.</b> Puedes seguir dictando; el texto sale sin pulir hasta que vuelva la conexión.</div>'
fin = ('<div class="principal arriba" style="justify-content:center;padding-top:0"><h1>Gracias por <em>probarla</em>.</h1>'
       '<p class="p" style="max-width:520px;margin-top:12px">Tu prueba gratis terminó. Para seguir dictando, activa tu suscripción.</p>'
       '<div class="precio" style="margin-top:36px">US$12<small>al mes</small></div>'
       '<p style="font-size:16px;color:#55505E;margin-top:10px">Dictado sin límite en tus 3 computadores. Tu diccionario sigue como lo dejaste.</p>'
       '<div style="display:flex;gap:14px;margin-top:36px"><div class="btn" style="width:260px">Suscribirme</div><div class="btn sec" style="width:auto;padding:0 28px">Hablar con soporte</div></div></div>')
def esc_p(cont, osc=False):
    return '<div class="escritorio ' + ("osc" if osc else "") + '"><div class="pos">' + cont + '</div><div class="dock"><i></i><i></i><i></i><i></i><i></i></div></div>'
err_p = ('<div class="tira">'
         '<figure>' + esc_p('<div class="pildora txt"><span class="pt"></span>No encuentro un micrófono. Conéctalo y vuelve a intentar.</div>') +
         '<figcaption><b>Sin micrófono</b><span>Al presionar el atajo. Se va sola a los 6 s.</span></figcaption></figure>'
         '<figure>' + esc_p('<div class="pildora txt">¿No apareció? Quedó copiado: pega con ' + t("⌘", "n") + ' + ' + t("V", "n") + '</div>', True) +
         '<figcaption><b>El texto no apareció</b><span>5 s después de cada dictado, durante la primera semana. En Windows dice Ctrl + V.</span></figcaption></figure></div>')
P.append(marco("Estados de error", "Ninguno es rojo ni grita. Dicen qué pasó y qué hacer, en una línea.",
  sub("Sin internet · aviso arriba y estado en el menú"), app("Inicio", inicio(av), "Sin internet", True),
  sub("Fin de la prueba gratuita · reemplaza a Inicio; el menú sigue disponible"), app("Inicio", fin, "Prueba terminada", True),
  sub("En la píldora"), err_p))

# ------------------------------------------------------------------ píldora
pild = ('<div class="tira">'
        '<figure>' + esc_p(pista() + PILD_GRAB, True) + '<figcaption><b>Grabando</b><span>✕ cancela, ✓ termina. La onda es la voz. La pista de las teclas, solo los primeros 7 días.</span></figcaption></figure>'
        '<figure>' + esc_p(PILD_PROC) + '<figcaption><b>Procesando</b><span>Mismo alto, mismo lugar. Sin logo ni lema.</span></figcaption></figure></div>')
P.append(marco("Píldora", "Solo aparece al grabar; en reposo no hay nada en pantalla. Ventana 300 × 100 (hoy 264 × 146), 12 px por encima del Dock o de la barra de tareas.", pild))

# ------------------------------------------------------------------ storyboard
def cuadro(n, escena, titulo, texto):
    return '<figure><div class="cuadro"><span class="num">%d</span>' % n + escena + '</div><figcaption><b>' + titulo + '</b><span>' + texto + '</span></figcaption></figure>'
def cur(x, y): return '<span class="cur" style="left:%dpx;top:%dpx">' % (x, y) + CURSOR + '</span>'
def ic(s): return '<span style="display:block;flex:none;width:%dpx;height:%dpx;border-radius:%dpx;background:#fff url(' % (s, s, s // 5) + ICONO + ') center/150% no-repeat;border:1.5px solid #18141D"></span>'
def mt(a): return ('<div style="display:flex;align-items:center;gap:8px"><kbd class="tecla" style="background:#A439FF;border-color:#7A1FD1;color:#fff;height:48px;min-width:48px;font-size:20px;top:0">' + a +
                   '</kbd><span class="mas" style="top:0">+</span><kbd class="tecla" style="background:#A439FF;border-color:#7A1FD1;color:#fff;height:48px;font-size:17px;padding:0 20px;top:0">Espacio</kbd></div>')
CAJAS = "".join('<div class="pap" style="width:28px;height:38px;display:flex;align-items:center;justify-content:center;font:500 20px Newsreader,serif' + (";box-shadow:0 0 0 3px #A439FF" if i == 4 else "") + '">' + d.strip() + '</div>' for i, d in enumerate("4819  "))
S = [
 cuadro(1, '<div class="pap archivo aro"><s></s>CloseLabs-Voice-Mac.dmg</div>' + cur(190, 100), "Abre el archivo que descargaste", "Está en tu carpeta Descargas."),
 cuadro(2, '<div class="pap" style="width:150px;height:110px;display:flex;align-items:center;justify-content:center">' + ic(52) + '</div>' + cur(146, 92), "Haz doble clic en el ícono", "La app se instala sola."),
 cuadro(3, '<div class="pap" style="width:164px;padding:12px;display:flex;flex-direction:column;gap:7px"><div class="ln" style="width:80%"></div><div class="ln" style="width:55%;margin-bottom:4px"></div><div class="bt lleno aro">Abrir</div><div class="bt gris">Mostrar imagen</div><div class="bt gris">Cancelar</div></div>' + cur(170, 70), "macOS pregunta: toca «Abrir»", "Es el primer botón. Los otros dos no."),
 cuadro(4, '<div style="display:flex;gap:6px">' + CAJAS + '</div>', "Crea tu cuenta", "Correo, contraseña y el código de 6 números que te llega."),
 cuadro(5, '<div class="pap" style="width:226px;height:50px;display:flex;align-items:center;gap:10px;padding:0 12px;font-size:14px;font-weight:600;white-space:nowrap">' + ic(26) + ' CloseLabs Voice<span class="aro" style="margin-left:auto;width:36px;height:21px;border-radius:11px;background:#18141D;position:relative;flex:none"><i style="position:absolute;top:2px;left:17px;width:17px;height:17px;border-radius:50%;background:#fff"></i></span></div>', "Enciende el permiso", "Una sola vez. Te señalamos dónde."),
 cuadro(6, mt("⌥"), "Haz clic donde vas a escribir y presiona las dos teclas", "Habla normal. Presiónalas otra vez para terminar."),
 cuadro(7, '<div style="display:flex;flex-direction:column;align-items:center;gap:12px"><div class="pap" style="width:200px;padding:12px;display:flex;flex-direction:column;gap:8px"><div class="ln" style="background:#18141D;width:100%"></div><div class="ln" style="background:#18141D;width:86%"></div><div class="ln" style="background:#A439FF;width:48%"></div></div><div style="transform:scale(.8)">' + PILD_GRAB + '</div></div>', "El texto aparece limpio", "Con puntuación, sin muletillas y con tus correcciones."),
 cuadro(8, '<div style="display:flex;flex-direction:column;gap:10px;width:200px"><div style="display:flex;gap:6px"><div class="pap" style="flex:1;height:32px;display:flex;align-items:center;padding:0 10px;font-size:14px">losartán</div><div class="bt lleno" style="height:32px">Agregar</div></div><div style="display:flex;gap:6px"><span class="bt" style="border-radius:13px;font-weight:500;background:#fff">gMedic</span><span class="bt" style="border-radius:13px;font-weight:500;background:#fff">metoprolol</span></div></div>', "¿Escribió mal una palabra? Al Diccionario", "Agrégala una vez y la escribe bien siempre."),
]
W = [
 cuadro(1, '<div class="pap archivo aro"><s></s>CloseLabs-Voice.exe</div>' + cur(176, 100), "Abre el archivo que descargaste", "Está en tu carpeta Descargas."),
 cuadro(2, '<div class="pap" style="width:180px;padding:14px;display:flex;flex-direction:column;align-items:center;gap:10px">' + ic(40) + '<div class="bt lleno aro" style="width:100%;height:30px">Instalar</div></div>' + cur(168, 110), "Toca «Instalar»", "Es una sola pantalla. Si Windows pregunta, toca «Sí»."),
 cuadro(3, '<div class="pap" style="width:190px;height:116px;overflow:hidden"><div style="height:16px;border-bottom:1.5px solid #18141D"></div><div style="padding:12px;display:flex;flex-direction:column;gap:8px"><img src="' + BR + 'closelabs-black.png" style="width:66px;margin-left:-4px"><div class="ln" style="width:90%;height:7px;background:#18141D"></div><div class="ln" style="width:60%"></div></div></div>', "La app se abre sola", "Sigue con tu cuenta. En Windows no hay permisos que encender."),
 cuadro(4, mt("Ctrl"), "Tu atajo en Windows", "Ctrl + Espacio para empezar y para terminar."),
]
P.append(marco("Tutorial animado de la web · storyboard", "Dibujo propio en tinta sobre lino, un gesto por cuadro, 3 a 4 s cada uno. Lila solo en lo que hay que tocar.",
  sub("Mac · 8 cuadros"), '<div class="cuadros">' + "".join(S) + '</div>',
  sub("Windows · cambian los tres primeros y el atajo"), '<div class="cuadros">' + "".join(W) + '</div>'))

# ------------------------------------------------------------------ web
web = ('<div class="ventana"><div class="web"><div class="i"><img class="logo" src="' + BR + 'closelabs-black.png" style="margin-left:-8px">'
       '<h1>Ábrela en <em>tres</em> pasos.</h1><div class="pest"><a class="aqui">Mac</a><a>Windows</a></div>'
       '<ol class="pasos"><li>Abre el archivo que acabas de descargar.</li><li>Haz doble clic en el ícono.</li><li class="aqui">Cuando macOS pregunte, toca «Abrir».</li></ol>'
       '<a class="enlace" style="text-align:left;margin-top:24px">¿No empezó la descarga? Intentar otra vez</a></div>'
       '<div class="d"><div class="alerta"><span class="ic"></span><p>«CloseLabs Voice» es una app descargada de internet. ¿Seguro que quieres abrirla?</p>'
       '<div class="bt lleno aro">Abrir</div><div class="bt gris">Mostrar imagen de disco</div><div class="bt gris">Cancelar</div>'
       '<span class="cur" style="right:40px;top:150px">' + CURSOR + '</span></div>'
       '<div class="progreso"><i class="h"></i><i class="h"></i><i class="a"></i><i></i><i></i><i></i><i></i><i></i></div>'
       '<p class="pie-il">El tutorial sigue solo: cuenta, permiso, tu primer dictado y el Diccionario.</p></div></div></div>')
P.append(marco("Panel de descarga en la web", "1120 × 600. La misma plantilla de la app: texto a la izquierda, escenario de lino a la derecha con el cuadro del tutorial que toca.", web))

HTML = ('<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><title>CloseLabs Voice · Maquetas</title>\n'
        '<meta name="viewport" content="width=1240">\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600&family=Plus+Jakarta+Sans:wght@400..700&display=swap" rel="stylesheet">\n'
        '<style>' + CSS + '</style></head>\n<body><div class="pagina">\n' + "\n".join(P) + '\n</div></body></html>\n')
open(os.path.join(RAIZ, "maquetas", "index.html"), "w").write(HTML)
print("ok", len(HTML))
