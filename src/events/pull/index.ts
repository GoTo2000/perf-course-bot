// eslint-disable-next-line no-unused-vars
import { Context } from 'probot'

// eslint-disable-next-line no-unused-vars
import { PullPayload } from '../payloads/PullPayload'
// eslint-disable-next-line no-unused-vars
import { LabelQuery } from '../../commands/queries/LabelQuery'
// eslint-disable-next-line no-unused-vars
import { Status } from '../../services/reply'
// eslint-disable-next-line no-unused-vars
import ChallengePullService from '../../services/challenge-pull'
import { combineReplay } from '../../services/utils/ReplyUtil'

const handlePullClosed = async (context: Context, challengePullService: ChallengePullService) => {
  const { pull_request: pullRequest } = context.payload
  const labels: LabelQuery[] = pullRequest.labels.map((label: LabelQuery) => {
    return {
      ...label
    }
  })
  const { payload } = context
  const { user } = pullRequest

  const pullPayload: PullPayload = {
    ...payload,
    pull: {
      ...pullRequest,
      user: {
        ...user
      },
      labels: labels,
      createdAt: pullRequest.created_at,
      updatedAt: pullRequest.updated_at,
      closedAt: pullRequest.closed_at,
      mergedAt: pullRequest.merged_at,
      authorAssociation: pullRequest.author_association
    }
  }

  const reply = await challengePullService.countScoreWhenPullClosed(pullPayload)
  if (reply === undefined) {
    context.log.trace(`Do not need to count ${pullPayload}.`)
    return
  }

  switch (reply.status) {
    case Status.Failed: {
      context.log.error(`Count ${pullPayload} failed because ${reply.message}.`)
      await context.github.issues.createComment(context.issue({ body: reply.message }))
      break
    }
    case Status.Success: {
      context.log.info(`Count ${pullPayload} success.`)
      await context.github.issues.createComment(context.issue({ body: reply.message }))
      break
    }
    case Status.Problematic: {
      context.log.warn(`Count ${pullPayload} has some problems.`)
      await context.github.issues.createComment(context.issue({ body: combineReplay(reply) }))
      break
    }
  }
}

export { handlePullClosed }
