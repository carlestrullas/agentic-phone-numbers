-- Se ejecuta solo al crear la base de datos por primera vez.
-- Añade aquí tus tablas o datos iniciales si quieres.

-- Pedidos de la pizzeria (los inserta el workflow de n8n llamado por el agente de ElevenLabs)
CREATE TABLE IF NOT EXISTS pedidos (
  id               SERIAL PRIMARY KEY,
  nombre_cliente   TEXT NOT NULL,
  telefono         TEXT NOT NULL,
  tipo_entrega     TEXT NOT NULL CHECK (tipo_entrega IN ('domicilio','recoger')),
  direccion        TEXT,            -- obligatoria si es a domicilio
  productos        JSONB NOT NULL,  -- [{"producto":"Margarita","tamano":"mediana","cantidad":2,"notas":"sin cebolla"}]
  notas            TEXT,
  estado           TEXT NOT NULL DEFAULT 'pendiente',
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT direccion_si_domicilio CHECK (tipo_entrega <> 'domicilio' OR direccion IS NOT NULL)
);

-- Hora a la que se marca un pedido como finalizado (lo usa el panel de comandas)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS finalizado_en TIMESTAMPTZ;

-- Avisa por el canal 'pedidos_cambio' cada vez que se crea, modifica o borra un pedido,
-- para que el panel de comandas se refresque al momento (LISTEN/NOTIFY).
CREATE OR REPLACE FUNCTION notificar_pedido() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('pedidos_cambio', json_build_object('op', TG_OP, 'id', COALESCE(NEW.id, OLD.id))::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pedidos_notify ON pedidos;
CREATE TRIGGER pedidos_notify AFTER INSERT OR UPDATE OR DELETE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION notificar_pedido();
