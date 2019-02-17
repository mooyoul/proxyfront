import { CloudFrontHeaders, CloudFrontRequest, CloudFrontResultResponse } from "aws-lambda";
import * as qs from "querystring";

export interface ResponseHeader {
  [key: string]: string | string[];
}

export interface Response {
  statusCode: number | string;
  statusText?: string;
  headers?: ResponseHeader;
  body: any;
}

export abstract class Context {
  public abstract request: CloudFrontRequest;

  private cachedQuery: Map<string, string | string[]>;

  // lazily parse query parameters
  public get query() {
    if (!this.cachedQuery) {
      const parsed = qs.parse(this.request.querystring);

      this.cachedQuery = new Map<string, string[]>(
        Object.keys(parsed).map((k) => [k, parsed[k]] as [string, string[]])
      );
    }

    return this.cachedQuery;
  }

  public json(status: number | string, body: any, headers: ResponseHeader = {}) {
    return this.reply({
      statusCode: status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  }

  public html(status: number | string, body: string, headers: ResponseHeader = {}) {
    return this.reply({
      statusCode: status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...headers,
      },
      body,
    });
  }

  public abstract reply(response: Response): CloudFrontResultResponse;

  protected transformHeaders(header: ResponseHeader): CloudFrontHeaders {
    return Object.keys(header).reduce((hash, k) => {
      const values = (Array.isArray(header[k]) ? header[k] : [header[k]]) as string[];

      hash[k.toLowerCase()] = values.map((v) => ({
        key: k,
        value: v,
      }));

      return hash;
    }, {} as CloudFrontHeaders);
  }
}
