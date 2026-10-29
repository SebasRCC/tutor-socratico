import type { OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  EMBEDDING_DIMENSIONS,
  type IndexedChunk,
  type RetrievedChunk,
} from './rag.types';

interface SearchRow {
  id: string;
  session_id: string;
  source_id: string;
  content: string;
  source: string;
  heading: string;
  position: number;
  char_count: number;
  distance: number;
}

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

  hasChunks(sessionId: string): boolean {
    return Boolean(
      this.db
        .prepare('SELECT 1 FROM chunks WHERE session_id = ? LIMIT 1')
        .get(sessionId),
    );
  }

  search(
    sessionId: string,
    queryEmbedding: number[],
    topK: number,
  ): RetrievedChunk[] {
    const vector = new Float32Array(queryEmbedding);
    // El filtro de sesión se aplica dentro de la búsqueda vectorial, antes de topK.
    const rows = this.db
      .prepare(
        `
      SELECT c.*, e.distance FROM chunk_embeddings e
      JOIN chunks c ON c.id = e.chunk_id AND c.session_id = e.session_id
      WHERE e.embedding MATCH ? AND k = ? AND e.session_id = ?
      ORDER BY e.distance
    `,
      )
      .all(Buffer.from(vector.buffer), topK, sessionId) as SearchRow[];
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      sourceId: row.source_id,
      content: row.content,
      metadata: {
        source: row.source,
        heading: row.heading,
        position: row.position,
        charCount: row.char_count,
      },
      score: 1 - row.distance / 2,
    }));
  }

  onModuleDestroy(): void {
    this.db.close();
  }
}
