# Seguridad

Qué protege la web y el panel, y qué tiene que estar configurado afuera del código.

## Lo que hace el código

| Riesgo | Defensa |
|---|---|
| Acceso al panel sin permiso | Cada página y acción valida la sesión y el rol (`back/admin/auth/session.ts`) y la base lo vuelve a exigir con RLS. Los empleados no ven costos ni cambian precios. |
| Cuentas que se crean solas | Solo es personal activo el primer usuario y quien crea el admin (email confirmado). Quien se registra solo (email sin confirmar, teléfono, anónimo) queda **inactivo** (`handle_new_user`). |
| Fuerza bruta en el login | 8 intentos por cuenta y 30 por IP cada 15 min (`shared/rate-limit.ts`). El mensaje de error no dice si el email existe. |
| Abuso del buscador público | 60 búsquedas por minuto por IP en `/api/buscar`. |
| Scripts y HTML en los textos | Todo texto libre pasa por `plainText()` (`shared/schemas/text.ts`): sin etiquetas HTML, `javascript:` ni caracteres invisibles. Largo y rango de cada campo validados con Zod, en el formulario y de nuevo en el servidor. |
| Enlaces e iframes peligrosos | Las imágenes deben ser `http(s)`. El Instagram del local solo acepta `https://instagram.com/…`. Las publicaciones solo se incrustan si son links de `instagram.com/p|reel|tv/…`, en un iframe con `sandbox`. |
| XSS / clickjacking / sniffing | Cabeceras en `next.config.ts`: CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS. El panel no se cachea. |
| Datos de la base | RLS en todas las tablas, permisos revocados por defecto, funciones con `search_path` fijo, la web pública solo lee vistas `public_*` sin costos ni stock exacto. |
| Parámetros de URL | Los ids se validan como uuid y los slugs con formato fijo antes de llegar a la base. |

## Lo que hay que configurar afuera (Supabase en Coolify)

En las variables del servicio Supabase:

```
DISABLE_SIGNUP=true
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
ENABLE_EMAIL_AUTOCONFIRM=false
```

- Contraseñas largas y únicas para el admin del panel, para el usuario de Studio (`SERVICE_USER_ADMIN`) y para el panel de Coolify.
- Poner **HTTPS** en la app y en Kong (dominio con certificado) y cerrar el puerto 8000 de Coolify al público.
- La `service_role key` no va en la app ni en el repo: solo se usa para scripts puntuales, por variable de entorno.
- Usar `npm audit --omit=dev` antes de cada despliegue.
