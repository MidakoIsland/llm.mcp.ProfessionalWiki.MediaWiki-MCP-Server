import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { getMwn } from '../common/mwn.js';
import { processBatchOperations, formatEditComment } from '../common/utils.js';

export function undeletePagesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'undelete-pages',
		'Undeletes one or more wiki pages.',
		{
			pages: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				title: z.string().describe( 'Wiki page title' ),
				comment: z.string().optional().describe( 'Reason for undeleting the page' )
			} ) ).describe( 'List of one or more pages to undelete' )
		},
		{
			title: 'Undelete pages',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( { pages } ) => handleUndeletePagesTool( pages )
	);
}

async function handleUndeletePagesTool(
	pages: { wikiSite: string; title: string; comment?: string }[]
): Promise<CallToolResult> {
	return processBatchOperations(
		pages,
		( page ) => page.wikiSite,
		async ( page ) => {
			const mwn = await getMwn( page.wikiSite );
			const data = await mwn.undelete( page.title, formatEditComment( 'undelete-pages', page.comment ) );
			return [ {
				type: 'text',
				text: `[${ page.wikiSite }] Page undeleted successfully: ${ data.title }`
			} ];
		}
	);
}
