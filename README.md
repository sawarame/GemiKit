# GemiKit (Toolkit for Google Gemini)

![Version](https://img.shields.io/github/package-json/v/sawarame/GemiKit?color=blue)
![Chrome Web Store](https://img.shields.io/chrome-web-store/v/iolhhcbgkkmlfndhmpclkabebjlinkic.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)

GemiKit は、Google Gemini のウェブインターフェースでの入力体験と生産性を向上させるためのブラウザ拡張機能です。
意図しない送信を防ぐ快適な改行入力のサポートや、チャット履歴のMarkdown形式でのエクスポート機能を提供し、Geminiの使い勝手をさらに引き上げます。

## Features

- **Enterキーでの改行**: チャット入力欄で `Enter` キーを押した際、誤送信を防ぎ改行のみを挿入します。メッセージの送信は `Ctrl + Enter` (Macの場合は `Cmd + Enter`) で行います。
- **Markdownエクスポート**: 画面右下のフローティングツールボックスから、チャット履歴を綺麗なMarkdown形式で一括ダウンロードできます。ユーザーのプロンプトやGeminiの回答が見やすくフォーマットされ、不要なUI要素は自動で除外されます。
- **機能のON/OFF切り替え**: 拡張機能のオプション画面、または右下のツールボックスメニューからいつでも機能の有効/無効を切り替え可能です。
- **多言語対応 (i18n)**: お使いのブラウザの言語設定に合わせて、日本語と英語の表示に自動で切り替わります（ツールボックスなどのUI、設定画面、エクスポート内容等）。

## Privacy First

ユーザーのデータは安全に保護されます。GemiKitのすべての処理（Markdownの生成やDOMの操作など）はブラウザ上で完結しており、入力したプロンプトやチャット履歴が外部のサードパーティサーバーに送信されることは一切ありません。

## Installation & Usage

### Chromeウェブストアからインストール
以下のバッジからChromeウェブストアへアクセスしインストールしてください。

<a href="https://chromewebstore.google.com/detail/iolhhcbgkkmlfndhmpclkabebjlinkic" target="_blank">
  <img src="https://developer.chrome.com/static/docs/webstore/branding/image/206x58-chrome-web-043497a3d766e.png" alt="Available in the Chrome Web Store" height="58">
</a>


### ローカルでの手動インストール（開発者向け）

1. 本リポジトリをクローンまたはダウンロードします。
2. 依存関係をインストールし、ビルドを実行します（詳細は後述の `Development` を参照）。
3. Chromeの拡張機能ページ (`chrome://extensions/`) を開きます。
4. 右上の「デベロッパー モード」をオンにします。
5. 「パッケージ化されていない拡張機能を読み込む」をクリックし、ビルド出力された `package/` フォルダを選択します。
6. 拡張機能の一覧に「GemiKit」が表示されれば完了です。Gemini (`https://gemini.google.com/`) にアクセスしてご利用ください。

## Development

本プロジェクトは **TypeScript + Webpack** で構築されています。

### 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# 本番用ビルド（package/js の出力と package.zip の作成）
npm run build
```

### 設計ドキュメント

プロジェクトの仕様や詳細な機能については、以下のドキュメントを参照してください。
- [Specification](docs/spec.md) - プロジェクトの仕様書

## License

ISC License