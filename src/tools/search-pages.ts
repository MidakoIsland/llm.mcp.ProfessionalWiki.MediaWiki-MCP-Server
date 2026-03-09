import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { wikiService } from '../common/wikiService.js';
import { getMwn } from '../common/mwn.js';
import { ensureWiki } from '../common/utils.js';

export function searchPagesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'search-pages',
		'Search wiki page titles and contents for the provided search terms across one or more wikis, and returns matching pages.',
		{
			searches: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				query: z.string().describe( 'Search terms' ),
				limit: z.number().int().min( 1 ).max( 500 ).optional().describe( 'Maximum number of search results to return' ),
				namespaces: z.array( z.number().int().nonnegative() ).optional().describe( 'Namespace IDs to search within (e.g. [0] for main namespace, [0, 1, 2] for main, talk, and user)' )
			} ) ).describe( 'List of one or more searches to perform' )
		},
		{
			title: 'Search pages',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { searches } ) => handleSearchPagesTool( searches )
	);
}

async function handleSearchPagesTool(
	searches: { wikiSite: string; query: string; limit?: number; namespaces?: number[] }[]
): Promise<CallToolResult> {
	const results: TextContent[] = [];
	let hasError = false;

	for ( const search of searches ) {
		try {
			ensureWiki( search.wikiSite );
			const mwn = await getMwn();
			const params: Record<string, string | number> = {
				action: 'query',
				list: 'search',
				srsearch: search.query,
				srlimit: search.limit ?? 50
			};

			if ( search.namespaces && search.namespaces.length > 0 ) {
				params.srnamespace = search.namespaces.join( '|' );
			}

			const data = await mwn.request( params );

			const pages = data.query?.search || [];
			if ( pages.length === 0 ) {
				results.push( {
					type: 'text',
					text: `[${ search.wikiSite }] No pages found for query "${ search.query }"`
				} );
			} else {
				results.push( {
					type: 'text',
					text: `[${ search.wikiSite }] Results for query "${ search.query }":\n` + 
						pages.map( ( p: any ) => getSearchResultToolResult( search.wikiSite, p ) ).map( ( t: TextContent ) => t.text ).join( '\n\n' )
				} );
			}
		} catch ( error ) {
			hasError = true;
			results.push( {
				type: 'text',
				text: `[${ search.wikiSite }] Failed to retrieve search data for query "${ search.query }": ${ ( error as Error ).message }`
			} );
		}
	}

	return {
		content: results,
		isError: hasError
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSearchResultToolResult( wikiSite: string, result: any ): TextContent {
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
