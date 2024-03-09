import express from "express";
import { createServer } from "http";
import cors from "cors";
import { Server } from "socket.io";
import userController from "./controller/user.controller.js";
import roomController from "./controller/room.controller.js";
import queneController from "./controller/quene.controller.js";

const app = express();
app.use(cors());
app.use(express.json());
const server = createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
  socket.on("createRoom", async ({ name }) => {
    const roomId =
      Date.now().toString(16) + Math.random().toString(36).substr(2);

    await roomController.createRoom(roomId, "", 0);
    await userController.createUser(socket.id, name, roomId, "admin", 0);
    socket.join(roomId);
    socket.emit("created", { roomId });
  });

  socket.on("join", async ({ roomId, userName }) => {
    const roomExist = await roomController.checkRoom(roomId);
    if (roomExist) {
      socket.join(roomId);
      const adminExist = await userController.checkAdminRole(roomId);
      await userController.createUser(
        socket.id,
        userName,
        roomId,
        adminExist ? "user" : "admin",
        0
      );
      const users = await userController.getUsers(roomId);
      const role = await userController.getRole(socket.id);

      io.to(roomId).emit("getUsers", users);
      socket.emit("role", role);
      socket.emit("join_response", true);
    } else {
      socket.emit("join_response", false);
    }
  });

  socket.on("setUserName", async ({ nickName, roomId }) => {
    const roomExist = await roomController.checkRoom(roomId);
    if (roomExist) {
      await userController.changeNickName(socket.id, nickName);
      const users = await userController.getUsers(roomId);

      io.to(roomId).emit("getUsers", users);
    }
  });

  socket.on("connected", async (roomId) => {
    const roomExist = await roomController.checkRoom(roomId);
    if (roomExist) {
      const users = await userController.getUsers(roomId);
      const roomInfo = await roomController.getRoomInfo(roomId);
      socket.emit("getInfo", { users, roomInfo });
    }
  });

  socket.on("checkRoom", async ({ roomId }) => {
    const roomExist = await roomController.checkRoom(roomId);
    if (roomExist) {
      socket.emit("getAnswerAboutRoom", true);
    } else {
      socket.emit("getAnswerAboutRoom", false);
    }
  });

  socket.on("setVideo", async ({ roomId, selectedVideo }) => {
    const roomExist = await roomController.checkRoom(roomId);
    if (roomExist) {
      const { videoId, title } = selectedVideo;
      await roomController.setCurrentVideo(roomId, videoId, title, 0);
      io.to(roomId).emit("getVideo", selectedVideo);
    }
  });

  socket.on("setOfferVideo", async ({ roomId, offerVideo }) => {
    const roomExist = await roomController.checkRoom(roomId);
    const { title, videoId, image } = offerVideo;
    if (roomExist) {
      await queneController.setOfferVideo(
        roomId,
        title,
        videoId,
        image,
        socket.id
      );
      const offerVideos = await queneController.getQueneVideos(roomId);
      io.to(roomId).emit("getOfferVideos", offerVideos);
    }
  });

  socket.on("socketTime", async ({ time, roomId }) => {
    const userExist = await userController.checkUser(socket.id);
    const roomExist = await roomController.checkRoom(roomId);
    if (userExist && roomExist) {
      await userController.setUserTime(socket.id, time);
      const users = await userController.getUsers(roomId);
      // socket.emit("currrentSocketTime", time);
      io.to(roomId).emit("getUsersTime", users);
    }
  });

  socket.on("getRole", async () => {
    const role = await userController.getRole(socket.id);
    socket.emit("role", role);
  });

  socket.on("roomTime", async ({ time, roomId }) => {
    const roomExist = await roomController.checkRoom(roomId);
    if (roomExist) {
      await roomController.setCurrentRoomTime(roomId, time);
    }
  });

  socket.on("currentSocketTime", async ({ roomId, time }) => {
    const userExist = await userController.checkUser(socket.id);
    const roomExist = await roomController.checkRoom(roomId);
    if (userExist && roomExist) {
      await userController.setUserTime(socket.id, time);
      // rooms.get(roomId).get("users").get(socket.id).time = time / 60;
      // const usersToClient = [...rooms.get(roomId).get("users").values()];
      const users = await userController.getUsers(roomId);
      io.to(roomId).emit("getUsers", users);
    }
  });

  socket.on("deleteOfferVideo", async ({ roomId, videoId }) => {
    const roomExist = await roomController.checkRoom(roomId);
    if (roomExist) {
      await queneController.deleteQueneVideo(videoId);
      const offerVideos = await queneController.getQueneVideos(roomId);
      io.to(roomId).emit("getOfferVideos", offerVideos);
    }
  });

  socket.on("adminPause", async ({ roomId }) => {
    const roomExist = await roomController.checkRoom(roomId);
    if (roomExist) {
      io.to(roomId).emit("pause");
    }
  });
  socket.on("adminPlay", async ({ roomId }) => {
    const roomExist = await roomController.checkRoom(roomId);
    if (roomExist) {
      io.to(roomId).emit("play");
    }
  });

  socket.on("syncUser", async ({ roomId }) => {
    const userExist = await userController.checkUser(socket.id);
    const roomExist = await roomController.checkRoom(roomId);
    if (userExist && roomExist) {
      const time = await roomController.getCurrentRoomTime(roomId);
      socket.emit("syncUsersToRoomTime", time);
    }
  });

  socket.on("syncAdmin", async ({ roomId, time }) => {
    const roomExist = await roomController.checkRoom(roomId);
    const userExist = await userController.checkUser(socket.id);
    if (roomExist && userExist) {
      await roomController.setCurrentRoomTime(roomId, time);
      io.to(roomId).emit("syncUsersByAdmin", time);
    }
  });

  socket.on("disconnect", async () => {
    try {
      const roomId = await userController.getRoomId(socket.id);
      const roomExist = await roomController.checkRoom(roomId);
      if (roomExist) {
        socket.leave(roomId);
        await queneController.deleteQuene(socket.id, roomId);
        await userController.deleteUser(socket.id);
        const users = await userController.getUsers(roomId);
        if (users.length == 0) {
          roomController.deleteRoom(roomId);
        } else {
          const adminExist = await userController.checkAdminRole(roomId);
          if (!adminExist) {
            const newAdmin = await userController.setNewAdmin(roomId);
            socket.to(newAdmin).emit("role", "admin");
          }
        }
      }
      const retryRoomExist = await roomController.checkRoom(roomId);
      if (retryRoomExist) {
        const users = await userController.getUsers(roomId);
        io.to(roomId).emit("getUsers", users);
      }
    } catch (error) {
      console.log("Ошибка выхода");
    }
  });
});

server.listen(7000, () => {
  console.log("serv start 7000");
});
