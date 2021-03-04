import { Context } from "probot";
import { EventPayloads } from "@octokit/webhooks";

import { RewardQuery } from "../../queries/RewardQuery";
import { LabelQuery } from "../../queries/LabelQuery";
import { Status } from "../../services/reply";
import { REWARDED_LABEL } from "../labels";
import { IChallengePullService } from "../../services/challenge-pull";
import { combineReplay } from "../../services/utils/ReplyUtil";
import {
  findLinkedIssueNumber,
  isValidBranch,
} from "../../services/utils/PullUtil";
import {
  ChallengePullMessage,
  ChallengePullTips,
} from "../../services/messages/ChallengePullMessage";

import {
  Config,
  DEFAULT_BRANCHES,
  DEFAULT_CONFIG_FILE_PATH,
} from "../../config/Config";

/**
 * Reward score to the PR.
 * @param context
 * @param score
 * @param challengePullService
 */
const reward = async (
  context: Context<EventPayloads.WebhookPayloadIssueComment>,
  score: number,
  challengePullService: IChallengePullService
) => {
  // Notice: because the context come form issue_comment.created, so we need to get the pull.
  const issueKey = context.issue();
  let pullResponse = null;

  try {
    pullResponse = await context.octokit.pulls.get({
      owner: issueKey.owner,
      repo: issueKey.repo,
      pull_number: issueKey.issue_number,
    });
  } catch (e) {
    context.log.error(
      `Reward pull request ${JSON.stringify(
        issueKey
      )} failed because fail to get the pull request, maybe it is an issue.`,
      e
    );
    return;
  }

  const { data: pullRequest } = pullResponse;
  const { sender } = context.payload;
  const labels: LabelQuery[] = pullRequest.labels.map((label) => {
    return {
      ...label,
    };
  });
  const { user } = pullRequest;

  const config = await context.config<Config>(DEFAULT_CONFIG_FILE_PATH, {
    branches: DEFAULT_BRANCHES,
  });
  if (!isValidBranch(config!.branches!, pullRequest.base.ref)) {
    return;
  }

  // Find linked issue assignees.
  const issueNumber = findLinkedIssueNumber(pullRequest.body);

  if (issueNumber === null) {
    await context.octokit.issues.createComment(
      context.issue({
        body: combineReplay({
          data: null,
          status: Status.Problematic,
          message: ChallengePullMessage.CanNotFindLinkedIssue,
          tip: ChallengePullTips.CanNotFindLinkedIssue,
        }),
      })
    );
    return;
  }

  const { data: issue } = await context.octokit.issues.get(issueKey);

  const issueAssignees = (issue.assignees || []).map((assignee) => {
    // TODO: Use clear type definitions for assignee.
    return {
      ...(assignee as any),
    };
  });

  const rewardQuery: RewardQuery = {
    mentor: sender.login,
    ...issueKey,
    pull: {
      ...pullRequest,
      user: user,
      labels: labels,
      createdAt: pullRequest.created_at,
      updatedAt: pullRequest.updated_at,
      closedAt: pullRequest.closed_at,
      mergedAt: pullRequest.merged_at,
      authorAssociation: pullRequest.author_association,
    },
    reward: score,
    issueAssignees,
    linkedIssueNumber: issueNumber,
  };

  const reply = await challengePullService.reward(rewardQuery);

  switch (reply.status) {
    case Status.Failed: {
      context.log.error(
        `Reward ${rewardQuery} failed because ${reply.message}.`
      );
      await context.octokit.issues.createComment(
        context.issue({ body: reply.message })
      );
      break;
    }
    case Status.Success: {
      // Add rewarded label.
      context.log.info(`Reward ${rewardQuery} success.`);
      await context.octokit.issues.addLabels(
        context.issue({ labels: [REWARDED_LABEL] })
      );
      await context.octokit.issues.createComment(
        context.issue({ body: reply.message })
      );
      break;
    }
    case Status.Problematic: {
      context.log.info(`Reward ${rewardQuery} has some problems.`);
      await context.octokit.issues.createComment(
        context.issue({ body: combineReplay(reply) })
      );
      break;
    }
  }
};

export default reward;
