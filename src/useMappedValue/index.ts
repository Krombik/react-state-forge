import { useEffect, useRef } from 'react';
import { AsyncState, State } from '../types';
import getValue from '../getValue';
import onValueChange from '../onValueChange';
import useForceRerender from 'react-helpful-utils/useForceRerender';

const simpleIsEqual = (next: any, prev: any) => next === prev;

const useMappedValue = ((
  state: AsyncState<any>,
  mapper: (value: any, isLoaded?: boolean, error?: any) => any,
  isEqual: (nextValue: any, prevValue: any) => boolean = simpleIsEqual
) => {
  const { _internal: utils, isLoaded, error } = state;

  const mappedValue = mapper(
    getValue(state),
    isLoaded && getValue(isLoaded),
    error && getValue(error)
  );

  const forceRerender = useForceRerender();

  const prevMappedValueRef = useRef(mappedValue);

  prevMappedValueRef.current = mappedValue;

  useEffect(() => {
    const unlistenValue = onValueChange(state, (value) => {
      if (
        !isEqual(
          mapper(value, isLoaded && getValue(isLoaded)),
          prevMappedValueRef.current
        )
      ) {
        forceRerender();
      }
    });

    if (error && mapper.length > 2) {
      const unlistenError = onValueChange(error, (err) => {
        if (
          !isEqual(mapper(undefined, true, err), prevMappedValueRef.current)
        ) {
          forceRerender();
        }
      });

      return () => {
        unlistenValue();

        unlistenError();
      };
    }

    return unlistenValue;
  }, [utils, state._path && state._path.join('.')]);

  return mappedValue;
}) as {
  <T, V, E = any>(
    state: AsyncState<T, E>,
    mapper: (
      value: T | undefined,
      isLoaded: boolean,
      error: E | undefined
    ) => V,
    isEqual?: (nextMappedValue: V, prevMappedValue: V) => boolean
  ): V;
  <T, V>(
    state: State<T>,
    mapper: (value: T) => V,
    isEqual?: (nextMappedValue: V, prevMappedValue: V) => boolean
  ): V;
};

export default useMappedValue;
