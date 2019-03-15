var express = require('express');
var router = express.Router();
const {Client} = require('pg');
var crypto = require("crypto");

router.post('/', async function (req, res) {
        if (req.body && req.body.home && req.body.home.name) {
            if (typeof req.body.home.name === 'string' && req.body.home.name.length <= 100) {
                const client = new Client();
                await client.connect();
                client.query(
                    `WITH new_home as (
                        INSERT INTO home(name) VALUES($1)
                        RETURNING id
                    )
                    INSERT INTO account_in_home(account, home, admin) 
                        SELECT id, $2, $3 FROM new_home;
                    SELECT id FROM new_home`,
                    [req.body.home.name, res.locals.account.id, true],
                    (err, qres) => {
                        if (err || qres.length !== 1) {
                            res.sendStatus(500);
                            console.error('Error inserting new home', err);
                            return;
                        }
                        res.send({home: {id: qres.rows[0].id}});
                    });
            } else {
                res.status(400).send('name attribute must be a string with length <= 100');
            }
        } else {
            res.status(400).send('Requires a home object in the body with a name attribute');
        }
    }
);

router.use('/:homeId', ensureAccess);

router.post('/:homeId/device', ensureAdmin, async function (req, res) {
    if (req.body && req.body.device && req.body.device.name) {
        var apiKey = null;
        if (req.body.device.createAPIKey) {
            apiKey = crypto.randomBytes(16).toString('hex');
        }
        const client = new Client();
        await client.connect();
        client.query(
            `
            WITH new_device as (INSERT INTO device(name) VALUES ($1) RETURNING id)
            INSERT INTO account_in_home(account, home) VALUES ((SELECT id FROM new_device), $2);
            INSERT INTO api_key(key, account) VALUES (SELECT $3, id FROM new_device WHERE $3 is not null);`,
            [req.body.device.name, req.params.homeId, apiKey])
            .then(deviceCreation => {
                if (deviceCreation.rowsAffected === 1) {
                    const id = deviceCreation.rows[0].id;
                    var resObj = {device: {id: id}};
                    if (req.body.device.createAPIKey) {
                        resObj.device.apiKey = apiKey;
                    }
                    res.send(resObj);
                } else res.sendStatus(500);
            })
            .catch(err => {
                console.error('error while inserting device:', err);
                res.sendStatus(500);
            });
    } else {
        res.status(400).send({error: 'Method needs a body object with device object containing attribute \'name\''});
    }
});

function ensureAdmin(req, res, next) {
    if (!res.locals.isAdmin) {
        res.status(403).send({error: 'Needs admin access to home'});
    } else {
        next();
    }
}

function ensureAccess(req, res, next) {
    if (!/\d+/.test(req.params.homeId)) {
        res.status(400).send({error: 'homeId in url /homes/homeId/* must be an integer'});
    } else {
        const homeAccess = res.locals.account.accessToHomes.find(h => h.id === parseInt(req.params.homeId));
        if (homeAccess) {
            res.locals.isAdmin = homeAccess.isAdmin;
            next();
        } else {
            res.status(404).send({error: 'Home or access to it does not exist'});
        }
    }
}

module.exports = router;
