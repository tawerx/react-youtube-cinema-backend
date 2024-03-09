import pool from "../db.js";

class roomController {
  async createRoom(roomId, videoId, time) {
    const room = await pool.query(
      "INSERT INTO rooms (id, current_video_id, current_video_time) values ($1, $2, $3)",
      [roomId, videoId, time]
    );
  }

  async checkRoom(roomId) {
    const roomExist = (
      await pool.query("SELECT EXISTS(SELECT id FROM rooms WHERE id=$1)", [
        roomId,
      ])
    ).rows[0].exists;
    return roomExist;
  }

  async getRoomInfo(roomId) {
    const roomInfo = (
      await pool.query("SELECT * FROM rooms WHERE id = $1", [roomId])
    ).rows[0];
    const quene = (
      await pool.query("SELECT * FROM quene WHERE room_id = $1", [roomId])
    ).rows;
    return { ...roomInfo, quene };
  }

  async deleteRoom(roomId) {
    const delRoom = await pool.query("DELETE FROM rooms * WHERE id = $1", [
      roomId,
    ]);
  }

  async setCurrentVideo(roomId, videoId, videoTitle, time) {
    const video = await pool.query(
      "UPDATE rooms SET current_video_id = $1, current_video_title = $2, current_video_time = $3 WHERE id = $4",
      [videoId, videoTitle, time, roomId]
    );
  }

  async getCurrentRoomTime(roomId) {
    const time = (
      await pool.query("SELECT current_video_time FROM rooms WHERE id = $1", [
        roomId,
      ])
    ).rows[0].current_video_time;
    return time;
  }

  async setCurrentRoomTime(roomId, time) {
    const curTime = await pool.query(
      "UPDATE rooms SET current_video_time = $2 WHERE id = $1",
      [roomId, time]
    );
  }
}

export default new roomController();
