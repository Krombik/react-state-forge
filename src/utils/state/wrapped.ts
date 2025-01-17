import { AsyncState, LoadableState } from '../../types';

export function load(this: LoadableState, force?: boolean) {
  return this._root.load(force);
}

export function get(this: AsyncState) {
  return this._root.get();
}

export function set(this: AsyncState, value: any) {
  this._root.set(value);
}

export function _onValueChange(this: AsyncState, cb: (value: any) => void) {
  return this._root._onValueChange(cb);
}
