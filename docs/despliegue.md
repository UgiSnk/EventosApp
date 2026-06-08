# 🌐 Guía de Despliegue en Producción

Esta guía detalla los pasos para desplegar el **Ecosistema Web Interactivo para Eventos** de forma gratuita en la nube, utilizando **Render.com** para el servidor Socket.io (backend) y **Vercel** o **Netlify** para la interfaz web Vite (frontend).

---

## 🏗️ Paso 1: Preparación del Repositorio
Asegúrate de que todos los cambios locales estén sincronizados con tu repositorio en GitHub:
`https://github.com/UgiSnk/EventosApp`

El repositorio contiene dos carpetas clave:
- `/server`: El backend en Node.js.
- `/client`: El frontend en Vite + Vanilla JS.

---

## 🖥️ Paso 2: Despliegue del Backend (Servidor) en Render.com
Render ofrece alojamiento gratuito para servicios en Node.js.

1. **Crear una cuenta**: Regístrate en [Render.com](https://render.com) e inicia sesión.
2. **Crear un nuevo servicio web**:
   - Haz clic en **New +** y selecciona **Web Service**.
   - Conecta tu cuenta de GitHub y selecciona el repositorio `EventosApp`.
3. **Configurar el servicio**:
   - **Name**: `eventos-app-backend` (o el nombre que prefieras).
   - **Root Directory**: `server` *(¡Muy importante! Apunta a la carpeta del servidor)*.
   - **Environment**: `Node`.
   - **Build Command**: `npm install`.
   - **Start Command**: `npm start` (o `node index.js`).
   - **Instance Type**: `Free`.
4. **Variables de Entorno** (opcional):
   - En la pestaña **Environment**, puedes configurar variables como `PORT` (por defecto Render asigna uno dinámico).
5. **Desplegar**:
   - Render compilará e iniciará tu servidor. Al finalizar, te proveerá una URL pública (ej. `https://eventos-app-backend.onrender.com`).
   - *Nota: Los servicios gratuitos de Render entran en suspensión tras 15 minutos de inactividad. La primera conexión en un evento puede tardar 50 segundos en despertar.*

---

## 📱 Paso 3: Despliegue del Frontend (Cliente) en Vercel
Vercel es ideal para compilar y servir la aplicación Vite.

1. **Crear una cuenta**: Regístrate en [Vercel](https://vercel.com).
2. **Crear un nuevo proyecto**:
   - Haz clic en **Add New** -> **Project**.
   - Importa el repositorio `EventosApp` desde tu GitHub.
3. **Configurar la Compilación**:
   - **Framework Preset**: `Vite`.
   - **Root Directory**: `client` *(¡Muy importante! Apunta a la carpeta del cliente)*.
   - **Build and Output Settings**: Deja los valores por defecto (`npm run build` y `dist`).
4. **Configurar Variables de Entorno**:
   - Despliega la pestaña **Environment Variables**.
   - Agrega la siguiente variable:
     - **Key**: `VITE_SERVER_URL`
     - **Value**: `https://tu-backend-de-render.onrender.com` *(La URL provista por Render en el paso anterior)*.
5. **Desplegar**:
   - Haz clic en **Deploy**. Vercel compilará la aplicación y generará tu URL pública de producción (ej. `https://eventos-app.vercel.app`).

---

## 🎫 Paso 4: Pruebas y Generador de Código QR
Una vez completados los despliegues:

1. **Onboarding QR**:
   - Toma la URL del frontend provista por Vercel (ej. `https://eventos-app.vercel.app`).
   - Utiliza cualquier generador de códigos QR online (ej. QR Code Generator o directamente en Canva) para codificar esta URL.
   - Imprime el código QR y colócalo en las mesas del salón o proyecta el QR en el ingreso de los invitados.
2. **Consola del Animador (DJ)**:
   - El DJ o animador del evento debe ingresar a `https://eventos-app.vercel.app/admin.html` desde una notebook o tablet conectada a la pantalla gigante del salón.
   - Desde esta pantalla podrá controlar los cambios de juego en tiempo real (Trivia, Impostor y Misiones) y proyectar el podio 3D o el carrete de fotos.
