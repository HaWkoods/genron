# N-1 数学的言語

初版：2026-11-27。前提ノートなし。数学的言語としての論理記号、略記法、古典的推論と論理法則を扱う。集合存在の原理と選択公理は後続ノートに委ねる。

## 原稿と検証

- main.tex：A5、10pt、pLaTeX、jsarticle、amsmath/amsthm、簡潔な柱。共通テンプレート実物を取得できなかったため、このノートの組版は暫定実装。
- 検証した原稿の Git blob SHA: c6fcba4840161573d9b79149fe13e5ccb5fc7e0c（手元でのコンパイル対象とリポジトリの取得内容が一致）。
- platex -interaction=nonstopmode -halt-on-error main.tex を2回、dvipdfmx main.dvi。6頁、A5。ログに Overfull/Underfull/Warning/Error の一致なし。全頁をレンダリングし改ページ・数式・本文を目視確認。参考文献の孤立頁を修正し再コンパイルした。
- 台帳に K-000001〜K-000017 を登録。46件の既存テスト、変更前後の台帳検証・影響抽出をコア関数で実行。変更後のエラー・警告なし。CLIおよびGitHub Actionsの実行結果は未確認。数学的検証は通常の数学的査読であり形式証明ではない。
- pLaTeX原稿を正本とし、掲載用PDFは main.pdf とする。掲載用PDFの生成と目次更新は Publish verified note PDFs ワークフロー、または `node scripts/publish-pdf.mjs N-1` で行う。掲載の確認は総目次を参照。

## 参考文献調査

Google Drive 所蔵の S. G. Krantz, A Primer of Mathematical Writing, 2nd ed., arXiv:1612.04888 (2016) の目次と第1–2章に関する抽出テキスト（量化の誤用、含意の言語的明示等）を確認。数学的な文章・仮定・範囲の明示に参考とした。全篇精読はしていない。数学的な記法・命題・証明は原論の方針に従って独自に記述した。共通テンプレート名でのDrive検索は該当なし。

## 次の制作単位

N-2 集合・写像・関係。背景の集合存在原理を具体化し、個別IDと依存注釈を整備する。
