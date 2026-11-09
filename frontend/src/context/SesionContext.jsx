import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase.js';

const SesionContext = createContext(null);

export function SesionProvider({ children }) {
  const [sesion, setSesion] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargandoSesion(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_evento, sesionNueva) => {
      setSesion(sesionNueva);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  function iniciarSesion(proveedor) {
    return supabase.auth.signInWithOAuth({
      provider: proveedor,
      options: { redirectTo: window.location.origin },
    });
  }

  function cerrarSesion() {
    return supabase.auth.signOut();
  }

  const valor = {
    sesion,
    usuario: sesion?.user ?? null,
    cargandoSesion,
    iniciarSesion,
    cerrarSesion,
  };

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSesion() {
  return useContext(SesionContext);
}
