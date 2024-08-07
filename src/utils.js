const axios = require("axios");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const path = require('path');
const config = require("./config");
const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");

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

  // generatePDF: async (content) => {
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

  //   // Set up the PDF content
  //   ctx.fillStyle = '#333333';
  //   ctx.font = 'bold 24px Arial';
  //   ctx.fillText('Weekly Fitness Report', margin, margin + 24);

  //   ctx.font = 'bold 18px Arial';
  //   ctx.fillText('Weekly Fitness Summary Report:', margin, margin + 60);

  //   ctx.font = 'bold 16px Arial';
  //   ctx.fillText('Key Achievements:', margin, margin + 90);

  //   ctx.font = '14px Arial';
  //   let y = margin + 120;
  //   const sections = content.split('**');
  //   const contentWidth = pageWidth - (2 * margin);

  //   sections.forEach((section, index) => {
  //     if (index % 2 === 1) { // Odd indexes are section titles
  //       ctx.font = 'bold 14px Arial';
  //       y += drawWrappedText(section + ':', margin, y, contentWidth, 20);
  //     } else { // Even indexes are section content
  //       ctx.font = '14px Arial';
  //       y += drawWrappedText(section, margin, y, contentWidth, 20) + 10; // Add some space between sections
  //     }
  //   });

  //   // Add a footer
  //   ctx.font = '10px Arial';
  //   ctx.fillText('Generated on ' + new Date().toLocaleDateString(), margin, pageHeight - margin);

  //   return canvas.toBuffer();
  // },

  generatePDF : async (content, userName) => {
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 40;
  
    const canvas = createCanvas(pageWidth, pageHeight, 'pdf');
    const ctx = canvas.getContext('2d');
  
    // Helper function to wrap text
    const wrapText = (text, maxWidth) => {
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
      // Continue without the header image if it fails to load
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
    const sections = content.split('**');
    sections.forEach((section, index) => {
      if (index % 2 === 1) { // Odd indexes are section titles
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#1a73e8';
        y += drawWrappedText(section + ':', margin, y, contentWidth, 24) + 10;
      } else { // Even indexes are section content
        ctx.font = '14px Arial';
        ctx.fillStyle = '#333333';
        y += drawWrappedText(section, margin, y, contentWidth, 20) + 20;
      }
  
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

  formatResponseForSlack:(response) =>{
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
