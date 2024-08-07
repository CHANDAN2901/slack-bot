const dbOps = require('./database').dbOps;

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
}

module.exports = { init };