// tslint:disable:max-line-length
interface Config {
  // If enabled, reserved query parameters like PROXYFRONT_SIMULATE_ORIGIN_REQUEST will work.
  debug: boolean;

  // Origin related configurations
  origin: {
    // If enabled, ProxyFront will check origin connectivity before passing request to CloudFront.
    // It's recommended to enable this flag since Cloudfront does not provide detailed failure reason
    // and first-byte latency can be extremely high if connection issue occurs.
    checkConnectivity: boolean;

    // Origin Read Timeout
    // @see https://aws.amazon.com/about-aws/whats-new/2017/03/announcing-configure-read-timeout-and-keep-alive-timeout-values-for-your-amazon-cloudfront-custom-origins/
    // @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorCustomOrigin.html#request-custom-request-timeout
    readTimeout: number; // in seconds

    // Keep-Alive idle timeout
    // @see https://aws.amazon.com/about-aws/whats-new/2017/03/announcing-configure-read-timeout-and-keep-alive-timeout-values-for-your-amazon-cloudfront-custom-origins/
    // @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestAndResponseBehaviorCustomOrigin.html#request-custom-persistent-connections
    keepAliveTimeout: number; // in seconds

    // Origin Request User-Agent
    // if not specified, default user agent will be forwarded.
    // Default user agent will be:
    // Forward User-Agent header: Client's User-Agent
    // Not forward User-Agent header: Amazon CloudFront
    userAgent?: string;

    // Origin Whitelist
    // If you want to allow only specific origin, configure whitelist
    // 1. Specify allowed hostname
    // 2. Specify regexp that matches allowed hostname
    // 3. Specify custom async matcher function that returns boolean.
    whitelist?: Array<RegExp | string | ((hostname: string) => Promise<boolean>)>;
  };

  // CORS related configurations
  // If not specified, CORS middleware will be disabled.
  // For example:
  // 1) CORS pre-flight request won't be accepted
  // 2) Response won't include CORS related headers (e.g. `Access-Control-Allow-Origin`)
  cors?: {
    whitelist?: Array<RegExp | string | ((origin: string) => Promise<boolean>)>;
    maxAge?: string;
  };
}
// tslint:enable:max-line-length

// Below are default configuration. Feel free to edit!
// @todo Refactor to support better multi-stage deployment
export const Config: Config = {
  debug: true, // @todo change to false
  origin: {
    checkConnectivity: true,
    readTimeout: 15,
    keepAliveTimeout: 30,
    // tslint:disable-next-line
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36",
  },
};
