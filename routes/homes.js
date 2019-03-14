var express = require('express');
var router = express.Router();
const {Client} = require('pg');

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

module.exports = router;
