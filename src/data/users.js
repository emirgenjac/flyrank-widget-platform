export async function registerOwner(db, { name, email, passwordHash }) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const tenant = await client.query(
      "INSERT INTO tenants (name) VALUES ($1) RETURNING id",
      [name],
    );
    const user = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, tenant_id, email`,
      [tenant.rows[0].id, email, passwordHash],
    );
    await client.query("COMMIT");
    return user.rows[0];
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original insert error is the one the caller handles.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function findUserByEmail(db, email) {
  const result = await db.query(
    "SELECT id, tenant_id, email, password_hash FROM users WHERE email = $1",
    [email],
  );
  return result.rows[0] ?? null;
}
