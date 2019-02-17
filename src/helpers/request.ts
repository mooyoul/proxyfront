import { CloudFrontHeaders, CloudFrontRequest, CloudFrontRequestEvent, CloudFrontResultResponse } from "aws-lambda";
import * as status from "statuses";
import { URL } from "url";

import { Config } from "../config";
import { Context, Response } from "./context";

const DEFAULT_PORT = new Map<"http:" | "https:", number>([
  ["http:", 80],
  ["https:", 443],
]);

// tslint:disable-next-line
const READONLY_HEADER_NAMES = new Map<string, true>([
  "accept-encoding",
  "content-length",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "if-unmodified-since",
  "range",
  "transfer-encoding",
  "via"
].map((k) => [k, true] as [typeof k, true]));

const BLACKLISTED_HEADER_NAMES = new Map<string, true>([
].map((k) => [k, true] as [typeof k, true]));

export class RequestContext extends Context {
  public readonly request: CloudFrontRequest;

  constructor(event: CloudFrontRequestEvent) {
    super();

    const { request } = event.Records[0].cf;

    this.request = request;
  }

  public reply(response: Response): CloudFrontResultResponse {
    return {
      status: response.statusCode.toString(),
      statusDescription: response.statusText || status[response.statusCode] as string,
      headers: this.transformHeaders(response.headers || {}),
      body: response.body,
    };
  }

  public proxy(remote: URL): CloudFrontRequest {
    const headers = Object.keys(this.request.headers)
      .reduce((hash, k) => {
        if (READONLY_HEADER_NAMES.has(k) || !BLACKLISTED_HEADER_NAMES.has(k)) {
          // this is non-removable, non-modifiable field.
          hash[k] = this.request.headers[k];
        }

        return hash;
      }, {} as CloudFrontHeaders);

    if (Config.origin.userAgent) {
      headers["user-agent"] = [{ key: "User-Agent", value: Config.origin.userAgent }];
    }

    headers.host = [{ key: "Host", value: remote.hostname }];

    return {
      ...this.request,
      uri: remote.pathname,
      headers,
      origin: {
        custom: {
          domainName: remote.hostname,
          port: parseInt(remote.port, 10) || DEFAULT_PORT.get(remote.protocol as "http:" | "https:")!,
          protocol: remote.protocol.slice(0, -1) as "http" | "https",
          path: "",
          sslProtocols: ["SSLv3", "TLSv1", "TLSv1.1", "TLSv1.2"],
          readTimeout: Config.origin.readTimeout,
          keepaliveTimeout: Config.origin.keepAliveTimeout,
          customHeaders: {},
        },
      },
    };
  }
}
