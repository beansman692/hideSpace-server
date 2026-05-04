// Simple WebSocket signaling server for HideSpace on Render

const WebSocket = require("ws");
const http = require("http");

const PORT = process.env.PORT || 10000;

// HTTP server (Render expects an HTTP server)
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("HideSpace signaling server is running");
});

// WebSocket server on top of HTTP
const wss = new WebSocket.Server({ server });

const rooms = new Map(); // roomCode -> { host: ws, hostId, players: Map<playerId, ws> }

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    const type = data.type;

    // Host creates room
    if (type === "host-create") {
      const { room, hostId } = data;
      rooms.set(room, { host: ws, hostId, players: new Map() });
      ws._role = "host";
      ws._room = room;
      ws._id = hostId;
      ws.send(JSON.stringify({ type: "host-created", room }));
      return;
    }

    // Player registers
    if (type === "player-register") {
      const { room, playerId } = data;
      const r = rooms.get(room);
      if (!r) {
        ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
        return;
      }
      r.players.set(playerId, ws);
      ws._role = "player";
      ws._room = room;
      ws._id = playerId;
      ws.send(JSON.stringify({ type: "player-registered", room }));
      return;
    }

    // Player sends offer
    if (type === "player-offer") {
      const { room, playerId, name, lat, lon, offer } = data;
      const r = rooms.get(room);
      if (!r || !r.host) return;
      r.host.send(JSON.stringify({
        type: "pending-offer",
        playerId,
        name,
        lat,
        lon,
        offer
      }));
      return;
    }

    // Host sends answer
    if (type === "host-answer") {
      const { room, to, answer } = data;
      const r = rooms.get(room);
      if (!r) return;
      const pws = r.players.get(to);
      if (!pws) return;
      pws.send(JSON.stringify({ type: "host-answer", answer }));
      return;
    }

    // Host broadcasts players
    if (type === "broadcast-players") {
      const { room, players } = data;
      const r = rooms.get(room);
      if (!r) return;
      for (const [, pws] of r.players) {
        pws.send(JSON.stringify({ type: "updatePlayers", players }));
      }
      return;
    }

    // Host closes room
    if (type === "host-closed") {
      const { room } = data;
      const r = rooms.get(room);
      if (!r) return;
      for (const [, pws] of r.players) {
        pws.send(JSON.stringify({ type: "hostClosed" }));
        try { pws.close(); } catch {}
      }
      rooms.delete(room);
      return;
    }
  });

  ws.on("close", () => {
    const room = ws._room;
    const id = ws._id;
    const role = ws._role;
    if (!room || !rooms.has(room)) return;
    const r = rooms.get(room);

    if (role === "host") {
      for (const [, pws] of r.players) {
        try { pws.send(JSON.stringify({ type: "hostClosed" })); } catch {}
        try { pws.close(); } catch {}
      }
      rooms.delete(room);
    } else if (role === "player") {
      r.players.delete(id);
    }
  });
});

server.listen(PORT, () => {
  console.log("HideSpace signaling server running on port " + PORT);
});
