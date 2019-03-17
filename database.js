const {Client} = require('pg');
const config = require('./config.json').postgres;

async function getClient() {
    const client = new Client({
        user: config.database_user,
        password: config.database_pass,
        database: config.database_name
    });
    await client.connect();
    return client;
}

async function query(sql, vals, callback) {
    var db = await getClient();
    return db.query(sql, vals, callback);
}

module.exports = query;