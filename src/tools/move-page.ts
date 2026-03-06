import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { getMwn } from '../common/mwn.js';
import { formatEditComment, ensureWiki } from '../common/utils.js';

export function movePageTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'move-page',
		'Moves (renames) a wiki page. Can optionally leave a redirect behind.',
		{
			wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
			fromTitle: z.string().describe( 'Current wiki page title' ),
			toTitle: z.string().describe( 'New wiki page title' ),
			reason: z.string().optional().describe( 'Reason for moving the page' ),
			noredirect: z.boolean().optional().default( false ).describe( 'If true, do not create a redirect. Requires the suppressredirect right.' ),
			movesubpages: z.boolean().optional().default( true ).describe( 'If true, rename subpages, if applicable.' )
		},
		{
			title: 'Move page',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async (
			{ wikiSite, fromTitle, toTitle, reason, noredirect, movesubpages }
		) => handleMovePageTool( wikiSite, fromTitle, toTitle, reason, noredirect, movesubpages )
	);
}

async function handleMovePageTool(
	wikiSite: string,
	fromTitle: string,
	toTitle: string,
	reason?: string,
	noredirect?: boolean,
	movesubpages?: boolean
): Promise<CallToolResult> {
	ensureWiki( wikiSite );

	try {
		const mwn = await getMwn();
		const data = await mwn.move( fromTitle, toTitle, formatEditComment( 'move-page', reason ), {
			noredirect: noredirect,
			movesubpages: movesubpages
		} );

		return {
			content: [
				{
					type: 'text',
					text: `Page successfully moved from "${ data.from }" to "${ data.to }".`
				} as TextContent
			]
		};
	} catch ( error ) {
		return {
			content: [
				{
					type: 'text',
					text: `Move failed: ${ ( error as Error ).message }`
				} as TextContent
			],
			isError: true
		};
	}
}
