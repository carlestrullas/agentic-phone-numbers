// Builds the n8n credentials from environment variables (each machine's .env),
// so secrets never end up in Git. The ids match the ones referenced by the workflows.
// Runs inside the n8n container; its output is fed to `n8n import:credentials`.
//
// To add a new credential: define it here with a fixed id, add its variables to
// .env.example and docker-compose.yml (n8n service), and use it in the workflow.
const env = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing variable ${name} in .env`);
    process.exit(1);
  }
  return v;
};

const credentials = [
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

process.stdout.write(JSON.stringify(credentials));
