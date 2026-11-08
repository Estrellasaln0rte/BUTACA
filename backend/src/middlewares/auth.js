// Protege rutas: exige "Authorization: Bearer <token de Supabase>".
// El token lo verifica `verifyToken` (inyectado), que devuelve { id, email } o null.
// Inyectarlo permite probar sin Supabase real.
export function createRequireAuth(verifyToken) {
  return async function requireAuth(req, res, next) {
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return res.status(401).json({ error: 'Falta el token de sesión' });
    }

    try {
      const user = await verifyToken(token);
      if (!user?.id) {
        return res.status(401).json({ error: 'Sesión inválida o vencida' });
      }
      req.user = user; // las rutas SIEMPRE filtran por req.user.id
      next();
    } catch (err) {
      next(err);
    }
  };
}