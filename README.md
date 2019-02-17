# proxyfront
Turn CloudFront as dynamic forward proxy server

## Why?

Sometimes you may want to proxy remote resources, which are not owned by you.

For example, Let's suppose that you want to embed "open graph image" on your website.
but sadly, the server which is hosting given open graph image is small-sized 
which means sending requests from your website can be potential DoS attack.

also, Remote can block 'Hot Linking'. in this case, you must proxy the resource to display image.  

You can implement your own proxy server by using Lambda with API Gateway. 
but this method has a critical limitation: Response size limit.

In Lambda, you can send response up to 6MB. 
but, Response body should be encoded with base64 if you are sending binary data. 
In theory, base64 has additional storage overhead so you can send response up to 4.5MB if you are sending binary data.
Also, Using Lambda with API Gateway does not support response streaming, which should cause slower First-byte latency.

But now, We can use Lambda@Edge with CloudFront. We can modify origin dynamically!
since Lambda@Edge does not handle response directly, we can eliminate response size issue! With Lambda@Edge, we can send response up to 20GByte.

For another example, You should use HTTPS protocol to resources if you are running your website on HTTPS.
(For further details, Please refer [Google Developers - Mixed Content](https://developers.google.com/web/fundamentals/security/prevent-mixed-content/what-is-mixed-content))
but if remote does not support HTTPS, you should proxy the resource to secure resource transfer.

Also, ProxyFront can act as 'Forward Proxy' server!

## Examples

- Proxying remote resource: https://proxy.aws.debug.so/https://i.ytimg.com/vi/IWJUPY-2EIM/hqdefault.jpg
- Securing insecure remote resource: https://proxy.aws.debug.so/http://b.vimeocdn.com/ts/345/113/345113661_640.jpg
- Checking origin connectivity: https://proxy.aws.debug.so/http://not-exists-subdomain.debug.so
- Checking origin TLS handshake: https://proxy.aws.debug.so/https://debug.so

### Screenshots

#### Customized Error Pages

![Customized Error Pages](/assets/error.png)


## Features

- Dynamic Origin Selection using Request URL
  - Check origin connectivity to prevent slow first-byte response
  - Check SSL related issues to prevent CloudFront failure
- Built-in CORS support
- Cloudflare-like customized error page
- Whitelisting Origin
- Forward Proxy Server

### Two proxy modes

- Static remote resource proxy server
  - Only OPTIONS, HEAD, GET methods are allowed
  - Remote resource will be cached to edge by default  
- Forward proxy server
  - All CloudFront supported HTTP methods are allowed (OPTIONS, HEAD, GET, POST, PUT, DELETE, PATCH)
  - All responses won't be cached to edge by default

## Getting Started

Deployment is super easy. ProxyFront provides CLI configurator!

```bash
$ git clone https://github.com/mooyoul/proxyfront.git
$ cd proxyfront
$ npm i
$ npm run configure # Configure required resources like Custom Domain, Route 53 Record...
$ vi src/config.ts # Configure advanced configuration
$ npm run deploy:prod # or npm run deploy:stage
```

That's it! Deployment will take up to 1 hours.

## Configuration

## Debugging

## License
[MIT](LICENSE)
See full license on [mooyoul.mit-license.org](http://mooyoul.mit-license.org/) 
