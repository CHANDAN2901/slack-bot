const mysql = require("mysql2/promise");
const config = require("./config");
const redis = require("redis");

const pool = mysql.createPool({
  host: config.DB_HOST,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
});

const redisClient = redis.createClient({
  url: config.REDIS_URL,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

(async () => {
  await redisClient.connect();
})();

const REDIS_MESSAGE_LIMIT = 1000;
const CONTEXT_MESSAGE_COUNT = 10;

const dbOps = {
  pool,
  storeUser: async (userId, username, email) => {
    try {
      await pool.query(
        "INSERT INTO users (user_id, username, email) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE username = VALUES(username), email = VALUES(email)",
        [userId, username, email]
      );
    } catch (error) {
      console.error("Error storing user:", error);
    }
  },

  clearUserContext: async (userId) => {
    try {
      // Get all channels where the user has messages
      const channels = await redisClient.keys(`messages:*`);

      for (const channelKey of channels) {
        const channelId = channelKey.split(":")[1];

        // Get all messages from Redis for this channel
        const allMessages = await redisClient.lRange(channelKey, 0, -1);

        // Filter messages for the specific user
        const userMessages = allMessages.filter((msg) => {
          const { userId: msgUserId } = JSON.parse(msg);
          return msgUserId === userId;
        });

        if (userMessages.length > 0) {
          // Start a transaction
          const connection = await pool.getConnection();
          await connection.beginTransaction();

          try {
            // Insert user's messages into MySQL
            const values = userMessages.map((messageJson) => {
              const { content, timestamp } = JSON.parse(messageJson);
              return [userId, channelId, content, new Date(timestamp)];
            });

            await connection.query(
              "INSERT INTO messages (user_id, channel_id, content, created_at) VALUES ?",
              [values]
            );

            // Remove user's messages from Redis
            for (const msg of userMessages) {
              await redisClient.lRem(channelKey, 0, msg);
            }

            // Commit the transaction
            await connection.commit();
            console.log(
              `Transferred and cleared ${userMessages.length} messages for user ${userId} in channel ${channelId}`
            );
          } catch (error) {
            // If there's an error, rollback the changes
            await connection.rollback();
            throw error;
          } finally {
            // Release the connection
            connection.release();
          }
        } else {
          console.log(
            `No messages to transfer for user ${userId} in channel ${channelId}`
          );
        }
      }
    } catch (error) {
      console.error("Error clearing user context:", error);
    }
  },

  storeChannel: async (channelId, channelName) => {
    try {
      await pool.query(
        "INSERT IGNORE INTO channels (channel_id, channel_name) VALUES (?, ?)",
        [channelId, channelName]
      );
    } catch (error) {
      console.error("Error storing channel:", error);
    }
  },

  storeMessage: async (userId, channelId, content) => {
    try {
      content =
        content.length > 2000 ? content.slice(0, 1997) + "..." : content;
      const trimmedContent = content.replace(/^<@[A-Z0-9]+>\s*/, "");

      await redisClient.rPush(
        `messages:${channelId}`,
        JSON.stringify({
          userId,
          content: trimmedContent,
          timestamp: Date.now(),
        })
      );

      const messageCount = await redisClient.lLen(`messages:${channelId}`);
      if (messageCount > REDIS_MESSAGE_LIMIT) {
        await transferDataToMySQL(channelId);
      }
    } catch (error) {
      console.error("Error storing message in Redis:", error);
    }
  },

  getLastMessages: async (channelId, limit) => {
    try {
      const messages = await redisClient.lRange(
        `messages:${channelId}`,
        -limit,
        -1
      );
      return messages.map((msg) => {
        const { userId, content } = JSON.parse(msg);
        return `User ${userId}: ${content}`;
      });
    } catch (error) {
      console.error("Error getting last messages from Redis:", error);
      return [];
    }
  },

  clearChannelContext: async (channelId) => {
    try {
      await redisClient.del(`messages:${channelId}`);
    } catch (error) {
      console.error("Error clearing channel context:", error);
    }
  },

  storeSummary: async (channelId, content, startTime, endTime) => {
    try {
      await pool.query(
        "INSERT INTO summaries (channel_id, content, start_time, end_time) VALUES (?, ?, ?, ?)",
        [channelId, content, startTime, endTime]
      );
    } catch (error) {
      console.error("Error storing summary:", error);
    }
  },

  storeHourlyUserSummary: async (userId, channelId, summary) => {
    try {
      await pool.query(
        'INSERT INTO user_summaries (user_id, channel_id, content, summary_type) VALUES (?, ?, ?, "hourly")',
        [userId, channelId, summary]
      );
    } catch (error) {
      console.error("Error storing hourly user summary:", error);
    }
  },

  storeWeeklyUserSummary: async (userId, summary) => {
    try {
      await pool.query(
        'INSERT INTO user_summaries (user_id, content, summary_type) VALUES (?, ?, "weekly")',
        [userId, summary]
      );
    } catch (error) {
      console.error("Error storing weekly user summary:", error);
    }
  },

  getUserMessages: async (userId, startDate, endDate) => {
    try {
      const [rows] = await pool.query(
        "SELECT content FROM messages WHERE user_id = ? AND created_at BETWEEN ? AND ?",
        [userId, startDate, endDate]
      );
      return rows.map((row) => row.content);
    } catch (error) {
      console.error("Error getting user messages:", error);
      return [];
    }
  },

  
    const connection = await pool.getConnection();
    try {
      await connection.query(
        'INSERT INTO users (user_id, full_name, email, mobile_no, age) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE full_name=?, email=?, mobile_no=?, age=?',
        [
          userId,
          userData.full_name,
          userData.email,
          userData.mobile_no,
          userData.age,
          userData.full_name,
          userData.email,
          userData.mobile_no,
          userData.age
        ]
      );
    } finally {
      connection.release();
    }

  
};

setInterval(periodicTransfer, 60 * 60 * 1000);

module.exports = {
  dbOps,
  transferDataToMySQL,
};
