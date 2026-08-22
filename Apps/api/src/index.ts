import { getEnv } from '@better-you/config';
import { createServer, createDefaultDependencies } from './server';

// Render (and similar hosts) inject their own PORT and require the server to
// bind to it - it must win whenever present. API_PORT stays the local-dev
// override (see .env.example); '4000' is the final fallback for neither
// being set. See ADR 0018/docs/environments.md.
const port = Number(getEnv('PORT', getEnv('API_PORT', '4000')));
const dataDir = getEnv('DATA_DIR', './data');
const app = createServer(createDefaultDependencies(dataDir));

app.listen(port, () => {
  console.log(`Better You API listening on http://localhost:${port}`);
});
