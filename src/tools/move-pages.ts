import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { getMwn } from '../common/mwn.js';
import { formatEditComment, ensureWiki } from '../common/utils.js';

export function movePagesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'move-pages',
		'Moves (renames) multiple wiki pages. Can optionally leave a redirect behind.',
		{
			pages: z.array( z.object( {
				wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
				fromTitle: z.string().describe( 'Current wiki page title' ),
				toTitle: z.string().describe( 'New wiki page title' ),
				reason: z.string().optional().describe( 'Reason for moving the page' ),
				noredirect: z.boolean().optional().default( false ).describe( 'If true, do not create a redirect. Requires the suppressredirect right.' ),
				movesubpages: z.boolean().optional().default( true ).describe( 'If true, rename subpages, if applicable.' )
			} ) ).describe( 'List of pages to move' )
		},
		{
			title: 'Move pages',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( { pages } ) => handleMovePagesTool( pages )
	);
}

async function handleMovePagesTool(
	pages: { wikiSite: string; fromTitle: string; toTitle: string; reason?: string; noredirect?: boolean; movesubpages?: boolean }[]
): Promise<CallToolResult> {
	const results: TextContent[] = [];
	let hasError = false;

	for ( const page of pages ) {
		try {
			ensureWiki( page.wikiSite );
			const mwn = await getMwn();
			const data = await mwn.move( page.fromTitle, page.toTitle, formatEditComment( 'move-pages', page.reason ), {
				noredirect: page.noredirect,
				movesubpages: page.movesubpages
			} );

			results.push( {
				type: 'text',
				text: `[${ page.wikiSite }] Page successfully moved from "${ data.from }" to "${ data.to }".`
			} );
		} catch ( error ) {
			hasError = true;
			results.push( {
				type: 'text',
				text: `[${ page.wikiSite }] Failed to move page "${ page.fromTitle }": ${ ( error as Error ).message }`
			} );
		}
	}

	return {
		content: results,
		isError: hasError
	};
}
