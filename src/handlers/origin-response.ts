import {
  CloudFrontResponseEvent,
  CloudFrontResultResponse,
} from "aws-lambda";

import * as status from "statuses";

import { Config } from "../config";
import { ResponseContext } from "../helpers/response";
import { render as renderErrorPage } from "../views/error";

export async function handler(event: CloudFrontResponseEvent): Promise<CloudFrontResultResponse> {
  const context = new ResponseContext(event);

  if (Config.debug && context.query.has("PROXYFRONT_SIMULATE_ORIGIN_RESPONSE")) {
    return context.json(200, {
      event,
      response: context.passthrough(),
    }, {
      "Cache-Control": "public, no-cache",
    });
  }

  const corsHeaders = (() => {
    const origin = context.request.headers.origin && context.request.headers.origin.length > 0 ?
      context.request.headers.origin[0].value :
      null;

    if (!origin) {
      return {};
    }

    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Max-Age": `${Config.cors && Config.cors.maxAge || 300}`,
    };
  })() as { [key: string]: string };

  const responseStatus = parseInt(context.response.status, 10);
  if (responseStatus >= 500) {
    return context.html(responseStatus, await renderErrorPage({
      requestIp: context.request.clientIp,
      status: {
        code: responseStatus,
        description: context.response.statusDescription || status[responseStatus]! || "Unknown Error",
      },
      origin: {
        hostname: context.request.origin!.custom!.domainName,
      },
    }), {
      "Cache-Control": "public, no-cache",
      ...corsHeaders,
    });
  }

  return context.passthrough(corsHeaders);
}
