import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    open: true
  },
  plugins: [{
    name: 'debug-dump-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/debug-dump' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            fs.writeFileSync(path.resolve('./scratch_db_dump.json'), body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok' }));
          });
        } else {
          next();
        }
      });
    }
  }],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
