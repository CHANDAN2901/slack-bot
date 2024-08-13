const cron = require("node-cron");
const { dbOps } = require("./database");
const aiOps = require("./ai");
const utils = require("./utils");

const { WebClient } = require("@slack/web-api");
const { SLACK_BOT_TOKEN } = require("./config");
const { error } = require("pdf-lib");
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

async function runHourlyChatSummarization() {
  console.log("Running chat summarization");
  try {
    if (!dbOps.pool) {
      throw new Error("Database pool is not initialized");
    }
    const [channels] = await dbOps.pool.query(
      "SELECT DISTINCT channel_id FROM messages WHERE created_at >= NOW() - INTERVAL 1 MINUTE"
    );

    for (const channel of channels) {
      const startTime = new Date(Date.now() - 3600000);
      const endTime = new Date();
      const [messages] = await dbOps.pool.query(
        "SELECT user_id, content FROM messages WHERE channel_id = ? AND created_at BETWEEN ? AND ?",
        [channel.channel_id, startTime, endTime]
      );

      if (messages.length === 0) continue;

      const channelSummary = await aiOps.summarizeChat(
        messages.map((m) => m.content)
      );

      if (channelSummary) {
        await dbOps.storeSummary(
          channel.channel_id,
          channelSummary,
          startTime,
          endTime
        );
        // await utils.sendSlackMessage(channel.channel_id, `Here's a summary of the fitness discussion in the last minute:\n\n${channelSummary}`);
      }

      const userMessages = messages.reduce((acc, m) => {
        if (!acc[m.user_id]) acc[m.user_id] = [];
        acc[m.user_id].push(m.content);
        return acc;
      }, {});

      for (const [userId, userMsgs] of Object.entries(userMessages)) {
        const userSummary = await aiOps.summarizeChat(userMsgs);
        await dbOps.storeHourlyUserSummary(
          userId,
          channel.channel_id,
          userSummary
        );
      }
    }
  } catch (error) {
    console.error("Error in runHourlyChatSummarization:", error);
  }
}

async function runWeeklyUserReportGeneration() {
  console.log("Running weekly user report generation");
  try {
    const [users] = await dbOps.pool.query("SELECT user_id, email FROM users");
    console.log(`Found ${users.length} users`);

    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    for (const user of users) {
      console.log(`Processing user ${user.user_id}`);
      try {
        const userMessages = await dbOps.getUserMessages(
          user.user_id,
          startDate,
          endDate
        );

        if (userMessages.length === 0) {
          console.log(`No messages found for user ${user.user_id}`);
          continue;
        }

        console.log(`Generating summary for user ${user.user_id}`);
        const weeklySummary = await aiOps.generateUserWeeklySummary(
          userMessages
        );
        console.log(`Storing summary for user ${user.user_id}`);
        await dbOps.storeWeeklyUserSummary(user.user_id, weeklySummary);

        console.log(`Generating PDF for user ${user.user_id}`);
        const pdfBuffer = await utils.generatePDF(weeklySummary, user.user_id);

        if (user.email) {
          console.log(`Sending email to ${user.email}`);
          await utils.sendEmail(
            user.email,
            "Your Weekly Fitness Report",
            "Please find attached your weekly fitness report.",
            [
              {
                filename: "weekly_fitness_report.pdf",
                content: pdfBuffer,
                contentType: "application/pdf",
              },
            ]
          );
          console.log(`Email sent to ${user.email}`);
        } else {
          console.log(`No email found for user ${user.user_id}`);
        }

        const conversationResponse = await slackClient.conversations.open({
          users: user.user_id,
        });

        if (!conversationResponse.ok) {
          throw new Error(
            `Failed to open conversation: ${conversationResponse.error}`
          );
        }

        const channelId = conversationResponse.channel.id;

        // Send PDF to Slack inbox
        console.log(`Sending PDF to Slack inbox for user ${user.user_id}`);
        const result = await slackClient.files.uploadV2({
          channel_id: channelId,
          filename: "weekly_fitness_report.pdf",
          file: pdfBuffer,
          title: "Weekly Fitness Report",
          initial_comment:
            "Here's your weekly fitness report. You can view it directly in Slack or download it.",
        });

        if (result.ok) {
          console.log(
            `PDF sent successfully to Slack inbox for user ${user.user_id}`
          );
        } else {
          console.error(
            `Failed to send PDF to Slack inbox for user ${user.user_id}: ${result.error}`
          );
        }
      } catch (userError) {
        console.error(`Error processing user ${user.user_id}:`, userError);
      }
    }
  } catch (error) {
    console.error("Error in runWeeklyUserReportGeneration:", error);
  }
}

async function checkAndNotifyInactiveUsers() {
  console.log("Checking for inactive users");
  try {
    // const [inactiveUsers] = await dbOps.pool.query(`
    //   SELECT DISTINCT u.user_id, u.email
    //   FROM users u
    // `);

    console.log("Inactive User: ", inactiveUsers);
    const [inactiveUsers] = await dbOps.pool.query(`
      SELECT DISTINCT u.user_id, u.email
      FROM users u
      LEFT JOIN messages m ON u.user_id = m.user_id
      WHERE m.created_at < NOW() - INTERVAL 24 HOUR OR m.created_at IS NULL
    `);

    // Fetch all motivation messages
    const [motivations] = await dbOps.pool.query(`
      SELECT message_text FROM motivational_messages
    `);

    for (const user of inactiveUsers) {
      console.log(`Sending notification to inactive user: ${user.user_id}`);

      // Select a random motivation message
      const randomIndex = Math.floor(Math.random() * motivations.length);
      const motivationalMessage = motivations[randomIndex].message_text;

      if (motivationalMessage) {
        try {
          const conversationResponse = await slackClient.conversations.open({
            users: user.user_id,
          });

          if (!conversationResponse.ok) {
            throw new Error(`Failed to open conversation: ${conversationResponse.error}`);
          }

          const channelId = conversationResponse.channel.id;

          await slackClient.chat.postMessage({
            channel: channelId,
            text: motivationalMessage,
          });

          console.log(`Notification sent to user ${user.user_id} via Slack`);
        } catch (slackError) {
          console.error(`Error sending Slack notification to user ${user.user_id}:`, slackError);
        }
      } else {
        console.error(`No motivational message available for user ${user.user_id}`);
      }

      // Send Slack message
      // try {
      //   const conversationResponse = await slackClient.conversations.open({
      //     users: user.user_id,
      //   });

      //   if (!conversationResponse.ok) {
      //     throw new Error(`Failed to open conversation: ${conversationResponse.error}`);
      //   }

      //   const channelId = conversationResponse.channel.id;

      //   await slackClient.chat.postMessage({
      //     channel: channelId,
      //     text: motivationalMessage,
      //   });

      //   console.log(`Notification sent to user ${user.user_id} via Slack`);
      // } catch (slackError) {
      //   console.error(`Error sending Slack notification to user ${user.user_id}:`, slackError);
      // }

      // Send email notification if email is available
      // if (user.email) {
      //   try {
      //     await utils.sendEmail(
      //       user.email,
      //       "Your Fitness Journey Needs You!",
      //       motivationalMessage
      //     );
      //     console.log(`Notification email sent to ${user.email}`);
      //   } catch (emailError) {
      //     console.error(`Error sending email notification to ${user.email}:`, emailError);
      //   }
      // }
    }
  } catch (error) {
    console.error("Error in checkAndNotifyInactiveUsers:", error);
  }
}

async function checkAndSendCustomizedNutritionPlans() {
  console.log("Starting customized nutrition plan check")
  try {
    const [users] = await dbOps.pool.query("SELECT user_id FROM users WHERE nutrition_subscription = 1");

    for (const user of users) {
      const newPurchases = await dbOps.getNewPurchases(user.user_id);
      if (newPurchases.length > 0) {
        await utils.sendCustomizedNutritionPlan(user.user_id, newPurchases);
      }
    }
  } catch (error) {
    console.error("Error in checkAndSendCustomizedNutritionPlans:", error);
  }
}

async function checkAndSendCustomizedExercisePlans() {
  console.log("Starting customized exercise plan check")
  try {
    const [users] = await dbOps.pool.query("SELECT user_id FROM users WHERE exercise_subscription = 1");

    for (const user of users) {
      const newPurchases = await dbOps.getNewPurchases(user.user_id);
      if (newPurchases.length > 0) {
        await utils.sendCustomizedExercisePlan(user.user_id, newPurchases);
      }
    }
  } catch (error) {
    console.error("Error in checkAndSendCustomizedExercisePlans:", error);
  }
}


function init(app) {
  cron.schedule("0 * * * *", runHourlyChatSummarization);
  cron.schedule("0 0 * * 0", runWeeklyUserReportGeneration);
  cron.schedule("0 12 * * *", checkAndNotifyInactiveUsers);
  cron.schedule("0 12 * * *", checkAndSendCustomizedNutritionPlans);
  cron.schedule("* * * * *", checkAndSendCustomizedExercisePlans);

}

module.exports = { init };
