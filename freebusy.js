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

const debug = (obj) => {
    //console.dir(obj, { depth: 4, colors: true })
    console.log(obj)
}

const intersection = (blockA, blockB) => {
    var start = blockA.start
    var end = blockA.end
    var oStart = blockB.start
    var oEnd = blockB.end
    if ((start <= oStart) && (oStart < end) && (end < oEnd)) {
        return { start: oStart, end: end }
    }
    else if ((oStart < start) && (start < oEnd) && (oEnd <= end)) {
        return { start: start, end: oEnd }
    }
    else if ((oStart < start) && (start <= end) && (end < oEnd)) {
        return blockA
    }
    else if ((start <= oStart) && (oStart <= oEnd) && (oEnd <= end)) {
        return blockB
    }
}

const findFreeTimes = (primary, invites) => {
    return new Promise((resolve, reject) => {
        console.log("finding free times for primary email " + primary)
        console.log("and invites")
        console.log(invites)
        jwtClient.authorize(function (err, tokens) {
            if (err) {
                console.log(err);
                reject(`something went wrong authenticating with google`)
                return;
            }
            console.log("authenticated client")
            const participants = [primary].concat(invites)
            const min = new Date()
            const max = new Date(min.getTime() + (1000 * 60 * 60 * 24 * 2))
            console.log("finding freebusy time")
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
                    console.log("got freebusy response from google")
                    if (err) {
                        console.log("error communicating with google freeBusy.query")
                        console.log(err)
                        reject(`something went wrong communicating with google calendar api`)
                        return
                    }
                    debug(response)

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
                        console.log("transforming email " + email)
                        debug(response.calendars[email])
                        // Create busy time blocks from freebusy response and add "unbookable" hours
                        // Make sure the time is added in so it's sorted
                        var busyTimes = response.calendars[email].busy.concat(unbookable).map((block) => {
                            return {
                                start: new Date(block.start),
                                end: new Date(block.end)
                            }
                        }).sort(
                            (a, b) => { return a.start - b.start }
                            )

                        // Create the opposite of the "busy" block that google returns
                        var freeTimes = []
                        // If the next time your busy is in the future and now is
                        // in between opening and closing time, add some free time
                        if (busyTimes[0].start > now && now < closingTime && now > openingTime) {
                            console.log("free today")
                            freeTimes.push({
                                start: now,
                                end: Math.min(new Date(busyTimes[0].start, closingTime))
                            })
                        }
                        // Find the gaps in busy times to create "free times" blocks
                        for (var i = 0; i < busyTimes.length; i++) {
                            var block = busyTimes[i]
                            var next = busyTimes[i + 1]
                            if (next) {
                                var nextStart = new Date(next.start)
                                // not back to back
                                if (block.end.toLocaleString() != nextStart.toLocaleString()) {
                                    // Add a free block of time from the end of your last meeting the start of the next meeting
                                    freeTimes.push({ start: block.end, end: nextStart })
                                } else {

                                }
                            } else {
                                freeTimes.push({ start: block.end, end: closingTime })
                            }
                        }
                        return {
                            email: email, busy: busyTimes, free: freeTimes
                        }
                    }
                    console.log("resolving times for the following")
                    console.log("stations")
                    console.log(Object.keys(stations))
                    console.log("people")
                    console.log(participants)
                    resolve({
                        stations: Object.keys(stations).map(
                            transform
                        ),
                        people: participants.map(
                            transform
                        )
                    })
                }
            )
        })
    });
}

// find the list of overlapping free times between the first person and all other people
const findOverlaps = (times) => {
    return new Promise(
        (resolve, reject) => {
            console.log("finding overlaps")
            const firstPerson = times.people[0]
            var overlaps = []
            for (var i = 1; i < times.people.length; i++) {
                var other = times.people[i]
                overlaps = overlaps.concat(
                    firstPerson.free.reduce((acc, firstBlock) => {
                        other.free.forEach(
                            (otherBlock) => {
                                var intersect = intersection(firstBlock, otherBlock)
                                if (intersect) {
                                    acc.push(intersect)
                                }
                            }
                        )

                        return acc
                    }, [])
                )
            }
            console.log("resolving to times and overlaps")
            resolve({ times: times, overlaps: overlaps })
        }
    )
}

// find the first station with an overlapping open time

const findStation = (overlapResults) => {
    return new Promise(
        (resolve, reject) => {
            console.log("finding station")
            const times = overlapResults.times
            const overlaps = overlapResults.overlaps
            // find the first station that is open during one of these blocks of time
            if (!overlaps) {
                console.log("no people overlaps. skipping station selection")
                resolve()
                return
            }
            var stationTimes = []
            console.log("overlaps")
            debug(overlaps)
            console.log("station times")
            debug(times.stations)
            overlaps.forEach(
                (overlap) => {
                    times.stations.forEach(
                        (station) => {
                            station.free.forEach(
                                (stationBlock) => {
                                    var start = overlap.start
                                    var end = overlap.end
                                    var oStart = stationBlock.start
                                    var oEnd = stationBlock.end
                                    if ((start <= oStart) && (oStart < end) && (end < oEnd)) {
                                        resolve({
                                            station: station.email,
                                            time: { start: oStart, end: end }
                                        })
                                        return
                                    }
                                    else if ((oStart < start) && (start < oEnd) && (oEnd <= end)) {
                                        resolve({
                                            station: station.email,
                                            time: { start: start, end: oEnd }
                                        })
                                        return
                                    }
                                    else if ((oStart < start) && (start <= end) && (end < oEnd)) {
                                        resolve({
                                            station: station.email,
                                            time: firstBlock
                                        })
                                        return
                                    }
                                    else if ((start <= oStart) && (oStart <= oEnd) && (oEnd <= end)) {
                                        resolve({
                                            station: station.email,
                                            time: otherBlock
                                        })
                                        return
                                    }
                                }
                            )
                        }
                    )
                }
            )
            resolve()
        }
    )
}




// returns promising resolving to response from calendar events insert api
module.exports.bookTime = (primary, invites) => {
    return findFreeTimes(primary, invites).then(findOverlaps).then(findStation)
        .then((stationResult) => {
            return new Promise(
                (resolve, reject) => {
                    console.log("booking time")
                    debug(stationResult)
                    // book it
                    if (stationResult) {
                        const eventParams = {
                            summary: "pair time!",
                            start: {
                                dateTime: stationResult.time.start.toISOString(),
                                timeZone: 'US/Eastern'
                            },
                            end: {
                                dateTime: stationResult.time.end.toISOString(),
                                timeZone: 'US/Eastern'
                            },
                            attendees: invites.concat(primary).map(
                                (email) => { return { email: email } }
                            ).concat([
                                { email: stationResult.station }
                            ])
                        }
                        debug(eventParams)
                        // book it!
                        console.log("booking event")
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
                                    debug(response)
                                    resolve(response)
                                }
                            }
                        )
                    } else {
                        console.log("no overlap")
                        reject("no overlap")
                    }
                })
        })
}