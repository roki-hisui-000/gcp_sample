# Redis API

## 1. 接続・基本操作（Generic）

| 関数名 / コマンド | 説明 | 例 |
| --- | --- | --- |
| client.set(key, value) | キーと値を保存する | await client.set('mykey', 'hello') |
| client.get(key) | キーを指定して値を取得する | const val = await client.get('mykey') |
| client.del(key) | キーを削除する | await client.del('mykey') |
| client.exists(key) | キーが存在するか確認する（1:存在 / 0:不在） | await client.exists('mykey') |
| client.expire(key, seconds) | キーに有効期限（秒）を設定する | await client.expire('mykey', 60) |
| client.ttl(key) | キーの残り有効期限を取得する | await client.ttl('mykey') |
| client.keys(pattern) | パターンに一致するキーの一覧を取得する | await client.keys('user:*') |

## 2. String型（文字列・数値）

| 関数名 / コマンド | 説明 | 例 |
| --- | --- | --- |
| client.mget(keys...) | 複数のキーの値を一度に取得する | await client.mget(['k1', 'k2']) |
| client.incr(key) | 値を1増やす（カウンター用途） | await client.incr('counter') |
| client.decr(key) | 値を1減らす | await client.decr('counter') |

## 3. Hash型（オブジェクト形式のデータ）

| 関数名 / コマンド | 説明 | 例 |
| --- | --- | --- |
| client.hset(key, field, value) | ハッシュのフィールドに値を設定する | await client.hset('user:1', 'name', 'Taro') |
| client.hget(key, field) | ハッシュの特定フィールドの値を取得する | await client.hget('user:1', 'name') |
| client.hgetall(key) | ハッシュの全フィールドと値オブジェクトを取得する | await client.hgetall('user:1') |
| client.hdel(key, field) | ハッシュのフィールドを削除する | await client.hdel('user:1', 'name') |

## 4. List型（配列・キュー）

| 関数名 / コマンド | 説明 | 例 |
| --- | --- | --- |
| client.lpush(key, values...) | リストの先頭（左）に追加する | await client.lpush('queue', 'task1') |
| client.rpush(key, values...) | リストの末尾（右）に追加する | await client.rpush('queue', 'task2') |
| client.lpop(key) | リストの先頭から要素を取り出して削除する | await client.lpop('queue') |
| client.rpop(key) | リストの末尾から要素を取り出して削除する | await client.rpop('queue') |
| client.lrange(key, start, stop) | 指定範囲の要素を取得する | await client.lrange('queue', 0, -1) |

## 5. Set型（重複なしの集合）

| 関数名 / コマンド | 説明 | 例 |
| --- | --- | --- |
| client.sadd(key, members...) | 集合に要素を追加する（重複は無視） | await client.sadd('tags', 'node') |
| client.smembers(key) | 集合内のすべての要素を取得する | await client.smembers('tags') |
| client.srem(key, members...) | 集合から要素を削除する | await client.srem('tags', 'node') |
| client.sismember(key, member) | 指定した要素が集合に含まれるか確認する | await client.sismember('tags', 'node') |

## 6. Sorted Set型（スコア付きランキングなど）

| 関数名 / コマンド | 説明 | 例 |
| --- | --- | --- |
| client.zadd(key, score, member) | スコアつきで要素を追加する | await client.zadd('ranking', 100, 'Taro') |
| client.zrange(key, start, stop) | スコア順に要素を取得する | await client.zrange('ranking', 0, 10) |

