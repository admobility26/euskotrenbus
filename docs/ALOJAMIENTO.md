# Alojamiento independiente · Euskotren Bus

La entrega incluye el editor local y el código en admobility26/euskotrenbus. No se realiza un despliegue público ni se vinculan recursos de otra empresa.

## Servidor propio

Genera el paquete con `npm run package:local`. Para incluir datos, detén el servidor y usa `python3 scripts/package-local.py --with-data`. En el destino instala Node.js 24 y ejecuta `node server/local.mjs` dentro de la carpeta EuskotrenBus. El servidor empaquetado no necesita descargar dependencias.

Conserva datos-locales en un volumen persistente. Configura HTTPS mediante proxy inverso y `EUSKOTRENBUS_ORIGIN=https://dominio-elegido`. Usa `EUSKOTRENBUS_HOST=127.0.0.1` si el proxy está en la misma máquina. El puerto predeterminado es 5193; se puede cambiar con PORT. Ajusta los límites de subida del proxy para los originales de hasta 8 GB y prepara copias de seguridad. No publiques datos-locales como contenido estático.

## Cloudflare, si se elige más adelante

`wrangler.jsonc` contiene únicamente el Worker euskotrenbus y sus recursos estáticos. Crea una nueva base D1, por ejemplo euskotrenbus-users; añade un bloque d1_databases con binding DB y el identificador NUEVO. Inicializa server/schema.sql y crea el administrador por el mecanismo ADMIN_SETUP_TOKEN de server/worker.js. No reutilices identificadores, tokens ni cuentas de Bilbobus.

Para archivos remotos se necesita el binding MEDIA a un almacén privado propio compatible con R2; sin él, las cargas mostrarán almacenamiento pendiente. El editor local funciona con archivos en disco y no requiere R2. Los datos locales no se suben automáticamente a Cloudflare. No actives servicios de pago sin revisar sus costes.

El comando de compilación es npm run build. Wrangler también lo ejecuta mediante build.command antes de desplegar para crear dist.
