// Cierre ordenado del servidor.
// Render manda SIGTERM al redesplegar o detener el servicio; Ctrl+C en local manda SIGINT.
// Al recibirlos: se dejan de aceptar conexiones, se terminan las solicitudes en curso,
// se ejecuta `cleanup` (cerrar Prisma) y recién entonces termina el proceso.
// Si algo se cuelga, a los `timeoutMs` se sale igual para no bloquear el redespliegue.
//
// `processRef` y `log` se inyectan para poder probarlo sin enviar señales reales.
export function registerShutdown({
  server,
  cleanup = async () => {},
  processRef = process,
  log = console,
  timeoutMs = 10_000,
} = {}) {
  let closing = false;

  function shutdown(signal) {
    if (closing) return; // una segunda señal no repite el cierre
    closing = true;
    log.log(`${signal} recibido: cerrando Butaca API...`);

    const forceExit = setTimeout(() => {
      log.error(`[cierre] no terminó en ${timeoutMs} ms, se fuerza la salida`);
      processRef.exit(1);
    }, timeoutMs);
    forceExit.unref?.();

    server.close(async (closeError) => {
      let failed = Boolean(closeError);
      if (closeError) log.error('[cierre] error al cerrar el servidor HTTP:', closeError.message);

      try {
        await cleanup();
      } catch (err) {
        failed = true;
        log.error('[cierre] error al liberar recursos:', err?.message ?? err);
      }

      clearTimeout(forceExit);
      processRef.exit(failed ? 1 : 0);
    });
  }

  for (const signal of ['SIGTERM', 'SIGINT']) {
    processRef.once(signal, () => shutdown(signal));
  }

  return shutdown;
}
