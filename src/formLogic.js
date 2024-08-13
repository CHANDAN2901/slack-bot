const database = require('./database');
const { partOneModal, partTwoModal } = require('./userDetailsModals');
const { startSubscriptionQuestionnaire } = require('./subscriptionLogic');

const handleUserDetailsCommand = async (client, body) => {
    try {
        const result = await client.views.open({
            trigger_id: body.trigger_id,
            view: partOneModal
        });
        console.log('User details form opened for user:', body.user.id);
        return result;
    } catch (error) {
        console.error('Error opening user details modal:', error);
        throw error;
    }
};

const handlePartOneSubmission = async (client, body, view) => {
    const userId = body.user.id;
    const userName = body.user.username;
    const values = view.state.values;

    console.log('Part One Submission received:', { userId, userName });

    const partOneData = {
        username: userName,
        full_name: values.full_name.full_name_input.value,
        email: values.email.email_input.value,
        mobile_no: values.mobile_no.mobile_no_input.value,
        age: parseInt(values.age.age_input.value),
    };

    console.log('Part One Data:', partOneData);

    const validationErrors = validatePartOne(partOneData);

    if (Object.keys(validationErrors).length > 0) {
        console.log('Validation errors in Part One:', validationErrors);
        return { response_action: "errors", errors: validationErrors };
    }

    try {
        await database.dbOps.storePartOneData(userId, partOneData);
        console.log('Part One data stored successfully for user:', userId);

        await client.chat.postMessage({
            channel: userId,
            text: "Part 1 of your profile has been successfully saved. Please complete Part 2."
        });

        return {
            response_action: "update",
            view: partTwoModal
        };
    } catch (error) {
        console.error('Error in Part One submission:', error);
        throw error;
    }
};

const handlePartTwoSubmission = async (client, body, view) => {
    const userId = body.user.id;
    const values = view.state.values;

    console.log('Part Two Submission received:', { userId });

    const partTwoData = {
        height: values.height.height_input.value,
        weight: values.weight.weight_input.value,
        goal: values.goal.goal_select.selected_options.map(option => option.value),
        daily_routine: values.daily_routine.daily_routine_input.value,
        allergies: values.allergies.allergies_input.value,
        diet_preferences: values.diet_preferences?.diet_preferences_select?.selected_options?.map(option => option.value) || [],
        exercise_preferences: values.exercise_preferences?.exercise_preferences_select?.selected_options?.map(option => option.value) || [],
    };

    console.log('Part Two Data:', partTwoData);

    const validationErrors = validatePartTwo(partTwoData);

    if (Object.keys(validationErrors).length > 0) {
        console.log('Validation errors in Part Two:', validationErrors);
        return { response_action: "errors", errors: validationErrors };
    }

    try {
        await database.dbOps.storePartTwoData(userId, partTwoData);
        console.log('Part Two data stored successfully for user:', userId);

        await client.chat.postMessage({
            channel: userId,
            text: "Thank you for completing your profile! Your information has been successfully saved and your KYC is now complete."
        });

        // console.log("Body: ", body)
        // console.log("Client: ", body.channel.id)

        await startSubscriptionQuestionnaire(client, userId, body.user);


        return { response_action: "clear" };
    } catch (error) {
        console.error('Error processing Part Two submission:', error);
        throw error;
    }
};

function validatePartOne(data) {
    const errors = {};

    if (!data.full_name || data.full_name.length < 2) {
        errors.full_name = "Full name must be at least 2 characters long.";
    }

    if (!data.email || !data.email.includes('@')) {
        errors.email = "Please provide a valid email address.";
    }

    if (!data.mobile_no || !/^\d{10}$/.test(data.mobile_no)) {
        errors.mobile_no = "Mobile number must be 10 digits.";
    }

    if (!data.age || data.age < 18 || data.age > 120) {
        errors.age = "Age must be between 18 and 120.";
    }

    return errors;
}

function validatePartTwo(data) {
    const errors = {};

    if (!data.height || isNaN(parseFloat(data.height))) {
        errors.height = "Please provide a valid height in cm.";
    }

    if (!data.weight || isNaN(parseFloat(data.weight))) {
        errors.weight = "Please provide a valid weight in kg.";
    }

    if (!data.goal || data.goal.length === 0) {
        errors.goal = "Please select at least one fitness goal.";
    }

    if (!data.daily_routine || data.daily_routine.length < 10) {
        errors.daily_routine = "Please provide more details about your daily routine.";
    }

    if (!data.allergies || data.allergies.trim().length === 0) {
        errors.allergies = "Please list your allergies or type 'None' if not applicable.";
    }

    return errors;
}

module.exports = {
    handleUserDetailsCommand,
    handlePartOneSubmission,
    handlePartTwoSubmission
};