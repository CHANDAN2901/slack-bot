const axios = require("axios");
const nodemailer = require("nodemailer");
const path = require('path');
const config = require("./config");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const dbOps = require("./database").dbOps;
const aiOps = require("./ai");

const { WebClient } = require("@slack/web-api");
const { SLACK_BOT_TOKEN } = require("./config");
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const { createEvents } = require('ics');

const utils = {
  botName: null,
  botUserId: null,

  downloadFile: async (url) => {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${config.SLACK_BOT_TOKEN}` },
      responseType: "arraybuffer",
    });
    return Buffer.from(response.data);
  },

  generateICSFile: (events, filename) => {
    try {
      console.log(`Generating ICS file: ${filename}`);
      console.log(`Number of events: ${events.length}`);

      // Validate events
      events = events.map(event => {
        if (!event.start || !Array.isArray(event.start) || event.start.length !== 5) {
          throw new Error(`Invalid start time for event: ${JSON.stringify(event)}`);
        }
        if (!event.duration || typeof event.duration.hours !== 'number') {
          throw new Error(`Invalid duration for event: ${JSON.stringify(event)}`);
        }
        if (!event.title || typeof event.title !== 'string') {
          throw new Error(`Invalid title for event: ${JSON.stringify(event)}`);
        }
        return event;
      });

      const { error, value } = createEvents(events);

      if (error) {
        console.error(`Error creating ICS events:`, error);
        throw new Error(`Error creating ICS events: ${error}`);
      }

      // Ensure proper line endings
      let icsContent = value.replace(/\r?\n/g, '\r\n');

      // Validate overall structure
      if (!icsContent.startsWith('BEGIN:VCALENDAR') || !icsContent.endsWith('END:VCALENDAR\r\n')) {
        throw new Error('Invalid ICS file structure');
      }

      console.log(`ICS content generated. Length: ${icsContent.length}`);
      console.log(`First 100 characters of ICS content:`, icsContent.substring(0, 100));

      fs.writeFileSync(filename, icsContent, { encoding: 'utf8' });
      console.log(`File written successfully: ${filename}`);

      // Validate the written file
      const writtenContent = fs.readFileSync(filename, 'utf8');
      if (writtenContent !== icsContent) {
        throw new Error('File content does not match generated content');
      }

      return filename;
    } catch (error) {
      console.error('Error generating ICS file:', error);
      throw error;
    }
  },

  convertNutritionPlanToICSEvents : (nutritionPlan, startDate) => {
    console.log("Starting event conversion...");
    const events = [];
    const lines = nutritionPlan.split('\n');
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    let currentDay = -1;
    let currentTime = new Date(startDate);
    let mealDetails = {};
  
    // Function to format event description
    const formatEventDescription = (details) => {
      let description = '';
      if (details.dish) description += `Dish: ${details.dish}\n`;
      if (details.calories) description += `Calories: ${details.calories}\n`;
      return description.trim();
    };
  
    for (const line of lines) {
      const dayIndex = daysOfWeek.findIndex(day => line.includes(day));
      if (dayIndex !== -1) {
        console.log("Detected day: ", daysOfWeek[dayIndex]);
        currentDay = dayIndex;
        currentTime = new Date(startDate);
        currentTime.setDate(currentTime.getDate() + currentDay);
        currentTime.setHours(8, 0, 0, 0); // Start at 8 AM
        mealDetails = {};
      } else if (currentDay !== -1) {
        const mealMatch = line.match(/^\*\s*\*\*(Breakfast|Lunch|Snack|Dinner):\*\*\s*(.*)\s-\s(\d+)\scalories/);
        if (mealMatch) {
          const [, mealType, dish, calories] = mealMatch;
          if (Object.keys(mealDetails).length > 0) {
            addEvent(events, mealDetails, currentTime);
          }
          mealDetails = { title: `${daysOfWeek[currentDay]} - ${mealType}`, dish, calories };
        }
      }
    }
  
    // Add the last meal if exists
    if (Object.keys(mealDetails).length > 0) {
      addEvent(events, mealDetails, currentTime);
    }
  
    // Function to add an event
    function addEvent(events, details, time) {
      const duration = 60; // Default duration of 1 hour
      events.push({
        title: details.title || 'Untitled Meal',
        description: formatEventDescription(details),
        start: [
          time.getFullYear(),
          time.getMonth() + 1,
          time.getDate(),
          time.getHours(),
          time.getMinutes()
        ],
        duration: { hours: Math.floor(duration / 60), minutes: duration % 60 },
      });
      console.log("Event added: ", details.title);
  
      // Move to the next time slot
      time.setMinutes(time.getMinutes() + duration);
    }
  
    console.log("Conversion complete. Events: ", JSON.stringify(events, null, 2));
    return events;
  },
  
  convertExercisePlanToICSEvents: (plan, startDate) => {
    console.log("Starting event conversion...");
    const events = [];
    const lines = plan.split('\n');
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    let currentDay = -1;
    let currentTime = new Date(startDate);
    let eventDetails = {};

    const formatEventDescription = (details) => {
      let description = '';
      if (details.description) description += `Description: ${details.description}\n`;
      if (details.sets) description += `Sets: ${details.sets}\n`;
      if (details.reps) description += `Reps: ${details.reps}\n`;
      if (details.duration) description += `Duration: ${details.duration}\n`;
      if (details['rest time']) description += `Rest Time: ${details['rest time']}\n`;
      return description.trim();
    };

    for (const line of lines) {
      // console.log("Processing line: ", line);

      const dayIndex = daysOfWeek.findIndex(day => line.includes(day));
      if (dayIndex !== -1) {
        console.log("Detected day: ", daysOfWeek[dayIndex]);
        currentDay = dayIndex;
        currentTime = new Date(startDate);
        currentTime.setDate(currentTime.getDate() + currentDay);
        currentTime.setHours(8, 0, 0, 0); // Start at 8 AM
        eventDetails = {};
      } else if (currentDay !== -1) {
        const titleMatch = line.match(/^\s*\*\*Exercise \d+:\*\*$/);
        if (titleMatch) {
          // Start a new event
          if (Object.keys(eventDetails).length > 0) {
            addEvent(events, eventDetails, currentTime);
          }
          eventDetails = {};
        } else {
          const match = line.match(/^\s*-\s*\*\*(.*?):\*\*\s*(.*)/);
          if (match) {
            const [, key, value] = match;
            eventDetails[key.toLowerCase()] = value.trim();
            console.log(`Event ${key} detected: `, value.trim());
          }
        }
      }
    }

    // Add the last event if exists
    if (Object.keys(eventDetails).length > 0) {
      addEvent(events, eventDetails, currentTime);
    }

    function addEvent(events, details, time) {
      const duration = parseInt(details.duration) || 30; // Default to 30 minutes if not specified
      events.push({
        title: details.title || 'Untitled Exercise',
        description: formatEventDescription(details),
        start: [
          time.getFullYear(),
          time.getMonth() + 1,
          time.getDate(),
          time.getHours(),
          time.getMinutes()
        ],
        duration: { hours: Math.floor(duration / 60), minutes: duration % 60 },
      });
      console.log("Event added: ", details.title);

      // Move to the next time slot
      time.setMinutes(time.getMinutes() + duration);
    }

    console.log("Conversion complete. Events: ", JSON.stringify(events, null, 2));
    return events;
  },

  sendDirectMessageWithAttachment: async (userId, message, filePath) => {
    try {
      const conversationResponse = await slackClient.conversations.open({
        users: userId,
      });

      if (!conversationResponse.ok) {
        throw new Error(`Failed to open conversation: ${conversationResponse.error}`);
      }

      const channelId = conversationResponse.channel.id;

      // First, send the message
      await slackClient.chat.postMessage({
        channel: channelId,
        text: message,
      });

      // Then, upload the file
      const fileContent = fs.readFileSync(filePath);
      const fileName = filePath.split('/').pop();

      const uploadResult = await slackClient.files.uploadV2({
        channel_id: channelId,
        file: fileContent,
        filename: fileName,
        initial_comment: "Here's your plan as a calendar file:",
      });

      if (!uploadResult.ok) {
        throw new Error(`Failed to upload file: ${uploadResult.error}`);
      }

      console.log('File uploaded successfully');
    } catch (error) {
      console.error("Error sending direct message with attachment to user:", error);
      // Attempt to send the message without the attachment
      try {
        await slackClient.chat.postMessage({
          channel: channelId,
          text: `${message}\n\nNote: There was an issue attaching the calendar file. Please contact support if you need the ICS file.`,
        });
      } catch (fallbackError) {
        console.error("Error sending fallback message:", fallbackError);
      }
    }
  },

  sendCustomizedNutritionPlan: async (userId, newPurchases = []) => {
    try {
      const userProfile = await dbOps.getUserProfile(userId);
      let plan;
  
      if (newPurchases.length > 0) {
        // If there are purchases, generate a plan based on the first purchase
        const product = await dbOps.getProductDetails(newPurchases[0].product_id);
        plan = await aiOps.generateIndianNutritionPlan(userProfile, product);
      } else {
        // If no purchases, generate a general plan
        plan = await aiOps.generateIndianNutritionPlan(userProfile);
      }
  
      console.log("Generated nutrition plan:", plan);
  
      // Generate ICS file
      const startDate = utils.getNextMonday();
      const events = utils.convertNutritionPlanToICSEvents(plan, startDate);
      console.log("Converted events:", JSON.stringify(events, null, 2));
  
      if (events.length === 0) {
        console.warn("No events were extracted from the nutrition plan.");
      }
  
      const filename = `nutrition_plan_${userId}.ics`;
  
      try {
        utils.generateICSFile(events, filename);
  
        // Send message with ICS file
        await utils.sendDirectMessageWithAttachment(
          userId,
          "Here's your customized 5-day nutrition plan:",
          filename
        );
      } catch (icsError) {
        console.error('Error generating or sending ICS file:', icsError);
        // Still send the text plan if ICS generation fails
        await utils.sendDirectMessageToUser(userId,
          "Here's your customized 5-day nutrition plan:\n\n" + plan
        );
      } finally {
        // Clean up the file if it was created
        if (fs.existsSync(filename)) {
          fs.unlinkSync(filename);
        }
      }
    } catch (error) {
      console.error("Error sending customized nutrition plan:", error);
    }
  },

  sendCustomizedExercisePlan: async (userId, newPurchases = []) => {
    try {
      const userProfile = await dbOps.getUserProfile(userId);
      let plan;
  
      if (newPurchases.length > 0) {
        // If there are purchases, generate a plan based on the first purchase
        const product = await dbOps.getProductDetails(newPurchases[0].product_id);
        plan = await aiOps.generateExerciseSuggestion(userProfile, product);
      } else {
        // If no purchases, generate a general plan
        plan = await aiOps.generateExerciseSuggestion(userProfile);
      }
  
      console.log("Generated exercise plan:", plan);
  
      // Generate ICS file
      const startDate = utils.getNextMonday();
      const events = utils.convertExercisePlanToICSEvents(plan, startDate);
      console.log("Converted events:", JSON.stringify(events, null, 2));
  
      if (events.length === 0) {
        console.warn("No events were extracted from the exercise plan.");
      }
  
      const filename = `exercise_plan_${userId}.ics`;
  
      try {
        utils.generateICSFile(events, filename);
  
        // Send message with ICS file
        await utils.sendDirectMessageWithAttachment(
          userId,
          "Here's your customized 5-day exercise plan:",
          filename
        );
      } catch (icsError) {
        console.error('Error generating or sending ICS file:', icsError);
        // Still send the text plan if ICS generation fails
        await utils.sendDirectMessageToUser(userId,
          "Here's your customized 5-day exercise plan:\n\n" + plan
        );
      } finally {
        // Clean up the file if it was created
        if (fs.existsSync(filename)) {
          fs.unlinkSync(filename);
        }
      }
    } catch (error) {
      console.error("Error sending customized exercise plan:", error);
    }
  },

  sendDirectMessageToUser: async (userId, message) => {
    try {
      const conversationResponse = await slackClient.conversations.open({
        users: userId,
      });

      if (!conversationResponse.ok) {
        throw new Error(`Failed to open conversation: ${conversationResponse.error}`);
      }

      const channelId = conversationResponse.channel.id;

      await slackClient.chat.postMessage({
        channel: channelId,
        text: message,
      });
    } catch (error) {
      console.error("Error sending direct message to user:", error);
    }
  },

  getNextMonday: () => {
    const now = new Date();
    const daysUntilMonday = (8 - now.getDay()) % 7;
    const nextMonday = new Date(now.setDate(now.getDate() + daysUntilMonday));
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday;
  },

  fetchUserInfo: async (app, userId) => {
    try {
      const userInfo = await app.client.users.info({
        token: config.SLACK_BOT_TOKEN,
        user: userId,
      });
      return {
        name: userInfo.user.name,
        email: userInfo.user.profile.email,
      };
    } catch (error) {
      console.error("Error fetching user info:", error);
      return { name: "Unknown User", email: null };
    }
  },

  fetchChannelInfo: async (app, channelId) => {
    try {
      const channelInfo = await app.client.conversations.info({
        token: config.SLACK_BOT_TOKEN,
        channel: channelId,
      });
      return channelInfo.channel.name;
    } catch (error) {
      console.error("Error fetching channel info:", error);
      return "Unknown Channel";
    }
  },

  getBotInfo: async (app) => {
    try {
      const botInfo = await app.client.auth.test({
        token: config.SLACK_BOT_TOKEN,
      });
      utils.botUserId = botInfo.user_id;
      utils.botName = botInfo.user;
      return { botUserId: botInfo.user_id, botName: botInfo.user };
    } catch (error) {
      console.error("Error fetching bot info:", error);
      return null;
    }
  },

  isBotMentioned: (text) => {
    if (!utils.botUserId || !utils.botName) {
      console.error("Bot info not initialized");
      return false;
    }
    return (
      text.includes(`<@${utils.botUserId}>`) ||
      text.toLowerCase().includes(utils.botName.toLowerCase())
    );
  },

  // generatePDF: async (content, userName) => {
  //   const pageWidth = 595;
  //   const pageHeight = 842;
  //   const margin = 40;

  //   const canvas = createCanvas(pageWidth, pageHeight, 'pdf');
  //   const ctx = canvas.getContext('2d');

  //   // Helper function to wrap text
  //   const wrapText = (text, maxWidth) => {
  //     const words = text.split(' ');
  //     const lines = [];
  //     let currentLine = words[0];

  //     for (let i = 1; i < words.length; i++) {
  //       const word = words[i];
  //       const width = ctx.measureText(currentLine + " " + word).width;
  //       if (width < maxWidth) {
  //         currentLine += " " + word;
  //       } else {
  //         lines.push(currentLine);
  //         currentLine = word;
  //       }
  //     }
  //     lines.push(currentLine);
  //     return lines;
  //   };

  //   // Helper function to draw wrapped text
  //   const drawWrappedText = (text, x, y, maxWidth, lineHeight) => {
  //     const lines = wrapText(text, maxWidth);
  //     lines.forEach((line, i) => {
  //       ctx.fillText(line, x, y + (i * lineHeight));
  //     });
  //     return lines.length * lineHeight;
  //   };

  //   // Load and draw the header image
  //   try {
  //     const headerImage = await loadImage(path.join(__dirname, '..', 'assets', 'header-image.png'));
  //     ctx.drawImage(headerImage, 0, 0, pageWidth, 100);
  //   } catch (error) {
  //     console.error('Error loading header image:', error);
  //     // Continue without the header image if it fails to load
  //   }

  //   // Set up the PDF content
  //   ctx.fillStyle = '#333333';
  //   ctx.font = 'bold 28px Arial';
  //   ctx.fillText('Weekly Fitness Report', margin, 140);

  //   // Add user name and date
  //   ctx.font = '16px Arial';
  //   ctx.fillText(`User: ${userName}`, margin, 170);
  //   ctx.fillText('Week of: ' + new Date().toLocaleDateString(), pageWidth - margin - 150, 170);

  //   // Draw a separating line
  //   ctx.beginPath();
  //   ctx.moveTo(margin, 190);
  //   ctx.lineTo(pageWidth - margin, 190);
  //   ctx.stroke();

  //   let y = 220;
  //   const contentWidth = pageWidth - (2 * margin);

  //   // Parse and draw content sections
  //   const sections = content.split('**');
  //   sections.forEach((section, index) => {
  //     if (index % 2 === 1) { // Odd indexes are section titles
  //       ctx.font = 'bold 18px Arial';
  //       ctx.fillStyle = '#1a73e8';
  //       y += drawWrappedText(section + ':', margin, y, contentWidth, 24) + 10;
  //     } else { // Even indexes are section content
  //       ctx.font = '14px Arial';
  //       ctx.fillStyle = '#333333';
  //       y += drawWrappedText(section, margin, y, contentWidth, 20) + 20;
  //     }

  //     // Check if we need to add a new page
  //     if (y > pageHeight - margin * 2) {
  //       ctx.addPage();
  //       y = margin;
  //     }
  //   });

  //   // Add a motivational quote
  //   ctx.font = 'italic 14px Arial';
  //   ctx.fillStyle = '#666666';
  //   const quotes = [
  //     '"The only bad workout is the one that didn\'t happen." - Unknown',
  //     '"Fitness is not about being better than someone else. It\'s about being better than you used to be." - Unknown',
  //     '"Take care of your body. It\'s the only place you have to live." - Jim Rohn'
  //   ];
  //   const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  //   ctx.fillText(randomQuote, margin, pageHeight - margin - 40);

  //   // Add a footer
  //   ctx.font = '12px Arial';
  //   ctx.fillStyle = '#333333';
  //   ctx.fillText('Generated on ' + new Date().toLocaleString(), margin, pageHeight - margin - 10);

  //   // Save the PDF
  //   const buffer = canvas.toBuffer('application/pdf');
  //   const fileName = `weekly_fitness_report_${userName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  //   fs.writeFileSync(fileName, buffer);

  //   return buffer;
  // },

  generatePDF: async (content, userName) => {
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 40;
  
    const canvas = createCanvas(pageWidth, pageHeight, 'pdf');
    const ctx = canvas.getContext('2d');
  
    // Helper function to wrap text
    const wrapText = (text, maxWidth) => {
      if (typeof text !== 'string') return [];
      const words = text.split(' ');
      const lines = [];
      let currentLine = words[0];
  
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
      return lines;
    };
  
    // Helper function to draw wrapped text
    const drawWrappedText = (text, x, y, maxWidth, lineHeight) => {
      if (typeof text !== 'string') return 0;
      const lines = wrapText(text, maxWidth);
      lines.forEach((line, i) => {
        ctx.fillText(line, x, y + (i * lineHeight));
      });
      return lines.length * lineHeight;
    };
  
    // Load and draw the header image
    try {
      const headerImage = await loadImage(path.join(__dirname, '..', 'assets', 'header-image.png'));
      ctx.drawImage(headerImage, 0, 0, pageWidth, 100);
    } catch (error) {
      console.error('Error loading header image:', error);
    }
  
    // Set up the PDF content
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('Weekly Fitness Report', margin, 140);
  
    // Add user name and date
    ctx.font = '16px Arial';
    ctx.fillText(`User: ${userName}`, margin, 170);
    ctx.fillText('Week of: ' + new Date().toLocaleDateString(), pageWidth - margin - 150, 170);
  
    // Draw a separating line
    ctx.beginPath();
    ctx.moveTo(margin, 190);
    ctx.lineTo(pageWidth - margin, 190);
    ctx.stroke();
  
    let y = 220;
    const contentWidth = pageWidth - (2 * margin);
  
    // Parse and draw content sections
    const sections = content.split('#').slice(1);
    sections.forEach((section) => {
      if (typeof section !== 'string') return;
      const lines = section.split('\n').filter(line => line.trim() !== '');
      if (lines.length === 0) return;
      
      const [title, ...content] = lines;
      
      // Draw section title
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#1a73e8';
      y += drawWrappedText(title.trim(), margin, y, contentWidth, 28) + 15;
  
      // Draw section content
      ctx.font = '14px Arial';
      ctx.fillStyle = '#333333';
      content.forEach(line => {
        if (typeof line !== 'string') return;
        if (line.startsWith('-') || line.match(/^\d+\./)) {
          // Bullet point or numbered list item
          ctx.fillStyle = '#1a73e8';
          ctx.fillText('•', margin, y + 7);
          ctx.fillStyle = '#333333';
          y += drawWrappedText(line.trim().substr(1), margin + 20, y, contentWidth - 20, 20) + 10;
        } else if (line.includes(':')) {
          // Key-value pair
          const [key, value] = line.split(':');
          ctx.font = 'bold 14px Arial';
          y += drawWrappedText(key.trim() + ':', margin, y, contentWidth, 20);
          ctx.font = '14px Arial';
          y += drawWrappedText(value.trim() || 'Not provided', margin + 20, y, contentWidth - 20, 20) + 10;
        } else {
          // Normal text
          y += drawWrappedText(line.trim(), margin, y, contentWidth, 20) + 10;
        }
      });
  
      y += 30; // Add space between sections
  
      // Check if we need to add a new page
      if (y > pageHeight - margin * 2) {
        ctx.addPage();
        y = margin;
      }
    });
  
    // Add a motivational quote
    ctx.font = 'italic 14px Arial';
    ctx.fillStyle = '#666666';
    const quotes = [
      '"The only bad workout is the one that didn\'t happen." - Unknown',
      '"Fitness is not about being better than someone else. It\'s about being better than you used to be." - Unknown',
      '"Take care of your body. It\'s the only place you have to live." - Jim Rohn'
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    ctx.fillText(randomQuote, margin, pageHeight - margin - 40);
  
    // Add a footer
    ctx.font = '12px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText('Generated on ' + new Date().toLocaleString(), margin, pageHeight - margin - 10);
  
    // Save the PDF
    const buffer = canvas.toBuffer('application/pdf');
    const fileName = `weekly_fitness_report_${userName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    fs.writeFileSync(fileName, buffer);
  
    return buffer;
  },

  sendEmail: async (to, subject, text, attachments) => {
    const transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: config.EMAIL_FROM,
      to,
      subject,
      text,
      attachments,
    });
  },

  generateGreeting: (username) => {
    const greetings = [
      `Hello ${username}! How can I assist you with your health and fitness today?`,
      `Hi there, ${username}! Ready to talk about your wellness journey?`,
      `Great to see you, ${username}! What fitness topic would you like to discuss?`,
      `Welcome, ${username}! How can I help you stay healthy and fit today?`,
      `Hey ${username}! Let's chat about your health and fitness goals.`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  },

  formatResponseForSlack: (response) => {
    const sections = response.split('\n# ');

    const blocks = sections.map(section => {
      const [title, ...content] = section.split('\n');
      return {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${title.trim()}*\n${content.join('\n').trim()}`
        }
      };
    });

    return { blocks };
  },

};

module.exports = utils;
