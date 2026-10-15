import { SHOULD_AUTOBATCH, combineReducers, createAction, createAsyncThunk, createNextState, createSelector, createSlice, formatProdErrorMessage, isAction, isAllOf, isAnyOf, isAsyncThunkAction, isFulfilled, isPending, isPlainObject as isPlainObject$1, isRejected, isRejectedWithValue, nanoid, prepareAutoBatched } from "@reduxjs/toolkit";
import { applyPatches, current, enablePatches, isDraft, isDraftable, original, produceWithPatches } from "immer";
import { SchemaError } from "@standard-schema/utils";
import { weakMapMemoize } from "reselect";
//#region src/query/core/apiState.ts
let QueryStatus = /* @__PURE__ */ function(QueryStatus) {
	QueryStatus["uninitialized"] = "uninitialized";
	QueryStatus["pending"] = "pending";
	QueryStatus["fulfilled"] = "fulfilled";
	QueryStatus["rejected"] = "rejected";
	return QueryStatus;
}({});
const STATUS_UNINITIALIZED = "uninitialized";
const STATUS_PENDING = "pending";
const STATUS_FULFILLED = "fulfilled";
const STATUS_REJECTED = "rejected";
function getRequestStatusFlags(status) {
	return {
		status,
		isUninitialized: status === STATUS_UNINITIALIZED,
		isLoading: status === STATUS_PENDING,
		isSuccess: status === STATUS_FULFILLED,
		isError: status === STATUS_REJECTED
	};
}
//#endregion
//#region src/query/utils/copyWithStructuralSharing.ts
const isPlainObject = isPlainObject$1;
function copyWithStructuralSharing(oldObj, newObj) {
	if (oldObj === newObj || !(isPlainObject(oldObj) && isPlainObject(newObj) || Array.isArray(oldObj) && Array.isArray(newObj))) return newObj;
	const newKeys = Object.keys(newObj);
	const oldKeys = Object.keys(oldObj);
	let isSameObject = newKeys.length === oldKeys.length;
	const mergeObj = Array.isArray(newObj) ? [] : {};
	for (const key of newKeys) {
		mergeObj[key] = copyWithStructuralSharing(oldObj[key], newObj[key]);
		if (isSameObject) isSameObject = oldObj[key] === mergeObj[key];
	}
	return isSameObject ? oldObj : mergeObj;
}
//#endregion
//#region src/query/utils/filterMap.ts
function filterMap(array, predicate, mapper) {
	return array.reduce((acc, item, i) => {
		if (predicate(item, i)) acc.push(mapper(item, i));
		return acc;
	}, []).flat();
}
//#endregion
//#region src/query/utils/isAbsoluteUrl.ts
function isAbsoluteUrl(url) {
	return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}
//#endregion
//#region src/query/utils/isDocumentVisible.ts
function isDocumentVisible() {
	if (typeof document === "undefined") return true;
	return document.visibilityState !== "hidden";
}
//#endregion
//#region src/query/utils/isNotNullish.ts
function isNotNullish(v) {
	return v != null;
}
function filterNullishValues(map) {
	var _map$values;
	return [...(_map$values = map === null || map === void 0 ? void 0 : map.values()) !== null && _map$values !== void 0 ? _map$values : []].filter(isNotNullish);
}
//#endregion
//#region src/query/utils/isOnline.ts
function isOnline() {
	return typeof navigator === "undefined" ? true : navigator.onLine === void 0 ? true : navigator.onLine;
}
//#endregion
//#region src/query/utils/joinUrls.ts
const withoutTrailingSlash = (url) => url.replace(/\/$/, "");
const withoutLeadingSlash = (url) => url.replace(/^\//, "");
function joinUrls(base, url) {
	if (!base) return url;
	if (!url) return base;
	if (isAbsoluteUrl(url)) return url;
	const delimiter = base.endsWith("/") || !url.startsWith("?") ? "/" : "";
	base = withoutTrailingSlash(base);
	url = withoutLeadingSlash(url);
	return `${base}${delimiter}${url}`;
}
//#endregion
//#region src/query/utils/getOrInsert.ts
function getOrInsertComputed(map, key, compute) {
	if (map.has(key)) return map.get(key);
	return map.set(key, compute(key)).get(key);
}
const createNewMap = () => /* @__PURE__ */ new Map();
//#endregion
//#region src/query/utils/signals.ts
const timeoutSignal = (milliseconds) => {
	const abortController = new AbortController();
	setTimeout(() => {
		const message = "signal timed out";
		const name = "TimeoutError";
		abortController.abort(typeof DOMException !== "undefined" ? new DOMException(message, name) : Object.assign(/* @__PURE__ */ new Error(message), { name }));
	}, milliseconds);
	return abortController.signal;
};
const anySignal = (...signals) => {
	for (const signal of signals) if (signal.aborted) return AbortSignal.abort(signal.reason);
	const abortController = new AbortController();
	for (const signal of signals) signal.addEventListener("abort", () => abortController.abort(signal.reason), {
		signal: abortController.signal,
		once: true
	});
	return abortController.signal;
};
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/typeof.js
function _typeof(o) {
	"@babel/helpers - typeof";
	return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof(o);
}
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/toPrimitive.js
function toPrimitive(t, r) {
	if ("object" != _typeof(t) || !t) return t;
	var e = t[Symbol.toPrimitive];
	if (void 0 !== e) {
		var i = e.call(t, r || "default");
		if ("object" != _typeof(i)) return i;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return ("string" === r ? String : Number)(t);
}
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/toPropertyKey.js
function toPropertyKey(t) {
	var i = toPrimitive(t, "string");
	return "symbol" == _typeof(i) ? i : i + "";
}
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/defineProperty.js
function _defineProperty(e, r, t) {
	return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
		value: t,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[r] = t, e;
}
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/objectSpread2.js
function ownKeys(e, r) {
	var t = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var o = Object.getOwnPropertySymbols(e);
		r && (o = o.filter(function(r) {
			return Object.getOwnPropertyDescriptor(e, r).enumerable;
		})), t.push.apply(t, o);
	}
	return t;
}
function _objectSpread2(e) {
	for (var r = 1; r < arguments.length; r++) {
		var t = null != arguments[r] ? arguments[r] : {};
		r % 2 ? ownKeys(Object(t), !0).forEach(function(r) {
			_defineProperty(e, r, t[r]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function(r) {
			Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
		});
	}
	return e;
}
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/objectWithoutPropertiesLoose.js
function _objectWithoutPropertiesLoose(r, e) {
	if (null == r) return {};
	var t = {};
	for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
		if (e.includes(n)) continue;
		t[n] = r[n];
	}
	return t;
}
//#endregion
//#region \0@oxc-project+runtime@0.144.0/helpers/esm/objectWithoutProperties.js
function _objectWithoutProperties(e, t) {
	if (null == e) return {};
	var o, r, i = _objectWithoutPropertiesLoose(e, t);
	if (Object.getOwnPropertySymbols) {
		var s = Object.getOwnPropertySymbols(e);
		for (r = 0; r < s.length; r++) o = s[r], t.includes(o) || {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]);
	}
	return i;
}
//#endregion
//#region src/query/fetchBaseQuery.ts
const _excluded = [
	"baseUrl",
	"prepareHeaders",
	"fetchFn",
	"paramsSerializer",
	"isJsonContentType",
	"jsonContentType",
	"jsonReplacer",
	"timeout",
	"responseHandler",
	"validateStatus"
];
const _excluded2 = [
	"url",
	"headers",
	"params",
	"responseHandler",
	"validateStatus",
	"timeout"
];
const defaultFetchFn = (...args) => fetch(...args);
const defaultValidateStatus = (response) => response.status >= 200 && response.status <= 299;
const defaultIsJsonContentType = (headers) => /ion\/(vnd\.api\+)?json/.test(headers.get("content-type") || "");
function stripUndefined(obj) {
	if (!isPlainObject$1(obj)) return obj;
	const copy = _objectSpread2({}, obj);
	for (const [k, v] of Object.entries(copy)) if (v === void 0) delete copy[k];
	return copy;
}
const isJsonifiable = (body) => typeof body === "object" && (isPlainObject$1(body) || Array.isArray(body) || typeof body.toJSON === "function");
function fetchBaseQuery(_ref = {}) {
	let { baseUrl, prepareHeaders = (x) => x, fetchFn = defaultFetchFn, paramsSerializer, isJsonContentType = defaultIsJsonContentType, jsonContentType = "application/json", jsonReplacer, timeout: defaultTimeout, responseHandler: globalResponseHandler, validateStatus: globalValidateStatus } = _ref, baseFetchOptions = _objectWithoutProperties(_ref, _excluded);
	if (typeof fetch === "undefined" && fetchFn === defaultFetchFn) console.warn("Warning: `fetch` is not available. Please supply a custom `fetchFn` property to use `fetchBaseQuery` on SSR environments.");
	return async (arg, api, extraOptions) => {
		const { getState, extra, endpoint, forced, type } = api;
		let meta;
		let _ref2 = typeof arg == "string" ? { url: arg } : arg, { url, headers = new Headers(baseFetchOptions.headers), params = void 0, responseHandler = globalResponseHandler !== null && globalResponseHandler !== void 0 ? globalResponseHandler : "json", validateStatus = globalValidateStatus !== null && globalValidateStatus !== void 0 ? globalValidateStatus : defaultValidateStatus, timeout = defaultTimeout } = _ref2, rest = _objectWithoutProperties(_ref2, _excluded2);
		let config = _objectSpread2(_objectSpread2({}, baseFetchOptions), {}, { signal: timeout ? anySignal(api.signal, timeoutSignal(timeout)) : api.signal }, rest);
		headers = new Headers(stripUndefined(headers));
		config.headers = await prepareHeaders(headers, {
			getState,
			arg,
			extra,
			endpoint,
			forced,
			type,
			extraOptions
		}) || headers;
		const bodyIsJsonifiable = isJsonifiable(config.body);
		if (config.body != null && !bodyIsJsonifiable && typeof config.body !== "string") config.headers.delete("content-type");
		if (!config.headers.has("content-type") && bodyIsJsonifiable) config.headers.set("content-type", jsonContentType);
		if (bodyIsJsonifiable && isJsonContentType(config.headers)) config.body = JSON.stringify(config.body, jsonReplacer);
		if (!config.headers.has("accept")) {
			if (responseHandler === "json") config.headers.set("accept", "application/json");
			else if (responseHandler === "text") config.headers.set("accept", "text/plain, text/html, */*");
		}
		if (params) {
			const divider = ~url.indexOf("?") ? "&" : "?";
			const query = paramsSerializer ? paramsSerializer(params) : new URLSearchParams(stripUndefined(params));
			url += divider + query;
		}
		url = joinUrls(baseUrl, url);
		const request = new Request(url, config);
		meta = { request: new Request(url, config) };
		let response;
		try {
			response = await fetchFn(request);
		} catch (e) {
			return {
				error: {
					status: (e instanceof Error || typeof DOMException !== "undefined" && e instanceof DOMException) && e.name === "TimeoutError" ? "TIMEOUT_ERROR" : "FETCH_ERROR",
					error: String(e)
				},
				meta
			};
		}
		const responseClone = response.clone();
		meta.response = responseClone;
		let resultData;
		let responseText = "";
		try {
			let handleResponseError;
			await Promise.all([handleResponse(response, responseHandler).then((r) => resultData = r, (e) => handleResponseError = e), responseClone.text().then((r) => responseText = r, () => {})]);
			if (handleResponseError) throw handleResponseError;
		} catch (e) {
			return {
				error: {
					status: "PARSING_ERROR",
					originalStatus: response.status,
					data: responseText,
					error: String(e)
				},
				meta
			};
		}
		return validateStatus(response, resultData) ? {
			data: resultData,
			meta
		} : {
			error: {
				status: response.status,
				data: resultData
			},
			meta
		};
	};
	async function handleResponse(response, responseHandler) {
		if (typeof responseHandler === "function") return responseHandler(response);
		if (responseHandler === "content-type") responseHandler = isJsonContentType(response.headers) ? "json" : "text";
		if (responseHandler === "json") {
			const text = await response.text();
			return text.length ? JSON.parse(text) : null;
		}
		return response.text();
	}
}
//#endregion
//#region src/query/HandledError.ts
var HandledError = class {
	constructor(value, meta = void 0) {
		this.value = value;
		this.meta = meta;
	}
};
//#endregion
//#region src/query/retry.ts
async function defaultBackoff(attempt = 0, maxRetries = 5, signal) {
	const attempts = Math.min(attempt, maxRetries);
	const timeout = ~~((Math.random() + .4) * (300 << attempts));
	await new Promise((resolve, reject) => {
		const timeoutId = setTimeout(() => resolve(), timeout);
		if (signal) {
			const abortHandler = () => {
				clearTimeout(timeoutId);
				reject(/* @__PURE__ */ new Error("Aborted"));
			};
			if (signal.aborted) {
				clearTimeout(timeoutId);
				reject(/* @__PURE__ */ new Error("Aborted"));
			} else signal.addEventListener("abort", abortHandler, { once: true });
		}
	});
}
function fail(error, meta) {
	throw Object.assign(new HandledError({
		error,
		meta
	}), { throwImmediately: true });
}
function failIfAborted(signal) {
	if (signal.aborted) fail({
		status: "CUSTOM_ERROR",
		error: "Aborted"
	});
}
const EMPTY_OPTIONS = {};
const retryWithBackoff = (baseQuery, defaultOptions) => async (args, api, extraOptions) => {
	const [maxRetries] = [
		5,
		(defaultOptions || EMPTY_OPTIONS).maxRetries,
		(extraOptions || EMPTY_OPTIONS).maxRetries
	].filter((x) => x !== void 0).slice(-1);
	const defaultRetryCondition = (_, __, { attempt }) => attempt <= maxRetries;
	const options = _objectSpread2(_objectSpread2({
		maxRetries,
		backoff: defaultBackoff,
		retryCondition: defaultRetryCondition
	}, defaultOptions), extraOptions);
	let retry = 0;
	while (true) {
		failIfAborted(api.signal);
		try {
			const result = await baseQuery(args, api, extraOptions);
			if (result.error) throw new HandledError(result);
			return result;
		} catch (e) {
			retry++;
			if (e.throwImmediately) {
				if (e instanceof HandledError) return e.value;
				throw e;
			}
			if (e instanceof HandledError) {
				if (!options.retryCondition(e.value.error, args, {
					attempt: retry,
					baseQueryApi: api,
					extraOptions
				})) return e.value;
			} else if (retry > options.maxRetries) return { error: e };
			failIfAborted(api.signal);
			try {
				await options.backoff(retry, options.maxRetries, api.signal);
			} catch (backoffError) {
				failIfAborted(api.signal);
				throw backoffError;
			}
		}
	}
};
const retry = /* @__PURE__ */ Object.assign(retryWithBackoff, { fail });
//#endregion
//#region src/query/core/setupListeners.ts
const INTERNAL_PREFIX = "__rtkq/";
const ONLINE = "online";
const OFFLINE = "offline";
const FOCUS = "focus";
const FOCUSED = "focused";
const VISIBILITYCHANGE = "visibilitychange";
const onFocus = /* @__PURE__ */ createAction(`${INTERNAL_PREFIX}${FOCUSED}`);
const onFocusLost = /* @__PURE__ */ createAction(`${INTERNAL_PREFIX}un${FOCUSED}`);
const onOnline = /* @__PURE__ */ createAction(`${INTERNAL_PREFIX}${ONLINE}`);
const onOffline = /* @__PURE__ */ createAction(`${INTERNAL_PREFIX}${OFFLINE}`);
const actions = {
	onFocus,
	onFocusLost,
	onOnline,
	onOffline
};
let initialized = false;
function setupListeners(dispatch, customHandler) {
	function defaultHandler() {
		const [handleFocus, handleFocusLost, handleOnline, handleOffline] = [
			onFocus,
			onFocusLost,
			onOnline,
			onOffline
		].map((action) => () => dispatch(action()));
		const handleVisibilityChange = () => {
			if (window.document.visibilityState === "visible") handleFocus();
			else handleFocusLost();
		};
		let unsubscribe = () => {
			initialized = false;
		};
		if (!initialized) {
			if (typeof window !== "undefined" && window.addEventListener) {
				const handlers = {
					[FOCUS]: handleFocus,
					[VISIBILITYCHANGE]: handleVisibilityChange,
					[ONLINE]: handleOnline,
					[OFFLINE]: handleOffline
				};
				function updateListeners(add) {
					Object.entries(handlers).forEach(([event, handler]) => {
						if (add) window.addEventListener(event, handler, false);
						else window.removeEventListener(event, handler);
					});
				}
				updateListeners(true);
				initialized = true;
				unsubscribe = () => {
					updateListeners(false);
					initialized = false;
				};
			}
		}
		return unsubscribe;
	}
	return customHandler ? customHandler(dispatch, actions) : defaultHandler();
}
//#endregion
//#region src/query/endpointDefinitions.ts
const ENDPOINT_QUERY = "query";
const ENDPOINT_MUTATION = "mutation";
const ENDPOINT_INFINITEQUERY = "infinitequery";
function isQueryDefinition(e) {
	return e.type === ENDPOINT_QUERY;
}
function isMutationDefinition(e) {
	return e.type === ENDPOINT_MUTATION;
}
function isInfiniteQueryDefinition(e) {
	return e.type === ENDPOINT_INFINITEQUERY;
}
function isAnyQueryDefinition(e) {
	return isQueryDefinition(e) || isInfiniteQueryDefinition(e);
}
function calculateProvidedBy(description, result, error, queryArg, meta, assertTagTypes) {
	const finalDescription = isFunction(description) ? description(result, error, queryArg, meta) : description;
	if (finalDescription) return filterMap(finalDescription, isNotNullish, (tag) => assertTagTypes(expandTagDescription(tag)));
	return [];
}
function isFunction(t) {
	return typeof t === "function";
}
function expandTagDescription(description) {
	return typeof description === "string" ? { type: description } : description;
}
//#endregion
//#region src/tsHelpers.ts
function asSafePromise(promise, fallback) {
	return promise.catch(fallback);
}
//#endregion
//#region src/query/apiTypes.ts
const getEndpointDefinition = (context, endpointName) => context.endpointDefinitions[endpointName];
//#endregion
//#region src/query/core/buildInitiate.ts
const forceQueryFnSymbol = Symbol("forceQueryFn");
const isUpsertQuery = (arg) => typeof arg[forceQueryFnSymbol] === "function";
function buildInitiate({ serializeQueryArgs, queryThunk, infiniteQueryThunk, mutationThunk, api, context, getInternalState }) {
	const getRunningQueries = (dispatch) => {
		var _getInternalState;
		return (_getInternalState = getInternalState(dispatch)) === null || _getInternalState === void 0 ? void 0 : _getInternalState.runningQueries;
	};
	const getRunningMutations = (dispatch) => {
		var _getInternalState2;
		return (_getInternalState2 = getInternalState(dispatch)) === null || _getInternalState2 === void 0 ? void 0 : _getInternalState2.runningMutations;
	};
	const { unsubscribeQueryResult, removeMutationResult, updateSubscriptionOptions } = api.internalActions;
	return {
		buildInitiateQuery,
		buildInitiateInfiniteQuery,
		buildInitiateMutation,
		getRunningQueryThunk,
		getRunningMutationThunk,
		getRunningQueriesThunk,
		getRunningMutationsThunk
	};
	function getRunningQueryThunk(endpointName, queryArgs) {
		return (dispatch) => {
			var _getRunningQueries;
			const queryCacheKey = serializeQueryArgs({
				queryArgs,
				endpointDefinition: getEndpointDefinition(context, endpointName),
				endpointName
			});
			return (_getRunningQueries = getRunningQueries(dispatch)) === null || _getRunningQueries === void 0 ? void 0 : _getRunningQueries.get(queryCacheKey);
		};
	}
	function getRunningMutationThunk(_endpointName, fixedCacheKeyOrRequestId) {
		return (dispatch) => {
			var _getRunningMutations;
			return (_getRunningMutations = getRunningMutations(dispatch)) === null || _getRunningMutations === void 0 ? void 0 : _getRunningMutations.get(fixedCacheKeyOrRequestId);
		};
	}
	function getRunningQueriesThunk() {
		return (dispatch) => filterNullishValues(getRunningQueries(dispatch));
	}
	function getRunningMutationsThunk() {
		return (dispatch) => filterNullishValues(getRunningMutations(dispatch));
	}
	function middlewareWarning(dispatch) {
		if (process.env.NODE_ENV !== "production") {
			if (middlewareWarning.triggered) return;
			const returnedValue = dispatch(api.internalActions.internal_getRTKQSubscriptions());
			middlewareWarning.triggered = true;
			if (typeof returnedValue !== "object" || typeof (returnedValue === null || returnedValue === void 0 ? void 0 : returnedValue.type) === "string") throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(34) : `Warning: Middleware for RTK-Query API at reducerPath "${api.reducerPath}" has not been added to the store.
You must add the middleware for RTK-Query to function correctly!`);
		}
	}
	function buildInitiateAnyQuery(endpointName, endpointDefinition) {
		const queryAction = (arg, _ref = {}) => {
			let { subscribe = true, forceRefetch, subscriptionOptions, [forceQueryFnSymbol]: forceQueryFn } = _ref, rest = _objectWithoutProperties(_ref, [
				"subscribe",
				"forceRefetch",
				"subscriptionOptions",
				forceQueryFnSymbol
			].map(toPropertyKey));
			return (dispatch, getState) => {
				var _getRunningQueries2;
				const queryCacheKey = serializeQueryArgs({
					queryArgs: arg,
					endpointDefinition,
					endpointName
				});
				let thunk;
				const commonThunkArgs = _objectSpread2(_objectSpread2({}, rest), {}, {
					type: ENDPOINT_QUERY,
					subscribe,
					forceRefetch,
					subscriptionOptions,
					endpointName,
					originalArgs: arg,
					queryCacheKey,
					[forceQueryFnSymbol]: forceQueryFn
				});
				if (isQueryDefinition(endpointDefinition)) thunk = queryThunk(commonThunkArgs);
				else {
					const { direction, initialPageParam, refetchCachedPages } = rest;
					thunk = infiniteQueryThunk(_objectSpread2(_objectSpread2({}, commonThunkArgs), {}, {
						direction,
						initialPageParam,
						refetchCachedPages
					}));
				}
				const selector = api.endpoints[endpointName].select(arg);
				const thunkResult = dispatch(thunk);
				const stateAfter = selector(getState());
				middlewareWarning(dispatch);
				const { requestId, abort } = thunkResult;
				const skippedSynchronously = stateAfter.requestId !== requestId;
				const runningQuery = (_getRunningQueries2 = getRunningQueries(dispatch)) === null || _getRunningQueries2 === void 0 ? void 0 : _getRunningQueries2.get(queryCacheKey);
				const selectFromState = () => selector(getState());
				const statePromise = Object.assign(forceQueryFn ? thunkResult.then(selectFromState) : skippedSynchronously && !runningQuery ? Promise.resolve(stateAfter) : Promise.all([runningQuery, thunkResult]).then(selectFromState), {
					arg,
					requestId,
					subscriptionOptions,
					queryCacheKey,
					abort,
					async unwrap() {
						const result = await statePromise;
						if (result.isError) throw result.error;
						return result.data;
					},
					refetch: (options) => dispatch(queryAction(arg, _objectSpread2({
						subscribe: false,
						forceRefetch: true
					}, options))),
					unsubscribe() {
						if (subscribe) dispatch(unsubscribeQueryResult({
							queryCacheKey,
							requestId
						}));
					},
					updateSubscriptionOptions(options) {
						statePromise.subscriptionOptions = options;
						dispatch(updateSubscriptionOptions({
							endpointName,
							requestId,
							queryCacheKey,
							options
						}));
					}
				});
				if (!runningQuery && !skippedSynchronously && !forceQueryFn) {
					const runningQueries = getRunningQueries(dispatch);
					runningQueries.set(queryCacheKey, statePromise);
					statePromise.then(() => {
						runningQueries.delete(queryCacheKey);
					});
				}
				return statePromise;
			};
		};
		return queryAction;
	}
	function buildInitiateQuery(endpointName, endpointDefinition) {
		return buildInitiateAnyQuery(endpointName, endpointDefinition);
	}
	function buildInitiateInfiniteQuery(endpointName, endpointDefinition) {
		return buildInitiateAnyQuery(endpointName, endpointDefinition);
	}
	function buildInitiateMutation(endpointName) {
		return (arg, { track = true, fixedCacheKey } = {}) => (dispatch, getState) => {
			const thunkResult = dispatch(mutationThunk({
				type: "mutation",
				endpointName,
				originalArgs: arg,
				track,
				fixedCacheKey
			}));
			middlewareWarning(dispatch);
			const { requestId, abort, unwrap } = thunkResult;
			const returnValuePromise = asSafePromise(thunkResult.unwrap().then((data) => ({ data })), (error) => ({ error }));
			const reset = () => {
				dispatch(removeMutationResult({
					requestId,
					fixedCacheKey
				}));
			};
			const ret = Object.assign(returnValuePromise, {
				arg: thunkResult.arg,
				requestId,
				abort,
				unwrap,
				reset
			});
			const runningMutations = getRunningMutations(dispatch);
			runningMutations.set(requestId, ret);
			ret.then(() => {
				runningMutations.delete(requestId);
			});
			if (fixedCacheKey) {
				runningMutations.set(fixedCacheKey, ret);
				ret.then(() => {
					if (runningMutations.get(fixedCacheKey) === ret) runningMutations.delete(fixedCacheKey);
				});
			}
			return ret;
		};
	}
}
//#endregion
//#region src/query/standardSchema.ts
var NamedSchemaError = class extends SchemaError {
	constructor(issues, value, schemaName, _bqMeta) {
		super(issues);
		this.value = value;
		this.schemaName = schemaName;
		this._bqMeta = _bqMeta;
	}
};
const shouldSkip = (skipSchemaValidation, schemaName) => Array.isArray(skipSchemaValidation) ? skipSchemaValidation.includes(schemaName) : !!skipSchemaValidation;
async function parseWithSchema(schema, data, schemaName, bqMeta) {
	const result = await schema["~standard"].validate(data);
	if (result.issues) throw new NamedSchemaError(result.issues, data, schemaName, bqMeta);
	return result.value;
}
//#endregion
//#region src/query/core/buildThunks.ts
function defaultTransformResponse(baseQueryReturnValue) {
	return baseQueryReturnValue;
}
const addShouldAutoBatch = (arg = {}) => {
	return _objectSpread2(_objectSpread2({}, arg), {}, { [SHOULD_AUTOBATCH]: true });
};
function buildThunks({ reducerPath, baseQuery, context: { endpointDefinitions }, serializeQueryArgs, api, assertTagType, selectors, onSchemaFailure, catchSchemaFailure: globalCatchSchemaFailure, skipSchemaValidation: globalSkipSchemaValidation }) {
	const patchQueryData = (endpointName, arg, patches, updateProvided) => (dispatch, getState) => {
		const endpointDefinition = endpointDefinitions[endpointName];
		const queryCacheKey = serializeQueryArgs({
			queryArgs: arg,
			endpointDefinition,
			endpointName
		});
		dispatch(api.internalActions.queryResultPatched({
			queryCacheKey,
			patches
		}));
		if (!updateProvided) return;
		const newValue = api.endpoints[endpointName].select(arg)(getState());
		const providedTags = calculateProvidedBy(endpointDefinition.providesTags, newValue.data, void 0, arg, {}, assertTagType);
		dispatch(api.internalActions.updateProvidedBy([{
			queryCacheKey,
			providedTags
		}]));
	};
	function addToStart(items, item, max = 0) {
		const newItems = [item, ...items];
		return max && newItems.length > max ? newItems.slice(0, -1) : newItems;
	}
	function addToEnd(items, item, max = 0) {
		const newItems = [...items, item];
		return max && newItems.length > max ? newItems.slice(1) : newItems;
	}
	const updateQueryData = (endpointName, arg, updateRecipe, updateProvided = true) => (dispatch, getState) => {
		const currentState = api.endpoints[endpointName].select(arg)(getState());
		const ret = {
			patches: [],
			inversePatches: [],
			undo: () => dispatch(api.util.patchQueryData(endpointName, arg, ret.inversePatches, updateProvided))
		};
		if (currentState.status === "uninitialized") return ret;
		let newValue;
		if ("data" in currentState) {
			if (isDraftable(currentState.data)) {
				const [value, patches, inversePatches] = produceWithPatches(currentState.data, updateRecipe);
				ret.patches.push(...patches);
				ret.inversePatches.push(...inversePatches);
				newValue = value;
			} else {
				newValue = updateRecipe(currentState.data);
				ret.patches.push({
					op: "replace",
					path: [],
					value: newValue
				});
				ret.inversePatches.push({
					op: "replace",
					path: [],
					value: currentState.data
				});
			}
		}
		if (ret.patches.length === 0) return ret;
		dispatch(api.util.patchQueryData(endpointName, arg, ret.patches, updateProvided));
		return ret;
	};
	const upsertQueryData = (endpointName, arg, value) => (dispatch) => {
		return dispatch(api.endpoints[endpointName].initiate(arg, {
			subscribe: false,
			forceRefetch: true,
			[forceQueryFnSymbol]: () => ({ data: value })
		}));
	};
	const getTransformCallbackForEndpoint = (endpointDefinition, transformFieldName) => {
		return endpointDefinition.query && endpointDefinition[transformFieldName] ? endpointDefinition[transformFieldName] : defaultTransformResponse;
	};
	const executeEndpoint = async (arg, { signal, abort, rejectWithValue, fulfillWithValue, dispatch, getState, extra }) => {
		const endpointDefinition = endpointDefinitions[arg.endpointName];
		const { metaSchema, skipSchemaValidation = globalSkipSchemaValidation } = endpointDefinition;
		const isQuery = arg.type === ENDPOINT_QUERY;
		try {
			let transformResponse = defaultTransformResponse;
			const baseQueryApi = {
				signal,
				abort,
				dispatch,
				getState,
				extra,
				endpoint: arg.endpointName,
				type: arg.type,
				forced: isQuery ? isForcedQuery(arg, getState()) : void 0,
				queryCacheKey: isQuery ? arg.queryCacheKey : void 0
			};
			const forceQueryFn = isQuery ? arg[forceQueryFnSymbol] : void 0;
			let finalQueryReturnValue;
			const fetchPage = async (data, param, maxPages, previous) => {
				if (param == null && data.pages.length) return Promise.resolve({ data });
				const pageResponse = await executeRequest({
					queryArg: arg.originalArgs,
					pageParam: param
				});
				const addTo = previous ? addToStart : addToEnd;
				return {
					data: {
						pages: addTo(data.pages, pageResponse.data, maxPages),
						pageParams: addTo(data.pageParams, param, maxPages)
					},
					meta: pageResponse.meta
				};
			};
			async function executeRequest(finalQueryArg) {
				let result;
				const { extraOptions, argSchema, rawResponseSchema, responseSchema } = endpointDefinition;
				if (argSchema && !shouldSkip(skipSchemaValidation, "arg")) finalQueryArg = await parseWithSchema(argSchema, finalQueryArg, "argSchema", {});
				if (forceQueryFn) result = forceQueryFn();
				else if (endpointDefinition.query) {
					transformResponse = getTransformCallbackForEndpoint(endpointDefinition, "transformResponse");
					result = await baseQuery(endpointDefinition.query(finalQueryArg), baseQueryApi, extraOptions);
				} else result = await endpointDefinition.queryFn(finalQueryArg, baseQueryApi, extraOptions, (arg) => baseQuery(arg, baseQueryApi, extraOptions));
				if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
					const what = endpointDefinition.query ? "`baseQuery`" : "`queryFn`";
					let err;
					if (!result) err = `${what} did not return anything.`;
					else if (typeof result !== "object") err = `${what} did not return an object.`;
					else if (result.error && result.data) err = `${what} returned an object containing both \`error\` and \`result\`.`;
					else if (result.error === void 0 && result.data === void 0) err = `${what} returned an object containing neither a valid \`error\` and \`result\`. At least one of them should not be \`undefined\``;
					else for (const key of Object.keys(result)) if (key !== "error" && key !== "data" && key !== "meta") {
						err = `The object returned by ${what} has the unknown property ${key}.`;
						break;
					}
					if (err) console.error(`Error encountered handling the endpoint ${arg.endpointName}.
                  ${err}
                  It needs to return an object with either the shape \`{ data: <value> }\` or \`{ error: <value> }\` that may contain an optional \`meta\` property.
                  Object returned was:`, result);
				}
				if (result.error) throw new HandledError(result.error, result.meta);
				let { data } = result;
				if (rawResponseSchema && !shouldSkip(skipSchemaValidation, "rawResponse")) data = await parseWithSchema(rawResponseSchema, result.data, "rawResponseSchema", result.meta);
				let transformedResponse = await transformResponse(data, result.meta, finalQueryArg);
				if (responseSchema && !shouldSkip(skipSchemaValidation, "response")) transformedResponse = await parseWithSchema(responseSchema, transformedResponse, "responseSchema", result.meta);
				return _objectSpread2(_objectSpread2({}, result), {}, { data: transformedResponse });
			}
			if (isQuery && "infiniteQueryOptions" in endpointDefinition) {
				var _ref, _refetchCachedPages, _selectors$selectQuer;
				const { infiniteQueryOptions } = endpointDefinition;
				const { maxPages = Infinity } = infiniteQueryOptions;
				const refetchCachedPages = (_ref = (_refetchCachedPages = arg.refetchCachedPages) !== null && _refetchCachedPages !== void 0 ? _refetchCachedPages : infiniteQueryOptions.refetchCachedPages) !== null && _ref !== void 0 ? _ref : true;
				let result;
				const blankData = {
					pages: [],
					pageParams: []
				};
				const cachedData = (_selectors$selectQuer = selectors.selectQueryEntry(getState(), arg.queryCacheKey)) === null || _selectors$selectQuer === void 0 ? void 0 : _selectors$selectQuer.data;
				const existingData = isForcedQuery(arg, getState()) && !arg.direction || !cachedData ? blankData : cachedData;
				if ("direction" in arg && arg.direction && existingData.pages.length) {
					const previous = arg.direction === "backward";
					result = await fetchPage(existingData, (previous ? getPreviousPageParam : getNextPageParam)(infiniteQueryOptions, existingData, arg.originalArgs), maxPages, previous);
				} else {
					var _cachedData$pageParam, _cachedPageParams$;
					const { initialPageParam = infiniteQueryOptions.initialPageParam } = arg;
					const cachedPageParams = (_cachedData$pageParam = cachedData === null || cachedData === void 0 ? void 0 : cachedData.pageParams) !== null && _cachedData$pageParam !== void 0 ? _cachedData$pageParam : [];
					const firstPageParam = (_cachedPageParams$ = cachedPageParams[0]) !== null && _cachedPageParams$ !== void 0 ? _cachedPageParams$ : initialPageParam;
					const totalPages = cachedPageParams.length;
					result = await fetchPage(existingData, firstPageParam, maxPages);
					if (forceQueryFn) result = { data: result.data.pages[0] };
					if (refetchCachedPages) for (let i = 1; i < totalPages; i++) {
						const param = getNextPageParam(infiniteQueryOptions, result.data, arg.originalArgs);
						result = await fetchPage(result.data, param, maxPages);
					}
				}
				finalQueryReturnValue = result;
			} else finalQueryReturnValue = await executeRequest(arg.originalArgs);
			if (metaSchema && !shouldSkip(skipSchemaValidation, "meta") && finalQueryReturnValue.meta) finalQueryReturnValue.meta = await parseWithSchema(metaSchema, finalQueryReturnValue.meta, "metaSchema", finalQueryReturnValue.meta);
			return fulfillWithValue(finalQueryReturnValue.data, addShouldAutoBatch({
				fulfilledTimeStamp: Date.now(),
				baseQueryMeta: finalQueryReturnValue.meta
			}));
		} catch (error) {
			let caughtError = error;
			if (caughtError instanceof HandledError) {
				let transformErrorResponse = getTransformCallbackForEndpoint(endpointDefinition, "transformErrorResponse");
				const { rawErrorResponseSchema, errorResponseSchema } = endpointDefinition;
				let { value, meta } = caughtError;
				try {
					if (rawErrorResponseSchema && !shouldSkip(skipSchemaValidation, "rawErrorResponse")) value = await parseWithSchema(rawErrorResponseSchema, value, "rawErrorResponseSchema", meta);
					if (metaSchema && !shouldSkip(skipSchemaValidation, "meta")) meta = await parseWithSchema(metaSchema, meta, "metaSchema", meta);
					let transformedErrorResponse = await transformErrorResponse(value, meta, arg.originalArgs);
					if (errorResponseSchema && !shouldSkip(skipSchemaValidation, "errorResponse")) transformedErrorResponse = await parseWithSchema(errorResponseSchema, transformedErrorResponse, "errorResponseSchema", meta);
					return rejectWithValue(transformedErrorResponse, addShouldAutoBatch({ baseQueryMeta: meta }));
				} catch (e) {
					caughtError = e;
				}
			}
			try {
				if (caughtError instanceof NamedSchemaError) {
					var _endpointDefinition$o;
					const info = {
						endpoint: arg.endpointName,
						arg: arg.originalArgs,
						type: arg.type,
						queryCacheKey: isQuery ? arg.queryCacheKey : void 0
					};
					(_endpointDefinition$o = endpointDefinition.onSchemaFailure) === null || _endpointDefinition$o === void 0 || _endpointDefinition$o.call(endpointDefinition, caughtError, info);
					onSchemaFailure === null || onSchemaFailure === void 0 || onSchemaFailure(caughtError, info);
					const { catchSchemaFailure = globalCatchSchemaFailure } = endpointDefinition;
					if (catchSchemaFailure) return rejectWithValue(catchSchemaFailure(caughtError, info), addShouldAutoBatch({ baseQueryMeta: caughtError._bqMeta }));
				}
			} catch (e) {
				caughtError = e;
			}
			if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") console.error(`An unhandled error occurred processing a request for the endpoint "${arg.endpointName}".
In the case of an unhandled error, no tags will be "provided" or "invalidated".`, caughtError);
			else console.error(caughtError);
			throw caughtError;
		}
	};
	function isForcedQuery(arg, state) {
		var _arg$forceRefetch;
		const requestState = selectors.selectQueryEntry(state, arg.queryCacheKey);
		const baseFetchOnMountOrArgChange = selectors.selectConfig(state).refetchOnMountOrArgChange;
		const fulfilledVal = requestState === null || requestState === void 0 ? void 0 : requestState.fulfilledTimeStamp;
		const refetchVal = (_arg$forceRefetch = arg.forceRefetch) !== null && _arg$forceRefetch !== void 0 ? _arg$forceRefetch : arg.subscribe && baseFetchOnMountOrArgChange;
		if (refetchVal) return refetchVal === true || (Number(/* @__PURE__ */ new Date()) - Number(fulfilledVal)) / 1e3 >= refetchVal;
		return false;
	}
	const createQueryThunk = () => {
		return createAsyncThunk(`${reducerPath}/executeQuery`, executeEndpoint, {
			getPendingMeta({ arg }) {
				const endpointDefinition = endpointDefinitions[arg.endpointName];
				return addShouldAutoBatch(_objectSpread2({ startedTimeStamp: Date.now() }, isInfiniteQueryDefinition(endpointDefinition) ? { direction: arg.direction } : {}));
			},
			condition(queryThunkArg, { getState }) {
				var _endpointDefinition$f;
				const state = getState();
				const requestState = selectors.selectQueryEntry(state, queryThunkArg.queryCacheKey);
				const fulfilledVal = requestState === null || requestState === void 0 ? void 0 : requestState.fulfilledTimeStamp;
				const currentArg = queryThunkArg.originalArgs;
				const previousArg = requestState === null || requestState === void 0 ? void 0 : requestState.originalArgs;
				const endpointDefinition = endpointDefinitions[queryThunkArg.endpointName];
				const direction = queryThunkArg.direction;
				if (isUpsertQuery(queryThunkArg)) return true;
				if ((requestState === null || requestState === void 0 ? void 0 : requestState.status) === "pending") return false;
				if (isForcedQuery(queryThunkArg, state)) return true;
				if (isQueryDefinition(endpointDefinition) && (endpointDefinition === null || endpointDefinition === void 0 || (_endpointDefinition$f = endpointDefinition.forceRefetch) === null || _endpointDefinition$f === void 0 ? void 0 : _endpointDefinition$f.call(endpointDefinition, {
					currentArg,
					previousArg,
					endpointState: requestState,
					state
				}))) return true;
				if (fulfilledVal && !direction) return false;
				if (direction && isInfiniteQueryDefinition(endpointDefinition)) {
					const cachedData = requestState === null || requestState === void 0 ? void 0 : requestState.data;
					if (cachedData === null || cachedData === void 0 ? void 0 : cachedData.pages.length) {
						const { infiniteQueryOptions } = endpointDefinition;
						if ((direction === "forward" ? getNextPageParam : getPreviousPageParam)(infiniteQueryOptions, cachedData, currentArg) == null) return false;
					}
				}
				return true;
			},
			dispatchConditionRejection: true
		});
	};
	const queryThunk = createQueryThunk();
	const infiniteQueryThunk = createQueryThunk();
	const mutationThunk = createAsyncThunk(`${reducerPath}/executeMutation`, executeEndpoint, { getPendingMeta() {
		return addShouldAutoBatch({ startedTimeStamp: Date.now() });
	} });
	const hasTheForce = (options) => "force" in options;
	const hasMaxAge = (options) => "ifOlderThan" in options;
	const prefetch = (endpointName, arg, options = {}) => (dispatch, getState) => {
		const force = hasTheForce(options) && options.force;
		const maxAge = hasMaxAge(options) && options.ifOlderThan;
		const queryAction = (force = true) => {
			const options = {
				forceRefetch: force,
				subscribe: false
			};
			return api.endpoints[endpointName].initiate(arg, options);
		};
		const latestStateValue = api.endpoints[endpointName].select(arg)(getState());
		if (force) dispatch(queryAction());
		else if (maxAge) {
			const lastFulfilledTs = latestStateValue === null || latestStateValue === void 0 ? void 0 : latestStateValue.fulfilledTimeStamp;
			if (!lastFulfilledTs) {
				dispatch(queryAction());
				return;
			}
			if ((Number(/* @__PURE__ */ new Date()) - Number(new Date(lastFulfilledTs))) / 1e3 >= maxAge) dispatch(queryAction());
		} else dispatch(queryAction(false));
	};
	function matchesEndpoint(endpointName) {
		return (action) => {
			var _action$meta;
			return (action === null || action === void 0 || (_action$meta = action.meta) === null || _action$meta === void 0 || (_action$meta = _action$meta.arg) === null || _action$meta === void 0 ? void 0 : _action$meta.endpointName) === endpointName;
		};
	}
	function buildMatchThunkActions(thunk, endpointName) {
		return {
			matchPending: isAllOf(isPending(thunk), matchesEndpoint(endpointName)),
			matchFulfilled: isAllOf(isFulfilled(thunk), matchesEndpoint(endpointName)),
			matchRejected: isAllOf(isRejected(thunk), matchesEndpoint(endpointName))
		};
	}
	return {
		queryThunk,
		mutationThunk,
		infiniteQueryThunk,
		prefetch,
		updateQueryData,
		upsertQueryData,
		patchQueryData,
		buildMatchThunkActions
	};
}
function getNextPageParam(options, { pages, pageParams }, queryArg) {
	const lastIndex = pages.length - 1;
	return options.getNextPageParam(pages[lastIndex], pages, pageParams[lastIndex], pageParams, queryArg);
}
function getPreviousPageParam(options, { pages, pageParams }, queryArg) {
	var _options$getPreviousP;
	return (_options$getPreviousP = options.getPreviousPageParam) === null || _options$getPreviousP === void 0 ? void 0 : _options$getPreviousP.call(options, pages[0], pages, pageParams[0], pageParams, queryArg);
}
function calculateProvidedByThunk(action, type, endpointDefinitions, assertTagType) {
	return calculateProvidedBy(endpointDefinitions[action.meta.arg.endpointName][type], isFulfilled(action) ? action.payload : void 0, isRejectedWithValue(action) ? action.payload : void 0, action.meta.arg.originalArgs, "baseQueryMeta" in action.meta ? action.meta.baseQueryMeta : void 0, assertTagType);
}
//#endregion
//#region src/query/utils/getCurrent.ts
function getCurrent(value) {
	return isDraft(value) ? current(value) : value;
}
//#endregion
//#region src/query/core/buildSlice.ts
function updateQuerySubstateIfExists(state, queryCacheKey, update) {
	const substate = state[queryCacheKey];
	if (substate) update(substate);
}
function getMutationCacheKey(id) {
	var _ref;
	return (_ref = "arg" in id ? id.arg.fixedCacheKey : id.fixedCacheKey) !== null && _ref !== void 0 ? _ref : id.requestId;
}
function updateMutationSubstateIfExists(state, id, update) {
	const substate = state[getMutationCacheKey(id)];
	if (substate) update(substate);
}
const initialState = {};
function buildSlice({ reducerPath, queryThunk, mutationThunk, serializeQueryArgs, context: { endpointDefinitions: definitions, apiUid, extractRehydrationInfo, hasRehydrationInfo }, assertTagType, config }) {
	const resetApiState = createAction(`${reducerPath}/resetApiState`);
	function writePendingCacheEntry(draft, arg, upserting, meta) {
		var _arg$queryCacheKey, _draft$_arg$queryCach;
		(_draft$_arg$queryCach = draft[_arg$queryCacheKey = arg.queryCacheKey]) !== null && _draft$_arg$queryCach !== void 0 || (draft[_arg$queryCacheKey] = {
			status: "uninitialized",
			endpointName: arg.endpointName
		});
		updateQuerySubstateIfExists(draft, arg.queryCacheKey, (substate) => {
			substate.status = STATUS_PENDING;
			substate.requestId = upserting && substate.requestId ? substate.requestId : meta.requestId;
			if (arg.originalArgs !== void 0) substate.originalArgs = arg.originalArgs;
			substate.startedTimeStamp = meta.startedTimeStamp;
			const endpointDefinition = definitions[meta.arg.endpointName];
			if (isInfiniteQueryDefinition(endpointDefinition) && "direction" in arg) substate.direction = arg.direction;
		});
	}
	function writeFulfilledCacheEntry(draft, meta, payload, upserting) {
		updateQuerySubstateIfExists(draft, meta.arg.queryCacheKey, (substate) => {
			if (substate.requestId !== meta.requestId && !upserting) return;
			const { merge } = definitions[meta.arg.endpointName];
			substate.status = STATUS_FULFILLED;
			if (merge) {
				if (substate.data !== void 0) {
					const { fulfilledTimeStamp, arg, baseQueryMeta, requestId } = meta;
					substate.data = createNextState(substate.data, (draftSubstateData) => {
						return merge(draftSubstateData, payload, {
							arg: arg.originalArgs,
							baseQueryMeta,
							fulfilledTimeStamp,
							requestId
						});
					});
				} else substate.data = payload;
			} else {
				var _definitions$meta$arg;
				substate.data = ((_definitions$meta$arg = definitions[meta.arg.endpointName].structuralSharing) !== null && _definitions$meta$arg !== void 0 ? _definitions$meta$arg : true) ? copyWithStructuralSharing(isDraft(substate.data) ? original(substate.data) : substate.data, payload) : payload;
			}
			delete substate.error;
			substate.fulfilledTimeStamp = meta.fulfilledTimeStamp;
		});
	}
	const querySlice = createSlice({
		name: `${reducerPath}/queries`,
		initialState,
		reducers: {
			removeQueryResult: {
				reducer(draft, { payload: { queryCacheKey } }) {
					delete draft[queryCacheKey];
				},
				prepare: prepareAutoBatched()
			},
			cacheEntriesUpserted: {
				reducer(draft, action) {
					for (const entry of action.payload) {
						const { queryDescription: arg, value } = entry;
						writePendingCacheEntry(draft, arg, true, {
							arg,
							requestId: action.meta.requestId,
							startedTimeStamp: action.meta.timestamp
						});
						writeFulfilledCacheEntry(draft, {
							arg,
							requestId: action.meta.requestId,
							fulfilledTimeStamp: action.meta.timestamp,
							baseQueryMeta: {}
						}, value, true);
					}
				},
				prepare: (payload) => {
					return {
						payload: payload.map((entry) => {
							const { endpointName, arg, value } = entry;
							const endpointDefinition = definitions[endpointName];
							return {
								queryDescription: {
									type: ENDPOINT_QUERY,
									endpointName,
									originalArgs: entry.arg,
									queryCacheKey: serializeQueryArgs({
										queryArgs: arg,
										endpointDefinition,
										endpointName
									})
								},
								value
							};
						}),
						meta: {
							[SHOULD_AUTOBATCH]: true,
							requestId: nanoid(),
							timestamp: Date.now()
						}
					};
				}
			},
			queryResultPatched: {
				reducer(draft, { payload: { queryCacheKey, patches } }) {
					updateQuerySubstateIfExists(draft, queryCacheKey, (substate) => {
						substate.data = applyPatches(substate.data, patches.concat());
					});
				},
				prepare: prepareAutoBatched()
			}
		},
		extraReducers(builder) {
			builder.addCase(queryThunk.pending, (draft, { meta, meta: { arg } }) => {
				writePendingCacheEntry(draft, arg, isUpsertQuery(arg), meta);
			}).addCase(queryThunk.fulfilled, (draft, { meta, payload }) => {
				writeFulfilledCacheEntry(draft, meta, payload, isUpsertQuery(meta.arg));
			}).addCase(queryThunk.rejected, (draft, { meta: { condition, arg, requestId }, error, payload }) => {
				updateQuerySubstateIfExists(draft, arg.queryCacheKey, (substate) => {
					if (condition) {} else {
						if (substate.requestId !== requestId) return;
						substate.status = STATUS_REJECTED;
						substate.error = payload !== null && payload !== void 0 ? payload : error;
					}
				});
			}).addMatcher(hasRehydrationInfo, (draft, action) => {
				const { queries } = extractRehydrationInfo(action);
				for (const [key, entry] of Object.entries(queries)) if ((entry === null || entry === void 0 ? void 0 : entry.status) === "fulfilled" || (entry === null || entry === void 0 ? void 0 : entry.status) === "rejected") draft[key] = entry;
			});
		}
	});
	const mutationSlice = createSlice({
		name: `${reducerPath}/mutations`,
		initialState,
		reducers: { removeMutationResult: {
			reducer(draft, { payload }) {
				const cacheKey = getMutationCacheKey(payload);
				if (cacheKey in draft) delete draft[cacheKey];
			},
			prepare: prepareAutoBatched()
		} },
		extraReducers(builder) {
			builder.addCase(mutationThunk.pending, (draft, { meta, meta: { requestId, arg, startedTimeStamp } }) => {
				if (!arg.track) return;
				draft[getMutationCacheKey(meta)] = {
					requestId,
					status: STATUS_PENDING,
					endpointName: arg.endpointName,
					startedTimeStamp
				};
			}).addCase(mutationThunk.fulfilled, (draft, { payload, meta }) => {
				if (!meta.arg.track) return;
				updateMutationSubstateIfExists(draft, meta, (substate) => {
					if (substate.requestId !== meta.requestId) return;
					substate.status = STATUS_FULFILLED;
					substate.data = payload;
					substate.fulfilledTimeStamp = meta.fulfilledTimeStamp;
				});
			}).addCase(mutationThunk.rejected, (draft, { payload, error, meta }) => {
				if (!meta.arg.track) return;
				updateMutationSubstateIfExists(draft, meta, (substate) => {
					if (substate.requestId !== meta.requestId) return;
					substate.status = STATUS_REJECTED;
					substate.error = payload !== null && payload !== void 0 ? payload : error;
				});
			}).addMatcher(hasRehydrationInfo, (draft, action) => {
				const { mutations } = extractRehydrationInfo(action);
				for (const [key, entry] of Object.entries(mutations)) if (((entry === null || entry === void 0 ? void 0 : entry.status) === "fulfilled" || (entry === null || entry === void 0 ? void 0 : entry.status) === "rejected") && key !== (entry === null || entry === void 0 ? void 0 : entry.requestId)) draft[key] = entry;
			});
		}
	});
	const invalidationSlice = createSlice({
		name: `${reducerPath}/invalidation`,
		initialState: {
			tags: {},
			keys: {}
		},
		reducers: { updateProvidedBy: {
			reducer(draft, action) {
				for (const { queryCacheKey, providedTags } of action.payload) {
					removeCacheKeyFromTags(draft, queryCacheKey);
					for (const { type, id } of providedTags) {
						var _draft$tags$type, _ref2, _draft$tags$type$_ref, _draft$tags, _draft$tags$type2;
						const subscribedQueries = (_draft$tags$type$_ref = (_draft$tags$type = (_draft$tags$type2 = (_draft$tags = draft.tags)[type]) !== null && _draft$tags$type2 !== void 0 ? _draft$tags$type2 : _draft$tags[type] = {})[_ref2 = id !== null && id !== void 0 ? id : "__internal_without_id"]) !== null && _draft$tags$type$_ref !== void 0 ? _draft$tags$type$_ref : _draft$tags$type[_ref2] = [];
						if (!subscribedQueries.includes(queryCacheKey)) subscribedQueries.push(queryCacheKey);
					}
					draft.keys[queryCacheKey] = providedTags;
				}
			},
			prepare: prepareAutoBatched()
		} },
		extraReducers(builder) {
			builder.addCase(querySlice.actions.removeQueryResult, (draft, { payload: { queryCacheKey } }) => {
				removeCacheKeyFromTags(draft, queryCacheKey);
			}).addMatcher(hasRehydrationInfo, (draft, action) => {
				var _provided$tags;
				const { provided } = extractRehydrationInfo(action);
				for (const [type, incomingTags] of Object.entries((_provided$tags = provided.tags) !== null && _provided$tags !== void 0 ? _provided$tags : {})) for (const [id, cacheKeys] of Object.entries(incomingTags)) {
					var _draft$tags$type3, _ref3, _draft$tags$type3$_re, _draft$tags2, _draft$tags2$type;
					const subscribedQueries = (_draft$tags$type3$_re = (_draft$tags$type3 = (_draft$tags2$type = (_draft$tags2 = draft.tags)[type]) !== null && _draft$tags2$type !== void 0 ? _draft$tags2$type : _draft$tags2[type] = {})[_ref3 = id !== null && id !== void 0 ? id : "__internal_without_id"]) !== null && _draft$tags$type3$_re !== void 0 ? _draft$tags$type3$_re : _draft$tags$type3[_ref3] = [];
					for (const queryCacheKey of cacheKeys) {
						if (!subscribedQueries.includes(queryCacheKey)) subscribedQueries.push(queryCacheKey);
						draft.keys[queryCacheKey] = provided.keys[queryCacheKey];
					}
				}
			}).addMatcher(isAnyOf(isFulfilled(queryThunk), isRejectedWithValue(queryThunk)), (draft, action) => {
				writeProvidedTagsForQueries(draft, [action]);
			}).addMatcher(querySlice.actions.cacheEntriesUpserted.match, (draft, action) => {
				writeProvidedTagsForQueries(draft, action.payload.map(({ queryDescription, value }) => {
					return {
						type: "UNKNOWN",
						payload: value,
						meta: {
							requestStatus: "fulfilled",
							requestId: "UNKNOWN",
							arg: queryDescription
						}
					};
				}));
			});
		}
	});
	function removeCacheKeyFromTags(draft, queryCacheKey) {
		var _draft$keys$queryCach;
		const existingTags = getCurrent((_draft$keys$queryCach = draft.keys[queryCacheKey]) !== null && _draft$keys$queryCach !== void 0 ? _draft$keys$queryCach : []);
		for (const tag of existingTags) {
			var _tag$id, _draft$tags$tagType;
			const tagType = tag.type;
			const tagId = (_tag$id = tag.id) !== null && _tag$id !== void 0 ? _tag$id : "__internal_without_id";
			const tagSubscriptions = (_draft$tags$tagType = draft.tags[tagType]) === null || _draft$tags$tagType === void 0 ? void 0 : _draft$tags$tagType[tagId];
			if (tagSubscriptions) draft.tags[tagType][tagId] = getCurrent(tagSubscriptions).filter((qc) => qc !== queryCacheKey);
		}
		delete draft.keys[queryCacheKey];
	}
	function writeProvidedTagsForQueries(draft, actions) {
		const providedByEntries = actions.map((action) => {
			const providedTags = calculateProvidedByThunk(action, "providesTags", definitions, assertTagType);
			const { queryCacheKey } = action.meta.arg;
			return {
				queryCacheKey,
				providedTags
			};
		});
		invalidationSlice.caseReducers.updateProvidedBy(draft, invalidationSlice.actions.updateProvidedBy(providedByEntries));
	}
	const subscriptionSlice = createSlice({
		name: `${reducerPath}/subscriptions`,
		initialState,
		reducers: {
			updateSubscriptionOptions(d, a) {},
			unsubscribeQueryResult(d, a) {},
			internal_getRTKQSubscriptions() {}
		}
	});
	const internalSubscriptionsSlice = createSlice({
		name: `${reducerPath}/internalSubscriptions`,
		initialState,
		reducers: { subscriptionsUpdated: {
			reducer(state, action) {
				return applyPatches(state, action.payload);
			},
			prepare: prepareAutoBatched()
		} }
	});
	const configSlice = createSlice({
		name: `${reducerPath}/config`,
		initialState: _objectSpread2({
			online: isOnline(),
			focused: isDocumentVisible(),
			middlewareRegistered: false
		}, config),
		reducers: { middlewareRegistered(state, { payload }) {
			state.middlewareRegistered = state.middlewareRegistered === "conflict" || apiUid !== payload ? "conflict" : true;
		} },
		extraReducers: (builder) => {
			builder.addCase(onOnline, (state) => {
				state.online = true;
			}).addCase(onOffline, (state) => {
				state.online = false;
			}).addCase(onFocus, (state) => {
				state.focused = true;
			}).addCase(onFocusLost, (state) => {
				state.focused = false;
			}).addMatcher(hasRehydrationInfo, (draft) => _objectSpread2({}, draft));
		}
	});
	const combinedReducer = combineReducers({
		queries: querySlice.reducer,
		mutations: mutationSlice.reducer,
		provided: invalidationSlice.reducer,
		subscriptions: internalSubscriptionsSlice.reducer,
		config: configSlice.reducer
	});
	const reducer = (state, action) => combinedReducer(resetApiState.match(action) ? void 0 : state, action);
	return {
		reducer,
		actions: _objectSpread2(_objectSpread2(_objectSpread2(_objectSpread2(_objectSpread2(_objectSpread2(_objectSpread2({}, configSlice.actions), querySlice.actions), subscriptionSlice.actions), internalSubscriptionsSlice.actions), mutationSlice.actions), invalidationSlice.actions), {}, { resetApiState })
	};
}
//#endregion
//#region src/query/core/buildSelectors.ts
const skipToken = /* @__PURE__ */ Symbol.for("RTKQ/skipToken");
const initialSubState = { status: STATUS_UNINITIALIZED };
const defaultQuerySubState = /* @__PURE__ */ createNextState(initialSubState, () => {});
const defaultMutationSubState = /* @__PURE__ */ createNextState(initialSubState, () => {});
function buildSelectors({ serializeQueryArgs, reducerPath, createSelector }) {
	const selectSkippedQuery = (state) => defaultQuerySubState;
	const selectSkippedMutation = (state) => defaultMutationSubState;
	return {
		buildQuerySelector,
		buildInfiniteQuerySelector,
		buildMutationSelector,
		selectInvalidatedBy,
		selectCachedArgsForQuery,
		selectApiState,
		selectQueries,
		selectMutations,
		selectQueryEntry,
		selectConfig
	};
	function withRequestFlags(substate) {
		return _objectSpread2(_objectSpread2({}, substate), getRequestStatusFlags(substate.status));
	}
	function selectApiState(rootState) {
		const state = rootState[reducerPath];
		if (process.env.NODE_ENV !== "production") {
			if (!state) {
				if (selectApiState.triggered) return state;
				selectApiState.triggered = true;
				console.error(`Error: No data found at \`state.${reducerPath}\`. Did you forget to add the reducer to the store?`);
			}
		}
		return state;
	}
	function selectQueries(rootState) {
		var _selectApiState;
		return (_selectApiState = selectApiState(rootState)) === null || _selectApiState === void 0 ? void 0 : _selectApiState.queries;
	}
	function selectQueryEntry(rootState, cacheKey) {
		var _selectQueries;
		return (_selectQueries = selectQueries(rootState)) === null || _selectQueries === void 0 ? void 0 : _selectQueries[cacheKey];
	}
	function selectMutations(rootState) {
		var _selectApiState2;
		return (_selectApiState2 = selectApiState(rootState)) === null || _selectApiState2 === void 0 ? void 0 : _selectApiState2.mutations;
	}
	function selectConfig(rootState) {
		var _selectApiState3;
		return (_selectApiState3 = selectApiState(rootState)) === null || _selectApiState3 === void 0 ? void 0 : _selectApiState3.config;
	}
	function buildAnyQuerySelector(endpointName, endpointDefinition, combiner) {
		return (queryArgs) => {
			if (queryArgs === skipToken) return createSelector(selectSkippedQuery, combiner);
			const serializedArgs = serializeQueryArgs({
				queryArgs,
				endpointDefinition,
				endpointName
			});
			const selectQuerySubstate = (state) => {
				var _selectQueryEntry;
				return (_selectQueryEntry = selectQueryEntry(state, serializedArgs)) !== null && _selectQueryEntry !== void 0 ? _selectQueryEntry : defaultQuerySubState;
			};
			return createSelector(selectQuerySubstate, combiner);
		};
	}
	function buildQuerySelector(endpointName, endpointDefinition) {
		return buildAnyQuerySelector(endpointName, endpointDefinition, withRequestFlags);
	}
	function buildInfiniteQuerySelector(endpointName, endpointDefinition) {
		const { infiniteQueryOptions } = endpointDefinition;
		function withInfiniteQueryResultFlags(substate) {
			const stateWithRequestFlags = _objectSpread2(_objectSpread2({}, substate), getRequestStatusFlags(substate.status));
			const { isLoading, isError, direction } = stateWithRequestFlags;
			const isForward = direction === "forward";
			const isBackward = direction === "backward";
			return _objectSpread2(_objectSpread2({}, stateWithRequestFlags), {}, {
				hasNextPage: getHasNextPage(infiniteQueryOptions, stateWithRequestFlags.data, stateWithRequestFlags.originalArgs),
				hasPreviousPage: getHasPreviousPage(infiniteQueryOptions, stateWithRequestFlags.data, stateWithRequestFlags.originalArgs),
				isFetchingNextPage: isLoading && isForward,
				isFetchingPreviousPage: isLoading && isBackward,
				isFetchNextPageError: isError && isForward,
				isFetchPreviousPageError: isError && isBackward
			});
		}
		return buildAnyQuerySelector(endpointName, endpointDefinition, withInfiniteQueryResultFlags);
	}
	function buildMutationSelector() {
		return ((id) => {
			let mutationId;
			if (typeof id === "object") {
				var _getMutationCacheKey;
				mutationId = (_getMutationCacheKey = getMutationCacheKey(id)) !== null && _getMutationCacheKey !== void 0 ? _getMutationCacheKey : skipToken;
			} else mutationId = id;
			const selectMutationSubstate = (state) => {
				var _selectApiState$mutat, _selectApiState4;
				return (_selectApiState$mutat = (_selectApiState4 = selectApiState(state)) === null || _selectApiState4 === void 0 || (_selectApiState4 = _selectApiState4.mutations) === null || _selectApiState4 === void 0 ? void 0 : _selectApiState4[mutationId]) !== null && _selectApiState$mutat !== void 0 ? _selectApiState$mutat : defaultMutationSubState;
			};
			return createSelector(mutationId === skipToken ? selectSkippedMutation : selectMutationSubstate, withRequestFlags);
		});
	}
	function selectInvalidatedBy(state, tags) {
		const apiState = state[reducerPath];
		const toInvalidate = /* @__PURE__ */ new Set();
		const finalTags = filterMap(tags, isNotNullish, expandTagDescription);
		for (const tag of finalTags) {
			var _ref;
			const provided = apiState.provided.tags[tag.type];
			if (!provided) continue;
			let invalidateSubscriptions = (_ref = tag.id !== void 0 ? provided[tag.id] : Object.values(provided).flat()) !== null && _ref !== void 0 ? _ref : [];
			for (const invalidate of invalidateSubscriptions) toInvalidate.add(invalidate);
		}
		return Array.from(toInvalidate.values()).flatMap((queryCacheKey) => {
			const querySubState = apiState.queries[queryCacheKey];
			return querySubState ? {
				queryCacheKey,
				endpointName: querySubState.endpointName,
				originalArgs: querySubState.originalArgs
			} : [];
		});
	}
	function selectCachedArgsForQuery(state, queryName) {
		return filterMap(Object.values(selectQueries(state)), (entry) => (entry === null || entry === void 0 ? void 0 : entry.endpointName) === queryName && entry.status !== "uninitialized", (entry) => entry.originalArgs);
	}
	function getHasNextPage(options, data, queryArg) {
		if (!data) return false;
		return getNextPageParam(options, data, queryArg) != null;
	}
	function getHasPreviousPage(options, data, queryArg) {
		if (!data || !options.getPreviousPageParam) return false;
		return getPreviousPageParam(options, data, queryArg) != null;
	}
}
//#endregion
//#region src/query/defaultSerializeQueryArgs.ts
const cache = WeakMap ? /* @__PURE__ */ new WeakMap() : void 0;
const defaultSerializeQueryArgs = ({ endpointName, queryArgs }) => {
	let serialized = "";
	const cached = cache === null || cache === void 0 ? void 0 : cache.get(queryArgs);
	if (typeof cached === "string") serialized = cached;
	else {
		const stringified = JSON.stringify(queryArgs, (key, value) => {
			value = typeof value === "bigint" ? { $bigint: value.toString() } : value;
			value = isPlainObject$1(value) ? Object.keys(value).sort().reduce((acc, key) => {
				acc[key] = value[key];
				return acc;
			}, {}) : value;
			return value;
		});
		if (isPlainObject$1(queryArgs)) cache === null || cache === void 0 || cache.set(queryArgs, stringified);
		serialized = stringified;
	}
	return `${endpointName}(${serialized})`;
};
//#endregion
//#region src/query/createApi.ts
function buildCreateApi(...modules) {
	return function baseCreateApi(options) {
		const extractRehydrationInfo = weakMapMemoize((action) => {
			var _options$extractRehyd, _options$reducerPath;
			return (_options$extractRehyd = options.extractRehydrationInfo) === null || _options$extractRehyd === void 0 ? void 0 : _options$extractRehyd.call(options, action, { reducerPath: (_options$reducerPath = options.reducerPath) !== null && _options$reducerPath !== void 0 ? _options$reducerPath : "api" });
		});
		const optionsWithDefaults = _objectSpread2(_objectSpread2({
			reducerPath: "api",
			keepUnusedDataFor: 60,
			refetchOnMountOrArgChange: false,
			refetchOnFocus: false,
			refetchOnReconnect: false,
			invalidationBehavior: "delayed"
		}, options), {}, {
			extractRehydrationInfo,
			serializeQueryArgs(queryArgsApi) {
				let finalSerializeQueryArgs = defaultSerializeQueryArgs;
				if (queryArgsApi.endpointDefinition && "serializeQueryArgs" in queryArgsApi.endpointDefinition) {
					const endpointSQA = queryArgsApi.endpointDefinition.serializeQueryArgs;
					finalSerializeQueryArgs = (queryArgsApi) => {
						const initialResult = endpointSQA(queryArgsApi);
						if (typeof initialResult === "string") return initialResult;
						else return defaultSerializeQueryArgs(_objectSpread2(_objectSpread2({}, queryArgsApi), {}, { queryArgs: initialResult }));
					};
				} else if (options.serializeQueryArgs) finalSerializeQueryArgs = options.serializeQueryArgs;
				return finalSerializeQueryArgs(queryArgsApi);
			},
			tagTypes: [...options.tagTypes || []]
		});
		const context = {
			endpointDefinitions: {},
			batch(fn) {
				fn();
			},
			apiUid: nanoid(),
			extractRehydrationInfo,
			hasRehydrationInfo: weakMapMemoize((action) => extractRehydrationInfo(action) != null)
		};
		const api = {
			injectEndpoints,
			enhanceEndpoints({ addTagTypes, endpoints }) {
				if (addTagTypes) {
					for (const eT of addTagTypes) if (!optionsWithDefaults.tagTypes.includes(eT)) optionsWithDefaults.tagTypes.push(eT);
				}
				if (endpoints) for (const [endpointName, partialDefinition] of Object.entries(endpoints)) if (typeof partialDefinition === "function") partialDefinition(getEndpointDefinition(context, endpointName));
				else Object.assign(getEndpointDefinition(context, endpointName) || {}, partialDefinition);
				return api;
			}
		};
		const initializedModules = modules.map((m) => m.init(api, optionsWithDefaults, context));
		function injectEndpoints(inject) {
			const evaluatedEndpoints = inject.endpoints({
				query: (x) => _objectSpread2(_objectSpread2({}, x), {}, { type: ENDPOINT_QUERY }),
				mutation: (x) => _objectSpread2(_objectSpread2({}, x), {}, { type: ENDPOINT_MUTATION }),
				infiniteQuery: (x) => _objectSpread2(_objectSpread2({}, x), {}, { type: ENDPOINT_INFINITEQUERY })
			});
			for (const [endpointName, definition] of Object.entries(evaluatedEndpoints)) {
				if (inject.overrideExisting !== true && endpointName in context.endpointDefinitions) {
					if (inject.overrideExisting === "throw") throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(39) : `called \`injectEndpoints\` to override already-existing endpointName ${endpointName} without specifying \`overrideExisting: true\``);
					else if (typeof process !== "undefined" && process.env.NODE_ENV === "development") console.error(`called \`injectEndpoints\` to override already-existing endpointName ${endpointName} without specifying \`overrideExisting: true\``);
					continue;
				}
				if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
					if (isInfiniteQueryDefinition(definition)) {
						const { infiniteQueryOptions } = definition;
						const { maxPages, getPreviousPageParam } = infiniteQueryOptions;
						if (typeof maxPages === "number") {
							if (maxPages < 1) throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(40) : `maxPages for endpoint '${endpointName}' must be a number greater than 0`);
							if (typeof getPreviousPageParam !== "function") throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(41) : `getPreviousPageParam for endpoint '${endpointName}' must be a function if maxPages is used`);
						}
					}
				}
				context.endpointDefinitions[endpointName] = definition;
				for (const m of initializedModules) m.injectEndpoint(endpointName, definition);
			}
			return api;
		}
		return api.injectEndpoints({ endpoints: options.endpoints });
	};
}
//#endregion
//#region src/query/fakeBaseQuery.ts
const _NEVER = /* @__PURE__ */ Symbol();
function fakeBaseQuery() {
	return function() {
		throw new Error(process.env.NODE_ENV === "production" ? formatProdErrorMessage(33) : "When using `fakeBaseQuery`, all queries & mutations must use the `queryFn` definition syntax.");
	};
}
function safeAssign(target, ...args) {
	return Object.assign(target, ...args);
}
//#endregion
//#region src/query/core/buildMiddleware/batchActions.ts
const buildBatchedActionsHandler = ({ api, queryThunk, internalState, mwApi }) => {
	const subscriptionsPrefix = `${api.reducerPath}/subscriptions`;
	let previousSubscriptions = null;
	let updateSyncTimer = null;
	const { updateSubscriptionOptions, unsubscribeQueryResult } = api.internalActions;
	const actuallyMutateSubscriptions = (currentSubscriptions, action) => {
		if (updateSubscriptionOptions.match(action)) {
			const { queryCacheKey, requestId, options } = action.payload;
			const sub = currentSubscriptions.get(queryCacheKey);
			if (sub === null || sub === void 0 ? void 0 : sub.has(requestId)) sub.set(requestId, options);
			return true;
		}
		if (unsubscribeQueryResult.match(action)) {
			const { queryCacheKey, requestId } = action.payload;
			const sub = currentSubscriptions.get(queryCacheKey);
			if (sub) sub.delete(requestId);
			return true;
		}
		if (api.internalActions.removeQueryResult.match(action)) {
			currentSubscriptions.delete(action.payload.queryCacheKey);
			return true;
		}
		if (queryThunk.pending.match(action)) {
			const { meta: { arg, requestId } } = action;
			const substate = getOrInsertComputed(currentSubscriptions, arg.queryCacheKey, createNewMap);
			if (arg.subscribe) {
				var _ref, _arg$subscriptionOpti;
				substate.set(requestId, (_ref = (_arg$subscriptionOpti = arg.subscriptionOptions) !== null && _arg$subscriptionOpti !== void 0 ? _arg$subscriptionOpti : substate.get(requestId)) !== null && _ref !== void 0 ? _ref : {});
			}
			return true;
		}
		let mutated = false;
		if (queryThunk.rejected.match(action)) {
			const { meta: { condition, arg, requestId } } = action;
			if (condition && arg.subscribe) {
				var _ref2, _arg$subscriptionOpti2;
				const substate = getOrInsertComputed(currentSubscriptions, arg.queryCacheKey, createNewMap);
				substate.set(requestId, (_ref2 = (_arg$subscriptionOpti2 = arg.subscriptionOptions) !== null && _arg$subscriptionOpti2 !== void 0 ? _arg$subscriptionOpti2 : substate.get(requestId)) !== null && _ref2 !== void 0 ? _ref2 : {});
				mutated = true;
			}
		}
		return mutated;
	};
	const getSubscriptions = () => internalState.currentSubscriptions;
	const getSubscriptionCount = (queryCacheKey) => {
		var _subscriptionsForQuer;
		const subscriptionsForQueryArg = getSubscriptions().get(queryCacheKey);
		return (_subscriptionsForQuer = subscriptionsForQueryArg === null || subscriptionsForQueryArg === void 0 ? void 0 : subscriptionsForQueryArg.size) !== null && _subscriptionsForQuer !== void 0 ? _subscriptionsForQuer : 0;
	};
	const isRequestSubscribed = (queryCacheKey, requestId) => {
		var _subscriptions$get;
		const subscriptions = getSubscriptions();
		return !!(subscriptions === null || subscriptions === void 0 || (_subscriptions$get = subscriptions.get(queryCacheKey)) === null || _subscriptions$get === void 0 ? void 0 : _subscriptions$get.get(requestId));
	};
	const subscriptionSelectors = {
		getSubscriptions,
		getSubscriptionCount,
		isRequestSubscribed
	};
	function serializeSubscriptions(currentSubscriptions) {
		return JSON.parse(JSON.stringify(Object.fromEntries([...currentSubscriptions].map(([k, v]) => [k, Object.fromEntries(v)]))));
	}
	return (action, mwApi) => {
		if (!previousSubscriptions) previousSubscriptions = serializeSubscriptions(internalState.currentSubscriptions);
		if (api.util.resetApiState.match(action)) {
			previousSubscriptions = {};
			internalState.currentSubscriptions.clear();
			updateSyncTimer = null;
			return [true, false];
		}
		if (api.internalActions.internal_getRTKQSubscriptions.match(action)) return [false, subscriptionSelectors];
		const didMutate = actuallyMutateSubscriptions(internalState.currentSubscriptions, action);
		let actionShouldContinue = true;
		if (process.env.NODE_ENV === "test" && typeof action.type === "string" && action.type === `${api.reducerPath}/getPolling`) return [false, internalState.currentPolls];
		if (didMutate) {
			if (!updateSyncTimer) updateSyncTimer = setTimeout(() => {
				const newSubscriptions = serializeSubscriptions(internalState.currentSubscriptions);
				const [, patches] = produceWithPatches(previousSubscriptions, () => newSubscriptions);
				mwApi.next(api.internalActions.subscriptionsUpdated(patches));
				previousSubscriptions = newSubscriptions;
				updateSyncTimer = null;
			}, 500);
			const isSubscriptionSliceAction = typeof action.type == "string" && !!action.type.startsWith(subscriptionsPrefix);
			const isAdditionalSubscriptionAction = queryThunk.rejected.match(action) && action.meta.condition && !!action.meta.arg.subscribe;
			actionShouldContinue = !isSubscriptionSliceAction && !isAdditionalSubscriptionAction;
		}
		return [actionShouldContinue, false];
	};
};
//#endregion
//#region src/query/core/buildMiddleware/cacheCollection.ts
const THIRTY_TWO_BIT_MAX_TIMER_SECONDS = 2147483647 / 1e3 - 1;
const buildCacheCollectionHandler = ({ reducerPath, api, queryThunk, context, internalState, selectors: { selectQueryEntry, selectConfig }, getRunningQueryThunk, mwApi }) => {
	const { removeQueryResult, unsubscribeQueryResult, cacheEntriesUpserted } = api.internalActions;
	const canTriggerUnsubscribe = isAnyOf(unsubscribeQueryResult.match, queryThunk.fulfilled, queryThunk.rejected, cacheEntriesUpserted.match);
	function anySubscriptionsRemainingForKey(queryCacheKey) {
		const subscriptions = internalState.currentSubscriptions.get(queryCacheKey);
		if (!subscriptions) return false;
		return subscriptions.size > 0;
	}
	const currentRemovalTimeouts = {};
	function abortAllPromises(promiseMap) {
		for (const promise of promiseMap.values()) {
			var _promise$abort;
			promise === null || promise === void 0 || (_promise$abort = promise.abort) === null || _promise$abort === void 0 || _promise$abort.call(promise);
		}
	}
	const handler = (action, mwApi) => {
		const config = selectConfig(mwApi.getState());
		if (canTriggerUnsubscribe(action)) {
			let queryCacheKeys;
			if (cacheEntriesUpserted.match(action)) queryCacheKeys = action.payload.map((entry) => entry.queryDescription.queryCacheKey);
			else {
				const { queryCacheKey } = unsubscribeQueryResult.match(action) ? action.payload : action.meta.arg;
				queryCacheKeys = [queryCacheKey];
			}
			handleUnsubscribeMany(queryCacheKeys, mwApi, config);
		}
		if (api.util.resetApiState.match(action)) {
			for (const [key, timeout] of Object.entries(currentRemovalTimeouts)) {
				if (timeout) clearTimeout(timeout);
				delete currentRemovalTimeouts[key];
			}
			abortAllPromises(internalState.runningQueries);
			abortAllPromises(internalState.runningMutations);
		}
		if (context.hasRehydrationInfo(action)) {
			const { queries } = context.extractRehydrationInfo(action);
			handleUnsubscribeMany(Object.keys(queries), mwApi, config);
		}
	};
	function handleUnsubscribeMany(cacheKeys, api, config) {
		const state = api.getState();
		for (const queryCacheKey of cacheKeys) {
			const entry = selectQueryEntry(state, queryCacheKey);
			if (entry === null || entry === void 0 ? void 0 : entry.endpointName) handleUnsubscribe(queryCacheKey, entry.endpointName, api, config);
		}
	}
	function handleUnsubscribe(queryCacheKey, endpointName, api, config) {
		var _endpointDefinition$k;
		const endpointDefinition = getEndpointDefinition(context, endpointName);
		const keepUnusedDataFor = (_endpointDefinition$k = endpointDefinition === null || endpointDefinition === void 0 ? void 0 : endpointDefinition.keepUnusedDataFor) !== null && _endpointDefinition$k !== void 0 ? _endpointDefinition$k : config.keepUnusedDataFor;
		if (keepUnusedDataFor === Infinity) return;
		const finalKeepUnusedDataFor = Math.max(0, Math.min(keepUnusedDataFor, THIRTY_TWO_BIT_MAX_TIMER_SECONDS));
		if (!anySubscriptionsRemainingForKey(queryCacheKey)) {
			const currentTimeout = currentRemovalTimeouts[queryCacheKey];
			if (currentTimeout) clearTimeout(currentTimeout);
			currentRemovalTimeouts[queryCacheKey] = setTimeout(() => {
				if (!anySubscriptionsRemainingForKey(queryCacheKey)) {
					const entry = selectQueryEntry(api.getState(), queryCacheKey);
					if (entry === null || entry === void 0 ? void 0 : entry.endpointName) {
						const runningQuery = api.dispatch(getRunningQueryThunk(entry.endpointName, entry.originalArgs));
						runningQuery === null || runningQuery === void 0 || runningQuery.abort();
					}
					api.dispatch(removeQueryResult({ queryCacheKey }));
				}
				delete currentRemovalTimeouts[queryCacheKey];
			}, finalKeepUnusedDataFor * 1e3);
		}
	}
	return handler;
};
//#endregion
//#region src/query/core/buildMiddleware/cacheLifecycle.ts
const neverResolvedError = /* @__PURE__ */ new Error("Promise never resolved before cacheEntryRemoved.");
const buildCacheLifecycleHandler = ({ api, reducerPath, context, queryThunk, mutationThunk, internalState, selectors: { selectQueryEntry, selectApiState } }) => {
	const isQueryThunk = isAsyncThunkAction(queryThunk);
	const isMutationThunk = isAsyncThunkAction(mutationThunk);
	const isFulfilledThunk = isFulfilled(queryThunk, mutationThunk);
	const lifecycleMap = {};
	const { removeQueryResult, removeMutationResult, cacheEntriesUpserted } = api.internalActions;
	function resolveLifecycleEntry(cacheKey, data, meta) {
		const lifecycle = lifecycleMap[cacheKey];
		if (lifecycle === null || lifecycle === void 0 ? void 0 : lifecycle.valueResolved) {
			lifecycle.valueResolved({
				data,
				meta
			});
			delete lifecycle.valueResolved;
		}
	}
	function removeLifecycleEntry(cacheKey) {
		const lifecycle = lifecycleMap[cacheKey];
		if (lifecycle) {
			delete lifecycleMap[cacheKey];
			lifecycle.cacheEntryRemoved();
		}
	}
	function getActionMetaFields(action) {
		const { arg, requestId } = action.meta;
		const { endpointName, originalArgs } = arg;
		return [
			endpointName,
			originalArgs,
			requestId
		];
	}
	const handler = (action, mwApi, stateBefore) => {
		const cacheKey = getCacheKey(action);
		function checkForNewCacheKey(endpointName, cacheKey, requestId, originalArgs) {
			const oldEntry = selectQueryEntry(stateBefore, cacheKey);
			const newEntry = selectQueryEntry(mwApi.getState(), cacheKey);
			if (!oldEntry && newEntry) handleNewKey(endpointName, originalArgs, cacheKey, mwApi, requestId);
		}
		if (queryThunk.pending.match(action)) {
			const [endpointName, originalArgs, requestId] = getActionMetaFields(action);
			checkForNewCacheKey(endpointName, cacheKey, requestId, originalArgs);
		} else if (cacheEntriesUpserted.match(action)) for (const { queryDescription, value } of action.payload) {
			const { endpointName, originalArgs, queryCacheKey } = queryDescription;
			checkForNewCacheKey(endpointName, queryCacheKey, action.meta.requestId, originalArgs);
			resolveLifecycleEntry(queryCacheKey, value, {});
		}
		else if (mutationThunk.pending.match(action)) {
			if (mwApi.getState()[reducerPath].mutations[cacheKey]) {
				const [endpointName, originalArgs, requestId] = getActionMetaFields(action);
				handleNewKey(endpointName, originalArgs, cacheKey, mwApi, requestId);
			}
		} else if (isFulfilledThunk(action)) resolveLifecycleEntry(cacheKey, action.payload, action.meta.baseQueryMeta);
		else if (removeQueryResult.match(action) || removeMutationResult.match(action)) removeLifecycleEntry(cacheKey);
		else if (api.util.resetApiState.match(action)) for (const cacheKey of Object.keys(lifecycleMap)) removeLifecycleEntry(cacheKey);
	};
	function getCacheKey(action) {
		if (isQueryThunk(action)) return action.meta.arg.queryCacheKey;
		if (isMutationThunk(action)) {
			var _action$meta$arg$fixe;
			return (_action$meta$arg$fixe = action.meta.arg.fixedCacheKey) !== null && _action$meta$arg$fixe !== void 0 ? _action$meta$arg$fixe : action.meta.requestId;
		}
		if (removeQueryResult.match(action)) return action.payload.queryCacheKey;
		if (removeMutationResult.match(action)) return getMutationCacheKey(action.payload);
		return "";
	}
	function handleNewKey(endpointName, originalArgs, queryCacheKey, mwApi, requestId) {
		const endpointDefinition = getEndpointDefinition(context, endpointName);
		const onCacheEntryAdded = endpointDefinition === null || endpointDefinition === void 0 ? void 0 : endpointDefinition.onCacheEntryAdded;
		if (!onCacheEntryAdded) return;
		const lifecycle = {};
		const cacheEntryRemoved = new Promise((resolve) => {
			lifecycle.cacheEntryRemoved = resolve;
		});
		const cacheDataLoaded = Promise.race([new Promise((resolve) => {
			lifecycle.valueResolved = resolve;
		}), cacheEntryRemoved.then(() => {
			throw neverResolvedError;
		})]);
		cacheDataLoaded.catch(() => {});
		lifecycleMap[queryCacheKey] = lifecycle;
		const selector = api.endpoints[endpointName].select(isAnyQueryDefinition(endpointDefinition) ? originalArgs : queryCacheKey);
		const extra = mwApi.dispatch((_, __, extra) => extra);
		const runningHandler = onCacheEntryAdded(originalArgs, _objectSpread2(_objectSpread2({}, mwApi), {}, {
			getCacheEntry: () => selector(mwApi.getState()),
			requestId,
			extra,
			updateCachedData: isAnyQueryDefinition(endpointDefinition) ? (updateRecipe) => mwApi.dispatch(api.util.updateQueryData(endpointName, originalArgs, updateRecipe)) : void 0,
			cacheDataLoaded,
			cacheEntryRemoved
		}));
		Promise.resolve(runningHandler).catch((e) => {
			if (e === neverResolvedError) return;
			throw e;
		});
	}
	return handler;
};
//#endregion
//#region src/query/core/buildMiddleware/devMiddleware.ts
const buildDevCheckHandler = ({ api, context: { apiUid }, reducerPath }) => {
	return (action, mwApi) => {
		if (api.util.resetApiState.match(action)) mwApi.dispatch(api.internalActions.middlewareRegistered(apiUid));
		if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
			var _mwApi$getState$reduc;
			if (api.internalActions.middlewareRegistered.match(action) && action.payload === apiUid && ((_mwApi$getState$reduc = mwApi.getState()[reducerPath]) === null || _mwApi$getState$reduc === void 0 || (_mwApi$getState$reduc = _mwApi$getState$reduc.config) === null || _mwApi$getState$reduc === void 0 ? void 0 : _mwApi$getState$reduc.middlewareRegistered) === "conflict") console.warn(`There is a mismatch between slice and middleware for the reducerPath "${reducerPath}".
You can only have one api per reducer path, this will lead to crashes in various situations!${reducerPath === "api" ? `
If you have multiple apis, you *have* to specify the reducerPath option when using createApi!` : ""}`);
		}
	};
};
//#endregion
//#region src/query/core/buildMiddleware/invalidationByTags.ts
const buildInvalidationByTagsHandler = ({ reducerPath, context, context: { endpointDefinitions }, mutationThunk, queryThunk, api, assertTagType, refetchQuery, internalState }) => {
	const { removeQueryResult } = api.internalActions;
	const isThunkActionWithTags = isAnyOf(isFulfilled(mutationThunk), isRejectedWithValue(mutationThunk));
	const isQueryEnd = isAnyOf(isFulfilled(queryThunk, mutationThunk), isRejected(queryThunk, mutationThunk));
	let pendingTagInvalidations = [];
	let pendingRequestCount = 0;
	const handler = (action, mwApi) => {
		if (queryThunk.pending.match(action) || mutationThunk.pending.match(action)) pendingRequestCount++;
		if (isQueryEnd(action) && !(queryThunk.rejected.match(action) && action.meta.condition)) pendingRequestCount = Math.max(0, pendingRequestCount - 1);
		if (isThunkActionWithTags(action)) invalidateTags(calculateProvidedByThunk(action, "invalidatesTags", endpointDefinitions, assertTagType), mwApi);
		else if (isQueryEnd(action)) invalidateTags([], mwApi);
		else if (api.util.invalidateTags.match(action)) invalidateTags(calculateProvidedBy(action.payload, void 0, void 0, void 0, void 0, assertTagType), mwApi);
	};
	function hasPendingRequests() {
		return pendingRequestCount > 0;
	}
	function invalidateTags(newTags, mwApi) {
		const rootState = mwApi.getState();
		const state = rootState[reducerPath];
		pendingTagInvalidations.push(...newTags);
		if (state.config.invalidationBehavior === "delayed" && hasPendingRequests()) return;
		const tags = pendingTagInvalidations;
		pendingTagInvalidations = [];
		if (tags.length === 0) return;
		const toInvalidate = api.util.selectInvalidatedBy(rootState, tags);
		context.batch(() => {
			const valuesArray = Array.from(toInvalidate.values());
			for (const { queryCacheKey } of valuesArray) {
				const querySubState = state.queries[queryCacheKey];
				const subscriptionSubState = getOrInsertComputed(internalState.currentSubscriptions, queryCacheKey, createNewMap);
				if (querySubState) {
					if (subscriptionSubState.size === 0) mwApi.dispatch(removeQueryResult({ queryCacheKey }));
					else if (querySubState.status !== "uninitialized") mwApi.dispatch(refetchQuery(querySubState));
				}
			}
		});
	}
	return handler;
};
//#endregion
//#region src/query/core/buildMiddleware/polling.ts
const buildPollingHandler = ({ reducerPath, queryThunk, api, refetchQuery, internalState }) => {
	const { currentPolls, currentSubscriptions } = internalState;
	const pendingPollingUpdates = /* @__PURE__ */ new Set();
	let pollingUpdateTimer = null;
	const handler = (action, mwApi) => {
		if (api.internalActions.updateSubscriptionOptions.match(action) || api.internalActions.unsubscribeQueryResult.match(action)) schedulePollingUpdate(action.payload.queryCacheKey, mwApi);
		if (queryThunk.pending.match(action) || queryThunk.rejected.match(action) && action.meta.condition) schedulePollingUpdate(action.meta.arg.queryCacheKey, mwApi);
		if (queryThunk.fulfilled.match(action) || queryThunk.rejected.match(action) && !action.meta.condition) startNextPoll(action.meta.arg, mwApi);
		if (api.util.resetApiState.match(action)) {
			clearPolls();
			if (pollingUpdateTimer) {
				clearTimeout(pollingUpdateTimer);
				pollingUpdateTimer = null;
			}
			pendingPollingUpdates.clear();
		}
	};
	function schedulePollingUpdate(queryCacheKey, api) {
		pendingPollingUpdates.add(queryCacheKey);
		if (!pollingUpdateTimer) pollingUpdateTimer = setTimeout(() => {
			for (const key of pendingPollingUpdates) updatePollingInterval({ queryCacheKey: key }, api);
			pendingPollingUpdates.clear();
			pollingUpdateTimer = null;
		}, 0);
	}
	function startNextPoll({ queryCacheKey }, api) {
		const querySubState = api.getState()[reducerPath].queries[queryCacheKey];
		const subscriptions = currentSubscriptions.get(queryCacheKey);
		if (!querySubState || querySubState.status === "uninitialized") return;
		const { lowestPollingInterval, skipPollingIfUnfocused } = findLowestPollingInterval(subscriptions);
		if (!Number.isFinite(lowestPollingInterval)) return;
		const currentPoll = currentPolls.get(queryCacheKey);
		if (currentPoll === null || currentPoll === void 0 ? void 0 : currentPoll.timeout) {
			clearTimeout(currentPoll.timeout);
			currentPoll.timeout = void 0;
		}
		const nextPollTimestamp = Date.now() + lowestPollingInterval;
		currentPolls.set(queryCacheKey, {
			nextPollTimestamp,
			pollingInterval: lowestPollingInterval,
			timeout: setTimeout(() => {
				const currentState = api.getState()[reducerPath];
				const currentQuerySubState = currentState.queries[queryCacheKey];
				if (!currentQuerySubState || currentQuerySubState.status === "uninitialized") {
					cleanupPollForKey(queryCacheKey);
					return;
				}
				if (currentState.config.focused || !skipPollingIfUnfocused) api.dispatch(refetchQuery(currentQuerySubState));
				startNextPoll({ queryCacheKey }, api);
			}, lowestPollingInterval)
		});
	}
	function updatePollingInterval({ queryCacheKey }, api) {
		const querySubState = api.getState()[reducerPath].queries[queryCacheKey];
		const subscriptions = currentSubscriptions.get(queryCacheKey);
		if (!querySubState || querySubState.status === "uninitialized") return;
		const { lowestPollingInterval } = findLowestPollingInterval(subscriptions);
		if (process.env.NODE_ENV === "test") {
			var _ref, _ref$pollUpdateCounte, _updateCounters$query;
			const updateCounters = (_ref$pollUpdateCounte = (_ref = currentPolls).pollUpdateCounters) !== null && _ref$pollUpdateCounte !== void 0 ? _ref$pollUpdateCounte : _ref.pollUpdateCounters = {};
			(_updateCounters$query = updateCounters[queryCacheKey]) !== null && _updateCounters$query !== void 0 || (updateCounters[queryCacheKey] = 0);
			updateCounters[queryCacheKey]++;
		}
		if (!Number.isFinite(lowestPollingInterval)) {
			cleanupPollForKey(queryCacheKey);
			return;
		}
		const currentPoll = currentPolls.get(queryCacheKey);
		const nextPollTimestamp = Date.now() + lowestPollingInterval;
		if (!currentPoll || nextPollTimestamp < currentPoll.nextPollTimestamp) startNextPoll({ queryCacheKey }, api);
	}
	function cleanupPollForKey(key) {
		const existingPoll = currentPolls.get(key);
		if (existingPoll === null || existingPoll === void 0 ? void 0 : existingPoll.timeout) clearTimeout(existingPoll.timeout);
		currentPolls.delete(key);
	}
	function clearPolls() {
		for (const key of currentPolls.keys()) cleanupPollForKey(key);
	}
	function findLowestPollingInterval(subscribers = /* @__PURE__ */ new Map()) {
		let skipPollingIfUnfocused = false;
		let lowestPollingInterval = Number.POSITIVE_INFINITY;
		for (const entry of subscribers.values()) if (entry.pollingInterval) {
			lowestPollingInterval = Math.min(entry.pollingInterval, lowestPollingInterval);
			skipPollingIfUnfocused = entry.skipPollingIfUnfocused || skipPollingIfUnfocused;
		}
		return {
			lowestPollingInterval,
			skipPollingIfUnfocused
		};
	}
	return handler;
};
//#endregion
//#region src/query/core/buildMiddleware/queryLifecycle.ts
const buildQueryLifecycleHandler = ({ api, context, queryThunk, mutationThunk }) => {
	const isPendingThunk = isPending(queryThunk, mutationThunk);
	const isRejectedThunk = isRejected(queryThunk, mutationThunk);
	const isFulfilledThunk = isFulfilled(queryThunk, mutationThunk);
	const lifecycleMap = {};
	const handler = (action, mwApi) => {
		if (isPendingThunk(action)) {
			const { requestId, arg: { endpointName, originalArgs } } = action.meta;
			const endpointDefinition = getEndpointDefinition(context, endpointName);
			const onQueryStarted = endpointDefinition === null || endpointDefinition === void 0 ? void 0 : endpointDefinition.onQueryStarted;
			if (onQueryStarted) {
				const lifecycle = {};
				const queryFulfilled = new Promise((resolve, reject) => {
					lifecycle.resolve = resolve;
					lifecycle.reject = reject;
				});
				queryFulfilled.catch(() => {});
				lifecycleMap[requestId] = lifecycle;
				const selector = api.endpoints[endpointName].select(isAnyQueryDefinition(endpointDefinition) ? originalArgs : requestId);
				const extra = mwApi.dispatch((_, __, extra) => extra);
				onQueryStarted(originalArgs, _objectSpread2(_objectSpread2({}, mwApi), {}, {
					getCacheEntry: () => selector(mwApi.getState()),
					requestId,
					extra,
					updateCachedData: isAnyQueryDefinition(endpointDefinition) ? (updateRecipe) => mwApi.dispatch(api.util.updateQueryData(endpointName, originalArgs, updateRecipe)) : void 0,
					queryFulfilled
				}));
			}
		} else if (isFulfilledThunk(action)) {
			var _lifecycleMap$request;
			const { requestId, baseQueryMeta } = action.meta;
			(_lifecycleMap$request = lifecycleMap[requestId]) === null || _lifecycleMap$request === void 0 || _lifecycleMap$request.resolve({
				data: action.payload,
				meta: baseQueryMeta
			});
			delete lifecycleMap[requestId];
		} else if (isRejectedThunk(action)) {
			var _lifecycleMap$request2, _action$payload;
			const { requestId, rejectedWithValue, baseQueryMeta } = action.meta;
			(_lifecycleMap$request2 = lifecycleMap[requestId]) === null || _lifecycleMap$request2 === void 0 || _lifecycleMap$request2.reject({
				error: (_action$payload = action.payload) !== null && _action$payload !== void 0 ? _action$payload : action.error,
				isUnhandledError: !rejectedWithValue,
				meta: baseQueryMeta
			});
			delete lifecycleMap[requestId];
		}
	};
	return handler;
};
//#endregion
//#region src/query/core/buildMiddleware/windowEventHandling.ts
const buildWindowEventHandler = ({ reducerPath, context, api, refetchQuery, internalState }) => {
	const { removeQueryResult } = api.internalActions;
	const handler = (action, mwApi) => {
		if (onFocus.match(action)) refetchValidQueries(mwApi, "refetchOnFocus");
		if (onOnline.match(action)) refetchValidQueries(mwApi, "refetchOnReconnect");
	};
	function refetchValidQueries(api, type) {
		const state = api.getState()[reducerPath];
		const queries = state.queries;
		const subscriptions = internalState.currentSubscriptions;
		context.batch(() => {
			for (const queryCacheKey of subscriptions.keys()) {
				const querySubState = queries[queryCacheKey];
				const subscriptionSubState = subscriptions.get(queryCacheKey);
				if (!subscriptionSubState || !querySubState) continue;
				const values = [...subscriptionSubState.values()];
				if (values.some((sub) => sub[type] === true) || values.every((sub) => sub[type] === void 0) && state.config[type]) {
					if (subscriptionSubState.size === 0) api.dispatch(removeQueryResult({ queryCacheKey }));
					else if (querySubState.status !== "uninitialized") api.dispatch(refetchQuery(querySubState));
				}
			}
		});
	}
	return handler;
};
//#endregion
//#region src/query/core/buildMiddleware/index.ts
function buildMiddleware(input) {
	const { reducerPath, queryThunk, api, context, getInternalState } = input;
	const { apiUid } = context;
	const actions = { invalidateTags: createAction(`${reducerPath}/invalidateTags`) };
	const isThisApiSliceAction = (action) => action.type.startsWith(`${reducerPath}/`);
	const handlerBuilders = [
		buildDevCheckHandler,
		buildCacheCollectionHandler,
		buildInvalidationByTagsHandler,
		buildPollingHandler,
		buildCacheLifecycleHandler,
		buildQueryLifecycleHandler
	];
	const middleware = (mwApi) => {
		let initialized = false;
		const internalState = getInternalState(mwApi.dispatch);
		const builderArgs = _objectSpread2(_objectSpread2({}, input), {}, {
			internalState,
			refetchQuery,
			isThisApiSliceAction,
			mwApi
		});
		const handlers = handlerBuilders.map((build) => build(builderArgs));
		const batchedActionsHandler = buildBatchedActionsHandler(builderArgs);
		const windowEventsHandler = buildWindowEventHandler(builderArgs);
		return (next) => {
			return (action) => {
				if (!isAction(action)) return next(action);
				if (!initialized) {
					initialized = true;
					mwApi.dispatch(api.internalActions.middlewareRegistered(apiUid));
				}
				const mwApiWithNext = _objectSpread2(_objectSpread2({}, mwApi), {}, { next });
				const stateBefore = mwApi.getState();
				const [actionShouldContinue, internalProbeResult] = batchedActionsHandler(action, mwApiWithNext, stateBefore);
				let res;
				if (actionShouldContinue) res = next(action);
				else res = internalProbeResult;
				if (mwApi.getState()[reducerPath]) {
					windowEventsHandler(action, mwApiWithNext, stateBefore);
					if (isThisApiSliceAction(action) || context.hasRehydrationInfo(action)) for (const handler of handlers) handler(action, mwApiWithNext, stateBefore);
				}
				return res;
			};
		};
	};
	return {
		middleware,
		actions
	};
	function refetchQuery(querySubState) {
		return input.api.endpoints[querySubState.endpointName].initiate(querySubState.originalArgs, {
			subscribe: false,
			forceRefetch: true
		});
	}
}
//#endregion
//#region src/query/core/module.ts
const coreModuleName = /* @__PURE__ */ Symbol();
const coreModule = ({ createSelector: createSelector$1 = createSelector } = {}) => ({
	name: coreModuleName,
	init(api, { baseQuery, tagTypes, reducerPath, serializeQueryArgs, keepUnusedDataFor, refetchOnMountOrArgChange, refetchOnFocus, refetchOnReconnect, invalidationBehavior, onSchemaFailure, catchSchemaFailure, skipSchemaValidation }, context) {
		enablePatches();
		const assertTagType = (tag) => {
			if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
				if (!tagTypes.includes(tag.type)) console.error(`Tag type '${tag.type}' was used, but not specified in \`tagTypes\`!`);
			}
			return tag;
		};
		Object.assign(api, {
			reducerPath,
			endpoints: {},
			internalActions: {
				onOnline,
				onOffline,
				onFocus,
				onFocusLost
			},
			util: {}
		});
		const selectors = buildSelectors({
			serializeQueryArgs,
			reducerPath,
			createSelector: createSelector$1
		});
		const { selectInvalidatedBy, selectCachedArgsForQuery, buildQuerySelector, buildInfiniteQuerySelector, buildMutationSelector } = selectors;
		safeAssign(api.util, {
			selectInvalidatedBy,
			selectCachedArgsForQuery
		});
		const { queryThunk, infiniteQueryThunk, mutationThunk, patchQueryData, updateQueryData, upsertQueryData, prefetch, buildMatchThunkActions } = buildThunks({
			baseQuery,
			reducerPath,
			context,
			api,
			serializeQueryArgs,
			assertTagType,
			selectors,
			onSchemaFailure,
			catchSchemaFailure,
			skipSchemaValidation
		});
		const { reducer, actions: sliceActions } = buildSlice({
			context,
			queryThunk,
			infiniteQueryThunk,
			mutationThunk,
			serializeQueryArgs,
			reducerPath,
			assertTagType,
			config: {
				refetchOnFocus,
				refetchOnReconnect,
				refetchOnMountOrArgChange,
				keepUnusedDataFor,
				reducerPath,
				invalidationBehavior
			}
		});
		safeAssign(api.util, {
			patchQueryData,
			updateQueryData,
			upsertQueryData,
			prefetch,
			resetApiState: sliceActions.resetApiState,
			upsertQueryEntries: sliceActions.cacheEntriesUpserted
		});
		safeAssign(api.internalActions, sliceActions);
		const internalStateMap = /* @__PURE__ */ new WeakMap();
		const getInternalState = (dispatch) => {
			return getOrInsertComputed(internalStateMap, dispatch, () => ({
				currentSubscriptions: /* @__PURE__ */ new Map(),
				currentPolls: /* @__PURE__ */ new Map(),
				runningQueries: /* @__PURE__ */ new Map(),
				runningMutations: /* @__PURE__ */ new Map()
			}));
		};
		const { buildInitiateQuery, buildInitiateInfiniteQuery, buildInitiateMutation, getRunningMutationThunk, getRunningMutationsThunk, getRunningQueriesThunk, getRunningQueryThunk } = buildInitiate({
			queryThunk,
			mutationThunk,
			infiniteQueryThunk,
			api,
			serializeQueryArgs,
			context,
			getInternalState
		});
		safeAssign(api.util, {
			getRunningMutationThunk,
			getRunningMutationsThunk,
			getRunningQueryThunk,
			getRunningQueriesThunk
		});
		const { middleware, actions: middlewareActions } = buildMiddleware({
			reducerPath,
			context,
			queryThunk,
			mutationThunk,
			infiniteQueryThunk,
			api,
			assertTagType,
			selectors,
			getRunningQueryThunk,
			getInternalState
		});
		safeAssign(api.util, middlewareActions);
		safeAssign(api, {
			reducer,
			middleware
		});
		return {
			name: coreModuleName,
			injectEndpoint(endpointName, definition) {
				var _anyApi$endpoints, _anyApi$endpoints$end;
				const endpoint = (_anyApi$endpoints$end = (_anyApi$endpoints = api.endpoints)[endpointName]) !== null && _anyApi$endpoints$end !== void 0 ? _anyApi$endpoints$end : _anyApi$endpoints[endpointName] = {};
				if (isQueryDefinition(definition)) safeAssign(endpoint, {
					name: endpointName,
					select: buildQuerySelector(endpointName, definition),
					initiate: buildInitiateQuery(endpointName, definition)
				}, buildMatchThunkActions(queryThunk, endpointName));
				if (isMutationDefinition(definition)) safeAssign(endpoint, {
					name: endpointName,
					select: buildMutationSelector(),
					initiate: buildInitiateMutation(endpointName)
				}, buildMatchThunkActions(mutationThunk, endpointName));
				if (isInfiniteQueryDefinition(definition)) safeAssign(endpoint, {
					name: endpointName,
					select: buildInfiniteQuerySelector(endpointName, definition),
					initiate: buildInitiateInfiniteQuery(endpointName, definition)
				}, buildMatchThunkActions(queryThunk, endpointName));
			}
		};
	}
});
//#endregion
//#region src/query/core/index.ts
const createApi = /* @__PURE__ */ buildCreateApi(coreModule());
//#endregion
export { NamedSchemaError, QueryStatus, _NEVER, buildCreateApi, copyWithStructuralSharing, coreModule, coreModuleName, createApi, defaultSerializeQueryArgs, fakeBaseQuery, fetchBaseQuery, retry, setupListeners, skipToken };

//# sourceMappingURL=rtk-query.legacy-esm.js.map