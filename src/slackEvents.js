// const dbOps = require("./database").dbOps;
// const aiOps = require("./ai");
// const utils = require("./utils");
// const formLogic = require('./formLogic');


// function init(app) {
//   app.event("app_mention", async ({ event, context, client }) => {
//     console.log("Received potential app mention:", event);

//     if (!utils.isBotMentioned(event.text)) {
//       console.log("Bot not mentioned, ignoring.");
//       return;
//     }

//     try {
//       // Start typing indicator
//       const typingIndicator = await client.chat.postMessage({
//         channel: event.channel,
//         text: "",
//         blocks: [
//           {
//             type: "context",
//             elements: [
//               {
//                 type: "mrkdwn",
//                 text: ":hourglass: Typing...",
//               },
//             ],
//           },
//         ],
//       });

//       // Check message length
//       if (event.text.length > 2000) {
//         await client.chat.postMessage({
//           channel: event.channel,
//           text: `<@${event.user}> Your message exceeds the 2000 character limit. Please shorten your query and try again.`,
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
//         if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
//           analysisResult = await aiOps.analyzeImage(fileBuffer, file.mimetype);
//           messageContent += `\n\nImage Content:\n${analysisResult}`;
//         } else if (file.mimetype === "application/pdf") {
//           analysisResult = await aiOps.analyzePDF(fileBuffer);
//           messageContent += `\n\nPDF Content:\n${analysisResult}`;
//         }
//       }

//       // Fetch the last 5 messages for context
//       let userContext = await dbOps.getLastMessages(event.channel, 5);

//       // Check if the message is related to the context
//       const contextRelevance = await aiOps.checkMessageContext(messageContent, userContext);

//       let response;
//       let shouldStoreMessage = false;

//       if (contextRelevance === "related") {
//         // If the message is related to the context, generate a response directly
//         response = await aiOps.generateResponse(messageContent, userContext);
//         shouldStoreMessage = true;
//       } else {
//         // If it's a new topic, classify and proceed
//         const messageType = await aiOps.classifyMessage(messageContent);

//         if (messageType === "greeting") {
//           response = utils.generateGreeting(username);
//           // Don't store greetings
//         } else if (messageType === "fitness_related" || messageType === "health_related") {
//           response = await aiOps.generateResponse(messageContent, userContext);
//           shouldStoreMessage = true;
//         } else {
//           response = "I'm sorry, but I can only assist with health and fitness related queries. Is there anything specific about health or fitness you'd like to know?";
//           // Don't store off-topic messages
//         }
//       }

//       // Store the message only if it's relevant
//       if (shouldStoreMessage) {
//         await dbOps.storeMessage(event.user, event.channel, messageContent);
//       }

//       // Truncate response if it exceeds 2000 characters
//       const truncatedResponse = response.length > 2500 ? response.slice(0, 997) + "..." : response;

//       // Stop typing indicator and send the response
//       await client.chat.update({
//         channel: event.channel,
//         ts: typingIndicator.ts,
//         text: `<@${event.user}> ${truncatedResponse}`,
//         parse: "mrkdwn", // This tells Slack to parse the markup
//         blocks: [],
//       });
//     } catch (error) {
//       console.error("Error processing message:", error);
//       await client.chat.postMessage({
//         channel: event.channel,
//         text: `<@${event.user}> I'm sorry, but I encountered an error while processing your message. Please try again later.`,
//       });
//     }
//   });

//   app.event("member_joined_channel", async ({ event, client }) => {
//     const { user, channel } = event;

//     try {
//       // Fetch user info
//       const { name: username } = await utils.fetchUserInfo(app, user);

//       // Construct the welcome message with a button
//       const welcomeMessage = {
//         text: `Welcome <@${user}> to the channel! I'm your fitness assistant bot. Here's what I can do for you:
//         \n- Track your fitness-related data
//         \n- Help plan exercises based on your profile
//         \n- Provide personalized nutrition plans
//         \n- Answer any fitness-related queries you might have. 
//         \nTo get personalized recommendations and answers, please fill out the form below.`,
//         blocks: [
//           {
//             type: "section",
//             text: {
//               type: "mrkdwn",
//               text: `Welcome <@${user}> to the channel! I'm your fitness assistant bot. Here's what I can do for you:
//               \n- Track your fitness-related data
//               \n- Help plan exercises based on your profile
//               \n- Provide personalized nutrition plans
//               \n- Answer any fitness-related queries you might have. 
//               \nTo get personalized recommendations and answers, please fill out the form below.`
//             }
//           },
//           {
//             type: "actions",
//             elements: [
//               {
//                 type: "button",
//                 text: {
//                   type: "plain_text",
//                   text: "Fill out the form"
//                 },
//                 action_id: "user_details"
//               }
//             ]
//           }
//         ]
//       };

//       // Send the welcome message with the button
//       await client.chat.postMessage({
//         channel,
//         ...welcomeMessage,
//       });
//     } catch (error) {
//       console.error("Error sending welcome message:", error);
//       await client.chat.postMessage({
//         channel: channel,
//         text: `Hi <@${user}>! I’m sorry, but there was an issue sending a welcome message. Please reach out if you need any help.`,
//       });
//     }
//   });

//   app.action('user_details', async ({ ack, body, client }) => {
//     console.log('Action received: user_details');

//     // Acknowledge the action immediately and only once
//     await ack();
//     console.log('Action acknowledged');

//     try {
//       console.log('Attempting to open modal');
//       await formLogic.handleUserDetailsCommand(client, body);
//       console.log('Modal opened successfully');
//     } catch (error) {
//       console.error('Error handling user details button click:', error);
//     }
//   });
// }

// module.exports = { init };



const dbOps = require("./database").dbOps;
const aiOps = require("./ai");
const utils = require("./utils");
const formLogic = require('./formLogic');

async function showTypingIndicator(client, channel) {
  return await client.chat.postMessage({
    channel: channel,
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
}

function init(app) {

  app.event('message', async ({ event, client }) => {
    // Check if it's a direct message (im = direct message channel type)
    if (event.channel_type === 'im') {
      try {
        const typingIndicator = await showTypingIndicator(client, event.channel);

        // Process the message similarly to how you process mentions
        // const { name: username, email } = await utils.fetchUserInfo(app, event.user);
        const userProfile = await dbOps.getCachedUserProfile(event.user);
        const userContext = await dbOps.getLastMessages(event.channel, 5);

        // Generate response
        const response = await aiOps.generateResponse(event.text, userContext, userProfile);

        // Send the response
        await client.chat.postMessage({
          channel: event.channel,
          ts: typingIndicator.ts,
          text: response,
          parse: "mrkdwn",
          blocks: [],
        });

        // Store the message
        await dbOps.storeMessage(event.user, event.channel, event.text);
      } catch (error) {
        console.error("Error processing direct message:", error);
      }
    }
  });

  app.event("app_mention", async ({ event, context, client }) => {
    console.log("Received potential app mention:", event);

    if (!utils.isBotMentioned(event.text)) {
      console.log("Bot not mentioned, ignoring.");
      return;
    }

    try {
      const typingIndicator = await showTypingIndicator(client, event.channel);

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

      // Fetch user profile
      const userProfile = await dbOps.getCachedUserProfile(event.user);

      let response;
      let shouldStoreMessage = false;

      if (contextRelevance === "related") {
        // If the message is related to the context, generate a response directly
        response = await aiOps.generateResponse(messageContent, userContext, userProfile);
        shouldStoreMessage = true;
      } else {
        // If it's a new topic, classify and proceed
        const messageType = await aiOps.classifyMessage(messageContent);

        if (messageType === "greeting") {
          response = utils.generateGreeting(username);
          // Don't store greetings
        } else if (messageType === "fitness_related" || messageType === "health_related") {
          response = await aiOps.generateResponse(messageContent, userContext, userProfile);
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
      const truncatedResponse = response.length > 2500 ? response.slice(0, 997) + "..." : response;

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

  // app.event("member_joined_channel", async ({ event, client }) => {
  //   const { user, channel } = event;

  //   try {
  //     // Fetch user info
  //     const { name: username } = await utils.fetchUserInfo(app, user);

  //     // Construct the welcome message with a button
  //     const welcomeMessage = {
  //       text: `Welcome <@${user}> to the channel! I'm your fitness assistant bot. Here's what I can do for you:
  //       \n- Track your fitness-related data
  //       \n- Help plan exercises based on your profile
  //       \n- Provide personalized nutrition plans
  //       \n- Answer any fitness-related queries you might have. 
  //       \nTo get personalized recommendations and answers, please fill out the form below.`,
  //       blocks: [
  //         {
  //           type: "section",
  //           text: {
  //             type: "mrkdwn",
  //             text: `Welcome <@${user}> to the channel! I'm your fitness assistant bot. Here's what I can do for you:
  //             \n- Track your fitness-related data
  //             \n- Help plan exercises based on your profile
  //             \n- Provide personalized nutrition plans
  //             \n- Answer any fitness-related queries you might have. 
  //             \nTo get personalized recommendations and answers, please fill out the form below.`
  //           }
  //         },
  //         {
  //           type: "actions",
  //           elements: [
  //             {
  //               type: "button",
  //               text: {
  //                 type: "plain_text",
  //                 text: "Fill out the form"
  //               },
  //               action_id: "user_details"
  //             }
  //           ]
  //         }
  //       ]
  //     };

  //     // Send the welcome message with the button
  //     await client.chat.postMessage({
  //       channel,
  //       ...welcomeMessage,
  //     });
  //   } catch (error) {
  //     console.error("Error sending welcome message:", error);
  //     await client.chat.postMessage({
  //       channel: channel,
  //       text: `Hi <@${user}>! I'm sorry, but there was an issue sending a welcome message. Please reach out if you need any help.`,
  //     });
  //   }
  // });

  app.event("member_joined_channel", async ({ event, client }) => {
    const { user, channel } = event;

    try {
      // Welcome message for the main channel
      const channelWelcomeMessage = {
        text: `Welcome <@${user}> to the channel! I'm FitnessGuru, your fitness assistant bot.`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Welcome <@${user}> to the channel! I'm FitnessGuru, your fitness assistant bot. I've sent you a DM with more information about how I can help you on your fitness journey.`
            }
          }
        ]
      };

      // Detailed welcome message for DM
      const dmWelcomeMessage = {
        text: `Welcome to FitnessGuru! I'm here to help you with your fitness goals.`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Welcome to FitnessGuru! I'm your personal fitness assistant bot. Here's what I can do for you:
              \n• Track your fitness-related data
              \n• Help plan exercises based on your profile
              \n• Provide personalized nutrition plans
              \n• Answer any fitness-related queries you might have`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Here are some commands you can use:
              \n• \`/update-profile\`: Open the user details form
              \n• \`/log\`: Log your daily exercise
              \n• \`/clear\`: Clear your conversation history
              \n• \`/supporthub\`: Find answers to common questions`
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Fill Out the Form"
                },
                action_id: "user_details"
              }
            ]
          }
        ]
      };

      // Send welcome message to the main channel
      await client.chat.postMessage({
        channel: channel,
        ...channelWelcomeMessage,
      });

      // Send detailed welcome message as a DM
      await client.chat.postMessage({
        channel: user,
        ...dmWelcomeMessage,
      });
    } catch (error) {
      console.error("Error sending welcome messages:", error);
      // Consider logging this error to a monitoring system
    }
  });

  app.action('user_details', async ({ ack, body, client }) => {
    console.log('Action received: user_details');

    // Acknowledge the action immediately and only once
    await ack();
    console.log('Action acknowledged');

    try {
      console.log('Attempting to open modal');
      await formLogic.handleUserDetailsCommand(client, body);
      console.log('Modal opened successfully');
    } catch (error) {
      console.error('Error handling user details button click:', error);
      // You might want to send a message to the user here informing them of the error
    }
  });

  app.action(/^(nutrition|exercise)_subscription_(yes|no)$/, async ({ body, ack, client, action }) => {
    await ack();

    // Correctly split the action_id
    const parts = action.action_id.split('_');
    const subscriptionType = parts[0]; // First word
    const response = parts[2]; // Third word

    console.log('Split Action ID:', { subscriptionType, response });

    const userId = body.user.id;
    const isSubscribed = response === 'yes';

    console.log('User ID:', userId);
    console.log('Is Subscribed:', isSubscribed);

    try {
      // Make sure the column names in the database match
      await dbOps.updateUserSubscription(userId, subscriptionType, isSubscribed);

      const confirmationText = isSubscribed
        ? `Great! You've subscribed to the ${subscriptionType} plan.`
        : `No problem. You can always subscribe to the ${subscriptionType} plan later if you change your mind.`;

      await client.chat.postMessage({
        channel: body.channel.id,
        text: confirmationText,
      });
    } catch (error) {
      console.error(`Error updating ${subscriptionType} subscription for user ${userId}:`, error);
    }
  });

  app.action('download_plan_yes', async ({ body, ack, client, action }) => {
    await ack();
    await utils.handleICSDownload(client, body, action);
  });

  app.action('download_plan_no', async ({ body, ack, client, action }) => {
    await ack();
    await utils.handleICSDownload(client, body, action);
  });
}


module.exports = { init };