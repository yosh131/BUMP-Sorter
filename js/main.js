let selectedSongs = [];
let songList = [];

fetch('songdata/songs.csv')
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
        record["checked"] = false;
        records.push(record);
    }

    return records;
}

function generateSongList() {
    const songListDiv = document.getElementById('songList');
    let currentAlbum = '';
    const columns = 3;

    songList.forEach((song, index) => {
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
        checkbox.checked = false;
        checkbox.addEventListener('change', () => handleCheckboxChange(index));

        label.appendChild(checkbox);
        label.append(` ${song.title}`);
        label.appendChild(document.createElement('br'));
        songListDiv.appendChild(label);
    });
    updateCheckedCount();

}


function saveSelection() {
    selectedSongs = [];
    const checkboxes = document.getElementsByName('song');
    checkboxes.forEach((checkbox) => {
        if (checkbox.checked) {
            const selectedSong = songList.find((song) => song.id === checkbox.value);
            if (selectedSong) {
                selectedSongs.push(selectedSong);
            }
        }
    });


    // ボタンを非表示にする
    const buttons = document.querySelectorAll('button');
    buttons.forEach((button) => {
        button.style.display = 'none';
    });
    const instructionDiv = document.getElementById('instruction');
    instructionDiv.style.display = 'none';
    const songlistsDiv = document.getElementById('songList');
    songlistsDiv.style.display = 'none';

    // 選択された楽曲リストを表示するHTMLを生成
    let selectedSongsHTML = '<h2>選択された楽曲:</h2><ul>';
    selectedSongs.forEach((song) => {
        selectedSongsHTML += `<li>${song.title}</li>`;
    });
    selectedSongsHTML += '</ul>';

    // 新しいコンテンツを表示
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = selectedSongsHTML;

    // 選択要素数を更新して表示
    updateSelectedCount();

}


// 全選択・選択解除
function selectAll() {
    const checkboxes = document.getElementsByName('song');
    checkboxes.forEach((checkbox) => {
        checkbox.checked = true;
    });
    updateCheckedCount();
}

function deselectAll() {
    const checkboxes = document.getElementsByName('song');
    checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
    });
    updateCheckedCount();
}

// チェックボックスの状態変化を監視
function handleCheckboxChange(index) {
    songList[index].checked = !songList[index].checked;
    updateCheckedCount();
}

// チェック数のカウントを更新
function updateCheckedCount() {
    // const checkedCount = songList.filter(song => song.checked).length;
    const checkboxes = document.getElementsByName('song');
    let checkNum = 0;
    checkboxes.forEach((checkbox) => {
        if (checkbox.checked) {
            checkNum++;
        }
    });
    document.getElementById('checked-count').textContent = `選択された楽曲数: ${checkNum}/${songList.length}`;
}



