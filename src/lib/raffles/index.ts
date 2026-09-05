/**
 * El barril. Lo que ven las páginas y las actions es esto: funciones que piden
 * un `actor` y no saben que existen los bindings.
 *
 *   flows.ts   los flujos, con `db` y el namespace explícitos. Los importan los
 *              tests, que corren adentro del runtime de Workers.
 *   bound.ts   los mismos, con los bindings resueltos. El único de esta carpeta
 *              que importa `cloudflare:workers`.
 */

export * from './bound';
