const google = require('googleapis');
const calendar = google.calendar('v3')
const key = require('./credentials.json')
// require gsuite admin -> security -> show more -> Advanced settings -> Authentication -> Manage API client access -> Client Name == Client ID
// ask for https://www.googleapis.com/auth/calendar scope
// https://developers.google.com/identity/protocols/OAuth2ServiceAccount?hl=en_US#delegatingauthority

const stations = require("./stationdb.json")

const jwtClient = new google.auth.JWT(
    key.client_email,
    null, // keyfile
    key.private_key,
    ['https://www.googleapis.com/auth/calendar'], // an array of auth scopes
    "doug@meetup.com" // subject
);

jwtClient.authorize(function (err, tokens) {
    if (err) {
        console.log(err);
        return;
    }
    const min = new Date()
    const max = new Date(min.getTime() + (1000 * 60 * 60 * 24))
    const participants = [
        "doug@meetup.com",
        "icorbett@meetup.com"
    ];
    calendar.freebusy.query(
        {
            auth: jwtClient,
            resource: {
                items: Object.keys(stations).concat(participants).map((cal) => {
                    return { id: cal }
                }),
                timeMin: min.toISOString(),
                timeMax: max.toISOString()
            }
        },
        function freeBusyHandler(err, response) {
            if (err) {
                console.log(err)
                return
            }
            console.log(response)
            Object.keys(response.calendars).forEach((cal) => {
                console.log(stations[cal] || cal)
                const calendars = response.calendars[cal]
                console.log(calendars.busy)
            })
        }
    )

});