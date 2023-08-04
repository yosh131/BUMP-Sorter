let selectedSongs = [];
let songList = [];

fetch('../songdata/songs.csv')
    .then(response => response.arrayBuffer())
    .then(buffer => {
        const decoder = new TextDecoder('Shift_JIS');
        const csv = decoder.decode(buffer);
        songList = parseCSV(csv);
        generateSongList();
    })
    .catch(error => {
        console.error('楽曲リストの取得に失敗しました', error);
    });

function parseCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    const records = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].split(',');
        const record = {};
        for (let j = 0; j < headers.length; j++) {
            record[headers[j]] = line[j];
        }
        records.push(record);
    }

    return records;
}

function generateSongList() {
    const songListDiv = document.getElementById('songList');
    let currentAlbum = '';
    const columns = 3;

    songList.forEach((song) => {
        if (song.album !== currentAlbum) {
            if (currentAlbum !== '') {
                // 前のアルバムが終わったら改行
                songListDiv.appendChild(document.createElement('br'));
            }

            const albumHeader = document.createElement('h3');
            albumHeader.textContent = song.album;
            songListDiv.appendChild(albumHeader);
            currentAlbum = song.album;
        }

        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'song';
        checkbox.value = song.id;
        label.appendChild(checkbox);
        label.append(` ${song.title}`);
        label.appendChild(document.createElement('br'));
        songListDiv.appendChild(label);
    });
}


function selectAll() {
    const checkboxes = document.getElementsByName('song');
    checkboxes.forEach((checkbox) => {
        checkbox.checked = true;
    });
}

function deselectAll() {
    const checkboxes = document.getElementsByName('song');
    checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
    });
}

function saveSelection() {
    selectedSongs = [];
    const checkboxes = document.getElementsByName('song');
    checkboxes.forEach((checkbox) => {
        if (checkbox.checked) {
            selectedSongs.push(checkbox.value);
        }
    });
    // updateSelectedList();
    // クエリパラメータに選択された曲リストを渡してselected_songs.htmlに遷移する
    const queryString = `?selectedList=${encodeURIComponent(JSON.stringify(selectedSongs))}`;
    window.location.href = `selected_songs.html${queryString}`;
}

function updateSelectedList() {
    const selectedList = document.getElementById('selectedList');
    selectedList.innerHTML = '';
    selectedSongs.forEach((song) => {
        const listItem = document.createElement('li');
        listItem.textContent = song;
        selectedList.appendChild(listItem);
    });
}