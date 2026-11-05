# Euskotren Bus · Aula de rutas

Copia independiente del aula Bilbobus, preparada para Euskotren Bus. Repositorio exclusivo: https://github.com/admobility26/euskotrenbus. El proyecto original no se modifica y no se copian cuentas, contraseñas, sesiones, documentos privados, GPX ni vídeos de Bilbobus.

## Abrir el editor local

Requiere Node.js 24. Ejecuta `npm ci`, `npm run build` y `npm start`, o abre `ABRIR-EDITOR.command` después de compilar. Dirección: http://127.0.0.1:5193/ (puerto distinto al de Bilbobus).

El primer arranque crea el usuario `admin` y una contraseña aleatoria en `datos-locales/ACCESO-ADMIN.txt`. Cámbiala desde «Mi contraseña». No está incluida en GitHub. SQLite y archivos se guardan en `datos-locales`, excluida de Git. Cookies, nombre de base de datos y claves locales son exclusivos de Euskotren Bus.

## Biblioteca

13 entradas transcritas de la tabla del administrador: A2315, A2316, A2326, A2336, A3411, A3414, A3422, A3451, A3471, A3472, A3499, Estación Usansolo–Hospital Usansolo y Estación Zamudio–Parque Tecnológico Zamudio. Se conserva el número interno, el sentido y las variantes indicadas. USANSOLO y ZAMUDIO son identificadores locales, no códigos oficiales; la tabla no les asigna código.

Selecciona una línea, pulsa «Crear recorrido desde GPX» y elige Ida/Vuelta y variante. Adjunta el vídeo original y el PDF opcional desde la gestión de archivos del recorrido. No hay recorridos reales precargados ni coordenadas deducidas de la tabla. El PDF es de consulta.

## Funciones conservadas

- Usuarios con contraseña y duración de acceso, renovación, desactivación y cambio de contraseña.
- GPX, vídeo original, sincronización por instante y desfase guardado por recorrido.
- MP4 con mapa, vídeo PIP, avisos y logo Euskotren Autobusa; hasta una hora por sentido con guardado directo en disco.
- Biblioteca de lectores con MP4 final y PDF independiente, sin acceso a originales ni administración.
- Base privada de puntos conflictivos: coincidencia por proximidad, entrada/salida, excepciones por recorrido y asignación a varias líneas.
- Paquete portátil con aplicación y exportación opcional de datos privados.

`npm run package:local` prepara el ZIP de la aplicación. Para copiar cuentas y biblioteca, detén el servidor y ejecuta `python3 scripts/package-local.py --with-data`. No publiques ese ZIP privado en GitHub.

## Alojamiento

La copia funciona localmente con su propia SQLite. No está desplegada en Internet. `wrangler.jsonc` usa el nombre `euskotrenbus` y no enlaza la base de datos de Bilbobus. Para Cloudflare hay que crear una D1 independiente y añadir su enlace; el almacenamiento remoto también debe ser independiente. Consulta `docs/ALOJAMIENTO.md`.

Los mapas base requieren Internet. El exportador conserva el límite de 5 minutos si el navegador no permite guardar directamente en disco. La exportación completa de una hora requiere validación con los archivos reales del administrador.

## Fuentes y comprobaciones

Imágenes y tabla aportadas por el administrador el 05/11/2026; referencia conservada en `docs/referencia`. Las denominaciones no se han contrastado con horarios actuales. Mapa © OpenStreetMap contributors. Las marcas y fotografías pertenecen a sus titulares.

Compilación: `npm run build`. Pruebas: `node --test tests/*.test.mjs`.
