import fs from 'node:fs';

const catalogPath = new URL('../songdata/songs.csv', import.meta.url);
const hiddenCatalogPath = new URL('../songdata/hidden_songs.csv', import.meta.url);

function decodeCatalog(path) {
    const bytes = fs.readFileSync(path);
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return new TextDecoder('shift_jis').decode(bytes);
    }
}

function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        const next = text[index + 1];

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
    return rows;
}

function serializeCsv(rows) {
    return rows.map((row) => row.map((value) => {
        const text = String(value ?? '');
        return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }).join(',')).join('\n') + '\n';
}

const rows = parseCsv(decodeCatalog(catalogPath));
const headers = rows.shift();
const records = rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));

const irisTrackOrder = [
    'Sleep Walking Orchestra',
    'なないろ',
    'Gravity',
    'SOUVENIR',
    'Small world',
    'クロノスタシス',
    'Flare',
    '邂逅',
    '青の朔日',
    'strawberry',
    '窓の中から',
    '木漏れ日と一緒に',
    'アカシア',
];
const irisTitles = new Set(irisTrackOrder);

records.forEach((record) => {
    if (irisTitles.has(record.title)) record.album = '「Iris」';
    if (record.title === 'Hello，world!') record.title = 'Hello,world!';
});

const additions = [
    { id: '146', title: '青の朔日', album: '「Iris」', dummy: 'dummy' },
    { id: '147', title: 'strawberry', album: '「Iris」', dummy: 'dummy' },
    { id: '148', title: 'I', album: 'シングル限定/その他', dummy: 'dummy' },
    { id: '149', title: 'Theme of Sphery Rendezvous', album: 'シングル限定/その他', dummy: 'dummy' },
    { id: '1046', title: '朝焼け', album: '隠しトラック', dummy: 'dummy' },
];

additions.forEach((addition) => {
    if (!records.some((record) => record.title === addition.title)) records.push(addition);
});

function catalogOrder(record) {
    const numericId = Number(record.id);
    if (numericId <= 125) return numericId;
    if (irisTitles.has(record.title)) return 200 + irisTrackOrder.indexOf(record.title);
    if (numericId < 1000) return 400 + numericId;
    return 2000 + numericId;
}

records.sort((left, right) => catalogOrder(left) - catalogOrder(right));
fs.writeFileSync(catalogPath, serializeCsv([headers, ...records.map((record) => headers.map((header) => record[header]))]), 'utf8');

const hiddenRows = parseCsv(decodeCatalog(hiddenCatalogPath));
if (!hiddenRows.some((row) => row[1] === '朝焼け')) {
    hiddenRows.push(['45', '朝焼け', '隠しトラック', '「Iris」', '隠し']);
}
fs.writeFileSync(hiddenCatalogPath, serializeCsv(hiddenRows), 'utf8');

console.log(`Updated ${records.length} songs and normalized both catalogs to UTF-8.`);
