var express = require('express');
var router = express.Router();
const {Client} = require('pg');
var workDay = require('../workDayService');

// Make sure the account has access to the alarm
router.use('/alarm/:alarmId', async function (req, res, next) {
    if (res.locals.account && res.locals.account.accessToHomes) {
        if (!/\d+/.test(req.params.alarmId)) {
            res.status(400).send({error: 'alarmId in url /alarm/alarmId/* must be an integer'});
            return;
        }
        const client = new Client();
        await client.connect();
        client.query(`SELECT 1 FROM alarm_clock a 
                     INNER JOIN home h ON a.home = h.id
                     WHERE a.id = $1 AND h.id ANY($2)`,
            [req.params.alarmId, res.locals.account.accessToHomes])
            .then(res => {
                if (res.rows[0]) next();
                else res.sendStatus(404);
            })
            .catch(err => console.error(err.stack));
    } else {
        res.sendStatus(500);
    }
});

router.get('/alarm/:alarmId/alarmClockTime', async function (req, res, next) {
    const client = new Client();
    await client.connect();
    client.query(`SELECT t.* current_time + MOD(EXTRACT(EPOCH FROM t.alarm_clock_time - current_time), 60*60*24) * interval '1 second' as next_time, 
                 FROM alarm_clock_time t 
                 INNER JOIN alarm_clock a ON a.id = t.alarm 
                 WHERE a.id = $1  
                 AND valid_from <= next_time AND valid_to >= next_time
                 ORDER BY is_default ASC, next_time ASC`, [id])
        .then(qres => {
            if (qres.rowCount > 0) {
                qres.rows.forEach(row => {
                    const isWorkDay = workDay.isNextTimeWorkDay(row.alarm_clock_time);
                    if (isWorkDay && (row.work_day_only || !row.non_work_day_only)
                        || !isWorkDay && (row.non_work_day_only || !row.work_day_only)) {
                        res.json({time: row.alarm_clock_time});
                        next();
                    }
                });
            } else res.sendStatus(404);
        })
        .catch(e => {
            console.error('error while getting SQL data', e);
            res.sendStatus(500);
        });
});

router.post('/alarm/:alarmId/alarmClockTime/', async function (req, res, next) {
    if (req.body && req.body.alarmClockTime && req.body.isDefault) {
        if (!/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(req.body.alarmClockTime)) {
            res.status(400).send({error: "supplied alarmClockTime is not in correct form (H)H:MM"});
            return;
        }
        if (typeof req.body.isDefault !== 'boolean' || req.body.workDayOnly && !typeof req.body.nonWorkDayOnly !== 'boolean' || req.body.nonWorkDayOnly && !typeof req.body.nonWorkDayOnly !== 'boolean') {
            res.status(400).send({error: "supplied isDefault (and if supplied also workDayOnly, nonWorkDayOnly) needs to be a boolean"});
            return;
        }
        if (!req.body.isDefault && (typeof req.body.validDays !== 'number' || !Number.isInteger(req.body.validDays))) {
            res.status(400).send({error: "needs to supply integer validDays when isDefault is false"});
            return;
        }

        const validFrom = req.body.validDays ? new Date() : null;
        const validTo = req.body.validDays ? `${new Date()} ${req.body.validDays} * interval '1 day'` : null;
        const client = new Client();
        await client.connect();
        client.query(
            `INSERT INTO alarm_clock_time
            (alarm_clock, work_day_only, non_work_day_only, alarm_clock_time, is_default, valid_from, valid_to, created_by) 
            VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
            [req.params.alarmId,
                req.body.workDayOnly || false,
                req.body.nonWorkDayOnly || false,
                req.body.alarmClockTime,
                req.body.isDefault,
                validFrom,
                validTo,
                res.locals.account.id])
            .then(qres => {
                if (qres.rowCount !== 1) {
                    console.error('rowCount when inserting alarm clock time was ', qres.rowCount);
                    res.sendStatus(500);
                    return;
                }
                res.sendStatus(200);
                next();
            })
            .catch(e => {
                console.error('error while inserting SQL data', e);
                res.sendStatus(500);
            });
    } else {
        res.status(400).send({error: "Missing one of the following obligatory fields in the json body: alarmClockTime, isDefault"});
    }
});

module.exports = router;
