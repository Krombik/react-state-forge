import { Component, type ContextType } from 'react';
import ErrorBoundaryContext from '../utils/ErrorBoundaryContext';

const ORIGINAL_RENDER = Symbol();

const ORIGINAL_DID_CATCH = Symbol();

const ORIGINAL_WILL_UNMOUNT = Symbol();

const CTX = Symbol();

const wrapErrorBoundary = <T extends typeof Component>(component: T): T => {
  const { render, componentDidCatch, componentWillUnmount } =
    component.prototype;

  //@ts-expect-error
  return class extends component {
    readonly [CTX]: NonNullable<ContextType<typeof ErrorBoundaryContext>> =
      new Set();

    readonly [ORIGINAL_RENDER] = render;

    readonly [ORIGINAL_DID_CATCH] = componentDidCatch;

    readonly [ORIGINAL_WILL_UNMOUNT] = componentWillUnmount;

    componentWillUnmount() {
      const ctx = this[CTX];

      const it = ctx.values();

      for (let i = ctx.size; i--; ) {
        it.next().value();
      }

      if (this[ORIGINAL_WILL_UNMOUNT]) {
        this[ORIGINAL_WILL_UNMOUNT]();
      }
    }

    componentDidCatch(error: any, errorInfo: any) {
      const ctx = this[CTX];

      const it = ctx.values();

      for (let i = ctx.size; i--; ) {
        it.next().value();
      }

      ctx.clear();

      if (this[ORIGINAL_DID_CATCH]) {
        this[ORIGINAL_DID_CATCH](error, errorInfo);
      }
    }

    render() {
      return (
        <ErrorBoundaryContext.Provider value={this[CTX]}>
          {this[ORIGINAL_RENDER]()}
        </ErrorBoundaryContext.Provider>
      );
    }
  };
};

export default wrapErrorBoundary;
