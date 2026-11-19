# JCC Control de Obra

App web (celular o PC) para el control diario de una obra: avance contra programa, curva S, asistencia y raya, bitácora con fotos, inventario con kárdex y pedido sugerido, y reporte imprimible.

## Cómo abrirla
- **En la PC:** doble clic en `index.html` (funciona sin internet). Las fotos y el modo instalable necesitan abrirla desde un servidor (ver abajo).
- **En el celular / instalable:** súbela a un hosting estático (GitHub Pages, Netlify) y ábrela con la dirección `https://…`. Chrome ofrecerá “Agregar a pantalla de inicio” y funcionará sin señal.
- **Servidor local de prueba:** `python -m http.server 8000` en esta carpeta y abre `http://localhost:8000`.

## Dónde quedan los datos
En el navegador del dispositivo (localStorage + IndexedDB para fotos). **Haz respaldos** desde ⚙ Ajustes ▸ Descargar respaldo (un .json con fotos incluidas).

## Estructura
```
index.html              Entrada; carga los scripts en orden
css/styles.css          Estilos (incluye formato de impresión del reporte)
js/calc.js              Cálculos puros: avance programado/real, estados, curva S, inventario, raya
js/store.js             Datos, guardado y obra de ejemplo
js/fotos.js             Fotos comprimidas en IndexedDB
js/ui.js                Utilidades de interfaz (elementos, modales, formularios, avisos)
js/views/*.js           Una pantalla por archivo: tablero, asistencia, diario, programa, inventario, reporte, ajustes
js/app.js               Navegación y barra inferior
sw.js, manifest         Modo instalable / sin conexión
tests/calc.test.js      Pruebas de los cálculos:  node tests/calc.test.js
```

## Reglas de cálculo
- **Programado** de una actividad: lineal entre inicio y término (el día de hoy cuenta completo).
- **Real**: último avance acumulado registrado.
- **Obra**: promedio de actividades ponderado por duración.
- **Estado**: Terminada (100%), Por iniciar, Adelantada (+5 pts), Atención (−5), Atrasada (−15 o pasó su término). Umbrales editables en Ajustes.
- **Días de atraso** = puntos de desviación × duración / 100.
- **Inventario**: consumo promedio = salidas de los últimos 14 días / 14; “por llegar al mínimo” si se alcanza en ≤ 7 días; pedido sugerido = máximo − existencia (o 2×mínimo si no hay máximo).
