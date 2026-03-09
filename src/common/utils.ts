import fetch, { Response } from 'node-fetch';
import { USER_AGENT } from '../server.js';
import { wikiService } from './wikiService.js';
import { getMwn, clearMwnCache } from './mwn.js';
import type { TextContent } from '@modelcontextprotocol/sdk/types.js';

export async function processBatchOperations<T>(
	items: T[],
	getWikiSite: ( item: T ) => string,
	processItem: ( item: T ) => Promise<TextContent[]>
): Promise<{ content: TextContent[]; isError: boolean }> {
	const results: TextContent[] = [];
	let hasError = false;

	const config = wikiService.getFullConfig();
	const allowConcurrent = config.allowConcurrentBatchOperations ?? false;

	if ( allowConcurrent ) {
		const promises = items.map( async ( item ) => {
			try {
				const wikiSite = getWikiSite( item );
				// We still ensureWiki to catch basic config missing errors,
				// but mwn instance switching in concurrent mode might be tricky
				// if ensureWiki relies on a global currentWikiKey. 
				// However, getMwn() now uses wikiService.getCurrent() inside it.
				// This implies a fundamental race condition in the architecture 
				// if multiple wikis are accessed concurrently because wikiService 
				// uses a global `currentWikiKey`. 
				// For now, if concurrent is enabled, we assume it's mostly same-wiki.
				ensureWiki( wikiSite );
				const res = await processItem( item );
				return { success: true, res };
			} catch ( error ) {
				const wikiSite = getWikiSite( item );
				const title = ( item as any ).title || ( item as any ).query || ( item as any ).prefix || 'unknown';
				return { 
					success: false, 
					res: [ { type: 'text', text: `[${ wikiSite }] Failed operation on "${ title }": ${ ( error as Error ).message }` } as TextContent ]
				};
			}
		} );

		const outcomes = await Promise.all( promises );
		for ( const outcome of outcomes ) {
			if ( !outcome.success ) {
				hasError = true;
			}
			results.push( ...outcome.res );
		}
	} else {
		for ( const item of items ) {
			try {
				ensureWiki( getWikiSite( item ) );
				const res = await processItem( item );
				results.push( ...res );
			} catch ( error ) {
				hasError = true;
				const wikiSite = getWikiSite( item );
				const title = ( item as any ).title || ( item as any ).query || ( item as any ).prefix || 'unknown';
				results.push( {
					type: 'text',
					text: `[${ wikiSite }] Failed operation on "${ title }": ${ ( error as Error ).message }`
				} );
			}
		}
	}

	return { content: results, isError: hasError };
}

export function ensureWiki( wikiSite: string ): void {
	let currentWiki: string | undefined;
	try {
		currentWiki = wikiService.getCurrent().key;
	} catch {
		currentWiki = undefined;
	}

	if ( currentWiki !== wikiSite ) {
		wikiService.setCurrent( wikiSite );
		clearMwnCache();
	}
}

type RequestConfig = {
	headers: Record<string, string>;
	body: Record<string, unknown> | undefined;
};

async function withAuth(
	headers: Record<string, string>,
	body: Record<string, unknown> | undefined,
	needAuth: boolean
): Promise<RequestConfig> {
	const { private: privateWiki, token } = wikiService.getCurrent().config;

	if ( !needAuth && !privateWiki ) {
		return { headers, body };
	}

	if ( token !== undefined && token !== null ) {
		// OAuth2 authentication - just add Bearer token
		return {
			headers: { ...headers, Authorization: `Bearer ${ token }` },
			body
		};
	}

	// Cookie-based authentication - add cookies and CSRF token
	const cookies = await getCookiesFromJar();
	if ( cookies === undefined ) {
		return { headers, body };
	}

	return {
		headers: { ...headers, Cookie: cookies },
		body: body ? { ...body, token: await getCsrfToken() } : body
	};
}

async function getCsrfToken(): Promise<string> {
	const mwn = await getMwn();
	return await mwn.getCsrfToken();
}

async function getCookiesFromJar(): Promise<string | undefined> {
	const mwn = await getMwn();
	const cookieJar = mwn.cookieJar;
	if ( !cookieJar ) {
		return undefined;
	}

	const { server, scriptpath } = wikiService.getCurrent().config;

	// Get cookies for the REST API URL
	const restApiUrl = `${ server }${ scriptpath }/rest.php`;
	const cookies = cookieJar.getCookieStringSync( restApiUrl );

	if ( cookies ) {
		return cookies;
	}

	// Fallback: try getting cookies for the domain
	return cookieJar.getCookieStringSync( server ) || undefined;
}

// Shio: Custom error class to carry the HTTP status code from fetchCore.
// This allows caller functions to make retry decisions based on specific HTTP errors.
export class FetchError extends Error {
	public status: number;
	public constructor( message: string, status: number ) {
		super( message );
		this.status = status;
		this.name = 'FetchError';
	}
}

// Shio: A wrapper function that intercepts 401 Unauthorized or 403 Forbidden errors
// from the underlying REST API requests. When a session expires during a long-running
// MCP server instance, MediaWiki returns these status codes for private wiki access.
// Since these custom REST API functions bypass mwn's native automatic re-login logic,
// we manually catch the auth failures, invalidate the mwn instance cache, and retry.
// The next getMwn() call will perform a fresh login and obtain valid session cookies.
async function withRestRetry<T>( requestFn: () => Promise<T> ): Promise<T> {
	try {
		return await requestFn();
	} catch ( error ) {
		if ( error instanceof FetchError && ( error.status === 401 || error.status === 403 ) ) {
			// Clear mwn cache to force re-authentication and get fresh cookies
			clearMwnCache();
			return await requestFn();
		}
		throw error;
	}
}

async function fetchCore(
	baseUrl: string,
	options?: {
		params?: Record<string, string>;
		headers?: Record<string, string>;
		body?: Record<string, unknown>;
		method?: string;
	}
): Promise<Response> {
	let url = baseUrl;

	if ( url.startsWith( '//' ) ) {
		url = 'https:' + url;
	}

	if ( options?.params ) {
		const queryString = new URLSearchParams( options.params ).toString();
		if ( queryString ) {
			url = `${ url }?${ queryString }`;
		}
	}

	const requestHeaders: Record<string, string> = {
		'User-Agent': USER_AGENT
	};

	if ( options?.headers ) {
		Object.assign( requestHeaders, options.headers );
	}

	const fetchOptions: { headers: Record<string, string>; method?: string; body?: string } = {
		headers: requestHeaders,
		method: options?.method || 'GET'
	};
	if ( options?.body ) {
		fetchOptions.body = JSON.stringify( options.body );
	}
	const response = await fetch( url, fetchOptions );
	if ( !response.ok ) {
		const errorBody = await response.text().catch( () => 'Could not read error response body' );
		throw new FetchError(
			`HTTP error! status: ${ response.status } for URL: ${ response.url }. Response: ${ errorBody }`,
			response.status
		);
	}
	return response;
}

export async function makeApiRequest<T>(
	url: string,
	params?: Record<string, string>
): Promise<T> {
	const response = await fetchCore( url, {
		params,
		headers: { Accept: 'application/json' }
	} );
	return ( await response.json() ) as T;
}

export async function makeRestGetRequest<T>(
	path: string,
	params?: Record<string, string>,
	needAuth: boolean = false
): Promise<T> {
	return withRestRetry( async () => {
		const headers: Record<string, string> = {
			Accept: 'application/json'
		};

		const { headers: authHeaders } = await withAuth(
			headers,
			undefined,
			needAuth
		);

		const { server, scriptpath } = wikiService.getCurrent().config;

		const response = await fetchCore( `${ server }${ scriptpath }/rest.php${ path }`, {
			params,
			headers: authHeaders
		} );
		return ( await response.json() ) as T;
	} );
}

export async function makeRestPutRequest<T>(
	path: string,
	body: Record<string, unknown>,
	needAuth: boolean = false
): Promise<T> {
	return withRestRetry( async () => {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			'Content-Type': 'application/json'
		};

		const { headers: authHeaders, body: authBody } = await withAuth(
			headers,
			body,
			needAuth
		);

		const { server, scriptpath } = wikiService.getCurrent().config;

		const response = await fetchCore( `${ server }${ scriptpath }/rest.php${ path }`, {
			headers: authHeaders,
			method: 'PUT',
			body: authBody
		} );
		return ( await response.json() ) as T;
	} );
}

export async function makeRestPostRequest<T>(
	path: string,
	body?: Record<string, unknown>,
	needAuth: boolean = false
): Promise<T> {
	return withRestRetry( async () => {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			'Content-Type': 'application/json'
		};

		const { headers: authHeaders, body: authBody } = await withAuth(
			headers,
			body,
			needAuth
		);

		const { server, scriptpath } = wikiService.getCurrent().config;

		const response = await fetchCore( `${ server }${ scriptpath }/rest.php${ path }`, {
			headers: authHeaders,
			method: 'POST',
			body: authBody
		} );
		return ( await response.json() ) as T;
	} );
}

export async function fetchPageHtml( url: string ): Promise<string | null> {
	try {
		const response = await fetchCore( url );
		return await response.text();
	} catch {
		return null;
	}
}

export async function fetchImageAsBase64( url: string ): Promise<string | null> {
	try {
		const response = await fetchCore( url );
		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from( arrayBuffer );
		return buffer.toString( 'base64' );
	} catch {
		return null;
	}
}

export function getPageUrl( title: string ): string {
	const { server, articlepath } = wikiService.getCurrent().config;
	return `${ server }${ articlepath }/${ encodeURIComponent( title ) }`;
}

export function formatEditComment( tool: string, comment?: string ): string {
	const suffix = `(via ${ tool } on MediaWiki MCP Server)`;
	if ( !comment ) {
		return `Automated edit ${ suffix }`;
	}
	return `${ comment } ${ suffix }`;
}
