# Contrato de API — PoC Tutor Socrático

**Versión:** 0.1 · **Componentes:** Next.js (frontend) ↔ NestJS (backend)  
**Base de ejemplo:** `http://localhost:3001/api` (ajustable por entorno).  
**Formato:** JSON en solicitudes y respuestas, excepto carga de archivos (`multipart/form-data`).  
**Regla general:** el **frontend inicia todas las peticiones**; el backend responde a esas mismas peticiones. El frontend no consulta directamente la BD ni el LLM.

## Flujo acordado

| Paso | Acción del frontend | Endpoint | Responsabilidad del backend |
|---|---|---|---|
| 1 | Nuevo chat | `POST /sessions` | Crear sesión y devolver identificador. |
| 2 | Cargar archivo `.md` | `POST /sessions/:sessionId/sources` | Extraer texto, generar chunks/embeddings, proponer temas y objetivos. |
| 3 | Mostrar temas y objetivos | `GET /sessions/:sessionId/topics` | Consultar y devolver temas/objetivos disponibles. |
| 4 | Elegir tema y objetivo | `POST /sessions/:sessionId/learning-goal` | Guardar elección y generar **primera intervención** con RAG + LLM. |
| 5 | Seleccionar opción | `POST /sessions/:sessionId/responses` | Verificar el turno, procesar elección, registrar historial y devolver **retroalimentación + siguiente intervención**. Repetir este paso. |

> **PoC:** la ingesta del `.md` se considera síncrona: el paso 2 responde cuando el procesamiento termina. Si más adelante tarda demasiado, se definirá un estado de procesamiento y una consulta de seguimiento.

## 1. Crear sesión

**Frontend → Backend** · `POST /sessions` · cuerpo: ninguno.

**Backend → Frontend** · `201 Created`

```json
{
  "sessionId": "ses_123"
}
```

**Frontend:** conservar `sessionId` para las siguientes peticiones.

## 2. Cargar fuente académica

**Frontend → Backend** · `POST /sessions/ses_123/sources`  
**Contenido:** `multipart/form-data` con el campo **`file`** = archivo `scrum.md` (no se envía como JSON).

**Backend → Frontend** · `201 Created` (después de procesar)

```json
{
  "sourceId": "src_01",
  "name": "scrum.md",
  "chunksCount": 12
}
```

**Backend:** asociar la fuente, chunks, embeddings y temas/objetivos derivados a la sesión. **Frontend:** habilitar la consulta de temas al recibir respuesta exitosa.

## 3. Consultar temas y objetivos

**Frontend → Backend** · `GET /sessions/ses_123/topics` · cuerpo: ninguno.

**Backend → Frontend** · `200 OK`

```json
{
  "topics": [
    {
      "id": "topic_01",
      "label": "Iteraciones en Scrum",
      "objectives": [
        { "id": "obj_01", "label": "Comprender por qué Scrum trabaja en iteraciones" },
        { "id": "obj_02", "label": "Aplicar el concepto a un caso práctico" }
      ]
    },
    {
      "id": "topic_02",
      "label": "Roles de Scrum",
      "objectives": [
        { "id": "obj_03", "label": "Distinguir responsabilidades de los roles" }
      ]
    }
  ]
}
```

**Frontend:** renderizar temas y, según el tema elegido, sus objetivos. No genera opciones localmente.

## 4. Elegir tema y objetivo; recibir primera intervención

**Frontend → Backend** · `POST /sessions/ses_123/learning-goal`

```json
{
  "topicId": "topic_01",
  "objectiveId": "obj_01"
}
```

**Backend:** validar que el objetivo pertenece al tema y a la sesión; guardar selección; recuperar fragmentos pertinentes; generar y validar la primera intervención.

**Backend → Frontend** · `200 OK`

```json
{
  "sessionId": "ses_123",
  "feedback": null,
  "turn": {
    "turnId": "turn_01",
    "message": "¿Por qué Scrum utiliza iteraciones?",
    "options": [
      { "id": "opt_1", "label": "Para incorporar retroalimentación frecuente" },
      { "id": "opt_2", "label": "Para eliminar la planificación" },
      { "id": "opt_3", "label": "Para impedir cualquier cambio" }
    ],
    "sources": [
      { "sourceId": "src_01", "name": "scrum.md", "chunkId": "chunk_04" }
    ]
  }
}
```

**Frontend:** mostrar `turn.message` y `turn.options`, conservando `turn.turnId`.

## 5. Responder y continuar la tutoría

**Frontend → Backend** · `POST /sessions/ses_123/responses`

```json
{
  "turnId": "turn_01",
  "optionId": "opt_1"
}
```

**Backend:** comprobar que `turnId` es el turno actual y que `optionId` es una de sus opciones; registrar respuesta; aplicar reglas pedagógicas vigentes y utilizar LLM/RAG cuando corresponda; crear y guardar el siguiente turno.

**Backend → Frontend** · `200 OK`

```json
{
  "sessionId": "ses_123",
  "feedback": "Esa opción apunta a la retroalimentación. ¿Por qué sería útil recibirla con frecuencia?",
  "turn": {
    "turnId": "turn_02",
    "message": "¿Qué podría pasar si el equipo esperara hasta el final para recibir comentarios?",
    "options": [
      { "id": "opt_1", "label": "Detectaría problemas más tarde" },
      { "id": "opt_2", "label": "Eliminaría cualquier incertidumbre" },
      { "id": "opt_3", "label": "Ya no necesitaría revisar el producto" }
    ],
    "sources": [
      { "sourceId": "src_01", "name": "scrum.md", "chunkId": "chunk_04" }
    ]
  }
}
```

**Frontend:** mostrar `feedback` (si no es `null`) y reemplazar la intervención visible por `turn`. Repetir el paso 5 con el nuevo `turnId`.

## Consulta opcional: recuperar turno actual

Útil **solo al recargar la página**; no es necesaria después de cada POST.

`GET /sessions/ses_123/current-turn` · `200 OK`

```json
{
  "sessionId": "ses_123",
  "turn": {
    "turnId": "turn_02",
    "message": "¿Qué podría pasar si el equipo esperara hasta el final para recibir comentarios?",
    "options": [
      { "id": "opt_1", "label": "Detectaría problemas más tarde" },
      { "id": "opt_2", "label": "Eliminaría cualquier incertidumbre" },
      { "id": "opt_3", "label": "Ya no necesitaría revisar el producto" }
    ],
    "sources": [
      { "sourceId": "src_01", "name": "scrum.md", "chunkId": "chunk_04" }
    ]
  }
}
```

## Acuerdos mínimos

- **`sessionId`**: identifica la sesión completa. **`turnId`**: identifica una pregunta/intervención particular. **`optionId`**: identifica una opción dentro de ese turno.
- **Una intervención en la PoC contiene exactamente tres opciones**. Los IDs los genera el backend; el frontend envía los IDs, no el texto visible.
- **El backend es dueño del estado y del historial**. El frontend solo representa los datos y transmite elecciones; el LLM no modifica directamente la base de datos.
- **Sin campo `phase` por ahora**: las fases y reglas pedagógicas aún deben formalizarse. `feedback` no equivale a una calificación ni garantiza comprensión.
- **Errores JSON**, con formato común, por ejemplo `400` (datos inválidos), `404` (sesión inexistente) o `409` (turno ya respondido):

```json
{
  "error": {
    "code": "TURN_NOT_CURRENT",
    "message": "La intervención ya fue respondida o no es la actual"
  }
}
```

- Si no hay fragmentos académicos suficientes, **no inventar una intervención fundamentada**: responder con un error controlado (ejemplo `422`, `code: "INSUFFICIENT_CONTEXT"`).
- **Fuera de esta versión del contrato:** autenticación, streaming, WebSockets, procesamiento asíncrono de fuentes, cierre formal de tutoría y modelado definitivo de reglas/fases pedagógicas.
