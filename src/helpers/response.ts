import {
  CloudFrontHeaders,
  CloudFrontRequest,
  CloudFrontResponse,
  CloudFrontResponseEvent,
  CloudFrontResultResponse,
} from "aws-lambda";

import * as status from "statuses";

import { Context, Response } from "./context";

export type ResponseEventType = "origin-response" | "viewer-response";

const READONLY_HEADER_NAMES = new Map<ResponseEventType, string[]>([
  ["origin-response", ["via", "transfer-encoding"]],
  ["viewer-response", ["content-encoding", "content-length", "transfer-encoding", "warning", "via"]],
]);

export class ResponseContext extends Context {
  public readonly type: "origin-response" | "viewer-response";
  public readonly request: CloudFrontRequest;
  public readonly response: CloudFrontResponse;

  private readonly READONLY_HEADERS = READONLY_HEADER_NAMES.get(this.type)!;

  constructor(event: CloudFrontResponseEvent) {
    super();

    const { config, request, response } = event.Records[0].cf;

    this.type = config.eventType as "origin-response" | "viewer-response";
    this.request = request;
    this.response = response;
  }

  public reply(response: Response): CloudFrontResultResponse {
    // @note there exists some reserved headers, so we need to copy them
    // tslint:disable-next-line
    // @see https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-requirements-limits.html#lambda-read-only-headers-origin-response-events
    const readonlyHeaders = this.READONLY_HEADERS
      .reduce((hash, k) => {
        const hasField = Object.prototype.hasOwnProperty.call(this.response.headers, k);

        if (hasField) {
          hash[k] = this.response.headers[k];
        }

        return hash;
      }, {} as CloudFrontHeaders);

    return {
      ...this.response,
      status: response.statusCode.toString(),
      statusDescription: response.statusText || status[response.statusCode] as string,
      headers: {
        ...(this.transformHeaders(response.headers || {})),
        ...readonlyHeaders,
      },
      body: response.body,
    };
  }

  public passthrough(additionalHeaders?: { [key: string]: string }) {
    const merged = {
      ...this.response.headers,
      ...(additionalHeaders ? this.transformHeaders(additionalHeaders) : {}),
    };

    const headers = Object.keys(merged)
      .reduce((hash, k) => {
        if (k.toLowerCase() !== "cache-control") {
          hash[k] = merged[k];
        }

        return hash;
      }, {} as CloudFrontHeaders);

    return {
      ...this.response,
      headers,
    };
  }
}
