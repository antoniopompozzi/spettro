/**
 * A failure whose message is written for the person who pasted the link, and
 * which carries the status the API route should answer with. Anything thrown
 * that is not one of these is a bug and gets a generic 500.
 */
export class OrderError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}
