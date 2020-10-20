import { Service } from "typedi";
import { InjectRepository } from "typeorm-typedi-extensions";

import { Repository } from "typeorm";
import { ChallengeProgram } from "../../db/entities/ChallengeProgram";

import { Response } from "../response";
import { StatusCodes } from "http-status-codes";

import { ChallengeProgramRankDTO } from "../dtos/ChallengeProgramRankDTO";

import { RankQuery } from "../../queries/RankQuery";
import { ChallengeTeam } from "../../db/entities/ChallengeTeam";

import ScoreRepository from "../../repositoies/score";
import { ChallengersChallengeTeams } from "../../db/entities/ChallengersChallengeTeams";
import { ChallengeProgramMessage } from "../messages/ChallengeProgramMessage";

@Service()
export default class ChallengeProgramService {
  constructor(
    @InjectRepository(ChallengeProgram)
    private challengeProgramRepository: Repository<ChallengeProgram>,
    @InjectRepository(ChallengeTeam)
    private challengeTeamRepository: Repository<ChallengeTeam>,
    @InjectRepository(ChallengersChallengeTeams)
    private challengersChallengeTeamsRepository: Repository<
      ChallengersChallengeTeams
    >,
    @InjectRepository()
    private scoreRepository: ScoreRepository
  ) {}

  public async findAll(): Promise<Response<ChallengeProgram[]>> {
    const programs = await this.challengeProgramRepository.find();

    return {
      data: programs,
      status: StatusCodes.OK,
      message: ChallengeProgramMessage.AllPrograms,
    };
  }

  private async rankingByTeam(
    challengeProgramId: number
  ): Promise<ChallengeProgramRankDTO[] | undefined> {
    const program = await this.challengeProgramRepository.findOne({
      where: {
        id: challengeProgramId,
      },
    });

    if (program === undefined) {
      return;
    }

    const teams = await this.challengeTeamRepository.find({
      where: {
        challengeProgramId: program.id,
      },
    });
    const result: ChallengeProgramRankDTO[] = [];

    for (let i = 0; i < teams.length; i++) {
      const teamMembers = await this.challengersChallengeTeamsRepository.find({
        where: {
          challengeTeamId: teams[i].id,
        },
      });
      let totalScore = 0;
      for (let j = 0; j < teamMembers.length; j++) {
        totalScore += await this.scoreRepository.getCurrentScoreInProgram(
          program.programTheme,
          teamMembers[j].challengerGithubId
        );
      }

      result.push({
        team: teams[i],
        score: totalScore,
      });
    }

    return result;
  }

  private async rankingByGithubId(
    challengeProgramId: number
  ): Promise<ChallengeProgramRankDTO[] | undefined> {
    const program = await this.challengeProgramRepository.findOne({
      where: {
        id: challengeProgramId,
      },
    });

    if (program === undefined) {
      return;
    }

    const scoreWithGithubIds = await this.scoreRepository.getCurrentScoreInProgram(
      program.programTheme
    );

    return scoreWithGithubIds.map((s) => {
      return {
        ...s,
      };
    });
  }

  /**
   * Get program ranks.
   * @param rankQuery
   */
  public async ranking(
    rankQuery: RankQuery
  ): Promise<Response<ChallengeProgramRankDTO[] | null>> {
    let ranks;

    if (rankQuery.byTeam) {
      ranks = await this.rankingByTeam(rankQuery.challengeProgramId);
    } else {
      ranks = await this.rankingByGithubId(rankQuery.challengeProgramId);
    }

    if (ranks === undefined) {
      return {
        data: null,
        status: StatusCodes.NOT_FOUND,
        message: ChallengeProgramMessage.ProgramNotExist,
      };
    }
    return {
      data: ranks,
      status: StatusCodes.OK,
      message: ChallengeProgramMessage.AllRanks,
    };
  }
}
