import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { processBatchOperations, makeRestPutRequest, getPageUrl, formatEditComment } from '../common/utils.js';
import type { MwRestApiPageObject } from '../types/mwRestApi.js';

export function updatePagesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'update-pages',
		'Updates one or more wiki pages. Replaces the existing content of a page with the provided content. CRITICAL: DO NOT write any <h1> title (`= ... =`) into the page content! MediaWiki already generates an H1 title from the page name.',
		{
			pages: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				title: z.string().describe( 'Wiki page title' ),
				source: z.string().describe( 'Page content in the same content model of the existing page' ),
				latestId: z.number().int().positive().describe( 'Revision ID used as the base for the new source' ),
				comment: z.string().optional().describe( 'Summary of the edit' )
			} ) ).describe( 'List of one or more pages to update' )
		},
		{
			title: 'Update pages',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( { pages } ) => handleUpdatePagesTool( pages )
	);
}

async function handleUpdatePagesTool(
	pages: { wikiSite: string; title: string; source: string; latestId: number; comment?: string }[]
): Promise<CallToolResult> {
	return processBatchOperations(
		pages,
		( page ) => page.wikiSite,
		async ( page ) => {
			const data = await makeRestPutRequest<MwRestApiPageObject>( page.wikiSite, `/v1/page/${ encodeURIComponent( page.title ) }`, {
				source: page.source,
				comment: formatEditComment( 'update-pages', page.comment ),
				latest: { id: page.latestId }
			}, true );

			return [ {
				type: 'text',
				text: `[${ page.wikiSite }] Page updated successfully: ${ getPageUrl( page.wikiSite, data.title ) }\nPage ID: ${ data.id }\nNew Revision ID: ${ data.latest.id }`
			} ];
		}
	);
}
