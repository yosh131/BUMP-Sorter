document.addEventListener('DOMContentLoaded', function () {
    // URLパラメータから選択された楽曲リストを取得
    const urlParams = new URLSearchParams(window.location.search);
    const selectedSongsParam = urlParams.get('selectedList');
    const selectedSongs = JSON.parse(decodeURIComponent(selectedSongsParam));

    // 選択された楽曲リストを表示
    const selectedListDiv = document.getElementById('selectedList');
    selectedSongs.forEach((song) => {
        const songDiv = document.createElement('div');
        songDiv.textContent = `${song.title}`;
        selectedListDiv.appendChild(songDiv);
    });
});