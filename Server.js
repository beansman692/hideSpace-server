// HideSpace Signaling Server – rooms + players + teams
const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: process.env.PORT || 10000 });

const rooms = {}; // roomCode -> { players: {} }

function broadcast(room) {
  const data = JSON.stringify({
    type: "playerList",
    players: rooms[room]?.players || {}
  });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.room === room) {
      client.send(data);
    }
  }
}

wss.on("connection", ws => {
  ws.on("message", msg => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    // Create room
    if (data.type === "createRoom") {
      rooms[data.room] = { players: {} };
      ws.room = data.room;
      ws.send(JSON.stringify({ type: "roomCreated", room: data.room }));
    }

    // Join room
    if (data.type === "joinRoom") {
      if (!rooms[data.room]) return;

      ws.room = data.room;

      rooms[data.room].players[data.id] = {
        name: data.name,
        team: "Hider",
        lat: data.lat,
        lon: data.lon
      };

      broadcast(data.room);
    }

    // Leave room
    if (data.type === "leaveRoom") {
      const room = rooms[data.room];
      if (!room) return;

      delete room.players[data.id];
      broadcast(data.room);
    }

    // Change team
    if (data.type === "setTeam") {
      const room = rooms[data.room];
      if (!room || !room.players[data.id]) return;

      room.players[data.id].team = data.team;
      broadcast(data.room);
    }
  });

  ws.on("close", () => {
    const room = ws.room;
    if (!room || !rooms[room]) return;
    // optional cleanup
  });
});
