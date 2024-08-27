// subscriptionLogic.js
async function startSubscriptionQuestionnaire(client, channel, user) {
  console.log("main yaha pahooch gaya question pooch");
  const questions = [
    {
      text: "Would you like to subscribe to our weekly nutrition plan based on your profile?",
      callback_id: "nutrition_subscription"
    },
    {
      text: "Would you like to subscribe to our weekly exercise plan based on your profile?",
      callback_id: "exercise_subscription"
    },
    {
      text: "Would you like to download your subscribed plan now?",
      callback_id: "download_plan"
    }
  ];

  for (const question of questions) {
    await askQuestion(client, channel, user, question);
  }
}

async function askQuestion(client, channel, user, question) {
  const message = {
    text: question.text,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: question.text
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Yes"
            },
            value: "yes",
            action_id: `${question.callback_id}_yes`
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "No"
            },
            value: "no",
            action_id: `${question.callback_id}_no`
          }
        ]
      }
    ]
  };

  await client.chat.postMessage({
    channel,
    ...message,
  });
}

module.exports = { startSubscriptionQuestionnaire, askQuestion };
