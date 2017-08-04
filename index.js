'use strict';

require('dotenv').config()

// slack api
// https://github.com/slackapi/node-slack-sdk#posting-a-message-with-web-api
var WebClient = require('@slack/client').WebClient
var slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const mentiondb = require('./mentiondb.json')

// google interface
const google = require("./freebusy.js")

// fixme: may need to respond quickly or slack ui will error out

// 3 add freebusy api call including pair stations + @mentions ...

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
        }
        return acc
      }, []
    )
    google.bookTime(mentiondb[cmd.user_name], emails)
      .then((calendarResponse) => {
        resolve({
          text: `all set. you can change your pair session here <${calendarResponse.htmlLink}|here>`
        })
      })
      .catch(
      (err) => {
        resolve({
          text: `failed to book a room with ${cmd.text}`
        })
      }
      )

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
