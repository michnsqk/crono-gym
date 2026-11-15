# Propuesta Técnica y Cotización Comercial B2B — Folio `COT-CG-001`

---

## 1. Encabezado y Resumen Ejecutivo

| Campo | Detalle |
| :--- | :--- |
| **Folio** | `COT-CG-001` |
| **Proveedor** | Aldo Michel Ortiz Rodríguez – Cronos Gym |
| **Proyecto** | Plataforma Digital de Entrenamiento, Biomecánica, IA y Gestión de Coaches (**Cronos Gym**) |
| **Vigencia de la Cotización** | 15 días naturales a partir de su emisión |
| **Moneda** | Pesos Mexicanos (**MXN Netos** de implementación; costos variables de nube se pagan directo a proveedores) |

### Diagnóstico Ejecutivo (Basado en la Arquitectura Real del Sistema)
**Cronos Gym** no es una aplicación genérica de notas o PDFs; es una **plataforma web progresiva (PWA) Offline-First** construida sobre **React 18, TypeScript, Vite y Supabase (PostgreSQL + Auth + RLS + Edge Functions)**, diseñada bajo estándares visuales de alta legibilidad (*Apple Dark OLED*).

Su valor diferencial para un gimnasio radica en convertir el piso de entrenamiento en un ecosistema conectado de retención y monetización:
- **Para el Socio (Atleta):** Registro de entrenamientos en tiempo real sin depender de Wi-Fi, **Motor de Sobrecarga Progresiva (3 motores)**, **Atlas Biomecánico** de manerales y plataformas, **Rangos Anatómicos 2.0**, control mensual de peso y **Cronos Intelligence** (asistente IA conversacional para crear rutinas).
- **Para el Coach:** **Portal CRM (`/coach`)** con Ficha 360° del atleta, creación/asignación de rutinas multi-día (`saveCoachRoutine` / `assign_coach_routine`), plantillas globales (`saveCoachTemplate`), gestión de solicitudes y edición en vivo del **catálogo de 77 máquinas reales (`CG-EQP-0001` a `CG-EQP-0077`)**.
- **Para el Dueño / Admin:** **Panel Administrativo (`/admin`)** con control de roles, auditoría (`role_audit_log`) y flujo de activación VIP / pagos en efectivo.

---

## 2. Desglose Económico — 3 Esquemas de Inversión (MXN Netos)

| Concepto | Opción 1: Esencial / Arranque | Opción 2: Profesional / Coach & IA *(Recomendado)* | Opción 3: Enterprise / Full Custom |
| :--- | :---: | :---: | :---: |
| **Inversión Única de Implementación** | **$28,500 MXN** | **$48,000 MXN** | **$78,000 MXN** |
| **Esquema de Pago por Hitos** | 50% arranque / 30% beta / 20% salida a producción | 50% arranque / 30% beta / 20% salida a producción | 40% arranque / 30% beta / 20% QA / 10% go-live |
| **Tiempo Estimado de Entrega** | 2 a 3 semanas | 3 a 5 semanas | 6 a 8 semanas |
| **Póliza Mensual de Soporte *(Opcional)*** | $2,500 MXN / mes | $4,200 MXN / mes | $7,500 MXN / mes |
| **Infraestructura Cloud Estimada *(Pago directo)*** | $0 – $550 MXN / mes (Supabase + Vercel) | $550 – $1,200 MXN / mes (Supabase Pro + Vercel + API IA) | $1,500 – $3,500 MXN / mes (Recursos dedicados + API IA) |

> **Nota sobre transparencia en costos de nube:** Las cuentas de Supabase, Vercel y proveedor de IA se configuran a nombre del cliente (o bajo cuenta administrada transparente) para evitar márgenes ocultos y garantizar que el gimnasio sea dueño de su base de datos desde el día 1.

---

## 3. Alcance Técnico Detallado (`Sí Incluye` / `No Incluye`)

| Módulo / Capacidad Real del Repositorio | Opción 1: Esencial | Opción 2: Profesional *(Recomendado)* | Opción 3: Enterprise |
| :--- | :---: | :---: | :---: |
| **App PWA Instalable + Offline-First** (recuperación de sesión activa y sync automático) | **Sí incluye** | **Sí incluye** | **Sí incluye** |
| **Onboarding + Perfil + Control Mensual de Peso** | **Sí incluye** | **Sí incluye** | **Sí incluye** |
| **Planificador Semanal (L-D) + Cronos Smart Day 0** (2 a 6 días con selector anatómico) | **Sí incluye** | **Sí incluye** | **Sí incluye** |
| **ActiveWorkout** (mini-player flotante, timer de descanso, audio/haptics) | **Sí incluye** | **Sí incluye** | **Sí incluye** |
| **Catálogo Base de +95 Ejercicios con GIFs Animados** | **Sí incluye** | **Sí incluye** | **Sí incluye** |
| **Motor de Sobrecarga Progresiva** (`SmartOverloadModal`: Sobrecarga, Aproximación, Calentamiento, 1RM y PRs) | No incluye | **Sí incluye** | **Sí incluye** |
| **Catálogo de 77 Máquinas Reales (`CG-EQP-0001..0077`)** editable desde `/coach` | No incluye | **Sí incluye** | **Sí incluye** |
| **Atlas Biomecánico de Manerales y Plataforma de Pies** (con detalle flotante y zoom) | No incluye | **Sí incluye** | **Sí incluye** |
| **Cronos Intelligence (IA)** (`CoachChat` + constructor conversacional + tarjetas con GIF y sparkline) | No incluye | **Sí incluye** | **Sí incluye** |
| **Rangos Anatómicos 2.0 + Tarjetas Compartibles** (`react-muscle-highlighter`) | Básico (solo gráficas) | **Sí incluye** | **Sí incluye** |
| **Portal de Coaches CRM (`/coach`)** (Ficha 360°, plantillas, asignación VIP y solicitudes) | No incluye | **Sí incluye** | **Sí incluye** |
| **Panel Administrativo (`/admin`)** (roles, `role_audit_log` y activación VIP/efectivo) | Básico (usuarios) | **Sí incluye** | **Sí incluye** |
| **White-Label Total** (dominio propio, branding 100% personalizado, correos transaccionales) | No incluye | Parcial (logo/colores) | **Sí incluye** |
| **Integración con Pasarela de Pagos (Stripe/MercadoPago) o Torniquetes** | No incluye | No incluye | **Sí incluye** (1 integración) |
| **Publicación Nativa App Store / Google Play** | No incluye | No incluye | Opcional (bajo cotización) |

---

## 4. Garantías, Anulación de Garantía y Términos Comerciales

1. **Garantía Técnica Post-Entrega:**
   - **Opción 1 y 2:** **30 días naturales** a partir de la liberación en producción.
   - **Opción 3:** **60 días naturales** a partir de la liberación en producción.
   - Cubre la corrección sin costo de cualquier defecto funcional (*bug*) comprobable dentro del alcance contratado.
2. **Causales de Anulación de Garantía:**
   - Intervención, modificación o despliegue sobre el código fuente, base de datos PostgreSQL, políticas RLS o Edge Functions por personal ajeno al proveedor sin autorización previa por escrito.
   - Cambios unilaterales en precios, políticas o APIs de proveedores externos (Supabase, OpenAI, navegadores o tiendas de aplicaciones).
   - Incumplimiento o retraso en el pago de los hitos acordados.
3. **Propiedad de Datos y Licenciamiento:**
   - **Datos 100% del Cliente:** Toda la información de socios, historial de entrenamientos, rutinas y métricas pertenece exclusivamente al gimnasio y es exportable en cualquier momento.
   - **Licencia de Uso:** El cliente recibe licencia comercial de uso para su operación (1 sucursal en Opciones 1 y 2; hasta 3 sucursales en Opción 3).

---

## 5. FAQ — Respuestas a las 10 Objeciones Frecuentes del Dueño de Gimnasio

1. **¿Por qué no seguir usando rutinas en PDF, Excel o WhatsApp?**  
   Los PDFs no calculan sobrecarga progresiva, no registran récords personales ni generan hábito. Cronos transforma cada sesión en progreso visible (rangos anatómicos, gráficas y PRs), atacando directamente la deserción de los primeros 90 días.
2. **¿Qué pasa si mis socios no son tecnológicos?**  
   La interfaz sigue principios minimalistas (*Apple HIG*): iniciar una rutina toma 2 toques, cada ejercicio muestra un GIF animado real y el modo *Day 0* guía paso a paso a principiantes.
3. **¿Qué pasa si se va el internet o falla el Wi-Fi en el área de pesas?**  
   La app es **PWA Offline-First**: guarda series, pesos y descansos en el teléfono y los sincroniza automáticamente con Supabase en cuanto vuelve la señal.
4. **¿Cuánto cuesta mantenerla operando cada mes?**  
   En arranque puede operar con costos mínimos de nube ($0 a $550 MXN/mes en Opción 1; ~$550 a $1,200 MXN/mes en Opción 2 según uso de IA), sin comisiones ocultas por socio activo.
5. **¿La IA va a reemplazar a mis entrenadores?**  
   Al contrario: la IA cubre la atención base para que ningún socio quede abandonado, mientras que el **Portal de Coaches** permite a tu equipo ofrecer seguimiento VIP de alto ticket con Ficha 360° y rutinas personalizadas.
6. **¿Qué pasa con mis datos si algún día dejo de trabajar con ustedes?**  
   Cero secuestro de información (*Zero Lock-in*). Tu base de datos vive en Supabase a nombre de tu negocio y puedes exportar todo tu historial cuando lo decidas.
7. **¿Se adapta a las máquinas reales que tengo en mi gimnasio?**  
   Sí. Desde la Opción 2 se incluye el catálogo de **77 máquinas (`CG-EQP-0001..0077`)**, donde tus coaches pueden renombrar equipos o ocultar los que no existan en tu piso sin tocar código.
8. **¿Cómo cobro los planes VIP si mis clientes pagan en efectivo en recepción?**  
   El sistema ya contempla activación manual VIP / efectivo desde `/admin` y `/coach`, evitando comisiones de pasarela bancaria si prefieres cobrar en caja.
9. **¿Mis socios tienen que descargar una app pesada de App Store o Play Store?**  
   No. Se instala como PWA directo desde Safari o Chrome en 5 segundos con ícono propio en la pantalla de inicio, sin fricción de descargas ni rechazos de tienda.
10. **¿Qué seguridad tengo de que el proyecto se entregue funcionando y no quede a medias?**  
    Se trabaja con entregas por hitos verificables, suite de pruebas automatizadas (`Vitest` + verificación estricta `TypeScript`), documentación técnica y garantía escrita post-entrega.

---

## 6. Checklist de Datos Faltantes del Cliente para Arrancar

Para iniciar la implementación inmediatamente tras aprobar la propuesta, el cliente deberá confirmar:
- [ ] **Datos Fiscales y Comerciales:** Nombre comercial del gimnasio, razón social, RFC y correo para facturación/contrato.
- [ ] **Identidad Visual:** Logotipo en formato vectorial (`.svg`) o `.png` en alta resolución, y colores institucionales.
- [ ] **Dominio y Cuentas Cloud:** Dominio web deseado (ej. `app.tugimnasio.com`) y confirmación de creación de cuentas Supabase / Vercel / API IA.
- [ ] **Inventario de Staff y Piso:** Lista de correos de Administradores y Coaches, más validación del inventario de máquinas disponibles en el gimnasio.
- [ ] **Reglas de Negocio VIP:** Tarifas o duración de planes VIP/coaching y textos legales (aviso de privacidad / reglamento interno) si se mostrarán en el onboarding.
