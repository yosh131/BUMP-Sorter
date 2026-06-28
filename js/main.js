'use strict';

const STORAGE_KEY = 'bump-sorter-session-v2';
const LEGACY_STORAGE_KEY = 'bump-sorter-session-v1';
const STORAGE_VERSION = 2;
const RESTART_SORT = Symbol('restart-sort');

let songList = [];
let selectedSongs = [];
let sortSession = null;
let pendingComparison = null;
let activeRunId = 0;
let elements = {};

document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    elements = {
        pageDescription: document.getElementById('pageDescription'),
        selectionSection: document.getElementById('selection-section'),
        songList: document.getElementById('songList'),
        selectedCountButton: document.getElementById('selectedCountButton'),
        checkedCount: document.getElementById('checked-count'),
        numberOfTop: document.getElementById('numberOfTop'),
        statusMessage: document.getElementById('status-message'),
        resumePanel: document.getElementById('resume-panel'),
        sortSection: document.getElementById('sort-section'),
        progressText: document.getElementById('progress'),
        progressBar: document.getElementById('progressBar'),
        songContainer: document.getElementById('song-container'),
        choiceButtons: Array.from(document.querySelectorAll('.choice-button')),
        undoChoice: document.getElementById('undo-choice'),
        resultSection: document.getElementById('result-section'),
        resultBox: document.getElementById('result-box'),
        tableHead: document.getElementById('table-head'),
        tableBody: document.getElementById('song-list'),
    };

    bindStaticEvents();
    setStatus('楽曲リストを読み込んでいます。');

    try {
        const response = await fetch('./songdata/songs.csv');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        songList = parseCsv(await response.text()).map((song) => ({ ...song, rank: -1 }));
        generateSongList();
        setStatus('');
        offerSavedSession();
    } catch (error) {
        console.error('楽曲リストの取得に失敗しました', error);
        setStatus('楽曲リストを読み込めませんでした。通信状態を確認して再読み込みしてください。', 'error');
    }
}

function bindStaticEvents() {
    document.getElementById('select-all').addEventListener('click', () => setAllCheckboxes(true));
    document.getElementById('deselect-all').addEventListener('click', () => setAllCheckboxes(false));
    document.getElementById('save-selection').addEventListener('click', startNewSort);
    document.getElementById('resume-session').addEventListener('click', resumeSavedSession);
    document.getElementById('discard-session').addEventListener('click', discardSavedSession);
    document.getElementById('twitterShareBtn').addEventListener('click', shareOnTwitter);
    elements.selectedCountButton.addEventListener('click', () => {
        document.getElementById('selectTopK').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    elements.choiceButtons.forEach((button) => button.addEventListener('click', handleChoice));
    elements.undoChoice.addEventListener('click', handleUndo);
}

function parseCsv(csv) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;

    for (let index = 0; index < csv.length; index++) {
        const character = csv[index];
        const next = csv[index + 1];

        if (character === '"' && quoted && next === '"') {
            value += '"';
            index++;
        } else if (character === '"') {
            quoted = !quoted;
        } else if (character === ',' && !quoted) {
            row.push(value);
            value = '';
        } else if ((character === '\n' || character === '\r') && !quoted) {
            if (character === '\r' && next === '\n') index++;
            row.push(value);
            if (row.some((cell) => cell !== '')) rows.push(row);
            row = [];
            value = '';
        } else {
            value += character;
        }
    }

    if (value || row.length) {
        row.push(value);
        rows.push(row);
    }

    if (rows.length < 2) {
        throw new Error('楽曲データが空です。');
    }

    const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, ''));
    return rows.map((cells) => Object.fromEntries(
        headers.map((header, index) => [header, cells[index] || '']),
    )).filter((song) => song.id && song.title && song.album);
}

function generateSongList() {
    const fragment = document.createDocumentFragment();
    let currentAlbum = '';

    songList.forEach((song) => {
        if (song.album !== currentAlbum) {
            const albumButton = document.createElement('button');
            albumButton.type = 'button';
            albumButton.className = 'album-header';
            albumButton.textContent = song.album;
            albumButton.dataset.album = song.album;
            albumButton.addEventListener('click', () => toggleAlbum(song.album));
            fragment.appendChild(albumButton);
            currentAlbum = song.album;
        }

        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'song';
        checkbox.value = song.id;
        checkbox.dataset.album = song.album;
        checkbox.addEventListener('change', updateCheckedCount);
        label.append(checkbox, ` ${song.title}`);
        fragment.appendChild(label);
    });

    elements.songList.replaceChildren(fragment);
    updateCheckedCount();
}

function getSongCheckboxes() {
    return Array.from(document.querySelectorAll('input[name="song"]'));
}

function setAllCheckboxes(checked) {
    getSongCheckboxes().forEach((checkbox) => {
        checkbox.checked = checked;
    });
    updateCheckedCount();
}

function toggleAlbum(album) {
    const checkboxes = getSongCheckboxes().filter((checkbox) => checkbox.dataset.album === album);
    const shouldCheck = checkboxes.some((checkbox) => !checkbox.checked);
    checkboxes.forEach((checkbox) => {
        checkbox.checked = shouldCheck;
    });
    updateCheckedCount();
}

function updateCheckedCount() {
    const checkedCount = getSongCheckboxes().filter((checkbox) => checkbox.checked).length;
    elements.checkedCount.textContent = `${checkedCount}/${songList.length}`;
    elements.selectedCountButton.setAttribute('aria-label', `選択された楽曲数 ${checkedCount}曲。ソート設定へ移動`);
}

function setCheckedSongs(ids) {
    const selectedIds = new Set(ids.map(String));
    getSongCheckboxes().forEach((checkbox) => {
        checkbox.checked = selectedIds.has(checkbox.value);
    });
    updateCheckedCount();
}

function getSelectedIds() {
    return getSongCheckboxes()
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value);
}

function setStatus(message, type = 'info') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = type === 'error' ? 'status-message error' : 'status-message';
    elements.statusMessage.hidden = !message;
}

function createSortSession(selectedIds) {
    return {
        version: STORAGE_VERSION,
        status: 'sorting',
        catalogSize: songList.length,
        selectedIds,
        numberOfTop: Number(elements.numberOfTop.value),
        seed: Date.now() >>> 0,
        answers: [],
    };
}

function readSavedSession() {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!value || value.version !== STORAGE_VERSION || value.status !== 'sorting') return null;
        if (!Array.isArray(value.selectedIds) || !Array.isArray(value.answers)) return null;
        if (!Number.isInteger(value.seed) || !Number.isFinite(value.numberOfTop)) return null;
        return value;
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

function persistSortSession() {
    if (sortSession) localStorage.setItem(STORAGE_KEY, JSON.stringify(sortSession));
}

function offerSavedSession() {
    const saved = readSavedSession();
    if (!saved) return;

    const knownIds = new Set(songList.map((song) => String(song.id)));
    if (saved.catalogSize !== songList.length || saved.selectedIds.some((id) => !knownIds.has(String(id)))) {
        localStorage.removeItem(STORAGE_KEY);
        setStatus('保存されていた途中状態は楽曲データの更新前のものだったため破棄しました。');
        return;
    }

    sortSession = saved;
    setCheckedSongs(saved.selectedIds);
    elements.numberOfTop.value = String(saved.numberOfTop);
    elements.resumePanel.hidden = false;
}

function discardSavedSession() {
    sortSession = null;
    localStorage.removeItem(STORAGE_KEY);
    elements.resumePanel.hidden = true;
    setAllCheckboxes(false);
    setStatus('途中状態を破棄しました。');
}

function resumeSavedSession() {
    if (!sortSession) return;
    elements.resumePanel.hidden = true;
    enterSortMode();
    runSortSession();
}

function startNewSort() {
    const selectedIds = getSelectedIds();
    setStatus('');

    if (selectedIds.length === 0) {
        setStatus('1曲以上選択してからソートを開始してください。', 'error');
        elements.statusMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    if (selectedIds.length === 1) {
        selectedSongs = cloneSelectedSongs(selectedIds);
        selectedSongs[0].rank = 1;
        localStorage.removeItem(STORAGE_KEY);
        showResult(selectedSongs, 1);
        return;
    }

    sortSession = createSortSession(selectedIds);
    persistSortSession();
    enterSortMode();
    runSortSession();
}

function cloneSelectedSongs(ids) {
    const byId = new Map(songList.map((song) => [String(song.id), song]));
    return ids.map((id) => ({ ...byId.get(String(id)), rank: -1 }));
}

function enterSortMode() {
    elements.selectionSection.hidden = true;
    elements.selectedCountButton.hidden = true;
    elements.pageDescription.hidden = true;
    elements.resultSection.hidden = true;
    elements.sortSection.hidden = false;
    elements.progressText.textContent = `${sortSession.selectedIds.length}曲中 Top ${Math.min(sortSession.numberOfTop, sortSession.selectedIds.length)} をソートします`;
    updateProgressBar(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function runSortSession() {
    const runId = ++activeRunId;
    cancelPendingComparison();
    selectedSongs = cloneSelectedSongs(sortSession.selectedIds);
    const random = BumpSorterCore.createSeededRandom(sortSession.seed);
    let replayIndex = 0;
    const replayLimit = sortSession.answers.length;

    try {
        await BumpSorterCore.sortTopK(
            selectedSongs,
            sortSession.numberOfTop,
            async (left, right) => {
                if (runId !== activeRunId) throw new Error('stale sort run');

                if (replayIndex < replayLimit) {
                    const answer = sortSession.answers[replayIndex++];
                    const result = BumpSorterCore.orientComparison(answer, left.id, right.id);
                    if (result !== undefined) return result;

                    replayIndex--;
                    const cached = BumpSorterCore.findCachedComparison(
                        sortSession.answers,
                        left.id,
                        right.id,
                        replayIndex,
                    );
                    if (cached !== undefined) return cached;
                    throw new Error('保存された比較履歴と現在の比較順が一致しません。');
                }

                const cached = BumpSorterCore.findCachedComparison(sortSession.answers, left.id, right.id);
                if (cached !== undefined) return cached;

                const action = await waitForSortAction(left, right, runId);
                if (action === RESTART_SORT) throw RESTART_SORT;
                return action;
            },
            {
                random,
                onProgress: updateSortProgress,
            },
        );

        if (runId !== activeRunId) return;
        updateProgressBar(1);
        localStorage.removeItem(STORAGE_KEY);
        sortSession = null;
        showResult(selectedSongs, Number(elements.numberOfTop.value));
    } catch (error) {
        if (error === RESTART_SORT && runId === activeRunId) {
            runSortSession();
            return;
        }

        console.error('ソート処理に失敗しました', error);
        setStatus('途中状態を復元できませんでした。最初からやり直してください。', 'error');
        localStorage.removeItem(STORAGE_KEY);
        sortSession = null;
        cancelPendingComparison();
        elements.sortSection.hidden = true;
        elements.selectionSection.hidden = false;
        elements.selectedCountButton.hidden = false;
        elements.pageDescription.hidden = false;
    }
}

function waitForSortAction(left, right, runId) {
    displaySongs(left, right);
    setChoiceButtonsEnabled(true);
    elements.undoChoice.disabled = sortSession.answers.length === 0;

    return new Promise((resolve) => {
        pendingComparison = { left, right, resolve, runId };
    });
}

function handleChoice(event) {
    if (!pendingComparison || pendingComparison.runId !== activeRunId) return;

    const choice = Number(event.currentTarget.dataset.choice);
    const result = choice - 3;
    sortSession.answers.push({
        leftId: String(pendingComparison.left.id),
        rightId: String(pendingComparison.right.id),
        result,
    });
    persistSortSession();
    resolvePendingComparison(result);
}

function handleUndo() {
    if (!pendingComparison || !sortSession || sortSession.answers.length === 0) return;
    sortSession.answers.pop();
    persistSortSession();
    resolvePendingComparison(RESTART_SORT);
}

function resolvePendingComparison(value) {
    const current = pendingComparison;
    pendingComparison = null;
    setChoiceButtonsEnabled(false);
    elements.undoChoice.disabled = true;
    current.resolve(value);
}

function cancelPendingComparison() {
    pendingComparison = null;
    setChoiceButtonsEnabled(false);
    elements.undoChoice.disabled = true;
}

function setChoiceButtonsEnabled(enabled) {
    elements.choiceButtons.forEach((button) => {
        button.disabled = !enabled;
    });
}

function displaySongs(left, right) {
    const createSongBox = (song) => {
        const box = document.createElement('div');
        box.className = 'song-box';
        box.textContent = song.title;
        return box;
    };
    elements.songContainer.replaceChildren(createSongBox(left), createSongBox(right));
}

function updateSortProgress(items) {
    const fixed = items.filter((song) => song.rank !== -1).length;
    updateProgressBar(items.length ? Math.cbrt(fixed / items.length) : 0);
}

function updateProgressBar(value) {
    elements.progressBar.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
}

function showResult(items, requestedTop) {
    cancelPendingComparison();
    elements.pageDescription.hidden = true;
    elements.selectionSection.hidden = true;
    elements.selectedCountButton.hidden = true;
    elements.sortSection.hidden = true;
    elements.resultSection.hidden = false;
    elements.resultBox.innerHTML = '<h2>ソート結果</h2><p>ぜひ結果のスクリーンショットを以下のボタンからシェアしてください！</p>';
    elements.tableHead.innerHTML = '<tr><th>順位</th><th>曲名</th><th>Album</th></tr>';
    elements.tableBody.replaceChildren();

    const limit = Math.min(requestedTop, items.length);
    items.filter((song) => song.rank > 0 && song.rank <= limit).forEach((song) => {
        const row = document.createElement('tr');
        const rankCell = document.createElement('td');
        const titleCell = document.createElement('td');
        const albumCell = document.createElement('td');
        rankCell.textContent = song.rank;
        titleCell.textContent = song.title;
        albumCell.textContent = song.album.replace(/["「」]/g, '');

        if (song.rank <= 3) {
            rankCell.classList.add('special-rank');
            titleCell.classList.add('special-title');
            albumCell.classList.add('special-album');
        }
        row.append(rankCell, titleCell, albumCell);
        elements.tableBody.appendChild(row);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shareOnTwitter() {
    const shareText = '#BUMP_Sorter\nhttps://yosh131.github.io/BUMP-Sorter/';
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
}
