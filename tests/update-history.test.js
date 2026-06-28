const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const historyPath = path.join(__dirname, '..', 'data', 'update-history.json');
const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));

test('update history entries have unique ISO dates and non-empty changes', () => {
    const dates = new Set();

    history.forEach((entry) => {
        assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(dates.has(entry.date), false);
        assert.ok(Array.isArray(entry.changes) && entry.changes.length > 0);
        entry.changes.forEach((change) => assert.ok(typeof change === 'string' && change.trim()));
        dates.add(entry.date);
    });
});

test('update history can be sorted newest first by its ISO date', () => {
    const sorted = [...history].sort((left, right) => right.date.localeCompare(left.date));

    for (let index = 1; index < sorted.length; index++) {
        assert.ok(sorted[index - 1].date >= sorted[index].date);
    }
});
