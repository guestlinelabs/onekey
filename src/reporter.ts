import { Context, getFunctionName, ValidationError } from 'io-ts';

function stringify(v: any): string {
  if (typeof v === 'function') {
    return getFunctionName(v);
  }
  if (typeof v === 'number' && !isFinite(v)) {
    if (isNaN(v)) {
      return 'NaN';
    }
    return v > 0 ? 'Infinity' : '-Infinity';
  }
  return JSON.stringify(v);
}

function getContextPath(context: Context): string {
  return context.map(({ key, type }) => `${key}: ${type.name}`).join('/');
}

function getMessage(e: ValidationError): string {
  return e.message !== undefined
    ? e.message
    : `Invalid value ${stringify(e.value)} supplied to ${getContextPath(
        e.context
      )}`;
}

function failure(es: Array<ValidationError>): Array<string> {
  return es.map(getMessage);
}

export function report(errors: Array<ValidationError>) {
  return failure(errors);
}
