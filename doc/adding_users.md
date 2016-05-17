```sql
with account as (
  insert into user_accounts default values returning id
)

insert into eve_sso select <EVE_CHAR_ID_HERE>, id from account;
```
