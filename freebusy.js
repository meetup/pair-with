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

const freeTime = (primary, invites) => {
    return new Promise((resolve, reject) => {
        jwtClient.authorize(function (err, tokens) {
            if (err) {
                console.log(err);
                return;
            }
            const participants = invites.concat(primary)
            const min = new Date()
            const max = new Date(min.getTime() + (1000 * 60 * 60 * 24 * 2))
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
                        reject(`something went wrong communicating with google calendar api`)
                    }

                    // Unbookable hours is from 6pm - 10am the next day (non working hours)
                    const now = new Date()
                    const closingTime = new Date(now.setHours(18, 0, 0))
                    const openingTime = new Date(closingTime.getTime() + (1000 * 60 * 60 * 16))
                    const unbookable = [
                        {
                            start: closingTime,
                            end: openingTime
                        }
                    ]

                    const toLocalTimeBlock = (block) => {
                        return { start: block.start.toLocaleString(), end: block.end.toLocaleString() }
                    }

                    // station times
                    const transform = (email) => {
                        // Create busy time blocks from freebusy response and add "unbookable" hours
                        const busyTimes = response.calendars[email].busy.concat(unbookable).map((block) => {
                            return {
                                start: new Date(block.start),
                                end: new Date(block.end)
                            }
                        }).sort(
                            (a, b) => { return a.start - b.start }
                            )

                        // Create the opposite of the "busy" block that google returns
                        const freeTimes = [];
                        for (var i = 0; i < busyTimes.length; i++) {
                            const block = busyTimes[i]
                            const next = busyTimes[i + 1]
                            // 
                            if (next) {
                                // Add a free block of time from the end of your last meeting the start of the next meeting
                                freeTimes.push({ start: block.end, end: new Date(next.start) })
                            } else {
                                // Add a free block of time an hour long from the last meeting
                                freeTimes.push({ start: block.end, end: new Date(block.end.getTime() + (1000 * 60 * 60)) })
                            }
                        }
                        return {
                            email: email, busy: busyTimes.map(toLocalTimeBlock), free: freeTimes.map(toLocalTimeBlock)
                        }
                    }

                    const stationBusyTimes = Object.keys(stations).map(
                        transform
                    )

                    // pairer times
                    const pairerBusyTimes = participants.map(
                        transform
                    )
                    resolve({
                        stations: stationBusyTimes,
                        people: pairerBusyTimes
                    })

                    //console.table(stationBusyTimes)
                    //stationBusyTimes.forEach()

                }
            )
        })
    });
}

freeTime("doug@meetup.com", ["agaither@meetup.com"]).then((times) => {
    console.log('stations')
    console.dir(times.stations, { depth: 4, colors: true })
    console.log('people')
    console.dir(times.people, { depth: 4, colors: true })
})
