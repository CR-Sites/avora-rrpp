# AVORA — PR & Event Link Intelligence

Plataforma web mobile-first diseñada para Jefes de Públicas y productoras de eventos de música electrónica.

## Módulos Principales

1. **Puerta de Acceso al Grupo Exclusivo (`/` y `/unirse`)**
   - Formulario rápido de 1 pantalla para admisión al grupo oficial de WhatsApp.
   - Captura de datos reales: Nombre completo, Teléfono de WhatsApp (normalizado internacionalmente), Mail registrado en **Bombo** y **Checkboxes de Intereses dinámicos** configurables desde el panel.
   - Captura silenciosa de sesión (IP, País, Región/Provincia, Ciudad, ISP, Sistema Operativo, Navegador, Origen In-App como Instagram/WhatsApp, Resolución, Idioma, Zona Horaria y UTMs).
   - Emisión de cookie propia (`avora_vid`) de 400 días para identificar automáticamente al miembro en futuros clics a links de compra.

2. **Redireccionador Inteligente de Compra y Eventos (`/go/[slug]`)**
   - Rebote ultrarrápido hacia links oficiales de Bombo, boleterías o mesas VIP.
   - Metadatos **OpenGraph** personalizables por link para tarjetas limpias al compartir en WhatsApp.
   - Filtro automático de bots de previsualización (`WhatsApp Preview`, `Meta Crawler`, `TelegramBot`) para mantener métricas humanas 100% puras.
   - Cruce automático de identidad por cookie + enriquecimiento vía `navigator.sendBeacon`.

3. **Panel Administrador Unificado (`/admin`)**
   - Alternancia inmediata entre **Grupo & Base**, **Links de Compra** (Vista General consolidada + Vista Individual por cada link con curva horaria de 24h) y **Configuración** (link actual del grupo de WhatsApp, ABM de checkboxes de intereses y gestión de usuarios operadores).
   - Acciones en 1 clic hacia WhatsApp (`wa.me`) y exportación CSV compatible con Excel (UTF-8 BOM), incluyendo exportación dedicada de **Mails de Bombo**.

## Desarrollo Local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000/unirse` (formulario público) o `http://localhost:3000/admin` (panel de control).
