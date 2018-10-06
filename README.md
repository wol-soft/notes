# notes

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

## CLI Commands

Count lines:

```CLI
find . -name '*.php' | xargs wc -l
```

Renew certificate with certbot:

```CLI
sudo certbot run -a webroot -i apache -w /dir/to/htdocs/
```
