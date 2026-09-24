# NeuroPlaneta

Aplicación web de actividades de atención, comunicación, rutinas y calma para usar en celular o tableta.

## Desarrollo local

```bash
npm ci
npm run dev
```

Verificaciones: `npm run lint` y `npm run build`.

## Estado de los datos

Los perfiles y avances se guardan en el almacenamiento local de este navegador. No se sincronizan entre dispositivos y pueden perderse si se borran los datos del navegador. Evitar ingresar información clínica o identificable de menores en una demostración pública. La pregunta matemática del panel adulto es una barrera de uso, no autenticación.

Las rutas `/api/sync/*` y `/api/migrate/*` están desactivadas (HTTP 410). La implementación anterior permitía leer o sobrescribir perfiles sin autenticación y reemplazar código del servidor. Para habilitar sincronización se necesita autenticación real, control de acceso por perfil y almacenamiento seguro antes de aceptar datos de niños.
