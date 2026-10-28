-- Runs only when the database is created for the first time.
-- Table and column names are in Spanish: they are part of the contract with the
-- n8n workflow and the ElevenLabs tool.

-- Pizzeria orders (inserted by the n8n workflow called by the ElevenLabs agent)
CREATE TABLE IF NOT EXISTS pedidos (
  id               SERIAL PRIMARY KEY,
  nombre_cliente   TEXT NOT NULL,
  telefono         TEXT NOT NULL,
  tipo_entrega     TEXT NOT NULL CHECK (tipo_entrega IN ('domicilio','recoger')),
  direccion        TEXT,            -- required for home delivery
  productos        JSONB NOT NULL,  -- [{"producto":"Margarita","tamano":"mediana","cantidad":2,"notas":"sin cebolla"}]
  notas            TEXT,
  estado           TEXT NOT NULL DEFAULT 'pendiente',
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT direccion_si_domicilio CHECK (tipo_entrega <> 'domicilio' OR direccion IS NOT NULL)
);

-- When an order was marked as completed (used by the order board)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS finalizado_en TIMESTAMPTZ;

-- Notifies the 'pedidos_cambio' channel whenever an order is created, updated or deleted,
-- so the order board refreshes instantly (LISTEN/NOTIFY).
CREATE OR REPLACE FUNCTION notificar_pedido() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('pedidos_cambio', json_build_object('op', TG_OP, 'id', COALESCE(NEW.id, OLD.id))::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pedidos_notify ON pedidos;
CREATE TRIGGER pedidos_notify AFTER INSERT OR UPDATE OR DELETE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION notificar_pedido();
