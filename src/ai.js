const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require('./config');
const sharp = require('sharp');
const pdfParse = require('pdf-parse');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const aiOps = {

  checkMessageContext: async (message, context) => {
    const prompt = `Given the following conversation context and a new message, determine if the new message is related to the ongoing conversation or if it's a new topic. Respond with either 'related' or 'new_topic'.
  
    Context:
    ${context.join('\n')}
  
    New message: "${message}"
  
    Is this message related to the context or a new topic?`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim().toLowerCase();
  },

  classifyMessage: async (message) => {
    const prompt = `Classify the following message into one of these categories: 'greeting', 'fitness_related', 'health_related', or 'off_topic'. Respond with just the category name. Message: "${message}"`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim().toLowerCase();
  },

  generateResponse: async (message, context, userProfile) => {
    try {
      // Convert the user profile data to a plain text string
      const goalString = JSON.stringify(userProfile.goal, null, 2);
      const dietPreferencesString = JSON.stringify(userProfile.diet_preferences, null, 2);
      const exercisePreferencesString = JSON.stringify(userProfile.exercise_preferences, null, 2);
  
      const userProfileText = `
        Age: ${userProfile.age}
        Height: ${userProfile.height}
        Weight: ${userProfile.weight}
        Goal: ${goalString}
        Daily Routine: ${userProfile.daily_routine}
        Allergies: ${userProfile.allergies}
        Diet Preferences: ${dietPreferencesString}
        Exercise Preferences: ${exercisePreferencesString}
      `;
  
      const prompt = `You are a fitness coach. Provide a well-formatted and helpful response in plain text that Slack can render properly (no visible markdown). 
      The response should be friendly, encouraging, and based on the user's profile.
      
      Previous conversation:
      ${context.join('\n')}
      
      User Profile:
      ${userProfileText}
      
      User: ${message}
      
      Provide the response directly in readable text with no markdown symbols like "**", "__", or "_". Format it so that it looks good in Slack using blockquotes and sections for readability.`;
      
      // Call the AI model
      const result = await model.generateContent(prompt);
      let coachResponse = result.response.text();
  
      // Remove any remaining markdown formatting that could be visible in Slack
      coachResponse = coachResponse
        .replace(/\*\*(.*?)\*\*/g, '*$1*')  // Converts bold from Markdown to Slack bold format
        .replace(/\_\_(.*?)\_\_/g, '*$1*')  // Converts underlines (which Slack doesn't support) to bold
        .replace(/(?:\r\n|\r|\n)/g, '\n');  // Normalize line breaks
  
      console.log("Formatted Slack response: ", coachResponse);
  
      return coachResponse;
  
    } catch (error) {
      console.error('Error generating response:', error);
      return `Sorry, an error occurred while generating your response: ${error.message}`;
    }
  },
  
  analyzeImage: async (imageBuffer, mimeType) => {
    try {
      if (mimeType === 'image/png') {
        imageBuffer = await sharp(imageBuffer).jpeg().toBuffer();
      }
      const imageParts = [
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg'
          }
        }
      ];
      const result = await model.generateContent(['Analyze this fitness-related image. Describe what you see and provide any relevant fitness insights:', ...imageParts]);
      return result.response.text();
    } catch (error) {
      console.error('Error analyzing image:', error);
      return 'Error analyzing image';
    }
  },

  analyzePDF: async (pdfBuffer) => {
    try {
      const data = await pdfParse(pdfBuffer);
      const text = data.text;
      const result = await model.generateContent(['Summarize this fitness-related PDF content and provide key insights:', text]);
      return result.response.text();
    } catch (error) {
      console.error('Error analyzing PDF:', error);
      return 'Error analyzing PDF';
    }
  },

  summarizeChat: async (messages) => {
    const prompt = `Summarize the following fitness-related chat conversation, highlighting key points and advice given:\n\n${messages.join('\n')}`;
    const result = await model.generateContent(prompt);
    console.log("Prompt: ", prompt);
    console.log("Summarised Chat: ", result.response.text());
    return result.response.text();
  },

  // generateUserWeeklySummary: async (messages, userProfile) => {
  //   const userProfileText = `
  //     Age: ${userProfile.age}
  //     Height: ${userProfile.height}
  //     Weight: ${userProfile.weight}
  //     Goal: ${JSON.stringify(userProfile.goal, null, 2)}
  //     Daily Routine: ${userProfile.daily_routine}
  //     Allergies: ${userProfile.allergies}
  //     Diet Preferences: ${JSON.stringify(userProfile.diet_preferences, null, 2)}
  //     Exercise Preferences: ${JSON.stringify(userProfile.exercise_preferences, null, 2)}
  //   `;

  //   const prompt = `As a supportive fitness coach, create a friendly and encouraging weekly fitness summary based on the user's messages and profile. The summary should be well-formatted for Slack (no visible markdown) and include the following sections:
  
  //   # Weekly Fitness Report
  
  //   ## Key Achievements
  //   - Achievement 1
  //   - Achievement 2
  //   - Achievement 3
  
  //   ## Areas for Improvement
  //   - Area 1
  //   - Area 2
  //   - Area 3
  
  //   ## Personalized Recommendations
  //   1. Recommendation 1
  //   2. Recommendation 2
  //   3. Recommendation 3
  
  //   ## Activity Summary
  //   - Total workouts: [number]
  //   - Total duration: [hours] hours
  //   - Calories burned: [number] kcal
  
  //   ## Nutrition Insights
  //   - Average daily calorie intake: [number] kcal
  //   - Protein: [number]g
  //   - Carbs: [number]g
  //   - Fats: [number]g
  
  //   ## Next Week's Goals
  //   1. Goal 1
  //   2. Goal 2
  //   3. Goal 3
  
  //   Feel free to adjust the sections based on the available information. If exact data isn't provided, you can use approximations or focus on qualitative insights. The tone should be positive and motivating.
  
  //   User Profile:
  //   ${userProfileText}
  
  //   User Messages:
  //   ${messages.join('\n')}
  
  //   Please provide the summary directly in readable text, formatting it for clarity in Slack using spacing and emoji where appropriate.`;
  
  //   const result = await model.generateContent(prompt);
  //   return result.response.text();
  // },


  generateUserWeeklySummary: async (messages, userProfile) => {
    const userProfileText = `
      Age: ${userProfile.age}
      Height: ${userProfile.height}
      Weight: ${userProfile.weight}
      Goal: ${JSON.stringify(userProfile.goal, null, 2)}
      Daily Routine: ${userProfile.daily_routine}
      Allergies: ${userProfile.allergies}
      Diet Preferences: ${JSON.stringify(userProfile.diet_preferences, null, 2)}
      Exercise Preferences: ${JSON.stringify(userProfile.exercise_preferences, null, 2)}
      Momentum Score: ${userProfile.momentum_score}
      Current Streak: ${userProfile.current_streak} days
      Max Streak: ${userProfile.max_streak} days
    `;
  
    const prompt = `As a supportive fitness coach, create a friendly and encouraging weekly fitness summary based on the user's messages, profile, and performance metrics. The summary should be well-formatted for Slack (no visible markdown) and include the following sections:
  
    # Weekly Fitness Report
  
    ## Key Achievements
    - Achievement 1
    - Achievement 2
    - Achievement 3
  
    ## Progress Highlights
    - Highlight the user's momentum score and how it has changed
    - Mention the current streak and congratulate if it's a personal best
    - Note any improvements in workout frequency or duration
  
    ## Areas for Growth
    - Area 1
    - Area 2
    - Area 3
  
    ## Personalized Recommendations
    1. Recommendation 1
    2. Recommendation 2
    3. Recommendation 3
  
    ## Activity Summary
    - Total workouts: [number]
    - Total duration: [hours] hours
    - Calories burned: [number] kcal
  
    ## Nutrition Insights
    - Average daily calorie intake: [number] kcal
    - Protein: [number]g
    - Carbs: [number]g
    - Fats: [number]g
  
    ## Next Week's Goals
    1. Goal 1
    2. Goal 2
    3. Goal 3
  
    Feel free to adjust the sections based on the available information. If exact data isn't provided, you can use approximations or focus on qualitative insights. The tone should be positive and motivating, emphasizing the user's progress and encouraging them to maintain or improve their streak and momentum.
  
    User Profile:
    ${userProfileText}
  
    User Messages:
    ${messages.join('\n')}
  
    Please provide the summary directly in readable text, formatting it for clarity in Slack using spacing and emoji where appropriate.`;
  
    const result = await model.generateContent(prompt);
    return result.response.text();
  },

  generateCustomizedPlan: async (userProfile, product) => {
    try {
      // Convert the product object to a formatted string
      const productString = JSON.stringify(product, null, 2);
      const goalString = JSON.stringify(userProfile.goal, null, 2);
      const allergiesString = JSON.stringify(userProfile.allergies, null, 2);
      const diet_preferencesString = JSON.stringify(userProfile.diet_preferences, null, 2);
      const exercise_preferencesString = JSON.stringify(userProfile.exercise_preferences, null, 2);


      // Convert the user profile data to a plain text string
      const userProfileText = `
        Age: ${userProfile.age}
        Height: ${userProfile.height}
        Weight: ${userProfile.weight}
        Goal: ${goalString}
        Daily Routine: ${userProfile.daily_routine}
        Allergies: Dairy - ${allergiesString}
        Diet Preferences: Vegetarian - ${diet_preferencesString}
        Exercise Preferences: Cardio - ${exercise_preferencesString}
      `;

      const prompt = `As an experienced fitness coach, create a customized workout and Indian nutrition plan for the user based on the product they have purchased. The plan should include the following components:
    
      1. Overview of the user's fitness goals and current state based on the purchased product.
      2. Detailed workout routine tailored to the user's needs and the product they purchased. Include specific exercises, sets, reps, and workout duration.
      3. Personalized nutrition plan that aligns with the user's fitness goals and the product they purchased. Provide meal recommendations, portion sizes, and macronutrient ratios.
      4. Equipment recommendations and usage tips related to the purchased product.
      5. Motivational tips and strategies to help the user stay engaged and consistent with the plan.
      
      Please provide the customized plan in a structured format, that can be easily shared with the user. 
      
      User Profile:
      ${userProfileText}
  
      Purchased Product: 
      ${productString}`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Error generating customized plan:', error);
      return 'Error generating customized plan';
    }
  },

  generateIndianNutritionPlan: async (userProfile, product = null) => {
    try {
      const userProfileText = `
          Age: ${userProfile.age}
          Height: ${userProfile.height}
          Weight: ${userProfile.weight}
          Goal: ${JSON.stringify(userProfile.goal, null, 2)}
          Daily Routine: ${userProfile.daily_routine}
          Allergies: ${userProfile.allergies}
          Diet Preferences: ${JSON.stringify(userProfile.diet_preferences, null, 2)}
          Exercise Preferences: ${JSON.stringify(userProfile.exercise_preferences, null, 2)}
        `;

      let productText = '';
      if (product) {
        productText = `
            Purchased Product:
            ${JSON.stringify(product, null, 2)}
          `;
      }

      const prompt = `As a nutritionist specializing in Indian diets, create a personalized 5-day (Monday to Friday) nutrition plan for the user based on their profile. ${product ? 'Take into account the product they purchased.' : ''} The plan should be rich in traditional Indian foods and take into account the user's goals, allergies, and dietary preferences. 
  
        Output the plan in the following format:
        Monday:
        Breakfast: [Dish Name] - [Calories]
        Lunch: [Dish Name] - [Calories]
        Snack: [Dish Name] - [Calories]
        Dinner: [Dish Name] - [Calories]
  
        Tuesday:
        ... (repeat for Wednesday, Thursday, Friday)
  
        Hydration: [Daily water intake recommendation]
        
        Weekend Tips: [2-3 sentences on maintaining healthy eating habits during weekends]
        Allergy Management: [1-2 sentences on managing allergies with the given plan]
  
        User Profile:
        ${userProfileText}
        ${productText}`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Error generating Indian nutrition plan:', error);
      return 'Error generating Indian nutrition plan';
    }
  },

  generateExerciseSuggestion: async (userProfile, product = null) => {
    try {
      const userProfileText = `
          Age: ${userProfile.age}
          Height: ${userProfile.height}
          Weight: ${userProfile.weight}
          Goal: ${JSON.stringify(userProfile.goal, null, 2)}
          Daily Routine: ${userProfile.daily_routine}
          Allergies: ${JSON.stringify(userProfile.allergies, null, 2)}
          Diet Preferences: ${JSON.stringify(userProfile.diet_preferences, null, 2)}
          Exercise Preferences: ${JSON.stringify(userProfile.exercise_preferences, null, 2)}
          `;

      let productText = '';
      if (product) {
        productText = `
            Purchased Product:
            ${JSON.stringify(product, null, 2)}
          `;
      }

      const prompt = `As a personal trainer, create a personalized 5-day (Monday to Friday) exercise routine for the user based on their profile. ${product ? 'Take into account the product they purchased.' : ''} The routine should be tailored to the user's fitness goals and preferences.
  
          Output the plan in the following format:
  
          Monday:
          Exercise 1:
          - **Title:** [Exercise Name]
          - **Description:** [Brief description of the exercise]
          - **Sets:** [Number of sets]
          - **Reps:** [Number of reps]
          - **Duration:** [Duration in minutes, if applicable]
          - **Rest Time:** [Rest time in seconds]
  
          Exercise 2:
          - **Title:** [Exercise Name]
          - **Description:** [Brief description of the exercise]
          - **Sets:** [Number of sets]
          - **Reps:** [Number of reps]
          - **Duration:** [Duration in minutes, if applicable]
          - **Rest Time:** [Rest time in seconds]
  
          ... (repeat for Tuesday, Wednesday, Thursday, Friday)
  
          Weekend Activity Suggestions:
          - [Suggestion 1]
          - [Suggestion 2]
          - [Suggestion 3]
  
          Safety Tips:
          - [Tip 1]
          - [Tip 2]
          - [Tip 3]
  
          Progression:
          [1-2 sentences on how to increase intensity over time]
  
          User Profile:
          ${userProfileText}
          ${productText}`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('Error generating exercise suggestion:', error);
      return 'Error generating exercise suggestion';
    }
  },

};

module.exports = aiOps;