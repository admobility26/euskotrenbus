"""Export application only, or application plus private data with --with-data.
Stop the local server before exporting data for a consistent SQLite snapshot.
"""
from pathlib import Path
import zipfile,sys,sqlite3,tempfile
root=Path(__file__).resolve().parent.parent
out=root/'paquetes';out.mkdir(exist_ok=True)
with_data='--with-data' in sys.argv
filename=out/('EuskotrenBus-privado.zip' if with_data else 'EuskotrenBus-aplicacion.zip')
with zipfile.ZipFile(filename,'w',zipfile.ZIP_DEFLATED) as z:
 for folder in ['dist','server','docs']:
  for p in (root/folder).rglob('*'):
   if p.is_file():z.write(p,Path('EuskotrenBus')/p.relative_to(root))
 z.write(root/'package.json','EuskotrenBus/package.json')
 z.write(root/'ABRIR-EDITOR.command','EuskotrenBus/ABRIR-EDITOR.command')
 if with_data:
  data=root/'datos-locales'
  if not (data/'euskotrenbus.sqlite').exists():raise SystemExit('No hay biblioteca local para exportar.')
  with tempfile.TemporaryDirectory() as temp:
   dest=Path(temp)/'euskotrenbus.sqlite'
   with sqlite3.connect(data/'euskotrenbus.sqlite') as source,sqlite3.connect(dest) as target:source.backup(target)
   z.write(dest,'EuskotrenBus/datos-locales/euskotrenbus.sqlite')
  for p in (data/'archivos').rglob('*'):
   if p.is_file() and not p.name.endswith('.part'):z.write(p,Path('EuskotrenBus/datos-locales')/p.relative_to(data))
print(filename)
