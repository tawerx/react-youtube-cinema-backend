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
  socket.on('createRoom', ({ name }) => {
    const roomId = Date.now().toString(16) + Math.random().toString(36).substr(2);
    rooms.set(
      roomId,
      new Map([
        ['users', new Map()],
        [
          'info',
          new Map([
            ['selectedVideo', {}],
            ['offerVideos', []],
            ['time', 0],
          ]),
        ],
        ['roomId', roomId],
      ]),
    );
    rooms
      .get(roomId)
      .get('users')
      .set(socket.id, { userName: name, role: 'admin', id: socket.id, time: 0 });
    socket.join(roomId);
    socket.emit('created', { roomId });
  });
  socket.on('join', ({ roomId, userName }) => {
    if (rooms.has(roomId)) {
      socket.join(roomId);
      rooms
        .get(roomId)
        .get('users')
        .set(socket.id, {
          userName,
          role: rooms.get(roomId).get('users').size === 0 ? 'admin' : 'user',
          id: socket.id,
          time: 0,
        });
      const usersToClient = [];
      rooms
        .get(roomId)
        .get('users')
        .forEach((obj) => usersToClient.push(obj));
      io.to(roomId).emit('getUsers', usersToClient);
      socket.emit('role', rooms.get(roomId).get('users').get(socket.id).role);
    } else {
      rooms.set(
        roomId,
        new Map([
          ['users', new Map()],
          ['info', new Map()],
          ['roomId', roomId],
        ]),
      );

      socket.join(roomId);
      rooms
        .get(roomId)
        .get('users')
        .set(socket.id, {
          userName,
          role: rooms.get(roomId).get('users').size === 0 ? 'admin' : 'user',
          id: socket.id,
          time: 0,
        });
      socket.emit('role', rooms.get(roomId).get('users').get(socket.id).role);
      const usersToClient = [];
      rooms
        .get(roomId)
        .get('users')
        .forEach((obj) => usersToClient.push(obj));
      io.to(roomId).emit('getUsers', usersToClient);
    }
  });

  socket.on('setUserName', ({ nickName, roomId }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).get('users').get(socket.id).userName = nickName;
      const usersToClient = [];
      rooms
        .get(roomId)
        .get('users')
        .forEach((obj) => usersToClient.push(obj));
      io.to(roomId).emit('getUsers', usersToClient);
    }
  });

  socket.on('connected', (roomId) => {
    if (rooms.has(roomId)) {
      const usersToClient = [];
      rooms
        .get(roomId)
        .get('users')
        .forEach((obj) => usersToClient.push(obj));
      const info = {
        selectedVideo: rooms.get(roomId).get('info').get('selectedVideo'),
        offerVideos: rooms.get(roomId).get('info').get('offerVideos'),
        time: rooms.get(roomId).get('info').get('time'),
      };
      socket.emit('getInfo', { users: usersToClient, info });
    }
  });

  socket.on('checkRoom', ({ roomId }) => {
    if (rooms.has(roomId)) {
      socket.emit('getAnswerAboutRoom', true);
      // socket.emit('info', {
      //   videoTitle: rooms.get(roomId).get('videoTitle'),
      //   videoId: rooms.get(roomId).get('videoId'),
      // });
    } else {
      socket.emit('getAnswerAboutRoom', false);
    }
  });

  socket.on('setVideo', ({ roomId, selectedVideo }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).get('info').set('selectedVideo', selectedVideo);
      io.to(roomId).emit('getVideo', selectedVideo);
    }
  });

  socket.on('setOfferVideo', ({ roomId, offerVideo }) => {
    if (rooms.has(roomId)) {
      const videos = rooms.get(roomId).get('info').get('offerVideos');
      if (videos.length <= 10 && !videos.find((obj) => obj.videoId === offerVideo.videoId)) {
        videos.push(offerVideo);
      } else if (!videos.find((obj) => obj.videoId === offerVideo.videoId)) {
        videos.shift();
        videos.push(offerVideo);
      }
      const offerVideos = [];
      rooms
        .get(roomId)
        .get('info')
        .get('offerVideos')
        .forEach((obj) => offerVideos.push(obj));
      io.to(roomId).emit('getOfferVideos', offerVideos);
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
  socket.on('socketTime', ({ time, roomId }) => {
    if (rooms.has(roomId) && rooms.get(roomId).get('users').has(socket.id)) {
      rooms.get(roomId).get('users').get(socket.id).time =
        (time - (time % 60)) / 60 + (time % 60) / 100;
      const usersToClient = [];
      rooms
        .get(roomId)
        .get('users')
        .forEach((obj) => usersToClient.push(obj));

      socket.emit('currrentSocketTime', time);
      io.to(roomId).emit('getUsers', usersToClient);
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
  socket.on('roomTime', ({ time, roomId }) => {
    if (rooms.has(roomId)) {
      rooms
        .get(roomId)
        .get('info')
        .set('time', time / 60);
    }
  });

  socket.on('currentSocketTime', ({ roomId, time }) => {
    if (rooms.has(roomId) && rooms.get(roomId).get('users').has(socket.id)) {
      rooms.get(roomId).get('users').get(socket.id).time = time / 60;
      const usersToClient = [];
      rooms
        .get(roomId)
        .get('users')
        .forEach((obj) => usersToClient.push(obj));
      io.to(roomId).emit('getUsers', usersToClient);
    }
  });

  socket.on('deleteOfferVideo', ({ roomId, videoId }) => {
    if (rooms.has(roomId)) {
      const oldOffer = rooms.get(roomId).get('info').get('offerVideos');
      rooms
        .get(roomId)
        .get('info')
        .set(
          'offerVideos',
          oldOffer.filter((obj) => obj.videoId != videoId),
        );
      const offerVideos = [];
      rooms
        .get(roomId)
        .get('info')
        .get('offerVideos')
        .forEach((obj) => offerVideos.push(obj));
      io.to(roomId).emit('getOfferVideos', offerVideos);
    }
  });

  socket.on('adminPause', ({ roomId }) => {
    io.to(roomId).emit('pause');
  });
  socket.on('adminPlay', ({ roomId }) => {
    io.to(roomId).emit('play');
  });

  socket.on('syncUser', ({ roomId }) => {
    if (rooms.has(roomId) && rooms.get(roomId).get('users').has(socket.id)) {
      socket.emit('syncUsersToRoomTime', rooms.get(roomId).get('info').get('time') * 60);
    }
  });

  socket.on('syncAdmin', ({ roomId, time }) => {
    if (rooms.has(roomId) && rooms.get(roomId).get('users').has(socket.id)) {
      rooms
        .get(roomId)
        .get('info')
        .set('time', time / 60);
      io.to(roomId).emit('syncUsersByAdmin', rooms.get(roomId).get('info').get('time') * 60);
    }
  });
  socket.on('disconnect', () => {
    if (rooms.size != 0) {
      let findRoom;
      rooms.forEach((obj) => {
        if (obj.get('users').has(socket.id)) {
          findRoom = obj.get('roomId');
          socket.leave(findRoom);
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
