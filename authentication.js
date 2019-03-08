const {Client} = require('pg');

async function authenticate(req, res, next) {
    const apiKey = req.get('X-API-KEY');
    if (apiKey) {
        const client = new Client();
        await client.connect();
        const apiKeyQuery = await client.query(`SELECT * FROM api_key WHERE key = $1`, [apiKey]);
        if (apiKeyQuery.rows.length === 0) {
            res.status(403).send({error: 'Invalid API Key'});
        } else {
            const homesQuery = await client.query(
                `SELECT aih.home as homeId, ISNULL(ad.home) as isAdmin FROM account_in_home aih
                LEFT JOIN admin ad ON ad.account = aih.account AND ad.home = aih.home
                WHERE aih.account = $1`, [apiKeyQuery.rows[0].account]);
            res.locals.account = {id: apiKeyQuery.rows[0].account, accessToHomes: homesQuery.rows};
            next();
        }
    } else {
        res.status(401).send({error: 'Missing API Key (Needs header \'X-API-KEY\' set)'});
    }
}

module.exports = authenticate;