const {Client} = require('pg');
const argon = require('argon2');

async function authenticate(req, res, next) {
    const apiKey = req.get('X-API-KEY');
    let account;
    if (apiKey) {
        account = authenticateKey(apiKey);
        if (!account) {
            res.status(403).send({error: 'Invalid API Key'});
        }
    } else if (req.body && req.body.user && req.body.user.email && req.body.user.password) {
        try {
            account = authenticateHuman(req.body.user);
            if (!account) {
                res.status(403).send({error: 'Could not authenticate user'});
            }
        } catch (e) {
            console.error('argon2 failure when verifying password for human with id', human.accountId, ', error:', e);
            res.sendStatus(500);
        }
        //TODO send a temporary API Key
    } else {
        res.status(401).send({error: 'Missing API Key (Needs header \'X-API-KEY\' set), or body that contains user object with email and password set'});
    }
    if (account) {
        res.locals['account'] = makeAccountObject(account);
        next();
    }
}

async function authenticateKey(apiKey) {
    const client = new Client();
    await client.connect();
    const query = await client.query(`SELECT * FROM api_key WHERE key = $1`, [apiKey]);
    return query.rows.length === 1 && query.rows[0].account;
}

async function authenticateHuman(user) {
    const human = await getHumanPasswordData(user.email);
    if (human) {
        if (argon.verify(human.hash, user.password)) {
            return human.accountId;
        } else {
            console.info('Could not authenticate human with id', human.accountId);
        }
    } else {
        console.info('Could not find user with email', user.email);
    }
    return false;
}

async function makeAccountObject(account) {
    const client = new Client();
    await client.connect();
    const homesQuery = await client.query(
        `SELECT aih.home as homeId, ISNULL(ad.home) as isAdmin FROM account_in_home aih
                LEFT JOIN admin ad ON ad.account = aih.account AND ad.home = aih.home
                WHERE aih.account = $1`, [account]);
    return {id: account, accessToHomes: homesQuery.rows};
}

async function getHumanPasswordData(email) {
    const client = new Client();
    await client.connect();
    const query = await client.query(`SELECT * FROM human WHERE email = $1`, [email]);
    return query.rows.length === 1 && {
        accountId: query.rows[0].id,
        hash: query.rows[0].password_hash
    };
}

module.exports = authenticate;