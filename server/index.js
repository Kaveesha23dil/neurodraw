const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // Allow the Vite dev server to connect
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on('join_room', (roomId) => {
    // If the room exists and has people, we send them to the new user
    // Actually, simple-peer mesh networks usually have the NEW user call all EXISTING users.
    // So we need to get existing users in the room.
    const clientsInRoom = io.sockets.adapter.rooms.get(roomId);
    const users = [];
    if (clientsInRoom) {
      for (const clientId of clientsInRoom) {
        users.push(clientId);
      }
    }

    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    
    // Tell the user who just joined who else is in the room
    socket.emit('all_users', users);
  });

  socket.on('sending_signal', (payload) => {
    io.to(payload.userToSignal).emit('user_joined', { signal: payload.signal, callerID: payload.callerID });
  });

  socket.on('returning_signal', (payload) => {
    io.to(payload.callerID).emit('receiving_returned_signal', { signal: payload.signal, id: socket.id });
  });

  socket.on('disconnect', () => {
    console.log(`User Disconnected: ${socket.id}`);
    socket.broadcast.emit('user_disconnected', socket.id); // Or we can track rooms
  });
});

server.listen(PORT, () => {
  console.log(`Signaling Server running on port ${PORT}`);
});
