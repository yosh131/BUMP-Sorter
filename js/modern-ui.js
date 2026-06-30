(() => {
    'use strict';

    document.addEventListener('DOMContentLoaded', initializeModernUi);

    function initializeModernUi() {
        const landing = document.getElementById('landing-section');
        const selection = document.getElementById('selection-section');
        const sort = document.getElementById('sort-section');
        const result = document.getElementById('result-section');
        const songListElement = document.getElementById('songList');
        const startButton = document.getElementById('modern-start');
        const selectedOnly = document.getElementById('selected-only');
        const helpDialog = document.getElementById('help-dialog');
        const confirmDialog = document.getElementById('sort-confirm-dialog');
        const resumePanel = document.getElementById('resume-panel');

        const setView = () => {
            let view = 'landing';
            if (!result.hidden) view = 'result';
            else if (!sort.hidden) view = 'sort';
            else if (landing.hidden && !selection.hidden) view = 'selection';
            document.body.dataset.view = view;
        };

        const showSelection = () => {
            if (!resumePanel.hidden && typeof discardSavedSession === 'function') discardSavedSession();
            applySelectedFilter();
            landing.hidden = true;
            selection.hidden = false;
            setView();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        startButton.addEventListener('click', showSelection);
        document.getElementById('resume-session').addEventListener('click', () => {
            landing.hidden = true;
            setView();
        });

        const openHelp = () => helpDialog.showModal();
        document.getElementById('open-help').addEventListener('click', openHelp);
        document.getElementById('open-help-secondary').addEventListener('click', openHelp);
        document.getElementById('close-help').addEventListener('click', () => helpDialog.close());
        helpDialog.addEventListener('click', (event) => {
            if (event.target === helpDialog) helpDialog.close();
        });

        const refreshAlbumState = () => {
            document.querySelectorAll('.modern-album-section').forEach((section) => {
                const checkboxes = Array.from(section.querySelectorAll('input[name="song"]'));
                const checked = checkboxes.filter((checkbox) => checkbox.checked).length;
                const count = section.querySelector('.modern-album-count');
                if (count) count.textContent = `${checked}/${checkboxes.length}`;
            });
        };

        const applySelectedFilter = () => {
            const onlySelected = selectedOnly.checked;
            document.querySelectorAll('.modern-album-section').forEach((section) => {
                const labels = Array.from(section.querySelectorAll('.modern-album-songs label'));
                let visibleCount = 0;
                labels.forEach((label) => {
                    const visible = !onlySelected || label.querySelector('input').checked;
                    label.hidden = !visible;
                    if (visible) visibleCount++;
                });
                section.hidden = onlySelected && visibleCount === 0;
                if (onlySelected && visibleCount > 0) setAlbumExpanded(section, true);
            });
            refreshAlbumState();
        };

        const enhanceAlbums = () => {
            if (!songListElement.querySelector('.album-header') || songListElement.querySelector('.modern-album-section')) return;

            const children = Array.from(songListElement.children);
            const fragment = document.createDocumentFragment();
            let section = null;
            let songs = null;
            let albumIndex = 0;

            children.forEach((child) => {
                if (child.classList.contains('album-header')) {
                    albumIndex++;
                    const albumSection = document.createElement('section');
                    albumSection.className = 'modern-album-section';

                    const heading = document.createElement('div');
                    heading.className = 'modern-album-heading';

                    const toggle = document.createElement('button');
                    toggle.type = 'button';
                    toggle.className = 'modern-album-toggle';
                    toggle.setAttribute('aria-expanded', albumIndex === 1 ? 'true' : 'false');

                    const title = document.createElement('span');
                    title.textContent = child.textContent;
                    const count = document.createElement('span');
                    count.className = 'modern-album-count';
                    const marker = document.createElement('span');
                    marker.className = 'modern-album-marker';
                    marker.setAttribute('aria-hidden', 'true');
                    marker.textContent = '＋';
                    toggle.append(title, count, marker);

                    child.className = 'modern-album-select';
                    child.textContent = 'まとめて選択/解除';

                    const albumSongs = document.createElement('div');
                    albumSongs.className = 'modern-album-songs';
                    albumSongs.id = `modern-album-${albumIndex}`;
                    albumSongs.hidden = albumIndex !== 1;
                    toggle.setAttribute('aria-controls', albumSongs.id);
                    marker.textContent = albumIndex === 1 ? '−' : '＋';
                    toggle.addEventListener('click', () => setAlbumExpanded(albumSection, albumSongs.hidden));
                    child.addEventListener('click', applySelectedFilter);

                    heading.append(toggle, child);
                    albumSection.append(heading, albumSongs);
                    fragment.appendChild(albumSection);
                    section = albumSection;
                    songs = albumSongs;
                } else if (section && songs) {
                    songs.appendChild(child);
                }
            });

            songListElement.replaceChildren(fragment);
            refreshAlbumState();
        };

        const albumObserver = new MutationObserver(() => enhanceAlbums());
        albumObserver.observe(songListElement, { childList: true });
        enhanceAlbums();

        songListElement.addEventListener('change', applySelectedFilter);
        selectedOnly.addEventListener('change', applySelectedFilter);
        document.getElementById('select-all').addEventListener('click', applySelectedFilter);
        document.getElementById('deselect-all').addEventListener('click', applySelectedFilter);
        document.getElementById('expand-all-albums').addEventListener('click', () => {
            document.querySelectorAll('.modern-album-section').forEach((album) => setAlbumExpanded(album, true));
        });
        document.getElementById('collapse-all-albums').addEventListener('click', () => {
            document.querySelectorAll('.modern-album-section').forEach((album) => setAlbumExpanded(album, false));
        });

        const checkedCount = document.getElementById('checked-count');
        const numberOfTop = document.getElementById('numberOfTop');
        const comparisonEstimate = document.getElementById('comparison-estimate');
        const updateSelectionSummary = () => {
            const [selected, total] = checkedCount.textContent.split('/').map(Number);
            startButton.disabled = !Number.isFinite(total) || total === 0;
            if (!Number.isFinite(selected) || selected === 0) {
                comparisonEstimate.textContent = '曲を選ぶと、比較回数の目安を表示します。';
                return;
            }

            const top = Math.min(selected, Number(numberOfTop.value));
            const estimate = BumpSorterCore.estimateComparisonCount(selected, top);
            comparisonEstimate.textContent = `${selected}曲から上位${top}曲を並べる場合、比較は約${estimate.toLocaleString('ja-JP')}回です。`;
        };
        new MutationObserver(updateSelectionSummary).observe(checkedCount, { childList: true, characterData: true, subtree: true });
        numberOfTop.addEventListener('change', updateSelectionSummary);
        updateSelectionSummary();

        const saveSelection = document.getElementById('save-selection');
        saveSelection.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const selectedCount = typeof getSelectedIds === 'function' ? getSelectedIds().length : 0;
            if (selectedCount === 0) {
                startNewSort();
                return;
            }
            const requestedTop = Number(document.getElementById('numberOfTop').value);
            const top = Math.min(selectedCount, requestedTop);
            const estimate = BumpSorterCore.estimateComparisonCount(selectedCount, top);
            const estimatedMinutes = Math.max(1, Math.round((estimate * 10) / 60));
            const confirmSummary = document.getElementById('sort-confirm-summary');
            const estimateLine = document.createElement('span');
            estimateLine.className = 'modern-confirm-estimate';
            estimateLine.textContent = `比較回数の目安：${estimate.toLocaleString('ja-JP')}回（所要時間：約${estimatedMinutes.toLocaleString('ja-JP')}分）`;
            confirmSummary.replaceChildren(
                document.createTextNode(`${selectedCount}曲から上位${top}曲を並べます。`),
                estimateLine,
            );
            confirmDialog.showModal();
        }, true);

        document.getElementById('cancel-sort-confirm').addEventListener('click', () => confirmDialog.close());
        document.getElementById('confirm-sort-start').addEventListener('click', () => {
            confirmDialog.close();
            startNewSort();
            setView();
        });

        const viewObserver = new MutationObserver(setView);
        [selection, sort, result].forEach((view) => viewObserver.observe(view, { attributes: true, attributeFilter: ['hidden'] }));
        setView();
    }

    function setAlbumExpanded(section, expanded) {
        const songs = section.querySelector('.modern-album-songs');
        const toggle = section.querySelector('.modern-album-toggle');
        songs.hidden = !expanded;
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.querySelector('.modern-album-marker').textContent = expanded ? '−' : '＋';
    }
})();
