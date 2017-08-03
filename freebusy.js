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

const toLocalTimeBlock = (block) => {
    return { start: block.start.toLocaleString(), end: block.end.toLocaleString() }
}

const freeTime = (primary, invites) => {
    return new Promise((resolve, reject) => {
        jwtClient.authorize(function (err, tokens) {
            if (err) {
                console.log(err);
                return;
            }
            const participants = [primary].concat(invites)
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

                    const transform = (email) => {
                        // Create busy time blocks from freebusy response and add "unbookable" hours
                        // Make sure the time is added in so it's sorted
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
                        if (busyTimes[0].start > new Date()) {
                            freeTimes.push({ start: new Date(), end: busyTimes[0].start })
                        }
                        // Find the gaps in busy times to create "free times" blocks
                        for (var i = 0; i < busyTimes.length; i++) {
                            const block = busyTimes[i]
                            const next = busyTimes[i + 1]
                            if (next) {
                                // Add a free block of time from the end of your last meeting the start of the next meeting
                                freeTimes.push({ start: block.end, end: new Date(next.start) })
                            } else {
                                // Add a free block of time until the end of the day after the last meeting
                                freeTimes.push({ start: block.end, end: closingTime })
                            }
                        }
                        return {
                            email: email, busy: busyTimes, free: freeTimes
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
                }
            )
        })
    });
}

//module.exports.freeTime = freeTime

// returns promising resolving to response from calendar events insert api
module.exports.bookTime = (primary, invites) => {
    return freeTime(primary, invites).then((times) => {
        return new Promise(
            (resolve, reject) => {
                // find the list of overlapping free times between the first person and all other people
                const firstPerson = times.people[0]
                const secondPerson = times.people[1]
                console.log("first person free")
                console.dir(firstPerson.free.map(toLocalTimeBlock), { depth: 4, colors: true })

                console.log("second person free")
                console.dir(secondPerson.free.map(toLocalTimeBlock), { depth: 4, colors: true })

                // const overlap = first.free[0].start >= second.free[0].start && first.free[0].end <= second.free[1].end)
                var overlaps = []
                for (var i = 1; i < times.people.length; i++) {
                    const other = times.people[i]


                    overlaps = overlaps.concat(
                        firstPerson.free.reduce((acc, firstBlock) => {
                            const overlap = other.free.find(
                                (otherBlock) => {
                                    return firstBlock.start <= otherBlock.start && firstBlock.end >= otherBlock.end
                                }
                            );
                            if (overlap) {
                                acc.push(
                                    {
                                        start: new Date(Math.max(firstBlock.start, overlap.start)),
                                        end: new Date(Math.min(firstBlock.end, overlap.end))
                                    }
                                )
                            }
                            return acc
                        }, [])
                    )
                }

                // find a station
                const station = times.stations[0]

                // book it
                const overlap = overlaps[0]
                if (overlap) {
                    const eventParams = {
                        summary: "pair time!",
                        start: {
                            dateTime: overlap.start.toISOString(),
                            timeZone: 'US/Eastern'
                        },
                        end: {
                            dateTime: overlap.end.toISOString(),
                            timeZone: 'US/Eastern'
                        },
                        attendees: times.people.map(
                            (person) => { return { email: person.email } }
                        ).concat([
                            { email: station.email }
                        ])
                    }
                    console.dir(eventParams, { depth: 4, colors: true })

                    calendar.events.insert(
                        {
                            auth: jwtClient,
                            calendarId: "primary",
                            sendNotifications: true,
                            resource: eventParams
                        },
                        (err, response) => {
                            if (err) {
                                console.log("error")
                                console.log(err)
                                reject("error booking event")
                            } else {
                                console.log(response)
                                resolve(response)
                            }
                        }
                    )
                } else {
                    reject("no overlap")
                }
            })
    })
}
