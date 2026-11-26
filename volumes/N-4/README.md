# N-4 順序と束

初版：2026-11-27。前提：N-2 集合・写像・関係（およびその前提 N-1）。N-3は前提としない。

- [PDF](main.pdf)（A5判16頁）
- [pLaTeX原稿](main.tex)
- [総目次](../../docs/roadmap.md)

## 構成と方針

前順序・半順序・全順序、双対、前順序の商、上限下限、極大元と最大元、鎖・有向集合、順序保存写像・順序同型、束と演算による特徴づけ、部分束、束準同型・束同型、完備束、分配束・Boolean束、閉包作用素、Galois接続、Knaster–Tarskiの不動点定理を扱う。数体系を前提とせず、有限個の元の例はN-2の集合構成で実現する。空の順序集合を許容する一方、束は非空とし、完備束では空部分集合の上限下限も要求する。一元Boolean束を許す。Galois接続は順序保存型を採用した。これらの定義の選択と、閉包・随伴・不動点の追加は制作上の判断であり、今後の理論への接続を意図する。選択公理は使用しない。

## 文献調査

- T. Jech, Set Theory, Third Millennium Edition, Springer, 2003, Ch. 2（順序）。
- J. M. Lee, Introduction to Topological Manifolds, 2nd ed., Springer, 2011, Appendix A, pp. 385–386（順序と極大元）。
- S. Mac Lane, Categories for the Working Mathematician, 2nd ed., Springer, 1998, IV.5（Galois接続）。

Google Drive所蔵の関連抽出テキストを確認した。全篇精読ではない。証明はN-2までの前提から独自に記述した。

## 検証

- N-1・N-2の暫定組版を継承。pLaTeXを2回実行し、dvipdfmxでA5判16頁のPDFを生成。コンパイルログにWarning、Overfull、Underfull、エラーなし。全頁をレンダリングし目視確認した。
- 原稿 blob: bf56556789e32621040e984b41d95147a264e167。PDF blob: de8d9f81a224436b7675eb2ad53f9693483595fd。ローカルのファイルとGitHubに登録するblobのハッシュは一致。
- K-000068〜K-000096 の29項目を登録。2篇合計40項目追加、累計96項目。既存49件のテスト、変更前後の台帳・原稿注釈を検証用コア関数で実行し、エラー・警告なし。変更前の項目への逆依存影響なし。N-4の全項目の前提閉包に選択公理 K-000060 が含まれないことを確認した。
- 独立したNodeプロセスでのCLI実行とGitHub Actionsの実行結果は未確認。数学的証明の点検は形式証明ではない。
- 共通pLaTeXテンプレート第2版の実体は未取得であり、N-1・N-2と同じ暫定組版を使用。
