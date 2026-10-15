import { r as __toESM } from "./rolldown-runtime-DC62tzP2.js";
import { t as require_react } from "./react.js";
import { t as require_jsx_runtime } from "./react_jsx-runtime.js";
//#region node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
/**
* The context that `useQueryClient` reads from. `QueryClientProvider` is the normal way to set it.
*/
var QueryClientContext = import_react.createContext(void 0);
/**
* The `useQueryClient` hook returns the current `QueryClient` instance.
*
* @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
* be used.
* @returns The current `QueryClient` instance.
* @throws If no `queryClient` argument is passed and no `QueryClientProvider` is found in the component tree.
*/
var useQueryClient = (queryClient) => {
	const client = import_react.useContext(QueryClientContext);
	if (queryClient) return queryClient;
	if (!client) throw new Error("No QueryClient set, use QueryClientProvider to set one");
	return client;
};
/**
* Use the `QueryClientProvider` component to connect and provide a `QueryClient` to your application. Also
* calls `client.mount()`/`client.unmount()` as this component mounts/unmounts, which subscribes the client to
* focus/online events (resuming any paused mutations and refetching as needed when the app regains focus or
* comes back online).
*
* @returns The provided `children`, wrapped so they can read the `QueryClient` via `useQueryClient`.
*
* @example
* ```tsx
* import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
*
* const queryClient = new QueryClient()
*
* function App() {
*   return <QueryClientProvider client={queryClient}>...</QueryClientProvider>
* }
* ```
*/
var QueryClientProvider = ({ client, children }) => {
	import_react.useEffect(() => {
		client.mount();
		return () => {
			client.unmount();
		};
	}, [client]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientContext.Provider, {
		value: client,
		children
	});
};
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/timeoutManager.js
var defaultTimeoutProvider = {
	setTimeout: (callback, delay) => setTimeout(callback, delay),
	clearTimeout: (timeoutId) => clearTimeout(timeoutId),
	setInterval: (callback, delay) => setInterval(callback, delay),
	clearInterval: (intervalId) => clearInterval(intervalId)
};
/**
* Allows customization of how timeouts are created.
*
* @tanstack/query-core makes liberal use of timeouts to implement `staleTime`
* and `gcTime`. The default TimeoutManager provider uses the platform's global
* `setTimeout` implementation, which is known to have scalability issues with
* thousands of timeouts on the event loop.
*
* If you hit this limitation, consider providing a custom TimeoutProvider that
* coalesces timeouts.
*/
var TimeoutManager = class {
	#provider = defaultTimeoutProvider;
	#providerCalled = false;
	/**
	* `setTimeoutProvider` can be used to set a custom implementation of the
	* `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval` functions,
	* called a `TimeoutProvider`.
	*
	* This may be useful if you notice event loop performance issues with
	* thousands of queries. A custom TimeoutProvider could also support timer
	* delays longer than the global `setTimeout` maximum delay value of about
	* 24 days.
	*
	* It is important to call `setTimeoutProvider` before creating a
	* QueryClient or queries, so that the same provider is used consistently
	* for all timers in the application, since different TimeoutProviders
	* cannot cancel each others' timers.
	*
	* @example
	* ```ts
	* import { timeoutManager, QueryClient } from '@tanstack/query-core'
	* import { CustomTimeoutProvider } from './CustomTimeoutProvider'
	*
	* timeoutManager.setTimeoutProvider(new CustomTimeoutProvider())
	*
	* export const queryClient = new QueryClient()
	* ```
	*/
	setTimeoutProvider(provider) {
		if (this.#providerCalled && provider !== this.#provider) console.error(`[timeoutManager]: Switching provider after calls to previous provider might result in unexpected behavior.`, {
			previous: this.#provider,
			provider
		});
		this.#provider = provider;
		this.#providerCalled = false;
	}
	/**
	* `setTimeout` schedules a callback to run after approximately `delay`
	* milliseconds, like the global `setTimeout` function. The callback can be
	* canceled with `clearTimeout`.
	*
	* It returns a timer ID, which may be a number or an object that can be
	* coerced to a number via `Symbol.toPrimitive`.
	*
	* @example
	* ```ts
	* import { timeoutManager } from '@tanstack/query-core'
	*
	* const timeoutId = timeoutManager.setTimeout(
	*   () => console.log('ran at:', new Date()),
	*   1000,
	* )
	*
	* const timeoutIdNumber: number = Number(timeoutId)
	* ```
	*/
	setTimeout(callback, delay) {
		this.#providerCalled = true;
		return this.#provider.setTimeout(callback, delay);
	}
	/**
	* `clearTimeout` cancels a timeout callback scheduled with `setTimeout`,
	* like the global `clearTimeout` function. It should be called with a
	* timer ID returned by `setTimeout`.
	*
	* @example
	* ```ts
	* import { timeoutManager } from '@tanstack/query-core'
	*
	* const timeoutId = timeoutManager.setTimeout(
	*   () => console.log('ran at:', new Date()),
	*   1000,
	* )
	*
	* timeoutManager.clearTimeout(timeoutId)
	* ```
	*/
	clearTimeout(timeoutId) {
		this.#provider.clearTimeout(timeoutId);
	}
	/**
	* `setInterval` schedules a callback to be called approximately every
	* `delay` milliseconds, like the global `setInterval` function.
	*
	* Like `setTimeout`, it returns a timer ID, which may be a number or an
	* object that can be coerced to a number via `Symbol.toPrimitive`.
	*
	* @example
	* ```ts
	* import { timeoutManager } from '@tanstack/query-core'
	*
	* const intervalId = timeoutManager.setInterval(
	*   () => console.log('ran at:', new Date()),
	*   1000,
	* )
	* ```
	*/
	setInterval(callback, delay) {
		this.#providerCalled = true;
		return this.#provider.setInterval(callback, delay);
	}
	/**
	* `clearInterval` can be used to cancel an interval, like the global
	* `clearInterval` function. It should be called with an interval ID
	* returned by `setInterval`.
	*
	* @example
	* ```ts
	* import { timeoutManager } from '@tanstack/query-core'
	*
	* const intervalId = timeoutManager.setInterval(
	*   () => console.log('ran at:', new Date()),
	*   1000,
	* )
	*
	* timeoutManager.clearInterval(intervalId)
	* ```
	*/
	clearInterval(intervalId) {
		this.#provider.clearInterval(intervalId);
	}
};
/**
* Singleton instance of {@link TimeoutManager}, used throughout TanStack Query to schedule and cancel timers.
*/
var timeoutManager = new TimeoutManager();
/**
* In many cases code wants to delay to the next event loop tick; this is not
* mediated by {@link timeoutManager}.
*
* This function is provided to make auditing the `tanstack/query-core` for
* incorrect use of system `setTimeout` easier.
*/
function systemSetTimeoutZero(callback) {
	setTimeout(callback, 0);
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/utils.js
/** @deprecated
* use `environmentManager.isServer()` instead.
*/
var isServer = typeof window === "undefined" || "Deno" in globalThis;
function noop() {}
function functionalUpdate(updater, input) {
	return typeof updater === "function" ? updater(input) : updater;
}
function isValidTimeout(value) {
	return typeof value === "number" && value >= 0 && value !== Infinity;
}
function timeUntilStale(updatedAt, staleTime) {
	return Math.max(updatedAt + (staleTime || 0) - Date.now(), 0);
}
function resolveQueryValue(value, query) {
	return typeof value === "function" ? value(query) : value;
}
/**
* Checks whether a query matches the given {@link QueryFilters}.
* Every filter that is specified must match; filters that are left unspecified are ignored.
*
* @example
* ```ts
* const queryCache = queryClient.getQueryCache()
*
* const matchingQueries = queryCache
*   .getAll()
*   .filter((query) => matchQuery({ queryKey: ['posts'] }, query))
* ```
*/
function matchQuery(filters, query) {
	const { type = "all", exact, fetchStatus, predicate, queryKey, stale } = filters;
	if (queryKey) {
		if (exact) {
			if (query.queryHash !== hashQueryKeyByOptions(queryKey, query.options)) return false;
		} else if (!partialMatchKey(query.queryKey, queryKey)) return false;
	}
	if (type !== "all") {
		const isActive = query.isActive();
		if (type === "active" && !isActive) return false;
		if (type === "inactive" && isActive) return false;
	}
	if (typeof stale === "boolean" && query.isStale() !== stale) return false;
	if (fetchStatus && fetchStatus !== query.state.fetchStatus) return false;
	if (predicate && !predicate(query)) return false;
	return true;
}
/**
* Checks whether a mutation matches the given {@link MutationFilters}.
* Every filter that is specified must match; filters that are left unspecified are ignored.
* If a `mutationKey` filter is provided but the mutation has no `mutationKey` of its own, it does not match.
*
* @example
* ```ts
* const mutationCache = queryClient.getMutationCache()
*
* const matchingMutations = mutationCache
*   .getAll()
*   .filter((mutation) => matchMutation({ mutationKey: ['addPost'] }, mutation))
* ```
*/
function matchMutation(filters, mutation) {
	const { exact, status, predicate, mutationKey } = filters;
	if (mutationKey) {
		if (!mutation.options.mutationKey) return false;
		if (exact) {
			if (hashKey(mutation.options.mutationKey) !== hashKey(mutationKey)) return false;
		} else if (!partialMatchKey(mutation.options.mutationKey, mutationKey)) return false;
	}
	if (status && mutation.state.status !== status) return false;
	if (predicate && !predicate(mutation)) return false;
	return true;
}
function hashQueryKeyByOptions(queryKey, options) {
	return (options?.queryKeyHashFn || hashKey)(queryKey);
}
/**
* Default query & mutation keys hash function.
* Hashes the value into a stable hash.
*
* @example
* ```ts
* // Object keys are sorted, so key order doesn't affect the hash:
* hashKey(['todos', { page: 1, filter: 'done' }]) // === '["todos",{"filter":"done","page":1}]'
* ```
*/
function hashKey(queryKey) {
	return JSON.stringify(queryKey, (_, val) => isPlainObject(val) ? Object.keys(val).sort().reduce((result, key) => {
		result[key] = val[key];
		return result;
	}, {}) : val);
}
function partialMatchKey(a, b) {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;
	if (a && b && typeof a === "object" && typeof b === "object") {
		if (Array.isArray(a) && Array.isArray(b)) {
			if (b.length > a.length) return false;
			for (let i = 0; i < b.length; i++) if (!partialMatchKey(a[i], b[i])) return false;
			return true;
		}
		const bKeys = Object.keys(b);
		for (const key of bKeys) if (!partialMatchKey(a[key], b[key])) return false;
		return true;
	}
	return false;
}
var hasOwn = Object.prototype.hasOwnProperty;
function replaceEqualDeep(a, b, depth = 0) {
	if (a === b) return a;
	if (depth > 500) return b;
	const array = isPlainArray(a) && isPlainArray(b);
	if (!array && !(isPlainObject(a) && isPlainObject(b))) return b;
	const aSize = (array ? a : Object.keys(a)).length;
	const bItems = array ? b : Object.keys(b);
	const bSize = bItems.length;
	const copy = array ? new Array(bSize) : {};
	let equalItems = 0;
	for (let i = 0; i < bSize; i++) {
		const key = array ? i : bItems[i];
		const aItem = a[key];
		const bItem = b[key];
		if (aItem === bItem) {
			copy[key] = aItem;
			if (array ? i < aSize : hasOwn.call(a, key)) equalItems++;
			continue;
		}
		if (aItem === null || bItem === null || typeof aItem !== "object" || typeof bItem !== "object") {
			copy[key] = bItem;
			continue;
		}
		const v = replaceEqualDeep(aItem, bItem, depth + 1);
		copy[key] = v;
		if (v === aItem) equalItems++;
	}
	return aSize === bSize && equalItems === aSize ? a : copy;
}
/**
* Shallow compare objects.
*/
function shallowEqualObjects(a, b) {
	if (!b || Object.keys(a).length !== Object.keys(b).length) return false;
	for (const key in a) if (a[key] !== b[key]) return false;
	return true;
}
function isPlainArray(value) {
	return Array.isArray(value) && value.length === Object.keys(value).length;
}
function isPlainObject(o) {
	if (!hasObjectPrototype(o)) return false;
	const objectPrototype = Object.getPrototypeOf(o);
	const ctor = objectPrototype?.constructor;
	if (ctor === void 0) return true;
	if (typeof ctor !== "function") return false;
	const prot = ctor.prototype;
	if (!hasObjectPrototype(prot)) return false;
	if (!prot.hasOwnProperty("isPrototypeOf")) return false;
	if (objectPrototype !== Object.prototype) return false;
	return true;
}
function hasObjectPrototype(o) {
	return Object.prototype.toString.call(o) === "[object Object]";
}
function sleep(timeout) {
	return new Promise((resolve) => {
		timeoutManager.setTimeout(resolve, timeout);
	});
}
function replaceData(prevData, data, options) {
	if (typeof options.structuralSharing === "function") return options.structuralSharing(prevData, data);
	else if (options.structuralSharing !== false) try {
		return replaceEqualDeep(prevData, data);
	} catch (error) {
		console.error(`Structural sharing requires data to be JSON serializable. To fix this, turn off structuralSharing or return JSON-serializable data from your queryFn. [${options.queryHash}]: ${error}`);
		throw error;
	}
	return data;
}
/**
* Intended to be passed as a query's `placeholderData` option, for example
* `placeholderData: keepPreviousData`. Instead of resetting the query's data to `undefined` while a new
* query key is fetching, it keeps displaying the previously fetched data until the new data arrives.
*
* @example
* ```ts
* new QueryObserver(queryClient, {
*   queryKey: ['posts', page],
*   queryFn: () => fetchPosts(page),
*   placeholderData: keepPreviousData,
* })
* ```
*/
function keepPreviousData(previousData) {
	return previousData;
}
function addToEnd(items, item, max = 0) {
	const newItems = [...items, item];
	return max && newItems.length > max ? newItems.slice(1) : newItems;
}
function addToStart(items, item, max = 0) {
	const newItems = [item, ...items];
	return max && newItems.length > max ? newItems.slice(0, -1) : newItems;
}
/**
* Sentinel value that can be passed as a query's `queryFn` to conditionally disable the query (equivalent
* to `enabled: false`) while preserving full type inference for the query's data. Unlike `enabled: false`,
* a query disabled via `skipToken` cannot be triggered with `refetch`.
*
* @example
* ```ts
* new QueryObserver(queryClient, {
*   queryKey: ['post', postId],
*   queryFn: postId != null ? () => fetchPost(postId) : skipToken,
* })
* ```
*/
var skipToken = Symbol();
function ensureQueryFn(options, fetchOptions) {
	if (options.queryFn === skipToken) console.error(`Attempted to invoke queryFn when set to skipToken. This is likely a configuration error. Query hash: '${options.queryHash}'`);
	if (!options.queryFn && fetchOptions?.initialPromise) return () => fetchOptions.initialPromise;
	if (!options.queryFn || options.queryFn === skipToken) return () => Promise.reject(/* @__PURE__ */ new Error(`Missing queryFn: '${options.queryHash}'`));
	return options.queryFn;
}
/**
* Resolves a `throwOnError` option to a boolean.
* If `throwOnError` is a function, it is called with `params` (e.g. the error and, depending on the caller,
* additional context such as the query or mutation) and its result is returned, allowing the throwing
* behavior to be decided per error. Otherwise, `throwOnError` itself is coerced to a boolean (`undefined`
* resolves to `false`).
*
* @example
* ```ts
* const throwOnError =
*   query.state.error && typeof options.throwOnError === 'function'
*     ? shouldThrowError(options.throwOnError, [query.state.error, query])
*     : options.throwOnError
* ```
*/
function shouldThrowError(throwOnError, params) {
	if (typeof throwOnError === "function") return throwOnError(...params);
	return !!throwOnError;
}
function addConsumeAwareSignal(object, getSignal, onCancelled) {
	let consumed = false;
	let signal;
	Object.defineProperty(object, "signal", {
		enumerable: true,
		get: () => {
			signal ??= getSignal();
			if (consumed) return signal;
			consumed = true;
			if (signal.aborted) onCancelled();
			else signal.addEventListener("abort", onCancelled, { once: true });
			return signal;
		}
	});
	return object;
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/environmentManager.js
var isServerFn = () => isServer;
/**
* Returns whether the current runtime should be treated as a server environment.
*/
var isServer$1 = () => isServerFn();
/**
* Manages how TanStack Query detects whether the current runtime should be treated as
* server-side, which disables scheduling refetch timers and changes the default `retry` count
* and `gcTime`. By default, the detection treats a missing `window` (or the presence of a
* `Deno` global) as server.
*
* Override this for runtimes where that default detection would give the wrong answer — for
* example, a Service Worker, where `window` is undefined even though the environment should
* behave like a client.
*
* @example
* ```ts
* import { environmentManager } from '@tanstack/query-core'
*
* environmentManager.setIsServer(() => false)
* ```
*/
var environmentManager = {
	isServer: isServer$1,
	/**
	* Overrides the server check globally.
	*/
	setIsServer(isServerValue) {
		isServerFn = isServerValue;
	}
};
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/subscribable.js
/**
* The base class behind everything in Query that you can subscribe to: `QueryCache`, `MutationCache`,
* the observers, and the `FocusManager`/`OnlineManager` behind `focusManager` and `onlineManager`.
* Subclasses decide what a listener receives and when it is called.
*/
var Subscribable = class {
	constructor() {
		this.listeners = /* @__PURE__ */ new Set();
		this.subscribe = this.subscribe.bind(this);
	}
	/**
	* Registers a listener to be called on every update this object notifies about. Returns a function
	* that removes the listener again — call it to stop listening. The base class never drops a listener
	* on its own, though some subclasses clear all of theirs in `destroy()`.
	* @param listener - Called on each update, with whatever the subclass passes to its subscribers.
	* @example
	* ```ts
	* const unsubscribe = subscribable.subscribe(() => {
	*   // react to the update
	* })
	*
	* unsubscribe()
	* ```
	*/
	subscribe(listener) {
		this.listeners.add(listener);
		this.onSubscribe();
		return () => {
			this.listeners.delete(listener);
			this.onUnsubscribe();
		};
	}
	/**
	* Returns `true` while at least one listener is registered, `false` once they have all unsubscribed.
	*/
	hasListeners() {
		return this.listeners.size > 0;
	}
	onSubscribe() {}
	onUnsubscribe() {}
};
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/focusManager.js
/**
* The `FocusManager` manages the focus state within TanStack Query.
*
* It can be used to change the default event listeners or to manually change the focus state.
*/
var FocusManager = class extends Subscribable {
	#focused;
	#cleanup;
	#setup;
	constructor() {
		super();
		this.#setup = (onFocus) => {
			if (typeof window !== "undefined" && window.addEventListener) {
				const listener = () => onFocus();
				window.addEventListener("visibilitychange", listener, false);
				return () => {
					window.removeEventListener("visibilitychange", listener);
				};
			}
		};
	}
	onSubscribe() {
		if (!this.#cleanup) this.setEventListener(this.#setup);
	}
	onUnsubscribe() {
		if (!this.hasListeners()) {
			this.#cleanup?.();
			this.#cleanup = void 0;
		}
	}
	/**
	* `setEventListener` can be used to set a custom event listener that will
	* be used to determine the focus state. The provided `setup` function
	* receives a `setFocused` callback: call it with a `boolean` to manually
	* set the focus state, or with no arguments to re-evaluate the current
	* focus state and notify subscribers.
	*
	* @example
	* ```ts
	* import { focusManager } from '@tanstack/query-core'
	*
	* focusManager.setEventListener((handleFocus) => {
	*   const listener = () => handleFocus()
	*   // Listen to visibilitychange
	*   if (typeof window !== 'undefined' && window.addEventListener) {
	*     window.addEventListener('visibilitychange', listener, false)
	*   }
	*
	*   return () => {
	*     // Be sure to unsubscribe if a new handler is set
	*     window.removeEventListener('visibilitychange', listener)
	*   }
	* })
	* ```
	*/
	setEventListener(setup) {
		this.#setup = setup;
		this.#cleanup?.();
		this.#cleanup = setup((focused) => {
			if (typeof focused === "boolean") this.setFocused(focused);
			else this.onFocus();
		});
	}
	/**
	* `setFocused` can be used to manually set the focus state. Set `undefined`
	* to fall back to the default focus check.
	*
	* @example
	* ```ts
	* import { focusManager } from '@tanstack/query-core'
	*
	* // Set focused
	* focusManager.setFocused(true)
	*
	* // Set unfocused
	* focusManager.setFocused(false)
	*
	* // Fallback to the default focus check
	* focusManager.setFocused(undefined)
	* ```
	*/
	setFocused(focused) {
		if (this.#focused !== focused) {
			this.#focused = focused;
			this.onFocus();
		}
	}
	/**
	* `onFocus` notifies all subscribed listeners with the current focus state.
	*/
	onFocus() {
		const isFocused = this.isFocused();
		this.listeners.forEach((listener) => {
			listener(isFocused);
		});
	}
	/**
	* `isFocused` can be used to get the current focus state.
	*/
	isFocused() {
		if (typeof this.#focused === "boolean") return this.#focused;
		return globalThis.document?.visibilityState !== "hidden";
	}
};
/**
* Singleton instance of {@link FocusManager}, used to manage and observe the focus state within TanStack Query.
*/
var focusManager = new FocusManager();
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/hydration.js
function tryResolveSync(promise) {
	let data;
	promise.then((result) => {
		data = result;
		return result;
	}, noop)?.catch?.(noop);
	if (data !== void 0) return { data };
}
function dehydrateMutation(mutation) {
	return {
		mutationKey: mutation.options.mutationKey,
		state: mutation.state,
		...mutation.options.scope && { scope: mutation.options.scope },
		...mutation.meta && { meta: mutation.meta }
	};
}
function dehydratePromise(query, serializeData, shouldRedactErrors) {
	const promise = query.promise?.then(serializeData).catch((error) => {
		if (shouldRedactErrors?.(error) === false) return Promise.reject(error);
		console.error(`A query that was dehydrated as pending ended up rejecting. [${query.queryHash}]: ${error}; The error will be redacted in production builds`);
		return Promise.reject(/* @__PURE__ */ new Error("redacted"));
	});
	promise?.catch(noop);
	return promise;
}
/**
* Dehydrates a single `Query` into a serializable `DehydratedQuery` snapshot. Note that most query config (e.g.
* `queryFn`, `staleTime`) is not dehydrated but instead meant to be configured again when consuming the
* de/rehydrated data, typically with `useQuery` on the client. If the query is still `pending`, its in-flight
* promise is dehydrated too so it can be resumed on the other side instead of re-fetched.
* @param query - The query to dehydrate.
* @param serializeData - Optional transform applied to `query.state.data` before it is included in the snapshot.
* @param shouldRedactErrors - Optional predicate; if it returns `false` for the promise's rejection error, that
* error is kept as-is instead of being redacted.
*/
function dehydrateQuery(query, serializeData, shouldRedactErrors) {
	return {
		dehydratedAt: Date.now(),
		state: {
			...query.state,
			...query.state.data !== void 0 && { data: serializeData ? serializeData(query.state.data) : query.state.data }
		},
		queryKey: query.queryKey,
		queryHash: query.queryHash,
		...query.state.status === "pending" && { promise: dehydratePromise(query, serializeData, shouldRedactErrors) },
		...query.meta && { meta: query.meta },
		...query.queryType && { queryType: query.queryType }
	};
}
/**
* The default `shouldDehydrateMutation` predicate used by `dehydrate`. Only dehydrates mutations that are
* currently paused (e.g. paused by `networkMode` while offline).
*/
function defaultShouldDehydrateMutation(mutation) {
	return mutation.state.isPaused;
}
/**
* The default `shouldDehydrateQuery` predicate used by `dehydrate`. Only dehydrates queries whose status is
* `'success'`.
*/
function defaultShouldDehydrateQuery(query) {
	return query.state.status === "success";
}
/**
* Dehydrates a `QueryClient`'s cache (queries and mutations) into a plain, serializable `DehydratedState`,
* typically to embed in server-rendered markup and later restore into a client-side `QueryClient` via `hydrate`.
* Which queries/mutations are included, and how their data/errors are transformed, is controlled by `options`,
* falling back to the client's `dehydrate` default options, and finally to `defaultShouldDehydrateQuery` /
* `defaultShouldDehydrateMutation`.
* @example
* ```ts
* const queryClient = new QueryClient()
*
* await queryClient.prefetchQuery({
*   queryKey: ['posts'],
*   queryFn: getPosts,
* })
*
* const dehydratedState = dehydrate(queryClient)
* ```
*/
function dehydrate(client, options = {}) {
	const filterMutation = options.shouldDehydrateMutation ?? client.getDefaultOptions().dehydrate?.shouldDehydrateMutation ?? defaultShouldDehydrateMutation;
	const mutations = client.getMutationCache().getAll().flatMap((mutation) => filterMutation(mutation) ? [dehydrateMutation(mutation)] : []);
	const filterQuery = options.shouldDehydrateQuery ?? client.getDefaultOptions().dehydrate?.shouldDehydrateQuery ?? defaultShouldDehydrateQuery;
	const shouldRedactErrors = options.shouldRedactErrors ?? client.getDefaultOptions().dehydrate?.shouldRedactErrors;
	const serializeData = options.serializeData ?? client.getDefaultOptions().dehydrate?.serializeData;
	return {
		mutations,
		queries: client.getQueryCache().getAll().flatMap((query) => filterQuery(query) ? [dehydrateQuery(query, serializeData, shouldRedactErrors)] : [])
	};
}
/**
* Restores a `DehydratedState` (as produced by `dehydrate`) into a `QueryClient`'s cache, typically to seed the
* client with data already fetched on the server. `mutations` and `queries` are each optional on `dehydratedState`.
* Queries not yet in the cache are built from the dehydrated snapshot; queries that already exist are only updated
* when the dehydrated data is newer than what's already cached. Newly built queries have their `fetchStatus` reset
* to `'idle'` so they don't hydrate stuck in a fetching state. If a dehydrated query still had an in-flight
* promise, it is resumed via `query.fetch()` (reusing that promise as `initialPromise`) rather than re-invoking
* `queryFn`.
* @example
* ```ts
* // dehydratedState was produced by `dehydrate` on the server
* // and sent to the client, e.g. embedded in server-rendered markup.
* const queryClient = new QueryClient()
*
* hydrate(queryClient, dehydratedState)
* ```
*/
function hydrate(client, dehydratedState, options) {
	const mutationCache = client.getMutationCache();
	const queryCache = client.getQueryCache();
	const deserializeData = options?.defaultOptions?.deserializeData ?? client.getDefaultOptions().hydrate?.deserializeData;
	dehydratedState.mutations?.forEach(({ state, ...mutationOptions }) => {
		mutationCache.build(client, {
			...client.getDefaultOptions().hydrate?.mutations,
			...options?.defaultOptions?.mutations,
			...mutationOptions
		}, state);
	});
	dehydratedState.queries?.forEach(({ queryKey, state, queryHash, meta, promise, dehydratedAt, queryType }) => {
		const syncData = promise ? tryResolveSync(promise) : void 0;
		const rawData = state.data === void 0 ? syncData?.data : state.data;
		const data = rawData === void 0 ? rawData : deserializeData ? deserializeData(rawData) : rawData;
		let query = queryCache.get(queryHash);
		const existingQueryIsPending = query?.state.status === "pending";
		const existingQueryIsFetching = query?.state.fetchStatus === "fetching";
		if (query) {
			const hasNewerSyncData = syncData && dehydratedAt > query.state.dataUpdatedAt;
			if (state.dataUpdatedAt > query.state.dataUpdatedAt || hasNewerSyncData) {
				const { fetchStatus: _ignored, ...serializedState } = state;
				query.setState({
					...serializedState,
					data,
					...state.status === "pending" && data !== void 0 && {
						status: "success",
						dataUpdatedAt: dehydratedAt,
						...!existingQueryIsFetching && { fetchStatus: "idle" }
					}
				});
			}
		} else query = queryCache.build(client, {
			...client.getDefaultOptions().hydrate?.queries,
			...options?.defaultOptions?.queries,
			queryKey,
			queryHash,
			meta,
			_type: queryType
		}, {
			...state,
			data,
			fetchStatus: "idle",
			status: state.status === "pending" && data !== void 0 ? "success" : state.status,
			...state.status === "pending" && data !== void 0 && { dataUpdatedAt: dehydratedAt }
		});
		if (promise && !syncData && !existingQueryIsPending && !existingQueryIsFetching && dehydratedAt > query.state.dataUpdatedAt) query.fetch(void 0, { initialPromise: Promise.resolve(promise).then(deserializeData) }).catch(noop);
	});
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/notifyManager.js
/**
* Default scheduling function used by the notify manager.
* Schedules the callback with the system's `setTimeout(callback, 0)`.
*/
var defaultScheduler = systemSetTimeoutZero;
function createNotifyManager() {
	let queue = [];
	let transactions = 0;
	let notifyFn = (callback) => {
		callback();
	};
	let batchNotifyFn = (callback) => {
		callback();
	};
	let scheduleFn = defaultScheduler;
	const schedule = (callback) => {
		if (transactions) queue.push(callback);
		else scheduleFn(() => {
			notifyFn(callback);
		});
	};
	const flush = () => {
		const originalQueue = queue;
		queue = [];
		if (originalQueue.length) scheduleFn(() => {
			batchNotifyFn(() => {
				originalQueue.forEach((callback) => {
					notifyFn(callback);
				});
			});
		});
	};
	return {
		/**
		* Batches all updates scheduled inside the passed callback.
		* This is mainly used internally to optimize query client updating.
		* Batches can be nested; the queue is only flushed once the outermost `batch` call finishes.
		* The return value of `callback` is passed through.
		*/
		batch: (callback) => {
			let result;
			transactions++;
			try {
				result = callback();
			} finally {
				transactions--;
				if (!transactions) flush();
			}
			return result;
		},
		/**
		* All calls to the wrapped function will be batched.
		*/
		batchCalls: (callback) => {
			return (...args) => {
				schedule(() => {
					callback(...args);
				});
			};
		},
		/**
		* Schedules a function to be run on the next batch.
		* By default, the batch is run with a `setTimeout`, but this can be configured via `setScheduler`.
		*/
		schedule,
		/**
		* Use this method to set a custom notify function.
		* This can be used to for example wrap notifications with `React.act` while running tests.
		*/
		setNotifyFunction: (fn) => {
			notifyFn = fn;
		},
		/**
		* Use this method to set a custom function to batch notifications together into a single tick.
		* Framework adapters use this to plug in their own batching primitive, so that a single query
		* update only triggers one re-render instead of one per subscriber.
		*
		* @example
		* ```ts
		* import { notifyManager } from '@tanstack/query-core'
		* import { batch } from 'solid-js'
		*
		* notifyManager.setBatchNotifyFunction(batch)
		* ```
		*/
		setBatchNotifyFunction: (fn) => {
			batchNotifyFn = fn;
		},
		/**
		* Configures a custom callback that schedules when the next batch runs.
		* The default behavior is `setTimeout(callback, 0)`.
		*
		* @example
		* ```ts
		* import { notifyManager } from '@tanstack/query-core'
		*
		* // Schedule batches in the next microtask
		* notifyManager.setScheduler(queueMicrotask)
		*
		* // Schedule batches before the next frame is rendered
		* notifyManager.setScheduler(requestAnimationFrame)
		*
		* // Schedule batches some time in the future
		* notifyManager.setScheduler((cb) => setTimeout(cb, 10))
		* ```
		*/
		setScheduler: (fn) => {
			scheduleFn = fn;
		}
	};
}
/**
* Handles scheduling and batching callbacks in TanStack Query.
*/
var notifyManager = createNotifyManager();
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/onlineManager.js
/**
* The `OnlineManager` manages the online state within TanStack Query. It can
* be used to change the default event listeners or to manually change the
* online state.
*
* By default, the `onlineManager` assumes an active network connection, and
* listens to the `online` and `offline` events on the `window` object to
* detect changes.
*/
var OnlineManager = class extends Subscribable {
	#online = true;
	#cleanup;
	#setup;
	constructor() {
		super();
		this.#setup = (onOnline) => {
			if (typeof window !== "undefined" && window.addEventListener) {
				const onlineListener = () => onOnline(true);
				const offlineListener = () => onOnline(false);
				window.addEventListener("online", onlineListener, false);
				window.addEventListener("offline", offlineListener, false);
				return () => {
					window.removeEventListener("online", onlineListener);
					window.removeEventListener("offline", offlineListener);
				};
			}
		};
	}
	onSubscribe() {
		if (!this.#cleanup) this.setEventListener(this.#setup);
	}
	onUnsubscribe() {
		if (!this.hasListeners()) {
			this.#cleanup?.();
			this.#cleanup = void 0;
		}
	}
	/**
	* `setEventListener` can be used to set a custom event listener that will
	* be used to determine the online state. The provided `setup` function
	* receives a `setOnline` callback that should be called with a `boolean`
	* whenever the online state changes.
	*
	* @example
	* ```ts
	* import NetInfo from '@react-native-community/netinfo'
	* import { onlineManager } from '@tanstack/query-core'
	*
	* onlineManager.setEventListener((setOnline) => {
	*   return NetInfo.addEventListener((state) => {
	*     setOnline(!!state.isConnected)
	*   })
	* })
	* ```
	*/
	setEventListener(setup) {
		this.#setup = setup;
		this.#cleanup?.();
		this.#cleanup = setup(this.setOnline.bind(this));
	}
	/**
	* `setOnline` can be used to manually set the online state.
	*
	* @example
	* ```ts
	* import { onlineManager } from '@tanstack/query-core'
	*
	* // Set to online
	* onlineManager.setOnline(true)
	*
	* // Set to offline
	* onlineManager.setOnline(false)
	* ```
	*/
	setOnline(online) {
		if (this.#online !== online) {
			this.#online = online;
			this.listeners.forEach((listener) => {
				listener(online);
			});
		}
	}
	/**
	* `isOnline` can be used to get the current online state.
	*/
	isOnline() {
		return this.#online;
	}
};
/**
* Singleton instance of {@link OnlineManager}, used to manage and observe the online state within TanStack Query.
*/
var onlineManager = new OnlineManager();
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/retryer.js
function defaultRetryDelay(failureCount) {
	return Math.min(1e3 * 2 ** failureCount, 3e4);
}
function canFetch(networkMode) {
	return (networkMode ?? "online") === "online" ? onlineManager.isOnline() : true;
}
/**
* The error thrown by a `Retryer` (and surfaced to `query.promise`/`mutation`) when a fetch is cancelled, e.g. via
* `query.cancel()`. `revert`, if `true`, tells the caller to restore the state the query was in before the fetch
* started instead of surfacing the error. `silent`, if `true`, tells the caller to suppress this error and instead
* resolve with the promise of the fetch that triggered the cancellation.
* @example
* ```ts
* query.cancel()
*
* try {
*   await query.promise
* } catch (error) {
*   if (error instanceof CancelledError) {
*     // the fetch was cancelled, e.g. via `query.cancel()`
*   }
* }
* ```
*/
var CancelledError = class extends Error {
	constructor(options) {
		super("CancelledError");
		this.revert = options?.revert;
		this.silent = options?.silent;
	}
};
/**
* @deprecated Use instanceof `CancelledError` instead.
*/
function isCancelledError(value) {
	return value instanceof CancelledError;
}
function createRetryer(config) {
	let isRetryCancelled = false;
	let failureCount = 0;
	let continueFn;
	let status = "pending";
	let promiseResolve;
	let promiseReject;
	const promise = new Promise((resolve, reject) => {
		promiseResolve = resolve;
		promiseReject = reject;
	});
	promise.catch(noop);
	const isResolved = () => status !== "pending";
	const cancel = (cancelOptions) => {
		if (!isResolved()) {
			const error = new CancelledError(cancelOptions);
			reject(error);
			config.onCancel?.(error);
		}
	};
	const cancelRetry = () => {
		isRetryCancelled = true;
	};
	const continueRetry = () => {
		isRetryCancelled = false;
	};
	const canContinue = () => focusManager.isFocused() && (config.networkMode === "always" || onlineManager.isOnline()) && config.canRun();
	const canStart = () => canFetch(config.networkMode) && config.canRun();
	const resolve = (value) => {
		if (!isResolved()) {
			continueFn?.();
			status = "resolved";
			promiseResolve(value);
		}
	};
	const reject = (value) => {
		if (!isResolved()) {
			continueFn?.();
			status = "rejected";
			promiseReject(value);
		}
	};
	const pause = () => {
		return new Promise((continueResolve) => {
			continueFn = (value) => {
				if (isResolved() || canContinue()) continueResolve(value);
			};
			config.onPause?.();
		}).then(() => {
			continueFn = void 0;
			if (!isResolved()) config.onContinue?.();
		});
	};
	const run = () => {
		if (isResolved()) return;
		let promiseOrValue;
		const initialPromise = failureCount === 0 ? config.initialPromise : void 0;
		try {
			promiseOrValue = initialPromise ?? config.fn();
		} catch (error) {
			promiseOrValue = Promise.reject(error);
		}
		Promise.resolve(promiseOrValue).then(resolve).catch((error) => {
			if (isResolved()) return;
			const retry = config.retry ?? (isServer$1() ? 0 : 3);
			const retryDelay = config.retryDelay ?? defaultRetryDelay;
			const delay = typeof retryDelay === "function" ? retryDelay(failureCount, error) : retryDelay;
			const shouldRetry = retry === true || typeof retry === "number" && failureCount < retry || typeof retry === "function" && retry(failureCount, error);
			if (isRetryCancelled || !shouldRetry) {
				reject(error);
				return;
			}
			failureCount++;
			config.onFail?.(failureCount, error);
			sleep(delay).then(() => {
				return canContinue() ? void 0 : pause();
			}).then(() => {
				if (isRetryCancelled) reject(error);
				else run();
			});
		});
	};
	return {
		promise,
		status: () => status,
		cancel,
		continue: () => {
			continueFn?.();
			return promise;
		},
		cancelRetry,
		continueRetry,
		canStart,
		start: () => {
			if (canStart()) run();
			else pause().then(run);
			return promise;
		}
	};
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/removable.js
/**
* The base class for cache entries that are garbage collected once nothing is using them —
* `Query` and `Mutation` both extend it. `gcTime` controls how long an unused entry is kept.
*/
var Removable = class {
	#gcTimeout;
	/**
	* Clears the pending garbage collection timeout, so the entry is no longer scheduled for removal.
	* A subclass may override this to release what it holds on to as well — `Query` also cancels any
	* in-flight fetch.
	*/
	destroy() {
		this.clearGcTimeout();
	}
	scheduleGc() {
		this.clearGcTimeout();
		if (isValidTimeout(this.gcTime)) this.#gcTimeout = timeoutManager.setTimeout(() => {
			this.optionalRemove();
		}, this.gcTime);
	}
	updateGcTime(newGcTime) {
		this.gcTime = Math.max(this.gcTime || 0, newGcTime ?? (isServer$1() ? Infinity : 3e5));
	}
	clearGcTimeout() {
		if (this.#gcTimeout !== void 0) {
			timeoutManager.clearTimeout(this.#gcTimeout);
			this.#gcTimeout = void 0;
		}
	}
};
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/infiniteQueryBehavior.js
function infiniteQueryBehavior(pages) {
	return { onFetch: (context, query) => {
		const options = context.options;
		const direction = context.fetchOptions?.meta?.fetchMore?.direction;
		const oldPages = context.state.data?.pages || [];
		const oldPageParams = context.state.data?.pageParams || [];
		let result = {
			pages: [],
			pageParams: []
		};
		let currentPage = 0;
		const fetchFn = async () => {
			let cancelled = false;
			const addSignalProperty = (object) => {
				addConsumeAwareSignal(object, () => context.signal, () => cancelled = true);
			};
			const queryFn = ensureQueryFn(context.options, context.fetchOptions);
			const fetchPage = async (data, param, previous) => {
				if (cancelled) return Promise.reject(context.signal.reason);
				if (param == null && data.pages.length) return Promise.resolve(data);
				const createQueryFnContext = () => {
					const queryFnContext = {
						client: context.client,
						queryKey: context.queryKey,
						pageParam: param,
						direction: previous ? "backward" : "forward",
						meta: context.options.meta
					};
					addSignalProperty(queryFnContext);
					return queryFnContext;
				};
				const queryFnContext = createQueryFnContext();
				const page = await queryFn(queryFnContext);
				const { maxPages } = context.options;
				const addTo = previous ? addToStart : addToEnd;
				return {
					pages: addTo(data.pages, page, maxPages),
					pageParams: addTo(data.pageParams, param, maxPages)
				};
			};
			if (direction && oldPages.length) {
				const previous = direction === "backward";
				const pageParamFn = previous ? getPreviousPageParam : getNextPageParam;
				const oldData = {
					pages: oldPages,
					pageParams: oldPageParams
				};
				result = await fetchPage(oldData, pageParamFn(options, oldData), previous);
			} else {
				const remainingPages = pages ?? oldPages.length;
				do {
					const param = currentPage === 0 ? oldPageParams[0] ?? options.initialPageParam : getNextPageParam(options, result);
					if (currentPage > 0 && param == null) break;
					result = await fetchPage(result, param);
					currentPage++;
				} while (currentPage < remainingPages);
			}
			return result;
		};
		if (context.options.persister) context.fetchFn = () => {
			return context.options.persister?.(fetchFn, {
				client: context.client,
				queryKey: context.queryKey,
				meta: context.options.meta,
				signal: context.signal
			}, query);
		};
		else context.fetchFn = fetchFn;
	} };
}
function getNextPageParam(options, { pages, pageParams }) {
	const lastIndex = pages.length - 1;
	return pages.length > 0 ? options.getNextPageParam(pages[lastIndex], pages, pageParams[lastIndex], pageParams) : void 0;
}
function getPreviousPageParam(options, { pages, pageParams }) {
	return pages.length > 0 ? options.getPreviousPageParam?.(pages[0], pages, pageParams[0], pageParams) : void 0;
}
/**
* Checks if there is a next page.
*/
function hasNextPage(options, data) {
	if (!data) return false;
	return getNextPageParam(options, data) != null;
}
/**
* Checks if there is a previous page.
*/
function hasPreviousPage(options, data) {
	if (!data || !options.getPreviousPageParam) return false;
	return getPreviousPageParam(options, data) != null;
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/query.js
/**
* Represents a single cached query. A `Query` holds the query's key, options,
* state (data/error/status), and the observers currently subscribed to it.
*
* Instances are created and managed internally by `QueryCache`; application
* code typically interacts with queries indirectly through `QueryClient` or
* a framework hook like `useQuery`. Direct access to a `Query` instance is
* possible via `queryCache.find()`/`findAll()` for inspecting cache state.
*
* @example
* ```ts
* const queryCache = queryClient.getQueryCache()
* const query = queryCache.find({ queryKey: ['posts'] })
*
* if (query) {
*   console.log(query.state.dataUpdatedAt)
* }
* ```
*/
var Query = class extends Removable {
	#queryType;
	#initialState;
	#revertState;
	#cache;
	#client;
	#retryer;
	#defaultOptions;
	#abortSignalConsumed;
	constructor(config) {
		super();
		this.#abortSignalConsumed = false;
		this.#defaultOptions = config.defaultOptions;
		this.setOptions(config.options);
		this.observers = [];
		this.#client = config.client;
		this.#cache = this.#client.getQueryCache();
		this.queryKey = config.queryKey;
		this.queryHash = config.queryHash;
		this.#initialState = getDefaultState$1(this.options);
		this.state = config.state ?? this.#initialState;
		this.scheduleGc();
	}
	/**
	* The `meta` object passed in the query's options, if any.
	*/
	get meta() {
		return this.options.meta;
	}
	/** @internal */
	get queryType() {
		return this.#queryType;
	}
	/**
	* The promise for the currently in-flight fetch, if the query is fetching.
	* `undefined` when the query is not fetching.
	*/
	get promise() {
		return this.#retryer?.promise;
	}
	/** @internal */
	setOptions(options) {
		this.options = {
			...this.#defaultOptions,
			...options
		};
		if (options?._type) this.#queryType = options._type;
		this.updateGcTime(this.options.gcTime);
		if (this.state && this.state.data === void 0) {
			const defaultState = getDefaultState$1(this.options);
			if (defaultState.data !== void 0) {
				this.setState(successState(defaultState.data, defaultState.dataUpdatedAt));
				this.#initialState = defaultState;
			}
		}
	}
	optionalRemove() {
		if (!this.observers.length && this.state.fetchStatus === "idle") this.#cache.remove(this);
	}
	/** @internal */
	setData(newData, options) {
		const data = replaceData(this.state.data, newData, this.options);
		this.#dispatch({
			data,
			type: "success",
			dataUpdatedAt: options?.updatedAt,
			manual: options?.manual
		});
		return data;
	}
	/**
	* Merges the given partial state directly into this query's state, notifying observers. Used
	* by persistence and broadcast plugins to restore a state snapshot, and by devtools to let a
	* user manually trigger a loading/error state or edit the cached data.
	*/
	setState(state) {
		this.#dispatch({
			type: "setState",
			state
		});
	}
	/**
	* Cancels the query's currently in-flight fetch, if any.
	* - Returns a promise that resolves once the cancellation has settled.
	* - If no fetch is in progress, resolves immediately.
	*
	* @example
	* ```ts
	* await query.cancel()
	* ```
	*/
	cancel(options) {
		const promise = this.#retryer?.promise;
		this.#retryer?.cancel(options);
		return promise ? promise.then(noop).catch(noop) : Promise.resolve();
	}
	/**
	* Clears the query's garbage collection timeout and silently cancels any
	* in-flight fetch. Called by `QueryCache` when the query is removed from
	* the cache.
	*
	* @see {@link Query#cancel}
	*/
	destroy() {
		super.destroy();
		this.cancel({ silent: true });
	}
	/** @internal */
	get resetState() {
		return this.#initialState;
	}
	/**
	* Resets the query back to its initial state (the state it had when it was
	* first created, e.g. any `initialData`), destroying it first to cancel any
	* in-flight fetch.
	*/
	reset() {
		this.destroy();
		this.setState(this.resetState);
	}
	/**
	* Returns `true` if the query has at least one observer for which `enabled`
	* does not resolve to `false`.
	*/
	isActive() {
		return this.observers.some((observer) => resolveQueryValue(observer.options.enabled, this) !== false);
	}
	/**
	* Returns `true` if the query is disabled, meaning it will not fetch
	* automatically.
	* - If the query has observers, it is disabled when none of them are active
	*   (see `isActive`).
	* - If the query has no observers, it is disabled when its `queryFn` is
	*   `skipToken` or it has never been fetched.
	*/
	isDisabled() {
		if (this.getObserversCount() > 0) return !this.isActive();
		return this.options.queryFn === skipToken || !this.isFetched();
	}
	/**
	* Returns `true` if the query has been fetched, i.e. it has resolved with
	* either data or an error at least once.
	*/
	isFetched() {
		return this.state.dataUpdateCount + this.state.errorUpdateCount > 0;
	}
	/**
	* Returns `true` if the query has at least one observer configured with
	* `staleTime: 'static'`, meaning it is treated as never stale.
	*/
	isStatic() {
		if (this.getObserversCount() > 0) return this.observers.some((observer) => resolveQueryValue(observer.options.staleTime, this) === "static");
		return false;
	}
	/**
	* Returns `true` if the query is stale.
	* - If the query has observers, defers to whether any observer's current
	*   result reports `isStale` (which accounts for each observer's own
	*   `staleTime` and `enabled` state).
	* - If the query has no observers, it is considered stale when it has no
	*   data or has been invalidated.
	*
	* @see {@link Query#isStaleByTime}
	* @example
	* ```ts
	* if (query.isStale()) {
	*   // refetch or otherwise treat the cached data as outdated
	* }
	* ```
	*/
	isStale() {
		if (this.getObserversCount() > 0) return this.observers.some((observer) => observer.getCurrentResult().isStale);
		return this.state.data === void 0 || this.state.isInvalidated;
	}
	/**
	* Returns `true` if the query's data is stale relative to the given
	* `staleTime` (defaults to `0`).
	* - A query with no data is always stale.
	* - `staleTime: 'static'` is never stale.
	* - An invalidated query is always stale.
	* - Otherwise, staleness is based on elapsed time since `dataUpdatedAt`.
	*
	* @see {@link Query#isStale}
	* @example
	* ```ts
	* const isStale = query.isStaleByTime(1000 * 60)
	* ```
	*/
	isStaleByTime(staleTime = 0) {
		if (this.state.data === void 0) return true;
		if (staleTime === "static") return false;
		if (this.state.isInvalidated) return true;
		return !timeUntilStale(this.state.dataUpdatedAt, staleTime);
	}
	/** @internal */
	onFocus() {
		this.observers.find((x) => x.shouldFetchOnWindowFocus())?.refetch({ cancelRefetch: false });
		this.#retryer?.continue();
	}
	/** @internal */
	onOnline() {
		this.observers.find((x) => x.shouldFetchOnReconnect())?.refetch({ cancelRefetch: false });
		this.#retryer?.continue();
	}
	/** @internal */
	addObserver(observer) {
		if (!this.observers.includes(observer)) {
			this.observers.push(observer);
			this.clearGcTimeout();
			this.#cache.notify({
				type: "observerAdded",
				query: this,
				observer
			});
		}
	}
	/** @internal */
	removeObserver(observer) {
		const index = this.observers.indexOf(observer);
		if (index !== -1) {
			this.observers.splice(index, 1);
			if (!this.observers.length) {
				if (this.#retryer) {
					if (this.#abortSignalConsumed || this.state.fetchStatus === "paused" && this.state.status === "pending") this.#retryer.cancel({ revert: true });
					else this.#retryer.cancelRetry();
				}
				this.scheduleGc();
			}
			this.#cache.notify({
				type: "observerRemoved",
				query: this,
				observer
			});
		}
	}
	/**
	* Returns the number of observers currently subscribed to this query.
	*
	* @example
	* ```ts
	* if (query.getObserversCount() === 0) {
	*   // no component is currently watching this query
	* }
	* ```
	*/
	getObserversCount() {
		return this.observers.length;
	}
	/**
	* Marks the query as invalidated, unless it is already invalidated. This
	* updates `state.isInvalidated` and notifies observers, but does not by
	* itself trigger a refetch.
	*
	* @example
	* ```ts
	* query.invalidate()
	* ```
	*/
	invalidate() {
		if (!this.state.isInvalidated) this.#dispatch({ type: "invalidate" });
	}
	/**
	* Fetches the query, i.e. runs its `queryFn` (through any configured
	* retryer/behavior) and updates the query's state with the result.
	* - If a fetch is already in flight, returns its promise instead of
	*   starting a new one, unless `fetchOptions.cancelRefetch` is set and the
	*   query already has data, in which case the current fetch is silently
	*   cancelled first.
	* - If `options` is passed, it replaces the query's current options
	*   before fetching.
	*/
	async fetch(options, fetchOptions) {
		if (this.state.fetchStatus !== "idle" && this.#retryer?.status() !== "rejected") {
			if (this.state.data !== void 0 && fetchOptions?.cancelRefetch) this.cancel({ silent: true });
			else if (this.#retryer) {
				this.#retryer.continueRetry();
				return this.#retryer.promise;
			}
		}
		if (options) this.setOptions(options);
		if (!this.options.queryFn) {
			const observer = this.observers.find((x) => x.options.queryFn);
			if (observer) this.setOptions(observer.options);
		}
		if (!Array.isArray(this.options.queryKey)) console.error(`As of v4, queryKey needs to be an Array. If you are using a string like 'repoData', please change it to an Array, e.g. ['repoData']`);
		const abortController = new AbortController();
		const addSignalProperty = (object) => {
			Object.defineProperty(object, "signal", {
				enumerable: true,
				get: () => {
					this.#abortSignalConsumed = true;
					return abortController.signal;
				}
			});
		};
		const fetchFn = () => {
			const queryFn = ensureQueryFn(this.options, fetchOptions);
			const createQueryFnContext = () => {
				const queryFnContext = {
					client: this.#client,
					queryKey: this.queryKey,
					meta: this.meta
				};
				addSignalProperty(queryFnContext);
				return queryFnContext;
			};
			const queryFnContext = createQueryFnContext();
			this.#abortSignalConsumed = false;
			if (this.options.persister) return this.options.persister(queryFn, queryFnContext, this);
			return queryFn(queryFnContext);
		};
		const createFetchContext = () => {
			const context = {
				fetchOptions,
				options: this.options,
				queryKey: this.queryKey,
				client: this.#client,
				state: this.state,
				fetchFn
			};
			addSignalProperty(context);
			return context;
		};
		const context = createFetchContext();
		(this.#queryType === "infinite" ? infiniteQueryBehavior(this.options.pages) : this.options.behavior)?.onFetch(context, this);
		this.#revertState = this.state;
		if (this.state.fetchStatus === "idle" || this.state.fetchMeta !== context.fetchOptions?.meta) this.#dispatch({
			type: "fetch",
			meta: context.fetchOptions?.meta
		});
		const retryer = this.#retryer = createRetryer({
			initialPromise: fetchOptions?.initialPromise,
			fn: context.fetchFn,
			onCancel: (error) => {
				if (error instanceof CancelledError && error.revert) this.setState({
					...this.#revertState,
					fetchStatus: "idle"
				});
				abortController.abort();
			},
			onFail: (failureCount, error) => {
				this.#dispatch({
					type: "failed",
					failureCount,
					error
				});
			},
			onPause: () => {
				this.#dispatch({ type: "pause" });
			},
			onContinue: () => {
				this.#dispatch({ type: "continue" });
			},
			retry: context.options.retry,
			retryDelay: context.options.retryDelay,
			networkMode: context.options.networkMode,
			canRun: () => true
		});
		try {
			const data = await retryer.start();
			if (data === void 0) {
				console.error(`Query data cannot be undefined. Please make sure to return a value other than undefined from your query function. Affected query key: ${this.queryHash}`);
				throw new Error(`${this.queryHash} data is undefined`);
			}
			this.setData(data);
			this.#cache.config.onSuccess?.(data, this);
			this.#cache.config.onSettled?.(data, this.state.error, this);
			return data;
		} catch (error) {
			if (error instanceof CancelledError) {
				if (error.silent) return this.#retryer.promise;
				else if (error.revert) {
					if (this.state.data === void 0) throw error;
					return this.state.data;
				}
			}
			this.#dispatch({
				type: "error",
				error
			});
			this.#cache.config.onError?.(error, this);
			this.#cache.config.onSettled?.(this.state.data, error, this);
			throw error;
		} finally {
			if (this.#retryer === retryer) this.#retryer = void 0;
			this.scheduleGc();
		}
	}
	#dispatch(action) {
		const reducer = (state) => {
			switch (action.type) {
				case "failed": return {
					...state,
					fetchFailureCount: action.failureCount,
					fetchFailureReason: action.error
				};
				case "pause": return {
					...state,
					fetchStatus: "paused"
				};
				case "continue": return {
					...state,
					fetchStatus: "fetching"
				};
				case "fetch": return {
					...state,
					...fetchState(state.data, this.options),
					fetchMeta: action.meta ?? null
				};
				case "success":
					const newState = {
						...state,
						...successState(action.data, action.dataUpdatedAt),
						dataUpdateCount: state.dataUpdateCount + 1,
						...!action.manual && {
							fetchStatus: "idle",
							fetchFailureCount: 0,
							fetchFailureReason: null
						}
					};
					this.#revertState = action.manual ? newState : void 0;
					return newState;
				case "error":
					const error = action.error;
					return {
						...state,
						error,
						errorUpdateCount: state.errorUpdateCount + 1,
						errorUpdatedAt: Date.now(),
						fetchFailureCount: state.fetchFailureCount + 1,
						fetchFailureReason: error,
						fetchStatus: "idle",
						status: "error",
						isInvalidated: true
					};
				case "invalidate": return {
					...state,
					isInvalidated: true
				};
				case "setState": return {
					...state,
					...action.state
				};
			}
		};
		this.state = reducer(this.state);
		notifyManager.batch(() => {
			this.observers.slice().forEach((observer) => {
				observer.onQueryUpdate();
			});
			this.#cache.notify({
				query: this,
				type: "updated",
				action
			});
		});
	}
};
function fetchState(data, options) {
	return {
		fetchFailureCount: 0,
		fetchFailureReason: null,
		fetchStatus: canFetch(options.networkMode) ? "fetching" : "paused",
		...data === void 0 && {
			error: null,
			status: "pending"
		}
	};
}
function successState(data, dataUpdatedAt) {
	return {
		data,
		dataUpdatedAt: dataUpdatedAt ?? Date.now(),
		error: null,
		isInvalidated: false,
		status: "success"
	};
}
function getDefaultState$1(options) {
	const data = typeof options.initialData === "function" ? options.initialData() : options.initialData;
	const hasData = data !== void 0;
	const initialDataUpdatedAt = hasData ? typeof options.initialDataUpdatedAt === "function" ? options.initialDataUpdatedAt() : options.initialDataUpdatedAt : 0;
	return {
		data,
		dataUpdateCount: 0,
		dataUpdatedAt: hasData ? initialDataUpdatedAt ?? Date.now() : 0,
		error: null,
		errorUpdateCount: 0,
		errorUpdatedAt: 0,
		fetchFailureCount: 0,
		fetchFailureReason: null,
		fetchMeta: null,
		isInvalidated: false,
		status: hasData ? "success" : "pending",
		fetchStatus: "idle"
	};
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/queryObserver.js
/**
* A `QueryObserver` watches a single query in the `QueryCache` and computes a
* `QueryObserverResult` from its state, recomputing and notifying subscribers
* whenever the underlying query (or the observer's options) changes. It is
* the primitive that framework adapters (e.g. `useQuery`) build their hooks
* on top of, but it can also be used directly to observe and switch between
* queries outside of any framework.
*
* @example
* ```ts
* const observer = new QueryObserver(queryClient, {
*   queryKey: ['posts'],
*   queryFn: fetchPosts,
* })
*
* const unsubscribe = observer.subscribe((result) => {
*   console.log(result.data)
* })
* ```
*/
var QueryObserver = class extends Subscribable {
	#client;
	#currentQuery = void 0;
	#currentQueryInitialState = void 0;
	#currentResult = void 0;
	#currentResultState;
	#currentResultOptions;
	#selectError;
	#selectFn;
	#selectResult;
	#lastQueryWithDefinedData;
	#staleTimeoutId;
	#refetchIntervalId;
	#currentRefetchInterval;
	#trackedProps = /* @__PURE__ */ new Set();
	constructor(client, options) {
		super();
		this.options = options;
		this.#client = client;
		this.#selectError = null;
		this.bindMethods();
		this.setOptions(options);
	}
	bindMethods() {
		this.refetch = this.refetch.bind(this);
	}
	onSubscribe() {
		if (this.listeners.size === 1) {
			this.#currentQuery.addObserver(this);
			if (shouldFetchOnMount(this.#currentQuery, this.options)) this.#executeFetch();
			else this.updateResult();
			this.#updateTimers();
		}
	}
	onUnsubscribe() {
		if (!this.hasListeners()) this.destroy();
	}
	/**
	* Returns whether the observed query is currently stale and configured
	* (via the `refetchOnReconnect` option) to refetch when the network
	* reconnects.
	*/
	shouldFetchOnReconnect() {
		return shouldFetchOn(this.#currentQuery, this.options, this.options.refetchOnReconnect);
	}
	/**
	* Returns whether the observed query is currently stale and configured
	* (via the `refetchOnWindowFocus` option) to refetch when the window
	* regains focus.
	*/
	shouldFetchOnWindowFocus() {
		return shouldFetchOn(this.#currentQuery, this.options, this.options.refetchOnWindowFocus);
	}
	/**
	* Stops observing the current query: clears all listeners, cancels the
	* stale and refetch-interval timers, and removes this observer from the
	* query it was observing.
	*/
	destroy() {
		this.listeners = /* @__PURE__ */ new Set();
		this.#clearStaleTimeout();
		this.#clearRefetchInterval();
		this.#currentQuery.removeObserver(this);
	}
	/**
	* Updates the observer's options. This will re-resolve the query being
	* observed (switching to a different query if the `queryKey` changed),
	* trigger a fetch if the new options require one and the observer has
	* subscribers, recompute the current result, and reschedule the stale and
	* refetch-interval timers as needed.
	*
	* @example
	* ```ts
	* observer.setOptions({ queryKey: ['posts', 1], queryFn: () => fetchPost(1) })
	* // later: switch to a different query, reusing the same observer
	* observer.setOptions({ queryKey: ['posts', 2], queryFn: () => fetchPost(2) })
	* ```
	*/
	setOptions(options) {
		const prevOptions = this.options;
		const prevQuery = this.#currentQuery;
		this.options = this.#client.defaultQueryOptions(options);
		if (this.options.enabled !== void 0 && typeof this.options.enabled !== "boolean" && typeof this.options.enabled !== "function" && typeof resolveQueryValue(this.options.enabled, this.#currentQuery) !== "boolean") throw new Error("Expected enabled to be a boolean or a callback that returns a boolean");
		this.#updateQuery();
		this.#currentQuery.setOptions(this.options);
		if (prevOptions._defaulted && !shallowEqualObjects(this.options, prevOptions)) this.#client.getQueryCache().notify({
			type: "observerOptionsUpdated",
			query: this.#currentQuery,
			observer: this
		});
		const mounted = this.hasListeners();
		if (mounted && shouldFetchOptionally(this.#currentQuery, prevQuery, this.options, prevOptions)) this.#executeFetch();
		this.updateResult();
		if (mounted && (this.#currentQuery !== prevQuery || resolveQueryValue(this.options.enabled, this.#currentQuery) !== resolveQueryValue(prevOptions.enabled, this.#currentQuery) || resolveQueryValue(this.options.staleTime, this.#currentQuery) !== resolveQueryValue(prevOptions.staleTime, this.#currentQuery))) this.#updateStaleTimeout();
		const nextRefetchInterval = this.#computeRefetchInterval();
		if (mounted && (this.#currentQuery !== prevQuery || resolveQueryValue(this.options.enabled, this.#currentQuery) !== resolveQueryValue(prevOptions.enabled, this.#currentQuery) || nextRefetchInterval !== this.#currentRefetchInterval)) this.#updateRefetchInterval(nextRefetchInterval);
	}
	/**
	* Computes the result the observer would produce for the given (already-defaulted) options
	* right now, building the underlying `Query` if it doesn't exist yet, without waiting for a
	* subscription callback. Called by framework adapters on every render (e.g. `useQuery`) so the
	* returned value is available synchronously, ahead of `setOptions` triggering an actual fetch.
	*/
	getOptimisticResult(options) {
		const query = this.#client.getQueryCache().build(this.#client, options);
		const result = this.createResult(query, options);
		if (!shallowEqualObjects(this.getCurrentResult(), result)) {
			this.#currentResult = result;
			this.#currentResultOptions = this.options;
			this.#currentResultState = this.#currentQuery.state;
		}
		return result;
	}
	/**
	* Returns the most recently computed `QueryObserverResult` for the
	* observed query. This is a point-in-time read; to be notified of updates
	* as they happen, subscribe to the observer instead (its inherited
	* `subscribe` method).
	*
	* @example
	* ```ts
	* const result = observer.getCurrentResult()
	* console.log(result.status, result.data)
	* ```
	*/
	getCurrentResult() {
		return this.#currentResult;
	}
	/**
	* Wraps a `QueryObserverResult` in a `Proxy` that records which properties are read, via
	* {@link QueryObserver#trackProp} (and an optional `onPropTracked` callback). Used by framework
	* adapters when `notifyOnChangeProps` is not set, to implement its default "only re-render on
	* properties you actually read" behavior.
	*/
	trackResult(result, onPropTracked) {
		return new Proxy(result, { get: (target, key) => {
			this.trackProp(key);
			onPropTracked?.(key);
			return Reflect.get(target, key);
		} });
	}
	/**
	* Records that the given `QueryObserverResult` property was read, so a subsequent update only
	* notifies this observer if a tracked property actually changed. Normally called indirectly via
	* {@link QueryObserver#trackResult}'s proxy; exposed directly for adapters that track property
	* access themselves (e.g. through their own reactivity system) instead of via the proxy.
	*/
	trackProp(key) {
		this.#trackedProps.add(key);
	}
	/**
	* Returns the `Query` instance this observer is currently observing.
	*/
	getCurrentQuery() {
		return this.#currentQuery;
	}
	/**
	* Refetches the observed query and returns a promise that resolves with
	* the resulting `QueryObserverResult`.
	*
	* @example
	* ```ts
	* const result = await observer.refetch({ cancelRefetch: false })
	* console.log(result.data)
	* ```
	*/
	refetch({ ...options } = {}) {
		return this.fetch({ ...options });
	}
	/**
	* Fetches a query defined by the given options without affecting this
	* observer's own tracked query or result, and returns a promise that
	* resolves with the `QueryObserverResult` for that fetch. This is useful
	* for prefetching data that another observer (e.g. a query about to be
	* navigated to) will need, ahead of time.
	*
	* @example
	* ```ts
	* const result = await observer.fetchOptimistic({
	*   queryKey: ['posts', 2],
	*   queryFn: () => fetchPost(2),
	* })
	* console.log(result.data)
	* ```
	*/
	fetchOptimistic(options) {
		const defaultedOptions = this.#client.defaultQueryOptions(options);
		const query = this.#client.getQueryCache().build(this.#client, defaultedOptions);
		let unsubscribe = () => {};
		let resolveEarly;
		const cachePromise = new Promise((resolve) => {
			resolveEarly = resolve;
			unsubscribe = this.#client.getQueryCache().subscribe((event) => {
				if (event.type === "updated" && event.query.queryHash === query.queryHash && query.state.data !== void 0) {
					unsubscribe();
					resolve(this.createResult(query, defaultedOptions));
				}
			});
		});
		return Promise.race([query.fetch().then(() => {
			const result = this.createResult(query, defaultedOptions);
			resolveEarly?.(result);
			return result;
		}).finally(() => {
			unsubscribe();
		}), cachePromise]);
	}
	fetch(fetchOptions) {
		return this.#executeFetch({
			...fetchOptions,
			cancelRefetch: fetchOptions.cancelRefetch ?? true
		}).then(() => {
			this.updateResult();
			return this.#currentResult;
		});
	}
	#executeFetch(fetchOptions) {
		this.#updateQuery();
		let promise = this.#currentQuery.fetch(this.options, fetchOptions);
		if (!fetchOptions?.throwOnError) promise = promise.catch(noop);
		return promise;
	}
	#shouldScheduleTimer(timeout) {
		return !isServer$1() && resolveQueryValue(this.options.enabled, this.#currentQuery) !== false && isValidTimeout(timeout);
	}
	#updateStaleTimeout() {
		this.#clearStaleTimeout();
		const staleTime = resolveQueryValue(this.options.staleTime, this.#currentQuery);
		if (this.#currentResult.isStale || !this.#shouldScheduleTimer(staleTime)) return;
		const timeout = timeUntilStale(this.#currentResult.dataUpdatedAt, staleTime) + 1;
		this.#staleTimeoutId = timeoutManager.setTimeout(() => {
			if (!this.#currentResult.isStale) this.updateResult();
		}, timeout);
	}
	#computeRefetchInterval() {
		return resolveQueryValue(this.options.refetchInterval, this.#currentQuery) ?? false;
	}
	#updateRefetchInterval(nextInterval) {
		this.#clearRefetchInterval();
		this.#currentRefetchInterval = nextInterval;
		if (this.#currentRefetchInterval === 0 || !this.#shouldScheduleTimer(this.#currentRefetchInterval)) return;
		this.#refetchIntervalId = timeoutManager.setInterval(() => {
			if (this.options.refetchIntervalInBackground || focusManager.isFocused()) this.#executeFetch();
		}, this.#currentRefetchInterval);
	}
	#updateTimers() {
		this.#updateStaleTimeout();
		this.#updateRefetchInterval(this.#computeRefetchInterval());
	}
	#clearStaleTimeout() {
		if (this.#staleTimeoutId !== void 0) {
			timeoutManager.clearTimeout(this.#staleTimeoutId);
			this.#staleTimeoutId = void 0;
		}
	}
	#clearRefetchInterval() {
		if (this.#refetchIntervalId !== void 0) {
			timeoutManager.clearInterval(this.#refetchIntervalId);
			this.#refetchIntervalId = void 0;
		}
	}
	createResult(query, options) {
		const prevQuery = this.#currentQuery;
		const prevOptions = this.options;
		const prevResult = this.#currentResult;
		const prevResultState = this.#currentResultState;
		const prevResultOptions = this.#currentResultOptions;
		const queryInitialState = query !== prevQuery ? query.state : this.#currentQueryInitialState;
		const { state } = query;
		let newState = { ...state };
		let isPlaceholderData = false;
		let data;
		if (options._optimisticResults) {
			const mounted = this.hasListeners();
			const fetchOnMount = !mounted && shouldFetchOnMount(query, options);
			const fetchOptionally = mounted && shouldFetchOptionally(query, prevQuery, options, prevOptions);
			if (fetchOnMount || fetchOptionally) newState = {
				...newState,
				...fetchState(state.data, query.options)
			};
			if (options._optimisticResults === "isRestoring") newState.fetchStatus = "idle";
		}
		let { error, errorUpdatedAt, status } = newState;
		data = newState.data;
		let skipSelect = false;
		if (options.placeholderData !== void 0 && data === void 0 && status === "pending") {
			let placeholderData;
			if (prevResult?.isPlaceholderData && options.placeholderData === prevResultOptions?.placeholderData) {
				placeholderData = prevResult.data;
				skipSelect = true;
			} else placeholderData = typeof options.placeholderData === "function" ? options.placeholderData(this.#lastQueryWithDefinedData?.state.data, this.#lastQueryWithDefinedData) : options.placeholderData;
			if (placeholderData !== void 0) {
				status = "success";
				data = replaceData(prevResult?.data, placeholderData, options);
				isPlaceholderData = true;
			}
		}
		if (options.select && data !== void 0 && !skipSelect) {
			if (prevResult && data === prevResultState?.data && options.select === this.#selectFn) data = this.#selectResult;
			else try {
				this.#selectFn = options.select;
				data = options.select(data);
				data = replaceData(prevResult?.data, data, options);
				this.#selectResult = data;
				this.#selectError = null;
			} catch (selectError) {
				this.#selectError = selectError;
			}
		} else if (data === void 0) this.#selectError = null;
		if (this.#selectError) {
			error = this.#selectError;
			data = this.#selectResult;
			errorUpdatedAt = Date.now();
			status = "error";
			isPlaceholderData = false;
		}
		const isFetching = newState.fetchStatus === "fetching";
		const isPending = status === "pending";
		const isError = status === "error";
		const isLoading = isPending && isFetching;
		const hasData = data !== void 0;
		return {
			status,
			fetchStatus: newState.fetchStatus,
			isPending,
			isSuccess: status === "success",
			isError,
			isInitialLoading: isLoading,
			isLoading,
			data,
			dataUpdatedAt: newState.dataUpdatedAt,
			error,
			errorUpdatedAt,
			failureCount: newState.fetchFailureCount,
			failureReason: newState.fetchFailureReason,
			errorUpdateCount: newState.errorUpdateCount,
			isFetched: query.isFetched(),
			isFetchedAfterMount: newState.dataUpdateCount > queryInitialState.dataUpdateCount || newState.errorUpdateCount > queryInitialState.errorUpdateCount,
			isFetching,
			isRefetching: isFetching && !isPending,
			isLoadingError: isError && !hasData,
			isPaused: newState.fetchStatus === "paused",
			isPlaceholderData,
			isRefetchError: isError && hasData,
			isStale: isStale(query, options),
			refetch: this.refetch,
			isEnabled: resolveQueryValue(options.enabled, query) !== false
		};
	}
	/**
	* Recomputes and stores the current result from the current query/options, notifying listeners
	* if it changed. Framework adapters call this right after subscribing to make sure no query
	* update was missed in the gap between creating the observer and subscribing to it.
	*/
	updateResult() {
		const prevResult = this.#currentResult;
		const nextResult = this.createResult(this.#currentQuery, this.options);
		this.#currentResultState = this.#currentQuery.state;
		this.#currentResultOptions = this.options;
		if (this.#currentResultState.data !== void 0) this.#lastQueryWithDefinedData = this.#currentQuery;
		if (shallowEqualObjects(nextResult, prevResult)) return;
		this.#currentResult = nextResult;
		const shouldNotifyListeners = () => {
			if (!prevResult) return true;
			const { notifyOnChangeProps } = this.options;
			const notifyOnChangePropsValue = typeof notifyOnChangeProps === "function" ? notifyOnChangeProps() : notifyOnChangeProps;
			if (notifyOnChangePropsValue === "all" || !notifyOnChangePropsValue && !this.#trackedProps.size) return true;
			const includedProps = new Set(notifyOnChangePropsValue ?? this.#trackedProps);
			if (this.options.throwOnError) includedProps.add("error");
			return Object.keys(this.#currentResult).some((key) => {
				const typedKey = key;
				return this.#currentResult[typedKey] !== prevResult[typedKey] && includedProps.has(typedKey);
			});
		};
		const notifyListeners = shouldNotifyListeners();
		notifyManager.batch(() => {
			if (notifyListeners) this.listeners.forEach((listener) => {
				listener(this.#currentResult);
			});
			this.#client.getQueryCache().notify({
				query: this.#currentQuery,
				type: "observerResultsUpdated"
			});
		});
	}
	#updateQuery() {
		const query = this.#client.getQueryCache().build(this.#client, this.options);
		if (query === this.#currentQuery) return;
		const prevQuery = this.#currentQuery;
		this.#currentQuery = query;
		this.#currentQueryInitialState = query.state;
		if (this.hasListeners()) {
			prevQuery?.removeObserver(this);
			query.addObserver(this);
		}
	}
	/** @internal */
	onQueryUpdate() {
		this.updateResult();
		if (this.hasListeners()) this.#updateTimers();
	}
};
function shouldLoadOnMount(query, options) {
	return resolveQueryValue(options.enabled, query) !== false && query.state.data === void 0 && !(query.state.status === "error" && resolveQueryValue(options.retryOnMount, query) === false);
}
function shouldFetchOnMount(query, options) {
	return shouldLoadOnMount(query, options) || query.state.data !== void 0 && shouldFetchOn(query, options, options.refetchOnMount);
}
function shouldFetchOn(query, options, field) {
	if (resolveQueryValue(options.enabled, query) !== false && resolveQueryValue(options.staleTime, query) !== "static") {
		const value = resolveQueryValue(field, query);
		return value === "always" || value !== false && isStale(query, options);
	}
	return false;
}
function shouldFetchOptionally(query, prevQuery, options, prevOptions) {
	return (query !== prevQuery || resolveQueryValue(prevOptions.enabled, query) === false) && (!options.suspense || query.state.status !== "error") && isStale(query, options);
}
function isStale(query, options) {
	return resolveQueryValue(options.enabled, query) !== false && query.isStaleByTime(resolveQueryValue(options.staleTime, query));
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/infiniteQueryObserver.js
/**
* An `InfiniteQueryObserver` extends `QueryObserver` to observe and switch
* between infinite queries. It augments the base `QueryObserverResult` with
* infinite-query-specific fields and methods, such as `hasNextPage` and
* `fetchNextPage`, and is the primitive that framework adapters (e.g.
* `useInfiniteQuery`) build their hooks on top of.
*
* @example
* ```ts
* const observer = new InfiniteQueryObserver(queryClient, {
*   queryKey: ['projects'],
*   queryFn: ({ pageParam }) => fetchProjects(pageParam),
*   initialPageParam: 0,
*   getNextPageParam: (lastPage) => lastPage.nextCursor,
* })
*
* const unsubscribe = observer.subscribe((result) => console.log(result))
* ```
*/
var InfiniteQueryObserver = class extends QueryObserver {
	constructor(client, options) {
		super(client, options);
	}
	bindMethods() {
		super.bindMethods();
		this.fetchNextPage = this.fetchNextPage.bind(this);
		this.fetchPreviousPage = this.fetchPreviousPage.bind(this);
	}
	/**
	* Updates the observer's options. Behaves the same as
	* `QueryObserver.setOptions`, additionally marking the options as
	* belonging to an infinite query before delegating to the base
	* implementation.
	*/
	setOptions(options) {
		options._type = "infinite";
		super.setOptions(options);
	}
	/**
	* The infinite-query counterpart of {@link QueryObserver#getOptimisticResult}, marking the
	* options as an infinite query before delegating to it. Called by framework adapters (e.g.
	* `useInfiniteQuery`) ahead of subscribing, to compute the current `InfiniteQueryObserverResult`
	* synchronously.
	*/
	getOptimisticResult(options) {
		options._type = "infinite";
		return super.getOptimisticResult(options);
	}
	/**
	* Fetches the next page of the infinite query and returns a promise that
	* resolves with the resulting `InfiniteQueryObserverResult`. The page
	* param used for the fetch is determined by `getNextPageParam`, which
	* receives the current pages/page params and whose result also determines
	* `hasNextPage`.
	*
	* @example
	* ```ts
	* const { hasNextPage } = observer.getCurrentResult()
	*
	* if (hasNextPage) {
	*   await observer.fetchNextPage()
	* }
	* ```
	*
	* @see {@link InfiniteQueryObserver#fetchPreviousPage}
	*/
	fetchNextPage(options) {
		return this.fetch({
			...options,
			meta: { fetchMore: { direction: "forward" } }
		});
	}
	/**
	* Fetches the previous page of the infinite query and returns a promise
	* that resolves with the resulting `InfiniteQueryObserverResult`. The page
	* param used for the fetch is determined by `getPreviousPageParam`, which
	* receives the current pages/page params and whose result also determines
	* `hasPreviousPage`.
	*
	* @example
	* ```ts
	* const { hasPreviousPage } = observer.getCurrentResult()
	*
	* if (hasPreviousPage) {
	*   await observer.fetchPreviousPage()
	* }
	* ```
	*
	* @see {@link InfiniteQueryObserver#fetchNextPage}
	*/
	fetchPreviousPage(options) {
		return this.fetch({
			...options,
			meta: { fetchMore: { direction: "backward" } }
		});
	}
	createResult(query, options) {
		const { state } = query;
		const parentResult = super.createResult(query, options);
		const { isFetching, isRefetching, isError, isRefetchError } = parentResult;
		const fetchDirection = state.fetchMeta?.fetchMore?.direction;
		const isFetchNextPageError = isError && fetchDirection === "forward";
		const isFetchingNextPage = isFetching && fetchDirection === "forward";
		const isFetchPreviousPageError = isError && fetchDirection === "backward";
		const isFetchingPreviousPage = isFetching && fetchDirection === "backward";
		return {
			...parentResult,
			fetchNextPage: this.fetchNextPage,
			fetchPreviousPage: this.fetchPreviousPage,
			hasNextPage: hasNextPage(options, state.data),
			hasPreviousPage: hasPreviousPage(options, state.data),
			isFetchNextPageError,
			isFetchingNextPage,
			isFetchPreviousPageError,
			isFetchingPreviousPage,
			isRefetchError: isRefetchError && !isFetchNextPageError && !isFetchPreviousPageError,
			isRefetching: isRefetching && !isFetchingNextPage && !isFetchingPreviousPage
		};
	}
};
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/mutation.js
/**
* Represents a single mutation attempt. A `Mutation` holds the mutation's
* options, state (data/error/status), and the `MutationObserver`s currently
* subscribed to it.
*
* Instances are created and managed internally by `MutationCache`; application
* code typically interacts with mutations indirectly through `QueryClient` or
* a framework hook like `useMutation`. Direct access to a `Mutation` instance
* is possible via `mutationCache.find()`/`getAll()` for inspecting cache state.
*
* @example
* ```ts
* const mutationCache = queryClient.getMutationCache()
*
* const mutation = mutationCache.find({ mutationKey: ['addPost'] })
* ```
*/
var Mutation = class extends Removable {
	#client;
	#observers;
	#mutationCache;
	#retryer;
	constructor(config) {
		super();
		this.#client = config.client;
		this.mutationId = config.mutationId;
		this.#mutationCache = config.mutationCache;
		this.#observers = [];
		this.state = config.state || getDefaultState();
		this.setOptions(config.options);
		this.scheduleGc();
	}
	/** @internal */
	setOptions(options) {
		this.options = options;
		this.updateGcTime(this.options.gcTime);
	}
	/**
	* The `meta` object passed in the mutation's options, if any.
	*/
	get meta() {
		return this.options.meta;
	}
	/** @internal */
	addObserver(observer) {
		if (!this.#observers.includes(observer)) {
			this.#observers.push(observer);
			this.clearGcTimeout();
			this.#mutationCache.notify({
				type: "observerAdded",
				mutation: this,
				observer
			});
		}
	}
	/** @internal */
	removeObserver(observer) {
		this.#observers = this.#observers.filter((x) => x !== observer);
		this.scheduleGc();
		this.#mutationCache.notify({
			type: "observerRemoved",
			mutation: this,
			observer
		});
	}
	optionalRemove() {
		if (!this.#observers.length) {
			if (this.state.status === "pending") this.scheduleGc();
			else this.#mutationCache.remove(this);
		}
	}
	/**
	* Resumes a mutation that is currently paused or was restored from a
	* dehydrated, still-`pending` state.
	*
	* - If this mutation has an active retryer (it paused mid-attempt, e.g. due
	*   to the network mode or scope-based queuing), its retryer is resumed.
	* - Otherwise, if the mutation's status is still `pending` (e.g. it was
	*   dehydrated while an attempt was in flight and never got a retryer in
	*   this instance), `execute` is called again with the last known variables.
	* - Otherwise the mutation has already settled and this resolves immediately
	*   without running anything again.
	*
	* @example
	* ```ts
	* // typically driven by reconnect handling, e.g. queryClient.resumePausedMutations()
	* const mutation = mutationCache.find({ mutationKey: ['addPost'] })
	* await mutation?.continue()
	* ```
	*
	* @see {@link Mutation#execute}
	*/
	continue() {
		return this.#retryer?.continue() ?? (this.state.status === "pending" ? this.execute(this.state.variables) : Promise.resolve());
	}
	/**
	* Runs the mutation function for the given variables through a retryer, and
	* drives the mutation's state and lifecycle callbacks through to settlement.
	*
	* If this mutation's state is already `pending` when `execute` is called
	* (i.e. it was restored, still in-flight, from a dehydrated state), the
	* `onMutate` step is skipped and a `continue` action is dispatched to
	* unpause it; otherwise a `pending` action is dispatched first, then the
	* mutation cache's `onMutate` and the mutation's own `onMutate` option are
	* awaited in that order, and the resulting context is stored.
	*
	* The mutation function is then run (subject to `retry`/`retryDelay`/
	* `networkMode`, and to the mutation cache's scope-based serialization).
	* On success, the cache's `onSuccess`/`onSettled` callbacks run before the
	* mutation's own `onSuccess`/`onSettled` options, a `success` action is
	* dispatched, and the resolved data is returned. On failure, the same
	* cache-then-option ordering is used for `onError`/`onSettled`, but each of
	* those four callbacks is individually caught so that a throwing callback
	* cannot mask the original error; an `error` action is then dispatched and
	* the original error is re-thrown.
	*
	* @example
	* ```ts
	* // Called internally by `MutationObserver.mutate` and `Mutation.continue` —
	* // applications normally trigger mutations through those, not this method.
	* const data = await mutation.execute(variables)
	* ```
	*
	* @see {@link Mutation#continue}
	*/
	async execute(variables) {
		const onContinue = () => {
			this.#dispatch({ type: "continue" });
		};
		const mutationFnContext = {
			client: this.#client,
			meta: this.options.meta,
			mutationKey: this.options.mutationKey
		};
		const retryer = this.#retryer = createRetryer({
			fn: () => {
				if (!this.options.mutationFn) return Promise.reject(/* @__PURE__ */ new Error("No mutationFn found"));
				return this.options.mutationFn(variables, mutationFnContext);
			},
			onFail: (failureCount, error) => {
				this.#dispatch({
					type: "failed",
					failureCount,
					error
				});
			},
			onPause: () => {
				this.#dispatch({ type: "pause" });
			},
			onContinue,
			retry: this.options.retry ?? 0,
			retryDelay: this.options.retryDelay,
			networkMode: this.options.networkMode,
			canRun: () => this.#mutationCache.canRun(this)
		});
		const restored = this.state.status === "pending";
		const isPaused = !retryer.canStart();
		try {
			if (restored) onContinue();
			else {
				this.#dispatch({
					type: "pending",
					variables,
					isPaused
				});
				if (this.#mutationCache.config.onMutate) await this.#mutationCache.config.onMutate(variables, this, mutationFnContext);
				const context = await this.options.onMutate?.(variables, mutationFnContext);
				if (context !== this.state.context) this.#dispatch({
					type: "pending",
					context,
					variables,
					isPaused
				});
			}
			const data = await retryer.start();
			await this.#mutationCache.config.onSuccess?.(data, variables, this.state.context, this, mutationFnContext);
			await this.options.onSuccess?.(data, variables, this.state.context, mutationFnContext);
			await this.#mutationCache.config.onSettled?.(data, null, this.state.variables, this.state.context, this, mutationFnContext);
			await this.options.onSettled?.(data, null, variables, this.state.context, mutationFnContext);
			this.#dispatch({
				type: "success",
				data
			});
			return data;
		} catch (error) {
			try {
				await this.#mutationCache.config.onError?.(error, variables, this.state.context, this, mutationFnContext);
			} catch (e) {
				Promise.reject(e);
			}
			try {
				await this.options.onError?.(error, variables, this.state.context, mutationFnContext);
			} catch (e) {
				Promise.reject(e);
			}
			try {
				await this.#mutationCache.config.onSettled?.(void 0, error, this.state.variables, this.state.context, this, mutationFnContext);
			} catch (e) {
				Promise.reject(e);
			}
			try {
				await this.options.onSettled?.(void 0, error, variables, this.state.context, mutationFnContext);
			} catch (e) {
				Promise.reject(e);
			}
			this.#dispatch({
				type: "error",
				error
			});
			throw error;
		} finally {
			if (this.#retryer === retryer) this.#retryer = void 0;
			this.#mutationCache.runNext(this);
		}
	}
	#dispatch(action) {
		const reducer = (state) => {
			switch (action.type) {
				case "failed": return {
					...state,
					failureCount: action.failureCount,
					failureReason: action.error
				};
				case "pause": return {
					...state,
					isPaused: true
				};
				case "continue": return {
					...state,
					isPaused: false
				};
				case "pending": return {
					...state,
					context: action.context,
					data: void 0,
					failureCount: 0,
					failureReason: null,
					error: null,
					isPaused: action.isPaused,
					status: "pending",
					variables: action.variables,
					submittedAt: Date.now()
				};
				case "success": return {
					...state,
					data: action.data,
					failureCount: 0,
					failureReason: null,
					error: null,
					status: "success",
					isPaused: false
				};
				case "error": return {
					...state,
					data: void 0,
					error: action.error,
					failureCount: state.failureCount + 1,
					failureReason: action.error,
					isPaused: false,
					status: "error"
				};
			}
		};
		this.state = reducer(this.state);
		notifyManager.batch(() => {
			this.#observers.forEach((observer) => {
				observer.onMutationUpdate(action);
			});
			this.#mutationCache.notify({
				mutation: this,
				type: "updated",
				action
			});
		});
	}
};
function getDefaultState() {
	return {
		context: void 0,
		data: void 0,
		error: null,
		failureCount: 0,
		failureReason: null,
		isPaused: false,
		status: "idle",
		variables: void 0,
		submittedAt: 0
	};
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/mutationCache.js
/**
* The `MutationCache` is the storage for mutations.
*
* Normally, you will not interact with the `MutationCache` directly and instead use a
* `QueryClient`. You can subscribe to it (inherited from `Subscribable`) to be informed of
* safe/known updates to the cache, such as mutations being added, removed, or updated.
*
* @example
* ```ts
* const unsubscribe = mutationCache.subscribe((event) => {
*   console.log(event.type, event.mutation)
* })
* ```
*/
var MutationCache = class extends Subscribable {
	#mutations;
	#scopes;
	#mutationId;
	constructor(config = {}) {
		super();
		this.config = config;
		this.#mutations = /* @__PURE__ */ new Set();
		this.#scopes = /* @__PURE__ */ new Map();
		this.#mutationId = 0;
	}
	/** @internal */
	build(client, options, state) {
		const mutation = new Mutation({
			client,
			mutationCache: this,
			mutationId: ++this.#mutationId,
			options: client.defaultMutationOptions(options),
			state
		});
		this.add(mutation);
		return mutation;
	}
	/** @internal */
	add(mutation) {
		this.#mutations.add(mutation);
		const scope = scopeFor(mutation);
		if (typeof scope === "string") {
			const scopedMutations = this.#scopes.get(scope);
			if (scopedMutations) scopedMutations.push(mutation);
			else this.#scopes.set(scope, [mutation]);
		}
		this.notify({
			type: "added",
			mutation
		});
	}
	/** @internal */
	remove(mutation) {
		if (this.#mutations.delete(mutation)) {
			const scope = scopeFor(mutation);
			if (typeof scope === "string") {
				const scopedMutations = this.#scopes.get(scope);
				if (scopedMutations) {
					if (scopedMutations.length > 1) {
						const index = scopedMutations.indexOf(mutation);
						if (index !== -1) scopedMutations.splice(index, 1);
					} else if (scopedMutations[0] === mutation) this.#scopes.delete(scope);
				}
			}
		}
		this.notify({
			type: "removed",
			mutation
		});
	}
	/** @internal */
	canRun(mutation) {
		const scope = scopeFor(mutation);
		if (typeof scope === "string") {
			const firstPendingMutation = this.#scopes.get(scope)?.find((m) => m.state.status === "pending");
			return !firstPendingMutation || firstPendingMutation === mutation;
		} else return true;
	}
	/** @internal */
	runNext(mutation) {
		const scope = scopeFor(mutation);
		if (typeof scope === "string") return (this.#scopes.get(scope)?.find((m) => m !== mutation && m.state.isPaused))?.continue() ?? Promise.resolve();
		else return Promise.resolve();
	}
	/**
	* Removes all mutations from the cache.
	*
	* @example
	* ```ts
	* const mutationCache = queryClient.getMutationCache()
	*
	* mutationCache.clear()
	* ```
	*/
	clear() {
		notifyManager.batch(() => {
			this.#mutations.forEach((mutation) => {
				this.notify({
					type: "removed",
					mutation
				});
			});
			this.#mutations.clear();
			this.#scopes.clear();
		});
	}
	/**
	* Returns all mutations within the cache.
	*
	* This is not typically needed for most applications, but can come in handy when needing more
	* information about a mutation in rare scenarios.
	*
	* @example
	* ```ts
	* const mutationCache = queryClient.getMutationCache()
	*
	* const mutations = mutationCache.getAll()
	* ```
	*/
	getAll() {
		return Array.from(this.#mutations);
	}
	/**
	* A slightly more advanced method that can be used to get an existing mutation instance from
	* the cache. If the mutation does not exist, `undefined` is returned.
	*
	* This is not typically needed for most applications, but can come in handy when needing more
	* information about a mutation in rare scenarios.
	*
	* @see {@link MutationCache#findAll}
	* @example
	* ```ts
	* const mutationCache = queryClient.getMutationCache()
	*
	* const mutation = mutationCache.find({ mutationKey: ['addPost'] })
	* ```
	*/
	find(filters) {
		const defaultedFilters = {
			exact: true,
			...filters
		};
		return this.getAll().find((mutation) => matchMutation(defaultedFilters, mutation));
	}
	/**
	* An even more advanced method that can be used to get existing mutation instances from the
	* cache that match the given filters. If no mutations match, an empty array is returned.
	*
	* This is not typically needed for most applications, but can come in handy when needing more
	* information about mutations in rare scenarios.
	*
	* @see {@link MutationCache#find}
	* @example
	* ```ts
	* const mutationCache = queryClient.getMutationCache()
	*
	* const mutations = mutationCache.findAll({ mutationKey: ['addPost'] })
	* ```
	*/
	findAll(filters = {}) {
		return this.getAll().filter((mutation) => matchMutation(filters, mutation));
	}
	/** @internal */
	notify(event) {
		notifyManager.batch(() => {
			this.listeners.forEach((listener) => {
				listener(event);
			});
		});
	}
	/** @internal */
	resumePausedMutations() {
		const pausedMutations = this.getAll().filter((x) => x.state.isPaused);
		return notifyManager.batch(() => Promise.all(pausedMutations.map((mutation) => mutation.continue().catch(noop))));
	}
};
function scopeFor(mutation) {
	return mutation.options.scope?.id;
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/mutationObserver.js
/**
* Observes a single mutation and derives a `MutationObserverResult` from it.
* A framework hook like `useMutation` creates one `MutationObserver` per hook
* call, keeps it stable across re-renders, calls `setOptions` when the options
* passed to the hook change, subscribes to it to re-render on updates, and
* reads `getCurrentResult()` for the value to return. Calling `mutate()`
* builds a new underlying `Mutation` in the `MutationCache` and executes it.
*
* @example
* ```ts
* const observer = new MutationObserver(queryClient, {
*   mutationFn: (variables: { title: string }) => addPost(variables),
* })
* ```
*/
var MutationObserver = class extends Subscribable {
	#client;
	#currentResult = void 0;
	#currentMutation;
	#mutateOptions;
	constructor(client, options) {
		super();
		this.#client = client;
		this.setOptions(options);
		this.bindMethods();
		this.#updateResult();
	}
	bindMethods() {
		this.mutate = this.mutate.bind(this);
		this.reset = this.reset.bind(this);
	}
	/**
	* Updates the observer's options.
	*
	* If the new `mutationKey` differs from the previous one (and both were
	* defined), the observer is reset, detaching it from the mutation it was
	* observing. Otherwise, if the currently observed mutation is still
	* `pending`, its options are updated in place as well.
	*
	* @example
	* ```ts
	* observer.setOptions({
	*   mutationFn: (variables: { title: string }) => addPost(variables),
	*   onSuccess: (data) => console.log(data),
	* })
	* ```
	*/
	setOptions(options) {
		const prevOptions = this.options;
		this.options = this.#client.defaultMutationOptions(options);
		if (!shallowEqualObjects(this.options, prevOptions)) this.#client.getMutationCache().notify({
			type: "observerOptionsUpdated",
			mutation: this.#currentMutation,
			observer: this
		});
		if (prevOptions?.mutationKey && this.options.mutationKey && hashKey(prevOptions.mutationKey) !== hashKey(this.options.mutationKey)) this.reset();
		else if (this.#currentMutation?.state.status === "pending") this.#currentMutation.setOptions(this.options);
	}
	onSubscribe() {
		if (this.listeners.size === 1 && this.#currentMutation) {
			this.#currentMutation.addObserver(this);
			this.#updateResult();
		}
	}
	onUnsubscribe() {
		if (!this.hasListeners()) this.#currentMutation?.removeObserver(this);
	}
	/** @internal */
	onMutationUpdate(action) {
		this.#updateResult();
		this.#notify(action);
	}
	/**
	* Returns the observer's current result, derived from the observed
	* mutation's state (or the default, `idle` state if no mutation has been
	* built yet, e.g. before the first `mutate()` call or after `reset()`).
	*/
	getCurrentResult() {
		return this.#currentResult;
	}
	/**
	* Detaches the observer from the mutation it is currently observing (if
	* any) and resets the observed result back to its default, `idle` state.
	*
	* This does not cancel an in-flight mutation; the mutation itself keeps
	* running to completion and its own callbacks still fire, but this
	* observer stops reflecting its state and a subsequent `mutate()` call
	* will build a brand new mutation.
	*
	* @example
	* ```ts
	* observer.reset()
	* ```
	*
	* @see {@link MutationObserver#mutate}
	*/
	reset() {
		this.#currentMutation?.removeObserver(this);
		this.#currentMutation = void 0;
		this.#updateResult();
		this.#notify();
	}
	/**
	* Builds a new `Mutation` in the `MutationCache` using the observer's
	* current options, detaches this observer from any previously observed
	* mutation, attaches it to the new one, and executes it with the given
	* variables.
	*
	* The optional per-call `options` (`onSuccess`/`onError`/`onSettled`) are
	* invoked once the mutation settles, in addition to any callbacks defined
	* on the observer's own options.
	*
	* @example
	* ```ts
	* await observer.mutate(
	*   { title: 'New post' },
	*   { onSuccess: (data) => console.log(data) },
	* )
	* ```
	*/
	mutate(variables, options) {
		this.#mutateOptions = options;
		this.#currentMutation?.removeObserver(this);
		this.#currentMutation = this.#client.getMutationCache().build(this.#client, this.options);
		this.#currentMutation.addObserver(this);
		return this.#currentMutation.execute(variables);
	}
	#updateResult() {
		const state = this.#currentMutation?.state ?? getDefaultState();
		this.#currentResult = {
			...state,
			isPending: state.status === "pending",
			isSuccess: state.status === "success",
			isError: state.status === "error",
			isIdle: state.status === "idle",
			mutate: this.mutate,
			reset: this.reset
		};
	}
	#notify(action) {
		notifyManager.batch(() => {
			if (this.#mutateOptions && this.hasListeners()) {
				const variables = this.#currentResult.variables;
				const onMutateResult = this.#currentResult.context;
				const context = {
					client: this.#client,
					meta: this.options.meta,
					mutationKey: this.options.mutationKey
				};
				if (action?.type === "success") {
					try {
						this.#mutateOptions.onSuccess?.(action.data, variables, onMutateResult, context);
					} catch (e) {
						Promise.reject(e);
					}
					try {
						this.#mutateOptions.onSettled?.(action.data, null, variables, onMutateResult, context);
					} catch (e) {
						Promise.reject(e);
					}
				} else if (action?.type === "error") {
					try {
						this.#mutateOptions.onError?.(action.error, variables, onMutateResult, context);
					} catch (e) {
						Promise.reject(e);
					}
					try {
						this.#mutateOptions.onSettled?.(void 0, action.error, variables, onMutateResult, context);
					} catch (e) {
						Promise.reject(e);
					}
				}
			}
			this.listeners.forEach((listener) => {
				listener(this.#currentResult);
			});
		});
	}
};
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/queriesObserver.js
function difference(array1, array2) {
	const excludeSet = new Set(array2);
	return array1.filter((x) => !excludeSet.has(x));
}
/**
* A `QueriesObserver` watches an array of queries at once, exposing them as
* a single array of `QueryObserverResult`s (or, when a `combine` option is
* given, as a combined value derived from that array). It manages one
* internal `QueryObserver` per query, and is the primitive that framework
* adapters (e.g. `useQueries`) build their hooks on top of.
*
* @example
* ```ts
* const observer = new QueriesObserver(queryClient, [
*   { queryKey: ['post', 1], queryFn: fetchPost },
*   { queryKey: ['post', 2], queryFn: fetchPost },
* ])
*
* const unsubscribe = observer.subscribe((result) => {
*   console.log(result)
* })
* ```
*/
var QueriesObserver = class extends Subscribable {
	#client;
	#result;
	#queries;
	#options;
	#observers;
	#combinedResult;
	#lastCombine;
	#lastResult;
	#lastQueryHashes;
	#observerMatches = [];
	constructor(client, queries, options) {
		super();
		this.#client = client;
		this.#options = options;
		this.#queries = [];
		this.#observers = [];
		this.#result = [];
		this.setQueries(queries);
	}
	onSubscribe() {
		if (this.listeners.size === 1) this.#observers.forEach((observer) => {
			observer.subscribe((result) => {
				this.#onUpdate(observer, result);
			});
		});
	}
	onUnsubscribe() {
		if (!this.listeners.size) this.destroy();
	}
	/**
	* Stops observing all queries: clears all listeners and destroys every
	* underlying `QueryObserver` this observer manages.
	*/
	destroy() {
		this.listeners = /* @__PURE__ */ new Set();
		this.#observers.forEach((observer) => {
			observer.destroy();
		});
	}
	/**
	* Replaces the set of queries being observed. Existing `QueryObserver`s
	* are reused for queries that match an already-observed query hash;
	* observers for queries that are no longer present are destroyed, and new
	* observers are created and subscribed to for newly added queries.
	*
	* @example
	* ```ts
	* observer.setQueries([
	*   { queryKey: ['post', 1], queryFn: fetchPost },
	*   { queryKey: ['post', 3], queryFn: fetchPost },
	* ])
	* ```
	*/
	setQueries(queries, options) {
		this.#queries = queries;
		this.#options = options;
		{
			const queryHashes = queries.map((query) => this.#client.defaultQueryOptions(query).queryHash);
			if (new Set(queryHashes).size !== queryHashes.length) console.warn("[QueriesObserver]: Duplicate Queries found. This might result in unexpected behavior.");
		}
		notifyManager.batch(() => {
			const prevObservers = this.#observers;
			const newObserverMatches = this.#findMatchingObservers(this.#queries);
			newObserverMatches.forEach((match) => match.observer.setOptions(match.defaultedQueryOptions));
			const newObservers = newObserverMatches.map((match) => match.observer);
			const newResult = newObservers.map((observer) => observer.getCurrentResult());
			const hasLengthChange = prevObservers.length !== newObservers.length;
			const hasIndexChange = newObservers.some((observer, index) => observer !== prevObservers[index]);
			const hasStructuralChange = hasLengthChange || hasIndexChange;
			const hasResultChange = hasStructuralChange ? true : newResult.some((result, index) => {
				const prev = this.#result[index];
				return !prev || !shallowEqualObjects(result, prev);
			});
			if (!hasStructuralChange && !hasResultChange) return;
			if (hasStructuralChange) {
				this.#observerMatches = newObserverMatches;
				this.#observers = newObservers;
			}
			this.#result = newResult;
			if (!this.hasListeners()) return;
			if (hasStructuralChange) {
				difference(prevObservers, newObservers).forEach((observer) => {
					observer.destroy();
				});
				difference(newObservers, prevObservers).forEach((observer) => {
					observer.subscribe((result) => {
						this.#onUpdate(observer, result);
					});
				});
			}
			this.#notify();
		});
	}
	/**
	* Returns the most recently computed array of `QueryObserverResult`s, one
	* per observed query, in the same order as the queries passed to the
	* constructor or `setQueries`.
	*
	* @example
	* ```ts
	* const results = observer.getCurrentResult()
	* const data = results.map((result) => result.data)
	* ```
	*/
	getCurrentResult() {
		return this.#result;
	}
	/**
	* Returns the underlying `Query` instances currently being observed, in
	* the same order as the queries passed to the constructor or `setQueries`.
	*/
	getQueries() {
		return this.#observers.map((observer) => observer.getCurrentQuery());
	}
	/**
	* Returns the underlying `QueryObserver` instances this observer manages,
	* in the same order as the queries passed to the constructor or
	* `setQueries`.
	*/
	getObservers() {
		return this.#observers;
	}
	/**
	* The `QueriesObserver` counterpart of {@link QueryObserver#getOptimisticResult} — computes
	* the result for the given (already-defaulted) queries right now, synchronously. Called by
	* framework adapters (e.g. `useQueries`) ahead of subscribing, returning a tuple of the raw
	* per-query results, a function to compute the combined result from them, and a function to
	* wrap the results for property-access tracking.
	*/
	getOptimisticResult(queries, combine) {
		const matches = this.#findMatchingObservers(queries);
		const result = matches.map((match) => match.observer.getOptimisticResult(match.defaultedQueryOptions));
		const queryHashes = matches.map((match) => match.defaultedQueryOptions.queryHash);
		return [
			result,
			(r) => {
				return this.#combineResult(r ?? result, combine, queryHashes);
			},
			() => {
				return this.#trackResult(result, matches);
			}
		];
	}
	#trackResult(result, matches) {
		const trackedProps = /* @__PURE__ */ new Set();
		return matches.map((match, index) => {
			const observerResult = result[index];
			return !match.defaultedQueryOptions.notifyOnChangeProps ? match.observer.trackResult(observerResult, (accessedProp) => {
				if (!trackedProps.has(accessedProp)) {
					trackedProps.add(accessedProp);
					matches.forEach((m) => {
						m.observer.trackProp(accessedProp);
					});
				}
			}) : observerResult;
		});
	}
	#combineResult(input, combine, queryHashes) {
		if (combine) {
			const lastHashes = this.#lastQueryHashes;
			const queryHashesChanged = queryHashes !== void 0 && lastHashes !== void 0 && (lastHashes.length !== queryHashes.length || queryHashes.some((hash, i) => hash !== lastHashes[i]));
			if (this.#result !== this.#lastResult || queryHashesChanged || combine !== this.#lastCombine) {
				this.#lastCombine = combine;
				this.#lastResult = this.#result;
				if (queryHashes !== void 0) this.#lastQueryHashes = queryHashes;
				this.#combinedResult = replaceEqualDeep(this.#combinedResult, combine(input));
			}
			return this.#combinedResult;
		}
		return input;
	}
	#shouldSkipCombine() {
		return !this.#options?.combine || this.#observers.some((observer, index) => {
			return observer.options.suspense && this.#result[index]?.data === void 0;
		});
	}
	#findMatchingObservers(queries) {
		const prevObserversMap = /* @__PURE__ */ new Map();
		this.#observers.forEach((observer) => {
			const key = observer.options.queryHash;
			if (!key) return;
			const previousObservers = prevObserversMap.get(key);
			if (previousObservers) previousObservers.push(observer);
			else prevObserversMap.set(key, [observer]);
		});
		const observers = [];
		queries.forEach((options) => {
			const defaultedOptions = this.#client.defaultQueryOptions(options);
			const observer = prevObserversMap.get(defaultedOptions.queryHash)?.shift() ?? new QueryObserver(this.#client, defaultedOptions);
			observers.push({
				defaultedQueryOptions: defaultedOptions,
				observer
			});
		});
		return observers;
	}
	#onUpdate(observer, result) {
		const index = this.#observers.indexOf(observer);
		if (index !== -1) {
			this.#result = this.#result.slice();
			this.#result[index] = result;
			this.#notify();
		}
	}
	#notify() {
		if (this.hasListeners()) {
			const shouldSkipCombine = this.#shouldSkipCombine();
			const previousResult = this.#combinedResult;
			const newResult = shouldSkipCombine ? previousResult : this.#combineResult(this.#trackResult(this.#result, this.#observerMatches), this.#options?.combine);
			if (shouldSkipCombine || previousResult !== newResult) notifyManager.batch(() => {
				this.listeners.forEach((listener) => {
					listener(this.#result);
				});
			});
		}
	}
};
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/queryCache.js
/**
* The `QueryCache` is the storage mechanism for TanStack Query. It stores all the data, meta
* information, and state of the queries it contains.
*
* Normally, you will not interact with the `QueryCache` directly and instead use a `QueryClient`
* for a specific cache. You can subscribe to it (inherited from `Subscribable`) to be informed of
* safe/known updates to the cache, such as queries being added, removed, or updated — updates made
* outside of the cache's own tracked mechanisms (e.g. mutating a query's state object directly) do
* not notify subscribers.
*
* @example
* ```ts
* const unsubscribe = queryCache.subscribe((event) => {
*   console.log(event.type, event.query)
* })
* ```
*/
var QueryCache = class extends Subscribable {
	#queries;
	constructor(config = {}) {
		super();
		this.config = config;
		this.#queries = /* @__PURE__ */ new Map();
	}
	/**
	* Returns the existing `Query` instance for the given options' `queryKey`/`queryHash`, or
	* builds and adds a new one to the cache if none exists yet. Used by framework adapters and
	* plugins (e.g. broadcast/persistence) that need to get-or-create a `Query` directly, bypassing
	* the reactive `QueryObserver` machinery.
	*
	* @example
	* ```ts
	* const queryCache = queryClient.getQueryCache()
	*
	* const query = queryCache.build(queryClient, {
	*   queryKey: ['posts'],
	*   queryFn: fetchPosts,
	* })
	* ```
	*/
	build(client, options, state) {
		const queryKey = options.queryKey;
		const queryHash = options.queryHash ?? hashQueryKeyByOptions(queryKey, options);
		let query = this.get(queryHash);
		if (!query) {
			query = new Query({
				client,
				queryKey,
				queryHash,
				options: client.defaultQueryOptions(options),
				state,
				defaultOptions: client.getQueryDefaults(queryKey)
			});
			this.add(query);
		}
		return query;
	}
	/** @internal */
	add(query) {
		if (!this.#queries.has(query.queryHash)) {
			this.#queries.set(query.queryHash, query);
			this.notify({
				type: "added",
				query
			});
		}
	}
	/**
	* Destroys the given `Query` and removes it from the cache, notifying subscribers with a
	* `'removed'` event. A no-op if the query is no longer the one currently stored under its hash
	* (e.g. it was already replaced). Used by plugins (e.g. the broadcast client) that mirror
	* removals across `QueryCache` instances.
	*
	* @example
	* ```ts
	* const queryCache = queryClient.getQueryCache()
	* const query = queryCache.find({ queryKey: ['posts'] })
	*
	* if (query) {
	*   queryCache.remove(query)
	* }
	* ```
	*/
	remove(query) {
		if (this.#queries.get(query.queryHash) === query) {
			query.destroy();
			this.#queries.delete(query.queryHash);
			this.notify({
				type: "removed",
				query
			});
		}
	}
	/**
	* Removes all queries from the cache.
	*
	* @example
	* ```ts
	* const queryCache = queryClient.getQueryCache()
	*
	* queryCache.clear()
	* ```
	*/
	clear() {
		notifyManager.batch(() => {
			this.getAll().forEach((query) => {
				this.remove(query);
			});
		});
	}
	/**
	* Returns the `Query` instance stored under the given `queryHash`, or `undefined` if none
	* exists. Unlike {@link QueryCache#find}, this looks up by the already-computed hash rather
	* than by `QueryFilters`. Used by plugins (e.g. broadcast/hydration) that already have a hash
	* to look up directly.
	*
	* @example
	* ```ts
	* const queryCache = queryClient.getQueryCache()
	* const queryHash = hashKey(['posts'])
	*
	* const query = queryCache.get(queryHash)
	* ```
	*/
	get(queryHash) {
		return this.#queries.get(queryHash);
	}
	/**
	* Returns all queries within the cache.
	*
	* @example
	* ```ts
	* const queryCache = queryClient.getQueryCache()
	*
	* const queries = queryCache.getAll()
	* ```
	*/
	getAll() {
		return [...this.#queries.values()];
	}
	/**
	* A slightly more advanced method that can be used to get an existing query instance from the
	* cache. This instance not only contains all the state for the query, but all of the instances,
	* and underlying guts of the query as well. If the query does not exist, `undefined` is
	* returned.
	*
	* This is not typically needed for most applications, but can come in handy when needing more
	* information about a query in rare scenarios (e.g. looking at `query.state.dataUpdatedAt` to
	* decide whether a query is fresh enough to be used as an initial value).
	*
	* @see {@link QueryCache#findAll}
	* @example
	* ```ts
	* const queryCache = queryClient.getQueryCache()
	*
	* const query = queryCache.find({ queryKey: ['posts'] })
	* ```
	*/
	find(filters) {
		const defaultedFilters = {
			exact: true,
			...filters
		};
		return this.getAll().find((query) => matchQuery(defaultedFilters, query));
	}
	/**
	* An even more advanced method that can be used to get existing query instances from the cache
	* that partially match a query key. If no queries match, an empty array is returned.
	*
	* This is not typically needed for most applications, but can come in handy when needing more
	* information about queries in rare scenarios.
	*
	* @see {@link QueryCache#find}
	* @example
	* ```ts
	* const queryCache = queryClient.getQueryCache()
	*
	* const queries = queryCache.findAll({ queryKey: ['posts'] })
	* ```
	*/
	findAll(filters = {}) {
		const queries = this.getAll();
		return Object.keys(filters).length > 0 ? queries.filter((query) => matchQuery(filters, query)) : queries;
	}
	/** @internal */
	notify(event) {
		notifyManager.batch(() => {
			this.listeners.forEach((listener) => {
				listener(event);
			});
		});
	}
	/** @internal */
	onFocus() {
		notifyManager.batch(() => {
			this.getAll().forEach((query) => {
				query.onFocus();
			});
		});
	}
	/** @internal */
	onOnline() {
		notifyManager.batch(() => {
			this.getAll().forEach((query) => {
				query.onOnline();
			});
		});
	}
};
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/queryClient.js
/**
* `QueryClient` is used to interact with a cache of queries and mutations. It owns a
* `QueryCache` and a `MutationCache` (creating default ones if none are passed in) and holds
* the default options that are applied to queries and mutations created through it.
*
* @example
* ```ts
* const queryClient = new QueryClient({
*   defaultOptions: {
*     queries: {
*       staleTime: Infinity,
*     },
*   },
* })
*
* await queryClient.query({ queryKey: ['posts'], queryFn: fetchPosts })
* ```
*/
var QueryClient = class {
	#queryCache;
	#mutationCache;
	#defaultOptions;
	#queryDefaults;
	#mutationDefaults;
	#mountCount;
	#unsubscribeFocus;
	#unsubscribeOnline;
	constructor(config = {}) {
		this.#queryCache = config.queryCache || new QueryCache();
		this.#mutationCache = config.mutationCache || new MutationCache();
		this.#defaultOptions = config.defaultOptions || {};
		this.#queryDefaults = /* @__PURE__ */ new Map();
		this.#mutationDefaults = /* @__PURE__ */ new Map();
		this.#mountCount = 0;
	}
	/**
	* Called by a framework adapter's `QueryClientProvider`-equivalent when it mounts, to start
	* listening for focus/online events and resume paused mutations. Ref-counted via an internal
	* mount count, so nested or multiple providers sharing the same `QueryClient` don't tear down
	* the shared listeners until the last one unmounts.
	*/
	mount() {
		this.#mountCount++;
		if (this.#mountCount !== 1) return;
		this.#unsubscribeFocus = focusManager.subscribe(async (focused) => {
			if (focused) {
				await this.resumePausedMutations();
				this.#queryCache.onFocus();
			}
		});
		this.#unsubscribeOnline = onlineManager.subscribe(async (online) => {
			if (online) {
				await this.resumePausedMutations();
				this.#queryCache.onOnline();
			}
		});
	}
	/**
	* The inverse of {@link QueryClient#mount} — called by a framework adapter's
	* `QueryClientProvider`-equivalent when it unmounts. Only tears down the focus/online
	* listeners once the mount count returns to `0`.
	*/
	unmount() {
		this.#mountCount--;
		if (this.#mountCount !== 0) return;
		this.#unsubscribeFocus?.();
		this.#unsubscribeFocus = void 0;
		this.#unsubscribeOnline?.();
		this.#unsubscribeOnline = void 0;
	}
	/**
	* Returns the number of queries in the cache that are currently fetching, optionally
	* matching a set of filters. This includes background-fetching, loading new pages, and
	* loading more infinite query results.
	*
	* @example
	* ```ts
	* if (queryClient.isFetching()) {
	*   console.log('At least one query is fetching!')
	* }
	* ```
	*/
	isFetching(filters) {
		return this.#queryCache.findAll({
			...filters,
			fetchStatus: "fetching"
		}).length;
	}
	/**
	* Returns the number of mutations in the cache that are currently pending, optionally
	* matching a set of filters.
	*
	* @example
	* ```ts
	* if (queryClient.isMutating()) {
	*   console.log('At least one mutation is pending!')
	* }
	* ```
	*/
	isMutating(filters) {
		return this.#mutationCache.findAll({
			...filters,
			status: "pending"
		}).length;
	}
	/**
	* Imperative (non-reactive) way to retrieve data for a QueryKey.
	* Should only be used in callbacks or functions where reading the latest data is necessary, e.g. for optimistic updates.
	*
	* Hint: Do not use this function inside a component, because it won't receive updates.
	* Use `useQuery` to create a `QueryObserver` that subscribes to changes.
	*
	* @returns The cached data for the query, or `undefined` if no query with this key has been observed yet.
	* @see {@link QueryClient#getQueriesData}
	*/
	getQueryData(queryKey) {
		const options = this.defaultQueryOptions({ queryKey });
		return this.#queryCache.get(options.queryHash)?.state.data;
	}
	/**
	* @deprecated Use queryClient.query({ ...options, staleTime: 'static' }) instead. This method will be removed in the next major version.
	*/
	ensureQueryData(options) {
		const defaultedOptions = this.defaultQueryOptions(options);
		const query = this.#queryCache.build(this, defaultedOptions);
		const cachedData = query.state.data;
		if (cachedData === void 0) return this.fetchQuery(options);
		if (options.revalidateIfStale && query.isStaleByTime(resolveQueryValue(defaultedOptions.staleTime, query))) this.prefetchQuery(defaultedOptions);
		return Promise.resolve(cachedData);
	}
	/**
	* Imperative (non-reactive) way to retrieve the cached data of multiple queries at once.
	* Only queries matching the given filters are returned; if none match, an empty array is
	* returned.
	*
	* Because the matched queries can hold data of different shapes (e.g. a broad filter can match
	* queries with unrelated data types), the `TQueryFnData` generic defaults to `unknown` rather
	* than being inferred. Passing a more specific type is a convenience for call sites that know
	* every matched query holds the same shape — it is not checked against the actual cache
	* contents.
	*
	* @returns An array of query key and data pairs. The data is `undefined` for a query with no cached data.
	* @see {@link QueryClient#getQueryData}
	* @example
	* ```ts
	* const data = queryClient.getQueriesData({ queryKey: ['posts'] })
	* ```
	*/
	getQueriesData(filters) {
		return this.#queryCache.findAll(filters).map(({ queryKey, state }) => {
			return [queryKey, state.data];
		});
	}
	/**
	* Synchronous way to immediately update a query's cached data. If the updater (or the value
	* passed) resolves to `undefined`, the cache is left untouched and no query is created;
	* otherwise, if the query does not exist yet, it will be created. To update multiple queries
	* at once by partially matching query keys, use {@link QueryClient#setQueriesData} instead.
	*
	* Updates must be performed immutably: do not mutate `oldData`, or data previously retrieved
	* via {@link QueryClient#getQueryData}, in place.
	*
	* @param queryKey - The query key to set data for.
	* @param updater - Either the new data, or a function that receives the current data (which
	* may be `undefined`) and returns the new data.
	* @param options - Set `updatedAt` to override the timestamp the written data is recorded with.
	* @returns The data that was written, or `undefined` if the updater returned `undefined` — in that case
	* the write is skipped and the cache is left unchanged.
	*
	* @example
	* ```ts
	* queryClient.setQueryData(['posts'], newPosts)
	*
	* // Or, using an updater function that receives the current data:
	* queryClient.setQueryData(['posts'], (oldPosts) => [...oldPosts, newPost])
	* ```
	*/
	setQueryData(queryKey, updater, options) {
		const defaultedOptions = this.defaultQueryOptions({ queryKey });
		const prevData = this.#queryCache.get(defaultedOptions.queryHash)?.state.data;
		const data = functionalUpdate(updater, prevData);
		if (data === void 0) return;
		return this.#queryCache.build(this, defaultedOptions).setData(data, {
			...options,
			manual: true
		});
	}
	/**
	* Synchronous way to immediately update the cached data of multiple queries at once, using
	* filters or partial query key matching. Only queries that already exist and match the given
	* filters are updated; no new cache entries are created. Internally this calls
	* {@link QueryClient#setQueryData} for each matching query.
	*
	* @returns One `[queryKey, data]` tuple per matched query, in the same shape and with the same
	* `undefined` case as {@link QueryClient#setQueryData}.
	* @example
	* ```ts
	* queryClient.setQueriesData({ queryKey: ['posts'] }, (oldPosts) =>
	*   oldPosts ? oldPosts.filter((post) => post.id !== deletedId) : oldPosts,
	* )
	* ```
	*/
	setQueriesData(filters, updater, options) {
		return notifyManager.batch(() => this.#queryCache.findAll(filters).map(({ queryKey }) => [queryKey, this.setQueryData(queryKey, updater, options)]));
	}
	/**
	* Imperative (non-reactive) way to retrieve an existing query's state. If the query does not
	* exist, `undefined` is returned.
	*
	* @example
	* ```ts
	* const state = queryClient.getQueryState(['posts'])
	* console.log(state?.dataUpdatedAt)
	* ```
	*/
	getQueryState(queryKey) {
		const options = this.defaultQueryOptions({ queryKey });
		return this.#queryCache.get(options.queryHash)?.state;
	}
	/**
	* Removes queries from the cache that match the given filters. Unlike
	* {@link QueryClient#invalidateQueries} or {@link QueryClient#refetchQueries}, this removes
	* matching queries from the cache instead of refetching them. Without filters, every query in
	* the cache is removed.
	*
	* @example
	* ```ts
	* queryClient.removeQueries({ queryKey: ['posts'], exact: true })
	* ```
	*/
	removeQueries(filters) {
		const queryCache = this.#queryCache;
		notifyManager.batch(() => {
			queryCache.findAll(filters).forEach((query) => {
				queryCache.remove(query);
			});
		});
	}
	/**
	* Resets queries matching the given filters back to their initial state (e.g. any
	* `initialData`), notifying subscribers rather than removing them. Active queries among the
	* matched set are then refetched, and the returned promise resolves once that refetch settles.
	*
	* @example
	* ```ts
	* await queryClient.resetQueries({ queryKey: ['posts'], exact: true })
	* ```
	*/
	resetQueries(filters, options) {
		const queryCache = this.#queryCache;
		return notifyManager.batch(() => {
			const matched = queryCache.findAll(filters);
			const queriesToRefetch = new Set(matched);
			matched.forEach((query) => {
				query.reset();
			});
			return this.refetchQueries({
				type: "active",
				predicate: (query) => queriesToRefetch.has(query)
			}, options);
		});
	}
	/**
	* Cancels outgoing fetches for queries matching the given filters. Most useful when performing
	* optimistic updates, since any outgoing refetch that resolves afterwards would otherwise
	* overwrite the optimistic update. By default (`revert: true`), a cancelled query's data is
	* reverted to its state before the outgoing fetch started.
	*
	* The returned promise never rejects, even if individual cancellations fail.
	*
	* @example
	* ```ts
	* await queryClient.cancelQueries({ queryKey: ['posts'], exact: true })
	* ```
	*/
	cancelQueries(filters, cancelOptions = {}) {
		const defaultedCancelOptions = {
			revert: true,
			...cancelOptions
		};
		const promises = notifyManager.batch(() => this.#queryCache.findAll(filters).map((query) => query.cancel(defaultedCancelOptions)));
		return Promise.all(promises).then(noop).catch(noop);
	}
	/**
	* Marks queries matching the given filters as invalidated. Unlike
	* {@link QueryClient#removeQueries}, invalidated queries stay in the cache.
	*
	* Unless `filters.refetchType` is `'none'`, matching queries are then refetched via
	* {@link QueryClient#refetchQueries}, using `filters.refetchType` if set, otherwise
	* `filters.type`, otherwise `'active'`.
	*
	* @example
	* ```ts
	* await queryClient.invalidateQueries({ queryKey: ['posts'], refetchType: 'active' })
	* ```
	*/
	invalidateQueries(filters, options = {}) {
		return notifyManager.batch(() => {
			this.#queryCache.findAll(filters).forEach((query) => {
				query.invalidate();
			});
			if (filters?.refetchType === "none") return Promise.resolve();
			return this.refetchQueries({
				...filters,
				type: filters?.refetchType ?? filters?.type ?? "active"
			}, options);
		});
	}
	/**
	* Refetches queries matching the given filters, regardless of whether they are stale. Without
	* filters, every query in the cache is refetched. Queries that are disabled, or static (only
	* have observers with a static `staleTime`), are never refetched.
	*
	* By default (`cancelRefetch: true`), a currently running fetch is cancelled before the new
	* one starts. The returned promise resolves once all matching queries have settled; it does
	* not reject on individual query failures unless `throwOnError` is set.
	*
	* @example
	* ```ts
	* // refetch all active queries partially matching a query key:
	* await queryClient.refetchQueries({ queryKey: ['posts'], type: 'active' })
	* ```
	*/
	refetchQueries(filters, options = {}) {
		const fetchOptions = {
			...options,
			cancelRefetch: options.cancelRefetch ?? true
		};
		const promises = notifyManager.batch(() => this.#queryCache.findAll(filters).filter((query) => !query.isDisabled() && !query.isStatic()).map((query) => {
			let promise = query.fetch(void 0, fetchOptions);
			if (!fetchOptions.throwOnError) promise = promise.catch(noop);
			return query.state.fetchStatus === "paused" ? Promise.resolve() : promise;
		}));
		return Promise.all(promises).then(noop);
	}
	/**
	* Asynchronous method to fetch and cache a query, resolving with the data or throwing with
	* the error.
	*
	* If the query already exists in the cache and its data is not stale (per the given
	* `staleTime`), the cached data is returned without fetching. Otherwise, the query is fetched
	* and the promise resolves once the fetch settles. If a `select` function is provided, it is
	* applied to the data in both cases (cached or freshly fetched) before it is returned.
	*
	* Unlike a reactive observer, retries are disabled by default here (`retry: false`) unless
	* explicitly configured, since there is no component to catch a thrown error and retry through
	* re-render.
	*
	* The accepted options are `QueryObserverOptions` minus the fields that only make sense for a
	* reactive observer — `enabled`, `refetchInterval`, `refetchIntervalInBackground`,
	* `refetchOnWindowFocus`, `refetchOnReconnect`, `refetchOnMount`, `retryOnMount`,
	* `notifyOnChangeProps`, `throwOnError`, `suspense`, and `placeholderData` are not part of this
	* method's options.
	*
	* This method replaces the deprecated `fetchQuery`, and — combined with
	* `{ staleTime: 'static' }` — the deprecated `ensureQueryData`.
	*
	* @example
	* ```ts
	* try {
	*   const data = await queryClient.query({ queryKey, queryFn, staleTime: 10000 })
	* } catch (error) {
	*   console.log(error)
	* }
	* ```
	*/
	async query(options) {
		const defaultedOptions = this.defaultQueryOptions(options);
		if (defaultedOptions.retry === void 0) defaultedOptions.retry = false;
		const query = this.#queryCache.build(this, defaultedOptions);
		const queryData = query.isStaleByTime(resolveQueryValue(defaultedOptions.staleTime, query)) ? await query.fetch(defaultedOptions) : query.state.data;
		const select = defaultedOptions.select;
		if (select) return select(queryData);
		return queryData;
	}
	/**
	* @deprecated Use queryClient.query(options) instead. This method will be removed in the next major version.
	*/
	fetchQuery(options) {
		const defaultedOptions = this.defaultQueryOptions(options);
		if (defaultedOptions.retry === void 0) defaultedOptions.retry = false;
		const query = this.#queryCache.build(this, defaultedOptions);
		return query.isStaleByTime(resolveQueryValue(defaultedOptions.staleTime, query)) ? query.fetch(defaultedOptions) : Promise.resolve(query.state.data);
	}
	/**
	* @deprecated Use queryClient.query(options) instead. You can swallow errors with `.catch(noop)`. This method will be removed in the next major version.
	*/
	prefetchQuery(options) {
		return this.fetchQuery(options).then(noop).catch(noop);
	}
	/**
	* Asynchronous method to fetch and cache an infinite query, resolving with an
	* {@link InfiniteData} object or throwing with the error.
	*
	* Behaves like {@link QueryClient#query}, accepting the same options (minus
	* `initialPageParam`), plus the required `initialPageParam`, and an optional `pages` /
	* `getNextPageParam` pair used to refetch a fixed number of pages from the start.
	*
	* This method replaces the deprecated `fetchInfiniteQuery`, and — combined with
	* `{ staleTime: 'static' }` — the deprecated `ensureInfiniteQueryData`.
	*
	* @example
	* ```ts
	* try {
	*   const data = await queryClient.infiniteQuery({ queryKey, queryFn, initialPageParam: 0 })
	*   console.log(data.pages)
	* } catch (error) {
	*   console.log(error)
	* }
	* ```
	*/
	infiniteQuery(options) {
		options._type = "infinite";
		return this.query(options);
	}
	/**
	* @deprecated Use queryClient.infiniteQuery(options) instead. This method will be removed in the next major version.
	*/
	fetchInfiniteQuery(options) {
		options._type = "infinite";
		return this.fetchQuery(options);
	}
	/**
	* @deprecated Use queryClient.infiniteQuery(options) instead. You can swallow errors with `.catch(noop)`. This method will be removed in the next major version.
	*/
	prefetchInfiniteQuery(options) {
		return this.fetchInfiniteQuery(options).then(noop).catch(noop);
	}
	/**
	* @deprecated Use queryClient.infiniteQuery({ ...options, staleTime: 'static' }) instead. This method will be removed in the next major version.
	*/
	ensureInfiniteQueryData(options) {
		options._type = "infinite";
		return this.ensureQueryData(options);
	}
	/**
	* Resumes mutations that were paused because there was no network connection. Does nothing
	* (resolving immediately) if the client is currently offline.
	*
	* @example
	* ```ts
	* import { QueryClient } from '@tanstack/query-core'
	*
	* const queryClient = new QueryClient()
	* await queryClient.resumePausedMutations()
	* ```
	*/
	resumePausedMutations() {
		if (onlineManager.isOnline()) return this.#mutationCache.resumePausedMutations();
		return Promise.resolve();
	}
	/**
	* Returns the query cache this client is connected to.
	*
	* @example
	* ```ts
	* import { QueryClient } from '@tanstack/query-core'
	*
	* const queryClient = new QueryClient()
	* const queryCache = queryClient.getQueryCache()
	* const queries = queryCache.findAll({ queryKey: ['posts'] })
	* ```
	*/
	getQueryCache() {
		return this.#queryCache;
	}
	/**
	* Returns the mutation cache this client is connected to.
	*
	* @example
	* ```ts
	* import { QueryClient } from '@tanstack/query-core'
	*
	* const queryClient = new QueryClient()
	* const mutationCache = queryClient.getMutationCache()
	* const mutations = mutationCache.findAll({ status: 'pending' })
	* ```
	*/
	getMutationCache() {
		return this.#mutationCache;
	}
	/**
	* Returns the default options that were set when creating the client, or via
	* {@link QueryClient#setDefaultOptions}.
	*
	* @example
	* ```ts
	* import { QueryClient } from '@tanstack/query-core'
	*
	* const queryClient = new QueryClient()
	* const defaultOptions = queryClient.getDefaultOptions()
	* ```
	*/
	getDefaultOptions() {
		return this.#defaultOptions;
	}
	/**
	* Dynamically sets the default options for this client, overwriting any previously defined
	* default options.
	*
	* @see {@link QueryClient#getDefaultOptions}
	* @example
	* ```ts
	* import { QueryClient } from '@tanstack/query-core'
	*
	* const queryClient = new QueryClient()
	* queryClient.setDefaultOptions({
	*   queries: {
	*     staleTime: Infinity,
	*   },
	* })
	* ```
	*/
	setDefaultOptions(options) {
		this.#defaultOptions = options;
	}
	/**
	* Sets default options for queries whose query key partially matches the given `queryKey`.
	*
	* If several registered query defaults match a given query key, they are merged together in
	* registration order by {@link QueryClient#getQueryDefaults}, so register defaults from the
	* most generic key to the least generic one — more specific defaults should be registered
	* after more generic ones so they take precedence.
	*
	* @example
	* ```ts
	* queryClient.setQueryDefaults(['posts'], { queryFn: fetchPosts })
	*
	* await queryClient.query({ queryKey: ['posts'] })
	* ```
	*/
	setQueryDefaults(queryKey, options) {
		this.#queryDefaults.set(hashKey(queryKey), {
			queryKey,
			defaultOptions: options
		});
	}
	/**
	* Returns the default options registered for queries whose query key partially matches the
	* given `queryKey`, via {@link QueryClient#setQueryDefaults}. If multiple registered defaults
	* match, they are merged together in registration order.
	*
	* @example
	* ```ts
	* const defaultOptions = queryClient.getQueryDefaults(['posts'])
	* ```
	*/
	getQueryDefaults(queryKey) {
		const defaults = [...this.#queryDefaults.values()];
		const result = {};
		defaults.forEach((queryDefault) => {
			if (partialMatchKey(queryKey, queryDefault.queryKey)) Object.assign(result, queryDefault.defaultOptions);
		});
		return result;
	}
	/**
	* Sets default options for mutations whose mutation key partially matches the given
	* `mutationKey`. As with {@link QueryClient#setQueryDefaults}, the order of registration
	* matters when several registered defaults match the same mutation key.
	*
	* @see {@link QueryClient#getMutationDefaults}
	* @example
	* ```ts
	* queryClient.setMutationDefaults(['addPost'], { mutationFn: addPost })
	* ```
	*/
	setMutationDefaults(mutationKey, options) {
		this.#mutationDefaults.set(hashKey(mutationKey), {
			mutationKey,
			defaultOptions: options
		});
	}
	/**
	* Returns the default options registered for mutations whose mutation key partially matches
	* the given `mutationKey`, via {@link QueryClient#setMutationDefaults}. If multiple registered
	* defaults match, they are merged together in registration order.
	*
	* @example
	* ```ts
	* const defaultOptions = queryClient.getMutationDefaults(['addPost'])
	* ```
	*/
	getMutationDefaults(mutationKey) {
		const defaults = [...this.#mutationDefaults.values()];
		const result = {};
		defaults.forEach((queryDefault) => {
			if (partialMatchKey(mutationKey, queryDefault.mutationKey)) Object.assign(result, queryDefault.defaultOptions);
		});
		return result;
	}
	/**
	* Called by framework adapters (e.g. inside `useQuery`) to resolve the options passed by the
	* caller into their final, defaulted form: merging `queryClient.setQueryDefaults` for the
	* given `queryKey`, then the client's own `defaultOptions.queries`, then the caller's options
	* on top. A no-op if the options are already defaulted (`_defaulted: true`).
	*/
	defaultQueryOptions(options) {
		if (options._defaulted) return options;
		const defaultedOptions = {
			...this.#defaultOptions.queries,
			...this.getQueryDefaults(options.queryKey),
			...options,
			_defaulted: true
		};
		if (!defaultedOptions.queryHash) defaultedOptions.queryHash = hashQueryKeyByOptions(defaultedOptions.queryKey, defaultedOptions);
		if (defaultedOptions.refetchOnReconnect === void 0) defaultedOptions.refetchOnReconnect = defaultedOptions.networkMode !== "always";
		if (defaultedOptions.throwOnError === void 0) defaultedOptions.throwOnError = !!defaultedOptions.suspense;
		if (!defaultedOptions.networkMode && defaultedOptions.persister) defaultedOptions.networkMode = "offlineFirst";
		if (defaultedOptions.queryFn === skipToken) defaultedOptions.enabled = false;
		return defaultedOptions;
	}
	/**
	* The mutation counterpart of {@link QueryClient#defaultQueryOptions}. Called by framework
	* adapters (e.g. inside `useMutation`) to merge `queryClient.setMutationDefaults` for the
	* given `mutationKey`, then the client's `defaultOptions.mutations`, then the caller's options
	* on top. A no-op if the options are already defaulted (`_defaulted: true`).
	*/
	defaultMutationOptions(options) {
		if (options?._defaulted) return options;
		return {
			...this.#defaultOptions.mutations,
			...options?.mutationKey && this.getMutationDefaults(options.mutationKey),
			...options,
			_defaulted: true
		};
	}
	/**
	* Clears both the query cache and the mutation cache this client is connected to.
	*
	* @example
	* ```ts
	* import { QueryClient } from '@tanstack/query-core'
	*
	* const queryClient = new QueryClient()
	* queryClient.clear()
	* ```
	*/
	clear() {
		this.#queryCache.clear();
		this.#mutationCache.clear();
	}
};
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/streamedQuery.js
/**
* This is a helper function to create a query function that streams data from an AsyncIterable.
* Data will be an Array of all the chunks received.
* The query will be in a 'pending' state until the first chunk of data is received, but will go to 'success' after that.
* The query will stay in fetchStatus 'fetching' until the stream ends.
* @param streamFn - The function that returns an AsyncIterable to stream data from.
* @example
* ```ts
* await queryClient.query({
*   queryKey: ['data'],
*   queryFn: streamedQuery({
*     streamFn: fetchDataInChunks,
*   }),
* })
* ```
*/
function streamedQuery({ streamFn, refetchMode = "reset", reducer = (items, chunk) => addToEnd(items, chunk), initialValue = [] }) {
	return async (context) => {
		const query = context.client.getQueryCache().find({
			queryKey: context.queryKey,
			exact: true
		});
		const isRefetch = !!query && query.isFetched();
		if (isRefetch && refetchMode === "reset") query.setState({
			...query.resetState,
			fetchStatus: "fetching"
		});
		let result = initialValue;
		let cancelled = false;
		const stream = await streamFn(addConsumeAwareSignal({
			client: context.client,
			meta: context.meta,
			queryKey: context.queryKey,
			pageParam: context.pageParam,
			direction: context.direction
		}, () => context.signal, () => cancelled = true));
		const isReplaceRefetch = isRefetch && refetchMode === "replace";
		for await (const chunk of stream) {
			if (cancelled) break;
			if (isReplaceRefetch) result = reducer(result, chunk);
			else context.client.setQueryData(context.queryKey, (prev) => reducer(prev === void 0 ? initialValue : prev, chunk));
		}
		if (isReplaceRefetch && !cancelled) context.client.setQueryData(context.queryKey, result);
		const data = context.client.getQueryData(context.queryKey);
		return data === void 0 ? initialValue : data;
	};
}
//#endregion
//#region node_modules/@tanstack/query-core/build/modern/types.js
/* istanbul ignore file */
var dataTagSymbol = Symbol();
var dataTagErrorSymbol = Symbol();
var unsetMarker = Symbol();
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/HydrationBoundary.js
/**
* `HydrationBoundary` adds a previously dehydrated state into the `queryClient` that would be returned by
* `useQueryClient()`. If the client already contains data, the new queries will be intelligently merged based on
* update timestamp.
*
* Note: Only `queries` can be dehydrated with an `HydrationBoundary`.
*
* @returns The provided `children`, rendered unconditionally. New queries in `state` are hydrated into the
* cache during render; for queries already in the cache, only newer dehydrated data is hydrated, in an effect
* after commit.
*
* @example
* ```tsx
* import { HydrationBoundary } from '@tanstack/react-query'
*
* function App() {
*   return <HydrationBoundary state={dehydratedState}>...</HydrationBoundary>
* }
* ```
*
* @example
* Server-side prefetch handed off to the client via `dehydrate`:
* ```tsx
* import { HydrationBoundary, dehydrate, noop } from '@tanstack/react-query'
*
* async function ServerComponent() {
*   const queryClient = getQueryClient()
*
*   await queryClient
*     .query({
*       queryKey: ['posts'],
*       queryFn: fetchPosts,
*     })
*     .catch(noop)
*
*   return (
*     <HydrationBoundary state={dehydrate(queryClient)}>
*       <Posts />
*     </HydrationBoundary>
*   )
* }
* ```
*/
var HydrationBoundary = ({ children, options = {}, state, queryClient }) => {
	const client = useQueryClient(queryClient);
	const optionsRef = import_react.useRef(options);
	import_react.useEffect(() => {
		optionsRef.current = options;
	});
	const hydrationQueue = import_react.useMemo(() => {
		if (state) {
			if (typeof state !== "object") return;
			const queryCache = client.getQueryCache();
			const queries = state.queries || [];
			const newQueries = [];
			const existingQueries = [];
			for (const dehydratedQuery of queries) {
				const existingQuery = queryCache.get(dehydratedQuery.queryHash);
				if (!existingQuery) newQueries.push(dehydratedQuery);
				else if (dehydratedQuery.state.dataUpdatedAt > existingQuery.state.dataUpdatedAt || dehydratedQuery.promise && existingQuery.state.status !== "pending" && existingQuery.state.fetchStatus !== "fetching" && dehydratedQuery.dehydratedAt > existingQuery.state.dataUpdatedAt) existingQueries.push(dehydratedQuery);
			}
			if (newQueries.length > 0) hydrate(client, { queries: newQueries }, optionsRef.current);
			if (existingQueries.length > 0) return existingQueries;
		}
	}, [client, state]);
	import_react.useEffect(() => {
		if (hydrationQueue) hydrate(client, { queries: hydrationQueue }, optionsRef.current);
	}, [client, hydrationQueue]);
	return children;
};
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/IsRestoringProvider.js
var IsRestoringContext = import_react.createContext(false);
/**
* If you are using `PersistQueryClientProvider`, you can also use the `useIsRestoring` hook alongside it to
* check if a restore is currently in progress. `useQuery` and friends also check this internally to avoid
* race conditions between the restore and mounting queries.
*
* @returns `true` while a persisted client is being restored, `false` otherwise.
*/
var useIsRestoring = () => import_react.useContext(IsRestoringContext);
/**
* The Provider that `PersistQueryClientProvider` uses to signal whether a persisted client is currently
* being restored, read by `useIsRestoring`.
*/
var IsRestoringProvider = IsRestoringContext.Provider;
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/QueryErrorResetBoundary.js
/**
* Resets any query errors within the boundary, so queries know they can try again.
*/
function createValue() {
	let isReset = false;
	return {
		/**
		* Clears the reset state, so queries know not to try again until the boundary is reset again.
		*/
		clearReset: () => {
			isReset = false;
		},
		/**
		* Resets any query errors within the boundary, so queries know they can try again.
		*/
		reset: () => {
			isReset = true;
		},
		/**
		* Returns whether the boundary has been reset and not yet cleared.
		*/
		isReset: () => {
			return isReset;
		}
	};
}
var QueryErrorResetBoundaryContext = import_react.createContext(createValue());
/**
* This hook will reset any query errors within the closest `QueryErrorResetBoundary`. If there is no boundary
* defined it will reset them globally.
*
* @returns The boundary's {@link QueryErrorResetBoundaryValue}.
*
* @example
* ```tsx
* import { ErrorBoundary } from 'react-error-boundary'
* import { useQueryErrorResetBoundary } from '@tanstack/react-query'
*
* function App({ children }: { children: React.ReactNode }) {
*   const { reset } = useQueryErrorResetBoundary()
*
*   return (
*     <ErrorBoundary
*       onReset={reset}
*       fallbackRender={({ resetErrorBoundary }) => (
*         <div>
*           There was an error!
*           <button onClick={() => resetErrorBoundary()}>Try again</button>
*         </div>
*       )}
*     >
*       {children}
*     </ErrorBoundary>
*   )
* }
* ```
*/
var useQueryErrorResetBoundary = () => import_react.useContext(QueryErrorResetBoundaryContext);
/**
* When using `suspense` or `throwOnError` in your queries, you need a way to let queries know that you want to
* try again when re-rendering after some error occurred. With the `QueryErrorResetBoundary` component you can
* reset any query errors within the boundaries of the component.
*
* @returns The `children`, rendered as-is, or called with the boundary's {@link QueryErrorResetBoundaryValue}
* if `children` is a function.
*
* @example
* ```tsx
* import { ErrorBoundary } from 'react-error-boundary'
* import { QueryErrorResetBoundary } from '@tanstack/react-query'
*
* function App() {
*   return (
*     <QueryErrorResetBoundary>
*       {({ reset }) => (
*         <ErrorBoundary
*           onReset={reset}
*           fallbackRender={({ resetErrorBoundary }) => (
*             <div>
*               There was an error!
*               <button onClick={() => resetErrorBoundary()}>Try again</button>
*             </div>
*           )}
*         >
*           <Page />
*         </ErrorBoundary>
*       )}
*     </QueryErrorResetBoundary>
*   )
* }
* ```
*/
var QueryErrorResetBoundary = ({ children }) => {
	const [value] = import_react.useState(() => createValue());
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryErrorResetBoundaryContext.Provider, {
		value,
		children: typeof children === "function" ? children(value) : children
	});
};
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/errorBoundaryUtils.js
var ensurePreventErrorBoundaryRetry = (options, errorResetBoundary, query) => {
	const throwOnError = query?.state.error && typeof options.throwOnError === "function" ? shouldThrowError(options.throwOnError, [query.state.error, query]) : options.throwOnError;
	if (options.suspense || throwOnError) {
		if (!errorResetBoundary.isReset()) options.retryOnMount = false;
	}
};
var useClearResetErrorBoundary = (errorResetBoundary) => {
	import_react.useEffect(() => {
		errorResetBoundary.clearReset();
	}, [errorResetBoundary]);
};
var getHasError = ({ result, errorResetBoundary, throwOnError, query, suspense }) => {
	return result.isError && !errorResetBoundary.isReset() && !result.isFetching && query && (suspense && result.data === void 0 || shouldThrowError(throwOnError, [result.error, query]));
};
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/suspense.js
var defaultThrowOnError = (_error, query) => query.state.data === void 0;
var ensureSuspenseTimers = (defaultedOptions) => {
	if (defaultedOptions.suspense) {
		const MIN_SUSPENSE_TIME_MS = 1e3;
		const clamp = (value) => value === "static" ? value : Math.max(value ?? MIN_SUSPENSE_TIME_MS, MIN_SUSPENSE_TIME_MS);
		const originalStaleTime = defaultedOptions.staleTime;
		defaultedOptions.staleTime = typeof originalStaleTime === "function" ? (...args) => clamp(originalStaleTime(...args)) : clamp(originalStaleTime);
		if (typeof defaultedOptions.gcTime === "number") defaultedOptions.gcTime = Math.max(defaultedOptions.gcTime, MIN_SUSPENSE_TIME_MS);
	}
};
var shouldSuspend = (defaultedOptions, result) => defaultedOptions?.suspense && result.isPending;
var fetchOptimistic = (defaultedOptions, observer, errorResetBoundary) => observer.fetchOptimistic(defaultedOptions).catch(() => {
	errorResetBoundary.clearReset();
});
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useQueries.js
/**
* The `useQueries` hook can be used to fetch a variable number of queries.
*
* The `queries` key accepts an array with query option objects mostly identical to `useQuery` — the top-level
* `subscribed` option isn't accepted per query (see `placeholderData` below for another difference). A custom
* `QueryClient` is supplied once, as `useQueries`' own top-level second argument, rather than per query.
*
* Having the same query key more than once in the array of query objects may cause some data to be shared
* between queries. To avoid this, consider de-duplicating the queries and map the results back to the desired
* structure.
*
* The `combine` option can be used to combine the results of the queries into a single value. The result will
* be structurally shared to be as referentially stable as possible.
*
* @remarks The `combine` function only re-runs if it changed referentially, or if any of the query results
* changed. An inlined `combine` function, as shown in the example below, therefore runs on every render — wrap
* it in `useCallback`, or extract it to a stable function reference if it doesn't have any dependencies, to
* avoid that.
*
* Unlike `useQuery`, `useQueries` cannot infer the `data` argument of an _inline_ `select` from its sibling
* `queryFn`. Because `useQueries` infers the type of the whole `queries` array at once, the `select` parameter
* of a query object written inline cannot be contextually typed from that same object's `queryFn`, so it falls
* back to `unknown` — a [known TypeScript limitation](https://github.com/TanStack/query/issues/6556). Annotate
* the `select` parameter explicitly, or define the query with {@link queryOptions}, which resolves its types in
* a single object _before_ it reaches `useQueries`, to work around this — see the example below. The same
* limitation applies to {@link useSuspenseQueries}.
*
* `placeholderData` is supported here too, but unlike `useQuery`, it doesn't receive information from
* previously rendered queries, because the number of queries can differ between renders.
* @param queryClient - Use this to provide a custom `QueryClient`. Otherwise, the one from the nearest context
* will be used.
* @returns The combined result. Without `combine`, this is an array with all the query results, in the same
* order as the input. When `combine` is provided, this is the value returned by `combine` instead.
*
* @example
* ```tsx
* import { useQueries } from '@tanstack/react-query'
*
* function Posts({ ids }: { ids: Array<number> }) {
*   const postQueries = useQueries({
*     queries: ids.map((id) => ({
*       queryKey: ['post', id],
*       queryFn: () => fetchPost(id),
*       staleTime: Infinity,
*     })),
*   })
*
*   return (
*     <ul>
*       {postQueries.map((query, index) => {
*         if (query.isPending) return <li key={ids[index]}>Loading...</li>
*         if (query.isError) return <li key={ids[index]}>Error: {query.error.message}</li>
*         return <li key={ids[index]}>{query.data.title}</li>
*       })}
*     </ul>
*   )
* }
* ```
*
* @example
* Combining results into a single value:
* ```tsx
* import { useQueries } from '@tanstack/react-query'
*
* function Posts({ ids }: { ids: Array<number> }) {
*   const { data, isPending, isError } = useQueries({
*     queries: ids.map((id) => ({
*       queryKey: ['post', id],
*       queryFn: () => fetchPost(id),
*     })),
*     combine: (postQueries) => {
*       return {
*         data: postQueries.map((query) => query.data),
*         isPending: postQueries.some((query) => query.isPending),
*         isError: postQueries.some((query) => query.isError),
*       }
*     },
*   })
*
*   if (isPending) return 'Loading...'
*   if (isError) return 'Error loading posts'
*
*   return (
*     <ul>
*       {data.map((post) => (
*         <li key={post?.id}>{post?.title}</li>
*       ))}
*     </ul>
*   )
* }
* ```
*
* @example
* Typing `select` via {@link queryOptions}. Note that spreading a `queryOptions` result and overriding
* `select` inline still falls back to `unknown` — wrap the spread in `queryOptions` again so the override is
* resolved before it reaches `useQueries`:
* ```tsx
* import { queryOptions, useQueries } from '@tanstack/react-query'
*
* const postOptions = (id: number) =>
*   queryOptions({
*     queryKey: ['post', id],
*     queryFn: () => fetchPost(id),
*   })
*
* function PostTitle({ id }: { id: number }) {
*   const [{ data: broken }] = useQueries({
*     queries: [
*       {
*         ...postOptions(id),
*         // ❌ `data` is `unknown` here
*         select: (data) => data.title,
*       },
*     ],
*   })
*
*   const [{ data: fixed }] = useQueries({
*     queries: [
*       queryOptions({
*         ...postOptions(id),
*         // ✅ `data` is `Post`
*         select: (data) => data.title,
*       }),
*     ],
*   })
*
*   return <h1>{fixed}</h1>
* }
* ```
*/
function useQueries({ queries, ...options }, queryClient) {
	const client = useQueryClient(queryClient);
	const isRestoring = useIsRestoring();
	const errorResetBoundary = useQueryErrorResetBoundary();
	const subscribed = options.subscribed !== false;
	const defaultedQueries = import_react.useMemo(() => queries.map((opts) => {
		const defaultedOptions = client.defaultQueryOptions(opts);
		defaultedOptions._optimisticResults = isRestoring ? "isRestoring" : subscribed ? "optimistic" : void 0;
		return defaultedOptions;
	}), [
		queries,
		client,
		isRestoring,
		subscribed
	]);
	defaultedQueries.forEach((queryOptions) => {
		ensureSuspenseTimers(queryOptions);
		const query = client.getQueryCache().get(queryOptions.queryHash);
		ensurePreventErrorBoundaryRetry(queryOptions, errorResetBoundary, query);
	});
	useClearResetErrorBoundary(errorResetBoundary);
	const [observer] = import_react.useState(() => new QueriesObserver(client, defaultedQueries, options));
	const [optimisticResult, getCombinedResult, trackResult] = observer.getOptimisticResult(defaultedQueries, options.combine);
	const shouldSubscribe = !isRestoring && subscribed;
	import_react.useSyncExternalStore(import_react.useCallback((onStoreChange) => shouldSubscribe ? observer.subscribe(notifyManager.batchCalls(onStoreChange)) : noop, [observer, shouldSubscribe]), () => observer.getCurrentResult(), () => observer.getCurrentResult());
	import_react.useEffect(() => {
		observer.setQueries(defaultedQueries, options);
	}, [
		defaultedQueries,
		options,
		observer
	]);
	const suspensePromises = optimisticResult.some((result, index) => shouldSuspend(defaultedQueries[index], result)) ? optimisticResult.flatMap((result, index) => {
		const opts = defaultedQueries[index];
		if (opts && shouldSuspend(opts, result)) return fetchOptimistic(opts, new QueryObserver(client, opts), errorResetBoundary);
		return [];
	}) : [];
	if (suspensePromises.length > 0) throw Promise.all(suspensePromises);
	const firstSingleResultWhichShouldThrow = optimisticResult.find((result, index) => {
		const query = defaultedQueries[index];
		return query && getHasError({
			result,
			errorResetBoundary,
			throwOnError: query.throwOnError,
			query: client.getQueryCache().get(query.queryHash),
			suspense: query.suspense
		});
	});
	if (firstSingleResultWhichShouldThrow) throw firstSingleResultWhichShouldThrow.error;
	return getCombinedResult(trackResult());
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useBaseQuery.js
function useBaseQuery(options, Observer, queryClient) {
	if (typeof options !== "object" || Array.isArray(options)) throw new Error("Bad argument type. Starting with v5, only the \"Object\" form is allowed when calling query related functions. Please use the error stack to find the culprit call. More info here: https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5#supports-a-single-signature-one-object");
	const isRestoring = useIsRestoring();
	const errorResetBoundary = useQueryErrorResetBoundary();
	const client = useQueryClient(queryClient);
	const defaultedOptions = client.defaultQueryOptions(options);
	const query = client.getQueryCache().get(defaultedOptions.queryHash);
	if (!defaultedOptions.queryFn) console.error(`[${defaultedOptions.queryHash}]: No queryFn was passed as an option, and no default queryFn was found. The queryFn parameter is only optional when using a default queryFn. More info here: https://tanstack.com/query/latest/docs/framework/react/guides/default-query-function`);
	const subscribed = options.subscribed !== false;
	defaultedOptions._optimisticResults = isRestoring ? "isRestoring" : subscribed ? "optimistic" : void 0;
	ensureSuspenseTimers(defaultedOptions);
	ensurePreventErrorBoundaryRetry(defaultedOptions, errorResetBoundary, query);
	useClearResetErrorBoundary(errorResetBoundary);
	const [observer] = import_react.useState(() => new Observer(client, defaultedOptions));
	const result = observer.getOptimisticResult(defaultedOptions);
	const shouldSubscribe = !isRestoring && subscribed;
	import_react.useSyncExternalStore(import_react.useCallback((onStoreChange) => {
		const unsubscribe = shouldSubscribe ? observer.subscribe(notifyManager.batchCalls(onStoreChange)) : noop;
		observer.updateResult();
		return unsubscribe;
	}, [observer, shouldSubscribe]), () => observer.getCurrentResult(), () => observer.getCurrentResult());
	import_react.useEffect(() => {
		observer.setOptions(defaultedOptions);
	}, [defaultedOptions, observer]);
	if (shouldSuspend(defaultedOptions, result)) throw fetchOptimistic(defaultedOptions, observer, errorResetBoundary);
	if (getHasError({
		result,
		errorResetBoundary,
		throwOnError: defaultedOptions.throwOnError,
		query,
		suspense: defaultedOptions.suspense
	})) throw result.error;
	return !defaultedOptions.notifyOnChangeProps ? observer.trackResult(result) : result;
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useQuery.js
function useQuery(options, queryClient) {
	return useBaseQuery(options, QueryObserver, queryClient);
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useSuspenseQuery.js
/**
* The options for `useSuspenseQuery` are the same as for `useQuery`, except for `throwOnError`, `enabled`, and
* `placeholderData` — and `queryFn` may not be `skipToken`, since Suspense hooks can't render a "disabled" state.
*
* Caveat: cancellation does not work.
*
* @remarks Multiple `useSuspenseQuery` calls in the same component suspend serially, causing a request
* waterfall — each one blocks rendering until it resolves, so the next doesn't even start fetching until then.
* Use {@link useSuspenseQueries} instead when you have more than one suspenseful query in a component, so they
* fetch in parallel.
* @param options - The {@link UseSuspenseQueryOptions} to use — the same options as `useQuery`, minus the ones listed above.
* @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
* be used.
* @returns The same object as `useQuery`, except that `data` is guaranteed to be defined, `isPlaceholderData`
* is missing, and `status` is either `success` or `error` (with the derived flags set accordingly).
*
* @example
* The query error is thrown if the fetch fails and no cached data exists yet, so an error boundary is
* required around `<Suspense>`. A failed background refetch instead continues to render the cached data.
* Use {@link QueryErrorResetBoundary} to let the user retry after such an error:
* ```tsx
* import { Suspense } from 'react'
* import { ErrorBoundary } from 'react-error-boundary'
* import { QueryErrorResetBoundary, useSuspenseQuery } from '@tanstack/react-query'
*
* function Posts() {
*   // `data` is guaranteed to be defined here — no `isPending` check needed.
*   const { data, isFetching } = useSuspenseQuery({
*     queryKey: ['posts'],
*     queryFn: fetchPosts,
*   })
*
*   return (
*     <div>
*       <h1>Posts {isFetching ? '(refreshing...)' : null}</h1>
*       <ul>
*         {data.map((post) => (
*           <li key={post.id}>{post.title}</li>
*         ))}
*       </ul>
*     </div>
*   )
* }
*
* function App() {
*   return (
*     <QueryErrorResetBoundary>
*       {({ reset }) => (
*         <ErrorBoundary
*           onReset={reset}
*           fallbackRender={({ resetErrorBoundary }) => (
*             <div>
*               There was an error!
*               <button onClick={() => resetErrorBoundary()}>Try again</button>
*             </div>
*           )}
*         >
*           <Suspense fallback={<h1>Loading posts...</h1>}>
*             <Posts />
*           </Suspense>
*         </ErrorBoundary>
*       )}
*     </QueryErrorResetBoundary>
*   )
* }
* ```
*/
function useSuspenseQuery(options, queryClient) {
	if (options.queryFn === skipToken) console.error("skipToken is not allowed for useSuspenseQuery");
	return useBaseQuery({
		...options,
		enabled: true,
		suspense: true,
		throwOnError: defaultThrowOnError,
		placeholderData: void 0
	}, QueryObserver, queryClient);
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useSuspenseInfiniteQuery.js
/**
* The options for `useSuspenseInfiniteQuery` are the same as for `useInfiniteQuery`, except for `throwOnError`,
* `enabled`, and `placeholderData`.
*
* Caveat: cancellation does not work.
*
* @remarks Multiple suspenseful query calls in the same component suspend serially, causing a request
* waterfall — each one blocks rendering until it resolves, so the next doesn't even start fetching until
* then. There's no way to parallelize multiple infinite queries under Suspense. Also keep in mind that
* imperative fetch calls, such as `fetchNextPage`, may interfere with the default refetch behavior,
* resulting in outdated data. Make sure to call these functions only in response to user actions, or add
* conditions like `hasNextPage && !isFetching`.
* @see {@link useInfiniteQuery} for the non-Suspense version of this hook.
* @param options - The {@link UseSuspenseInfiniteQueryOptions} to use — the same options as `useInfiniteQuery`, minus the ones listed above.
* @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
* be used.
* @returns The same object as `useInfiniteQuery`, except that `data` is guaranteed to be defined,
* `isPlaceholderData` is missing, and `status` is either `success` or `error` (with the derived flags set
* accordingly).
*
* @example
* The query error is thrown if a fetch fails and no cached data exists yet, so an error boundary is
* required around `<Suspense>`. A failed background refetch instead continues to render the cached data.
* Use {@link QueryErrorResetBoundary} to let the user retry after such an error:
* ```tsx
* import { Suspense } from 'react'
* import { ErrorBoundary } from 'react-error-boundary'
* import {
*   QueryErrorResetBoundary,
*   useSuspenseInfiniteQuery,
* } from '@tanstack/react-query'
*
* function Projects() {
*   // `data` is guaranteed to be defined here — no `isPending` check needed.
*   const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
*     useSuspenseInfiniteQuery({
*       queryKey: ['projects'],
*       queryFn: ({ pageParam }) => fetchProjects(pageParam),
*       initialPageParam: 0,
*       getNextPageParam: (lastPage) => lastPage.nextId,
*     })
*
*   return (
*     <div>
*       <ul>
*         {data.pages.map((page) =>
*           page.projects.map((project) => <li key={project.id}>{project.name}</li>),
*         )}
*       </ul>
*       <button
*         onClick={() => fetchNextPage()}
*         disabled={!hasNextPage || isFetching}
*       >
*         {isFetchingNextPage
*           ? 'Loading more...'
*           : hasNextPage
*             ? 'Load More'
*             : 'Nothing more to load'}
*       </button>
*     </div>
*   )
* }
*
* function App() {
*   return (
*     <QueryErrorResetBoundary>
*       {({ reset }) => (
*         <ErrorBoundary
*           onReset={reset}
*           fallbackRender={({ resetErrorBoundary }) => (
*             <div>
*               There was an error!
*               <button onClick={() => resetErrorBoundary()}>Try again</button>
*             </div>
*           )}
*         >
*           <Suspense fallback={<h1>Loading projects...</h1>}>
*             <Projects />
*           </Suspense>
*         </ErrorBoundary>
*       )}
*     </QueryErrorResetBoundary>
*   )
* }
* ```
*/
function useSuspenseInfiniteQuery(options, queryClient) {
	if (options.queryFn === skipToken) console.error("skipToken is not allowed for useSuspenseInfiniteQuery");
	return useBaseQuery({
		...options,
		enabled: true,
		suspense: true,
		throwOnError: defaultThrowOnError,
		placeholderData: void 0
	}, InfiniteQueryObserver, queryClient);
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useSuspenseQueries.js
function useSuspenseQueries(options, queryClient) {
	return useQueries({
		...options,
		queries: options.queries.map((query) => {
			if (query.queryFn === skipToken) console.error("skipToken is not allowed for useSuspenseQueries");
			return {
				...query,
				suspense: true,
				throwOnError: defaultThrowOnError,
				enabled: true,
				placeholderData: void 0
			};
		})
	}, queryClient);
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/usePrefetchQuery.js
/**
* `usePrefetchQuery` does not return anything, it should be used just to fire a prefetch during render, before
* a suspense boundary that wraps a component that uses `useSuspenseQuery`. You can pass everything to
* `usePrefetchQuery` that you can pass to `queryClient.query`, though `queryKey` is always required, and
* `queryFn` is required unless a default query function has been defined.
*
* The prefetch is skipped if the query already has any cached state — including a `pending`/`error` state left
* over from a previous attempt — so calling this on every render is cheap and won't refetch data that's
* already there or already in flight.
*
* @param options - The {@link UsePrefetchQueryOptions} to use — everything you can pass to `queryClient.query`.
* @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
* be used.
* @returns `void` — nothing is returned.
*
* @example
* ```tsx
* import { Suspense } from 'react'
* import { usePrefetchQuery } from '@tanstack/react-query'
*
* function App() {
*   // Fire the prefetch during render, before the suspense boundary below.
*   usePrefetchQuery({
*     queryKey: ['posts'],
*     queryFn: fetchPosts,
*   })
*
*   return (
*     <Suspense fallback={<h1>Loading posts...</h1>}>
*       <Posts />
*     </Suspense>
*   )
* }
* ```
*/
function usePrefetchQuery(options, queryClient) {
	const client = useQueryClient(queryClient);
	if (!client.getQueryState(options.queryKey)) client.query(options).catch(noop);
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/usePrefetchInfiniteQuery.js
/**
* `usePrefetchInfiniteQuery` does not return anything, it should be used just to fire a prefetch during render,
* before a suspense boundary that wraps a component that uses `useSuspenseInfiniteQuery`. You can pass
* everything to `usePrefetchInfiniteQuery` that you can pass to `queryClient.infiniteQuery`, though
* `queryKey`, `initialPageParam`, and `getNextPageParam` are always required, and `queryFn` is required unless
* a default query function has been defined.
*
* `getNextPageParam` receives both the last page of the infinite list of data and the full array of all pages,
* as well as pageParam information, and should return a single variable that will be passed to your query
* function as `context.pageParam`. Return `undefined` or `null` to indicate there is no next page available.
*
* The prefetch is skipped if the query already has any cached state — including a `pending`/`error` state left
* over from a previous attempt — so calling this on every render is cheap and won't refetch data that's
* already there or already in flight.
*
* @param options - The {@link UsePrefetchInfiniteQueryOptions} to use — everything you can pass to `queryClient.infiniteQuery`.
* @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
* be used.
* @returns `void` — nothing is returned.
*
* @example
* ```tsx
* import { Suspense } from 'react'
* import { infiniteQueryOptions, usePrefetchInfiniteQuery } from '@tanstack/react-query'
*
* const projectsOptions = infiniteQueryOptions({
*   queryKey: ['projects'],
*   queryFn: ({ pageParam }) => fetchProjects(pageParam),
*   initialPageParam: 0,
*   getNextPageParam: (lastPage) => lastPage.nextId,
* })
*
* function App() {
*   // Fire the prefetch during render, before the suspense boundary below.
*   usePrefetchInfiniteQuery(projectsOptions)
*
*   return (
*     <Suspense fallback={<h1>Loading projects...</h1>}>
*       <Projects />
*     </Suspense>
*   )
* }
* ```
*/
function usePrefetchInfiniteQuery(options, queryClient) {
	const client = useQueryClient(queryClient);
	if (!client.getQueryState(options.queryKey)) client.infiniteQuery(options).catch(noop);
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/queryOptions.js
function queryOptions(options) {
	return options;
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/infiniteQueryOptions.js
function infiniteQueryOptions(options) {
	return options;
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useIsFetching.js
/**
* The `useIsFetching` hook returns the `number` of the queries that your application is loading or fetching in
* the background (useful for app-wide loading indicators).
*
* @param filters - The {@link QueryFilters} to narrow down the matched queries.
* @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
* be used.
* @returns Will be the `number` of the queries that your application is currently loading or fetching in the
* background.
*
* @example
* ```tsx
* import { useIsFetching } from '@tanstack/react-query'
*
* function PostsFetchingIndicator() {
*   // How many queries matching the posts prefix are fetching?
*   const isFetchingPosts = useIsFetching({ queryKey: ['posts'] })
*
*   return isFetchingPosts ? <span>Refreshing posts...</span> : null
* }
* ```
*
* @example
* A global loading indicator for any query fetching in the background, not just the ones on screen:
* ```tsx
* import { useIsFetching } from '@tanstack/react-query'
*
* function GlobalLoadingIndicator() {
*   const isFetching = useIsFetching()
*
*   return isFetching ? (
*     <div>Queries are fetching in the background...</div>
*   ) : null
* }
* ```
*/
function useIsFetching(filters, queryClient) {
	const client = useQueryClient(queryClient);
	const queryCache = client.getQueryCache();
	return import_react.useSyncExternalStore(import_react.useCallback((onStoreChange) => queryCache.subscribe(notifyManager.batchCalls(onStoreChange)), [queryCache]), () => client.isFetching(filters), () => client.isFetching(filters));
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useMutationState.js
/**
* The `useIsMutating` hook returns the `number` of mutations that your application currently has `pending`
* (useful for app-wide loading indicators).
*
* @param filters - The {@link MutationFilters} to narrow down the matched mutations.
* @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
* be used.
* @returns Will be the `number` of the mutations that your application currently has `pending`.
*
* @example
* ```tsx
* import { useIsMutating } from '@tanstack/react-query'
*
* function PostsMutatingIndicator() {
*   // How many mutations matching the posts prefix are in progress?
*   const isMutatingPosts = useIsMutating({ mutationKey: ['posts'] })
*
*   return isMutatingPosts ? <span>Saving posts...</span> : null
* }
* ```
*/
function useIsMutating(filters, queryClient) {
	const client = useQueryClient(queryClient);
	return useMutationState({ filters: {
		...filters,
		status: "pending"
	} }, client).length;
}
function getResult(mutationCache, options) {
	return mutationCache.findAll(options.filters).map((mutation) => options.select ? options.select(mutation) : mutation.state);
}
/**
* `useMutationState` is a hook that gives you access to all mutations in the `MutationCache`. You can pass
* `filters` ({@link MutationFilters}) to narrow down your mutations, and `select` to transform the mutation
* state.
*
* @param options - The `filters` to narrow down matched mutations, and an optional `select` to transform the
* mutation state.
* @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
* be used.
* @returns Will be an Array of whatever `select` returns for each matching mutation.
*
* @example
* Get all variables of all running mutations:
* ```tsx
* import { useMutationState } from '@tanstack/react-query'
*
* function PendingPosts() {
*   const pendingVariables = useMutationState({
*     filters: { status: 'pending' },
*     select: (mutation) => mutation.state.variables,
*   })
*
*   return <>{pendingVariables.length} posts saving...</>
* }
* ```
*
* @example
* Get all data for specific mutations via the `mutationKey`:
* ```tsx
* import { useMutation, useMutationState } from '@tanstack/react-query'
*
* const mutationKey = ['posts']
*
* function Posts() {
*   // Some mutation that we want to get the state for
*   const mutation = useMutation({
*     mutationKey,
*     mutationFn: createPosts,
*   })
*
*   const savedPosts = useMutationState({
*     // this mutation key needs to match the mutation key of the given mutation (see above)
*     filters: { mutationKey, status: 'success' },
*     select: (mutation) => mutation.state.data,
*   })
*
*   return (
*     <button onClick={() => mutation.mutate(['New Post'])}>
*       Create post ({savedPosts.length} saved so far)
*     </button>
*   )
* }
* ```
*
* @example
* Access the latest successful mutation data via the `mutationKey`. Each invocation of `mutate` adds a new
* entry to the mutation cache for `gcTime` milliseconds — with the `status: 'success'` filter below, check the
* last item that `useMutationState` returns to get the latest successful invocation:
* ```tsx
* import { useMutationState } from '@tanstack/react-query'
*
* function LatestPost() {
*   const savedPosts = useMutationState({
*     filters: { mutationKey: ['posts'], status: 'success' },
*     select: (mutation) => mutation.state.data,
*   })
*
*   const latestSavedPost = savedPosts[savedPosts.length - 1]
*
*   return <>{latestSavedPost ? 'Saved' : 'Nothing saved yet'}</>
* }
* ```
*/
function useMutationState(options = {}, queryClient) {
	const mutationCache = useQueryClient(queryClient).getMutationCache();
	const optionsRef = import_react.useRef(options);
	const result = import_react.useRef(null);
	if (result.current === null) result.current = getResult(mutationCache, options);
	import_react.useEffect(() => {
		optionsRef.current = options;
	});
	return import_react.useSyncExternalStore(import_react.useCallback((onStoreChange) => mutationCache.subscribe(() => {
		const nextResult = replaceEqualDeep(result.current, getResult(mutationCache, optionsRef.current));
		if (result.current !== nextResult) {
			result.current = nextResult;
			notifyManager.schedule(onStoreChange);
		}
	}), [mutationCache]), () => result.current, () => result.current);
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useMutation.js
/**
* Unlike queries, mutations are typically used to create/update/delete data or perform server side-effects.
* `useMutation` is the hook for that.
*
* @see {@link mutationOptions} to share these options across multiple `useMutation` call sites, or to look
* the mutation up elsewhere via its `mutationKey` (e.g. with `useMutationState`).
* @param options - The {@link UseMutationOptions} to use — everything you can pass to `useMutation`.
* @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
* be used.
* @returns `mutate`/`mutateAsync` also accept per-call `onSuccess`/`onError`/`onSettled` callbacks as a second
* argument, useful for triggering call-site side effects (e.g. navigation) without coupling them to the shared
* mutation definition. Hook-level callbacks (passed to `options`) fire for every mutation; per-call callbacks
* fire only for the latest call you've made, and only while the component is still mounted — unmounting before
* the mutation settles removes the subscription and prevents them from firing.
*
* @example
* ```tsx
* import { useMutation, useQueryClient } from '@tanstack/react-query'
*
* function AddTodo() {
*   const queryClient = useQueryClient()
*
*   const addMutation = useMutation({
*     mutationFn: addTodo,
*     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
*   })
*
*   return (
*     <button
*       onClick={() =>
*         addMutation.mutate('Item', {
*           onError: (error) => console.error('Failed to add item:', error),
*         })
*       }
*     >
*       Add
*     </button>
*   )
* }
* ```
*
* @example
* Rendering the mutation's own state, rather than just firing it off:
* ```tsx
* import { useMutation, useQueryClient } from '@tanstack/react-query'
*
* function AddTodo() {
*   const queryClient = useQueryClient()
*
*   const addMutation = useMutation({
*     mutationFn: addTodo,
*     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
*   })
*
*   return (
*     <div>
*       {addMutation.isPending ? (
*         'Adding todo...'
*       ) : (
*         <>
*           {addMutation.isError ? (
*             <div>An error occurred: {addMutation.error.message}</div>
*           ) : null}
*           <button onClick={() => addMutation.mutate('Item')}>Add</button>
*         </>
*       )}
*     </div>
*   )
* }
* ```
*
* @example
* Optimistic update via `onMutate`, rolling back on `onError`:
* ```tsx
* import { useMutation, useQueryClient } from '@tanstack/react-query'
*
* function AddTodo() {
*   const queryClient = useQueryClient()
*
*   const addMutation = useMutation({
*     mutationFn: addTodo,
*     onMutate: async (newTodo) => {
*       await queryClient.cancelQueries({ queryKey: ['todos'] })
*       const previousTodos = queryClient.getQueryData<Array<string>>(['todos'])
*
*       queryClient.setQueryData<Array<string>>(['todos'], (old) => [
*         ...(old ?? []),
*         newTodo,
*       ])
*
*       // Passed to `onError` as `onMutateResult` if the mutation fails.
*       return { previousTodos }
*     },
*     onError: (_err, _newTodo, onMutateResult) => {
*       queryClient.setQueryData(['todos'], onMutateResult?.previousTodos)
*     },
*     onSettled: () => {
*       queryClient.invalidateQueries({ queryKey: ['todos'] })
*     },
*   })
*
*   return (
*     <button onClick={() => addMutation.mutate('Item')}>Add</button>
*   )
* }
* ```
*
* @example
* Callbacks passed per call to `mutate` only fire for the last call — `mutateAsync` gives you a
* promise per call instead, so you can wait for all of them when they succeed:
* ```tsx
* import { useMutation, useQueryClient } from '@tanstack/react-query'
*
* function AddTodos() {
*   const queryClient = useQueryClient()
*
*   const addMutation = useMutation({
*     mutationFn: addTodo,
*     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
*   })
*
*   async function handleAddAll(todos: Array<string>) {
*     try {
*       await Promise.all(todos.map((todo) => addMutation.mutateAsync(todo)))
*     } catch (error) {
*       console.error('Failed to add todos:', error)
*     }
*   }
*
*   return (
*     <button onClick={() => handleAddAll(['Todo 1', 'Todo 2', 'Todo 3'])}>
*       Add all
*     </button>
*   )
* }
* ```
*
* @example
* If some of the mutations above can fail independently of the others, and you want to know which ones
* did — rather than losing that information the moment the first one rejects — swap `Promise.all` for
* `Promise.allSettled`:
* ```tsx
* import { useMutation, useQueryClient } from '@tanstack/react-query'
*
* function AddTodos() {
*   const queryClient = useQueryClient()
*
*   const addMutation = useMutation({
*     mutationFn: addTodo,
*     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
*   })
*
*   async function handleAddAll(todos: Array<string>) {
*     const addResults = await Promise.allSettled(
*       todos.map((todo) => addMutation.mutateAsync(todo)),
*     )
*
*     addResults.forEach((addResult, index) => {
*       if (addResult.status === 'rejected') {
*         console.error(`Failed to add "${todos[index]}":`, addResult.reason)
*       }
*     })
*   }
*
*   return (
*     <button onClick={() => handleAddAll(['Todo 1', 'Todo 2', 'Todo 3'])}>
*       Add all
*     </button>
*   )
* }
* ```
*/
function useMutation(options, queryClient) {
	const client = useQueryClient(queryClient);
	const [observer] = import_react.useState(() => new MutationObserver(client, options));
	import_react.useEffect(() => {
		observer.setOptions(options);
	}, [observer, options]);
	const result = import_react.useSyncExternalStore(import_react.useCallback((onStoreChange) => observer.subscribe(notifyManager.batchCalls(onStoreChange)), [observer]), () => observer.getCurrentResult(), () => observer.getCurrentResult());
	const mutate = import_react.useCallback((...args) => {
		observer.mutate(args[0], args[1]).catch(noop);
	}, [observer]);
	if (result.error && shouldThrowError(observer.options.throwOnError, [result.error])) throw result.error;
	return {
		...result,
		mutate,
		mutateAsync: result.mutate
	};
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/mutationOptions.js
function mutationOptions(options) {
	return options;
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/useInfiniteQuery.js
function useInfiniteQuery(options, queryClient) {
	return useBaseQuery(options, InfiniteQueryObserver, queryClient);
}
//#endregion
//#region node_modules/@tanstack/react-query/build/modern/index.js
/* istanbul ignore file */
//#endregion
export { CancelledError, HydrationBoundary, InfiniteQueryObserver, IsRestoringProvider, Mutation, MutationCache, MutationObserver, QueriesObserver, Query, QueryCache, QueryClient, QueryClientContext, QueryClientProvider, QueryErrorResetBoundary, QueryObserver, dataTagErrorSymbol, dataTagSymbol, defaultScheduler, defaultShouldDehydrateMutation, defaultShouldDehydrateQuery, dehydrate, dehydrateQuery, environmentManager, streamedQuery as experimental_streamedQuery, focusManager, hashKey, hydrate, infiniteQueryOptions, isCancelledError, isServer, keepPreviousData, matchMutation, matchQuery, mutationOptions, noop, notifyManager, onlineManager, partialMatchKey, queryOptions, replaceEqualDeep, shouldThrowError, skipToken, timeoutManager, unsetMarker, useInfiniteQuery, useIsFetching, useIsMutating, useIsRestoring, useMutation, useMutationState, usePrefetchInfiniteQuery, usePrefetchQuery, useQueries, useQuery, useQueryClient, useQueryErrorResetBoundary, useSuspenseInfiniteQuery, useSuspenseQueries, useSuspenseQuery };
