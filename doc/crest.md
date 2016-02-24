Refresh tokens:
* Visit in a browser `https://login.eveonline.com/oauth/authorize/?response_type=code&redirect_uri=http://localhost:5000/&scope=publicData&client_id=OAUTH_CLIENT_ID`
* Note the redirected url `http://localhost:5000/?code=REDACTED_CODE`
* Run from your cmdline `curl -i -u OAUTH_CLIENT_ID:OAUTH_CLIENT_SECRET  -F grant_type=authorization_code -F code=REDACTED_CODE https://login.eveonline.com/oauth/token`

```json
{
        "access_token":"REDACTED_ACCESS_TOKEN",
        "token_type": "Bearer",
        "expires_in":1200,
        "refresh_token":"REDACTED_REFRESH_TOKEN"
}
```

https://eveonline-third-party-documentation.readthedocs.org/en/latest/sso/refreshtokens/

* `curl -i -u OAUTH_CLIENT_ID:OAUTH_CLIENT_SECRET -F grant_type=refresh_token -F refresh_token=USERS_REFRESH_TOKEN https://login.eveonline.com/oauth/token` 
* `curl -i -H "Authorization: Bearer REDACTED_ACCESS_TOKEN"  https://crest-tq.eveonline.com/`

Example URLs:
* `https://crest-tq.eveonline.com/market/10000002/orders/buy/?type=https://crest-tq.eveonline.com/types/683/`
