import { PrismaClient } from '@prisma/client';

let client;

// Se construye al usarlo, no al importar: las pruebas inyectan su propio cliente.
export function getPrismaClient() {
  client ??= new PrismaClient({ log: [] });
  return client;
}

// Para el cierre del servidor; no desconectar después de cada solicitud.
export async function disconnectPrisma() {
  const current = client;
  client = undefined;
  if (current) await current.$disconnect();
}
