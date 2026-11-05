import { useLanguage } from "./Language.jsx";
import { t, locale, getLanguage, headerAsset, translatedField } from "./i18n.js";
import React, { useEffect, useState } from 'react';
export async function api(path, options = {}) {
  const r = await fetch('/api/' + path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error('El servidor de acceso no está disponible. Abre ABRIR-EDITOR.command o utiliza el servidor de la web.');
  }
  if (!r.ok) throw Object.assign(Error(data.error || 'No se pudo completar la operación.'), {
    status: r.status
  });
  return data;
}
export function AccessGate({
  children
}) {
  useLanguage();
  const [activation] = useState(() => new URLSearchParams(location.hash.slice(1)).get('activar') || ''),
    [setup, setSetup] = useState(null),
    [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (activation) history.replaceState(null, '', location.pathname + location.search);
  }, [activation]);
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const check = async () => {
    try {
      const result = await api('session');
      const local = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
      if (!result.user || !['admin', 'reader'].includes(result.user.role) || result.mode === 'demo' && !local) throw Error('La web publicada requiere el servidor de acceso. El modo de muestra solo está permitido en este ordenador.');
      setSession(result);
    } catch (e) {
      setSession(null);
      if (e.status === 401) {
        try {
          setSetup(await api('setup'));
          setError('');
        } catch (setupError) {
          setError(setupError.message);
        }
      } else setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void check();
    const id = setInterval(check, 30000);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', check);
    };
  }, []);
  useEffect(() => {
    if (!session?.user.expiresAt) return;
    const remaining = session.user.expiresAt - Date.now();
    const id = setTimeout(() => {
      setSession(null);
      setError('Tu periodo de acceso ha terminado. Contacta con el administrador.');
    }, Math.min(Math.max(0, remaining), 2147483647));
    return () => clearTimeout(id);
  }, [session]);
  const logout = async () => {
    try {
      await api('logout', {
        method: 'POST',
        body: '{}'
      });
      setSession(null);
    } catch (e) {
      setError(e.message);
    }
  };
  if (loading) return <main className="login-screen">{t("Comprobando acceso\u2026")}</main>;
  if (session) return children(session, logout);
  const firstAccess = setup?.required === true;
  return <main className="login-screen"><form className="login-card" onSubmit={async e => {
      e.preventDefault();
      setError('');
      setSubmitting(true);
      const data = Object.fromEntries(new FormData(e.currentTarget));
      try {
        if (firstAccess) {
          await api('setup', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + activation
            },
            body: JSON.stringify(data)
          });
          setSetup({
            required: false
          });
        }
        setSession(await api('login', {
          method: 'POST',
          body: JSON.stringify(data)
        }));
      } catch (e) {
        setError(e.message);
      } finally {
        setSubmitting(false);
      }
    }}><img src={`${import.meta.env.BASE_URL}assets/logo-euskotren-bus.svg`} alt={t("Euskotren · autobusa")} /><h1>{t(firstAccess ? 'Activa tu cuenta de administrador' : 'Aula de rutas')}</h1><p>{t(firstAccess ? 'Elige tu contraseña para admobility26@gmail.com. Después podrás crear los usuarios y decidir su duración de acceso.' : 'Accede con el usuario y la contraseña que te ha facilitado el administrador.')}</p><label>{t("Usuario")}<input name="username" autoComplete="username" required maxLength={64} readOnly={firstAccess} defaultValue={firstAccess ? setup.username : ''} key={firstAccess ? 'setup' : 'login'} /></label><label>{t(firstAccess ? 'Elige tu contraseña' : 'Contraseña')}<input name="password" type="password" autoComplete={firstAccess ? 'new-password' : 'current-password'} minLength={firstAccess ? 10 : undefined} required maxLength={128} /></label>{t(firstAccess && <label>{t("Repite la contrase\xF1a")}<input name="repeat" type="password" autoComplete="new-password" minLength={10} required maxLength={128} /></label>)}{t(firstAccess && !activation && <p role="status">{t("Para activar esta cuenta, abre tu enlace privado de activaci\xF3n. Solo se necesita la primera vez.")}</p>)}{t(error && <p role="alert">{t(error)}</p>)}<button disabled={submitting || firstAccess && !activation} type="submit">{t(submitting ? 'Guardando…' : firstAccess ? 'Activar administrador y entrar' : 'Entrar')}</button><small>{t(firstAccess ? 'Contraseña de al menos 10 caracteres. No hay registro público de usuarios.' : 'El acceso estará disponible durante el periodo contratado.')}</small></form></main>;
}
export function UserManager({
  demo,
  onClose
}) {
  useLanguage();
  const [users, setUsers] = useState([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    try {
      setUsers((await api('admin/users')).users);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    if (!demo) void refresh();
  }, [demo]);
  const mutate = async (path, body, method = 'POST') => {
    setBusy(true);
    setError('');
    try {
      await api(path, {
        method,
        body: JSON.stringify(body)
      });
      await refresh();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return <div className="modal-backdrop"><section className="catalog users-panel" role="dialog" aria-modal="true" aria-label={t("Administrar usuarios")}><div className="catalog-heading"><h2>{t("Usuarios y duraci\xF3n de acceso")}</h2><button onClick={onClose} aria-label={t("Cerrar usuarios")}>{t("\u2715")}</button></div>{t(demo ? <p>{t("Esta es la muestra local de administrador. La creaci\xF3n de cuentas se activar\xE1 al configurar la base de datos de la web. No se crean usuarios ficticios ni se guardan contrase\xF1as en el navegador.")}</p> : <><p>{t("T\xFA creas las cuentas. Los usuarios pueden ver los recorridos; solo el administrador puede descargar o exportar.")}</p><form className="create-user" onSubmit={async e => {
          e.preventDefault();
          const form = e.currentTarget,
            data = Object.fromEntries(new FormData(form));
          if (await mutate('admin/users', {
            ...data,
            days: Number(data.days)
          })) form.reset();
        }}><label>{t("Usuario")}<input name="username" minLength={3} maxLength={64} required placeholder={t("conductor prueba")} autoComplete="off" /></label><label>{t("Contrase\xF1a")}<input name="password" type="password" minLength={10} maxLength={128} required autoComplete="new-password" /></label><label>{t("Duraci\xF3n (d\xEDas)")}<input name="days" type="number" min="1" max="3650" defaultValue="30" required /></label><button disabled={busy}>{t("Crear usuario")}</button></form><div className="user-list">{t(users.map(u => <article key={u.id}><strong>{t(u.username)}</strong><small>{t(u.role === 'admin' ? 'Administrador' : `${u.active ? 'Activo' : 'Desactivado'} · Hasta ${new Date(u.expiresAt).toLocaleString(locale())}`)}</small>{t(u.role !== 'admin' && <><form onSubmit={e => {
                e.preventDefault();
                const d = Object.fromEntries(new FormData(e.currentTarget));
                void mutate('admin/users/' + u.id, {
                  days: Number(d.days),
                  active: true
                }, 'PATCH');
              }}><input aria-label={t("D\xEDas para {0}", [u.username])} name="days" type="number" min="1" max="3650" defaultValue="30" required /><button disabled={busy}>{t("Renovar desde hoy")}</button></form><form onSubmit={async e => {
                e.preventDefault();
                const form = e.currentTarget;
                const password = new FormData(form).get('password');
                if (await mutate('admin/users/' + u.id, {
                  password
                }, 'PATCH')) form.reset();
              }}><input aria-label={t("Nueva contrase\xF1a de {0}", [u.username])} name="password" type="password" minLength={10} maxLength={128} required autoComplete="new-password" placeholder={t("Nueva contraseña")} /><button disabled={busy}>{t("Cambiar contrase\xF1a")}</button></form><button disabled={busy} onClick={() => mutate('admin/users/' + u.id, {
                active: !u.active
              }, 'PATCH')}>{t(u.active ? 'Desactivar acceso' : 'Activar acceso')}</button></>)}</article>))}</div></>)}{t(error && <p role="alert">{t(error)}</p>)}</section></div>;
}
export function PasswordChange({
  onClose,
  onChanged
}) {
  useLanguage();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return <div className="modal-backdrop"><section className="catalog" role="dialog" aria-modal="true" aria-label={t("Cambiar contraseña")}><div className="catalog-heading"><h2>{t("Cambiar mi contrase\xF1a")}</h2><button onClick={onClose}>{t("Cerrar")}</button></div><form className="pdf-fields" onSubmit={async e => {
        e.preventDefault();
        const b = Object.fromEntries(new FormData(e.currentTarget));
        if (b.password !== b.repeat) {
          setError('Las contraseñas nuevas no coinciden.');
          return;
        }
        setBusy(true);
        try {
          await api('password', {
            method: 'POST',
            body: JSON.stringify(b)
          });
          onChanged();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}><label>{t("Contrase\xF1a actual")}<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>{t("Nueva contrase\xF1a")}<input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></label><label>{t("Repite la nueva contrase\xF1a")}<input name="repeat" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></label><button disabled={busy}>{t("Guardar y volver a entrar")}</button></form>{t(error && <p role="alert">{t(error)}</p>)}</section></div>;
}
