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
import { randomUUID } from 'node:crypto';
import { SelectLearningGoalDto } from './dto/select-learning-goal.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';
import type { TutorResponseDto } from './dto/session-responses.dto';
import { SessionsService } from './sessions.service';
import { RagService } from '../rag/rag.service';
import { LlmService } from '../llm/llm.service';

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly ragService: RagService,
    private readonly llmService: LlmService,
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
  ): TutorResponseDto {
    this.sessionsService.selectLearningGoal(sessionId, dto);
    return this.sessionsService.saveTurn(this.mockTurn(sessionId, null));
  }

  @Post(':sessionId/responses')
  @HttpCode(200)
  respond(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitResponseDto,
  ): TutorResponseDto {
    this.sessionsService.registerResponse(sessionId, dto);
    return this.sessionsService.saveTurn(
      this.mockTurn(sessionId, 'Retroalimentación de prueba.'),
    );
  }

  @Get(':sessionId/current-turn')
  getCurrentTurn(
    @Param('sessionId') sessionId: string,
  ): Pick<TutorResponseDto, 'sessionId' | 'turn'> {
    return { sessionId, turn: this.sessionsService.getCurrentTurn(sessionId) };
  }

  private mockTurn(
    sessionId: string,
    feedback: string | null,
  ): TutorResponseDto {
    return {
      sessionId,
      feedback,
      turn: {
        turnId: randomUUID(),
        message: '¿Quién responde por maximizar el valor del producto?',
        options: [
          { id: 'opt_1', label: 'Product Owner' },
          { id: 'opt_2', label: 'Scrum Master' },
          { id: 'opt_3', label: 'Developers' },
        ],
        sources: [],
      },
    };
  }
}
