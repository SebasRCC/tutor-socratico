# Proceso de construcción del backend

Guía incremental del tutor socrático. Cada paso registra qué se incorporó y cómo cambió el flujo. En los próximos avances, añadir una etapa con los cambios, su origen y las comprobaciones realizadas.

## 1. Definir la estructura y los módulos

Partimos de la base de NestJS y organizamos `src/` en `chat/`, `llm/` y `rag/`. Creamos los archivos previstos para controladores, servicios, DTOs, historial y prompts, inicialmente vacíos, conservando la base existente.

Copiamos los documentos existentes a `docs/api-contract.md` y `docs/academic/scrum.md`. El contrato orienta las rutas y los formatos; Scrum queda como material para una futura prueba académica.

En esta etapa se preparó la estructura: todavía no había gestión de sesiones ni integración con LLM o RAG.

## 2. Definir los endpoints con respuestas simuladas

Se incorporó `SessionsController` con las primeras rutas del contrato:

- `POST /sessions`: devolver un identificador generado.
- `POST /sessions/:sessionId/learning-goal`: devolver una pregunta simulada con tres opciones.
- `POST /sessions/:sessionId/responses`: devolver feedback y otra intervención simulada.

El flujo inicial era **crear identificador → seleccionar objetivo → responder**. Las respuestas tenían el formato esperado, pero todavía no se guardaban sesiones, elecciones ni historial.

## 3. Definir los DTOs y activar la validación

Se añadieron los tipos de entrada y salida en `chat/dto/`:

- `SelectLearningGoalDto`: `topicId` y `objectiveId`, cadenas no vacías.
- `SubmitResponseDto`: `turnId` y `optionId`, cadenas no vacías.
- `TutorResponseDto`, en `session-responses.dto.ts`: formato de salida con `sessionId`, `feedback` y `turn` (pregunta, opciones y fuentes).

Instalamos `class-validator` y `class-transformer`. En `main.ts` configuramos el prefijo `/api` y `ValidationPipe` con `whitelist: true` y `forbidNonWhitelisted: true`: los datos inválidos y campos adicionales se rechazan con `400`.

Registramos `SessionsController` en `ChatModule` e importamos ese módulo en `AppModule`. También corregimos la importación del DTO de salida y retiramos referencias a `AppController` y `AppService`, cuyos archivos ya no existían.

Comprobamos la compilación, las rutas bajo `/api` y el rechazo de campos faltantes, adicionales, vacíos o de tipo incorrecto. Las intervenciones seguían siendo simuladas.

## 4. Añadir sesiones e historial reales en memoria

Adaptamos `src/chat/conversation.ts` de la copia local del [repositorio Dev-assistant](https://github.com/alexisv-275/Dev-assistant). Reutilizamos el arreglo de mensajes, el formato `{ role, content }` y los métodos `addUserMessage()`, `addAssistantMessage()` y `getHistory()`. Este último devuelve copias de los mensajes para proteger el historial. No incorporamos llamadas a Claude, streaming, estadísticas de tokens ni contexto académico.

Creamos dos piezas nuevas, que no vienen del repositorio:

- `session.types.ts`: define `Session` con identificador, una `Conversation` propia, `topicId`, `objectiveId` y `currentTurn`. La selección y el turno comienzan en `null`.
- `sessions.service.ts`: mantiene un `Map` por `sessionId`; crea y busca sesiones, guarda la selección y el turno, y valida y registra respuestas.

Conectamos el controlador con `SessionsService` y registramos el servicio en `providers` de `ChatModule`. `Conversation` se instancia por sesión; no es un servicio compartido.

### Flujo desde esta etapa

Todas las rutas usan el prefijo `/api`:

1. **Crear:** `POST /sessions` guarda una sesión con historial vacío y devuelve su identificador.
2. **Seleccionar:** `POST /sessions/:sessionId/learning-goal` busca la sesión, guarda tema/objetivo y registra la intervención simulada como mensaje del asistente y turno actual.
3. **Responder:** `POST /sessions/:sessionId/responses` comprueba sesión, turno y opción antes de modificar el historial. Guarda `turnId`, `optionId` y el texto de la opción como mensaje del estudiante; después guarda feedback y siguiente intervención como mensaje del asistente y actualiza el turno.
4. **Recuperar:** `GET /sessions/:sessionId/current-turn` devuelve `{ sessionId, turn }` con el turno guardado, sin generar otro ni añadir mensajes.

El contenido de los mensajes se guarda como texto JSON: así conserva los IDs y el texto de la elección, y también el feedback, la pregunta y las opciones del asistente.

| Situación | Respuesta |
|---|---|
| Sesión inexistente | `404`, `SESSION_NOT_FOUND` |
| Consultar una sesión sin turno | `404`, `TURN_NOT_FOUND` |
| Responder un turno antiguo, ajeno o sin turno actual | `409`, `TURN_NOT_CURRENT` |
| Elegir una opción que no pertenece al turno | `400`, `OPTION_NOT_FOUND` |

Comprobamos compilación, ESLint y seis pruebas de integración en `test/app.e2e-spec.ts`: historiales separados, registro de ID/texto/feedback, rechazo de respuestas repetidas, recuperación sin añadir mensajes, ausencia de turno, y errores de opción o sesión inexistente.

## 5. Recibir e indexar una fuente Markdown

Añadimos `POST /api/sessions/:sessionId/sources`. Recibe un único `.md` en el campo `file` de `multipart/form-data`, comprueba que la sesión exista y delega la ingesta a `RagService`. Se rechazan archivos ausentes, vacíos, con otra extensión o texto no válido en UTF-8; el límite por archivo es 1 MiB (`413` si se supera).

Reutilizamos de la misma copia local de Dev-assistant:

- `chunker.ts`: fragmentación por secciones y párrafos, con solapamiento. Adaptamos `chunkMardown()` como `chunkMarkdown()` para trabajar con texto y nombre del archivo recibido, sin recorrer directorios.
- `embeddings.ts`: `generateEmbeddings()`, con lotes de 32 textos, ordenación por índice y validación de los vectores. Usa VoyageAI, modelo configurable (por defecto `voyage-4`) y 1024 dimensiones.
- `vector-store.ts`: almacenamiento SQLite con `better-sqlite3` y `sqlite-vec`, e inserción de fragmentos y vectores mediante `insert()`.
- `ingest.ts`: solo como referencia del orden de operaciones. No se importa ni se ejecuta, y no se utiliza su borrado del índice.

Adaptamos las tablas para guardar `sessionId` y `sourceId` tanto en los fragmentos como en los vectores. Cada carga genera un `sourceId` nuevo y los IDs de fragmento lo incorporan, por lo que dos archivos llamados `scrum.md` no se sobrescriben. `insertSource()` guarda la fuente completa en una transacción: si una inserción falla, se revierte esa carga y se conservan las anteriores.

Registramos `RagService` y `VectorStore` en `RagModule`, y conectamos ese módulo con `ChatModule`. Añadimos las dependencias de VoyageAI, SQLite y carga de `.env`, junto con los tipos de Multer y SQLite.

**Flujo añadido:** crear sesión → subir `.md` → validar sesión y archivo → generar `sourceId` → fragmentar texto → generar embeddings → guardar fragmentos y vectores → responder `201` con `{ sourceId, name, chunksCount }`. Si VoyageAI falla o no tiene clave configurada, se devuelve `503` con `EMBEDDINGS_UNAVAILABLE`, sin escribir fragmentos. La carga no añade mensajes al historial.

### Configuración y prueba manual

`backend/.env.example` muestra las variables necesarias. Configurar `VOYAGEAI_API_KEY` en `backend/.env`; `VOYAGEAI_EMBEDDING_MODEL` y `RAG_DB_PATH` son opcionales. El índice nuevo se guarda por defecto en `backend/data/session-vectors.db`, separado del índice original del repo e ignorado por Git. `ANTHROPIC_API_KEY` todavía no interviene.

Con el servidor iniciado desde `backend/` mediante `npm run start:dev`, crear la sesión y usar su identificador:

```powershell
curl.exe -X POST http://localhost:3000/api/sessions
curl.exe -X POST http://localhost:3000/api/sessions/SESSION_ID/sources -F "file=@docs/academic/scrum.md"
```

Sustituir `SESSION_ID` y ajustar el puerto si se configuró `PORT`.

**Comprobaciones:** compilación y ESLint correctos; 13 pruebas de integración entre sesiones y fuentes. Las de fuentes usan `scrum.md`, fragmentación y SQLite reales, simulando solo VoyageAI; verifican aislamiento, cargas repetidas, archivos inválidos, fallo del proveedor y reversión de una inserción intermedia. Además, probamos el endpoint con la clave local y VoyageAI real: respondió `201` y almacenó **6 fragmentos y 6 vectores de 1024 dimensiones** en una base temporal de prueba.

## 6. Generar temas al cargar y consultarlos desde la sesión

Adaptamos la llamada y extracción de texto de `askClaude()`, en `src/llm/anthropic-client.ts` del repo, dentro de `LlmService`. El método nuevo `generateTopics(academicText)` recibe el texto completo del documento y usa `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL` del `.env`. Registramos el servicio en `LlmModule` y conectamos ese módulo con `ChatModule`.

Creamos `chat/prompts/topics.prompt.ts`: pide únicamente JSON sin IDs, con exactamente tres temas y dos objetivos por tema, basados en el material. Esta cantidad es una decisión de la PoC, no una exigencia del contrato. No usamos `SOCRATIC_TUTOR_PROMPT`.

En la prueba real, el modelo configurado (`claude-haiku-4-5-20251001`) devolvió inicialmente JSON envuelto en Markdown. Añadimos `output_config.format` con un esquema JSON en la misma llamada para fijar el formato, conservando la validación local. Esta comprueba JSON válido, las cantidades y todos los labels como cadenas no vacías. Una salida inválida, sin texto o truncada devuelve `502`, con `INVALID_LLM_OUTPUT` y el mensaje `No se pudieron generar temas y objetivos válidos`. Un fallo al consultar el proveedor devuelve `503`, con `LLM_UNAVAILABLE`.

Añadimos `session.topics`, inicialmente `[]`. `SessionsService.saveTopics()` asigna UUIDs desde Nest a cada tema y objetivo, y guarda el catálogo completo. Una nueva carga exitosa sustituye los temas anteriores; una generación inválida no guarda temas parciales ni modifica el catálogo previo.

**Flujo ampliado:** `POST /sources` → indexar el documento → pasar su texto completo a `generateTopics()` → validar → asignar IDs → guardar en la sesión → responder `201` con `{ sourceId, name, chunksCount }`. El texto académico y los temas no se incluyen en esa respuesta. La indexación ocurre antes de llamar al LLM: si este falla, los fragmentos ya indexados permanecen en SQLite, aunque la carga no devuelve `201`.

Añadimos `GET /api/sessions/:sessionId/topics`: devuelve `{ topics }` desde `SessionsService`, sin llamar al modelo ni regenerar IDs. Si la sesión no tiene temas, devuelve `{ "topics": [] }`; si no existe, `404` con `SESSION_NOT_FOUND`.

Para probar después de crear una sesión y cargar `scrum.md`:

```powershell
curl.exe http://localhost:3000/api/sessions/SESSION_ID/topics
curl.exe http://localhost:3000/api/sessions/SESSION_ID/topics
```

**Comprobaciones:** compilación, ESLint y 27 pruebas de integración correctos, incluyendo salidas inválidas y conservación del catálogo previo. La prueba final con VoyageAI y Anthropic reales devolvió `201`, 6 fragmentos, tres temas y dos objetivos por tema. Dos consultas devolvieron exactamente los mismos IDs y otra sesión sin material devolvió la lista vacía. Se utilizó SQLite en memoria para esa prueba.

## 7. Generar la primera intervención con RAG y LLM

Sustituimos la primera respuesta simulada de `POST /sessions/:sessionId/learning-goal`. `SessionsService.validateLearningGoal()` comprueba que el tema pertenezca a la sesión y el objetivo a ese tema, sin modificar el estado. Una selección inválida devuelve `400` con `INVALID_LEARNING_GOAL`.

Reutilizamos el flujo de `retrieveContext()` de `src/rag/retriever.ts` del repo: generar el embedding de la consulta, buscar vecinos y recuperar fragmentos con su puntuación. Lo adaptamos dentro de `RagService`, usando el `VectorStore` registrado en Nest. También recuperamos `generateEmbedding()` para consultas de VoyageAI (`inputType: query`). La búsqueda combina los textos del tema y objetivo y filtra por `sessionId` dentro de SQLite, antes de elegir los cinco resultados más cercanos.

Como criterio inicial de contexto suficiente, exigimos al menos un fragmento no vacío con `score >= 0.5`, usando la fórmula del repo: `1 - distancia / 2`. Es un umbral heurístico de la PoC, no una garantía de suficiencia pedagógica. Si no hay fragmentos que lo cumplan, devolvemos `422` con `INSUFFICIENT_CONTEXT`, sin llamar al LLM.

Creamos `TutorService` para coordinar selección → recuperación → generación → guardado. Adaptamos `SOCRATIC_TUTOR_PROMPT` desde `src/llm/prompts.ts`: el tema ya está elegido; se pide una situación breve, una sola pregunta y tres opciones, sin pistas adicionales, cambio de tema, IDs ni fuentes. `LlmService.generateIntervention()` utiliza la llamada existente a Anthropic con JSON estructurado y valida un `message` no vacío y exactamente tres opciones con labels no vacíos. Una salida inválida devuelve `502` con `INVALID_LLM_OUTPUT`.

Nest genera `turnId` y los IDs de opciones. Las fuentes se construyen exclusivamente desde los fragmentos enviados al modelo, con `sourceId`, nombre y `chunkId`. Solo tras validar la intervención se guardan selección, mensaje del asistente y turno actual. Antes de guardar se vuelve a validar la selección por si el catálogo cambió durante la llamada externa.

**Flujo:** crear sesión → cargar material → consultar `/topics` → enviar IDs a `/learning-goal` → recuperar contexto de esa sesión → generar y validar la intervención → devolver `200` con `{ sessionId, feedback: null, turn }`. `/current-turn` devuelve esa misma intervención sin generar ni añadir mensajes. `/responses` continúa simulado.

Para probar con `$base` y `$id` de una sesión que ya tenga material, ejecutar cada comando por separado:

```powershell
$catalogo = Invoke-RestMethod "$base/sessions/$id/topics"
$seleccion = @{ topicId = $catalogo.topics[0].id; objectiveId = $catalogo.topics[0].objectives[0].id } | ConvertTo-Json
$primera = Invoke-RestMethod -Method Post -Uri "$base/sessions/$id/learning-goal" -ContentType "application/json" -Body $seleccion
$primera | ConvertTo-Json -Depth 10
$actual = Invoke-RestMethod "$base/sessions/$id/current-turn"
($primera.turn | ConvertTo-Json -Depth 10 -Compress) -eq ($actual.turn | ConvertTo-Json -Depth 10 -Compress)
```

La comparación debe devolver `True`.

**Comprobaciones:** compilación, ESLint y 40 pruebas de integración correctos. Se verificaron aislamiento de contexto, fuentes reales, selección inválida sin cambios, errores de proveedores y salidas mal formadas sin guardar estado. La prueba con `scrum.md`, VoyageAI y Anthropic reales devolvió `200`, tres opciones y cinco fuentes de los seis fragmentos indexados; `/current-turn` coincidió y una selección inválida conservó la sesión. La prueba utilizó SQLite en memoria.

## Punto de continuación

La primera intervención ya usa RAG y LLM. El siguiente paso será sustituir el feedback y la siguiente intervención simulados de `/responses`. Las sesiones, los temas y el historial siguen en memoria y se pierden al reiniciar; el índice SQLite permanece en disco, pero todavía no se recuperan sesiones tras un reinicio.
