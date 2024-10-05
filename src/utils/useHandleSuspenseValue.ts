import getValue from '../getValue';
import { AnyAsyncState } from '../types';
import handleListeners from './handleListeners';
import onValueChange from '../onValueChange';
import { handleUnload } from './handleSuspense';
import { ContextType, useLayoutEffect } from 'react';
import ErrorBoundaryContext from './ErrorBoundaryContext';
import SuspenseContext from './SuspenseContext';

const useHandleSuspenseValue = (
  state: AnyAsyncState,
  errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>,
  suspenseCtx: ContextType<typeof SuspenseContext>,
  forceRerender: () => void
) => {
  const utils = state._internal;

  const withValueWatching = !state._awaitOnly;

  useLayoutEffect(
    () =>
      handleListeners([
        onValueChange(
          state,
          withValueWatching
            ? forceRerender
            : (value) => {
                if (value === undefined) {
                  forceRerender();
                }
              }
        ),
        withValueWatching && onValueChange(state.error, forceRerender),
        'load' in state &&
          !state._withoutLoading &&
          (handleUnload(utils, errorBoundaryCtx, suspenseCtx) || state.load()),
      ]),
    [utils, state._path && state._path.join('.')]
  );

  if (withValueWatching) {
    return getValue(state);
  }
};

export default useHandleSuspenseValue;