import { URL } from "url";

export class HandledError extends Error {
  public status: number;
  public reason?: string;
  public underlyingError?: Error;
  public origin?: URL;

  constructor(status: number, metadata: {
    message: string;
    reason?: string;
    underlyingError?: Error;
    origin?: URL;
  }) {
    super(metadata.message);
    this.status = status;
    this.reason = metadata.reason;
    this.underlyingError = metadata.underlyingError;
    this.origin = metadata.origin;
  }
}
