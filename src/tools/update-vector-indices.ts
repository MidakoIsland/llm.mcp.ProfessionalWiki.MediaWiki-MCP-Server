import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { processBatchOperations } from '../common/utils.js';
import { getMwn } from '../common/mwn.js';


export function updateVectorIndicesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'update-vector-indices',
		'Triggers a re-indexing of the specified wiki pages in the vector database.',
		{
			pages: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				title: z.string().describe( 'Wiki page title to re-index' )
			} ) ).describe( 'List of one or more pages to re-index across one or more wikis' )
		},
		{
			title: 'Update vector indices',
			readOnlyHint: false,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { pages } ) => handleUpdateVectorIndicesTool( pages )
	);
}

// Helper to split array into smaller chunks
function chunkArray<T>( array: T[], size: number ): T[][] {
	const chunked: T[][] = [];
	for ( let i = 0; i < array.length; i += size ) {
		chunked.push( array.slice( i, i + size ) );
	}
	return chunked;
}

async function handleUpdateVectorIndicesTool(
	pages: { wikiSite: string; title: string }[]
): Promise<CallToolResult> {
	// Group pages by wikiSite
	const pagesByWiki = new Map<string, string[]>();
	for ( const page of pages ) {
		const titles = pagesByWiki.get( page.wikiSite ) || [];
		titles.push( page.title );
		pagesByWiki.set( page.wikiSite, titles );
	}

	const batchRequests = Array.from( pagesByWiki.entries() ).map( ( [ wikiSite, titles ] ) => ( { wikiSite, titles } ) );

	return processBatchOperations(
		batchRequests,
		( req ) => req.wikiSite,
		async ( req ) => {
			const mwn = await getMwn( req.wikiSite );
			const token = await mwn.getCsrfToken();

			// The midako-index API has a multi limit of 500. We chunk at 500 just to be safe.
			const titleChunks = chunkArray( req.titles, 500 );
			const results: TextContent[] = [];

			for ( const chunk of titleChunks ) {
				const response = await mwn.request( {
					action: 'midako-index',
					titles: chunk.join( '|' ),
					token: token
				}, { method: 'POST' } );

				results.push( {
					type: 'text',
					text: `[${ req.wikiSite }] Successfully triggered indexing for ${ chunk.length } pages.\nResponse: ${ JSON.stringify( response['midako-index'], null, 2 ) }`
				} );
			}
			return results;
		}
	);
}
