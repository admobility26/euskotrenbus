# Editor local Euskotren Bus

Abre ABRIR-EDITOR.command y entra en http://127.0.0.1:5193/. Requiere Node.js 24 y una compilación previa si se parte del código fuente. ABRIR-MUESTRA.command abre el mismo editor autenticado. El primer inicio crea admin y una contraseña aleatoria en datos-locales/ACCESO-ADMIN.txt; no comparte cuentas con otra aplicación.

La biblioteca contiene 11 líneas con código A y dos servicios sin código oficial en la tabla, con sus variantes. Crea cada recorrido a partir del GPX, selecciona Ida/Vuelta y variante, añade vídeo original y PDF opcional. El PDF solo se consulta; no determina el itinerario. Los extremos del GPX son puntos de referencia, no paradas oficiales inferidas. Archivos locales de hasta 8 GB. Los originales no requieren marca previa: se añade el logo Euskotren Autobusa al exportar.

## Sincronización y exportación

Con GPX con tiempos y vídeo original, pulsa Ajustar sincronización, sitúa ambos en el mismo instante y pulsa Vincular este instante. El desfase queda guardado por recorrido y nombres de archivos; revisa al cambiarlos. Sin tiempos GPX, el avance es proporcional.

Exporta hasta una hora por sentido en Chrome/Edge con guardado directo en disco. Sin esa opción, el límite es cinco minutos. Mantén la pestaña abierta y comprueba una exportación completa con tus originales antes de validar producción.

Publica el MP4 en Biblioteca → recorrido → Gestionar PDF, vídeo y GPX → MP4 final exportado. Los lectores ven únicamente el MP4 final y el PDF disponible. No tienen controles de descarga ni acceso a GPX, originales o puntos conflictivos privados; esto no impide capturas externas.

## Usuarios y traslado

Crea cuentas con contraseña de al menos diez caracteres y duración en días; puedes renovar o desactivar desde Usuarios y acceso. Las credenciales y sesiones se guardan en la base local propia.

npm run package:local genera la aplicación portable. Detén el servidor antes de ejecutar python3 scripts/package-local.py --with-data para incluir la biblioteca y las cuentas. El ZIP privado nunca se publica en GitHub. Consulta ALOJAMIENTO.md para trasladarlo al servidor elegido.

### Base privada de puntos conflictivos

Entra como administrador y abre «Puntos conflictivos». Sitúa el recorrido con la barra del mapa y usa «Usar posición actual del recorrido». Escribe el título y la indicación, comprueba las coordenadas, entrada y salida y guarda. También puedes introducir coordenadas manualmente. Los datos se guardan en SQLite local (D1 en Cloudflare) y viajan en el paquete con datos.

Cada GPX abierto se cruza automáticamente con la base activa. El radio de asignación es de 20 m por defecto; entrada y salida se comparan con una tolerancia de 45°. Los ángulos son geográficos: norte 0°, este 90°, sur 180°, oeste 270°. Deja salida vacía si solo importa la aproximación, o ambos sentidos vacíos si afecta a todas las direcciones. Se distinguen sentidos físicos, no etiquetas «ida/vuelta» que pueden variar entre líneas. Revisa las coincidencias con «revisar paso», especialmente con GPS impreciso o calles paralelas. No se infiere por sí solo el riesgo de un giro: lo define el administrador.

Como Elorrieta, aparece la tarjeta del punto más próximo a menos de 85 m durante el recorrido. La misma selección se dibuja en el MP4 con la marca Euskotren Bus. El usuario no tiene acceso al catálogo: ve la tarjeta integrada en el vídeo final cuando pasa por el punto. Tras editar avisos, exporta y publica de nuevo los MP4 afectados; los anteriores no se modifican. La consulta y modificación de toda la base están reservadas al administrador en el servidor.

### Corregir asignaciones y seleccionar varias líneas

En «Puntos conflictivos», cada punto tiene un selector «En este recorrido»: **Automático**, **Incluir** o **Excluir de este recorrido**. Este selector guarda inmediatamente y solo afecta al recorrido abierto (por ejemplo, la ida), sin eliminar el punto de la base ni cambiar la vuelta. Volver a Automático elimina la excepción.

Para asignar a varias líneas, pulsa **Editar punto y asignaciones**. En «Asignación por línea y recorrido» puedes buscar, marcar una línea entera o recorridos individuales y aplicar Incluir, Excluir o Automático a la selección. Finalmente pulsa **Guardar cambios**. El selector muestra los recorridos ya guardados en la biblioteca; los nuevos comienzan en Automático. Las excepciones pertenecen al recorrido concreto, por lo que actualizar su GPX conserva la decisión y crear otro recorrido no la hereda.

**Incluir** fuerza el aviso en el paso continuo más cercano del GPX, ignorando radio y orientación; revisa ese paso antes de exportar. Si está a más de 60 m del punto, la lista de coincidencias lo marca como alejado. No atraviesa discontinuidades del GPX. Un punto desactivado globalmente no se muestra aunque esté incluido manualmente.

**Eliminar de toda la base** requiere confirmar y elimina el punto para todos los recorridos futuros; para corregir solo una línea/sentido usa Excluir. Las correcciones se aplican tanto a la vista previa como al siguiente MP4 exportado. Los MP4 ya creados deben volver a exportarse y publicarse.
