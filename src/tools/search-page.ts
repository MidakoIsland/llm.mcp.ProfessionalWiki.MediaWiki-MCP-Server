import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { wikiService } from '../common/wikiService.js';
import { getMwn } from '../common/mwn.js';
import { ensureWiki } from '../common/utils.js';

export function searchPageTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'search-page',
		'Search wiki page titles and contents for the provided search terms, and returns matching pages.',
		{
			wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
			query: z.string().describe( 'Search terms' ),
			limit: z.number().int().min( 1 ).max( 500 ).optional().describe( 'Maximum number of search results to return' ),
			namespaces: z.array( z.number().int().nonnegative() ).optional().describe( 'Namespace IDs to search within (e.g. [0] for main namespace, [0, 1, 2] for main, talk, and user)' )
		},
		{
			title: 'Search page',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { wikiSite, query, limit, namespaces } ) => handleSearchPageTool( wikiSite, query, limit, namespaces )
	);
}

async function handleSearchPageTool( wikiSite: string, query: string, limit?: number, namespaces?: number[] ): Promise< CallToolResult > {
	ensureWiki( wikiSite );

	try {
		const mwn = await getMwn();
		const params: Record<string, string | number> = {
			action: 'query',
			list: 'search',
			srsearch: query,
			srlimit: limit ?? 50
		};

		if ( namespaces && namespaces.length > 0 ) {
			params.srnamespace = namespaces.join( '|' );
		}

		const data = await mwn.request( params );

		const pages = data.query?.search || [];
		if ( pages.length === 0 ) {
			return {
				content: [
					{ type: 'text', text: `No pages found for ${ query }` } as TextContent
				]
			};
		}

		return {
			content: pages.map( getSearchResultToolResult )
		};
	} catch ( error ) {
		return {
			content: [
				{ type: 'text', text: `Failed to retrieve search data: ${ ( error as Error ).message }` } as TextContent
			],
			isError: true
		};
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSearchResultToolResult( result: any ): TextContent {
	const { server, articlepath, scriptpath } = wikiService.getCurrent().config;
	const isRestUrl = articlepath === undefined; // fallback mechanism
	const pageUrl = isRestUrl ? `${ server }${ scriptpath }/index.php?title=${ encodeURIComponent( result.title ) }` : `${ server }${ articlepath }/${ encodeURIComponent( result.title ) }`;
	return {
		type: 'text',
		text: [
			`Title: ${ result.title }`,
			`Snippet: ${ result.snippet.replace( /<[^>]*>?/gm, '' ) }`, // Strip HTML tags like <span class="searchmatch">
			`Page ID: ${ result.pageid }`,
			`Namespace: ${ result.ns }`,
			`Size: ${ result.size } bytes`,
			`Word count: ${ result.wordcount }`,
			`Page URL: ${ pageUrl }`
		].join( '\n' )
	};
}
