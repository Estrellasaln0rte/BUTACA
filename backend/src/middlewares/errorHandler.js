import { ZodError, z } from 'zod';

export function notFound(_req, res) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

// Último middleware. Nunca devuelve stack traces ni detalles internos al cliente.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: z.flattenError(err).fieldErrors,
    });
  }
    if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'Ese registro ya existe' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON malformado' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Solicitud demasiado grande' });
  }

  console.error(err); // queda en el log del servidor, no en la respuesta
  res.status(500).json({ error: 'Error interno del servidor' });
}