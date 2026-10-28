import type { OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { EMBEDDING_DIMENSIONS, type IndexedChunk } from './rag.types';

export class VectorStore implements OnModuleDestroy {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    sqliteVec.load(this.db);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        heading TEXT NOT NULL,
        position INTEGER NOT NULL,
        char_count INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS chunks_session_source ON chunks(session_id, source_id);
      CREATE VIRTUAL TABLE IF NOT EXISTS chunk_embeddings USING vec0 (
        chunk_id TEXT PRIMARY KEY,
        session_id TEXT PARTITION KEY,
        source_id TEXT,
        embedding float[${EMBEDDING_DIMENSIONS}]
      );
    `);
  }

  insert(chunk: IndexedChunk, embedding: number[]): void {
    if (
      embedding.length !== EMBEDDING_DIMENSIONS ||
      !embedding.every(Number.isFinite)
    ) {
      throw new Error('El vector no tiene el formato esperado');
    }
    this.db.transaction(() => {
      this.db
        .prepare(
          `
        INSERT INTO chunks
        (id, session_id, source_id, content, source, heading, position, char_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          chunk.id,
          chunk.sessionId,
          chunk.sourceId,
          chunk.content,
          chunk.metadata.source,
          chunk.metadata.heading,
          chunk.metadata.position,
          chunk.metadata.charCount,
        );
      const vector = new Float32Array(embedding);
      this.db
        .prepare(
          `
        INSERT INTO chunk_embeddings (chunk_id, session_id, source_id, embedding)
        VALUES (?, ?, ?, ?)
      `,
        )
        .run(
          chunk.id,
          chunk.sessionId,
          chunk.sourceId,
          Buffer.from(vector.buffer),
        );
    })();
  }

  insertSource(chunks: IndexedChunk[], embeddings: number[][]): void {
    if (chunks.length !== embeddings.length) {
      throw new Error('Cada fragmento debe tener un vector');
    }
    // La fuente completa se guarda o se revierte, sin tocar otras fuentes.
    this.db.transaction(() => {
      chunks.forEach((chunk, index) => this.insert(chunk, embeddings[index]));
    })();
  }

  onModuleDestroy(): void {
    this.db.close();
  }
}
