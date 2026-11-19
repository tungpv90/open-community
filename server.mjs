import { createServer } from 'node:http';
import worker from './worker/index.js';

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

server.listen(port, () => console.log(`Community forum running at http://localhost:${port}`));
