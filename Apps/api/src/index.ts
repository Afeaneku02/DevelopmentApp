import { getEnv } from '@better-you/config';
import { createServer } from './server';

const port = Number(getEnv('API_PORT', '4000'));
const app = createServer();

app.listen(port, () => {
  console.log(`Better You API listening on http://localhost:${port}`);
});
