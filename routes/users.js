var express = require('express');
var router = express.Router();
var argon = require('argon2');
const {Client} = require('pg');

router.post('/', async function (req, res, next) {
    if (req.body && req.body.user && req.body.user.email && req.body.user.password) {
        argon.hash(req.body.user.password).then(async hash => {
            const client = new Client();
            await client.connect();
            client.query(
                `INSERT INTO human
            (name, email, password_hash) 
            VALUES($1, $2, $3)`, [req.body.user.name, req.body.user.email, hash])
                .then(qres => {
                    if (qres.rowCount !== 1) {
                        console.error('rowCount when inserting human', req.body.user, 'was', qres.rowCount);
                        res.sendStatus(500);
                        return;
                    }
                    res.sendStatus(200);
                    next();
                })
                .catch(e => {
                    console.error('error while inserting human', e);
                    res.sendStatus(500);
                });
        }).catch(err => {
            console.error('error with argon2 hashing', err);
            res.sendStatus(500);
        });
    } else {
        res.status(400).send({error: 'Missing body that contains user object with email and password set'});
    }
});

module.exports = router;
