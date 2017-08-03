'use strict';

const proxyquire = require(`proxyquire`).noCallThru();
const sinon = require(`sinon`);
const test = require(`ava`);


function getSample () {
  return {
    program: proxyquire(`../`, {
      // fill in overrides here
    })
  };
}

test(`responds to commands`, (t) => {
  process.env.SLACK_SLASH_TOKEN = 't3stTok3n'
  const request = sinon.stub()
  const response = {
    json: sinon.spy(),
    status: sinon.spy()
  }
  request.body = {
    token: process.env.SLACK_SLASH_TOKEN,
    team_id: 'T0001',
    team_domain: 'example',
    enterprise_id: 'E0001',
    enterprise_name:'Globular%20Construct%20Inc',
    channel_id:'C2147483705',
    channel_name:'test',
    user_id:'U2147483697',
    user_name:'Steve',
    command:'/weather',
    text:'94070',
    response_url:'https://hooks.slack.com/commands/1234/5678'
  }
  const sample = getSample()
  return sample.program.pairWith(request, response).then(() => {
    t.true(response.json.calledWith({
      text: `Well hello there ${request.body.user_name}. Looks like you figured this much out. Go <https://api.slack.com/slash-commands|here> next`
    }))
  })
});
