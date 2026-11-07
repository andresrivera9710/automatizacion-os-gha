# Servidor Backend: Automatización de Órdenes de Servicio GHA (SIO - LAATS)

Arquitectura empresarial moderna con **Node.js** y **Express JS** diseñada para desplegar el sistema de Automatización de Órdenes de Servicio (GHA - Avianca) en un servidor local o en la nube, reemplazando el puente local de PowerShell (`bridge_server.ps1`) y ofreciendo alta concurrencia, estabilidad y soporte multiusuario.

---

## 🏛️ Estructura y Arquitectura del Proyecto

El proyecto está organizado siguiendo el patrón arquitectónico por capas (**Controller-Service-Config**):

```text
Automatizacion OS/
├── .env                              # Variables de entorno activas (Credenciales Azure SQL, SMTP, Puertos)
├── .env.example                      # Plantilla de variables de entorno
├── package.json                      # Dependencias y scripts de npm
├── server.js                         # Punto de entrada principal (Inicio HTTP, pre-flight check de BD)
├── Iniciar_Servidor_Node.bat         # Script para inicio en un clic en entornos Windows Server
├── README.md                         # Documentación técnica de despliegue y uso
│
├── src/
│   ├── app.js                        # Configuración de Express, middlewares (CORS, parsers) y estáticos
│   │
│   ├── config/
│   │   ├── db.js                     # Conexión y Pool a Azure SQL Database (mssql / tedious)
│   │   └── mail.js                   # Configuración de correo (SMTP con Nodemailer / Outlook fallback)
│   │
│   ├── controllers/
│   │   ├── authController.js         # Autenticación de PIN contra dbo.Login y validación GHA
│   │   ├── osController.js           # Orquestación de inserción masiva de Órdenes de Servicio
│   │   ├── fileController.js         # Almacenamiento de archivos HTML oficiales en carpeta Información
│   │   └── emailController.js        # Envío de notificaciones ejecutivas por correo
│   │
│   ├── services/
│   │   ├── sqlService.js             # Lógica de Stored Procedures (unificado dbo.InsertarOrdenServicioMasivaGHA + fallback)
│   │   ├── fileService.js            # Manejo del sistema de archivos y carpeta ../Informacion
│   │   └── emailService.js           # Generación de plantilla HTML ejecutiva y despacho de correo
│   │
│   ├── routes/
│   │   ├── index.js                  # Enrutador principal y endpoint /health
│   │   └── sqlRoutes.js              # Endpoint compatible /api/sql + rutas REST estructuradas
│   │
│   └── utils/
│       └── logger.js                 # Sistema de registro en consola con marcas de tiempo y colores
│
├── public/
│   └── index.html                    # Frontend web oficial (adaptado para servidor y modo dinámico)
└── index.html                        # Frontend web en la raíz para compatibilidad directa
```

---

## ⚙️ Requisitos Previos

- **Node.js:** Versión 18.x, 20.x, 22.x o superior.
- **npm:** Versión 9.x o superior.
- **Acceso de Red:** Conexión saliente al puerto `1433` de Azure SQL (`mysqullaats23.database.windows.net`).

---

## 🚀 Instalación y Puesta en Marcha

### 1. Clonar o copiar la carpeta en el servidor
Ubique la carpeta `Automatizacion OS` en la ruta deseada del servidor (por ejemplo `C:\inetpub\wwwroot\AutomatizacionOS` o `/var/www/automatizacion-os`).

### 2. Instalar dependencias
Abra una terminal en la carpeta del proyecto y ejecute:
```bash
npm install --omit=dev
```

### 3. Configurar variables de entorno (`.env`)
Copie o edite el archivo `.env` según el entorno de su servidor:

```ini
# Puerto y Host
PORT=3080
HOST=0.0.0.0
NODE_ENV=production

# Base de Datos Azure SQL (SIO)
DB_SERVER=mysqullaats23.database.windows.net
DB_PORT=1433
DB_NAME=SIO
DB_USER=LaatsBdAD
DB_PASSWORD=AndresRivera!9710
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false

# Carpeta de almacenamiento de órdenes HTML
INFORMACION_DIR=../Informacion

# Control de apagado (false en producción para que el servidor nunca se detenga)
ALLOW_SHUTDOWN=false

# Configuración de Correo Electrónico (SMTP)
MAIL_METHOD=smtp
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=programadorit@laats.net
SMTP_PASS=tu_password_aqui
SMTP_FROM="Sistema SIO GHA" <programadorit@laats.net>
MAIL_DEFAULT_RECIPIENTS=programadorit@laats.net; monicaaracely@laats.net; facturacion@laats.net
```

### 4. Iniciar el servidor
- **En Windows Server:** Haga doble clic en `Iniciar_Servidor_Node.bat`.
- **Por consola:**
  ```bash
  npm start
  ```
- **En modo desarrollo (con recarga automática):**
  ```bash
  npm run dev
  ```

El servidor estará escuchando en `http://localhost:3080` o en la IP del servidor `http://[IP-DEL-SERVIDOR]:3080`.

---

## 🔄 Despliegue en Producción como Servicio Continuo

### Opción A: Usando PM2 (Recomendado)
PM2 mantiene la aplicación en ejecución constante, reiniciándola automáticamente en caso de caídas o reinicios del servidor.

```bash
# 1. Instalar PM2 globalmente
npm install -g pm2

# 2. Iniciar la aplicación
pm2 start server.js --name "sio-os-gha"

# 3. Guardar estado para inicio automático con el sistema
pm2 save
pm2 startup
```

### Opción B: Servicio de Windows con NSSM
Si está desplegando en Windows Server y desea que corra como un servicio nativo de Windows:
1. Descargue [NSSM (Non-Sucking Service Manager)](https://nssm.cc/).
2. Ejecute: `nssm install SioAutomatizacionOS`
3. Configure:
   - **Path:** `C:\Program Files\nodejs\node.exe`
   - **Startup directory:** `C:\ruta\al\proyecto\Automatizacion OS`
   - **Arguments:** `server.js`
4. Inicie el servicio: `nssm start SioAutomatizacionOS`

---

## 📡 Endpoints de la API

### 1. Compatibilidad Total con Frontend (`POST /api/sql`)
El endpoint `/api/sql` procesa exactamente las mismas peticiones que el puente PowerShell original:

| Acción (`action`) | Descripción | Parámetros Principales |
|---|---|---|
| `login` | Valida PIN en `dbo.Login` y verifica pertenencia a departamento GHA (ID 16). | `{ pin: "..." }` |
| `test_connection` | Prueba conexión y devuelve versión y base de datos Azure SQL. | `{}` |
| `insert_os_masiva` | Registra encabezado y detalles de la Orden de Servicio (SP unificado + fallback). | `{ loginId, nombreModificado, fechaOS, operadorId, filas }` |
| `guardar_html_os` | Guarda el archivo `GHA-[correlativo]-AVIANCA-NA.html` en la carpeta `Información`. | `{ correlativo, contenidoHtml }` |
| `enviar_correo_os` | Envía el correo con resumen y el archivo HTML adjunto. | `{ correlativo, fechaOS, tecnico, totalGuias, totalMonto, destinatarios }` |
| `shutdown` | Notificación de cierre de sesión (no apaga el servidor si `ALLOW_SHUTDOWN=false`). | `{}` |

### 2. Endpoints REST Modernos
- `POST /api/auth/login`
- `GET /api/auth/test-connection`
- `POST /api/os/masiva`
- `POST /api/os/guardar-html`
- `POST /api/os/enviar-correo`
- `GET /health` (Estado del servidor, métricas de memoria, uptime y estado de BD)

---

## 🛡️ Mejoras respecto al Script PowerShell

1. **Despliegue Multiplataforma:** Puede ejecutarse en Windows Server, Linux (Ubuntu, Debian, RedHat), Docker o la nube (Azure App Service, AWS EC2).
2. **Concurrencia:** Express maneja múltiples usuarios simultáneamente sin bloquear el puerto ni saturar el CPU.
3. **Persistencia y Resiliencia:** El servidor no se cierra cuando un usuario cierra su navegador (a diferencia del beacon de apagado de PowerShell).
4. **Pool de Conexiones SQL:** Reutiliza conexiones activas con `mssql` reduciendo la latencia de cada solicitud hacia Azure SQL.
5. **Envío de Correo Universal:** Integra **SMTP** estándar de producción para Office 365 / Exchange, manteniendo soporte fallback para Outlook local en Windows si se requiere.
6. **Frontend Adaptable:** `index.html` detecta automáticamente si se está accediendo vía HTTP (servidor) o como archivo local, adaptando las URLs del backend dinámicamente.

