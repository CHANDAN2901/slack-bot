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
const CONTEXT_MESSAGE_COUNT = 5;

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

  getCachedUserProfile: async (userId) => {
    try {
      // Try to get the user profile from Redis
      const cachedProfile = await redisClient.get(`user_profile:${userId}`);
  
      if (cachedProfile) {
        // If found in cache, parse and return it
        return JSON.parse(cachedProfile);
      } else {
        // If not in cache, fetch from database
        const userProfile = await dbOps.getUserProfile(userId);
  
        // Store the profile in Redis with an expiration of 1 hour (3600 seconds)
        await redisClient.setEx(`user_profile:${userId}`, 3600, JSON.stringify(userProfile));
  
        return userProfile;
      }
    } catch (error) {
      console.error("Error getting cached user profile:", error);
      // If there's an error with Redis, fall back to database query
      return await dbOps.getUserProfile(userId);
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

  updateUserSubscription: async (userId, subscriptionType, isSubscribed) => {
    try {
      const columnName = `${subscriptionType}_subscription`;
      await pool.query(
        `UPDATE users SET ${columnName} = ?, subscription_updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
        [isSubscribed ? 1 : 0, userId]
      );
      console.log(`Updated ${subscriptionType} subscription for user ${userId} to ${isSubscribed}`);
    } catch (error) {
      console.error(`Error updating ${subscriptionType} subscription for user ${userId}:`, error);
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

  getUserEmail: async (userId) => {
    try {
      const [rows] = await pool.query(
        "SELECT email FROM users WHERE user_id = ?",
        [userId]
      );
      return rows[0]?.email;
    } catch (error) {
      console.error("Error getting user email:", error);
      return null;
    }
  },

  getLastSaveTime: async (userId) => {
    try {
      const [rows] = await pool.query(
        "SELECT last_save_time FROM users WHERE user_id = ?",
        [userId]
      );
      return rows[0]?.last_save_time || new Date(0);
    } catch (error) {
      console.error("Error getting last save time:", error);
      return new Date(0);
    }
  },

  saveUserData: async (userId, lastSaveTime) => {
    try {
      const [messages] = await pool.query(
        "SELECT content FROM messages WHERE user_id = ? AND created_at > ? ORDER BY created_at ASC",
        [userId, lastSaveTime]
      );

      if (messages.length > 0) {
        const values = messages.map((m) => [userId, m.content]);
        await pool.query("INSERT INTO user_data (user_id, content) VALUES ?", [
          values,
        ]);
        await pool.query(
          "UPDATE users SET last_save_time = NOW() WHERE user_id = ?",
          [userId]
        );
      }
    } catch (error) {
      console.error("Error saving user data:", error);
    }
  },

  getUserProfile: async (userId) => {
    console.log("UserId: ", userId);
    try {
      const [userProfile] = await pool.query(
        "SELECT * FROM users WHERE user_id = ?",
        [userId]
      );

      // console.log("User profile from database: ", userProfile)
      if (userProfile.length === 0) {
        throw new Error("User not found");
      }
      return userProfile[0];
    } catch (error) {
      console.error("Error getting user profile:", error);
      throw error;
    }
  },

  getUserPurchaseHistory: async (userId) => {
    try {
      const [purchases] = await pool.query(
        "SELECT product_id, purchase_date FROM user_purchases WHERE user_id = ?",
        [userId]
      );
      // console.log("Product purchases: ", purchases)
      return purchases;
    } catch (error) {
      console.error("Error getting user purchase history:", error);
      return [];
    }
  },

  getPreviousUserPurchases: async (userId) => {
    try {
      const [purchases] = await pool.query(
        "SELECT product_id, purchase_date FROM user_purchases WHERE user_id = ? AND purchase_date < NOW()",
        [userId]
      );
      return purchases;
    } catch (error) {
      console.error("Error getting previous user purchases:", error);
      return [];
    }
  },

  getNewPurchases: async (userId) => {
    try {
      const currentPurchases = await dbOps.getUserPurchaseHistory(userId);
      // console.log(" Product from database currentPurchases", currentPurchases)
      const previousPurchases = await dbOps.getPreviousUserPurchases(userId);

      const newPurchases = currentPurchases;

      // const newPurchases = currentPurchases.filter(
      //   (currentPurchase) =>
      //     !previousPurchases.some(
      //       (prevPurchase) => prevPurchase.product_id === currentPurchase.product_id
      //     )
      // );

      return newPurchases;
    } catch (error) {
      console.error("Error getting new purchases:", error);
      return [];
    }
  },

  getProductDetails: async (productId) => {
    try {
      const [product] = await pool.query(
        "SELECT * FROM product_details WHERE product_id = ?",
        [productId]
      );
      // console.log("get Product details: ", product)
      return product;
    } catch (error) {
      console.error("Error getting product details:", error);
      return null;
    }
  },

  storePartOneData: async (userId, userData) => {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        `INSERT INTO users (user_id, username, full_name, email, mobile_no, age)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             username = VALUES(username),
             full_name = VALUES(full_name),
             email = VALUES(email),
             mobile_no = VALUES(mobile_no),
             age = VALUES(age)`,
        [
          userId,
          userData.username,  // Use the username here
          userData.full_name,
          userData.email,
          userData.mobile_no,
          userData.age
        ]
      );
    } finally {
      connection.release();
    }
  },

  storePartTwoData: async (userId, userData) => {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        `UPDATE users 
         SET height = ?,
             weight = ?,
             goal = ?,
             daily_routine = ?,
             allergies = ?,
             diet_preferences = ?,
             exercise_preferences = ?,
             is_completed = 1,
             kyc_completed_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [
          userData.height,
          userData.weight,
          JSON.stringify(userData.goal),
          userData.daily_routine,
          userData.allergies, // Now storing as plain text
          JSON.stringify(userData.diet_preferences),
          JSON.stringify(userData.exercise_preferences),
          userId
        ]
      );
    } finally {
      connection.release();
    }
  },

  checkKycCompletion: async (userId) => {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        'SELECT kyc_completed_at FROM users WHERE user_id = ?',
        [userId]
      );
      return rows.length > 0 && rows[0].kyc_completed_at !== null;
    } finally {
      connection.release();
    }
  },

  storeExerciseLog: async (userId, channelId, content) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
  
      // First, ensure the channel exists
      await connection.query(
        "INSERT IGNORE INTO channels (channel_id) VALUES (?)",
        [channelId]
      );
  
      // Now call the handleMomentum procedure
      await connection.query('CALL handleMomentum(?, ?, ?)', [userId, channelId, content]);
  
      await connection.commit();
      console.log("Exercise log stored successfully and momentum updated");
    } catch (error) {
      await connection.rollback();
      console.error("Error storing exercise log and updating momentum:", error);
      throw error;
    } finally {
      connection.release();
    }
  },
};

async function transferDataToMySQL(channelId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const messages = await redisClient.lRange(`messages:${channelId}`, 0, -1);
    console.log(`Found ${messages.length} messages for channel ${channelId}`);

    if (messages.length <= CONTEXT_MESSAGE_COUNT) {
      console.log(
        `Not enough messages to transfer for channel ${channelId}. Skipping transfer.`
      );
      return;
    }

    const messagesToTransfer = messages.slice(0, -CONTEXT_MESSAGE_COUNT);
    const values = messagesToTransfer.map((messageJson) => {
      const { userId, content, timestamp } = JSON.parse(messageJson);
      return [userId, channelId, content, new Date(timestamp)];
    });

    const [result] = await connection.query(
      "INSERT INTO messages (user_id, channel_id, content, created_at) VALUES ?",
      [values]
    );

    await redisClient.lTrim(
      `messages:${channelId}`,
      -CONTEXT_MESSAGE_COUNT,
      -1
    );

    await connection.commit();
    console.log(
      `Transferred ${result.affectedRows} messages for channel ${channelId} to MySQL and trimmed Redis`
    );
  } catch (error) {
    await connection.rollback();
    console.error(
      `Error transferring data to MySQL for channel ${channelId}:`,
      error
    );
  } finally {
    connection.release();
  }
}

async function periodicTransfer() {
  const channels = await redisClient.keys("messages:*");
  let totalTransferred = 0;
  for (const channelKey of channels) {
    const channelId = channelKey.split(":")[1];
    await transferDataToMySQL(channelId);
    const messageCount = await redisClient.lLen(channelKey);
    totalTransferred += Math.max(0, messageCount - CONTEXT_MESSAGE_COUNT);
  }
  console.log(
    `Periodic transfer: ${totalTransferred > 0
      ? `Transferred a total of ${totalTransferred} messages across all channels`
      : "No new messages to transfer"
    }`
  );
}

setInterval(periodicTransfer, 60 * 60 * 1000);

module.exports = {
  dbOps,
  transferDataToMySQL,
};
