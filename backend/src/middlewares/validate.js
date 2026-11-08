// Valida body, query y params con Zod antes de llegar al controlador.
// Uso: router.post('/', validate({ body: createFavoriteBody }), controlador)
export function validate({ body, query, params } = {}) {
  return (req, _res, next) => {
    try {
      if (params) req.params = params.parse(req.params);
      if (query) req.validatedQuery = query.parse(req.query);
      if (body) req.body = body.parse(req.body);
      next();
    } catch (err) {
      next(err); // lo traduce errorHandler a un 400
    }
  };
}