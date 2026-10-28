// Genera las credenciales de n8n a partir de variables de entorno (el .env de cada maquina),
// para que los secretos nunca esten en Git. Los ids coinciden con los que usan los workflows.
// Se ejecuta dentro del contenedor de n8n y su salida se pasa a `n8n import:credentials`.
//
// Para anadir una credencial nueva: creala aqui con un id fijo, anade sus variables
// al .env.example y al docker-compose.yml (servicio n8n), y usala en el workflow.
const env = (nombre) => {
  const v = process.env[nombre];
  if (!v) {
    console.error(`Falta la variable ${nombre} en el .env`);
    process.exit(1);
  }
  return v;
};

const credenciales = [
  {
    id: "jA08VU6SLQfTvonG",
    name: "Pizzeria webhook token",
    type: "httpHeaderAuth",
    data: { name: "X-Pizzeria-Token", value: env("PIZZERIA_WEBHOOK_TOKEN") },
  },
  {
    id: "OrkmRX9UWpkc4OaM",
    name: "Postgres pizzeria",
    type: "postgres",
    data: {
      host: "postgres",
      port: 5432,
      database: env("PIZZERIA_DB"),
      user: env("DB_POSTGRESDB_USER"),
      password: env("DB_POSTGRESDB_PASSWORD"),
      ssl: "disable",
    },
  },
];

process.stdout.write(JSON.stringify(credenciales));
