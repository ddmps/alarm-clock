var express = require('express');
var router = express.Router();
var crypto = require("crypto");
const db = require('../database.js');

router.post('/', async function (req, res) {
        if (req.body && req.body.home && req.body.home.name) {
            if (typeof req.body.home.name === 'string' && req.body.home.name.length <= 100) {
                await db.transaction([{
                    query: 'INSERT INTO home(name) VALUES($1) RETURNING id',
                    values: [req.body.home.name]
                }, {
                    query: 'INSERT INTO account_in_home(account, home, admin)',
                    values: [res.locals.account.id, '$id', true]
                }], (err, result) => {
                    if (err || !result || result.length !== 2 || result[0].rowsAffected !== 1) {
                        res.sendStatus(500);
                        console.error('Error inserting new home', err, 'result:', result);
                        return;
                    }
                    res.send({home: {id: result[0].rows[0].id}});
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
        let apiKey = null;
        if (req.body.device.createAPIKey) {
            apiKey = crypto.randomBytes(16).toString('hex');
        }
        const queries = [{
            query: 'INSERT INTO device(name) VALUES ($1) RETURNING id',
            values: [req.body.device.name]
        }, {
            query: 'INSERT INTO account_in_home(account, home) VALUES ($1, $2) RETURNING account',
            values: ['$id', req.params.homeId]
        }];
        if (apiKey) {
            queries.push({
                query: 'INSERT INTO api_key(key, account) VALUES ($1, $2)',
                values: [apiKey, '$account']
            })
        }
        await db.transaction(queries, (err, result) => {
            if (err) {
                console.error('error while inserting device:', err);
                res.sendStatus(500);
                return;
            }
            if (result.length >= 2 && result[0].rowsAffected === 1) {
                const id = result[0].rows[0].id;
                var resObj = {device: {id: id}};
                if (apiKey && result.length === 3) {
                    resObj.device.apiKey = apiKey;
                }
                res.send(resObj);
            } else {
                console.error('result when inserting new device not as expected:', result);
                res.sendStatus(500);
            }
        });
    } else {
        res.status(400).send({error: 'Method needs a body object with device object containing attribute \'name\''});
    }
});

router.post('/:homeId/alarmClock', ensureAdmin, async function (req, res) {
    const name = null || req.body && req.body.alarmClock && req.body.alarmClock.name;
    db.query(`INSERT INTO alarm_clock (home, name) VALUES ($1, $2) RETURNING id`, [req.params.homeId, name])
        .then(alarmCreation => {
            if (alarmCreation.rowsAffected === 1) {
                res.send({alarmClock: {id: alarmCreation.rows[0].id, name: name}});
            } else res.sendStatus(500);
        })
        .catch(err => {
            console.error('error while inserting alarm clock:', err);
            res.sendStatus(500);
        });
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
