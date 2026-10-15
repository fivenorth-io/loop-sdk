import type { Cip103MethodMap } from './types';
import { Cip103ProviderRpcError } from './errors';

const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

type Check = (value: unknown) => boolean;
const string: Check = value => typeof value === 'string';
const strings: Check = value => Array.isArray(value) && value.every(string);

function object(value: unknown, required: Record<string, Check>, optional: Record<string, Check> = {}): boolean {
  if (!isRecord(value) || Object.keys(required).some(key => !own(value, key))) return false;
  return Object.keys(value).every(key => {
    const check = own(required, key) ? required[key] : own(optional, key) ? optional[key] : undefined;
    return !!check && check(value[key]);
  });
}

const commandTypes = new Set(['CreateCommand', 'ExerciseCommand', 'CreateAndExerciseCommand', 'ExerciseByKeyCommand']);
const commands: Check = value => Array.isArray(value) && value.length > 0 && value.every(command => {
  if (!isRecord(command)) return false;
  const keys = Object.keys(command);
  return keys.length === 1 && commandTypes.has(keys[0]!) && isRecord(command[keys[0]!]);
});
const disclosedContracts: Check = value => Array.isArray(value) && value.every(contract =>
  object(contract, { createdEventBlob: string }, { templateId: string, contractId: string, synchronizerId: string }));
const transaction: Check = value => object(value, { commands }, {
  commandId: string, actAs: strings, readAs: strings, disclosedContracts,
  synchronizerId: string, packageIdSelectionPreference: strings,
});

const validators: { [M in keyof Cip103MethodMap]: Check | undefined } = {
  connect: undefined,
  disconnect: undefined,
  isConnected: undefined,
  status: undefined,
  getActiveNetwork: undefined,
  listAccounts: undefined,
  getPrimaryAccount: undefined,
  signMessage: value => object(value, { message: string }),
  prepareExecute: transaction,
  prepareExecuteAndWait: transaction,
  ledgerApi: value => object(value, {
    requestMethod: method => typeof method === 'string' && ['get', 'post', 'patch', 'put', 'delete'].includes(method),
    resource: string,
  }, { body: isRecord, query: isRecord, path: isRecord }),
};

export function isCip103Method(method: string): method is keyof Cip103MethodMap {
  return own(validators, method);
}

export function validateParams(method: keyof Cip103MethodMap, params: unknown): unknown {
  const check = validators[method];
  const fail = () => { throw new Cip103ProviderRpcError(-32602, `Invalid parameters for ${method}`); };
  if (!check) {
    if (params === undefined || (Array.isArray(params) && params.length === 0) || (isRecord(params) && Object.keys(params).length === 0)) return undefined;
    return fail();
  }

  let value = params;
  if (Array.isArray(params)) {
    if (params.length !== 1) return fail();
    value = params[0];
  } else if (isRecord(params) && own(params, 'params') && Object.keys(params).length === 1) {
    value = params.params;
  }
  if (!check(value)) return fail();
  return value;
}
