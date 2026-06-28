const test = require('node:test');
const assert = require('node:assert/strict');
const {
    createSeededRandom,
    findCachedComparison,
    getRandomIntegersInRange,
    sortTopK,
} = require('../js/sort-core.js');

function compareByScore(left, right) {
    if (left.score === right.score) return 0;
    return left.score < right.score ? -1 : 1;
}

test('empty and single-item inputs complete without comparisons', async () => {
    let comparisons = 0;
    const compare = async () => {
        comparisons++;
        return 0;
    };

    const empty = [];
    await sortTopK(empty, 10, compare);
    assert.deepEqual(empty, []);

    const single = [{ id: 'only', score: 1, rank: -1 }];
    await sortTopK(single, 10, compare);
    assert.equal(single[0].rank, 1);
    assert.equal(comparisons, 0);
});

test('top K contains the K best items for deterministic total orders', async () => {
    for (let seed = 1; seed <= 20; seed++) {
        const items = [8, 2, 5, 1, 9, 4, 7, 3, 6].map((score) => ({
            id: String(score),
            score,
            rank: -1,
        }));

        await sortTopK(items, 4, async (left, right) => compareByScore(left, right), {
            random: createSeededRandom(seed),
        });

        const topScores = items
            .filter((item) => item.rank > 0 && item.rank <= 4)
            .map((item) => item.score)
            .sort((left, right) => left - right);
        assert.deepEqual(topScores, [1, 2, 3, 4]);
    }
});

test('equal answers produce a shared rank', async () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => ({ id, rank: -1 }));
    await sortTopK(items, 4, async () => 0, { random: createSeededRandom(7) });
    assert.deepEqual(items.map((item) => item.rank), [1, 1, 1, 1]);
});

test('seeded random sequences can be replayed', () => {
    const first = createSeededRandom(1234);
    const second = createSeededRandom(1234);
    assert.deepEqual(
        Array.from({ length: 10 }, () => first()),
        Array.from({ length: 10 }, () => second()),
    );
});

test('cached comparisons are reused in either left-right orientation', () => {
    const history = [{ leftId: 'a', rightId: 'b', result: -2 }];
    assert.equal(findCachedComparison(history, 'a', 'b'), -2);
    assert.equal(findCachedComparison(history, 'b', 'a'), 2);
    assert.equal(findCachedComparison(history, 'a', 'c'), undefined);
});

test('unique integer sampling validates its range', () => {
    const values = getRandomIntegersInRange(2, 6, 5, createSeededRandom(1));
    assert.equal(new Set(values).size, 5);
    assert.throws(() => getRandomIntegersInRange(0, 1, 3), RangeError);
});
