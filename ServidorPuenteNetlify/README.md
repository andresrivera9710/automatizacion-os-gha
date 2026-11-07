# Servidor Puente SIO en Netlify (`ServidorPuenteNetlify`)

Este proyecto aloja de forma independiente el **Servidor Puente Serverless en Netlify** conectado a **Azure SQL (`SIO`)**, permitiendo que cualquiera de tus proyectos locales se conecte directamente al endpoint publicado en Netlify sin necesidad de abrir un servidor Node.js local en tu PC.

## Estructura
- `public/index.html`: Panel de estado en vivo (muestra `● Conectado` / `○ Desconectado`, la IP saliente de Netlify hacia Azure SQL y el código para conectar proyectos locales).
- `public/_redirects`: Redirige `/api/sql` hacia `/.netlify/functions/sql`.
- `netlify/functions/sql.js`: Función Serverless con CORS habilitado (`Access-Control-Allow-Origin: *`) para recibir peticiones desde proyectos locales (`http://localhost`, `http://127.0.0.1` o archivos HTML locales).
- `netlify.toml`: Configuración de despliegue y cabeceras CORS para consumo local.

