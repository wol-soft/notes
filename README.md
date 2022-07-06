# notes

## CLI Commands

Tail with new lines:

```CLI
tail -f myFile | sed 's/\\n/\n/g'
```

Strace Apache:

```CLI
ps auxw | grep sbin/apache | awk '{print"-p " $2}' | xargs strace
```

---

Count lines:

```CLI
find . -name '*.php' | xargs wc -l
```

---

Source code counter, simply extend the ext list to add additional file extensions. Returns something like:

Extension | File counter | LOC counter
--- | --- | ---
js | 168 | 57919
php | 329 | 40143
json | 30 | 8254
yml | 0 | 0
twig | 175 | 8227
svg | 175 | 41023
scss | 37 | 2923
html | 1 | 32

```CLI
for ext in js php json yml twig svg scss html; do echo "$(printf '%-10s' "$ext")$(printf '%-10s' "$(find . -type f -name "*.$ext" | wc -l)")$(find . -type f -name "*.$ext" | xargs wc -l | tail -n1 | awk '{print $1}')"; done
```

---

Renew certificate with certbot:

```CLI
sudo certbot run -a webroot -i apache -w /dir/to/htdocs/ -d www.my-domain.de
```

---

Update MediaWiki:

```CLI
Backup DB
Backup Directory

git fetch -p
git branch -a | grep REL
git checkout REL1_35
git submodule update --init
cd extensions/VisualEditor && git submodule update --init
```

---

XHProf Setup:

```CLI
# Tideways extension installieren
git clone "https://github.com/tideways/php-xhprof-extension.git"
cd php-xhprof-extension
phpize
./configure
make
make install

# UI installieren
https://github.com/preinheimer/xhprof
```

---

PHP SRC Dev:

```CLI
sudo apt install -y build-essential autoconf bison re2c libxml2-dev libsqlite3-dev
./buildconf
./configure --enable-debug
make -j4

# Executable @ sapi/cli/php

make test
```

---

Database cloning via CRON:

```CLI
mysqldump -uUSER_PRIMARY_READONLY -pPASSWORD_PRIMARY DB_PRIMARY > dump.sql && sed -i '/DEFINER=/d' dump.sql && mysql -uUSER_COPY -pPASSWORD_COPY DB_COPY < dump.sql && rm dump.sql
```

#### Monitoring

TOP

```CLI
atop
apachetop
iotop --only
```

---

DISK

```CLI
df -h
lsblk
discus
```

#### Network

```CLI
speedtest-cli
```

---

Port Bindings

```CLI
lsof -Pnl +M -i4
```

---

#### Git commands

Delete all local branches except the currently active branch:

```CLI
git branch | grep -v "*" | xargs git branch -D
```

Rewrite the git history to not contain a file/folder:

```CLI
git filter-branch --tree-filter "rm -rf myFile.txt" --prune-empty HEAD
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d
git gc
git push origin master --force
```
