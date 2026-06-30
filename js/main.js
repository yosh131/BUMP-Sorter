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
let displayedProgress = 0;
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
    const saveResultImageButton = document.getElementById('saveResultImage');
    if (saveResultImageButton) saveResultImageButton.addEventListener('click', saveResultImage);
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
    const numberOfTop = Number(elements.numberOfTop.value);
    return {
        version: STORAGE_VERSION,
        status: 'sorting',
        catalogSize: songList.length,
        selectedIds,
        numberOfTop,
        seed: Date.now() >>> 0,
        answers: [],
        estimatedComparisons: BumpSorterCore.estimateComparisonCount(selectedIds.length, numberOfTop),
        maxProgress: 0,
    };
}

function readSavedSession() {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!value || value.version !== STORAGE_VERSION || value.status !== 'sorting') return null;
        if (!Array.isArray(value.selectedIds) || !Array.isArray(value.answers)) return null;
        if (!Number.isInteger(value.seed) || !Number.isFinite(value.numberOfTop)) return null;
        value.estimatedComparisons = Number(value.estimatedComparisons)
            || BumpSorterCore.estimateComparisonCount(value.selectedIds.length, value.numberOfTop);
        value.maxProgress = Math.max(0, Math.min(0.98, Number(value.maxProgress) || 0));
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
    displayedProgress = 0;
    updateProgressBar(sortSession.maxProgress || 0, true);
    updateComparisonProgress();
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
    updateComparisonProgress();
    persistSortSession();
    resolvePendingComparison(result);
}

function handleUndo() {
    if (!pendingComparison || !sortSession || sortSession.answers.length === 0) return;
    sortSession.answers.pop();
    updateComparisonProgress();
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

function updateSortProgress() {
    updateComparisonProgress();
}

function updateComparisonProgress() {
    if (!sortSession) return;

    const estimated = Math.max(
        1,
        Number(sortSession.estimatedComparisons)
            || BumpSorterCore.estimateComparisonCount(sortSession.selectedIds.length, sortSession.numberOfTop),
    );
    const answered = sortSession.answers.length;
    const progress = Math.min(0.98, answered / estimated);
    sortSession.estimatedComparisons = estimated;
    sortSession.maxProgress = Math.max(Number(sortSession.maxProgress) || 0, progress);
    updateProgressBar(sortSession.maxProgress);

    const top = Math.min(sortSession.numberOfTop, sortSession.selectedIds.length);
    elements.progressText.textContent = `${sortSession.selectedIds.length}曲から上位${top}曲をソートしています`;
}

function updateProgressBar(value, reset = false) {
    const normalized = Math.max(0, Math.min(1, value));
    displayedProgress = reset ? normalized : Math.max(displayedProgress, normalized);
    elements.progressBar.style.width = `${displayedProgress * 100}%`;
    elements.progressBar.setAttribute('aria-valuenow', String(Math.round(displayedProgress * 100)));
}

function showResult(items, requestedTop) {
    cancelPendingComparison();
    elements.pageDescription.hidden = true;
    elements.selectionSection.hidden = true;
    elements.selectedCountButton.hidden = true;
    elements.sortSection.hidden = true;
    elements.resultSection.hidden = false;
    const modern = document.body.classList.contains('modern-ui');
    elements.resultBox.innerHTML = modern
        ? '<h1>ソート結果</h1>'
        : '<h2>ソート結果</h2><p>ぜひ結果のスクリーンショットを以下のボタンからシェアしてください！</p>';
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
            row.classList.add(`result-rank-${song.rank}`);
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

async function saveResultImage(event) {
    const button = event.currentTarget;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '画像を作成中…';

    try {
        const canvas = createResultCanvas();
        const filename = `bump-sorter-result-${new Date().toISOString().slice(0, 10)}.png`;

        if ('showSaveFilePicker' in window) {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: 'PNG画像', accept: { 'image/png': ['.png'] } }],
            });
            const blob = await canvasToPngBlob(canvas);
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
        } else {
            const blob = await canvasToPngBlob(canvas);
            downloadBlob(blob, filename);
        }
    } catch (error) {
        if (error && error.name === 'AbortError') return;
        console.error('結果画像の保存に失敗しました', error);
        setStatus('結果画像を保存できませんでした。ブラウザのダウンロード設定を確認してください。', 'error');
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

function createResultCanvas() {
    const rows = Array.from(elements.tableBody.querySelectorAll('tr')).map((row) => (
        Array.from(row.cells).map((cell) => cell.textContent.trim())
    ));
    const width = 1200;
    const margin = 72;
    const titleHeight = 130;
    const headerHeight = 58;
    const rowHeight = 72;
    const footerHeight = 90;
    const height = titleHeight + headerHeight + (rows.length * rowHeight) + footerHeight;
    const columns = [
        { label: '順位', x: margin, width: 120 },
        { label: '曲名', x: margin + 120, width: 600 },
        { label: 'Album', x: margin + 720, width: width - (margin * 2) - 720 },
    ];

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    context.fillStyle = '#f5f4ef';
    context.fillRect(0, 0, width, height);
    context.textBaseline = 'middle';
    context.fillStyle = '#171a21';
    context.font = '700 46px "Hiragino Sans", Meiryo, sans-serif';
    context.fillText('ソート結果', margin, 65);
    context.font = '600 20px "Hiragino Sans", Meiryo, sans-serif';
    context.fillStyle = '#626771';
    context.fillText('BUMP-Sorter', width - margin - 145, 65);

    const tableTop = titleHeight;
    context.strokeStyle = '#171a21';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(margin, tableTop);
    context.lineTo(width - margin, tableTop);
    context.stroke();

    context.fillStyle = '#171a21';
    context.font = '700 24px "Hiragino Sans", Meiryo, sans-serif';
    columns.forEach((column) => context.fillText(column.label, column.x + 10, tableTop + (headerHeight / 2)));

    rows.forEach((cells, rowIndex) => {
        const y = tableTop + headerHeight + (rowIndex * rowHeight);
        const rank = Number(cells[0]);
        const rankPalette = {
            1: { background: '#f7edd0', text: '#8a6200' },
            2: { background: '#eaedf0', text: '#5c6670' },
            3: { background: '#f2dfd3', text: '#8a4f2a' },
        }[rank];
        if (rankPalette) {
            context.fillStyle = rankPalette.background;
            context.fillRect(margin, y, width - (margin * 2), rowHeight);
        }
        context.strokeStyle = '#d6d4cc';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(margin, y);
        context.lineTo(width - margin, y);
        context.stroke();

        cells.forEach((text, cellIndex) => {
            const column = columns[cellIndex];
            context.fillStyle = cellIndex === 0 && rankPalette ? rankPalette.text : '#171a21';
            context.font = `${cellIndex === 1 && rankPalette ? '700' : '500'} 25px "Hiragino Sans", Meiryo, sans-serif`;
            context.fillText(text, column.x + 10, y + (rowHeight / 2), column.width - 24);
        });
    });

    const bottomLine = tableTop + headerHeight + (rows.length * rowHeight);
    context.strokeStyle = '#171a21';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(margin, bottomLine);
    context.lineTo(width - margin, bottomLine);
    context.stroke();

    context.fillStyle = '#626771';
    context.font = '500 18px "Hiragino Sans", Meiryo, sans-serif';
    context.fillText('yosh131.github.io/BUMP-Sorter/', margin, height - 38);
    return canvas;
}

function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('PNG画像を作成できませんでした。'));
        }, 'image/png');
    });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
