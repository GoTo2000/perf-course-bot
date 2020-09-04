// eslint-disable-next-line no-unused-vars
import { Application, Context } from 'probot'
import { createConnection, useContainer } from 'typeorm'
import { Container } from 'typedi'

import pickUp from './commands/pick-up'
import giveUp from './commands/give-up'
import reward from './commands/reward'
import { handlePullClosed } from './events/pull-close'
import help from './commands/help'

import 'reflect-metadata'
import autoGiveUp from './tasks/auto-give-up'
import AutoGiveUpService from './services/auto-give-up'
import IssueService from './services/issue'
import ChallengeIssueService from './services/challenge-issue'
import handleIssueEvents from './events/issues'
import ChallengePullService from './services/challenge-pull'

const commands = require('probot-commands-pro')
const createScheduler = require('probot-scheduler')

export = (app: Application) => {
  useContainer(Container)

  createScheduler(app)

  app.log.target.addStream({
    type: 'rotating-file',
    path: './bot-logs/ti-challenge-bot.log',
    period: '1d', // daily rotation
    count: 10 // keep 10 back copies
  })

  createConnection().then(() => {
    app.log.info('App starting...')

    commands(app, 'ping', async (context: Context) => {
      await context.github.issues.createComment(context.issue({ body: 'pong! I am challenge bot.' }))
    })

    commands(app, 'help', async (context: Context) => {
      await help(context)
    })

    commands(app, 'pick-up', async (context: Context) => {
      await pickUp(context, Container.get(ChallengeIssueService))
    })

    commands(app, 'give-up', async (context: Context) => {
      await giveUp(context, Container.get(ChallengeIssueService))
    })

    commands(app, 'reward', async (context: Context, command: { arguments: string }) => {
      const rewardData = command.arguments
      const rewardValue = Number(rewardData)
      if (!Number.isInteger(rewardValue)) {
        await context.github.issues.createComment(context.issue({ body: 'The reward invalid.' }))
        return
      }

      await reward(context, rewardValue, Container.get(ChallengePullService))
    })

    app.on('issues', async (context:Context) => {
      await handleIssueEvents(context, Container.get(IssueService), Container.get(ChallengeIssueService))
    })

    app.on('pull_request.closed', async (context:Context) => {
      await handlePullClosed(context, Container.get(ChallengePullService))
    })

    app.on('schedule.repository', async (context: Context) => {
      app.log.info('Scheduling coming...')
      await autoGiveUp(context, Container.get(AutoGiveUpService))
    })
  }).catch(err => {
    app.log.fatal('Connect to db failed', err)
  })
}
