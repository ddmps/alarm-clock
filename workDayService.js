const rp = require('request-promise');
const arbetsdagApiKey = require('./config.json')["arbetsdag-api-key"];

async function isNextTimeWorkDay(time) {
    const now = new Date();
    const milliSecondsIntoDay = Date.parse('1970-01-01T' + time);
    const day = milliSecondsIntoDay >= now % (60*60*24*1000) ? 'today' : 'imorgon';
    let req;
    try {
        req = await rp(`https://api.arbetsdag.se//v1/dagar.json?key=${arbetsdagApiKey}&id=1234&fran=${day}&till=${day}`);
        if (!req || req.status && req.status !== "OK") {
            console.error("Something went wrong with arbetsdag api call, response:", req);
        } else return req.antal_arbetsdagar && req.antal_arbetsdagar === 1;
    } catch (e) {
        console.error("Something went wrong with arbetsdag api call", e);
    }
    // fallback to only non-saturday/sunday being workday
    return now.getDay() % 6 > 0;//Hard to understand, right? So is understanding why Sunday is the first day of the week
}

module.exports = {
    isNextTimeWorkDay: isNextTimeWorkDay
};