import { env } from './config/env.js';
import { createApp } from './app.js';

const app = createApp({ frontendUrl: env.FRONTEND_URL });

app.listen(env.PORT, () => {
  console.log(`Butaca API escuchando en http://localhost:${env.PORT}`);
});
