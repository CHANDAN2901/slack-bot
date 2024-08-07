// const dbOps = require('./database').dbOps;
// const aiOps = require('./ai');
// const utils = require('./utils');

// function init(app) {
//   app.event('app_mention', async ({ event, context }) => {
//     console.log('Received potential app mention:', event);

//     if (!utils.isBotMentioned(event.text)) {
//       console.log('Bot not mentioned, ignoring.');
//       return;
//     }

//     try {
//       // Check message length
//       if (event.text.length > 2000) {
//         await app.client.chat.postMessage({
//           token: process.env.SLACK_BOT_TOKEN,
//           channel: event.channel,
//           text: `<@${event.user}> Your message exceeds the 2000 character limit. Please shorten your query and try again.`
//         });
//         return;
//       }

//       const { name: username, email } = await utils.fetchUserInfo(app, event.user);
//       const channelName = await utils.fetchChannelInfo(app, event.channel);

//       await dbOps.storeUser(event.user, username, email);
//       await dbOps.storeChannel(event.channel, channelName);

//       let messageContent = event.text;

//       // Process files if present
//       if (event.files && event.files.length > 0) {
//         const file = event.files[0];
//         const fileBuffer = await utils.downloadFile(file.url_private);

//         let analysisResult;
//         if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
//           analysisResult = await aiOps.analyzeImage(fileBuffer, file.mimetype);
//           messageContent += `\n\nImage Content:\n${analysisResult}`;
//         } else if (file.mimetype === 'application/pdf') {
//           analysisResult = await aiOps.analyzePDF(fileBuffer);
//           messageContent += `\n\nPDF Content:\n${analysisResult}`;
//         }
//       }

//       // Classify the message
//       const messageType = await aiOps.classifyMessage(messageContent);

//       // Store the message only if it's fitness-related or health-related
//       if (messageType === 'fitness_related' || messageType === 'health_related') {
//         await dbOps.storeMessage(event.user, event.channel, messageContent);
//       }

//       // Generate and send response
//       const lastMessages = await dbOps.getLastMessages(event.channel);
//       const response = await aiOps.generateResponse(messageContent, lastMessages);

//       // Truncate response if it exceeds 2000 characters
//       const truncatedResponse = response.length > 2000 ? response.slice(0, 997) + '...' : response;

//       await app.client.chat.postMessage({
//         token: process.env.SLACK_BOT_TOKEN,
//         channel: event.channel,
//         text: `<@${event.user}> ${truncatedResponse}`
//       });

//     } catch (error) {
//       console.error('Error processing message:', error);
//       await app.client.chat.postMessage({
//         token: process.env.SLACK_BOT_TOKEN,
//         channel: event.channel,
//         text: `<@${event.user}> I'm sorry, but I encountered an error while processing your message. Please try again later.`
//       });
//     }
//   });
// }

// module.exports = { init }



const dbOps = require("./database").dbOps;
const aiOps = require("./ai");
const utils = require("./utils");

function init(app) {
  app.event("app_mention", async ({ event, context, client }) => {
    console.log("Received potential app mention:", event);
  
    if (!utils.isBotMentioned(event.text)) {
      console.log("Bot not mentioned, ignoring.");
      return;
    }
  
    try {
      // Start typing indicator
      const typingIndicator = await client.chat.postMessage({
        channel: event.channel,
        text: "",
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: ":hourglass: Typing...",
              },
            ],
          },
        ],
      });
  
      // Check message length
      if (event.text.length > 2000) {
        await client.chat.postMessage({
          channel: event.channel,
          text: `<@${event.user}> Your message exceeds the 2000 character limit. Please shorten your query and try again.`,
        });
        return;
      }
  
      const { name: username, email } = await utils.fetchUserInfo(app, event.user);
      const channelName = await utils.fetchChannelInfo(app, event.channel);
  
      await dbOps.storeUser(event.user, username, email);
      await dbOps.storeChannel(event.channel, channelName);
  
      let messageContent = event.text;
  
      // Process files if present
      if (event.files && event.files.length > 0) {
        const file = event.files[0];
        const fileBuffer = await utils.downloadFile(file.url_private);
  
        let analysisResult;
        if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
          analysisResult = await aiOps.analyzeImage(fileBuffer, file.mimetype);
          messageContent += `\n\nImage Content:\n${analysisResult}`;
        } else if (file.mimetype === "application/pdf") {
          analysisResult = await aiOps.analyzePDF(fileBuffer);
          messageContent += `\n\nPDF Content:\n${analysisResult}`;
        }
      }
  
      // Fetch the last 5 messages for context
      let userContext = await dbOps.getLastMessages(event.channel, 5);
  
      // Check if the message is related to the context
      const contextRelevance = await aiOps.checkMessageContext(messageContent, userContext);
  
      let response;
      let shouldStoreMessage = false;
  
      if (contextRelevance === "related") {
        // If the message is related to the context, generate a response directly
        response = await aiOps.generateResponse(messageContent, userContext);
        shouldStoreMessage = true;
      } else {
        // If it's a new topic, classify and proceed
        const messageType = await aiOps.classifyMessage(messageContent);
  
        if (messageType === "greeting") {
          response = utils.generateGreeting(username);
          // Don't store greetings
        } else if (messageType === "fitness_related" || messageType === "health_related") {
          response = await aiOps.generateResponse(messageContent, userContext);
          shouldStoreMessage = true;
        } else {
          response = "I'm sorry, but I can only assist with health and fitness related queries. Is there anything specific about health or fitness you'd like to know?";
          // Don't store off-topic messages
        }
      }
  
      // Store the message only if it's relevant
      if (shouldStoreMessage) {
        await dbOps.storeMessage(event.user, event.channel, messageContent);
      }
  
      // Truncate response if it exceeds 2000 characters
      const truncatedResponse = response.length > 2000 ? response.slice(0, 997) + "..." : response;
  
      // Stop typing indicator and send the response
      await client.chat.update({
        channel: event.channel,
        ts: typingIndicator.ts,
        text: `<@${event.user}> ${truncatedResponse}`,
        parse: "mrkdwn", // This tells Slack to parse the markup
        blocks: [],
      });
    } catch (error) {
      console.error("Error processing message:", error);
      await client.chat.postMessage({
        channel: event.channel,
        text: `<@${event.user}> I'm sorry, but I encountered an error while processing your message. Please try again later.`,
      });
    }
  });
}

module.exports = { init };

