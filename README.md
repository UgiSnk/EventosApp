# 🌟 Ecosistema Web Interactivo para Eventos (PWA)

Este proyecto implementa una Plataforma Web Progresiva (PWA) para maximizar la interacción social en eventos (bodas, fiestas corporativas) mediante dinámicas en tiempo real (WebSockets) y acceso rápido por código QR sin descargas ni registros.

---

## 📖 Manual de Uso e Instrucciones
*   **Manual de Uso (PDF):** Descarga el [Manual_Uso_EventosApp.pdf](file:///C:/Users/Ugi%20Desk/.gemini/antigravity/scratch/ecosistema-eventos/Manual_Uso_EventosApp.pdf) para aprender a controlar los juegos desde la consola y cómo interactúan los invitados.
*   **Guía de Despliegue en la Nube:** Revisa las instrucciones en [docs/despliegue.md](file:///C:/Users/Ugi%20Desk/.gemini/antigravity/scratch/ecosistema-eventos/docs/despliegue.md) para subir la plataforma a Render y Vercel gratis.

---

## 🛠️ Stack Tecnológico
*   **Frontend:** HTML5, CSS Nativo (Premium) y Vanilla Javascript compilado con **Vite**.
*   **Backend:** Node.js + Express + WebSockets (**Socket.io**) para sincronización ultra-rápida.
*   **Persistencia:** En memoria del servidor (efímero diario) y reconexión mediante `localStorage`.

---

## 🚀 Cómo Ejecutar en Local

### 1. Iniciar el Servidor Backend
Dirígete a la carpeta `/server` y ejecuta:
```bash
npm install
npm start
```
*El servidor WebSocket correrá en `http://localhost:3000`.*

### 2. Iniciar el Frontend (Vite)
Dirígete a la carpeta `/client` y ejecuta:
```bash
npm install
npm run dev
```
*Vite levantará el servidor de desarrollo en `http://localhost:5173/`.*

### 3. Probar la Plataforma
*   **Administrador (DJ/Animador):** Abre en tu navegador [http://localhost:5173/admin.html](http://localhost:5173/admin.html).
*   **Invitados:** Abre en tu navegador [http://localhost:5173/](http://localhost:5173/) (puedes usar el modo incógnito para registrar múltiples invitados en tu PC) o ingresa desde tu móvil usando la URL de red local provista por Vite.

