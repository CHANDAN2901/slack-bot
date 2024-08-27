const cron = require("node-cron");
const { dbOps } = require("./database");
const aiOps = require("./ai");
const utils = require("./utils");
const fs = require('fs').promises;
const path = require('path');
const { WebClient } = require("@slack/web-api");
const { SLACK_BOT_TOKEN } = require("./config");
const { error } = require("pdf-lib");
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

async function runHourlyChatSummarization() {
  console.log("Running chat summarization at", new Date());

  try {
    const [channels] = await dbOps.pool.query(
      "SELECT DISTINCT channel_id FROM messages WHERE created_at >= NOW() - INTERVAL 1 MINUTE"
    );
    console.log("Channels found:", channels);

    for (const channel of channels) {
      console.log(`Processing channel: ${channel.channel_id}`);

      const startTime = new Date(Date.now() - 3600000);
      const endTime = new Date();
      const [messages] = await dbOps.pool.query(
        "SELECT user_id, content FROM messages WHERE channel_id = ? AND created_at BETWEEN ? AND ?",
        [channel.channel_id, startTime, endTime]
      );

      console.log(`Messages found for channel ${channel.channel_id}:`, messages.length);

      if (messages.length === 0) continue;

      const channelSummary = await aiOps.summarizeChat(
        messages.map((m) => m.content)
      );
      console.log("Channel Summary:", channelSummary);

      if (channelSummary) {
        await dbOps.storeSummary(channel.channel_id, channelSummary, startTime, endTime);
      }

      // Process user-specific summaries
      const userMessages = messages.reduce((acc, m) => {
        if (!acc[m.user_id]) acc[m.user_id] = [];
        acc[m.user_id].push(m.content);
        return acc;
      }, {});

      for (const [userId, userMsgs] of Object.entries(userMessages)) {
        const userSummary = await aiOps.summarizeChat(userMsgs);
        console.log(`User Summary for ${userId}:`, userSummary);
        await dbOps.storeHourlyUserSummary(userId, channel.channel_id, userSummary);
      }
    }
  } catch (error) {
    console.error("Error in runHourlyChatSummarization:", error);
  }
}

// async function runWeeklyUserReportGeneration() {
//   console.log("Running weekly user report generation");
//   try {
//     // Ensure reports directory exists
//     const reportsDir = path.join(process.cwd(), 'reports');
//     await fs.mkdir(reportsDir, { recursive: true });

//     const [users] = await dbOps.pool.query("SELECT user_id, email, report_path FROM users");
//     console.log(`Found ${users.length} users`);

//     const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
//     const endDate = new Date();

//     for (const user of users) {
//       console.log(`Processing user ${user.user_id}`);
//       try {
//         const userMessages = await dbOps.getUserMessages(
//           user.user_id,
//           startDate,
//           endDate
//         );

//         if (userMessages.length === 0) {
//           console.log(`No messages found for user ${user.user_id}`);
//           continue;
//         }

//         console.log(`Generating summary for user ${user.user_id}`);
//         const userProfile = await dbOps.getUserProfile(user.user_id);

//         const weeklySummary = await aiOps.generateUserWeeklySummary(
//           userMessages, userProfile
//         );
//         console.log(`Storing summary for user ${user.user_id}`);
//         await dbOps.storeWeeklyUserSummary(user.user_id, weeklySummary);

//         console.log(`Generating PDF for user ${user.user_id}`);
//         const pdfBuffer = await utils.generatePDF(weeklySummary, user.user_id, userProfile);

//         // Generate new report filename
//         const reportFilename = `weekly_fitness_report_${user.user_id}_${endDate.toISOString().split('T')[0]}.pdf`;
//         const newReportPath = path.join(reportsDir, reportFilename);

//         // Remove old report if it exists
//         if (user.report_path) {
//           try {
//             await fs.unlink(user.report_path);
//             console.log(`Removed old report: ${user.report_path}`);
//           } catch (unlinkError) {
//             console.error(`Error removing old report: ${unlinkError.message}`);
//             // Continue execution even if old file removal fails
//           }
//         }

//         // Store new PDF
//         await fs.writeFile(newReportPath, pdfBuffer);
//         console.log(`New report stored at ${newReportPath}`);

//         // Update the user's report path in the database
//         await dbOps.pool.query('UPDATE users SET report_path = ? WHERE user_id = ?', [newReportPath, user.user_id]);

//         if (user.email) {
//           console.log(`Sending email to ${user.email}`);
//           await utils.sendEmail(
//             user.email,
//             "Your Weekly Fitness Report",
//             "Please find attached your weekly fitness report.",
//             [
//               {
//                 filename: "weekly_fitness_report.pdf",
//                 content: pdfBuffer,
//                 contentType: "application/pdf",
//               },
//             ]
//           );
//           console.log(`Email sent to ${user.email}`);
//         } else {
//           console.log(`No email found for user ${user.user_id}`);
//         }

//         const conversationResponse = await slackClient.conversations.open({
//           users: user.user_id,
//         });

//         if (!conversationResponse.ok) {
//           throw new Error(
//             `Failed to open conversation: ${conversationResponse.error}`
//           );
//         }

//         const channelId = conversationResponse.channel.id;

//         // Send PDF to Slack inbox
//         console.log(`Sending PDF to Slack inbox for user ${user.user_id}`);
//         const result = await slackClient.files.uploadV2({
//           channel_id: channelId,
//           filename: "weekly_fitness_report.pdf",
//           file: pdfBuffer,
//           title: "Weekly Fitness Report",
//           initial_comment:
//             "Here's your weekly fitness report. You can view it directly in Slack or download it.",
//         });

//         if (result.ok) {
//           console.log(
//             `PDF sent successfully to Slack inbox for user ${user.user_id}`
//           );
//         } else {
//           console.error(
//             `Failed to send PDF to Slack inbox for user ${user.user_id}: ${result.error}`
//           );
//         }
//       } catch (userError) {
//         console.error(`Error processing user ${user.user_id}:`, userError);
//       }
//     }
//   } catch (error) {
//     console.error("Error in runWeeklyUserReportGeneration:", error);
//   }
// }

async function runWeeklyUserReportGeneration() {
  console.log("Running weekly user report generation");
  try {
    // Ensure reports directory exists
    const reportsDir = path.join(process.cwd(), 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const [users] = await dbOps.pool.query("SELECT user_id, email, report_path FROM users");
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

        let pdfBuffer;
        let reportFilename;

        if (userMessages.length === 0) {
          console.log(`No new messages found for user ${user.user_id}`);
          if (user.report_path) {
            console.log(`Using previous report for user ${user.user_id}`);
            reportFilename = path.basename(user.report_path);
            pdfBuffer = await fs.readFile(user.report_path);
          } else {
            console.log(`No previous report found for user ${user.user_id}. Skipping.`);
            continue;
          }
        } else {
          console.log(`Generating new report for user ${user.user_id}`);
          const userProfile = await dbOps.getUserProfile(user.user_id);
          const weeklySummary = await aiOps.generateUserWeeklySummary(
            userMessages, userProfile
          );
          console.log(`Storing summary for user ${user.user_id}`);
          await dbOps.storeWeeklyUserSummary(user.user_id, weeklySummary);

          console.log(`Generating PDF for user ${user.user_id}`);
          pdfBuffer = await utils.generatePDF(weeklySummary, user.user_id, userProfile);

          reportFilename = `weekly_fitness_report_${user.user_id}_${endDate.toISOString().split('T')[0]}.pdf`;
          const newReportPath = path.join(reportsDir, reportFilename);

          // Remove old report if it exists and is different from the new one
          if (user.report_path && user.report_path !== newReportPath) {
            try {
              await fs.unlink(user.report_path);
              console.log(`Removed old report: ${user.report_path}`);
            } catch (unlinkError) {
              console.error(`Error removing old report: ${unlinkError.message}`);
            }
          }

          // Store new PDF
          await fs.writeFile(newReportPath, pdfBuffer);
          console.log(`New report stored at ${newReportPath}`);

          // Update the user's report path in the database
          await dbOps.pool.query('UPDATE users SET report_path = ? WHERE user_id = ?', [newReportPath, user.user_id]);
        }

        if (user.email) {
          console.log(`Sending email to ${user.email}`);
          await utils.sendEmail(
            user.email,
            "Your Weekly Fitness Report",
            "Please find attached your weekly fitness report.",
            [
              {
                filename: reportFilename,
                content: pdfBuffer,
                contentType: "application/pdf",
              },
            ]
          );
          console.log(`Email sent to ${user.email}`);
        } else {
          console.log(`No email found for user ${user.user_id}`);
        }

        await sendReportToSlack(user.user_id, reportFilename, pdfBuffer);

      } catch (userError) {
        console.error(`Error processing user ${user.user_id}:`, userError);
      }
    }
  } catch (error) {
    console.error("Error in runWeeklyUserReportGeneration:", error);
  }
}

async function sendReportToSlack(userId, filename, pdfBuffer) {
  try {
    const conversationResponse = await slackClient.conversations.open({
      users: userId,
    });

    if (!conversationResponse.ok) {
      throw new Error(`Failed to open conversation: ${conversationResponse.error}`);
    }

    const channelId = conversationResponse.channel.id;

    // Send PDF to Slack inbox
    console.log(`Sending PDF to Slack inbox for user ${userId}`);
    const result = await slackClient.files.uploadV2({
      channel_id: channelId,
      filename: filename,
      file: pdfBuffer,
      title: "Weekly Fitness Report",
      initial_comment:
        "Here's your weekly fitness report. You can view it directly in Slack or download it.",
    });

    if (result.ok) {
      console.log(`PDF sent successfully to Slack inbox for user ${userId}`);
    } else {
      console.error(`Failed to send PDF to Slack inbox for user ${userId}: ${result.error}`);
    }
  } catch (error) {
    console.error(`Error sending report to Slack for user ${userId}:`, error);
  }
}

// This function can be used for the /generate-report command
async function generateUserReport(userId, forceGenerate = false) {
  console.log(`Generating report for user ${userId}`);
  try {
    const reportsDir = path.join(process.cwd(), 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const [[user]] = await dbOps.pool.query("SELECT user_id, email, report_path FROM users WHERE user_id = ?", [userId]);
    if (!user) {
      console.log(`User ${userId} not found`);
      return null;
    }

    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    const userMessages = await dbOps.getUserMessages(userId, startDate, endDate);

    let pdfBuffer;
    let reportFilename;

    if (userMessages.length === 0 && !forceGenerate) {
      console.log(`No new messages found for user ${userId}`);
      if (user.report_path) {
        console.log(`Using previous report for user ${userId}`);
        reportFilename = path.basename(user.report_path);
        pdfBuffer = await fs.readFile(user.report_path);
      } else {
        console.log(`No previous report found for user ${userId}. Skipping.`);
        return null;
      }
    } else {
      console.log(`Generating new report for user ${userId}`);
      const userProfile = await dbOps.getUserProfile(userId);
      const weeklySummary = await aiOps.generateUserWeeklySummary(userMessages, userProfile);
      console.log(`Storing summary for user ${userId}`);
      await dbOps.storeWeeklyUserSummary(userId, weeklySummary);

      console.log(`Generating PDF for user ${userId}`);
      pdfBuffer = await utils.generatePDF(weeklySummary, userId, userProfile);

      reportFilename = `weekly_fitness_report_${userId}_${endDate.toISOString().split('T')[0]}.pdf`;
      const newReportPath = path.join(reportsDir, reportFilename);

      // Remove old report if it exists and is different from the new one
      if (user.report_path && user.report_path !== newReportPath) {
        try {
          await fs.unlink(user.report_path);
          console.log(`Removed old report: ${user.report_path}`);
        } catch (unlinkError) {
          console.error(`Error removing old report: ${unlinkError.message}`);
        }
      }

      // Store new PDF
      await fs.writeFile(newReportPath, pdfBuffer);
      console.log(`New report stored at ${newReportPath}`);

      // Update the user's report path in the database
      await dbOps.pool.query('UPDATE users SET report_path = ? WHERE user_id = ?', [newReportPath, userId]);
    }

    return { filename: reportFilename, buffer: pdfBuffer };
  } catch (error) {
    console.error(`Error generating report for user ${userId}:`, error);
    return null;
  }
}
async function checkAndNotifyInactiveUsers() {
  console.log("Checking for inactive users");
  try {
    const [inactiveUsers] = await dbOps.pool.query(`
      SELECT DISTINCT u.user_id, u.email
      FROM users u
      LEFT JOIN messages m ON u.user_id = m.user_id
      WHERE m.created_at < NOW() - INTERVAL 24 HOUR OR m.created_at IS NULL
    `);

    console.log("Inactive User: ", inactiveUsers);


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

    }
  } catch (error) {
    console.error("Error in checkAndNotifyInactiveUsers:", error);
  }
}

async function checkAndNotifyInactiveUsers() {
  console.log("Checking for inactive users");
  try {
    const [inactiveUsers] = await dbOps.pool.query(`
      SELECT DISTINCT u.user_id, u.email, u.momentum_score, 
             DATEDIFF(NOW(), COALESCE(MAX(m.created_at), u.created_at)) AS days_inactive
      FROM users u
      LEFT JOIN messages m ON u.user_id = m.user_id AND m.is_log = 1
      WHERE m.created_at < NOW() - INTERVAL 24 HOUR OR m.created_at IS NULL
      GROUP BY u.user_id, u.email, u.momentum_score
    `);

    console.log("Inactive Users: ", inactiveUsers);

    if (inactiveUsers.length === 0) {
      console.log('No inactive users found.');
      return;
    }

    // Fetch all motivation messages
    const [motivations] = await dbOps.pool.query(`
      SELECT message_text FROM motivational_messages
    `);

    for (const user of inactiveUsers) {
      console.log(`Sending notification to inactive user: ${user.user_id}`);

      // Calculate lost points
      const lostPoints = (user.days_inactive * (user.days_inactive - 1)) / 2;

      // Select a random motivation message
      const randomIndex = Math.floor(Math.random() * motivations.length);
      const motivationalMessage = motivations[randomIndex]?.message_text || "Don't forget to log your workouts!";

      try {
        const conversationResponse = await slackClient.conversations.open({
          users: user.user_id,
        });

        if (!conversationResponse.ok) {
          throw new Error(`Failed to open conversation: ${conversationResponse.error}`);
        }

        const channelId = conversationResponse.channel.id;

        const message = `Hey there! We noticed you haven't logged a workout in ${user.days_inactive} days. 
          You've lost ${lostPoints} momentum points. 😟

          Your current momentum score is ${user.momentum_score}.

          ${motivationalMessage}

          Log your next workout to start rebuilding your streak and regain those lost points!`;

        await slackClient.chat.postMessage({
          channel: channelId,
          text: message,
        });

        console.log(`Notification sent to user ${user.user_id} via Slack`);
      } catch (slackError) {
        console.error(`Error sending Slack notification to user ${user.user_id}:`, JSON.stringify(slackError, null, 2));
      }
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
  // Run hourly chat summarization
  cron.schedule("30 * * * *", runHourlyChatSummarization);

  // Run weekly user report generation at 5:30 AM IST every Monday
  cron.schedule("0 5 * * 1", runWeeklyUserReportGeneration);
  // cron.schedule("* * * * *", runWeeklyUserReportGeneration);


  // Check and notify inactive users at 5:30 PM IST daily
  cron.schedule("0 17 * * *", checkAndNotifyInactiveUsers);

  // Check and send customized nutrition plans at 9:30 AM IST every Monday
  cron.schedule("0 9 * * 1", checkAndSendCustomizedNutritionPlans);

  // Check and send customized exercise plans at 9:30 AM IST every Monday
  cron.schedule("0 9 * * 1", checkAndSendCustomizedExercisePlans);
  // cron.schedule("* * * * *", checkAndSendCustomizedExercisePlans);

}

module.exports = {runWeeklyUserReportGeneration, generateUserReport, init };
