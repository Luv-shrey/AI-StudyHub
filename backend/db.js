const { Pool } = require("pg");
require("dotenv").config({ path: '../.env' });;

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "studyhub",
    password: `${process.env.dbPass}`,
    port: 5432
});

module.exports = pool;