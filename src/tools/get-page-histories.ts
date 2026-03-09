import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { makeRestGetRequest, ensureWiki } from '../common/utils.js';
import type { MwRestApiGetPageHistoryResponse, MwRestApiRevisionObject } from '../types/mwRestApi.js';

export function getPageHistoriesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-page-histories',
		'Returns information about the latest revisions to one or more wiki pages, in segments of 20 revisions, starting with the latest revision. The response includes API routes for the next oldest, next newest, and latest revision segments.',
		{
			pages: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				title: z.string().describe( 'Wiki page title' ),
				olderThan: z.number().int().positive().optional().describe( 'Revision ID of the oldest revision to return' ),
				newerThan: z.number().int().positive().optional().describe( 'Revision ID of the newest revision to return' ),
				filter: z.string().optional().describe( 'Filter that returns only revisions with certain tags. Only support one filter per request.' )
			} ) ).describe( 'List of one or more pages to get history for' )
		},
		{
			title: 'Get page histories',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { pages } ) => handleGetPageHistoriesTool( pages )
	);
}

async function handleGetPageHistoriesTool(
	pages: { wikiSite: string; title: string; olderThan?: number; newerThan?: number; filter?: string }[]
): Promise<CallToolResult> {
	const results: TextContent[] = [];
	let hasError = false;

	for ( const page of pages ) {
		const params: Record<string, string> = {};
		if ( page.olderThan ) {
			params.olderThan = page.olderThan.toString();
		}
		if ( page.newerThan ) {
			params.newerThan = page.newerThan.toString();
		}
		if ( page.filter ) {
			params.filter = page.filter;
		}

		try {
			ensureWiki( page.wikiSite );
			const data = await makeRestGetRequest<MwRestApiGetPageHistoryResponse>(
				`/v1/page/${ encodeURIComponent( page.title ) }/history`,
				params
			);

			if ( data.revisions.length === 0 ) {
				results.push( {
					type: 'text',
					text: `[${ page.wikiSite }] No revisions found for page "${ page.title }"`
				} );
			} else {
				results.push( {
					type: 'text',
					text: `[${ page.wikiSite }] History for page "${ page.title }":\n` + 
						data.revisions.map( getPageHistoryToolResult ).map( t => t.text ).join( '\n\n' )
				} );
			}
		} catch ( error ) {
			hasError = true;
			results.push( {
				type: 'text',
				text: `[${ page.wikiSite }] Failed to retrieve page history for "${ page.title }": ${ ( error as Error ).message }`
			} );
		}
	}

	return {
		content: results,
		isError: hasError
	};
}

function getPageHistoryToolResult( result: MwRestApiRevisionObject ): TextContent {
	return {
		type: 'text',
		text: [
			`Revision ID: ${ result.id }`,
			`Timestamp: ${ result.timestamp }`,
			`User: ${ result.user.name } (ID: ${ result.user.id })`,
			`Comment: ${ result.comment }`,
			`Size: ${ result.size }`,
			`Delta: ${ result.delta }`
		].join( '\n' )
	};
}
