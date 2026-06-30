const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const historyHtml = fs.readFileSync(path.join(__dirname, '..', 'update_history.html'), 'utf8');

test('modern UI preserves the DOM contract required by main.js', () => {
    const requiredIds = [
        'pageDescription',
        'selection-section',
        'songList',
        'selectedCountButton',
        'checked-count',
        'numberOfTop',
        'status-message',
        'resume-panel',
        'sort-section',
        'progress',
        'progressBar',
        'song-container',
        'choice-container',
        'undo-choice',
        'result-section',
        'result-box',
        'table-head',
        'song-list',
        'select-all',
        'deselect-all',
        'save-selection',
        'resume-session',
        'discard-session',
        'twitterShareBtn',
        'saveResultImage',
    ];

    requiredIds.forEach((id) => assert.match(html, new RegExp(`id=["']${id}["']`)));
});

test('modern UI contains unique element ids and loads enhancement after main.js', () => {
    const ids = Array.from(html.matchAll(/\sid=["']([^"']+)["']/g), (match) => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(html.indexOf('./js/main.js') < html.indexOf('./js/modern-ui.js'));
});

test('modern UI exposes landing, help, confirmation, and all four views', () => {
    [
        'landing-section',
        'open-help',
        'help-dialog',
        'sort-confirm-dialog',
        'selection-section',
        'sort-section',
        'result-section',
    ].forEach((id) => assert.match(html, new RegExp(`id=["']${id}["']`)));
});

test('modern UI links to its matching history page and exposes comparison estimates', () => {
    assert.match(html, /href=["']update_history\.html["']/);
    assert.match(html, /id=["']comparison-estimate["']/);
    assert.match(html, /作者 @yoshi_b_o_c/);
    assert.match(historyHtml, /class=["']modern-ui["']/);
    assert.match(historyHtml, /href=["']index\.html["']/);
});
