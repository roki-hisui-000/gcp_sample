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

## セキュリティ







## ネットワーク






## ログ