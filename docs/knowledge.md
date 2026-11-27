# 知識・依存関係台帳：仕様と運用

制定・改訂：2026-11-26。正本は [knowledge.json](knowledge.json) のみ。本書はその仕様であり、個別の数学的知識を重複して管理しない。旧版の Markdown 表は空だったため移行対象の数学的項目はない。

## 基礎

foundation.status は undecided または adopted。adopted は数学を展開するための運用上の基礎方針の採用を意味し、形式的公理系の選定や無矛盾性証明を意味しない。description に許容する数学的言語・推論・背景知識を記録する。現在は [基礎言語の規約](foundations.md) に従い、通常の古典的数学推論と素朴な集合の言語を背景として扱う。個別に必要となる実質的な公理・集合存在原理・背景知識には原稿内の箇所と恒久 ID を与える。数理論理学・現代的集合論の後続の形式化とは別項目とし、後続の形式化を初期数学の依存先にしない。基礎方針の採用前に検証済み項目を登録してはならない。

## 各項目の形式

entries は配列（重複 ID を検出できるようオブジェクト辞書にしない）。各項目の必須フィールド：

| フィールド | 意味 |
|---|---|
| id | K- と6桁の数字。改訂・移動後も維持し、廃止した ID を再利用しない |
| kind | axiom, convention, definition, lemma, proposition, theorem, corollary, construction, exercise, background |
| title | 名称 |
| statement | 正確な定義・命題。仮定と結論を明記 |
| assumptions | 追加仮定の文字列配列。無ければ []。公理や既出概念を参照する場合は depends_on にも記録 |
| position | [ノート番号, 章, 節, 節内番号]（全て正整数）。第一成分はノートの識別用番号であり、異なるノート間の先行順序を意味しない。同一ノート内では残りの成分の辞書式順序を用いる |
| depends_on | 直接依存する恒久 ID の配列 |
| status | planned（予定）, draft（草稿）, verified（検証済）, review（要再検証）, retired（廃止） |
| source | volumes/ 以下の .tex ファイルへのパス。原稿未作成なら null |
| review | verified の場合に必須の非空文字列。検証者・日付・検証内容を記す。自動検査の通過だけで証明の検証済みとはしない |

## 計画段階のノート（notes）

knowledge.json の notes はノート計画の唯一の正本であり、entries は個別知識の正本である。計画上の依存と実際に原稿で使用した依存を混同しない。notes の各要素は number（正整数、恒久識別子 N-番号）、title、area、status、depends_on（前提ノート番号の配列）、goals（到達目標の文字列配列）を持つ。番号は読み順ではない。

- 初版50ノートは全て planned。計画の辺は対象範囲を考慮した暫定的・保守的な前提であり、個別定理にとって必要十分な依存ではない。依存が多すぎる場合はノートの分割や辺の削除を検討する。
- notes の依存先の実在、重複、循環、廃止ノートへの参照、entries の所属ノートの実在、実際のノート間依存が計画上の祖先に含まれることを検査する。予定外の依存が必要になった場合は隠さず計画を改訂する。
- verified ノートには検証済み項目が存在し、登録済みの全項目と直接前提ノートが verified である必要がある。ただし到達目標が実際に満たされたかは人手で確認する。
- docs/roadmap.md は機械生成された閲覧用の Mermaid 図と目次であり、手で独立管理しない。verified のノートに対応する `volumes/N-番号/main.pdf` が存在するとき、題名をPDFへの相対リンクとする。未掲載の場合は明示し、壊れたリンクを作らない。PDFの追加・変更または notes の変更後は `node scripts/knowledge.mjs graph plan --markdown > docs/roadmap.md` で再生成する。PDFの組版と目次更新には `node scripts/publish-pdf.mjs N-番号` も使用できる。
- `graph plan` は予定ノートのグラフ、`graph notes` は entries から導出した実際のノート間グラフ、`graph knowledge` は個別知識のグラフを出力する。前提の抽出は `prerequisites N-番号`（計画）と `prerequisites K-番号`（個別知識）を区別する。

## 論理構造：分岐・合流する有向非巡回グラフ

原論は一本の列ではない。知識を頂点とし、前提 B を用いて A を導入する場合に B → A と表示する。有向辺の反射推移閉包は半順序となる。異なる枝の知識は比較不能であってよく、独立した枝を学習する順序は自由とする。台帳の depends_on は逆向きに、A が直接必要とする B の ID を格納する。これらは同じグラフの二つの表現である。

- ノートは知識項目をまとめる単位。position の第一成分を notes の number に対応するノート識別子（N-1 等）として扱う。別ノートの番号の大小には論理的意味がない。
- 知識グラフからノート間の辺を導出する。同一ノート内の辺を除き、B が属するノートから A が属するノートへ辺を引く。ノート単位でも非巡回とし、知識グラフに循環がなくてもノートのまとめ方が循環を作る場合は、ノートを分割・再編する。
- 一つのノートの本文は通常の線形な順序で構成し、その内部では前方参照を避ける。別ノートへの参照を番号の大小のみで拒絶しない。
- グラフの層（最長の前提経路の辺数、根を0とする）は機械的に導出する。難易度、学習負荷、重要度と同一視しない。層は改訂によって変わり得る。
- 目標項目の前提知識はその祖先の集合であり、無関係な枝を含めない。学習済み集合は前提に関して下方閉でなければならない。読者が次に使用・学習できる項目は、未学習であり、直接前提がすべて学習済みである verified 項目とする。条件付き命題はその仮定を満たす場合のみ適用する。
- ノート間グラフはノートをまとめて学ぶ場合の保守的な前提関係であり、個別知識の最小前提は知識グラフで求める。ノートの題名は notes から取得する。原稿未制作のノートは実際の知識グラフには現れない。
- 章節の細分化やノートの移動でも知識 ID を維持する。同一ノート内の草稿の前方参照・未検証依存は警告、verified の同じ参照はエラーとする。循環・不存在 ID・廃止項目への参照は原則エラー。廃止項目は台帳に残す。

## 原稿での明示的な注釈

各知識項目の定義・証明を次の行単位の TeX コメントで囲む。例は書式説明のみであり、実際の数学的結果ではない。

```tex
% genron:begin K-000002
% genron:use K-000001
% ここに定義・命題・証明を記述する。
% genron:end K-000002
```

- begin/end は一対一で同一ファイル内に置き、入れ子にしない。節内の各命題は独立ブロックとする。
- genron:use は定義・記法・公理等を含む知識の依存を示す。各直接依存先を最低一度明記する。依存が増減したら台帳も更新する。
- 現段階ではコメント記法を標準とするため、pLaTeX の組版には影響しない。将来の共通マクロ用に同一行の \GenronRef{K-000001} / \GenronUse{K-000001} も検査対象にするが、これらの組版定義は未整備。通常の \ref は数学的依存の記録を代替しない。
- volumes/ 以下の全 .tex を走査する。未登録のブロック、台帳と原稿の所在不一致、明示された未登録参照、依存の不足、同一ファイル内の前方参照、位置順の逆転等を検査する。
- 文章中で暗黙に使用した概念や定理、通常の参照、注釈のない本文の論理までは自動では認識できない。執筆者が全依存を注釈し、査読時に突合する。TeX の完全な構文解析器ではない。改行を跨ぐマクロ引数、verbatim 等は対象外。

## コマンド

Node.js 22（外部 npm パッケージ不要）と Git を使用。リポジトリルートで実行する。

```sh
node scripts/test-knowledge.mjs
node scripts/knowledge.mjs check
node scripts/knowledge.mjs check --strict
node scripts/knowledge.mjs available
node scripts/knowledge.mjs available K-000001 K-000002
node scripts/knowledge.mjs prerequisites K-000003
node scripts/knowledge.mjs graph knowledge
node scripts/knowledge.mjs graph notes
node scripts/knowledge.mjs graph plan
node scripts/knowledge.mjs graph plan --mermaid
node scripts/knowledge.mjs graph plan --markdown
node scripts/knowledge.mjs prerequisites N-26
node scripts/knowledge.mjs impact K-000001
node scripts/knowledge.mjs impact --base HEAD~1
```

check はエラーで終了コード1、通常の警告だけなら0。strict は警告も失敗とする。available は学習済みIDの集合（省略時は空集合）から次に学習可能な verified 項目を出力する。学習済み集合が下方閉でない場合はエラーとする。prerequisites は目標IDの全祖先をトポロジカル順で出力する（草稿・予定を含む場合は状態を確認する）。graph knowledge / graph notes は頂点・前提から後続への辺・層を JSON で出力する。impact は直接・間接の逆依存を探索する。--base は旧コミットと現在の台帳・原稿を比較し、削除された旧依存も含めて影響を抽出する。原稿変更はファイル単位で保守的に判定するため、同じファイルの他項目も影響候補となる。review_required は変更または影響を受ける現行 verified 項目の候補一覧。自動的に状態は書き換えない。

## 改訂・検証

定義・命題を変更する前後に impact を実行し、影響項目は再検証する。再検証が完了しなければ review に変更し、それに依存する検証済み項目も適切に降格する。削除ではなく retired を原則とする。仮定の適用範囲、存在・一意性、記号の衝突、論理的矛盾を別途精査する。非循環性・参照整合性の機械検査は数学的無矛盾性や証明の正しさを保証しない。

## 未決事項

後続の形式的公理系の選択、個別の背景知識の範囲、ノートの詳細な章節構成・計画上の前提の精査、全巻共通の定義・記法、TeX 参照マクロ、原稿の \input 順序の自動検証、暗黙依存の形式的検証は未確定または未実装。

## 読者向け定義・命題一覧

[statements.md](statements.md) は復習・確認用の生成物である。`entries` のうち `verified` の公理・規約・定義・補題・命題・定理・系・構成・背景原理を、position の順にノート・章節ごとに列挙する。種類・名称・恒久ID・仮定・statement を掲載し、証明・解説、査読記録、演習、未検証・廃止項目は掲載しない。本文からの逐語抽出ではなく台帳の記述である。`node scripts/knowledge.mjs statements > docs/statements.md` で生成し、台帳変更時に同期する。CIで再生成結果との一致を検査する。生成物の直接編集は禁止する。

### PDF版

正規の閲覧先は [定義・命題一覧（PDF）](statements.pdf)。`node scripts/statements-tex.mjs > docs/statements.tex` で台帳の同じ項目をA5判のpLaTeX原稿に変換する。原稿には仮定とstatementを残し、証明・解説を新たに追加しない。ノート別目次・PDFしおり・知識IDを付す。`node scripts/publish-pdf.mjs` にPDF生成を統合する。Unicode数学記号・ASCIIの上下添字等の変換は限定的な組版処理であり、一般の数式構文解析ではない。新しい記法を追加する際は変換規則と全頁の組版を確認する。CIはTeX生成結果の一致とPDFヘッダを検査するが、PDFの完全な内容・表示の正しさを保証するものではない。

## 部・篇の分類（2026-11-27）

分類は `parts: [{id: "P-01", title}]`、`treatises: [{id: "T-01", part: "P-01", title, goals}]`、各 `notes[].treatise` で管理する。部・篇のIDは恒久的な分類識別子であり、依存辺ではない。分類の実在・重複・空の部篇を検査する。ノートDAGは従来どおり notes[].depends_on、実際の知識DAGは entries[].depends_on のみから導出する。分類導入前の履歴・テスト用台帳は引き続き読み込める。総目次は部・篇別の折りたたみ表と着手可能ノートを生成し、大規模な全体Mermaid図は埋め込まない（従来のCLIで取得可能）。計画ノートはPDFリンクを持たず、公開されたもののみリンクを付す。

## 分野を含む表示番号

`numbering_version: 1` の台帳では全ノートに正整数 `display_index` を必須とし，同一篇内で重複させない．部・篇の恒久IDの数値部分と篇内番号から `03.09.02` の形式でノート表示番号を生成する．知識表示番号はこれに position の章・節・項目を連結した `03.09.02.1.1.1` 形式とする．旧台帳の恒久N-ID・K-ID・position・参照URLは維持する．廃止ノートの番号も予約済みとして扱い，追加ノートは篇内最大値の次を用いる．分類変更に伴う表示番号の変更は明示的に記録する．PDF旧版の番号は変更せず，Web本文の参照リンクは日本語名のみとする．
