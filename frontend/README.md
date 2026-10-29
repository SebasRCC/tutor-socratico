This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Backend local

Configura `backend/.env` usando `backend/.env.example`: `PORT=3001`, las claves
privadas de VoyageAI y Anthropic, y los modelos indicados en el ejemplo.
Desde `backend`, ejecuta `npm.cmd run start:dev`. Nest carga `.env` al iniciar,
expone `/api` y permite CORS desde `http://localhost:3000`.

En `frontend/.env.local`, usa las variables de `.env.example`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_USE_MOCK_API=false
```

Desde `frontend`, ejecuta `npm.cmd run dev` y abre `http://localhost:3000`.
Mantén ambos servicios encendidos. Reinicia Next.js después de cambiar las variables;
para producción, vuelve a compilar porque las variables `NEXT_PUBLIC_*` se incluyen
en el código del navegador. Las claves privadas permanecen únicamente en el backend.

El cliente conserva las funciones y rutas de `lib/api.ts`: crea una sesión, sube un
Markdown (por ejemplo `backend/docs/academic/scrum.md`), elige tema/objetivo y responde.
Si reinicias Nest, inicia una sesión nueva porque las sesiones se guardan en memoria.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
