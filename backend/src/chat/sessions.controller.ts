// sessions.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { SelectLearningGoalDto } from './dto/select-learning-goal.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import type { TutorResponseDto } from './dto/session-responses.dto';
import { SessionsService } from './sessions.service';
import { RagService } from '../rag/rag.service';
import { LlmService } from '../llm/llm.service';
import { TutorService } from './tutor.service';

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly ragService: RagService,
    private readonly llmService: LlmService,
    private readonly tutorService: TutorService,
  ) {}

  @Post(':sessionId/sources')
  @UseInterceptors(
    FileInterceptor('file', { limits: { files: 1, fileSize: 1024 * 1024 } }),
  )
  async uploadSource(
    @Param('sessionId') sessionId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    this.sessionsService.getSession(sessionId);
    const { academicText, ...source } = await this.ragService.indexSource(
      sessionId,
      file,
    );
    const topics = await this.llmService.generateTopics(academicText);
    this.sessionsService.saveTopics(sessionId, topics);
    return source;
  }

  @Get(':sessionId/topics')
  getTopics(@Param('sessionId') sessionId: string) {
    return { topics: this.sessionsService.getTopics(sessionId) };
  }

  @Post()
  createSession() {
    const session = this.sessionsService.createSession();
    return { sessionId: session.sessionId };
  }

  @Post(':sessionId/learning-goal')
  @HttpCode(200)
  selectGoal(
    @Param('sessionId') sessionId: string,
    @Body() dto: SelectLearningGoalDto,
  ): Promise<TutorResponseDto> {
    return this.tutorService.start(sessionId, dto);
  }

  @Post(':sessionId/responses')
  @HttpCode(200)
  respond(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitResponseDto,
  ): Promise<TutorResponseDto> {
    return this.tutorService.respond(sessionId, dto);
  }

  @Get(':sessionId/current-turn')
  getCurrentTurn(
    @Param('sessionId') sessionId: string,
  ): Pick<TutorResponseDto, 'sessionId' | 'turn'> {
    return { sessionId, turn: this.sessionsService.getCurrentTurn(sessionId) };
  }
}
