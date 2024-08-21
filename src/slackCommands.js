const dbOps = require('./database').dbOps;
const formLogic = require('./formLogic');
const { ChromaClient } = require('chromadb');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('./config');


// Initialize the Google AI model
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

async function queryChromaDBAndGenerateResponse(query) {
  try {
    const client =  new ChromaClient({path:"https://chroma-latest-gzr9.onrender.com"})
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

  // app.command('/update-profile', async ({ ack, body, client }) => {
  //   await ack();
  //   try {
  //     await formLogic.handleUserDetailsCommand(client, body);
  //   } catch (error) {
  //     console.error('Error handling /update-profile command:', error);
  //   }
  // });

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

  // app.command('/log', async ({ command, ack, respond, client }) => {
  //   // Acknowledge the command immediately
  //   await ack();

  //   try {
  //     const { user_id, channel_id, text } = command;
  //     console.log("Commad and channel details: ", command);

  //     if (!text) {
  //       await respond({
  //         response_type: 'ephemeral',
  //         text: 'Please provide your exercise log after the /log command.'
  //       });
  //       return;
  //     }

  //     // Store the exercise log
  //     await dbOps.storeExerciseLog(user_id, channel_id, text);

  //     // Respond to the user
  //     await respond({
  //       response_type: 'in_channel',
  //       text: `Exercise log recorded: ${text}\n\nGreat job on staying active! 💪`
  //     });

  //     // You could also add some encouragement or stats here
  //     const userInfo = await client.users.info({ user: user_id });
  //     const username = userInfo.user.real_name || userInfo.user.name;

  //     await client.chat.postMessage({
  //       channel: channel_id,
  //       text: `Way to go, ${username}! Keep up the good work. Remember, consistency is key to reaching your fitness goals.`,
  //       thread_ts: command.ts
  //     });

  //   } catch (error) {
  //     console.error('Error handling /log command:', error);
  //     await respond({
  //       response_type: 'ephemeral',
  //       text: 'An error occurred while logging your exercise. Please try again later.'
  //     });
  //   }
  // });

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

}

module.exports = { init };