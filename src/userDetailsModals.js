// userDetailsModals.js

const partOneModal = {
  // type: "modal",
  // callback_id: "user_details_part_one",
  // title: {
  //   type: "plain_text",
  //   text: "User Details - Part 1",
  //   emoji: true
  // },
  // submit: {
  //   type: "plain_text",
  //   text: "Next",
  //   emoji: true
  // },
  callback_id: 'user_details_part_one',
  type: 'modal',
  title: {
    type: 'plain_text',
    text: 'User Details - Part 1'
  },
  submit: {
    type: 'plain_text',
    text: 'Next'
  },
  close: {
    type: "plain_text",
    text: "Cancel",
    emoji: true
  },
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Part 1: Basic Information*"
      }
    },
    {
      type: "input",
      block_id: "full_name",
      element: {
        type: "plain_text_input",
        action_id: "full_name_input",
        placeholder: {
          type: "plain_text",
          text: "Enter your full name"
        }
      },
      label: {
        type: "plain_text",
        text: "Full Name",
        emoji: true
      }
    },
    {
      type: "input",
      block_id: "email",
      element: {
        type: "plain_text_input",
        action_id: "email_input",
        placeholder: {
          type: "plain_text",
          text: "Enter your email address"
        }
      },
      label: {
        type: "plain_text",
        text: "Email",
        emoji: true
      }
    },
    {
      type: "input",
      block_id: "mobile_no",
      element: {
        type: "plain_text_input",
        action_id: "mobile_no_input",
        placeholder: {
          type: "plain_text",
          text: "Enter your mobile number"
        }
      },
      label: {
        type: "plain_text",
        text: "Mobile Number",
        emoji: true
      }
    },
    {
      type: "input",
      block_id: "age",
      element: {
        type: "number_input",
        is_decimal_allowed: false,
        action_id: "age_input",
        placeholder: {
          type: "plain_text",
          text: "Enter your age"
        }
      },
      label: {
        type: "plain_text",
        text: "Age",
        emoji: true
      }
    }
  ]
};

const partTwoModal = {
  type: 'modal',
  callback_id: 'user_details_part_two',
  title: {
    type: 'plain_text',
    text: 'User Details - Part 2'
  },
  blocks: [
    {
      type: 'input',
      block_id: 'height',
      label: {
        type: 'plain_text',
        text: 'Height (in cm)'
      },
      element: {
        type: 'plain_text_input',
        action_id: 'height_input',
        placeholder: {
          type: 'plain_text',
          text: 'Enter your height in cm'
        }
      }
    },
    {
      type: 'input',
      block_id: 'weight',
      label: {
        type: 'plain_text',
        text: 'Weight (in kg)'
      },
      element: {
        type: 'plain_text_input',
        action_id: 'weight_input',
        placeholder: {
          type: 'plain_text',
          text: 'Enter your weight in kg'
        }
      }
    },
    {
      type: 'input',
      block_id: 'goal',
      label: {
        type: 'plain_text',
        text: 'Fitness Goals'
      },
      element: {
        type: 'multi_static_select',
        action_id: 'goal_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select your fitness goals'
        },
        options: [
          { text: { type: 'plain_text', text: 'Weight Loss' }, value: 'weight_loss' },
          { text: { type: 'plain_text', text: 'Muscle Gain' }, value: 'muscle_gain' },
          { text: { type: 'plain_text', text: 'Improved Flexibility' }, value: 'flexibility' },
          { text: { type: 'plain_text', text: 'Better Endurance' }, value: 'endurance' },
          { text: { type: 'plain_text', text: 'Overall Health' }, value: 'overall_health' }
        ]
      }
    },
    {
      type: 'input',
      block_id: 'daily_routine',
      label: {
        type: 'plain_text',
        text: 'Daily Routine'
      },
      element: {
        type: 'plain_text_input',
        action_id: 'daily_routine_input',
        multiline: true,
        placeholder: {
          type: 'plain_text',
          text: 'Describe your typical daily routine'
        }
      }
    },
    {
      type: 'input',
      block_id: 'allergies',
      label: {
        type: 'plain_text',
        text: 'Allergies'
      },
      element: {
        type: 'plain_text_input',
        action_id: 'allergies_input',
        multiline: true,
        placeholder: {
          type: 'plain_text',
          text: 'List any allergies or food intolerances (or type "None" if not applicable)'
        }
      }
    },
    {
      type: 'input',
      block_id: 'diet_preferences',
      // optional: true,
      label: {
        type: 'plain_text',
        text: 'Diet Preferences'
      },
      element: {
        type: 'multi_static_select',
        action_id: 'diet_preferences_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select your diet preferences'
        },
        options: [
          { text: { type: 'plain_text', text: 'Vegetarian' }, value: 'vegetarian' },
          { text: { type: 'plain_text', text: 'Vegan' }, value: 'vegan' },
          { text: { type: 'plain_text', text: 'Pescatarian' }, value: 'pescatarian' },
          { text: { type: 'plain_text', text: 'Keto' }, value: 'keto' },
          { text: { type: 'plain_text', text: 'Paleo' }, value: 'paleo' },
          { text: { type: 'plain_text', text: 'Low-carb' }, value: 'low_carb' },
          { text: { type: 'plain_text', text: 'Mediterranean' }, value: 'mediterranean' },
          { text: { type: 'plain_text', text: 'Gluten-free' }, value: 'gluten_free' },
          { text: { type: 'plain_text', text: 'Dairy-free' }, value: 'dairy_free' },
          { text: { type: 'plain_text', text: 'No restrictions' }, value: 'no_restrictions' }
        ]
      }
    },
    {
      type: 'input',
      block_id: 'exercise_preferences',
      // optional: true,
      label: {
        type: 'plain_text',
        text: 'Exercise Preferences'
      },
      element: {
        type: 'multi_static_select',
        action_id: 'exercise_preferences_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select your exercise preferences'
        },
        options: [
          { text: { type: 'plain_text', text: 'Cardio' }, value: 'cardio' },
          { text: { type: 'plain_text', text: 'Weight Training' }, value: 'weight_training' },
          { text: { type: 'plain_text', text: 'Yoga' }, value: 'yoga' },
          { text: { type: 'plain_text', text: 'Pilates' }, value: 'pilates' },
          { text: { type: 'plain_text', text: 'Swimming' }, value: 'swimming' },
          { text: { type: 'plain_text', text: 'Running' }, value: 'running' },
          { text: { type: 'plain_text', text: 'Cycling' }, value: 'cycling' },
          { text: { type: 'plain_text', text: 'HIIT' }, value: 'hiit' },
          { text: { type: 'plain_text', text: 'CrossFit' }, value: 'crossfit' },
          { text: { type: 'plain_text', text: 'Team Sports' }, value: 'team_sports' }
        ]
      }
    }
  ],
  submit: {
    type: 'plain_text',
    text: 'Submit'
  }
};

module.exports = { partOneModal, partTwoModal };


// userDetailsModals.js

// const partOneModal = {
//   callback_id: 'user_details_part_one',
//   type: 'modal',
//   title: {
//     type: 'plain_text',
//     text: 'User Details - Part 1'
//   },
//   submit: {
//     type: 'plain_text',
//     text: 'Next'
//   },
//   close: {
//     type: "plain_text",
//     text: "Cancel",
//     emoji: true
//   },
//   blocks: [
//     {
//       type: "section",
//       text: {
//         type: "mrkdwn",
//         text: "*Part 1: Basic Information*"
//       }
//     },
//     {
//       type: "input",
//       block_id: "full_name",
//       element: {
//         type: "plain_text_input",
//         action_id: "full_name_input",
//         placeholder: {
//           type: "plain_text",
//           text: "Enter your full name"
//         },
//         min_length: 2,
//         max_length: 100
//       },
//       label: {
//         type: "plain_text",
//         text: "Full Name",
//         emoji: true
//       }
//     },
//     {
//       type: "input",
//       block_id: "email",
//       element: {
//         type: "email_text_input",
//         action_id: "email_input",
//         placeholder: {
//           type: "plain_text",
//           text: "Enter your email address"
//         }
//       },
//       label: {
//         type: "plain_text",
//         text: "Email",
//         emoji: true
//       }
//     },
//     {
//       type: "input",
//       block_id: "mobile_no",
//       element: {
//         type: "plain_text_input",
//         action_id: "mobile_no_input",
//         placeholder: {
//           type: "plain_text",
//           text: "Enter your mobile number"
//         },
//         min_length: 10,
//         max_length: 15
//       },
//       label: {
//         type: "plain_text",
//         text: "Mobile Number (10-15 digits)",
//         emoji: true
//       }
//     },
//     {
//       type: "input",
//       block_id: "age",
//       element: {
//         type: "number_input",
//         is_decimal_allowed: false,
//         action_id: "age_input",
//         placeholder: {
//           type: "plain_text",
//           text: "Enter your age"
//         },
//         min_value: "18",
//         max_value: "120"
//       },
//       label: {
//         type: "plain_text",
//         text: "Age (18 or older)",
//         emoji: true
//       }
//     }
//   ]
// };

// const partTwoModal = {
//   type: 'modal',
//   callback_id: 'user_details_part_two',
//   title: {
//     type: 'plain_text',
//     text: 'User Details - Part 2'
//   },
//   blocks: [
//     {
//       type: 'input',
//       block_id: 'height',
//       label: {
//         type: 'plain_text',
//         text: 'Height (in cm)'
//       },
//       element: {
//         type: 'number_input',
//         is_decimal_allowed: true,
//         action_id: 'height_input',
//         placeholder: {
//           type: 'plain_text',
//           text: 'Enter your height in cm'
//         },
//         min_value: "100",
//         max_value: "250"
//       }
//     },
//     {
//       type: 'input',
//       block_id: 'weight',
//       label: {
//         type: 'plain_text',
//         text: 'Weight (in kg)'
//       },
//       element: {
//         type: 'number_input',
//         is_decimal_allowed: true,
//         action_id: 'weight_input',
//         placeholder: {
//           type: 'plain_text',
//           text: 'Enter your weight in kg'
//         },
//         min_value: "30",
//         max_value: "300"
//       }
//     },
//     {
//       type: 'input',
//       block_id: 'goal',
//       label: {
//         type: 'plain_text',
//         text: 'Fitness Goals (Select at least one)'
//       },
//       element: {
//         type: 'multi_static_select',
//         action_id: 'goal_select',
//         placeholder: {
//           type: 'plain_text',
//           text: 'Select your fitness goals'
//         },
//         options: [
//           { text: { type: 'plain_text', text: 'Weight Loss' }, value: 'weight_loss' },
//           { text: { type: 'plain_text', text: 'Muscle Gain' }, value: 'muscle_gain' },
//           { text: { type: 'plain_text', text: 'Improved Flexibility' }, value: 'flexibility' },
//           { text: { type: 'plain_text', text: 'Better Endurance' }, value: 'endurance' },
//           { text: { type: 'plain_text', text: 'Overall Health' }, value: 'overall_health' }
//         ],
//         min_select: 1,
//         max_select: 5
//       }
//     },
//     {
//       type: 'input',
//       block_id: 'daily_routine',
//       label: {
//         type: 'plain_text',
//         text: 'Daily Routine'
//       },
//       element: {
//         type: 'plain_text_input',
//         action_id: 'daily_routine_input',
//         multiline: true,
//         placeholder: {
//           type: 'plain_text',
//           text: 'Describe your typical daily routine'
//         },
//         min_length: 10,
//         max_length: 1000
//       }
//     },
//     {
//       type: 'input',
//       block_id: 'allergies',
//       label: {
//         type: 'plain_text',
//         text: 'Allergies'
//       },
//       element: {
//         type: 'plain_text_input',
//         action_id: 'allergies_input',
//         multiline: true,
//         placeholder: {
//           type: 'plain_text',
//           text: 'List any allergies or food intolerances (or type "None" if not applicable)'
//         },
//         min_length: 1,
//         max_length: 500
//       }
//     },
//     {
//       type: 'input',
//       block_id: 'diet_preferences',
//       label: {
//         type: 'plain_text',
//         text: 'Diet Preferences (Select at least one)'
//       },
//       element: {
//         type: 'multi_static_select',
//         action_id: 'diet_preferences_select',
//         placeholder: {
//           type: 'plain_text',
//           text: 'Select your diet preferences'
//         },
//         options: [
//           { text: { type: 'plain_text', text: 'Vegetarian' }, value: 'vegetarian' },
//           { text: { type: 'plain_text', text: 'Vegan' }, value: 'vegan' },
//           { text: { type: 'plain_text', text: 'Pescatarian' }, value: 'pescatarian' },
//           { text: { type: 'plain_text', text: 'Keto' }, value: 'keto' },
//           { text: { type: 'plain_text', text: 'Paleo' }, value: 'paleo' },
//           { text: { type: 'plain_text', text: 'Low-carb' }, value: 'low_carb' },
//           { text: { type: 'plain_text', text: 'Mediterranean' }, value: 'mediterranean' },
//           { text: { type: 'plain_text', text: 'Gluten-free' }, value: 'gluten_free' },
//           { text: { type: 'plain_text', text: 'Dairy-free' }, value: 'dairy_free' },
//           { text: { type: 'plain_text', text: 'No restrictions' }, value: 'no_restrictions' }
//         ],
//         min_select: 1,
//         max_select: 5
//       }
//     },
//     {
//       type: 'input',
//       block_id: 'exercise_preferences',
//       label: {
//         type: 'plain_text',
//         text: 'Exercise Preferences (Select at least one)'
//       },
//       element: {
//         type: 'multi_static_select',
//         action_id: 'exercise_preferences_select',
//         placeholder: {
//           type: 'plain_text',
//           text: 'Select your exercise preferences'
//         },
//         options: [
//           { text: { type: 'plain_text', text: 'Cardio' }, value: 'cardio' },
//           { text: { type: 'plain_text', text: 'Weight Training' }, value: 'weight_training' },
//           { text: { type: 'plain_text', text: 'Yoga' }, value: 'yoga' },
//           { text: { type: 'plain_text', text: 'Pilates' }, value: 'pilates' },
//           { text: { type: 'plain_text', text: 'Swimming' }, value: 'swimming' },
//           { text: { type: 'plain_text', text: 'Running' }, value: 'running' },
//           { text: { type: 'plain_text', text: 'Cycling' }, value: 'cycling' },
//           { text: { type: 'plain_text', text: 'HIIT' }, value: 'hiit' },
//           { text: { type: 'plain_text', text: 'CrossFit' }, value: 'crossfit' },
//           { text: { type: 'plain_text', text: 'Team Sports' }, value: 'team_sports' }
//         ],
//         min_select: 1,
//         max_select: 5
//       }
//     }
//   ],
//   submit: {
//     type: 'plain_text',
//     text: 'Submit'
//   }
// };

// module.exports = { partOneModal, partTwoModal };