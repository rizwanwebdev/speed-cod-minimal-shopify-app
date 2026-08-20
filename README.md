### Simple Shopify COD App ( Cash on devlivery app )
This is fronend only replace the client_id and push to shopify with
`shopify app deploy`
Then In theme customize under product page add this in


```graphQL
query GetAppNamespace {
      product(id: "gid://shopify/Product/8180639531097") {
        metafields(first: 1, namespace: "$app") {
          edges {
            node {
              namespace
            }
          }
        }
      }
    }
```

use the above query in graphQL editor to get the app id and replace in `/block/popup.liquid` here 

```JavaScript
{% assign app_ns = 'app--408590942209' %}
```


how to exchange access token

```
https://{shop}.com/admin/oauth/authorize
  ?client_id=YOUR_API_KEY
  &redirect_uri=https://example-redirect.com/api/auth
```


then exchange the code

```js
`https://{shop}.myshopify.com/admin/oauth/access_token`

// header Content-Type: application/json

// Body JSON

{
  "client_id": "YOUR_API_KEY",
  "client_secret": "YOUR_API_SECRET_KEY",
  "code": "THE_CODE_FROM_QUERY_STRING"
}
```