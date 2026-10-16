// page.tsx é SERVER e THIN (ADR 006): zero "use client", zero hooks, zero dados.
// Só delega pro orquestrador client da rota. Toda tela nova segue esta decomposição:
//   page.tsx (server) → <rota>-client.tsx ("use client", orquestra) → components/ (apresentação)

import HomeClient from './home-client';

export default function HomePage() {
  return <HomeClient />;
}
