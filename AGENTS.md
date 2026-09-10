# AGENTS.md — Instrucciones del proyecto ALBA Abogacía

## 1. Objetivo

Construir y mantener la nueva web de **ALBA Abogacía & Consulting** con Astro y React. El resultado debe ser rápido, accesible, seguro, orientado a conversión y optimizado para SEO, AEO y búsqueda local.

No se trata de reproducir literalmente la web existente en WordPress/Divi. Se conservarán la identidad, el contenido válido y las URLs que aporten valor, pero se corregirán la jerarquía, el diseño, el rendimiento y la calidad editorial.

## 2. Fuente de verdad

Antes de modificar decisiones de marca o producto, consultar:

1. `DESIGN.md` para identidad, UX, accesibilidad y contenido.
2. Los archivos vectoriales originales proporcionados por la clienta.
3. La web pública actual únicamente como fuente de contenido a migrar.
4. La documentación oficial de Astro, React, Cap y Umami para integraciones.

No inventar teléfonos, direcciones, credenciales profesionales, horarios, tarifas, resultados, testimonios ni condiciones de consulta.

## 3. Stack obligatorio

- Astro.
- TypeScript en modo estricto.
- React solo para islas que necesiten estado o interacción compleja.
- Zod para validación de datos.
- Cap autoalojado para protección del formulario.
- Umami autoalojado para analítica.
- SMTP o proveedor transaccional aprobado para envío de correo.
- Docker para producción y despliegue compatible con Dokploy/Traefik.

No añadir Google Analytics ni reCAPTCHA.

## 4. Principios de implementación

- Preferir componentes `.astro` para contenido estático.
- No hidratar componentes sin una necesidad concreta.
- Mantener el contenido principal disponible en el HTML inicial.
- Usar mejora progresiva: el contenido debe seguir siendo comprensible si falla JavaScript.
- Mantener las dependencias al mínimo.
- Evitar bibliotecas de UI pesadas para componentes que puedan resolverse con HTML y CSS.
- Usar HTML semántico antes de añadir roles ARIA.
- No introducir secretos en variables públicas, código cliente, repositorio o salida de logs.

## 5. Organización recomendada

```text
src/
├── assets/
│   ├── brand/
│   └── images/
├── components/
│   ├── common/
│   ├── contact/
│   ├── home/
│   ├── seo/
│   └── services/
├── content/
│   ├── config.ts
│   ├── articles/
│   └── services/
├── layouts/
├── lib/
│   ├── analytics/
│   ├── captcha/
│   ├── email/
│   ├── seo/
│   └── validation/
├── pages/
│   ├── api/contacto.ts
│   ├── servicios/
│   ├── profesionales/
│   ├── recursos/
│   └── index.astro
├── styles/
└── types/
```

Evitar archivos genéricos enormes. Un componente debe tener una responsabilidad clara.

## 6. Convenciones

- Componentes: `PascalCase`.
- Funciones y variables: `camelCase`.
- Constantes globales: `UPPER_SNAKE_CASE` cuando proceda.
- Slugs y nombres de rutas: castellano, minúsculas y guiones.
- Tipos explícitos en fronteras de API.
- No usar `any` salvo justificación documentada.
- Textos visibles en castellano correcto, con tildes y puntuación.
- Comentarios solo cuando expliquen una decisión no evidente.

## 7. Componentes React

React está autorizado para:

- Estado avanzado del formulario.
- Integración programática con Cap si el formulario nativo no es suficiente.
- Menú móvil cuando requiera gestión de foco.
- Selectores o filtros interactivos.
- Interfaces futuras de reserva.

No usar React para:

- Títulos, texto o tarjetas estáticas.
- Migas de pan.
- Listas de servicios.
- Preguntas frecuentes que puedan resolverse con `details/summary`.
- Componentes meramente decorativos.

Elegir la directiva de hidratación más restrictiva posible (`client:idle`, `client:visible` o equivalente) y justificar `client:load`.

## 8. Formulario y correo

La ruta de servidor `POST /api/contacto` debe:

1. Aceptar únicamente `POST` y un tipo de contenido previsto.
2. Limitar el tamaño del cuerpo.
3. Normalizar y validar mediante Zod.
4. Verificar el token de Cap en el servidor.
5. Aplicar rate limiting y campo trampa.
6. Rechazar URLs o patrones sospechosos cuando la política lo contemple.
7. Enviar el correo solo después de superar todas las validaciones.
8. Devolver errores genéricos al cliente y detalles seguros al sistema de observación.
9. No registrar el mensaje ni los datos personales completos.
10. Emitir el evento Umami únicamente tras confirmar el resultado.

El correo deberá incluir nombre, contacto, tipo de consulta, oficina, preferencia de contacto y mensaje, escapando correctamente todo contenido introducido por el usuario.

Nunca exponer:

- `CAP_SECRET_KEY`
- `CAP_ADMIN_KEY`
- Credenciales SMTP
- Claves de sesión
- Variables internas de Umami

## 9. Cap

- Usar una versión fijada; no depender de `latest` en producción.
- Mantener Cap y Valkey en servicios separados y persistentes.
- Publicar el endpoint solo mediante HTTPS.
- Restringir CORS al dominio de producción y a los entornos necesarios.
- Mantener activados los desafíos de instrumentación salvo incompatibilidad verificada.
- Verificar cada token una sola vez en servidor.
- No considerar Cap como defensa única: mantener rate limiting y honeypot.

Variables previstas:

```env
CAP_API_URL=
PUBLIC_CAP_SITE_KEY=
CAP_SECRET_KEY=
CAP_ADMIN_KEY=
```

## 10. Umami

- Utilizar Umami autoalojado.
- No instalar Google Analytics, Google Tag Manager ni píxeles publicitarios sin una nueva decisión explícita.
- No enviar información personal, jurídica o financiera en eventos, URLs o propiedades.
- No incluir valores de campos del formulario en la analítica.
- Usar nombres de eventos estables definidos en `DESIGN.md`.
- Evitar eventos duplicados por hidratación o reintentos.
- Respetar `Do Not Track` si así se decide en la configuración del proyecto.

Variables públicas permitidas:

```env
PUBLIC_UMAMI_SCRIPT_URL=
PUBLIC_UMAMI_WEBSITE_ID=
```

## 11. SEO y AEO

Para cada página indexable:

- Un H1 único y descriptivo.
- `title`, descripción, canonical y metadatos sociales únicos.
- Contenido original y útil escrito para personas.
- Enlaces internos con textos descriptivos.
- Datos estructurados que coincidan con el contenido visible.
- Imágenes con dimensiones, formatos modernos y texto alternativo apropiado.
- Autoría y fecha de revisión en artículos jurídicos.

No crear páginas locales o de servicio mediante sustitución automática de palabras. No publicar contenido jurídico sin aprobación profesional.

No bloquear accidentalmente rastreadores de búsqueda mediante `robots.txt`, CDN, WAF o cabeceras. Las decisiones específicas sobre rastreadores de IA se documentarán y aprobarán antes de producción.

## 12. Privacidad

- Aplicar minimización de datos.
- No guardar consultas jurídicas en analítica.
- Evitar que los datos del formulario lleguen a parámetros de URL.
- No almacenar cuerpos de solicitudes en logs de proxy o aplicación.
- Definir plazos de conservación del correo con la clienta.
- Mantener actualizadas privacidad, cookies y aviso legal según el despliegue real.
- No afirmar que la web no necesita consentimiento sin una revisión jurídica de la configuración final.

## 13. Accesibilidad

- Objetivo WCAG 2.2 AA.
- Probar navegación solo con teclado.
- Mantener foco visible y orden lógico.
- Asociar cada campo con una etiqueta.
- Comunicar errores de forma textual, no solo mediante color.
- Respetar reducción de movimiento.
- Mantener contraste AA.
- No ocultar contenido esencial dentro de interacciones inaccesibles.

## 14. Rendimiento

- Definir presupuesto de JavaScript e imágenes antes de producción.
- No cargar React globalmente.
- Autoalojar fuentes y limitar pesos.
- Optimizar imágenes con Astro.
- Reservar dimensiones para evitar CLS.
- Evitar scripts bloqueantes.
- Posponer Umami sin perder medición esencial.
- Evaluar Lighthouse y Core Web Vitals en páginas representativas.

## 15. Seguridad

- Cabeceras recomendadas: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`.
- Dependencias fijadas y actualizadas conscientemente.
- Validación y escape en todas las fronteras.
- No confiar en validación del cliente.
- Protección CSRF cuando el modelo de sesión o despliegue la requiera.
- Rate limiting en aplicación y proxy.
- Secretos únicamente en el gestor de entorno de producción.

## 16. Pruebas obligatorias

Antes de considerar terminada una funcionalidad:

- Ejecutar formato, lint y comprobación de tipos.
- Ejecutar pruebas unitarias relacionadas.
- Probar el formulario con token válido, inválido, reutilizado y ausente.
- Probar error SMTP sin perder control de la interfaz.
- Verificar que Umami no recibe datos personales.
- Comprobar teclado, foco, contraste y lector de pantalla en componentes críticos.
- Revisar 320 px, tableta y escritorio.
- Validar sitemap, canonical, robots y datos estructurados JSON-LD.
- Comprobar redirecciones desde la web anterior.

## 17. Criterios de finalización

Una tarea no está finalizada solo porque compile. Debe:

- Cumplir el comportamiento solicitado.
- Estar probada en los casos principales y de error.
- Respetar `DESIGN.md`.
- No introducir regresiones de accesibilidad, SEO o privacidad.
- Incluir documentación si añade configuración o variables de entorno.
- No dejar secretos, datos de prueba personales ni marcadores sin resolver.

## 18. Cambios que requieren confirmación

Solicitar decisión antes de:

- Cambiar el logotipo o los colores de marca.
- Publicar datos personales o credenciales profesionales no confirmados.
- Añadir rastreadores, publicidad o servicios externos.
- Cambiar el destinatario de los formularios.
- Afirmar que una consulta es gratuita.
- Publicar, desplegar o modificar DNS y dominios.
- Eliminar contenido existente sin una redirección o decisión documentada.
