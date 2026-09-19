# デプロイ手順

APIの有効化が正常に完了したとのこと、素晴らしいです！これでGCPデプロイの土台が整いました。

ローカルの資材（Dockerイメージやソースコード）を **GCPの Cloud Run にデプロイして、サーバーを公開・起動する手順** を詳しく解説します。

Cloud Run へのデプロイには、大きく分けて **2つのアプローチ** があります。最も簡単で推奨されるのは **「方法①」** ですが、仕組みをしっかり管理したい場合は **「方法②」** も利用されます。

---

## 🚀 Cloud Run へのデプロイ手順（2つの方法）

### 方法①：GCP側で自動ビルドしてデプロイする（最も簡単・超推奨）

この方法は、ローカルでビルドした重いDockerイメージをアップロードするのではなく、**ソースコードだけをGCPに送信し、GCP上のビルド機能（Cloud Build）で高速・安全にコンテナを組み立てて自動デプロイする方法**です。

ローカルにDockerが立ち上がっていなくても、回線が細くても、**コマンド1発**で終わります。

#### 実行手順
プロジェクトのルートディレクトリで、以下のコマンドを実行します。

```bash
gcloud run deploy gcp-sample-app \
    --source . \
    --region asia-northeast1 \
    --allow-unauthenticated
```

#### コマンドの裏側で行われること：
1. ソースコード（Dockerfile等）がGCP（Cloud Build）に送信されます。
2. GCP側で自動的に Dockerイメージがビルドされます。
3. ビルドされたイメージが Artifact Registry に自動で安全に保管されます。
4. そのイメージを使って Cloud Run サービスが即座に起動・デプロイされます。

コマンドの最後に **`Service [gcp-sample-app] revision [...] has been deployed and is serving 100% of traffic.`** と表示され、一緒に発行された **HTTPSの公開URL**（例: `https://gcp-sample-app-xxxxx-an.a.run.app`）がターミナルに表示されます。ブラウザでそのURLを開くだけで、世界中に公開されたアプリが起動します。

---

### 方法②：ローカルで作成したDockerイメージをそのままアップロードしてデプロイする

「ローカルで手動ビルドしたイメージをGCPにアップロードして起動したい」という場合は、以下の5ステップを踏みます。

#### ステップ1. Artifact Registry にリポジトリを作成する (未作成の場合)
東京リージョンに、Dockerコンテナ保管庫を作成します。
```bash
gcloud artifacts repositories create gcp-sample-repo \
    --repository-format=docker \
    --location=asia-northeast1 \
    --description="GCP sample repository"
```

#### ステップ2. ローカルの Docker 認証を通す
ローカルの `docker` コマンドが、GCPの Artifact Registry にイメージをアップロード（push）できるように認証を紐付けます。
```bash
gcloud auth configure-docker asia-northeast1-docker.pkg.dev
```
*(※「Do you want to continue (Y/n)?」と聞かれたら `y` を押して進めます)*

#### ステップ3. ローカルのDockerイメージにGCP用の「タグ」を付ける
GCPのリポジトリへアップロードするためには、特定の形式でタグ（名前）を付ける必要があります。
```bash
docker tag gcp_sample-app:latest asia-northeast1-docker.pkg.dev/[あなたのプロジェクトID]/gcp-sample-repo/web-app:latest
```
* ※ `[あなたのプロジェクトID]` の部分を、先ほど設定したご自身のIDに置き換えてください。

#### ステップ4. イメージをGCPへアップロード（push）する
```bash
docker push asia-northeast1-docker.pkg.dev/[あなたのプロジェクトID]/gcp-sample-repo/web-app:latest
```

#### ステップ5. アップロードしたイメージを指定して Cloud Run にデプロイする
```bash
gcloud run deploy gcp-sample-app \
    --image asia-northeast1-docker.pkg.dev/[あなたのプロジェクトID]/gcp-sample-repo/web-app:latest \
    --region asia-northeast1 \
    --allow-unauthenticated
```

---

## 💡 どちらの方法が良い？

* **方法①（`--source .`）**:
  とにかくシンプル。ステップが非常に少なく、ミスが起きにくいので**一番おすすめ**です。GCP公式も、開発・デプロイの第一選択としてこの方法を推奨しています。
* **方法②（`docker push`）**:
  「ローカルで完全にテストが終わった『そのもの（バイナリ）』を寸分違わず本番に持って行きたい」という、厳密なリリース運用をしたい場合に使われます。

まずは、最も手軽で間違いのない **「方法①」** でのデプロイを試してみることを強くおすすめします！

---

## 📅 今後の進め方

1. **`docker-compose.yml` の警告解消**:
   デプロイを試す前に、前回保留にしていた `docker-compose.yml` の不要な警告（`version: '3.8'` 行）の削除を行っておきたいです。
2. **Cloud Run デプロイの実行**:
   準備ができたら、上記の「方法①」または「方法②」のコマンドを実行してデプロイを行います。

これらを実行するため、**「Act（実行）モード」に切り替えていただくことは可能でしょうか？**
切り替え後、まずは `docker-compose.yml` の警告の修正を私の方で完了させ、その後実際のデプロイコマンドに進んでいきましょう！
