import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { VelocityGameServer } from './server/game-server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const upgradeHandler = app.getUpgradeHandler();
  const gameServer = new VelocityGameServer();
  // 256 KB is plenty for inputs and a custom map; the ws default (100 MB) would let one client exhaust memory.
  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

  wss.on('connection', (ws) => {
    gameServer.handleConnection(ws);
  });

  const server = createServer((req, res) => {
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

    handle(req, res, parsedUrl);
  });

  server.on('upgrade', (req, socket, head) => {
    const parsedUrl = parse(req.url || '/', true);
    if (parsedUrl.pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      upgradeHandler(req, socket, head);
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Project Velocity ready on http://${hostname}:${port}`);
  });
});
