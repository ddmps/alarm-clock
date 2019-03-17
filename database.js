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

/**
 *
 * @param queries Queries list with objs containing query string and values array (or empty array if none). If the value is $<string> it will take the first row of the last result with that value.
 * @param callback
 * @returns {Promise<void>}
 */
async function transaction(queries, callback) {
    const client = await getClient();

    const rollbackIfErr = (err) => {
        if (err) {
            client.query('ROLLBACK', (err) => {
                if (err) {
                    console.error('Error rolling back transaction:', err);
                }
                client.end();
            });
            callback(err);
        }
        return !!err;
    };

    client.query('BEGIN', async (err) => {
        if (rollbackIfErr(err)) return;
        let subQueryError = undefined;
        let results = [];
        for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            if (subQueryError) return true;
            if (results.length > 0) {
                query.values.forEach((value, index, arr) => {
                    if (typeof value === 'string' && value.startsWith('$')) {
                        arr[index] = results[results.length - 1].rows[0][value.substring(1)];
                    }
                })
            }
            await client.query(query.query, query.values, (err, result) => {
                if (rollbackIfErr(err)) {
                    subQueryError = err;
                    return;
                }
                results.push(result);
            });
        }

        if (!subQueryError) {
            client.query('COMMIT', (err) => {
                if (err) console.error('Error commiting transaction:', err);
                callback(err, results);
            });
        }
    });
}

async function query(sql, vals, callback) {
    const db = await getClient();
    return db.query(sql, vals, callback);
}

module.exports = {query: query, transaction: transaction};