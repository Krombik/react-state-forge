import noop from 'lodash.noop';
import type {
  AnyAsyncState,
  AsyncState,
  ErrorState,
  IsLoadedState,
  LoadableState,
  LoadableStateOptions,
  Mutable,
  PaginatedStorage,
  StateInitializer,
} from '../types';
import alwaysTrue from './alwaysTrue';
import { addToBatch } from './batching';
import executeSetters from './executeSetters';
import handleState from './handleState';
import { _onValueChange, get } from './state/common';

const handleReloadOn = (
  reloadData: NonNullable<AsyncState['_reloadIfStale']>,
  utils: { _isLoadable: boolean }
) => {
  clearTimeout(reloadData._timeoutId);

  reloadData._timeoutId = setTimeout(() => {
    utils._isLoadable = true;
  }, reloadData._timeout);
};

const handleUnload = (data: AsyncState) => {
  if (data._unload) {
    data._unload = data._unload();
  }
};

const handleSlowLoading = (
  slowLoading: AsyncState['_slowLoading'],
  isLoaded: boolean
) => {
  if (slowLoading) {
    clearTimeout(slowLoading._timeoutId);

    slowLoading._timeoutId = isLoaded
      ? undefined
      : setTimeout(() => {
          executeSetters(slowLoading._callbackSet);
        }, slowLoading._timeout);
  }
};

function set(
  this: AsyncState,
  value: any,
  path?: readonly string[],
  isError?: boolean
) {
  const self = this;

  const prevRootValue = self._value;

  self._commonSet(value, path);

  self._tickEnd();

  const newRootValue = self._value;

  const isSet = newRootValue !== undefined;

  const isLoaded = isSet
    ? self._isLoaded(newRootValue, prevRootValue, self._attempt)
    : isError || false;

  if (self._attempt != null) {
    if (isLoaded) {
      self._attempt = 0;
    } else {
      self._attempt++;
    }
  }

  self.isLoaded._set(isLoaded);

  if (isLoaded) {
    self._isLoadable = false;

    handleUnload(self);

    const { _reloadIfStale, _reloadOnFocus } = self;

    if (_reloadIfStale) {
      handleReloadOn(_reloadIfStale, self);
    }

    if (_reloadOnFocus) {
      handleReloadOn(_reloadOnFocus, _reloadOnFocus);
    }
  }

  if (!isError) {
    self.error.set(undefined);

    if (isSet && self._promise) {
      self._promise._resolve(newRootValue);

      self._promise = null;
    }
  }

  handleSlowLoading(self._slowLoading, isLoaded);
}

function load(this: LoadableState, reload?: boolean) {
  let isNotCanceled = true;

  const self = this;

  const { _reloadOnFocus } = self;

  if (reload && !self._isFetchInProgress) {
    handleUnload(self);

    self._isLoadable = true;
  }

  if (self._isLoadable) {
    self._isLoadable = false;

    self.isLoaded._set(false);

    handleSlowLoading(self._slowLoading, false);

    if (_reloadOnFocus && _reloadOnFocus._timeoutId != null) {
      clearInterval(_reloadOnFocus._timeoutId);

      _reloadOnFocus._timeoutId = undefined;
    }

    if (self._reloadIfStale && self._reloadIfStale._timeoutId != null) {
      clearInterval(self._reloadIfStale._timeoutId);

      self._reloadIfStale._timeoutId = undefined;
    }

    const keys = self._keys;

    const unload = keys ? self._load(...keys) : self._load();

    if (unload) {
      self._unload = unload;
    }
  }

  if (_reloadOnFocus && !_reloadOnFocus._focusListener) {
    const listener = () => {
      if (!document.hidden && _reloadOnFocus._isLoadable) {
        _reloadOnFocus._isLoadable = false;

        self.load!(true)();
      }
    };

    _reloadOnFocus._focusListener = listener;

    document.addEventListener('visibilitychange', listener);
  }

  self._counter++;

  return () => {
    if (isNotCanceled) {
      isNotCanceled = false;

      if (!--self._counter) {
        handleUnload(self);

        if (!self.isLoaded._value) {
          self._isLoadable = true;
        }

        if (self._reloadOnFocus) {
          document.removeEventListener(
            'visibilitychange',
            self._reloadOnFocus._focusListener!
          );
        }
      }
    }
  };
}

function setInner(this: IsLoadedState, value: any) {
  const self = this;

  if (self._value !== value) {
    self._value = value;

    addToBatch(self._setData, value);
  }
}

function setError(this: ErrorState<any>, value: any) {
  const self = this;

  if (self._value !== value) {
    self._value = value;

    addToBatch(self._setData, value);

    if (value !== undefined) {
      const parent = self._parent;

      parent.set(undefined, undefined, true);

      if (parent._promise) {
        parent._promise._reject(value);

        parent._promise = null;
      }
    }
  }
}

function getError(this: ErrorState<any>) {
  const self = this;

  const err = self._value;

  if (err === undefined || self._isExpectedError!(err)) {
    return err;
  }

  throw err;
}

const getAsyncState = <D>(
  _commonSet: LoadableState['_commonSet'],
  onValueChange: LoadableState['_onValueChange'],
  options: Omit<LoadableStateOptions, 'load'>,
  stateInitializer: StateInitializer | undefined,
  _keys: any[] | undefined,
  _setData: D,
  _load?: LoadableStateOptions<any, any, any, any[]>['load'],
  Control?: LoadableStateOptions<any, any, any>['Control'],
  _tickStart?: () => void,
  _tickEnd?: () => void,
  _parent?: PaginatedStorage<any>
): AnyAsyncState => {
  const {
    isExpectedError,
    isLoaded,
    reloadIfStale,
    reloadOnFocus,
    loadingTimeout,
  } = options;

  const errorState = {
    _onValueChange,
    get: isExpectedError ? getError : get,
    set: setError,
    _isExpectedError: isExpectedError,
    _parent: undefined!,
    _value: undefined,
    _setData: new Set(),
  } as Partial<ErrorState<any>> as ErrorState<any>;

  const state = handleState<LoadableState<any, any, any>>(
    {
      _root: undefined!,
      _isFetchInProgress: false,
      _isLoadable: true,
      _counter: 0,
      _isLoaded: isLoaded || alwaysTrue,
      _promise: null,
      _unload: undefined,
      _value: undefined,
      _attempt: isLoaded && isLoaded.length > 2 ? 0 : undefined,
      _reloadIfStale: reloadIfStale
        ? { _timeout: reloadIfStale, _timeoutId: undefined }
        : null,
      _reloadOnFocus: reloadOnFocus
        ? {
            _timeout: reloadOnFocus,
            _timeoutId: undefined,
            _focusListener: undefined,
            _isLoadable: false,
          }
        : null,
      _slowLoading: loadingTimeout
        ? {
            _timeout: loadingTimeout,
            _timeoutId: undefined,
            _callbackSet: new Set(),
          }
        : null,
      _keys,
      _tickEnd: _tickEnd || noop,
      _tickStart: _tickStart || noop,
      _parent,
      get,
      _setData,
      set,
      _commonSet,
      _onValueChange: onValueChange,
      load: (_load && load)!,
      _load: _load!,
      error: errorState,
      isLoaded: {
        _onValueChange,
        get,
        _set: setInner,
        _value: false,
        _setData: new Set(),
      } as IsLoadedState,
      control: undefined!,
    },
    options.value,
    stateInitializer,
    _keys
  );

  const value = state._value;

  (state as Mutable<typeof state>)._root = state;

  (errorState as Mutable<typeof errorState>)._parent = state;

  if (value !== undefined) {
    const _isLoaded = isLoaded ? isLoaded(value, undefined, 0) : true;

    state.isLoaded._value = _isLoaded;

    if (_isLoaded && !options.revalidate) {
      state._isLoadable = false;
    }
  }

  if (Control) {
    (state as Mutable<typeof state>).control = new Control(options, state);
  }

  return state;
};

export default getAsyncState;
