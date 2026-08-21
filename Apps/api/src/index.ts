import { getEnv } from '@better-you/config';
import { createServer, createDefaultDependencies } from './server';

const port = Number(getEnv('API_PORT', '4000'));
const dataDir = getEnv('DATA_DIR', './data');
const app = createServer(createDefaultDependencies(dataDir));

app.listen(port, () => {
  console.log(`Better You API listening on http://localhost:${port}`);
});
