'use strict';

require('dotenv').config()

// slack api
// https://github.com/slackapi/node-slack-sdk#posting-a-message-with-web-api
const WebClient = require('@slack/client').WebClient
const IncomingWebhook = require('@slack/client').IncomingWebhook
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
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
    if (emails.length < 1) {
      resolve({
        text: `Failed to find email addresses associated with ${cmd.text}.`
      })
      return
    }
    google.bookTime(mentiondb["@" + cmd.user_name], emails)
      .then((calendarResponse) => {
        resolve({
          text: `all set. you can change your pair session here <${calendarResponse.htmlLink}|here>`
        })
      })
      .catch(
      (err) => {
        console.log("error")
        console.log(err)
        resolve({
          text: `failed to book a room with ${cmd.text}: ${err}`
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
      /*return new Promise(
        (resolve, reject) => {
          resolve(res.json({
            text: `finding you some space`
          }))
        }
      ).then(
        (serverResponse) => {*/
      //console.log("following up with actual command")
      //const webhook = new IncomingWebhook(cmd.response_url)
      return command(cmd).then(
        (payload) => {
          console.log("responding with...")
          console.dir(payload, { depth: 4, colors: true })
          res.json(payload)
          /*webhook.send(payload, function (err, header, statusCode, body) {
            if (err) {
              console.log('Error:', err);
            } else {
              console.log('Received', statusCode, 'from Slack');
            }
          })*/
        }
      ).catch(
        (err) => {
          console.log("responding with error")
          console.dir(err, { depth: 4, colors: true })
          res.json(payload)
          /*webhook.send({ text: err.toString() }, function (err, header, statusCode, body) {
            if (err) {
              console.log('Error:', err);
            } else {
              console.log('Received', statusCode, 'from Slack');
            }
          })*/
        }
        )
    }
    ).catch(
    (err) => {
      console.log("command failed with error")
      console.dir(err, { depth: 4, colors: true })
      res.json({ text: err })
    }
    )
}
