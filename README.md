# BUMP-Sorter

BUMP OF CHICKENの楽曲を選び、対話形式でTop-Kランキングを作る静的Webアプリです。

## ローカルで確認する

ES Modulesを使わない静的サイトですが、CSVの取得があるためHTTPサーバー経由で開いてください。

```sh
python -m http.server 8000
```

その後、`http://localhost:8000/`を開きます。

Modern UIのローカルプレビューは`http://localhost:8000/modern.html`で確認できます。従来版の`index.html`は変更しません。

## テスト

Node.js 20以降で、ソートコアの境界条件とTop-Kの正しさを確認できます。

```sh
npm test
```

## 楽曲データ

- `songdata/songs.csv`: 画面に表示する楽曲一覧（UTF-8）
- `songdata/hidden_songs.csv`: 隠しトラックの出典整理用データ（UTF-8）
- `scripts/update-song-data.mjs`: 2026-06-28時点の公式情報に基づく分類・追加と、UTF-8への正規化

更新時はBUMP OF CHICKEN公式ディスコグラフィーを一次情報にします。短縮版は別曲として扱わず、ライブ専用の導入曲は「シングル限定/その他」へ含めます。隠しトラックは信頼できる複数の非公式情報も参照します。

## ソートと途中保存

ソート処理は`js/sort-core.js`に分離されています。比較履歴と乱数seedを`localStorage`に保存し、ブラウザ再起動後の再開と「1つ戻る」を実現しています。同じ曲の組み合わせは過去の回答を再利用します。
