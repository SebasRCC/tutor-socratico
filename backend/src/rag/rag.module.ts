import 'dotenv/config';
import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { VectorStore } from './vector-store';

@Module({
  providers: [
    RagService,
    {
      provide: VectorStore,
      useFactory: () =>
        new VectorStore(process.env.RAG_DB_PATH || './data/session-vectors.db'),
    },
  ],
  exports: [RagService],
})
export class RagModule {}
