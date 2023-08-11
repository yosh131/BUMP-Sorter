let selectedSongs = [];
let songList = [];


fetch('songdata/songs.csv')
    .then(response => response.arrayBuffer())
    .then(buffer => {
        const decoder = new TextDecoder('Shift_JIS');
        const csv = decoder.decode(buffer);
        songList = parseCSV(csv);
        generateSongList();
        var instructionDiv_2 = document.getElementById('instruction_2');
        instructionDiv_2.style.display = 'none';
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




// 選択を保存し、ソート部分に遷移
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


    // 疑似的なページ遷移
    // ボタンを非表示にする
    const buttons = document.querySelectorAll('button');
    buttons.forEach((button) => {
        button.style.display = 'none';
    });
    const instructionDiv = document.getElementById('instruction');
    instructionDiv.style.display = 'none';
    const songlistsDiv = document.getElementById('songList');
    songlistsDiv.style.display = 'none';
    const selectedCountButton = document.getElementById('selectedCountButton');
    selectedCountButton.style.display = 'none';
    const instructionDiv_2 = document.getElementById('instruction_2');
    instructionDiv_2.style.display = 'block';

    startSort();
    // // 選択要素数を更新して表示
    // updateSelectedCount();

}




/* ---------- ここからソートの処理 -----------  */

let choiceHistory = -1; // Choiceの結果を格納

async function startSort() {


    // 曲表示と選択ボタンのUI表示

    // テスト
    // let idxs = getRandomIntegersInRange(0, selectedSongs.length - 1, 2)
    // compare_func(selectedSongs[idxs[0]], selectedSongs[idxs[1]]);

    // 5段階の選択ボタンを表示
    const choiceContainer = document.getElementById('choice-container');
    for (let i = 1; i <= 5; i++) {
        const choiceButton = document.createElement('button');
        choiceButton.className = 'choice-button';
        choiceButton.textContent = i;
        choiceButton.addEventListener('click', () => submitPreference(i));


        if (i === 1) {
            const textBeforeButton = document.createElement('span');
            textBeforeButton.className = 'choice-text'; // 新しいクラスを追加
            textBeforeButton.textContent = '左の曲の方が好き←';
            choiceContainer.appendChild(textBeforeButton);
        }

        choiceContainer.appendChild(choiceButton);

        if (i === 5) {
            const textAfterButton = document.createElement('span');
            textAfterButton.className = 'choice-text'; // 新しいクラスを追加
            textAfterButton.textContent = '→右の曲の方が好き';
            choiceContainer.appendChild(textAfterButton);
        }
    }

    quickSortFirstK(selectedSongs, 0, selectedSongs.length, 3);
    // ToDo
    // pivotSelection, partition: pivotSelectionで選択した結果は辞書か何かに記憶しておき、Partitioinで同じ質問があればスキップされるようにする
    // 同順位を管理する機能はmust.
    // Kの値を可変に。
    // resultの表示UI
    // resultをサーバのDBに蓄積させて月間ランキングの作成


    // const med_idx = pivotSelection(selectedSongs, 0, selectedSongs.length, compare_func);
    // console.log(med_idx);


    // for (let i = 0; i < 10; i++) {
    //     let idxs = getRandomIntegersInRange(0, selectedSongs.length - 1, 2)
    //     // GUIでa,bを表示
    //     displaySongs(selectedSongs[idxs[0]], selectedSongs[idxs[1]])
    //     await waitButtonClick();
    //     compare_func(selectedSongs[idxs[0]], selectedSongs[idxs[1]]);
    // }



}

// 改良版クイックソート. リストAを破壊的にソート
// [start, end)の半開区間で渡す。上位K個のソートを保証
async function quickSortFirstK(A, start, end, K) {
    return new Promise(async resolve => {
        if (end - start > 1) {
            const pivot_idx = await pivotSelection(A, start, end, compare_func);

            // 5領域に分割
            const div_index = await partition_5div(A, start, end, pivot_idx, compare_func);

            for (let i = 0; i < 5; i++) {
                if (i == 2) continue; //pivotと等価なものはソートの必要なし
                if (div_index[i] < K) { //区間の開始がK未満のものはまだソートする
                    if (div_index[i + 1] - div_index[i] >= 2) { // 区間長1以下はソート終了
                        await quickSortFirstK(A, div_index[i], div_index[i + 1], K);
                    }
                }
            }
        }
        resolve(A);
    });
}

// pivot選択.[start, end)の3つをランダムに抽出してきて、中央値のインデックスを返す。
// 閾値以下の場合はランダムな一個のインデックスを返す。
async function pivotSelection(A, start, end, compare_func, threshold = 7) {
    async function insertionSort(arr, startIndex, endIndex) {
        return new Promise(async resolve => {
            for (let i = startIndex + 1; i < endIndex; i++) {
                let j = i - 1;
                while (j >= startIndex) {
                    displaySongs(arr[j], arr[j + 1]);
                    await waitButtonClick();
                    if (compare_func(arr[j], arr[j + 1]) > 0) {
                        const current_element = arr[j];
                        arr[j] = arr[j + 1];
                        arr[j + 1] = current_element;
                    }
                    else {
                        break;
                    }
                    j--;
                }
            }
            resolve(arr);
        });

    }
    return new Promise(async resolve => {
        if (end - start <= threshold) {
            resolve(getRandomIntegersInRange(start, end - 1, 1));
        }
        else {
            // 3要素のインデックスをランダムに生成
            const rndIdx = getRandomIntegersInRange(start, end - 1, 3);

            // 部分配列をコピーしてソート
            const partialArray = rndIdx.map(index => A[index]);
            // A.slice(start, end);
            const sortedArr = await insertionSort(partialArray, 0, partialArray.length);

            // 中央値のインデックスを求める
            const medianIndex = Math.floor(sortedArr.length / 2);

            // ソートされた部分配列での中央値の要素を取得
            const medianValue = sortedArr[medianIndex];

            // 中央値の要素が元の配列での何番目の要素かを調べる
            const originalIndex = A.indexOf(medianValue);

            resolve(originalIndex);
        }
    })
}

// pivotを軸にして, compare_funcの結果からn領域に分割
async function partition_5div(A, start, end, pivot_idx, compare_func) {
    return new Promise(async resolve => {
        let left2 = [];
        let left1 = [];
        let middle = [];
        let right1 = [];
        let right2 = [];
        const pivot = A[pivot_idx];
        for (let i = start; i < end; i++) {
            if (i == pivot_idx) {
                middle.push(A[i]);
                continue;
            }
            displaySongs(pivot, A[i]);
            await waitButtonClick();
            const result = compare_func(pivot, A[i]);
            switch (result) {
                case 2:
                    left2.push(A[i]);
                    break;
                case 1:
                    left1.push(A[i]);
                    break;
                case 0:
                    middle.push(A[i]);
                    break;
                case -1:
                    right1.push(A[i]);
                    break;
                case -2:
                    right2.push(A[i]);
                    break;
                default:
                    console.log("Error! choice is out of bound.");
                    break;
            }
        }
        let B = left2.concat(left1);
        B = B.concat(middle);
        B = B.concat(right1);
        B = B.concat(right2);
        for (let i = start; i < end; i++) {
            A[i] = B[i - start];
        }
        let idxs = [0, 0, 0, 0, 0, 0];
        idxs[0] = start;
        idxs[1] = idxs[0] + left2.length;
        idxs[2] = idxs[1] + left1.length;
        idxs[3] = idxs[2] + middle.length;
        idxs[4] = idxs[3] + right1.length;
        idxs[5] = idxs[4] + right2.length;

        resolve(idxs);
    })
}



// 比較関数
function compare_func(a, b) {
    // a, b はsong
    // await waitButtonClick();
    let result = -10;
    switch (choiceHistory) {
        case 1:
            result = -2;
            break;
        case 2:
            result = -1;
            break;
        case 3:
            result = 0;
            break;
        case 4:
            result = 1;
            break;
        case 5:
            result = 2;
            break;
        default:
            console.log("Error! choice is out of bound.");
            break;
    }
    // const result = choiceHistory;
    // クリックの結果をみる
    // console.log(result);
    return result;
}



/* -----------UI部分------------- */

// 2曲を提示する部分
function createSongBox(songName) {
    const songBox = document.createElement('div');
    songBox.className = 'song-box';
    songBox.textContent = songName;
    return songBox
}

function displaySongs(song1, song2) {
    const songBox1 = createSongBox(song1.title);
    const songBox2 = createSongBox(song2.title);
    console.log(song1.title + ' vs ' + song2.title);
    const songContainer = document.getElementById('song-container');
    songContainer.innerHTML = '';
    songContainer.appendChild(songBox1);
    songContainer.appendChild(songBox2);
}


// ボタンで好みの方を選択したときの結果を更新
function submitPreference(choice) {
    // ここに選択結果を処理するコードを追加できます。
    // 例えば、選択された選択肢と対応する曲を記録したり、
    // サーバーに送信する処理を行うことができます。
    choiceHistory = choice;
    // ここでは選択された選択肢をコンソールに表示する例
    console.log(`選択肢 ${choice} が選ばれました。`);
    return choiceHistory;
}

// 乱数生成. [min, max]閉区間で重複なしのcount個の整数を取り出す
function getRandomIntegersInRange(min, max, count) {
    if (count > max - min + 1) {
        throw new Error('指定された範囲内に十分な整数がありません。');
    }

    const result = [];
    while (result.length < count) {
        const randomInt = Math.floor(Math.random() * (max - min + 1)) + min;
        if (!result.includes(randomInt)) {
            result.push(randomInt);
        }
    }

    return result;
}


// Promiseを返す関数
function waitButtonClick() {
    return new Promise((resolve) => {
        const buttons = document.querySelectorAll(".choice-button");
        buttons.forEach((button) => {
            button.addEventListener("click", () => {
                resolve();
            });
        });
    });
}

// --------------old code-------------------

    // // 選択された楽曲リストを表示するHTMLを生成
    // let selectedSongsHTML = '<h2>選択された楽曲:</h2><ul>';
    // selectedSongs.forEach((song) => {
    //     selectedSongsHTML += `<li>${song.title}</li>`;
    // });
    // selectedSongsHTML += '</ul>';

    // // 新しいコンテンツを表示
    // const contentDiv = document.getElementById('content');
    // contentDiv.innerHTML = selectedSongsHTML;

    // Fruit boxes を動的に追加
    // displaySongs(selectedSongs[0], selectedSongs[1]);

    // // Choice buttons を動的に追加
    // const choiceContainer = document.getElementById('choice-container');
    // for (let i = 1; i <= 5; i++) {
    //     const choiceButton = document.createElement('button');
    //     choiceButton.className = 'choice-button';
    //     choiceButton.textContent = i;
    //     choiceButton.addEventListener('click', () => submitPreference(i));
    //     choiceContainer.appendChild(choiceButton);
    // }
// function waitButtonClick() {
//     return new Promise(resolve => {
//         resolveButtonClick = resolve;
//     })
// }
