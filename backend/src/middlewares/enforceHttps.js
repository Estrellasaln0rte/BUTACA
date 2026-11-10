// En producción exige HTTPS. Requiere app.set('trust proxy', 1) para que req.secure sea confiable.
// No redirige usando el header Host: lo controla el cliente y permitiría redirecciones a sitios ajenos.
// La plataforma de despliegue (Render, Railway...) normalmente ya redirige HTTP → HTTPS por su cuenta.
export function enforceHttps(req, res, next) {
  if (req.secure) return next();
  res.status(426).json({ error: 'Se requiere HTTPS' });
}