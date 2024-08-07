const questions = [
    {
      key: 'fitness_goals',
      text: 'What are your fitness goals?',
      options: ['weight_loss', 'muscle_gain', 'endurance', 'strength', 'flexibility']
    },
    {
      key: 'activity_level',
      text: 'What is your current activity level?',
      options: ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active']
    },
    {
      key: 'height',
      text: 'What is your height in cm?'
    },
    {
      key: 'current_weight',
      text: 'What is your current weight in kg?'
    },
    {
      key: 'exercise_experience',
      text: 'What is your exercise experience level?',
      options: ['beginner', 'intermediate', 'advanced']
    },
    {
      key: 'workout_days_per_week',
      text: 'How many days per week do you plan to work out?'
    },
    {
      key: 'preferred_exercise_type',
      text: 'What type of exercise do you prefer?',
      options: ['cardio', 'strength_training', 'flexibility', 'hiit']
    },
    {
      key: 'physical_limitations',
      text: 'Do you have any physical limitations or health concerns? If yes, please describe.'
    }
  ];
  
  module.exports = { questions };