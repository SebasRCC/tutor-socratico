import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LlmService } from '../llm/llm.service';
import { RagService } from '../rag/rag.service';
import { SessionsService } from './sessions.service';
import type { SelectLearningGoalDto } from './dto/select-learning-goal.dto';
import type { TutorResponseDto } from './dto/session-responses.dto';

@Injectable()
export class TutorService {
  constructor(
    private readonly sessions: SessionsService,
    private readonly rag: RagService,
    private readonly llm: LlmService,
  ) {}

  async start(
    sessionId: string,
    selection: SelectLearningGoalDto,
  ): Promise<TutorResponseDto> {
    const { topic, objective } = this.sessions.validateLearningGoal(
      sessionId,
      selection,
    );
    const chunks = await this.rag.retrieveContext(
      sessionId,
      `${topic.label}\n${objective.label}`,
    );
    const generated = await this.llm.generateIntervention(
      topic.label,
      objective.label,
      chunks.map((chunk) => `${chunk.metadata.heading}\n${chunk.content}`),
    );
    const response: TutorResponseDto = {
      sessionId,
      feedback: null,
      turn: {
        turnId: randomUUID(),
        message: generated.message,
        options: generated.options.map((option) => ({
          id: randomUUID(),
          label: option.label,
        })),
        sources: chunks.map((chunk) => ({
          sourceId: chunk.sourceId,
          name: chunk.metadata.source,
          chunkId: chunk.id,
        })),
      },
    };
    // Se vuelve a comprobar la selección por si cambió el catálogo durante la generación.
    // Desde aquí, la selección y el turno se guardan juntos, sin operaciones asíncronas.
    this.sessions.selectLearningGoal(sessionId, selection);
    return this.sessions.saveTurn(response);
  }
}
