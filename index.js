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
  socket.on('create', ({ videoId, userName, videoTitle, key }) => {
    if (!rooms.has(key)) {
      rooms.set(
        key,
        new Map([
          ['users', new Map()],
          ['videoId', videoId],
          ['videoTitle', videoTitle],
          ['time', 0],
          ['key', key],
        ]),
      );
    }
    socket.join(key);
    rooms
      .get(key)
      .get('users')
      .set(socket.id, {
        userName,
        role: rooms.get(key).get('users').size === 0 ? 'admin' : 'user',
        id: socket.id,
        time: 0,
      });
    socket.emit('role', rooms.get(key).get('users').get(socket.id).role);
    const usersToClient = [];
    rooms
      .get(key)
      .get('users')
      .forEach((obj) => usersToClient.push(obj));
    io.to(key).emit('getUsers', usersToClient);
  });
  socket.on('join', ({ userName, key, videoId, videoTitle }) => {
    if (rooms.has(key)) {
      socket.join(key);
      rooms
        .get(key)
        .get('users')
        .set(socket.id, {
          userName,
          role: rooms.get(key).get('users').size === 0 ? 'admin' : 'user',
          id: socket.id,
          time: 0,
        });
      const usersToClient = [];
      rooms
        .get(key)
        .get('users')
        .forEach((obj) => usersToClient.push(obj));
      io.to(key).emit('getUsers', usersToClient);
      socket.emit('role', rooms.get(key).get('users').get(socket.id).role);
    } else {
      rooms.set(
        key,
        new Map([
          ['users', new Map()],
          ['videoId', videoId],
          ['videoTitle', videoTitle],
          ['time', 0],
          ['key', key],
        ]),
      );

      socket.join(key);
      rooms
        .get(key)
        .get('users')
        .set(socket.id, {
          userName,
          role: rooms.get(key).get('users').size === 0 ? 'admin' : 'user',
          id: socket.id,
          time: 0,
        });
      socket.emit('role', rooms.get(key).get('users').get(socket.id).role);
      const usersToClient = [];
      rooms
        .get(key)
        .get('users')
        .forEach((obj) => usersToClient.push(obj));
      io.to(key).emit('getUsers', usersToClient);
    }
  });
  socket.on('checkRoom', ({ key }) => {
    if (rooms.has(key)) {
      socket.emit('getAnswerAboutRoom', true);
      socket.emit('info', {
        videoTitle: rooms.get(key).get('videoTitle'),
        videoId: rooms.get(key).get('videoId'),
      });
    } else {
      socket.emit('getAnswerAboutRoom', false);
    }
  });

  socket.on('getUsers', (videoId) => {
    if (rooms.has(videoId)) {
      const usersToClient = [];
      rooms
        .get(videoId)
        .get('users')
        .forEach((obj) => usersToClient.push(obj));
      io.to(videoId).emit('getUsers', usersToClient);
    }
  });

  socket.on('dc', (roomId) => {
    if (rooms.size >= 1 && rooms.has(roomId)) {
      socket.leave(roomId);
      if (
        rooms.get(roomId).get('users').get(socket.id).role === 'admin' &&
        rooms.get(roomId).get('users').size >= 2
      ) {
        rooms.get(roomId).get('users').delete(socket.id);
        const newAdminKey = rooms.get(roomId).get('users').keys().next().value;
        rooms.get(roomId).get('users').get(newAdminKey).role = 'admin';
        socket.to(newAdminKey).emit('role', 'admin');
      }
      rooms.get(roomId).get('users').delete(socket.id);
      if (rooms.get(roomId).get('users').size === 0) {
        rooms.delete(roomId);
      } else {
        const usersToClient = [];
        rooms
          .get(roomId)
          .get('users')
          .forEach((obj) => usersToClient.push(obj));
        io.to(roomId).emit('getUsers', usersToClient);
      }
    }
  });
  socket.on('socketTime', ({ time, key }) => {
    if (rooms.has(key) && rooms.get(key).get('users').has(socket.id)) {
      rooms.get(key).get('users').get(socket.id).time =
        (time - (time % 60)) / 60 + (time % 60) / 100;
      const usersToClient = [];
      rooms
        .get(key)
        .get('users')
        .forEach((obj) => usersToClient.push(obj));

      socket.emit('currrentSocketTime', time);
      io.to(key).emit('getUsers', usersToClient);
    }
  });

  socket.on('getRole', () => {
    if (rooms.size > 0) {
      rooms.forEach((obj) => {
        if (obj.get('users').has(socket.id)) {
          socket.emit('role', obj.get('users').get(socket.id).role);
        }
      });
    }
  });
  socket.on('roomTime', ({ time, key }) => {
    if (rooms.has(key)) {
      rooms.get(key).set('time', time / 60);
    }
  });

  socket.on('currentSocketTime', ({ key, time }) => {
    if (rooms.has(key) && rooms.get(key).get('users').has(socket.id)) {
      rooms.get(key).get('users').get(socket.id).time = time / 60;
      const usersToClient = [];
      rooms
        .get(key)
        .get('users')
        .forEach((obj) => usersToClient.push(obj));
      io.to(key).emit('getUsers', usersToClient);
    }
  });

  socket.on('syncUser', ({ key }) => {
    if (rooms.has(key) && rooms.get(key).get('users').has(socket.id)) {
      socket.emit('syncUsersToRoomTime', rooms.get(key).get('time') * 60);
    }
  });

  socket.on('syncAdmin', ({ key, time }) => {
    if (rooms.has(key) && rooms.get(key).get('users').has(socket.id)) {
      rooms.get(key).set('time', time / 60);
      io.to(key).emit('syncUsersByAdmin', rooms.get(key).get('time') * 60);
    }
  });
  socket.on('disconnect', () => {
    if (rooms.size != 0) {
      let findRoom;
      rooms.forEach((obj) => {
        if (obj.get('users').has(socket.id)) {
          findRoom = obj.get('key');
          if (obj.get('users').get(socket.id).role == 'admin' && obj.get('users').size >= 2) {
            obj.get('users').delete(socket.id);
            const newAdminKey = obj.get('users').keys().next().value;
            obj.get('users').get(newAdminKey).role = 'admin';
            socket.to(newAdminKey).emit('role', 'admin');
          }
          obj.get('users').delete(socket.id);
        } else return null;
        if (rooms.get(findRoom).get('users').size === 0) {
          rooms.delete(findRoom);
        }
      });
      if (rooms.has(findRoom)) {
        const usersToClient = [];
        rooms
          .get(findRoom)
          .get('users')
          .forEach((obj) => usersToClient.push(obj));
        io.to(findRoom).emit('getUsers', usersToClient);
      }
    }
  });
});

server.listen(7000, () => {
  console.log('serv start 7000');
});
