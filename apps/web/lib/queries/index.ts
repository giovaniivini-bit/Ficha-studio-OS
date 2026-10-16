// Barrel da camada de dados. ZONA NEUTRA — sincronizado pelo Integrador no reconcile.
// Dev cria lib/queries/<dominio>.ts no seu slot e marca no ARTIFACTS.md:
// "export pendente no barrel" — o Integrador adiciona a linha aqui.

export * from './health';
