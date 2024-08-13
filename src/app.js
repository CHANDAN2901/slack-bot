const { App, ExpressReceiver } = require('@slack/bolt');
const config = require('./config');
const utils = require('./utils');
const slackEvents = require('./slackEvents');
const slackCommands = require('./slackCommands');
const cronJobs = require('./cron');
const formLogic = require('./formLogic');

const receiver = new ExpressReceiver({
  signingSecret: config.SLACK_SIGNING_SECRET,
  endpoints: '/slack/events',
  logger: console,
});

const app = new App({
  token: config.SLACK_BOT_TOKEN,
  receiver,
});

// Initialize event handlers, command handlers, and cron jobs
slackEvents.init(app);
slackCommands.init(app);
cronJobs.init(app);

// Handle Part 1 submission
app.view('user_details_part_one', async ({ ack, body, view, client }) => {
  try {
    const result = await formLogic.handlePartOneSubmission(client, body, view);
    await ack(result);
  } catch (error) {
    console.error('Error handling Part One submission:', error);
    await ack({
      response_action: "errors",
      errors: { general: "An unexpected error occurred. Please try again." }
    });
  }
});

// Handle Part 2 submission
app.view('user_details_part_two', async ({ ack, body, view, client }) => {
  await ack();
  try {
    await formLogic.handlePartTwoSubmission(client, body, view);
  } catch (error) {
    console.error('Error handling Part Two submission:', error);
    await client.chat.postMessage({
      channel: body.user.id,
      text: "There was an error processing your submission. Please try again later."
    });
  }
});

// Start the app
(async () => {
  try {
    const botInfo = await utils.getBotInfo(app);
    if (!botInfo) {
      throw new Error('Failed to get bot info');
    }

    await app.start(config.PORT || 8080);
    console.log(`⚡️ Fitness Slack bot is running with optimized interactions! Bot User ID: ${botInfo.botUserId}, Bot Name: ${botInfo.botName}`);
  } catch (error) {
    console.error('Failed to start app:', error);
  }
})();