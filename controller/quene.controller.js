import pool from "../db.js";

class queneController {
  async setOfferVideo(roomId, videoTitle, videoId, videoImg, userId) {
    try {
      const video = await pool.query(
        "INSERT INTO quene (video_id, room_id, user_id, img_src, video_title) values ($1, $2, $3, $4, $5)",
        [videoId, roomId, userId, videoImg, videoTitle]
      );
    } catch (error) {
      console.log("Видео уже в предложенных");
    }
  }

  async getQueneVideos(roomId) {
    const quene = (
      await pool.query("SELECT * FROM quene WHERE room_id = $1", [roomId])
    ).rows;
    return quene;
  }

  async deleteQueneVideo(videoId) {
    const video = await pool.query("DELETE FROM quene * WHERE video_id = $1", [
      videoId,
    ]);
  }

  async deleteQuene(userId, roomId) {
    const deleteQuene = await pool.query(
      "DELETE FROM quene * WHERE user_id = $1 AND room_id = $2",
      [userId, roomId]
    );
  }
}

export default new queneController();
