-- ============================================================================
-- 0005 · La tabla guarda
-- ----------------------------------------------------------------------------
-- Existe SÓLO para poder abortar un batch() desde una condición SQL.
--
-- El batch() de D1 es una transacción real con rollback, pero no permite
-- ramificar en el medio (leer, decidir en JavaScript, escribir). Insertar 1 acá
-- viola el CHECK, tira error y revierte el batch entero; si la condición no se
-- cumple, no se inserta nada y no pasa nada.
--
--   INSERT INTO _abort (id)
--   SELECT 1 WHERE (SELECT used_count FROM vouchers WHERE id = ?1) >= (
--                   SELECT max_uses   FROM vouchers WHERE id = ?1);
--
-- Es fea. Es el precio de no tener plpgsql. Documentada para que dentro de seis
-- meses se entienda qué hace y nadie la borre por "tabla sin uso".
--
-- Dentro de un Durable Object NO hace falta: ahí se puede leer, decidir y
-- escribir con seguridad porque el objeto atiende un pedido por vez.
-- ============================================================================

CREATE TABLE _abort (
  id INTEGER PRIMARY KEY,
  CHECK (id = -1)
) STRICT;
