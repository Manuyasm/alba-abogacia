# ALBA Abogacía & Consulting — Sistema de diseño web

## 1. Propósito

Este documento define el sistema visual, editorial y de experiencia de usuario para la renovación de `alba-abogacia.es`. La web debe transmitir solvencia jurídica, cercanía, claridad, discreción y profesionalidad, evitando la apariencia genérica de las plantillas tradicionales de despachos.

La implementación prevista utiliza Astro como base, React solo para interfaces interactivas y componentes accesibles, Cap para proteger el formulario y Umami para analítica.

## 2. Principios de diseño

1. **Claridad antes que ornamentación.** El visitante debe comprender en pocos segundos qué problemas resuelve el despacho y cómo solicitar ayuda.
2. **Confianza demostrable.** La experiencia, las especialidades, las oficinas y la autoría profesional deben ser visibles y verificables.
3. **Cercanía profesional.** El lenguaje será humano y comprensible, sin perder rigor jurídico.
4. **Privacidad desde el diseño.** No se enviarán datos personales a sistemas de analítica ni se emplearán mecanismos de seguimiento innecesarios.
5. **Accesibilidad real.** El sitio se diseñará para navegación por teclado, lectores de pantalla, ampliación de texto y reducción de movimiento.
6. **Rendimiento como parte de la marca.** Una experiencia rápida y estable refuerza la percepción de calidad.

## 3. Identidad de marca

Los archivos originales de Illustrator de 2015 son la fuente visual de referencia:

- `Trazado - Carpetas.ai`
- `Trazado - Tarjetas Personales Veronica Alba - FRENTE - 90x55.ai`
- `Trazado - Tarjetas Personales Veronica Alba - DORSO - 90x55.ai`

La identidad conserva el símbolo de tres formas enlazadas, el nombre **Alba** y el descriptor **Abogacía & Consulting**. La nueva web modernizará su aplicación sin alterar el reconocimiento de la marca.

### 3.1 Paleta preliminar

Los siguientes valores se han obtenido de previsualizaciones rasterizadas y deberán validarse contra los colores vectoriales originales antes de cerrar producción.

| Token | Valor preliminar | Uso |
| --- | --- | --- |
| `--color-brand-red` | `#B53837` | CTA, enlaces activos, pequeños acentos |
| `--color-brand-red-dark` | `#922B2C` | Hover y estados de foco complementarios |
| `--color-brand-brown` | `#673F24` | Títulos, pie y elementos institucionales |
| `--color-cream` | `#FBF2DB` | Fondos de secciones destacadas |
| `--color-cream-deep` | `#F5E5BC` | Bordes y superficies secundarias |
| `--color-paper` | `#FFFEFC` | Fondo principal |
| `--color-ink` | `#211B18` | Texto principal |
| `--color-muted` | `#675F5A` | Texto secundario |
| `--color-border` | `#E4DDD5` | Divisores y campos |
| `--color-success` | `#236A49` | Confirmaciones |
| `--color-error` | `#A82424` | Errores |

El rojo no debe cubrir grandes superficies salvo en piezas muy controladas. Se utilizará principalmente para guiar la acción. Los fondos serán blancos o crema muy suave.

### 3.2 Logotipo y recursos

Recursos que se prepararán desde el vector original:

- `logo-horizontal.svg`
- `logo-vertical.svg`
- `simbolo.svg`
- `favicon.svg`
- `favicon.ico`
- `apple-touch-icon.png`
- `og-image.jpg`

Reglas:

- Mantener el área de seguridad alrededor del logotipo.
- No deformar, inclinar, sombrear ni recolorear arbitrariamente.
- Usar el símbolo solo cuando el nombre del despacho ya sea identificable por contexto.
- Emplear una versión monocroma cuando el contraste del fondo lo requiera.
- Las marcas de agua no superarán una opacidad visual aproximada del 5 %.

### 3.3 Tipografía

Los textos de los artes originales están convertidos a trazados, por lo que la familia exacta no puede verificarse desde los PDF compatibles incluidos en los `.ai`.

Propuesta web:

- **Títulos:** `Source Serif 4`, con fallback `Georgia, serif`.
- **Texto e interfaz:** `Inter`, con fallback `system-ui, sans-serif`.

Las fuentes deberán autoalojarse en formato WOFF2, con los pesos estrictamente necesarios.

Escala orientativa:

| Elemento | Escritorio | Móvil |
| --- | --- | --- |
| H1 | 56–64 px | 38–44 px |
| H2 | 38–44 px | 30–34 px |
| H3 | 25–30 px | 22–26 px |
| Texto destacado | 20–22 px | 18–20 px |
| Cuerpo | 17–18 px | 16–17 px |
| Texto auxiliar | 14–15 px | 14 px |

El ancho máximo de lectura estará entre 65 y 75 caracteres por línea. No se centrarán párrafos extensos.

## 4. Voz y contenido

### 4.1 Personalidad verbal

- Clara, serena y directa.
- Profesional sin expresiones grandilocuentes.
- Empática sin prometer resultados.
- Comprensible para personas sin conocimientos jurídicos.
- Preferencia por “usted” mientras el despacho no decida lo contrario.

### 4.2 Mensajes

Evitar:

- “Somos líderes” sin una evidencia verificable.
- “Resultados garantizados”.
- “Los mejores abogados”.
- Repetir constantemente “excelencia”, “innovación” y “soluciones a medida”.
- Texto jurídico creado automáticamente sin revisión profesional.

Favorecer:

- Qué situación resuelve el servicio.
- Qué puede esperar el cliente.
- Qué documentación puede necesitar.
- Cuáles son los siguientes pasos.
- Cuándo es recomendable pedir asesoramiento.

### 4.3 Patrón AEO para respuestas

Cada pregunta importante debe presentar:

1. Un encabezado formulado como pregunta natural.
2. Una respuesta directa de aproximadamente 40–70 palabras.
3. Una ampliación con pasos, supuestos o documentación.
4. Límites y matices cuando la respuesta dependa del caso.
5. Fuente oficial cuando corresponda.
6. Autor profesional y fecha de revisión.
7. CTA contextual, sin interrumpir la lectura.

No se añadirá marcado estructurado que no coincida con contenido visible.

## 5. Arquitectura de información

### Navegación principal

- Inicio
- Servicios
- El despacho
- Profesionales
- Recursos
- Contacto

### Rutas iniciales

```text
/
/servicios/
/servicios/derecho-de-familia/
/servicios/divorcios-y-separaciones/
/servicios/custodia-y-menores/
/servicios/herencias-y-sucesiones/
/servicios/derecho-laboral/
/servicios/seguridad-social/
/servicios/contratos-y-reclamaciones/
/servicios/mediacion-y-conflictos/
/servicios/consultoria-financiera/
/el-despacho/
/profesionales/veronica-alba-suarez/
/profesionales/aitor-dominguez-lopez/
/abogados-langreo/
/abogados-asturias/
/abogados-madrid/
/recursos/
/contacto/
/aviso-legal/
/politica-de-privacidad/
/politica-de-cookies/
```

Las páginas locales tendrán contenido auténtico y específico. No serán duplicados que solo cambien el nombre de la ciudad.

## 6. Página de inicio

Orden recomendado:

1. Cabecera compacta con contacto y CTA.
2. Hero con propuesta de valor y fotografía real.
3. Principales situaciones jurídicas atendidas.
4. Presentación de Verónica y del despacho.
5. Servicios jurídicos y consultoría financiera claramente diferenciados.
6. Método de trabajo en tres pasos.
7. Oficinas de Asturias y Madrid.
8. Preguntas frecuentes prioritarias.
9. CTA de consulta.
10. Formulario de contacto.
11. Pie corporativo y legal.

El hero debe evitar un eslogan genérico. Debe explicar el servicio, la zona y el beneficio principal en una sola lectura.

## 7. Componentes

### 7.1 Botones

- Primario: fondo rojo, texto blanco.
- Secundario: fondo transparente, borde marrón.
- Terciario: enlace textual con indicador direccional.
- Altura mínima táctil: 44 px.
- Todos los estados necesitan `hover`, `focus-visible`, `active` y `disabled`.

### 7.2 Tarjetas de servicio

- Título orientado al problema del usuario.
- Descripción de dos o tres líneas.
- Enlace descriptivo: “Ver servicio de herencias”.
- Iconografía sobria y consistente.
- Evitar grandes espacios reservados para imágenes decorativas.

### 7.3 Fotografías

- Prioridad absoluta a profesionales, oficinas y escenas reales.
- Evitar mazos, balanzas, columnas clásicas y apretones de manos de banco de imágenes.
- Reservar dimensiones con `width` y `height` para evitar saltos de diseño.
- Generar AVIF y WebP con un fallback apropiado.
- El texto alternativo describirá la función real de la imagen; una imagen decorativa usará `alt=""`.

### 7.4 Preguntas frecuentes

- Implementar con HTML accesible (`details` y `summary`) cuando sea suficiente.
- Mantener las respuestas dentro del HTML inicial.
- No depender de JavaScript para que buscadores o lectores de pantalla accedan al contenido.

## 8. Formulario de contacto

Campos previstos:

- Nombre y apellidos.
- Correo electrónico.
- Teléfono.
- Tipo de consulta.
- Oficina preferida: Asturias o Madrid.
- Preferencia de contacto: llamada, correo o WhatsApp.
- Mensaje.
- Aceptación obligatoria de la política de privacidad.

Flujo:

```text
Formulario → Cap → POST /api/contacto → validación → limitación de frecuencia → SMTP → confirmación
```

Requisitos:

- Validación compartida con Zod y validación definitiva en servidor.
- Cap autoalojado y verificación del token en servidor.
- Token de Cap de un solo uso.
- Campo trampa y limitación de solicitudes como defensas adicionales.
- Credenciales y claves privadas solo en variables de entorno del servidor.
- Mensajes de error concretos y asociados con cada campo.
- No registrar el contenido jurídico del mensaje en logs ordinarios.
- Correo al despacho y confirmación automática opcional al remitente.
- La promesa de “consulta gratuita” solo se mostrará si el despacho la confirma expresamente.

## 9. Analítica con Umami

Umami se autoalojará y no se utilizará Google Analytics.

Eventos previstos:

- `contact_form_started`
- `contact_form_success`
- `contact_form_error`
- `phone_click`
- `email_click`
- `whatsapp_click`
- `appointment_click`
- `service_view`
- `office_selection`

Nunca se enviarán a Umami nombres, correos, teléfonos, mensajes jurídicos ni otros datos personales introducidos en el formulario.

La política de privacidad y la necesidad de consentimiento se determinarán según la configuración real desplegada, no solo por la elección del producto.

## 10. SEO, AEO y datos estructurados

Cada página indexable tendrá:

- Un único H1.
- `title` y `description` únicos.
- URL descriptiva y canónica.
- Open Graph y Twitter Card.
- Enlaces internos contextuales.
- Migas de pan visibles cuando correspondan.
- Autor y fecha de revisión en contenido profesional.
- Contenido importante incluido como HTML generado por Astro.

JSON-LD previsto según cada página:

- `LegalService`
- `Organization`
- `LocalBusiness`
- `Person`
- `Service`
- `Article`
- `BreadcrumbList`
- `WebSite`

También se generarán `sitemap.xml`, `robots.txt`, feed para recursos y redirecciones 301 desde las URLs actuales que cambien.

## 11. Accesibilidad

Objetivo: WCAG 2.2 nivel AA.

- Contraste mínimo AA.
- Navegación completa por teclado.
- Enlace “Saltar al contenido”.
- Foco siempre visible.
- Etiquetas reales en campos; no usar el placeholder como etiqueta.
- Mensajes dinámicos mediante regiones `aria-live` cuando proceda.
- Controles táctiles de al menos 44 × 44 px.
- Respeto de `prefers-reduced-motion`.
- Jerarquía semántica correcta.
- Sin texto incrustado en imágenes cuando sea información necesaria.

## 12. Responsive

Diseño mobile-first con puntos de adaptación basados en el contenido, no en modelos concretos de dispositivo.

- 320–767 px: una columna y CTA principal visible.
- 768–1023 px: composiciones intermedias.
- 1024 px o más: rejilla amplia con máximo de contenido controlado.
- Ancho máximo general aproximado: 1200–1280 px.

No debe existir desplazamiento horizontal a 320 px.

## 13. Movimiento

El sistema de movimiento distingue explícitamente **dos bandas de duración**, cada una con su propio propósito y su propio rango — no existe una única duración "correcta" para todo:

- **Banda interactiva (150–250 ms)**: transiciones de estado en elementos con los que la persona usuaria interactúa directamente — botones, enlaces, hover/focus de tarjetas, apertura del menú móvil, el patrón compartido `transition-interactive`. Debe sentirse inmediata, como una respuesta directa a la acción.
- **Banda de entrada por scroll (500–650 ms)**: animaciones de aparición de secciones al entrar en el viewport (`data-reveal`, variantes `fade-up`/`fade`/`fade-left`/`fade-right`/`stagger`). Deliberadamente más lenta que la banda interactiva — es una entrada de contenido, no una respuesta a una acción del usuario, y debe leerse como un movimiento suave y controlado, nunca como un parpadeo instantáneo.

Ambas bandas se verifican automáticamente mediante el escáner de guardarraíl de movimiento (`motion-guardrail.test.ts`), que aísla el bloque de CSS de entrada por scroll (marcado con comentarios `MOTION-GUARDRAIL: reveal-band-start/end` en `global.css`) del resto de la hoja de estilos antes de aplicar cada límite por separado. Cualquier duración fuera de su banda correspondiente hace fallar la prueba.

- Animaciones solo cuando expliquen estado, jerarquía o la incorporación de una sección a la vista.
- Sin parallax intenso, carruseles automáticos ni entradas que oculten inicialmente contenido importante: todo el contenido de una sección con `data-reveal` es visible por defecto sin JavaScript; el guion solo añade la animación de entrada cuando el navegador la soporta y la persona usuaria no ha solicitado movimiento reducido.
- Desactivar movimiento no esencial con `prefers-reduced-motion`: la regla global colapsa ambas bandas a una duración casi nula, independientemente de la banda a la que pertenezca cada transición.

### 13.1 Adopción acotada de ClientRouter

El sitio sigue siendo multipágina estática (`output: "static"`), no una SPA: `<ClientRouter />` (Astro View Transitions) solo sustituye la navegación de documento completo por un fundido de ~220 ms entre página y página, dentro de la misma banda interactiva (150–250 ms) descrita arriba. El logotipo del encabezado (`SiteHeader.astro`) usa `transition:persist` para no parpadear durante ese fundido; el resto del encabezado (navegación, CTA "Solicitar consulta") se re-renderiza en cada navegación para que el estado activo del enlace y el seguimiento de clics de Umami sigan siendo correctos por página.

Los módulos `scroll-reveal.ts`, `header-scroll.ts`, `faq-animate.ts` y `click-tracking.ts` exponen cada uno una función `init*(root?)` que devuelve un `disconnect()`. `BaseLayout.astro` es el único punto que los invoca: escucha `astro:page-load` (que Astro dispara tanto en la carga inicial como en cada navegación posterior) y, en cada disparo, desconecta las instancias anteriores antes de reinicializar las cuatro. Ninguno de los módulos se auto-inicializa ya al importarse — un segundo punto de inicialización independiente duplicaría los listeners en la primerísima carga, lo que en `click-tracking.ts` dispararía `trackEvent()` dos veces por clic.

## 14. Objetivos de calidad

- Lighthouse orientativo: 95+ en rendimiento, accesibilidad, buenas prácticas y SEO en páginas principales.
- Core Web Vitals en rango “bueno”.
- JavaScript inicial mínimo; React solo en islas justificadas.
- Imágenes responsivas y optimizadas.
- Cero errores de consola en producción.
- Cero enlaces rotos.
- Formulario probado de extremo a extremo.
- Marcado estructurado validado.
- Pruebas en móvil y escritorio antes de publicar.

## 15. Decisiones pendientes de la clienta

- Confirmar si la consulta inicial es gratuita.
- Confirmar correo receptor del formulario.
- Confirmar uso de `veronica.alba@alba-abogacia.es` y/o `info@alba-abogacia.es`.
- Confirmar si el fax continúa activo.
- Confirmar dirección y datos completos de la oficina de Madrid.
- Confirmar WhatsApp y número asociado.
- Confirmar número de colegiada y datos profesionales publicables.
- Facilitar fotografías actuales del equipo y las oficinas.
- Aprobar los colores definitivos extraídos del vector.
