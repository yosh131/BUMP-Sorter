'use strict';

const {
    createSeededRandom,
    sortTopK,
} = require('../js/sort-core.js');

const sizes = [10, 20, 30, 50, 100, 150, 200];
const trials = Number(process.argv[2]) || 20;
const mode = process.argv[3] || 'strict';

function compareScores(left, right, size) {
    const difference = left.score - right.score;
    const direction = Math.sign(difference);
    if (mode === 'strict') return direction * 2;

    const distance = Math.abs(difference) / Math.max(1, size - 1);
    if (distance <= 0.03) return 0;
    if (distance <= 0.18) return direction;
    return direction * 2;
}

async function simulate(size, topK) {
    const counts = [];

    for (let seed = 1; seed <= trials; seed++) {
        let comparisons = 0;
        const cache = new Map();
        const items = Array.from({ length: size }, (_, score) => ({ score, rank: -1 }));

        await sortTopK(
            items,
            topK,
            async (left, right) => {
                const key = `${left.score}:${right.score}`;
                if (cache.has(key)) return cache.get(key);

                comparisons++;
                const result = compareScores(left, right, size);
                cache.set(key, result);
                cache.set(`${right.score}:${left.score}`, -result);
                return result;
            },
            { random: createSeededRandom(seed) },
        );
        counts.push(comparisons);
    }

    return {
        average: Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length),
        minimum: Math.min(...counts),
        maximum: Math.max(...counts),
    };
}

(async () => {
    for (const size of sizes) {
        const row = { size };
        const targets = [...new Set([10, 20, 30, size].map((target) => Math.min(target, size)))];
        for (const target of targets) {
            row[target === size ? 'all' : `top${target}`] = await simulate(size, target);
        }
        console.log(JSON.stringify(row));
    }
})();
