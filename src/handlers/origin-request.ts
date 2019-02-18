import * as net from "net";
import * as tls from "tls";
import { URL } from "url";

import {
  CloudFrontRequest,
  CloudFrontRequestEvent,
  CloudFrontResultResponse,
} from "aws-lambda";

import { Config } from "../config";
import { HandledError } from "../helpers/handled-error";
import { RequestContext } from "../helpers/request";
import { render as renderErrorPage } from "../views/error";

export async function handler(event: CloudFrontRequestEvent): Promise<CloudFrontRequest | CloudFrontResultResponse> {
  const context = new RequestContext(event);

  try {
    if (context.request.method.toUpperCase() === "OPTIONS") {
      const origin = context.request.headers.origin && context.request.headers.origin.length > 0 ?
        context.request.headers.origin[0].value :
        "";

      await checkCORSOrigin(origin, Config.cors ? Config.cors.whitelist : []);

      return context.reply({
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, HEAD",
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Max-Age": `${Config.cors && Config.cors.maxAge || 300}`,
        },
        body: "",
      });
    }

    const remote = extractUrl(context);

    await checkOriginHostname(remote.hostname, Config.origin.whitelist);

    if (Config.debug && context.query.has("PROXYFRONT_SIMULATE_ORIGIN_REQUEST")) {
      return context.json(200, {
        event,
        request: context.proxy(remote),
      },  {
        "Cache-Control": "public, no-cache",
      });
    }

    if (Config.origin.checkConnectivity) {
      await checkOriginConnectivity(remote, 5000);
    }

    return context.proxy(remote);
  } catch (e) {
    console.error(e.stack); // tslint:disable-line

    if (e instanceof HandledError) {
      return context.html(e.status, await renderErrorPage({
        requestIp: context.request.clientIp,
        status: {
          code: e.status,
          description: e.message,
        },
        reason: e.reason,
        origin: e.origin,
      }), {
        "Cache-Control": "public, no-cache",
      });
    } else {
      return context.html(400, await renderErrorPage({
        requestIp: context.request.clientIp,
        status: {
          code: 500,
          description: `Failed to process request`,
        },
        reason: e.message,
      }), {
        "Cache-Control": "public, no-cache",
      });
    }
  }
}

function extractUrl(context: RequestContext): URL {
  const candidates = [
    context.request.uri,
    context.request.uri.slice(1),
  ];

  const matched = candidates.find((candidate) => /^https?:/.test(candidate));

  if (!matched) {
    throw new HandledError(400, {
      message: "Invalid URL" ,
      reason: "URL input is missing, or invalid. Check your URL and try again.",
    });
  }

  try {
    let built = matched;
    if (context.query.size > 0) {
      built += `?${context.request.querystring}`;
    }

    return new URL(built);
  } catch (e) {
    throw new HandledError(400, {
      message: "Malformed URL",
      reason: "URL input is malformed. Check your URL format and try again.",
      underlyingError: e,
    });
  }
}

async function isWhitelisted(
  value: string,
  matchers: Array<RegExp | string | ((value: string) => Promise<boolean>)>,
): Promise<boolean> {
  for (const matcher of matchers) {
    if (typeof matcher === "string") {
      if (value === matcher) {
        return true;
      }
    } else if (matcher instanceof RegExp) {
      matcher.lastIndex = 0;
      if (matcher.test(value)) {
        return true;
      }
    } else {
      if (await matcher(value)) {
        return true;
      }
    }
  }

  return false;
}

export async function checkOriginHostname(
  hostname: string,
  whitelist?: Array<RegExp | string | ((hostname: string) => Promise<boolean>)>,
): Promise<void> {
  if (!whitelist || whitelist.length === 0) {
    return;
  }

  const isAllowed = await isWhitelisted(hostname, whitelist);
  if (!isAllowed) {
    throw new HandledError(403, {
      message: "Forbidden",
      reason: `Access Denied. The requested origin \`${hostname}\` is not allowed.`,
    });
  }
}

async function checkCORSOrigin(
  origin?: string,
  whitelist: Array<RegExp | string | ((origin: string) => Promise<boolean>)> = [],
): Promise<void> {
  if (!origin) {
    throw new HandledError(400, {
      message: "Bad Request",
      reason: "Origin header was not found on request",
    });
  }

  const isAllowed = await isWhitelisted(origin, whitelist);
  if (!isAllowed) {
    throw new HandledError(403, {
      message: "Forbidden",
      reason: `Access Denied. The requested origin \`${origin}\` is not allowed.`,
    });
  }
}

function checkOriginConnectivity(remoteUrl: URL, connectionTimeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const socket = remoteUrl.protocol === "http:" ?
      net.connect({
        host: remoteUrl.hostname,
        port: remoteUrl.port || 80,
      } as net.NetConnectOpts) :
      tls.connect({
        host: remoteUrl.hostname,
        port: remoteUrl.port || 443,
        servername: remoteUrl.hostname,
      } as tls.ConnectionOptions);

    const origin = remoteUrl;
    const CONNECT_EVENT = socket instanceof tls.TLSSocket ?
      "secureConnect" :
      "connect";

    socket.setTimeout(connectionTimeoutMs)
      .once("timeout", onTimeout)
      .once("error", onError)
      .once(CONNECT_EVENT, onConnect);

    function onConnect() {
      socket
        .removeListener("timeout", onTimeout)
        .removeListener("error", onError);

      if (socket instanceof tls.TLSSocket) {
        if (socket.authorizationError) {
          return reject(new HandledError(502, {
            message: "Bad Gateway",
            reason: socket.authorizationError.message,
            underlyingError: socket.authorizationError,
            origin,
          }));
        }

        if (!socket.authorized) {
          return reject(new HandledError(502, {
            message: "Bad Gateway",
            reason: "Unauthorized origin TLS connection detected.",
            origin,
          }));
        }
      }

      resolve();
    }

    function onTimeout() {
      socket
        .removeListener(CONNECT_EVENT, onConnect)
        .removeListener("error", onError);

      reject(new HandledError(502, {
        message: "Bad Gateway",
        reason: "Origin connection timeout",
        origin,
      }));
    }

    function onError(e: Error) {
      socket
        .removeListener("timeout", onTimeout)
        .removeListener(CONNECT_EVENT, onConnect);

      reject(new HandledError(502, {
        message: "Bad Gateway",
        reason: e.message,
        underlyingError: e,
        origin,
      }));
    }
  });
}
