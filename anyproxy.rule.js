'use strict';

const DISALLOWED_REQUEST_HEADERS = [
  'host', 'cookie', 'proxy-connection', 'referer',
].reduce((hash, v) => {
  hash[v] = true;
  return hash;
}, {});

if (!process.env.PROXYFRONT_HOST) {
  throw new Error("`PROXYFRONT_HOST` was not found in environment variable.");
}

module.exports = {
  *beforeSendRequest(requestDetail) {
    const { requestOptions } = requestDetail;
    const requestedUrl = requestDetail.url;
    const safeHeaders = Object.keys(requestOptions.headers).reduce((hash, k) => {
      if (!DISALLOWED_REQUEST_HEADERS[k.toLowerCase()]) {
        hash[k] = requestOptions.headers[k];
      }

      return hash;
    }, {});

    requestOptions.hostname = 'proxy.aws.debug.so';
    requestOptions.port = 443;
    requestOptions.path = `/${requestedUrl}`;
    requestOptions.headers = {
      ...safeHeaders,
      Host: process.env.PROXYFRONT_HOST,
    };

    return {
      protocol: 'https',
      requestOptions,
    };
  },
  *beforeDealHttpsRequest(requestDetail) {
    return true;
  }
};
