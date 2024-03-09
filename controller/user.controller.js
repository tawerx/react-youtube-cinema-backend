import pool from "../db.js";

class userController {
  async createUser(id, userName, roomId, role, time) {
    const newPerson = await pool.query(
      "INSERT INTO users (socket_id, username, room_id, rolle, current_video_time) values ($1, $2, $3, $4, $5)",
      [id, userName, roomId, role, time]
    );
  }

  async checkUser(userId) {
    const user = (
      await pool.query(
        "SELECT EXISTS(SELECT socket_id FROM users WHERE socket_id = $1)",
        [userId]
      )
    ).rows;
    return user;
  }

  async changeNickName(socket_id, username) {
    const changeNickName = await pool.query(
      "UPDATE users SET username = $1 WHERE socket_id = $2",
      [username, socket_id]
    );
  }

  async getUsers(roomId) {
    const users = (
      await pool.query(
        "SELECT socket_id, username, room_id, rolle, current_video_time FROM users WHERE room_id = $1",
        [roomId]
      )
    ).rows;
    const newUsers = users.map((obj) => {
      return {
        user_id: obj.socket_id.substring(
          0,
          Math.trunc(obj.socket_id.length / 3)
        ),
        username: obj.username,
        room_id: obj.room_id,
        rolle: obj.rolle,
        current_video_time: obj.current_video_time,
      };
    });
    return newUsers;
  }

  async checkAdminRole(roomId) {
    const adminExist = (
      await pool.query(
        "SELECT EXISTS(SELECT socket_id FROM users WHERE room_id = $1 AND rolle = $2)",
        [roomId, "admin"]
      )
    ).rows[0].exists;
    return adminExist;
  }

  async getRole(userId) {
    const role = (
      await pool.query("SELECT rolle FROM users WHERE socket_id = $1", [userId])
    ).rows[0].rolle;
    return role;
  }

  async deleteUser(userId) {
    const delUser = await pool.query(
      "DELETE FROM users * WHERE socket_id = $1",
      [userId]
    );
  }

  async setNewAdmin(roomId) {
    const admin = (
      await pool.query(
        "UPDATE users SET rolle = $1 WHERE socket_id = (SELECT socket_id FROM users WHERE room_id = $2 ORDER BY socket_id LIMIT 1) RETURNING socket_id",
        ["admin", roomId]
      )
    ).rows[0].socket_id;
    return admin;
  }

  async setUserTime(userId, time) {
    const userTime = await pool.query(
      "UPDATE users SET current_video_time = $2 WHERE socket_id = $1",
      [userId, time]
    );
  }

  async getRoomId(userId) {
    try {
      const roomId = (
        await pool.query("SELECT room_id FROM users WHERE socket_id = $1", [
          userId,
        ])
      ).rows[0].room_id;
      return roomId;
    } catch (error) {
      console.log("Ошибка поиска комнаты");
    }
  }
}

export default new userController();
