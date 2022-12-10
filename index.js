import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server);

const rooms = new Map();

io.on('connection', (socket) => {
  socket.on('join', (roomId) => {
    if (!rooms.has(roomId)) {
      rooms.set(
        roomId,
        new Map([
          ['users', new Map()],
          ['videoId', roomId],
          ['time', 0],
        ]),
      );
    }
    socket.join(roomId);
    rooms.get(roomId).get('users').set(socket.id);
  });
  socket.on('checkRoom', (roomId) => {
    if (rooms.has(roomId)) {
      socket.emit('getAnswerAboutRoom', true);
    } else {
      socket.emit('getAnswerAboutRoom', false);
    }
  });

  socket.on('time', ({ time, roomId }) => {
    io.to(roomId).emit('getTime', time);
    rooms.get(roomId).set('time', time);
  });

  socket.on('dc', (roomId) => {
    socket.leave(roomId);
    rooms.get(roomId).get('users').delete(socket.id);
    if (rooms.get(roomId).get('users').size === 0) {
      rooms.delete(roomId);
    }
  });

  socket.on('disconnect', () => {
    let findRoom;
    rooms.forEach((obj) => {
      if (obj.get('users').has(socket.id)) {
        findRoom = obj.get('videoId');
        obj.get('users').delete(socket.id);
      } else return null;
      if (rooms.get(findRoom).get('users').size === 0) {
        rooms.delete(findRoom);
      }
    });
  });
});

server.listen(7000, () => {
  console.log('serv start 7000');
});
