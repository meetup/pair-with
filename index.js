'use strict';

require('dotenv').config()

// slack api
// https://github.com/slackapi/node-slack-sdk#posting-a-message-with-web-api
var WebClient = require('@slack/client').WebClient
var slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const mentiondb = require('./mentiondb.json')

// google api
const google = require('googleapis');
const calendar = google.calendar('v3')
const key = require('./credentials.json')

// fixme: may need to respond quickly or slack ui will error out

// 2 parse @mention names from cmd.text ( may need bot api credential )
// https://github.com/slackapi/node-slack-sdk add npm slack client

// 3 add freebusy api call including pair stations + @mentions ...

// 4 make google api call to create calendar entry

// 5 profit


// return promise resolving to
// successful message payload or string error
const command = (cmd) => {
  return new Promise((resolve, reject) => {
    const mentions = cmd.text.trim().split(/\s+/)
    const emails = mentions.reduce(
      (acc, mention) => {
        const email = mentiondb[mention]
        if (email) {
          acc.push(email)
          return acc
        }
      }, []
    )
    resolve({
      text: `test ${emails}`
    })
  })
}

// authenticate request
const authenticate = (payload) => {
  return new Promise((resolve, reject) => {
    if (process.env.SLACK_SLASH_TOKEN == payload.token) {
      resolve(payload)
    } else {
      reject("Invalid token")
    }
  })
}

// cloud function module export
module.exports.pairWith = (req, res) => {
  return authenticate(req.body)
    .then((cmd) => {
      command(cmd).then(
        (payload) => res.json(payload)
      )
    }).catch(
    (err) => res.json({ text: err })
    )
}
