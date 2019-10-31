# notes

## CLI Commands

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

## Loadimpact

Log something from within a string longer than 1024 bytes:

```Lua
local s = response[1].body
local position = string.find(s, "csrf%-token")
if position == nil then
log.info("Failed to find string: csrf-token")
else
log.info(string.sub(s, position))
end

-- note the % to escape the Lua magic character "-"
```

Table to string:

```Lua
function table_to_string(tbl)
    local result = "{"
    for k, v in pairs(tbl) do
        -- Check the key type (ignore any numerical keys - assume its an array)
        if type(k) == "string" then
            result = result.."[\""..k.."\"]".."="
        end

        -- Check the value type
        if type(v) == "table" then
            result = result..table_to_string(v)
        elseif type(v) == "boolean" then
            result = result..tostring(v)
        else
            result = result.."\""..v.."\""
        end
        result = result..","
    end
    -- Remove leading commas from the result
    if result ~= "" then
        result = result:sub(1, result:len()-1)
    end
    return result.."}"
end
```
