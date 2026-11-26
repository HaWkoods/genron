# 記号・記法一覧（第1版）

既出の記法を優先する。未登場の対象については先行規約（採用候補を含む）であり、数学的定義・命題の確立や利用許可を意味しない。同一文脈の衝突は添字・文字の変更で解消する。意味・仮定・正規化は正式原稿で定める。

## 数学的言語・集合（既出）

- $\forall,\exists,\exists!,\neg,\land,\lor,\Rightarrow,\Leftrightarrow$：量化・論理結合
- $\varnothing,\in,\notin,\subseteq,\subsetneq$：空集合・所属・包含・真包含
- $\mathcal P(X),\{x\in X\mid P(x)\}$：冪集合・部分集合の指定
- $A\cup B,\ A\cap B,\ A\setminus B$：合併・共通部分・差
- $(A_i)_{i\in I},\ \bigcup_{i\in I}A_i$：集合族・合併
- $\bigcap_{i\in I}A_i,\ \prod_{i\in I}A_i,\ \coprod_{i\in I}A_i$：共通部分・直積・非交和
- $f:X\to Y,\quad x\mapsto f(x)$：写像
- $f(A),\ f^{-1}(B),\ f\vert_A$：像・逆像・制限
- $g\circ f,\ \mathrm{id}_X,\ Y^X$：合成・恒等写像・写像全体
- $[x],\ X/{\sim},\ \pi$：同値類・商集合・標準全射
- $\lvert X\rvert,\ \mathbb N$：有限集合の元の個数・自然数（0を含む）
- $\leq,\ <,\ \sup,\ \inf,\ \vee,\ \wedge$：順序・上限・下限・束演算
- $P^{\mathrm{op}},\ \operatorname{Fix}(c)$：双対順序・固定元集合

## 位相・収束（既出及び先行）

- $\mathcal O,\ (X,\mathcal O),\ U\in\mathcal O$：開集合系・位相空間・開集合（指定済）
- $\mathcal C,\ \mathcal O(\mathcal S)$：閉集合系・生成位相（既出の記法を整理）
- $\mathcal O_X,\ \mathcal O_Y,\ \mathcal O_1,\ \mathcal O_2$：空間・添字で位相を区別
- $\mathcal N(x),\ \mathcal B_x,\ \mathcal B$：近傍系・近傍基・開基
- $\operatorname{Int}(A),\ \overline A,\ \partial A,\ A'$：内部・閉包・境界・集積点集合
- $d(x,y),\ B_d(x,r),\ \overline B_d(x,r)$：距離・開球・閉球（閉球は開球の閉包とは限らない）
- $\mathcal F,\ x_i\to x,\ \widehat X$：フィルター・収束・完備化
- $\pi_0(X),\ \pi_1(X,x),\ \pi_n(X,x)$：連結成分（経路成分として定義）・ホモトピー群
- $f\simeq g,\ X\cong Y$：ホモトピー・同相（文脈明示）

## 代数・数体系（先行（一部既出））

- $\mathbb Z,\mathbb Q,\mathbb R,\mathbb C$：整数・有理数・実数・複素数
- $M,\ G,\ H,\ N$：モノイド・群・部分群・正規部分群
- $1_G,\ x^{-1},\ xy,\ \langle S\rangle$：単位元・逆元・積・生成部分群
- $H\leq G,\ N\trianglelefteq G,\ G/N,\ [G:H]$：部分群・正規部分群・商群・指数
- $\ker f,\ \operatorname{Im}f,\ \operatorname{Aut}(G)$：核・像・自己同型群
- $A,\ R,\ K,\ L,\ k$：環・環・体・拡大体・基礎体
- $\mathfrak a,\ \mathfrak p,\ \mathfrak m$：イデアル・素イデアル・極大イデアル
- $A^\times,\ A/\mathfrak a,\ (a_1,\ldots,a_n)$：単元群・商環・生成イデアル
- $\sqrt{\mathfrak a},\ \operatorname{Spec}A,\ \operatorname{MaxSpec}A$：根基・素スペクトル・極大スペクトル
- $S^{-1}A,\ A_{\mathfrak p},\ \operatorname{Frac}(A)$：局所化・素イデアルでの局所化・分数体
- $A[X_1,\ldots,X_n],\ A[[X]]$：多項式環・形式冪級数環
- $L/K,\ [L:K],\ \operatorname{Gal}(L/K)$：体拡大・拡大次数・Galois群
- $\mathcal O_K,\ \operatorname{Tr}_{L/K},\ N_{L/K}$：整数環・トレース・ノルム
- $v,\ \lvert\cdot\rvert_v,\ K_v,\ \mathbb Z_p,\ \mathbb Q_p$：付値・絶対値・完備化・p進整数・p進数
- $M,\ N,\ \operatorname{Hom}_A(M,N)$：加群・加群準同型全体
- $M\oplus N,\ M\otimes_A N,\ M^*$：直和・テンソル積・双対
- $\dim_K V,\ \operatorname{rank}T,\ \det A,\ \operatorname{tr}A$：次元・階数・行列式・跡
- $\mathrm{GL}_n(K),\ \mathrm{SL}_n(K)$：一般線形群・特殊線形群

## 解析・測度・確率（先行（一部既出））

- $(X,\mathcal A),\ \sigma(\mathcal S),\ \mathcal B(X)$：可測空間・生成σ加法族・Borel加法族
- $(X,\mathcal A,\mu),\ \mu^*,\ \mu\otimes\nu$：測度空間・外測度・積測度
- $\int_A f\,d\mu,\ \frac{d\nu}{d\mu}$：積分・Radon--Nikodym微分
- $f_*\mu,\ \mu\ll\nu,\ \mu\perp\nu$：像測度・絶対連続・相互特異
- $L^p(X,\mu),\ \|f\|_p,\ \ell^p$：Lebesgue空間・ノルム・数列空間
- $C(X),\ C_c(X),\ C_0(X)$：連続函数・コンパクト台・無限遠で消える函数
- $\|x\|,\ \langle x,y\rangle,\ X^*$：ノルム・内積（線形側は別途規定）・連続双対
- $\mathcal L(X,Y),\ T^*,\ \|T\|,\ \sigma(T)$：有界線形作用素・随伴・作用素ノルム・スペクトル
- $D f(x),\ \partial_i f,\ \nabla f,\ D^2f$：微分・偏微分・勾配・二階微分
- $\limsup,\ \liminf,\ \sum,\ \int$：上極限・下極限・級数・積分
- $\widehat f,\ \mathcal F f,\ f*g$：Fourier変換・変換作用素・畳込み（正規化は導入時）
- $\mathcal D'(U),\ W^{k,p}(U),\ H^k(U)$：超函数・Sobolev空間・L2型Sobolev空間
- $\operatorname{Re}z,\ \operatorname{Im}z,\ \overline z,\ \operatorname{Res}_{z=a}f$：実部・虚部・共役・留数
- $(\Omega,\mathcal F,\mathbb P),\ \mathbb E[X]$：確率空間・期待値
- $\mathbb E[X\mid\mathcal G],\ \operatorname{Var}(X),\ \operatorname{Cov}(X,Y)$：条件付き期待値・分散・共分散
- $(\mathcal F_t)_{t\geq0},\ (X_t)_{t\geq0},\ B_t$：フィルトレーション・確率過程・Brown運動

## 圏・幾何・ホモロジー（先行）

- $\mathcal C,\ \mathcal D,\ \operatorname{Ob}(\mathcal C)$：圏・対象
- $\operatorname{Hom}_{\mathcal C}(X,Y),\ F:\mathcal C\to\mathcal D$：射集合・函手
- $\mathcal C^{\mathrm{op}},\ \eta:F\Rightarrow G$：反対圏・自然変換
- $\varprojlim,\ \varinjlim,\ F\dashv G$：射影極限・帰納極限・随伴
- $(M,\mathcal A),\ (U,\varphi),\ T_pM,\ TM$：多様体・座標近傍・接空間・接束
- $T_p^*M,\ T^*M,\ df_p,\ f^*\omega$：余接空間・余接束・接写像・引戻し
- $\mathfrak X(M),\ \Omega^k(M),\ d,\ \wedge$：ベクトル場・微分形式・外微分・外積
- $g,\ \nabla,\ R,\ \operatorname{grad}f$：計量・接続・曲率・勾配
- $\mathfrak g,\ [X,Y],\ \exp$：Lie代数・括弧・指数写像
- $C_n(X),\ \partial_n,\ H_n(X;A),\ H^n(X;A)$：鎖群・境界写像・ホモロジー・コホモロジー
- $\operatorname{Ext}_A^n(M,N),\ \operatorname{Tor}_n^A(M,N)$：導来函手
- $(X,\mathcal O_X),\ \mathcal F(U),\ \mathcal F_x$：環付き空間・層の切断・茎
- $V(I),\ D(f),\ \operatorname{Proj}S$：零点集合・基本開集合・射影スペクトル
- $G=(V,E),\ \deg(v),\ A_G$：グラフ・次数・隣接行列
- $\operatorname*{argmin}_{x\in X}f(x),\ \operatorname*{argmax}_{x\in X}f(x)$：最小化点集合・最大化点集合

## 調査記録

調査記録：Bredon, Topology and Geometry, 近傍の定義2.3–2.5；Atiyah–Macdonald, Introduction to Commutative Algebra (1969), Notation and Terminology, Ch.1；Neukirch, Algebraic Number Theory (1999), Ch. I §3；Mac Lane, Categories for the Working Mathematician, Ch. I §1；Lee, Introduction to Smooth Manifolds, 2nd ed. (2013), Ch.1 の座標変換；Conway, A Course in Functional Analysis, Ch. I §3・Ch. II §2。Google Driveの抽出本文を確認。その他の先行記法は標準的慣習からの独自提案であり、文献の逐語転記・全分野の文献照合ではない。
