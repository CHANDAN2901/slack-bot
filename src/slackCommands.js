//slackCommand.js
const { runWeeklyUserReportGeneration } = require('./utils');
const dbOps = require('./database').dbOps;
const fs = require('fs').promises;
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const access = promisify(fs.access);
const path = require('path');
const formLogic = require('./formLogic');
const utils = require("./utils");
const { ChromaClient } = require('chromadb');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('./config');
const { startSubscriptionQuestionnaire, askQuestion } = require('./subscriptionLogic');
const cron = require('./cron');

// Initialize the Google AI model
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

async function queryChromaDBAndGenerateResponse(query) {
  try {
    const client = new ChromaClient({ path: "https://chroma-latest-gzr9.onrender.com" })
    const collection = await client.getOrCreateCollection({
      name: "my_collection",
    });

    const results = await collection.query({
      queryTexts: [query],
      nResults: 4,
    });

    // console.log(results);

    if (results.documents.length === 0) {
      // No relevant documents found
      return "I'm sorry, but I couldn't find any information related to your query. Can you please provide more details or ask a different question?";
    }

    const prompt = `As a customer support representative, provide a helpful and friendly response based on the documents received from my RAG model.
    Here are the document results: Document: ${results.documents}. The user has asked the following question: "${query}". Based on the 
    document and available information, construct a relevant and accurate response to the user's query. If the document doesn't directly
    answer the query, politely explain what the document covers related to the query in human language.`

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return response.text();
  } catch (error) {
    console.error('Error in queryChromaDBAndGenerateResponse:', error);
    throw error; // Re-throw the error to be caught by the calling function
  }
}

function init(app) {
  console.log('Initializing command handlers...');
  app.command('/clear', async ({ command, ack, respond }) => {
    try {
      console.log('Received /clear command:', command);
      await ack();

      // Clear the context for the current user
      await dbOps.clearUserContext(command.user_id);

      await respond({
        response_type: 'ephemeral',
        text: 'Your conversation context has been cleared and saved to the database.'
      });
    } catch (error) {
      console.error('Error handling /clear command:', error);
      await respond({
        response_type: 'ephemeral',
        text: 'An error occurred while clearing your context. Please try again later.'
      });
    }
  });

  app.command('/update-profile', async ({ ack, body, client }) => {
    await ack();
    try {
      console.log('Received /update-profile command. Body:', JSON.stringify(body, null, 2));
      await formLogic.handleUserDetailsCommand(client, body);
    } catch (error) {
      console.error('Error handling /update-profile command:', error);
      // Send an error message to the user
      try {
        await client.chat.postEphemeral({
          channel: body.channel_id,
          user: body.user_id,
          text: "Sorry, there was an error processing your command. Please try again later or contact support if the issue persists."
        });
      } catch (sendError) {
        console.error('Error sending error message to user:', sendError);
      }
    }
  });

  app.command('/supporthub', async ({ command, ack, respond, client }) => {
    // Acknowledge the command immediately
    await ack();

    try {
      // Inform the user that their query is being processed
      await respond({
        response_type: 'ephemeral',
        text: 'Processing your request. This may take a moment...'
      });

      // Here, implement the logic for the /supporthub command
      // This could involve querying ChromaDB or other time-consuming operations
      const result = await queryChromaDBAndGenerateResponse(command.text);

      // Send the final response
      await client.chat.postMessage({
        channel: command.channel_id,
        text: `Here's the information from our support hub:\n\n${result}`,
      });

    } catch (error) {
      console.error('Error handling /supporthub command:', error);
      await client.chat.postMessage({
        channel: command.channel_id,
        text: 'An error occurred while processing your request. Please try again later.',
      });
    }
  });

  app.command('/log', async ({ command, ack, respond, client }) => {
    // Acknowledge the command immediately
    await ack();

    try {
      const { user_id, channel_id, text } = command;
      console.log("Command and channel details: ", command);

      if (!text) {
        await respond({
          response_type: 'ephemeral',
          text: 'Please provide your exercise log after the /log command.'
        });
        return;
      }

      // Calculate streak and points (this now includes storing the exercise log)
      const { streak, points, totalPoints, reaction } = await calculateStreakAndPoints(user_id);

      // Respond to the user
      await respond({
        response_type: 'in_channel',
        text: `Exercise log recorded: ${text}\n\nGreat job on staying active! 💪`
      });

      // Send a message with streak and points information
      const userInfo = await client.users.info({ user: user_id });
      const username = userInfo.user.real_name || userInfo.user.name;

      await client.chat.postMessage({
        channel: channel_id,
        text: `Way to go, ${username}! 🎉 ${reaction}\n\n` +
          `🔥 Your current streak: ${streak} days\n` +
          `✨ Points earned today: ${points}\n` +
          `🏆 Total momentum score: ${totalPoints}\n\n` +
          `Keep up the fantastic work! Consistency is key to reaching your fitness goals.`,
        thread_ts: command.ts
      });

    } catch (error) {
      console.error('Error handling /log command:', error);
      await respond({
        response_type: 'ephemeral',
        text: 'An error occurred while logging your exercise. Please try again later.'
      });
    }
  });

  app.command('/nutritionplan', async ({ command, ack, respond, client }) => {
    await ack();
    await handlePlanCommand(command, respond, client, 'nutrition');
  });

  app.command('/exerciseplan', async ({ command, ack, respond, client }) => {
    await ack();
    await handlePlanCommand(command, respond, client, 'exercise');
  });

  // app.command('/generate-report', async ({ command, ack, respond, client }) => {
  //   await ack();
  //   const { user_id, channel_id } = command;

  //   try {
  //     const [user] = await dbOps.pool.query('SELECT report_path FROM users WHERE user_id = ?', [user_id]);
  //     let reportPath = user[0] ? user[0].report_path : null;

  //     if (reportPath) {
  //       try {
  //         await access(reportPath, fs.constants.R_OK);
  //         const file = await readFile(reportPath);
  //         await client.files.uploadV2({
  //           channel_id: channel_id,
  //           filename: path.basename(reportPath),
  //           file: file,
  //           title: "Weekly Fitness Report",
  //           initial_comment: "Here's your latest weekly fitness report.",
  //         });
  //       } catch (error) {
  //         console.error(`Error accessing or uploading report: ${error.message}`);
  //         await respond({
  //           response_type: 'ephemeral',
  //           text: "Your report is not available. Generating a new one..."
  //         });
  //         reportPath = await cron.runWeeklyUserReportGeneration(user_id);  // Wait for the new report path
  //         if (reportPath) {
  //           const newFile = await readFile(reportPath);
  //           await client.files.uploadV2({
  //             channel_id: channel_id,
  //             filename: path.basename(reportPath),
  //             file: newFile,
  //             title: "Weekly Fitness Report",
  //             initial_comment: "Here's your latest weekly fitness report.",
  //           });
  //         } else {
  //           await respond({
  //             response_type: 'ephemeral',
  //             text: 'An error occurred while generating the report. Please try again later.'
  //           });
  //         }
  //       }
  //     } else {
  //       await respond({
  //         response_type: 'ephemeral',
  //         text: "Generating your report. This may take a moment..."
  //       });
  //       reportPath = await cron.runWeeklyUserReportGeneration(user_id);  // Wait for the new report path
  //       if (reportPath) {
  //         const newFile = await readFile(reportPath);
  //         await client.files.uploadV2({
  //           channel_id: channel_id,
  //           filename: path.basename(reportPath),
  //           file: newFile,
  //           title: "Weekly Fitness Report",
  //           initial_comment: "Here's your latest weekly fitness report.",
  //         });
  //       } else {
  //         await respond({
  //           response_type: 'ephemeral',
  //           text: 'An error occurred while generating the report. Please try again later.'
  //         });
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Error handling /generate-report command:', error);
  //     await respond({
  //       response_type: 'ephemeral',
  //       text: 'An error occurred while processing your report. Please try again later.'
  //     });
  //   }
  // });

 
app.command('/generate-report', async ({ command, ack, respond, client }) => {
  await ack();
  const { user_id, channel_id } = command;

  try {
    await respond({
      response_type: 'ephemeral',
      text: "Fetching your report. This may take a moment..."
    });

    // First, check if a report already exists
    const [[user]] = await dbOps.pool.query("SELECT report_path FROM users WHERE user_id = ?", [user_id]);
    let report = null;

    if (user && user.report_path) {
      try {
        const reportBuffer = await fs.readFile(user.report_path);
        report = {
          filename: path.basename(user.report_path),
          buffer: reportBuffer
        };
        console.log(`Existing report found for user ${user_id}`);
      } catch (readError) {
        console.error(`Error reading existing report for user ${user_id}:`, readError);
        // If there's an error reading the existing report, we'll generate a new one
      }
    }

    // If no existing report was found or couldn't be read, generate a new one
    if (!report) {
      console.log(`No existing report found for user ${user_id}. Generating new report.`);
      report = await cron.generateUserReport(user_id, true);
    }

    if (report && report.buffer) {
      await client.files.uploadV2({
        channel_id: channel_id,
        filename: report.filename,
        file: report.buffer,
        title: "Weekly Fitness Report",
        initial_comment: "Here's your latest weekly fitness report.",
      });
    } else {
      throw new Error('Report generation failed or resulted in an empty report');
    }
  } catch (error) {
    console.error('Error handling /generate-report command:', error);
    await respond({
      response_type: 'ephemeral',
      text: 'An error occurred while processing your report. Please try again later.'
    });
  }
});

  async function calculateStreakAndPoints(userId) {
    try {
      // Fetch the user's updated information
      const [userInfo] = await dbOps.pool.query('SELECT current_streak, max_streak, momentum_score FROM users WHERE user_id = ?', [userId]);

      if (!userInfo || userInfo.length === 0) {
        throw new Error('User information not found');
      }

      const { current_streak, momentum_score } = userInfo[0];

      // Calculate points earned today (assuming it's the same as the current streak)
      const pointsToday = current_streak;

      // Generate a custom reaction based on the streak
      let reaction;
      if (current_streak < 3) {
        reaction = "You're off to a great start!";
      } else if (current_streak < 7) {
        reaction = "You're building momentum!";
      } else if (current_streak < 14) {
        reaction = "You're on fire! Keep it up!";
      } else if (current_streak < 30) {
        reaction = "Incredible dedication! You're unstoppable!";
      } else {
        reaction = "You're a fitness legend! Absolutely phenomenal!";
      }

      return {
        streak: current_streak,
        points: pointsToday,
        totalPoints: momentum_score,
        reaction
      };
    } catch (error) {
      console.error('Error in calculateStreakAndPoints:', error);
      throw error;
    }
  }

  async function handlePlanCommand(command, respond, client, planType) {
    const { user_id, channel_id } = command;

    try {
      const [results] = await dbOps.pool.query(
        `SELECT u.nutrition_subscription, u.exercise_subscription, p.workout_plan_path, p.nutrition_plan_path 
         FROM users u
         LEFT JOIN plans p ON u.user_id = p.user_id
         WHERE u.user_id = ?`,
        [user_id]
      );

      if (results.length === 0) {
        await respond({
          response_type: 'ephemeral',
          text: "We couldn't find your user profile. Please make sure you've set up your account."
        });
        return;
      }

      const isSubscribedToNutrition = results[0]['nutrition_subscription'] === 1;
      const isSubscribedToExercise = results[0]['exercise_subscription'] === 1;
      const workoutPlanPath = results[0]['workout_plan_path'];
      const nutritionPlanPath = results[0]['nutrition_plan_path'];

      let isSubscribed, planPath;
      if (planType === 'nutrition') {
        isSubscribed = isSubscribedToNutrition;
        planPath = nutritionPlanPath;
      } else if (planType === 'exercise') {
        isSubscribed = isSubscribedToExercise;
        planPath = workoutPlanPath;
      }

      if (isSubscribed) {
        if (planPath && fs.existsSync(planPath)) {
          await utils.sendDirectMessageWithAttachment(user_id, `Here's your latest ${planType} plan:`, planPath);
          await respond({
            response_type: 'ephemeral',
            text: `Your ${planType} plan has been sent to you in a direct message.`
          });
        } else {
          await generateAndSendPlan(user_id, channel_id, client, planType);
        }
      } else {
        // Subscription prompt logic (unchanged)
        await respond({
          response_type: 'ephemeral',
          text: `You're not currently subscribed to our ${planType} plan. Let's see if you'd like to subscribe.`
        });

        if (!isSubscribedToNutrition) {
          await askQuestion(client, channel_id, user_id, {
            text: "Would you like to subscribe to our weekly nutrition plan based on your profile?",
            callback_id: "nutrition_subscription"
          });
        }

        if (!isSubscribedToExercise) {
          await askQuestion(client, channel_id, user_id, {
            text: "Would you like to subscribe to our weekly exercise plan based on your profile?",
            callback_id: "exercise_subscription"
          });
        }
      }
    } catch (error) {
      console.error(`Error handling /${planType}Plan command:`, error);
      await respond({
        response_type: 'ephemeral',
        text: `An error occurred while processing your ${planType} plan request. Please try again later.`
      });
    }
  }

  async function generateAndSendPlan(userId, channelId, client, planType) {
    try {
      let plan;
      if (planType === 'nutrition') {
        await utils.sendCustomizedNutritionPlan(userId);
      } else {
        await utils.sendCustomizedExercisePlan(userId);
      }

      await client.chat.postMessage({
        channel: channelId,
        text: `Here's your customized  plan:`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Check your DM for your plan`
            }
          },

        ]
      });
    } catch (error) {
      console.error(`Error generating and sending plan:`, error);
    }
  }

  // async function handlePlanCommand(command, respond, client, planType) {
  //   const { user_id, channel_id } = command;

  //   try {
  //     const [results] = await dbOps.pool.query(
  //       `SELECT ${planType}_subscription FROM users WHERE user_id = ?`,
  //       [user_id]
  //     );

  //     if (results.length === 0) {
  //       await respond({
  //         response_type: 'ephemeral',
  //         text: "We couldn't find your user profile. Please make sure you've set up your account."
  //       });
  //       return;
  //     }

  //     const isSubscribed = results[0][`${planType}_subscription`] === 1;

  //     if (isSubscribed) {
  //       // User is subscribed, generate and send the plan
  //       await generateAndSendPlan(user_id, channel_id, client, planType);
  //     } else {
  //       // User is not subscribed, start the subscription questionnaire
  //       await respond({
  //         response_type: 'ephemeral',
  //         text: `You're not currently subscribed to our ${planType} plan. Let's see if you'd like to subscribe.`
  //       });
  //       console.log("channel ID: ",channel_id);
  //       console.log("user ID: ",user_id);


  //       await startSubscriptionQuestionnaire(client, channel_id, user_id);
  //     }
  //   } catch (error) {
  //     console.error(`Error handling /${planType}Plan command:`, error);
  //     await respond({
  //       response_type: 'ephemeral',
  //       text: `An error occurred while processing your ${planType} plan request. Please try again later.`
  //     });
  //   }
  // }
}

module.exports = { init };