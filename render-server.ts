import { createServer } from 'node:http';
import { parse } from 'node:url';
import { WebSocketServer } from 'ws';
import { VelocityGameServer } from './server/game-server';

const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const gameServer = new VelocityGameServer();
const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

wss.on('connection', (ws) => {
  gameServer.handleConnection(ws);
});

const server = createServer((req, res) => {
  // Allow your Vercel frontend to fetch /api/rooms and /api/leaderboard
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = parse(req.url || '/', true);

  if (parsedUrl.pathname === '/api/rooms' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ rooms: gameServer.getRoomsSummary() }));
    return;
  }

  if (parsedUrl.pathname === '/api/leaderboard' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ entries: gameServer.getLeaderboard() }));
    return;
  }

  // Health check route for Render
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Velocity Game Server is running');
});

server.on('upgrade', (req, socket, head) => {
  const parsedUrl = parse(req.url || '/', true);
  if (parsedUrl.pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, hostname, () => {
  console.log(`> Velocity Game Server ready on http://${hostname}:${port}`);
});
