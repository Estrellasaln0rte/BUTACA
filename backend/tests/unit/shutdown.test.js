import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerShutdown } from '../../src/lib/shutdown.js';

// Dobles: un "process" que recibe señales falsas y un servidor cuyo close se controla.
function setup({ closeError, cleanup = vi.fn(async () => {}), closeImmediately = true, timeoutMs } = {}) {
  const processRef = Object.assign(new EventEmitter(), { exit: vi.fn() });
  const log = { log: vi.fn(), error: vi.fn() };
  let finishClose;
  const server = {
    close: vi.fn((callback) => {
      finishClose = () => callback(closeError);
      if (closeImmediately) finishClose();
    }),
  };
  const shutdown = registerShutdown({ server, cleanup, processRef, log, timeoutMs });
  // Espera a que terminen las promesas pendientes (cleanup es async).
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  return { processRef, log, server, cleanup, shutdown, flush, finishClose: () => finishClose() };
}

afterEach(() => vi.useRealTimers());

describe('cierre ordenado del servidor', () => {
  it.each(['SIGTERM', 'SIGINT'])('con %s cierra el servidor, libera recursos y sale con 0', async (signal) => {
    const { processRef, server, cleanup, flush } = setup();
    processRef.emit(signal);
    await flush();

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(processRef.exit).toHaveBeenCalledWith(0);
  });

  it('libera recursos solo después de que el servidor terminó las solicitudes en curso', async () => {
    const { processRef, cleanup, flush, finishClose } = setup({ closeImmediately: false });
    processRef.emit('SIGTERM');
    await flush();
    expect(cleanup).not.toHaveBeenCalled();
    expect(processRef.exit).not.toHaveBeenCalled();

    finishClose();
    await flush();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(processRef.exit).toHaveBeenCalledWith(0);
  });

  it('una segunda señal no repite el cierre', async () => {
    const { processRef, server, shutdown, flush } = setup({ closeImmediately: false });
    processRef.emit('SIGTERM');
    shutdown('SIGTERM');
    processRef.emit('SIGINT');
    await flush();
    expect(server.close).toHaveBeenCalledTimes(1);
  });

  it('si falla liberar recursos, lo registra y sale con 1', async () => {
    const { processRef, log, flush } = setup({
      cleanup: vi.fn(async () => {
        throw new Error('Prisma no respondió');
      }),
    });
    processRef.emit('SIGTERM');
    await flush();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('[cierre]'), 'Prisma no respondió');
    expect(processRef.exit).toHaveBeenCalledWith(1);
  });

  it('si el servidor no cierra bien, igual libera recursos y sale con 1', async () => {
    const { processRef, cleanup, flush } = setup({ closeError: new Error('ERR_SERVER_NOT_RUNNING') });
    processRef.emit('SIGTERM');
    await flush();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(processRef.exit).toHaveBeenCalledWith(1);
  });

  it('si el cierre se cuelga, fuerza la salida al vencer el tiempo', () => {
    vi.useFakeTimers();
    const { processRef, log } = setup({ closeImmediately: false, timeoutMs: 5000 });
    processRef.emit('SIGTERM');

    vi.advanceTimersByTime(4999);
    expect(processRef.exit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('5000 ms'));
    expect(processRef.exit).toHaveBeenCalledWith(1);
  });
});
