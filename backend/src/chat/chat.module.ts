import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { RagModule } from '../rag/rag.module';
import { LlmModule } from '../llm/llm.module';
import { TutorService } from './tutor.service';

@Module({
  imports: [RagModule, LlmModule],
  controllers: [SessionsController],
  providers: [SessionsService, TutorService],
})
export class ChatModule {}
