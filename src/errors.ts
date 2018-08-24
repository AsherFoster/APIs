export class Errors {
  public static readonly ObjectNotFound = {
    code: 'ObjectNotFound',
    message: 'Object not found'
  };
  /** @deprecated since version 2 */
  public static readonly RedirectNotFound = Errors.ObjectNotFound;
  public static readonly MethodNotFound = {
    code: 'MethodNotFound',
    message: 'Method not found'
  };
  public static readonly InternalError = {
    code: 'InternalError',
    message: 'The application encountered an internal error'
  };
  public static readonly InvalidParam = {
    code: 'InvalidParam',
    message: 'An invalid parameter was provided'
  };
  public static readonly BadData = {
    code: 'BadData',
    message: 'Failed to process some of the provided data'
  };
  public static readonly IdConflict = {
    code: 'IdConflict',
    message: 'That ID is already in use'
  };
  public static readonly NotImplemented = {
    code: 'NotImplemented',
    message: 'This method is not implemented yet'
  };
  public static readonly AuthorizationFailed = {
    code: 'AuthorizationFailed',
    message: 'Failed to authorize you'
  };
}

export interface ErrorResponse {
  success: boolean; // Always false, but typescript doesn't like that.
  error: Error;
}
export interface Error {
  code: string;
  message: string;
  id?: string;
}

export function error(code: keyof typeof Errors, messageOverride?: string, sentryId?: string): ErrorResponse {
  const resp = {
    error: ((Errors as any)[code] || Errors.InternalError) as Error,
    success: false,
  };
  if (messageOverride) {
    resp.error.message = messageOverride;
  }
  if (sentryId) {
    resp.error.id = sentryId;
  }
  return resp;
}
