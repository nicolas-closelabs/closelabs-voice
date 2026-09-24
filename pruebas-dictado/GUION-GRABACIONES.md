# Guion de grabaciones — para nutrir el banco

Todo está escrito para **leer en voz alta tal cual**. No hay que inventar nada ni saber medicina:
los contenidos clínicos ya están puestos y son plausibles.

Salen dos cosas de aquí:

1. **Casos nuevos para el banco** (`casos/*.json`), de ocho especialidades. Hoy el banco entero es
   cardiología, así que solo sabemos que funciona con lo que se dictó una noche.
2. **La primera medición de la capa de VOZ**, que hoy no se mide: el banco arranca desde el texto
   ya transcrito. Del audio al texto nunca se ha comprobado nada, y ahí ya vimos algo raro: en los
   dictados de 3+ minutos salieron palabras cortadas ("tensi arterial", "frecuencia card 98").

---

## Antes de empezar

**Avísame y apago la limpieza.** Así lo que se pega es el texto **crudo**, tal como sale del motor
de voz. Con la limpieza puesta no se puede saber si un error viene de la voz o del formateo. Son
dos minutos y la vuelvo a encender al terminar.

**Cómo leer:**

- En Notas o donde escribas normalmente, no dentro de CloseLabs Voice.
- A ritmo normal de conversación. Sin vocalizar de más ni hacer pausas artificiales.
- **Sin decir comas ni puntos.** El texto de abajo los trae solo para que puedas leerlo; no los digas.
- Donde dice **(PAUSA)** o **(RÁPIDO)**, hazlo: son parte de la prueba.
- Si te trabas o repites, **sigue de largo**. Eso también es dato: los médicos se traban.
- Pega el resultado debajo de cada número, sin arreglarlo.

**Nada de pacientes reales.** Todos los datos de aquí son inventados.

---

## Bloque 1 — Voz: lo difícil de oír

Cortos, se leen tal cual. Miden si el motor de voz entiende bien; el formato da igual aquí.

**1.1 · Medicamentos que suenan parecido** (~25 s)

> Se formula enalapril veinte miligramos cada doce horas, hidroclorotiazida veinticinco miligramos
> al día, espironolactona veinticinco miligramos al día, levotiroxina cincuenta microgramos en
> ayunas, rosuvastatina veinte miligramos en la noche, clopidogrel setenta y cinco miligramos al
> día y omeprazol veinte miligramos antes del desayuno.

**1.2 · Apellidos colombianos** (~20 s)

> La junta médica la atienden los doctores Walteros, Echeverri, Buitrago, Gutiérrez, Ocampo,
> Zuluaga, Cifuentes, Saavedra y Restrepo, del servicio de medicina interna del Hospital San
> Rafael.

**1.3 · Números seguidos** (~25 s)

> Glicemia ciento treinta y dos, creatinina cero punto nueve, nitrógeno ureico dieciocho,
> hemoglobina catorce punto dos, hematocrito cuarenta y dos, plaquetas doscientos cuarenta mil,
> leucocitos siete mil doscientos, tensión arterial ciento treinta sobre ochenta, frecuencia
> cardiaca setenta y ocho, saturación noventa y siete por ciento.

**1.4 · Espanglish médico** (~25 s)

> Se realizó bypass coronario hace cinco años, se colocó un stent medicado en la descendente
> anterior, se solicita holter de veinticuatro horas, doppler de miembros inferiores, score de
> calcio y test de esfuerzo en banda.

**1.5 · Lo mismo, rápido** (~15 s)

Repite la **1.1** **(RÁPIDO)**, como cuando estás de afán entre paciente y paciente.

**1.6 · Con ruido de fondo** (~25 s)

Repite la **1.3** con el ventilador, la calle o música sonando.

**1.7 · Lejos del micrófono** (~20 s)

Repite la **1.2** a un metro del computador, como si estuvieras escribiendo mientras hablas.

---

## Bloque 2 — Los largos

### 2.1 · Historia clínica de 5 minutos, con pausa a mitad (~5 min)

⚠️ **El dictado más importante del guion.** Es lo que van a hacer los médicos: dejar la app
grabando mientras ordenan la idea. Donde dice **(PAUSA)**, quédate callado 20 segundos sin soltar
el atajo, y sigue.

> Paciente femenina de cincuenta y ocho años, ama de casa, natural y procedente de Medellín, que
> consulta por cuadro clínico de ocho meses de evolución consistente en dolor en ambas rodillas,
> de predominio derecho, que empeora al bajar escaleras y al levantarse de la silla, y que mejora
> parcialmente con el reposo. Refiere rigidez matutina de aproximadamente quince minutos, sin
> edema evidente, sin enrojecimiento y sin fiebre. En el último mes el dolor aumentó de intensidad,
> lo califica en siete sobre diez, y le impide caminar más de dos cuadras.
>
> Como antecedentes personales tiene hipertensión arterial diagnosticada hace doce años, en manejo
> con losartán cincuenta miligramos cada doce horas; hipotiroidismo en manejo con levotiroxina
> setenta y cinco microgramos en ayunas; y obesidad grado uno. Niega diabetes, niega enfermedad
> renal, niega alergias medicamentosas. Antecedente quirúrgico de cesárea hace treinta años y
> colecistectomía hace ocho años, ambas sin complicaciones. Antecedentes familiares: madre con
> artrosis de rodillas operada de prótesis a los setenta años, padre fallecido por enfermedad
> cerebrovascular.
>
> **(PAUSA de 20 segundos, sin soltar el atajo)**
>
> Al examen físico se encuentra paciente en buenas condiciones generales, consciente, orientada,
> hidratada, afebril. Peso setenta y ocho kilos, talla un metro cincuenta y seis, índice de masa
> corporal treinta y dos. Tensión arterial ciento cuarenta sobre ochenta y cinco, frecuencia
> cardiaca setenta y seis por minuto, frecuencia respiratoria dieciséis por minuto, saturación
> noventa y siete por ciento al ambiente. Cardiopulmonar sin alteraciones, ruidos cardiacos
> rítmicos sin soplos, murmullo vesicular conservado. Abdomen blando, no doloroso. En
> extremidades: rodilla derecha con crepitación a la movilización, dolor en la interlínea articular
> medial, sin derrame, con limitación de los últimos grados de flexión. Rodilla izquierda con
> crepitación leve y sin dolor a la palpación. Marcha antálgica. Pulsos periféricos presentes y
> simétricos, sin edemas.
>
> Paraclínicos previos que trae la paciente: hemograma normal, velocidad de sedimentación
> veinticuatro, proteína C reactiva negativa, glicemia noventa y ocho, creatinina cero punto ocho.
> Radiografía de rodillas en proyección anteroposterior de pie que muestra disminución del espacio
> articular medial bilateral, de predominio derecho, con osteofitos marginales y esclerosis
> subcondral.
>
> Análisis: se trata de paciente con cuadro clínico compatible con osteoartrosis de rodillas, de
> predominio derecho, con factores agravantes de sobrepeso y sedentarismo, sin signos de artritis
> inflamatoria, con paraclínicos que descartan proceso inflamatorio agudo.
>
> Plan: se indica acetaminofén un gramo cada ocho horas por siete días, mentira cada seis horas
> por cinco días, y se agrega diclofenaco tópico tres veces al día en la rodilla derecha. Se
> solicita valoración por fisiatría para terapia física con fortalecimiento de cuádriceps, se
> remite a nutrición para plan de reducción de peso, y se explica a la paciente la importancia de
> la actividad física de bajo impacto como natación o bicicleta estática. Se dan signos de alarma:
> aumento súbito del dolor, imposibilidad para apoyar el miembro, fiebre o enrojecimiento
> articular, por los cuales debe consultar. Control por consulta externa en seis semanas con los
> resultados de fisiatría. La paciente comprende las indicaciones y acepta el plan propuesto.

### 2.2 · La misma historia, en tres dictados (~1,5 min cada uno)

Repite el contenido de 2.1, pero en **tres dictados separados**: el primero hasta los antecedentes
familiares, el segundo el examen físico y los paraclínicos, y el tercero el análisis y el plan.

Sirve para saber si el problema es la **duración** o el **contenido**: si en tres partes sale bien
y de corrido sale mal, el culpable es el largo del audio.

### 2.3 · Diez minutos seguidos (~10 min)

Dicta el 2.1 completo y, sin soltar el atajo, sigue con esta evolución. Aquí busco el techo real,
no suponerlo.

> Evolución a las seis semanas. Paciente que regresa a control refiriendo mejoría parcial del
> dolor, que califica ahora en cuatro sobre diez. Asistió a ocho sesiones de terapia física de las
> doce programadas, refiere adherencia a los ejercicios en casa tres veces por semana. Logró
> reducción de tres kilos de peso con el plan de nutrición. Persiste dolor al bajar escaleras pero
> ya camina seis cuadras sin detenerse. Niega efectos adversos del acetaminofén, niega gastritis,
> niega sangrado.
>
> Al examen físico: peso setenta y cinco kilos, tensión arterial ciento treinta sobre ochenta,
> frecuencia cardiaca setenta y dos. Rodilla derecha con menor dolor a la palpación de la
> interlínea medial, persiste crepitación, mejoría en los grados de flexión, sin derrame. Fuerza
> muscular de cuádriceps cuatro sobre cinco, mejor que en la consulta previa. Marcha sin claudicación.
>
> Análisis: paciente con osteoartrosis de rodillas en respuesta favorable al manejo conservador,
> con adecuada adherencia a terapia física y reducción de peso, sin indicación quirúrgica en este
> momento.
>
> Plan: continuar acetaminofén un gramo cada ocho horas solo si presenta dolor, completar las doce
> sesiones de terapia física, continuar plan de nutrición con meta de perder cinco kilos
> adicionales en tres meses, mentira en cuatro meses. Se explica que el manejo es a largo plazo y
> que la cirugía de prótesis se considera solamente si hay dolor incapacitante que no responde al
> manejo médico. Se solicita nuevo control en tres meses con radiografía de control. Se entregan
> incapacidad no requerida y recomendaciones por escrito. La paciente y su hija comprenden y aceptan.

---

## Bloque 3 — Ocho especialidades

Cada uno trae **una corrección hablada** a propósito (donde dice "mentira", "perdón" o "me
equivoqué"): léela tal cual, es lo que queremos medir.

### 3.1 · Pediatría — control de niño sano (~1,5 min)

> Paciente masculino de tres años, que asiste a control de crecimiento y desarrollo acompañado de
> la madre. Sin antecedentes de importancia, producto de embarazo a término, parto vaginal, peso al
> nacer tres mil doscientos gramos, esquema de vacunación completo para la edad según el carné.
> Madre refiere buen apetito, deposiciones normales, sueño conservado, sin cuadros respiratorios
> en los últimos tres meses. Al examen físico: peso catorce kilos, talla noventa y cinco
> centímetros, perímetro cefálico cincuenta centímetros, todos en percentil cincuenta para la
> edad. Buen estado general, mucosas húmedas, sin palidez. Cardiopulmonar sin soplos, abdomen
> blando sin masas, genitales de aspecto normal, sin adenopatías. Desarrollo psicomotor acorde: el
> niño corre, sube escaleras alternando los pies, arma frases de cuatro palabras y sigue
> instrucciones de dos pasos. Análisis: niño sano con crecimiento y desarrollo adecuados para la
> edad. Plan: se indica acetaminofén jarabe ciento veinte miligramos cada seis horas en caso de
> fiebre, se explica que la dosis es de quince miligramos por kilo, se recomienda continuar
> alimentación variada con cinco comidas al día, limitar pantallas a una hora diaria y estimular
> el juego al aire libre. Control en seis meses, mentira en cuatro meses, con esquema de vacunación
> al día. Madre comprende y acepta las indicaciones.

### 3.2 · Ginecología y obstetricia — control prenatal (~1,5 min)

> Paciente femenina de veintisiete años, gestante, que asiste a control prenatal. Fecha de última
> menstruación el catorce de marzo, edad gestacional de veintiocho semanas por fecha de última
> menstruación, confiable, concordante con ecografía del primer trimestre. Primera gestación, sin
> abortos previos. Refiere movimientos fetales presentes y percibidos diariamente, niega sangrado
> vaginal, niega salida de líquido, niega contracciones, niega cefalea, niega fosfenos, niega
> tinitus, niega epigastralgia. Al examen físico: tensión arterial ciento diez sobre setenta,
> frecuencia cardiaca ochenta y dos por minuto, peso sesenta y ocho kilos con ganancia de nueve
> kilos en el embarazo. Altura uterina veintisiete centímetros, feto único, situación longitudinal,
> presentación cefálica, dorso a la izquierda, fetocardia de ciento cuarenta y cinco latidos por
> minuto. Edema de miembros inferiores grado uno, reflejos normales. Paraclínicos del segundo
> trimestre: hemoglobina once punto ocho, prueba de tolerancia a la glucosa normal, serologías no
> reactivas, urocultivo negativo. Análisis: gestante de veintiocho semanas, perdón, de veintinueve
> semanas, con embarazo de curso normal, sin signos de alarma. Plan: continuar ácido fólico
> cuatrocientos microgramos al día y sulfato ferroso sesenta miligramos al día, se solicita
> ecografía de crecimiento para las treinta y dos semanas, se explican signos de alarma obstétricos
> y se indica control en tres semanas. Paciente comprende y acepta.

### 3.3 · Ortopedia — trauma de rodilla (~1,5 min)

⚠️ Este trae la corrección **del lado**. Confundir derecha con izquierda es el error clásico y
grave de una historia clínica, y quiero ver cómo se comporta.

> Paciente masculino de veinticuatro años, futbolista aficionado, que consulta por dolor en rodilla
> derecha, mentira, en rodilla izquierda, de doce horas de evolución, posterior a trauma en torsión
> durante partido de fútbol, con apoyo del pie y giro del cuerpo, sin golpe directo. Refiere haber
> escuchado un chasquido al momento del trauma, con dolor inmediato e incapacidad para continuar
> jugando. Presenta aumento de volumen progresivo en las horas siguientes. Niega trauma previo en
> la misma rodilla, niega cirugías, niega antecedentes de importancia. Al examen físico: paciente
> en aceptables condiciones generales, marcha con claudicación y apoyo parcial. Rodilla izquierda
> con edema moderado, derrame articular palpable, dolor a la palpación de la interlínea medial,
> limitación de la flexión por dolor a ciento diez grados. Prueba de Lachman positiva, cajón
> anterior positivo, prueba de McMurray dolorosa en el compartimiento medial. Estabilidad en varo y
> valgo conservada. Pulsos distales presentes, llenado capilar menor de dos segundos, sin déficit
> neurológico. Análisis: paciente con trauma en torsión de rodilla izquierda, con hallazgos
> clínicos compatibles con lesión del ligamento cruzado anterior asociada a posible lesión
> meniscal medial. Plan: se solicita radiografía de rodilla izquierda en proyecciones
> anteroposterior y lateral para descartar lesión ósea, y resonancia magnética de rodilla
> izquierda. Se indica acetaminofén quinientos miligramos cada ocho horas, hielo local por veinte
> minutos cada seis horas, inmovilizador de rodilla y descarga con muletas. Incapacidad por cinco
> días, mentira por siete días. Control con resultados de imágenes en una semana. Paciente
> comprende y acepta.

### 3.4 · Dermatología — lesión en piel (~1 min)

> Paciente femenina de treinta y cuatro años que consulta por lesiones en codos y rodillas de seis
> meses de evolución, que describe como placas rojas con escamas blancas, pruriginosas, que
> empeoran en épocas de estrés y mejoran parcialmente con la exposición solar. Niega compromiso de
> uñas, niega dolor articular, niega fiebre. Antecedente familiar de psoriasis en la madre. Al
> examen físico: placas eritematodescamativas bien delimitadas, de aproximadamente cuatro
> centímetros de diámetro, con escama gruesa de color blanco nacarado, localizadas en cara de
> extensión de ambos codos y ambas rodillas, que comprometen aproximadamente el tres por ciento de
> la superficie corporal. Signo de Auspitz positivo. Cuero cabelludo sin compromiso, uñas sin
> alteraciones. Análisis: cuadro clínico compatible con psoriasis en placas, de severidad leve por
> extensión. Plan: se formula betametasona crema, me equivoqué, hidrocortisona al uno por ciento en
> crema dos veces al día por cuatro semanas, emoliente con urea al diez por ciento dos veces al
> día de forma permanente, y se explica que no debe suspender el emoliente al mejorar las lesiones.
> Se recomienda evitar el rascado y manejo del estrés. Control en un mes para evaluar respuesta.
> Paciente comprende y acepta.

### 3.5 · Psiquiatría — consulta por ansiedad (~1,5 min)

> Paciente femenina de treinta y un años, ingeniera, que consulta por cuadro de cuatro meses de
> evolución consistente en preocupación excesiva y difícil de controlar, asociada a tensión
> muscular, dificultad para conciliar el sueño, irritabilidad y sensación de nudo en la garganta.
> Refiere que los síntomas se presentan la mayoría de los días y que han afectado su rendimiento
> laboral y su relación de pareja. Niega ideación suicida, niega ideación homicida, niega consumo
> de alcohol o sustancias psicoactivas, niega episodios previos de depresión. Antecedente familiar
> de trastorno de ansiedad en la madre. Al examen mental: paciente alerta, orientada en las tres
> esferas, con adecuada presentación personal, actitud colaboradora, lenguaje coherente y fluido,
> afecto ansioso resonante, pensamiento de curso y contenido normales sin ideas delirantes, sin
> alteraciones sensoperceptivas, juicio conservado, introspección adecuada. Se aplica escala GAD
> siete con puntaje de catorce puntos, compatible con ansiedad moderada. Análisis: paciente con
> criterios de trastorno de ansiedad generalizada de intensidad moderada, sin riesgo suicida
> actual. Plan: se inicia sertralina veinticinco miligramos al día por una semana, mentira
> cincuenta miligramos al día después de la primera semana, se explican los efectos adversos
> iniciales y que el efecto terapéutico aparece entre la segunda y la cuarta semana. Se remite a
> psicoterapia cognitivo conductual, se recomienda higiene del sueño y actividad física regular.
> Control en cuatro semanas. Paciente comprende y acepta el manejo.

### 3.6 · Urgencias — nota rápida (~45 s)

Esta léela **(RÁPIDO)**, como se dicta de verdad en un turno.

> Paciente masculino de cuarenta y un años, triage dos, que ingresa por dolor abdominal de
> veinticuatro horas de evolución localizado inicialmente en epigastrio y que migró a fosa iliaca
> derecha, asociado a náuseas, un episodio emético y fiebre no cuantificada. Signos vitales al
> ingreso: tensión arterial cien sobre sesenta, frecuencia cardiaca ciento diez por minuto,
> frecuencia respiratoria veinte por minuto, temperatura treinta y ocho punto dos, saturación
> noventa y seis por ciento. Abdomen con dolor a la palpación en fosa iliaca derecha, Blumberg
> positivo, McBurney positivo, ruidos intestinales disminuidos. Se solicita hemograma, proteína C
> reactiva, uroanálisis y ecografía abdominal. Se inicia hidratación con lactato de Ringer mil
> mililitros, dipirona un gramo intravenoso y se deja en nada vía oral. Se solicita valoración
> prioritaria por cirugía general por sospecha de apendicitis aguda.

### 3.7 · Medicina interna — paciente pluripatológico (~2 min)

> Paciente masculino de setenta y tres años, pensionado, que asiste a control de medicina interna.
> Antecedentes de diabetes mellitus tipo dos de quince años de evolución, hipertensión arterial de
> veinte años, enfermedad renal crónica estadio tres A, fibrilación auricular permanente y
> dislipidemia. Medicamentos actuales: metformina ochocientos cincuenta miligramos cada doce horas,
> empagliflozina diez miligramos al día, losartán cincuenta miligramos cada doce horas,
> apixabán cinco miligramos cada doce horas y atorvastatina cuarenta miligramos en la noche.
> Refiere buena adherencia al tratamiento, niega hipoglicemias, niega sangrados, niega disnea,
> niega edemas, niega palpitaciones. Camina treinta minutos diarios. Al examen físico: tensión
> arterial ciento treinta y ocho sobre setenta y ocho, frecuencia cardiaca ochenta y cuatro por
> minuto irregular, peso setenta y nueve kilos, saturación noventa y seis por ciento. Ruidos
> cardiacos arrítmicos sin soplos, murmullo vesicular conservado, abdomen blando, extremidades sin
> edemas, pulsos pedios presentes. Paraclínicos recientes: hemoglobina glicosilada siete punto
> dos, glicemia en ayunas ciento treinta y cuatro, creatinina uno punto cuatro con tasa de
> filtración glomerular estimada de cincuenta y dos, potasio cuatro punto uno, colesterol LDL
> setenta y ocho, relación albuminuria creatinuria de ciento ochenta. Análisis: paciente
> pluripatológico con adecuado control glicémico y lipídico, con enfermedad renal crónica estable y
> albuminuria persistente, anticoagulado por fibrilación auricular sin eventos hemorrágicos.
> Plan: continuar el mismo esquema de medicamentos, se remite a nefrología, me equivoqué, a
> endocrinología para ajuste del manejo de la diabetes, y se solicita valoración por oftalmología
> para tamizaje de retinopatía diabética. Se solicitan paraclínicos de control en tres meses con
> hemoglobina glicosilada, creatinina, potasio y relación albuminuria creatinuria. Se refuerzan
> recomendaciones de dieta baja en sodio y actividad física. Control en tres meses. Paciente y su
> hijo comprenden y aceptan.

### 3.8 · Oftalmología — control de agudeza visual (~1 min)

Los números y las abreviaturas de aquí no se parecen a nada más del banco, y por eso vale la pena.

> Paciente femenina de cuarenta y seis años que consulta por visión borrosa de cerca de un año de
> evolución, que dificulta la lectura y el trabajo en el computador, asociada a cefalea frontal al
> final del día. Niega dolor ocular, niega ojo rojo, niega fotopsias, niega miodesopsias, niega
> pérdida súbita de visión. Sin antecedentes oftalmológicos, usa lentes de lectura comprados en
> farmacia. Al examen: agudeza visual sin corrección de veinte sobre cuarenta en ojo derecho y
> veinte sobre treinta en ojo izquierdo, que corrige a veinte sobre veinte en ambos ojos. Presión
> intraocular de dieciséis milímetros de mercurio en ojo derecho y dieciocho, mentira catorce
> milímetros de mercurio en ojo izquierdo. Segmento anterior sin alteraciones, cristalino
> transparente, cámara anterior amplia. Fondo de ojo con papila de bordes definidos, excavación de
> cero punto tres en ambos ojos, mácula sin alteraciones, vasos de calibre conservado, retina
> aplicada. Análisis: presbicia asociada a astigmatismo leve, sin signos de glaucoma ni retinopatía.
> Plan: se formula corrección óptica con esfera menos cero punto cincuenta y cilindro menos cero
> punto setenta y cinco a ciento ochenta grados en ambos ojos, con adición de más uno punto
> veinticinco para cerca. Se recomienda descanso visual cada veinte minutos y control anual.
> Paciente comprende y acepta.

---

## Bloque 4 — Dentro de gMedic

Repite el **3.7** dictando directamente en la historia clínica de gMedic, no en Notas. Aquí no
interesa el texto sino si el pegado se comporta igual dentro de su software.

---

## Qué necesito de vuelta

Por cada dictado:

1. **El texto que salió**, pegado tal cual, sin arreglarlo.
2. **Cuánto tardó** en aparecer, en los del bloque 2 (de memoria basta: "unos 8 segundos").
3. **Lo que te moleste como usuario**, aunque no sea del texto: que el atajo no responda, que la
   ventanita estorbe, que se demore. Eso no lo mide ningún banco.

Con eso monto los casos nuevos y la primera medición de la capa de voz.

**Tiempo total estimado:** unos 35 minutos de dictado, más el rato de pegar los resultados.
