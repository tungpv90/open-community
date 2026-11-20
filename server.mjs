import { createServer } from 'node:http';
import worker from './dist/server/index.js';

const port = Number(process.env.PORT || 3000);

const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://${incoming.headers.host || `localhost:${port}`}${incoming.url || '/'}`, {
      method: incoming.method,
      headers: incoming.headers,
      body: ['GET', 'HEAD'].includes(incoming.method || 'GET') ? undefined : body,
      duplex: body ? 'half' : undefined,
    });
    const response = await worker.fetch(request, process.env, { waitUntil() {} });
    outgoing.statusCode = response.status;
    response.headers.forEach((value, key) => outgoing.setHeader(key, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.statusCode = 500;
    outgoing.setHeader('content-type', 'application/json; charset=utf-8');
    outgoing.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }));
  }
});

server.listen(port, '0.0.0.0', () => console.log(`Flarum Community running at http://0.0.0.0:${port}`));

function shutdown(signal) {
  console.log(`${signal} received; shutting down gracefully`);
  server.close((error) => process.exit(error ? 1 : 0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
