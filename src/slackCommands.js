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
    const client = new ChromaClient();
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

    const prompt = `As a customer support representative, provide a helpful and friendly response based on the information from the provided document.
    Here are the document results: Document: ${results.documents}. The user has asked the following question: "${query}". Based on the 
    document and available information, construct a relevant and accurate response to the user's query. If the document doesn't directly
    answer the query, politely explain what the document covers and suggest any alternative actions or information that might be helpful to the user.`

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
      await formLogic.handleUserDetailsCommand(client, body);
    } catch (error) {
      console.error('Error handling /update-profile command:', error);
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

      if (!text) {
        await respond({
          response_type: 'ephemeral',
          text: 'Please provide your exercise log after the /log command.'
        });
        return;
      }

      // Store the exercise log
      await dbOps.storeExerciseLog(user_id, channel_id, text);

      // Respond to the user
      await respond({
        response_type: 'in_channel',
        text: `Exercise log recorded: ${text}\n\nGreat job on staying active! 💪`
      });

      // You could also add some encouragement or stats here
      const userInfo = await client.users.info({ user: user_id });
      const username = userInfo.user.real_name || userInfo.user.name;

      await client.chat.postMessage({
        channel: channel_id,
        text: `Way to go, ${username}! Keep up the good work. Remember, consistency is key to reaching your fitness goals.`,
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


}

module.exports = { init };