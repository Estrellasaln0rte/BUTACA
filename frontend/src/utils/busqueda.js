// Quita tildes y mayúsculas para que "accion" encuentre "Acción".
export function normalizar(texto) {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function coincide(titulo, busqueda) {
  const b = normalizar(busqueda);
  return !b || normalizar(titulo).includes(b);
}
