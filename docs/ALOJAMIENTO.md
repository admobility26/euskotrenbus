# Alojamiento independiente · Euskotren Bus

La entrega incluye el editor local y el código en admobility26/euskotrenbus. No se realiza un despliegue público ni se vinculan recursos de otra empresa.

## Servidor propio

Genera el paquete con `npm run package:local`. Para incluir datos, detén el servidor y usa `python3 scripts/package-local.py --with-data`. En el destino instala Node.js 24 y ejecuta `node server/local.mjs` dentro de la carpeta EuskotrenBus. El servidor empaquetado no necesita descargar dependencias.

Conserva datos-locales en un volumen persistente. Configura HTTPS mediante proxy inverso y `EUSKOTRENBUS_ORIGIN=https://dominio-elegido`. Usa `EUSKOTRENBUS_HOST=127.0.0.1` si el proxy está en la misma máquina. El puerto predeterminado es 5193; se puede cambiar con PORT. Ajusta los límites de subida del proxy para los originales de hasta 8 GB y prepara copias de seguridad. No publiques datos-locales como contenido estático.

## Cloudflare

Web: https://euskotrenbus.admobility26.workers.dev. Worker euskotrenbus con binding DB a la base independiente euskotrenbus-users. No comparte usuarios ni datos con Bilbobus.

El administrador es admobility26@gmail.com. La primera contraseña la elige el propietario mediante el enlace privado de activación entregado fuera del repositorio. La creación requiere un token aleatorio con caducidad; su hash se guarda en admin_setup y se elimina tras activar la cuenta. El correo por sí solo no permite reclamar ni restablecer la cuenta. Después, los usuarios solo se crean desde el panel del administrador.

La aplicación local y la web tienen bases independientes: activar una no crea la cuenta en la otra. El código de activación y los archivos HTML de acceso no se suben a GitHub. Guarda los enlaces de primera activación en un lugar privado y no los compartas.

El almacén remoto MEDIA no está activado. Los originales y documentos del editor local siguen en disco; para publicarlos en remoto hay que elegir un almacén privado o trasladar la biblioteca al servidor propio. No se ha contratado R2.

El comando de compilación es npm run build. Wrangler también lo ejecuta mediante build.command antes de desplegar para crear dist.
