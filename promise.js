const State = {
  pending: 'pending',
  fulfilled: 'fulfilled',
  rejected: 'rejected'
};

const isThenable = any => Boolean(any && typeof any.then === 'function');

class APromise {
  #state = State.pending;
  #value;
  #thens = [];
  #catches = [];

  constructor(executor) {
    try {
      executor(this.#handleFulfilled.bind(this),
        this.#handleRejected.bind(this));
    } catch (reason) {
      this.#handleRejected(reason);
    }
  }

  then(fulfillFn, catchFn) {
    return new APromise((resolve, reject) => {
      this.#thens.push(value => {
        if (fulfillFn) {
          try {
            resolve(fulfillFn(value));
          } catch (reason) {
            reject(reason);
          }
        } else {
          resolve(value);
        }
      });

      this.#catches.push(reason => {
        if (catchFn) {
          try {
            resolve(catchFn(reason));
          } catch (err) {
            reject(err);
          }
        } else {
          reject(reason);
        }
      });

      this.#notify();
    });
  }

  catch(catchFn) {
    this.then(undefined, catchFn);
  }

  finally(fn) {
    return this.then(value => {
      fn();
      return value;
    }), reason => {
      fn();
      throw value;
    }
  }

  #handleFulfilled(value) {
    if (this.#state !== State.pending) {
      return;
    }

    if (isThenable(value)) {
      value.then(this.#handleFulfilled.bind(this),
        this.#handleRejected.bind(this));
    } else {
      this.#state = State.fulfilled;
      this.#value = value;

      this.#notify();
    }
  }

  #handleRejected(reason) {
    if (this.#state !== State.pending) {
      return;
    }

    if (isThenable(reason)) {
      reason.then(this.#handleFulfilled.bind(this),
        this.#handleRejected.bind(this));
    } else {
      this.#state = State.rejected;
      this.#value = reason;

      this.#notify();
    }
  }

  #notify() {
    if (this.#state === State.pending) {
      return;
    }

    queueMicrotask(() => {
      if (this.#state === State.fulfilled) {
        this.#thens.forEach(f => f(this.#value));
      } else {
        this.#catches.forEach(f => f(this.#value));
      }

      this.#thens = [];
      this.#catches = [];
    })
  }

  static resolve(value)
  {
    return new APromise(resolve => resolve(value));
  }

  static reject(reason)
  {
    return new APromise((_, reject) => reject(reason));
  }

  static all(promises) {
    if (promises.length === 0) {
      return APromise.resolve([]);
    } else {
      let values = [];
      let numFulfilled = 0;
      return new APromise((resolve, reject) => {
        promises.forEach((promise, index) => {
          promise.then(value => {
            values[index] = value;
            if (++numFulfilled == promises.length) {
              resolve(values);
            }
          }, reason => reject(reason))
        });
      });
    }
  }

  static any(promises) {
    if (promises.length === 0) {
      return APromise.reject();
    } else {
      let reasons = [];
      let numSettled = 0;
      return new APromise((resolve, reject) => {
        promises.forEach((promise, index) => {
          promise.then(
            resolve, 
            reason => {
              reasons[index] = reason;
              if (++numSettled == promises.length) {
                reject(AggregateError(reasons));
              }
            }
          )
        });
      });
    }
  }

  static allSettled(promises) {
    if (promises.length === 0) {
      return APromise.resolve([]);
    } else {
      let results = [];
      let numSettled = 0;
      
      return new APromise(resolve => {
        promises.forEach((promise, index) => {
          promise.then(value => {
            results[index] = { status: 'fulfilled', value };
            if (++numSettled === promises.length) {
              resolve(results);
            }
          }, reason => {
            results[index] = { status: 'rejected', reason };
            if (++numSettled === promises.length) {
              resolve(results);
            }
          });
        });
      });
    }
  }

  static race(promises) {
    return new APromise((resolve, reject) => {
      promises.forEach(promise => promise.then(resolve, reject));
    });
  }
}

  module.exports = APromise;
