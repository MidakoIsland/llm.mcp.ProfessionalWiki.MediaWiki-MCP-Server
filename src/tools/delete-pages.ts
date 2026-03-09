import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { getMwn } from '../common/mwn.js';
import { processBatchOperations, formatEditComment } from '../common/utils.js';

export function deletePagesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'delete-pages',
		'Deletes one or more wiki pages. IMPORTANT: If you only want to change the title of a page, DO NOT delete and recreate it. Use the move-pages tool instead.',
		{
			pages: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				title: z.string().describe( 'Wiki page title' ),
				comment: z.string().optional().describe( 'Reason for deleting the page' )
			} ) ).describe( 'List of one or more pages to delete' )
		},
		{
			title: 'Delete pages',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( { pages } ) => handleDeletePagesTool( pages )
	);
}

async function handleDeletePagesTool(
	pages: { wikiSite: string; title: string; comment?: string }[]
): Promise<CallToolResult> {
	return processBatchOperations(
		pages,
		( page ) => page.wikiSite,
		async ( page ) => {
			const mwn = await getMwn( page.wikiSite );
			const data = await mwn.delete( page.title, formatEditComment( 'delete-pages', page.comment ) );
			return [ {
				type: 'text',
				text: `[${ page.wikiSite }] Page deleted successfully: ${ data.title }`
			} ];
		}
	);
}
