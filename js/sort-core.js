(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.BumpSorterCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function createSeededRandom(seed) {
        let state = seed >>> 0;

        return function random() {
            state += 0x6D2B79F5;
            let value = state;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
    }

    function getRandomIntegersInRange(min, max, count, random = Math.random) {
        if (!Number.isInteger(min) || !Number.isInteger(max) || !Number.isInteger(count)) {
            throw new TypeError('min, max, count must be integers.');
        }

        if (count < 0 || count > max - min + 1) {
            throw new RangeError('Not enough unique integers in the requested range.');
        }

        const values = [];
        while (values.length < count) {
            const value = Math.floor(random() * (max - min + 1)) + min;
            if (!values.includes(value)) {
                values.push(value);
            }
        }
        return values;
    }

    function assertComparisonResult(result) {
        if (!Number.isInteger(result) || result < -2 || result > 2) {
            throw new RangeError('compare must resolve to an integer from -2 to 2.');
        }
    }

    const comparisonEstimateAnchors = [
        { size: 1, top10: 0, top20: 0, top30: 0, all: 0 },
        { size: 10, top10: 22, top20: 22, top30: 22, all: 22 },
        { size: 20, top10: 50, top20: 65, top30: 65, all: 65 },
        { size: 30, top10: 70, top20: 100, top30: 114, all: 114 },
        { size: 50, top10: 110, top20: 148, top30: 190, all: 236 },
        { size: 100, top10: 209, top20: 247, top30: 298, all: 567 },
        { size: 150, top10: 283, top20: 345, top30: 398, all: 951 },
        { size: 200, top10: 378, top20: 434, top30: 481, all: 1370 },
    ];

    function interpolateEstimate(size, key) {
        const clampedSize = Math.max(1, Math.min(200, size));
        const upperIndex = comparisonEstimateAnchors.findIndex((anchor) => anchor.size >= clampedSize);
        const upper = comparisonEstimateAnchors[Math.max(0, upperIndex)];
        const lower = comparisonEstimateAnchors[Math.max(0, upperIndex - 1)];
        if (upper.size === lower.size) return upper[key];

        const ratio = (clampedSize - lower.size) / (upper.size - lower.size);
        return lower[key] + ((upper[key] - lower[key]) * ratio);
    }

    function estimateComparisonCount(itemCount, topK = itemCount) {
        const size = Math.max(0, Math.min(200, Math.round(Number(itemCount) || 0)));
        if (size <= 1) return 0;

        const limit = Math.max(1, Math.min(size, Math.round(Number(topK) || size)));
        const estimates = [
            { target: Math.min(10, size), value: interpolateEstimate(size, 'top10') },
            { target: Math.min(20, size), value: interpolateEstimate(size, 'top20') },
            { target: Math.min(30, size), value: interpolateEstimate(size, 'top30') },
            { target: size, value: interpolateEstimate(size, 'all') },
        ].filter((entry, index, entries) => index === 0 || entry.target !== entries[index - 1].target);

        const upperIndex = estimates.findIndex((entry) => entry.target >= limit);
        const upper = estimates[Math.max(0, upperIndex)];
        const lower = estimates[Math.max(0, upperIndex - 1)];
        if (upper.target === lower.target) return Math.max(1, Math.round(upper.value));

        const ratio = (limit - lower.target) / (upper.target - lower.target);
        return Math.max(1, Math.round(lower.value + ((upper.value - lower.value) * ratio)));
    }

    function orientComparison(entry, leftId, rightId) {
        const left = String(leftId);
        const right = String(rightId);
        if (entry.leftId === left && entry.rightId === right) return entry.result;
        if (entry.leftId === right && entry.rightId === left) return -entry.result;
        return undefined;
    }

    function findCachedComparison(history, leftId, rightId, limit = history.length) {
        for (let index = Math.min(limit, history.length) - 1; index >= 0; index--) {
            const result = orientComparison(history[index], leftId, rightId);
            if (result !== undefined) return result;
        }
        return undefined;
    }

    async function selectPivot(items, start, end, compare, random, threshold = 7) {
        const length = end - start;
        if (length <= threshold) {
            return getRandomIntegersInRange(start, end - 1, 1, random)[0];
        }

        const sampleIndexes = getRandomIntegersInRange(start, end - 1, 3, random);
        const sample = sampleIndexes.map((index) => items[index]);

        for (let index = 1; index < sample.length; index++) {
            let cursor = index - 1;
            while (cursor >= 0) {
                const result = await compare(sample[cursor], sample[cursor + 1]);
                assertComparisonResult(result);
                if (result <= 0) {
                    break;
                }
                [sample[cursor], sample[cursor + 1]] = [sample[cursor + 1], sample[cursor]];
                cursor--;
            }
        }

        return items.indexOf(sample[Math.floor(sample.length / 2)], start);
    }

    async function partitionFive(items, start, end, pivotIndex, compare) {
        const buckets = [[], [], [], [], []];
        const pivot = items[pivotIndex];

        for (let index = start; index < end; index++) {
            if (index === pivotIndex) {
                buckets[2].push(items[index]);
                continue;
            }

            const result = await compare(pivot, items[index]);
            assertComparisonResult(result);
            buckets[2 - result].push(items[index]);
        }

        const flattened = buckets.flat();
        for (let index = start; index < end; index++) {
            items[index] = flattened[index - start];
        }

        const boundaries = [start];
        buckets.forEach((bucket) => {
            boundaries.push(boundaries[boundaries.length - 1] + bucket.length);
        });
        return boundaries;
    }

    function assignRank(items, start, end) {
        for (let index = start; index < end; index++) {
            items[index].rank = start + 1;
        }
    }

    async function sortTopK(items, topK, compare, options = {}) {
        const random = options.random || Math.random;
        const onProgress = options.onProgress || function () {};
        const limit = Math.max(0, Math.min(Number(topK) || 0, items.length));

        if (limit === 0 || items.length === 0) {
            onProgress(items);
            return items;
        }

        async function sortRange(start, end) {
            if (end - start <= 1) {
                assignRank(items, start, end);
                onProgress(items);
                return;
            }

            const pivotIndex = await selectPivot(items, start, end, compare, random);
            const boundaries = await partitionFive(items, start, end, pivotIndex, compare);
            const bucketOrder = getRandomIntegersInRange(0, 4, 5, random);

            for (const bucketIndex of bucketOrder) {
                const bucketStart = boundaries[bucketIndex];
                const bucketEnd = boundaries[bucketIndex + 1];

                if (bucketIndex === 2) {
                    assignRank(items, bucketStart, bucketEnd);
                } else if (bucketStart < limit && bucketEnd - bucketStart > 1) {
                    await sortRange(bucketStart, bucketEnd);
                } else {
                    assignRank(items, bucketStart, bucketEnd);
                }
                onProgress(items);
            }
        }

        await sortRange(0, items.length);
        return items;
    }

    return {
        createSeededRandom,
        estimateComparisonCount,
        findCachedComparison,
        getRandomIntegersInRange,
        orientComparison,
        partitionFive,
        selectPivot,
        sortTopK,
    };
}));
