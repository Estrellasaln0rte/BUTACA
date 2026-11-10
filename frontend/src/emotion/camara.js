const MENSAJES_CAMARA = {
  NotAllowedError:
    'Bloqueaste el permiso de la cámara. Activalo en el candado de la barra de direcciones y probá otra vez.',
  NotFoundError: 'No encontramos ninguna cámara conectada.',
  NotReadableError: 'Otra aplicación está usando la cámara. Cerrala y probá otra vez.',
};

export async function encenderCamara(video) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no permite usar la cámara en esta página (necesita HTTPS).');
  }

  let transmision;
  try {
    transmision = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (error) {
    throw new Error(MENSAJES_CAMARA[error.name] ?? 'No se pudo encender la cámara.');
  }

  video.srcObject = transmision;
  await video.play();
  return transmision;
}

export function apagarCamara(transmision, video) {
  transmision?.getTracks().forEach((pista) => pista.stop());
  if (video) video.srcObject = null;
}
