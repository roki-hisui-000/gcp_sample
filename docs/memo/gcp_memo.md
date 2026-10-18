# GCPを触ってみる。

## 権限について

- `xxxx-compute@developer.gserviceaccount.com`について
    - GCPのIAMで自動作成される**Compute Engine デフォルト サービス アカウント**と呼ばれるもの。
        - Google Cloud（GCP）で Compute Engine（仮想マシン / VM）のAPIを有効化したり、インスタンスを作成したりした際に、システムが自動的に作成するサービスアカウントです。
            - 役割: VMインスタンスがGoogle Cloud内の他のサービス（Cloud Logging、Cloud Monitoring、Cloud Storageなど）と連携・アクセスするための「身分証明書」として機能します。
            - 命名規則: [プロジェクト番号]-compute@developer.gserviceaccount.com という形式になっています。
    - 付与している権限によっては流出時に乗っ取りが行われる可能性があります。<br>そのため、権限を見直すのを推奨する。

- オーナーユーザーでデプロイを行うのはセキュリティ面で推奨できないため、デプロイユーザを作成してそっちで実施する。<br>
1. ユーザ登録手順
```
# "deployer-sa"ユーザを作成する
gcloud iam service-accounts create deployer-sa \
    --display-name="Deployer Service Account for GCP Sample" \
    --project=gcp-sample-project-509110

# プロジェクトIDとメールアドレスを宣言   
PROJECT_ID="gcp-sample-project-509110"
SA_EMAIL="deployer-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# 必要な権限を付与する
# 1. Artifact Registry への書き込み権限 (Docker PUSH用)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/artifactregistry.writer"
```

2. ログイン/ログアウト
```
# 1. サービスアカウントキー (key.json) をローカルに作成・ダウンロード
# 一度、作成すると次回からは不要（有効期限はデフォルト2年）
gcloud iam service-accounts keys create key.json \
    --iam-account=deployer-sa@gcp-sample-project-509110.iam.gserviceaccount.com

# 2. 作成した key.json を使って deployer-sa として直接認証（ログイン）
gcloud auth activate-service-account --key-file=key.json

# 3. 認証状態の確認 (deployer-sa に * 印が付いてアクティブになっていれば完了です)
gcloud auth list

# 4. 全アカウントからログアウト
gcloud auth revoke --all

# 5. ログアウトの確認（No credentialed accounts.と表示されればOK）
gcloud auth list

# 補足
# 6. オーナーユーザでログイン
gcloud auth login

# 7. デプロイ実施するユーザに切り替える
gcloud auth activate-service-account --key-file=key.json
```

---

## セキュリティ

### 概要
1. 責任共有モデル（Security by Design）
クラウドのセキュリティは、Googleと利用者が役割を分担する「責任共有モデル」を採用しています。
    - Google側の責任（Cloud of Security）： 物理的なデータセンターの安全管理、ハードウェア、グローバルネットワーク、基盤インフラストラクチャの保護。
    - 利用者側の責任（Security in Cloud）： OSやアプリケーションの設定、IAM（アクセス権限）の適切な管理、データの暗号化キーの管理など。

2. GCPを支える主なセキュリティ機能
    - 強固なインフラストラクチャと物理セキュリティ
        - 生体認証、監視カメラ、金属探知、侵入検知システムなど、厳重なセキュリティで保護されたデータセンターを採用しています。

### Google Cloud Armor（グーグル クラウド アーマー）
1. ネイティブのセキュリティサービスとして、「Google Cloud Armor（グーグル クラウド アーマー）」が用意されています。
    - **Google Cloud Armorは、基本的には外部HTTP(S)ロードバランサー（のバックエンドサービス）に対して適用する仕組み**

2. Google Cloud Armorは、Googleのグローバルネットワークの端（エッジ）で動作するDDoS対策およびWAF（Webアプリケーションファイアウォール）サービスです。<br>

主な特徴は以下の通りです。

- OWASP Top 10 対策（事前構成済みWAFルール）
    - SQLインジェクションやクロスサイトスクリプティング（XSS）といった、一般的なWebアプリケーションの脆弱性を狙う攻撃を防ぐためのルールが標準で用意されています。

```
# セキュリティポリシー my-policy に対して、「SQLインジェクション」「XSS」「リモートコード実行」をまとめてブロックするルール（優先度：50）を追加する
gcloud compute security-policies rules create 50 \
    --security-policy=my-policy \
    --action=deny-403 \
    --expression="evaluatePreconfiguredWaf('sqli-v33-stable') || evaluatePreconfiguredWaf('xss-v33-stable') || evaluatePreconfiguredWaf('rce-v33-stable')" \
    --description="Block OWASP Top 10 (SQLi, XSS, RCE)"
```

- DDoS対策（L3/L4〜L7）
    Googleが検索やYouTubeなどの自社サービスを保護している実績のあるインフラを活用し、大規模なDDoS攻撃からシステムを保護します。<br>
    機械学習を用いた自動検知（アダプティブプロテクション）も利用可能です。
```
# 対象: すべての通常トラフィック（リアルタイム配信APIなど除外したいパスは事前に通しておく）
# 条件: 同一IPから 1分間に100回を超える リクエストが来た場合
# 動作: そのIPからの過剰なアクセスを 5分間自動でブロック（Rate-based ban / 403応答） する
gcloud compute security-policies rules create 150 \
    --security-policy=my-policy \
    --description="L7 DDoS and Flood protection for general traffic" \
    --action=rate-based-ban \
    --rate-limit-threshold-count=100 \
    --rate-limit-threshold-interval-sec=60 \
    --ban-duration-sec=300 \
    --conform-action=allow \
    --exceed-action=deny-403 \
    --enforce-on-key=IP
```

- 柔軟なアクセス制御（IP / 地域 / カスタムルール）
    - IPアドレスのホワイトリスト・ブラックリストによる制限や、特定国からのアクセスブロック（ジオブロック）、カスタム式による細かなリクエスト制御が可能です。<br>
      レートリミッティング（流量制限）:短時間に大量のリクエストを送信するボットやスクレイピング、DDoS攻撃から保護するため、IP単位などでリクエスト数を制限できます。
```
# 特定のIPアドレス / CIDR範囲を許可（Allow）
gcloud compute security-policies rules create 100 \
    --security-policy=my-policy \
    --description="Allow corporate IPs" \
    --src-ip-ranges="203.0.113.5/32,198.51.100.0/24" \
    --action="allow"

# 特定の悪質なIP帯をブロック（Deny）
gcloud compute security-policies rules create 110 \
    --security-policy=my-policy \
    --description="Block known bad IP range" \
    --src-ip-ranges="192.0.2.0/24" \
    --action="deny-403"
```

- ボット対策
    - reCAPTCHA Enterpriseとのネイティブ統合により、高度なボット管理や不正防止が可能です。   

---

## ネットワーク

### 1. GCPネットワークの最大の特徴：完全な「グローバル」設計

AWSなどでは「VPCはリージョン（地域）ごとのリソース」であり、異なるリージョン間を繋ぐには追加のルーティング設定が必要になります。<br>
しかし、Google CloudのVPC（Virtual Private Cloud）は、最初から「すべてのリージョンにまたがるグローバルリソース」として設計されています。

- メリット: 日本（東京/大阪）やアメリカ、ヨーロッパなど、世界中のリージョンにある仮想マシン（VM）同士を、1つのVPCネットワーク内でひとまとめに管理できます。
- 通信の仕組み: Googleが世界中に張り巡らせた独自の強固なバックボーン（海底ケーブルや専用ネットワーク）を利用するため、パブリックインターネットを経由せず、<br>
  セキュアかつ超高速にグローバル通信が行えます。

### 2. ネットワークの基本構成要素

GCPのネットワークを構成する主な要素は以下の通りです。

- VPC ネットワーク (VPC Network)
    - クラウド上に作成するあなた専用の仮想プライベートネットワーク空間です。

- サブネット (Subnet)
    - VPCネットワークの中に作成するリージョン単位のエリアです。ここにIPアドレスの範囲（CIDR）を割り当てます。
    - サブネットはリージョンに紐づきますが、同じVPC内であればサブネットをまたいだ通信も追加の複雑なルータ設定なしでシームレスに行えます。

- ファイアウォールルール (Firewall Rules)
    - VPCネットワーク全体、または特定のインスタンス（タグなど）に対して、受信・送信のトラフィックを許可・拒否する設定を行います。<br>
      GCPではファイアウォールもグローバルリソースとして機能します。

### 3. 主要なネットワーク機能・接続オプション

GCPには、システムを拡張・連携させるための豊富なネットワーク機能が用意されています。

- グローバル負荷分散（HTTP(S) ロードバランサなど）
    - 世界中のユーザーからのアクセスを、一番近いリージョンのサーバーへ自動的かつ効率的に振り分けることができます。

- オンプレミスや他クラウドとの接続
    - Cloud VPN: インターネット経由で安全にオンプレミス環境とVPCを接続します。
    - Cloud Interconnect: 専用線を使って、よりセキュアで太い帯域の通信を確保します。

- プライベート Google アクセス
    - 仮想マシン（VM）にパブリックIPアドレスを持たせない（外部からアクセスできない）状態のまま、Cloud StorageなどのGoogleの各種サービス（API）に<br>
      安全にアクセスできる機能です。

- VPC ピアリング / 共有 VPC
    - VPCピアリング: 異なるVPC同士をプライベートIPで直接接続します。
    - 共有VPC: 企業などで複数のプロジェクトがある場合に、ネットワーク管理を一つのプロジェクトに一元化（集中管理）しつつ、他のプロジェクトと共有して利用できます。   

### Cloudflareを利用して、国外からのアクセスを遮断する

※ 以下の手順では費用は発生しない。


0. アプリの改修

- Cloudflare経由でアクセスされた国を取得する
    - ローカルで実行時は`JP`を割り当てる
- "JP"以外の場合は403を返す
```
app.use((req, res, next) => {
  let country;

  // ローカル開発環境（localhostなど）の場合の処理
  const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1';

  if (isLocal) {
    // ローカルテスト用として強制的に日本（'JP'）を割り当てる
    // ※あえて海外からのアクセスをテストしたい場合は 'US' などに書き換えられます
    country = process.env.LOCAL_TEST_COUNTRY || 'JP';
    console.log(`[Local Development] Simulating country: ${country}`);
  } else {
    // 本番環境（Cloudflare経由）
    country = req.headers['cf-ipcountry'];
  }

  // 日本(JP)以外からのアクセスの場合は403
  if (country && country !== 'JP') {
    return res.status(403).send('Access Denied: This service is only available in Japan.');
  }

  next();
});
```

1. Cloud Run側でカスタムドメインを登録する
```
# Cloud Runのカスタムドメイン（マッピング）を設定する
gcloud beta run domain-mappings create \
    --service=YOUR_SERVICE_NAME \
    --domain=app.example.com \
    --region=asia-northeast1
```

2. Cloud RunのIngress（外部アクセス制限）を設定する
```
# Cloud RunのIngress（外部アクセス制限）を設定する
gcloud run services update YOUR_SERVICE_NAME \
    --ingress=internal-and-cloud-load-balancing \
    --region=asia-northeast1
```

---

## ログ

Google Cloud（GCP）におけるログ管理は、主に Cloud Logging（旧称: Stackdriver Logging）というフルマネージドサービスによって行われます。 

### 1. Cloud Logging の全体像

GCPでは、仮想マシン（Compute Engine）、コンテナ（GKE）、データベース、サーバーレス（Cloud Runなど）といった各サービスから出力されるログが、設定不要で自動的に Cloud Logging に集約されます。主な構成要素は以下の通りです。

- ログエントリ（LogEntry）
    -  すべてのログの共通データ形式です。タイムスタンプ、深刻度（Severity）、リソース情報、メッセージ本体などが格納されます。

- ログルーター（Log Router）
    -  収集したログをどこに転送・保存するかを制御する仕組みです。フィルタを使って「特定のログだけを別の場所に送る（エクスポートする）」といった制御も可能です。

- ログバケット（Log Bucket）
    -  Cloud Logging専用のストレージ領域です。ここに保存されたログが、コンソール画面から検索・閲覧できるようになります。

### 2. デフォルトで用意される2つのログバケット

プロジェクトを作ると、最初から以下の2つのログバケットが用意されます。

- _Required（必須ログ）
    - 監査ログ（誰が・いつ・何をしたか）やシステムイベントのログが保存されます。
    - 削除や無効化はできず、長期間（デフォルトで400日間）無料で保持されます。

- _Default（デフォルトログ）
    -  _Required 以外のすべてのログ（アプリケーションログや各サービスの稼働ログなど）がここに集約されます。
    -  保持期間はデフォルトで 30日間 です。


### 3. 主な機能と特徴

- ログエクスプローラ（Log Explorer）
    - GCPのコンソール画面上で、直感的にログを検索・フィルタリングできる強力なツールです。<br>
      独自のクエリ言語を使って、エラーログや特定のリクエストを素早く絞り込むことができます。

- Log Analytics（SQLによる分析）
    -  ログバケットに対して SQL（BigQueryの構文） を使って高度な集計や分析を行える機能です。

- 外部へのエクスポート（シンク）
    - ログを長期間保存したい場合や、別の分析基盤に送りたい場合は、「シンク」という機能を使って<br>
      Cloud Storage（GCS） や BigQuery、Pub/Sub へリアルタイムに転送できます。

- ログベースのアラート
    - 特定のエラーメッセージや文字列がログに出力された検知して、メールやSlack等に通知（Cloud Monitoringと連携）させることができます。

### 4. 運用上の重要なポイント（注意点）

- 30日間の保持期間の壁
    - 標準の _Default バケットは30日を過ぎると古いログから自動的に消去されます。もし月をまたいだ不具合調査や監査などで長めに残したい場合は、
      設定を変更して保持期間を延ばす（例: 60〜90日にする）か、GCS等へ退避させる設計が必要です。

- 料金の仕組み
    - Cloud Loggingは主に 「取り込み処理量（GiBあたり）」 と 「ストレージ保管量（30日超の長期保管など）」 に応じて従量課金が発生します。
      不要なデバッグログなどを大量に出力し続けるとコストが膨らむため、適切なログレベルの調整や除外フィルタの活用が大切です。

### node.jsの場合

- `console.log`、`console.error`、`console.warn`、`console.debug`を利用する。

```
# ログ
console.log("start");

# ログ（詳細指定）
console.log(JSON.stringify({
  severity: "WARNING",
  message: "非推奨のAPIが呼び出されました",
  endpoint: "/v1/old-users"
}));

# 出力例
{
  "textPayload": "start",
  "severity": "DEFAULT",
  "timestamp": "2026-10-18T01:23:45.123456Z",
  "resource": {
    "type": "cloud_run_revision",
    "labels": {
      "service_name": "your-node-service",
      ...
    }
  }
  // その他のGCPメタデータ（インフラ情報など）
}
```
