import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "revista_db",
    user: "revista_user",
    password: "~+}ABqE}Q82e6=sCsPcK",
});