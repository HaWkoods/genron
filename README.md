# 数学原論

ブルバキ『数学原論』の構造的・公理的な思想を参照し、独立した論考の集積ではなく、全巻を通じて論理的に整合する数学書の叢書を制作する。擬コンラットとは別の企画である。

## 制作管理
- [記号・記法一覧（原稿・規約）](docs/notation.md) ／ [電子閲覧室PDF](https://hawkoods.github.io/genron/?note=notation)（自動公開後）
- [AGENTS.md](AGENTS.md)：AIを含む執筆者の共通指示
- [制作方法論](docs/methodology.md)：執筆・検証・改訂の手順
- [知識・依存関係台帳（JSON）](docs/knowledge.json)：各段階で導入済みの知識、前提、公理、定義、結果、依存関係の唯一の正本
- [総目次・予定ノートグラフ](docs/roadmap.md)：10部・52篇・357ノートの暫定構成、到達目標、計画上の依存関係。PDF掲載済みの完成ノートは題名から直接閲覧できる。
- [定義・命題一覧（PDF・復習確認用）](docs/statements.pdf)：検証済みの定義・公理・命題等をノートごとに列挙。証明・解説なし。[テキスト版](docs/statements.md)
- [台帳仕様・運用](docs/knowledge.md)：登録方法、原稿の注釈、検証コマンド
- [基礎言語と数理論理学の位置づけ](docs/foundations.md)：初期の数学的言語と後続の形式的研究を区別する規約
- [参考文献の調査・利用規約](docs/references.md)：Google Drive の所蔵資料を積極的に活用する方針と引用規約

各原稿と台帳を対応させ、必要な前提知識だけで論証できる体系を目指す。原論全体は一本の列ではなく、基礎から発展へ分岐・合流する有向非巡回グラフ（DAG）である。ノート間の順序は依存関係から導き、番号の大小や制作順序とは区別する。知識単位とノート単位のグラフを台帳から生成する。

初期化日：2026-11-26。N-1「数学的言語」からN-7「濃度と可算性」までの7篇の原稿・PDFが完成しており、通常の数学的推論と素朴な集合の言語を背景として用い、数理論理学・現代的集合論は後続の応用的な枝とする。特定の形式的公理系・各ノートの詳細構成は未確定である。旧52分野の計画を52篇に保存し、10部・357ノートに再編した。初期7篇に続き N-8「位相と開集合」・N-9「二項演算とモノイド」・N-24「集合環とσ-加法族」を完成し、計10ノート・193知識項目を登録した。

## 分類と論理構造

部（P-ID）→篇（T-ID）→ノート（N-ID）→知識（K-ID）の分類を採用する。部・篇は分類であり、ノート・知識のDAGとは独立する。ノートは原則5〜15頁程度、必要な証明は分量を理由に省略しない。長い主題は論理的到達点で分割する。完成済みN-1〜N-7とK-IDは維持する。未制作の旧N-8〜N-52は対応する篇の最初のノートに割り当て、新規ノートには53以降を付した。番号は論理順・制作順ではない。計画上の依存は執筆前に個別に査読・精査する。

## 検証

Node.js 22（外部パッケージ不要）で `node scripts/test-knowledge.mjs` と `node scripts/knowledge.mjs check` を実行する。詳細は台帳仕様を参照。

`node scripts/knowledge.mjs graph notes` でノートのグラフ、`graph knowledge` で知識のグラフ、`prerequisites ID` で目標の全前提、`available [ID...]` で学習済み集合から次に進める項目を取得できる。

`node scripts/knowledge.mjs graph plan` は予定ノートのグラフを出力する。`prerequisites N-26` は予定ノートの前提を抽出する。`graph plan --markdown` で総目次を再生成できる。予定と実際の知識を区別する。

## PDFの閲覧と掲載

[総目次](docs/roadmap.md)の完成ノート名からGitHubのPDFプレビューを開ける。PDFの掲載先は `volumes/N-番号/main.pdf`。GitHub Actions の [Publish verified note PDFs](.github/workflows/publish-pdf.yml) は main の原稿・台帳等の変更時に検証済みノートをpLaTeXで再生成し、PDFと総目次をコミットする。手元でも `node scripts/publish-pdf.mjs N-1`（pLaTeX、dvipdfmx、pdfinfo が必要）で掲載用PDFと総目次を生成できる。未掲載のノートにリンクは付けない。

## 電子閲覧室

[閲覧サイト（GitHub Pages）](https://hawkoods.github.io/genron/) — 検索・PDF参照・プレビュー。公開設定が未完了の場合は [Actions](https://github.com/HaWkoods/genron/actions/workflows/reader.yml) と [設計・公開手順](docs/viewer-design.md) を参照。
