'use strict';

document.addEventListener('DOMContentLoaded', loadUpdateHistory);

const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
});

async function loadUpdateHistory() {
    const status = document.getElementById('update-history-status');
    const list = document.getElementById('update-history-list');

    try {
        const response = await fetch('./data/update-history.json?v=20260701-2');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const entries = await response.json();
        if (!Array.isArray(entries) || entries.some((entry) => !isValidEntry(entry))) {
            throw new Error('更新履歴データの形式が正しくありません。');
        }

        const sortedEntries = [...entries].sort((left, right) => right.date.localeCompare(left.date));
        list.replaceChildren(createHistoryFragment(sortedEntries));
        status.hidden = true;
    } catch (error) {
        console.error('更新履歴の読み込みに失敗しました', error);
        status.textContent = '更新履歴を読み込めませんでした。時間をおいて再読み込みしてください。';
        status.className = 'status-message error';
    }
}

function isValidEntry(entry) {
    return entry
        && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
        && Array.isArray(entry.changes)
        && entry.changes.length > 0
        && entry.changes.every((change) => typeof change === 'string' && change.trim());
}

function createHistoryFragment(entries) {
    const fragment = document.createDocumentFragment();

    entries.forEach((entry) => {
        const article = document.createElement('article');
        article.className = 'history-entry';

        const time = document.createElement('time');
        time.className = 'history-date';
        time.dateTime = entry.date;
        time.textContent = dateFormatter.format(new Date(`${entry.date}T00:00:00Z`));

        const changes = document.createElement('ul');
        changes.className = 'history-changes';
        entry.changes.forEach((change) => {
            const item = document.createElement('li');
            item.textContent = change;
            changes.appendChild(item);
        });

        article.append(time, changes);
        fragment.appendChild(article);
    });

    return fragment;
}
