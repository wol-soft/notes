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
