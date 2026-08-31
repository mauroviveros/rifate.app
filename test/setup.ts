import { applyD1Migrations, reset } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach } from 'vitest';

/**
 * El aislamiento entre tests, a mano.
 *
 * La versión del pool para Vitest 3 revertía sola el storage al terminar cada
 * test ("isolated storage"). La 0.22 sacó esa opción: si no se resetea acá, un
 * test ve lo que dejó el anterior y el resultado pasa a depender del orden en
 * que corrieron — que es la peor forma de tener la suite en verde.
 *
 * `reset()` es, por dentro, `deleteAllDurableObjects()`. Que eso también borre
 * D1 no es un efecto de más: en el runtime local **D1 está implementado sobre
 * un Durable Object**, así que borrarlos todos se lleva la base puesta. Por eso
 * las migraciones hay que volver a aplicarlas en cada test y no una sola vez.
 *
 * ⚠️ NO agregar `abortAllDurableObjects()` antes de `reset()`. Parece lo
 * prolijo — desalojar las instancias vivas para que no queden apuntando a un
 * storage borrado — pero verificado: con el abort adelante, el reset no borra
 * nada y todos los tests salvo el primero de cada archivo empiezan a fallar por
 * estado sucio. `reset()` ya se encarga de dejar los objetos listos para que el
 * próximo acceso los reconstruya y el constructor vuelva a correr `migrate()`.
 */
beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
